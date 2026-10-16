import * as T from 'three';
import type { V3 } from './personnel-navigation';

export type NathanContact = { feet: [V3,V3]; hands?: [V3|undefined,V3|undefined]; handWeight?:number; grips?:[V3,V3][]; gripGait?:{phase:number;advance:V3}; hipHeight?: number; seated?: V3; lean?:number };
const up=new T.Vector3(0,1,0),pos=(n:T.Object3D)=>n.getWorldPosition(new T.Vector3());
function worldRotation(bone:T.Object3D,q:T.Quaternion){bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);}
/** Analytic two-link IK: preserve segment lengths and the requested bend plane. */
export function solveLimb(a:T.Object3D,b:T.Object3D,end:T.Object3D,target:T.Vector3,pole:T.Vector3){
  const origin=pos(a),mid=pos(b),tip=pos(end),l1=origin.distanceTo(mid),l2=mid.distanceTo(tip),direction=target.clone().sub(origin);
  const d=T.MathUtils.clamp(direction.length(),Math.abs(l1-l2)+1e-5,l1+l2-1e-5);direction.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),bend=pole.clone().addScaledVector(direction,-pole.dot(direction));
  if(bend.lengthSq()<1e-8)bend.copy(up).addScaledVector(direction,-up.dot(direction));bend.normalize();
  const knee=origin.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
  const rotate=(bone:T.Object3D,old:T.Vector3,next:T.Vector3)=>worldRotation(bone,new T.Quaternion().setFromUnitVectors(old.normalize(),next.normalize()).multiply(bone.getWorldQuaternion(new T.Quaternion())));
  rotate(a,mid.sub(origin),knee.sub(origin));
  rotate(b,pos(end).sub(pos(b)),target.clone().sub(pos(b)));
  return pos(end).distanceTo(target);
}
type Limb={upper:T.Object3D;lower:T.Object3D;end:T.Object3D;sole:T.Vector3;rotation:T.Quaternion};
/** World-space foot/hand constraints are applied after the animation mixer, never
 * followed by a second global grounding pass that would move planted contacts. */
export class NathanContactRig{
  readonly feet:Limb[]=[];readonly arms:Limb[]=[];readonly errors:number[]=[];
  private hip:T.Object3D;private saved=new Map<T.Object3D,T.Quaternion>();
  private holds:(T.Vector3|undefined)[]=[];private gripSet?:[V3,V3][];private gripPhase?:number;
  constructor(private root:T.Object3D,private model:T.Object3D,private offset:T.Object3D,private restRoot?:T.Quaternion){
    const bone=(s:string)=>model.getObjectByName('rp_nathan_animated_003_walking_'+s)!;
    this.hip=bone('hip');root.updateWorldMatrix(true,true);
    const inverse=root.getWorldQuaternion(new T.Quaternion()).invert();
    for(const side of ['l','r']){
      const foot=bone('foot_'+side),ball=pos(bone('ball_'+side)),ground=root.localToWorld(new T.Vector3()).y;
      ball.y=ground+.005*root.getWorldScale(new T.Vector3()).y;
      this.feet.push({upper:bone('upperleg_'+side),lower:bone('lowerleg_'+side),end:foot,sole:foot.worldToLocal(ball),rotation:inverse.clone().multiply(foot.getWorldQuaternion(new T.Quaternion()))});
      const hand=bone('hand_'+side);
      const palm=pos(bone('middle_01_'+side)).lerp(pos(bone('index_01_'+side)),.5);
      this.arms.push({upper:bone('upperarm_'+side),lower:bone('lowerarm_'+side),end:hand,sole:hand.worldToLocal(palm),rotation:inverse.clone().multiply(hand.getWorldQuaternion(new T.Quaternion()))});
    }
  }
  restore(){for(const [bone,q] of this.saved)bone.quaternion.copy(q);this.saved.clear();}
  resetGrips(){this.holds=[];this.gripSet=undefined;this.gripPhase=undefined;}
  stabilize(){if(!this.restRoot)return;const bone=this.model.getObjectByName('rp_nathan_animated_003_walking_root')!;this.saved.set(bone,bone.quaternion.clone());bone.quaternion.copy(this.restRoot);this.root.updateWorldMatrix(true,true);}
  sole(index:number){return this.feet[index].end.localToWorld(this.feet[index].sole.clone());}
  apply(pose:NathanContact){
    this.root.updateWorldMatrix(true,true);this.errors.length=0;
    for(const limb of [...this.feet,...this.arms])for(const bone of [limb.upper,limb.lower,limb.end])this.saved.set(bone,bone.quaternion.clone());
    const scale=this.root.getWorldScale(new T.Vector3()).y,rotation=this.root.getWorldQuaternion(new T.Quaternion());
    const forward=new T.Vector3(0,0,-1).applyQuaternion(rotation),right=new T.Vector3(1,0,0).applyQuaternion(rotation);
    if(this.gripSet!==pose.grips){this.resetGrips();this.gripSet=pose.grips;}
    const phase=pose.gripGait?.phase,direction=phase!==undefined&&this.gripPhase!==undefined&&phase<this.gripPhase?-1:1;
    if(phase!==undefined&&this.gripPhase!==undefined&&Math.abs(phase-this.gripPhase)>1)this.holds=[];
    const footRotations=this.feet.map(f=>rotation.clone().multiply(f.rotation));
    const targets=this.feet.map((f,i)=>new T.Vector3(...pose.feet[i]).sub(f.sole.clone().multiply(f.end.getWorldScale(new T.Vector3())).applyQuaternion(footRotations[i])));
    const hipTarget=pose.seated?new T.Vector3(...pose.seated):this.root.localToWorld(new T.Vector3(0,pose.hipHeight??.89,0));
    // Lower the pelvis only as much as necessary to keep both feet reachable.
    if(!pose.seated)for(let i=0;i<2;i++){
      const f=this.feet[i],hip=pos(f.upper),length=hip.distanceTo(pos(f.lower))+pos(f.lower).distanceTo(pos(f.end));
      const dx=hip.x-targets[i].x,dz=hip.z-targets[i].z,vertical=Math.sqrt(Math.max(.04*scale*scale,(length*.99)**2-dx*dx-dz*dz));
      hipTarget.y=Math.min(hipTarget.y,targets[i].y+vertical-(hip.y-pos(this.hip).y));
    }
    this.offset.position.add(this.root.worldToLocal(hipTarget.clone()).sub(this.root.worldToLocal(pos(this.hip))));this.root.updateWorldMatrix(true,true);
    if(pose.lean){const spine=this.model.getObjectByName('rp_nathan_animated_003_walking_spine_01')!;this.saved.set(spine,spine.quaternion.clone());worldRotation(spine,new T.Quaternion().setFromAxisAngle(right,-pose.lean).multiply(spine.getWorldQuaternion(new T.Quaternion())));}
    for(let i=0;i<2;i++){
      const f=this.feet[i];solveLimb(f.upper,f.lower,f.end,targets[i],forward);
      worldRotation(f.end,footRotations[i]);this.errors.push(this.sole(i).distanceTo(new T.Vector3(...pose.feet[i])));
      const arm=this.arms[i];let target=pose.hands?.[i];
      // A gripping wrist keeps a stable orientation instead of twisting with
      // each source-clip loop while its palm is constrained to the same rail.
      const handRotation=pose.grips?rotation.clone().multiply(arm.rotation):arm.end.getWorldQuaternion(new T.Quaternion()),palmOffset=arm.sole.clone().multiply(arm.end.getWorldScale(new T.Vector3())).applyQuaternion(handRotation);
      if(!target&&pose.grips?.length){
        const shoulder=pos(arm.upper),reach=shoulder.distanceTo(pos(arm.lower))+pos(arm.lower).distanceTo(pos(arm.end));
        const desired=shoulder.clone().addScaledVector(forward,.27*scale).addScaledVector(up,-.02*scale);
        if(pose.gripGait)desired.addScaledVector(new T.Vector3(...pose.gripGait.advance),direction);
        let best=Infinity;
        for(const [a,b] of pose.grips){const p=new T.Line3(new T.Vector3(...a),new T.Vector3(...b)).closestPointToPoint(desired,true,new T.Vector3());
          const d=p.distanceTo(desired);if(p.distanceTo(shoulder)<reach*.98+palmOffset.length()&&d<best){best=d;target=p.toArray() as V3;}}
        if(!target&&this.holds[i]&&this.holds[i]!.distanceTo(shoulder)<reach*.985+palmOffset.length())target=this.holds[i]!.toArray() as V3;
        if(phase!==undefined&&target){
          const t=phase-Math.floor(phase),held=this.holds[i],reachable=held&&held.distanceTo(shoulder)<reach*.985+palmOffset.length();
          const transfer=(t<=.2||t>=.8)&&Math.floor(phase)%2===i;
          if(!reachable)this.holds[i]=new T.Vector3(...target);
          else if(transfer)held!.lerp(new T.Vector3(...target),.25);
          target=this.holds[i]!.toArray() as V3;
        }
      }
      if(target){
        if(pose.grips){
          const shoulder=pos(arm.upper),delta=new T.Vector3(...target).sub(shoulder),distance=delta.length(),toward=delta.normalize(),length=palmOffset.length();
          const minimum=Math.abs(shoulder.distanceTo(pos(arm.lower))-pos(arm.lower).distanceTo(pos(arm.end)))+.01*scale;
          // Near the shoulder, bend the wrist around the rail rather than
          // putting it inside the arm's unreachable inner radius.
          if(distance-length<minimum&&distance>1e-6){const cosine=T.MathUtils.clamp((distance*distance+length*length-minimum*minimum)/(2*distance*length),-1,1),side=right.clone().addScaledVector(toward,-right.dot(toward));if(side.lengthSq()<1e-8)side.copy(up).addScaledVector(toward,-up.dot(toward));side.normalize();toward.multiplyScalar(cosine).addScaledVector(side,Math.sqrt(1-cosine*cosine));}
          handRotation.premultiply(new T.Quaternion().setFromUnitVectors(palmOffset.clone().normalize(),toward));palmOffset.copy(toward).multiplyScalar(length);
        }
        const wrist=new T.Vector3(...target).sub(palmOffset),aim=pos(arm.end).lerp(wrist,pose.handWeight??1);this.errors.push(solveLimb(arm.upper,arm.lower,arm.end,aim,right.clone().multiplyScalar(i?1:-1).addScaledVector(up,-.5)));worldRotation(arm.end,handRotation);
      }
    }
    this.gripPhase=phase;
    this.model.updateWorldMatrix(true,true);
  }
}

export function standingContact(root:T.Object3D):NathanContact{
  return {feet:[root.localToWorld(new T.Vector3(-.12,.005,-.1)).toArray() as V3,root.localToWorld(new T.Vector3(.12,.005,-.1)).toArray() as V3]};
}
