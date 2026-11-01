import * as T from 'three';
import type { V3 } from './personnel-navigation';
import {NathanGrasp} from './nathan-grasp';

export type NathanContact = { handsOnly?:boolean; feet: [V3,V3]; hands?: [V3|undefined,V3|undefined]; handTangents?:[V3,V3]; handWeight?:number; handApproach?:V3; grips?:[V3,V3][]; handGrips?:[[V3,V3][],[V3,V3][]]; gripAim?:[V3,V3]; settleGrips?:boolean; gripGait?:{phase:number;advance:V3}; hipHeight?: number; seated?: V3; lean?:number; elbowPole?:V3; gripHands?:boolean; steeringBlend?:number; disableClimbFallback?:boolean; freeHands?:boolean; keepFreeHandMotion?:boolean; procedural?:boolean; gripRadius?:number; elbowLimits?:[number,number] };
const up=new T.Vector3(0,1,0),pos=(n:T.Object3D)=>n.getWorldPosition(new T.Vector3());
function worldRotation(bone:T.Object3D,q:T.Quaternion){bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);}
/** Analytic two-link IK: preserve segment lengths and the requested bend plane. */
export function solveLimb(a:T.Object3D,b:T.Object3D,end:T.Object3D,target:T.Vector3,pole:T.Vector3){
  const origin=pos(a),mid=pos(b),tip=pos(end),l1=origin.distanceTo(mid),l2=mid.distanceTo(tip),direction=target.clone().sub(origin);
  if(direction.lengthSq()<1e-12)direction.copy(tip).sub(origin);
  const d=T.MathUtils.clamp(direction.length(),Math.abs(l1-l2)+1e-5,l1+l2-1e-5);direction.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),bend=pole.clone().addScaledVector(direction,-pole.dot(direction));
  if(bend.lengthSq()<1e-8)bend.copy(up).addScaledVector(direction,-up.dot(direction));
  if(bend.lengthSq()<1e-8)bend.set(1,0,0).addScaledVector(direction,-direction.x);bend.normalize();
  const knee=origin.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
  const rotate=(bone:T.Object3D,old:T.Vector3,next:T.Vector3)=>worldRotation(bone,new T.Quaternion().setFromUnitVectors(old.normalize(),next.normalize()).multiply(bone.getWorldQuaternion(new T.Quaternion())));
  rotate(a,mid.sub(origin),knee.sub(origin));
  rotate(b,pos(end).sub(pos(b)),target.clone().sub(pos(b)));
  return pos(end).distanceTo(target);
}
type Limb={upper:T.Object3D;lower:T.Object3D;end:T.Object3D;sole:T.Vector3;rotation:T.Quaternion};
/** Sliding along one continuous stile is not a release/regrasp. */
function sameGripRail(a:T.Vector3,b:T.Vector3,segments:[V3,V3][],scale:number){
  const lines=segments.map(([p,q])=>new T.Line3(new T.Vector3(...p),new T.Vector3(...q))),tolerance=.012*scale;
  const queue=lines.map((line,i)=>line.closestPointToPoint(a,true,new T.Vector3()).distanceTo(a)<tolerance?i:-1).filter(i=>i>=0),seen=new Set(queue);
  for(let at=0;at<queue.length;at++){
    const line=lines[queue[at]];if(line.closestPointToPoint(b,true,new T.Vector3()).distanceTo(b)<tolerance)return true;
    for(let i=0;i<lines.length;i++)if(!seen.has(i)&&[line.start,line.end].some(p=>[lines[i].start,lines[i].end].some(q=>p.distanceTo(q)<tolerance))){seen.add(i);queue.push(i);}
  }
  return false;
}
/** Choose the grasp's rotation around the tube together with the elbow plane.
 * Fixing the palm radially toward the shoulder forces an almost right-angle
 * wrist when the elbow is below a vertical rail. The tube permits a free roll;
 * use it to align the metacarpals with the forearm and keep elbows near the ribs. */
function fitGrasp(arm:Limb,grasp:NathanGrasp,target:T.Vector3,tangent:T.Vector3,side:number,forward:T.Vector3,right:T.Vector3,scale:number,hint:T.Vector3,lateralLimit=.095,cabDoor=false,previous?:{rotation:T.Quaternion;elbow:T.Vector3},dt=1/60){
  const shoulder=pos(arm.upper),l1=shoulder.distanceTo(pos(arm.lower)),l2=pos(arm.lower).distanceTo(pos(arm.end));
  const base=grasp.rotation(target,shoulder,tangent,side,forward),size=arm.end.getWorldScale(new T.Vector3());
  let best=Infinity,result={rotation:base,wrist:target.clone(),pole:hint.clone()};
  const rolls=Array.from({length:37},(_,i)=>-180+i*10),axis=tangent.clone().normalize();
  if(previous){
    const priorAxis=new T.Vector3(0,0,side?1:-1).applyQuaternion(previous.rotation);
    const aligned=new T.Quaternion().setFromUnitVectors(priorAxis,axis).multiply(previous.rotation);
    const delta=aligned.multiply(base.clone().invert());
    const priorRoll=2*Math.atan2(delta.x*axis.x+delta.y*axis.y+delta.z*axis.z,delta.w)*180/Math.PI;
    rolls.push(...[-10,-5,0,5,10].map(d=>priorRoll+d));
  }
  for(const roll of rolls){
    const rotation=new T.Quaternion().setFromAxisAngle(tangent.clone().normalize(),roll*Math.PI/180).multiply(base);
    const wrist=target.clone().sub(grasp.centre.clone().multiply(size).applyQuaternion(rotation));
    const delta=wrist.clone().sub(shoulder),distance=delta.length(),direction=delta.normalize();
    const d=T.MathUtils.clamp(distance,Math.abs(l1-l2)+1e-5,l1+l2-1e-5),along=(l1*l1-l2*l2+d*d)/(2*d),radius=Math.sqrt(Math.max(0,l1*l1-along*along));
    const centre=shoulder.clone().addScaledVector(direction,along),hand=grasp.direction.clone().applyQuaternion(rotation);
    const ideal=wrist.clone().addScaledVector(hand,-l2).sub(centre).addScaledVector(direction,-wrist.clone().addScaledVector(hand,-l2).sub(centre).dot(direction)).normalize();
    const pole=hint.clone().addScaledVector(direction,-hint.dot(direction)).normalize();
    const bends=[0,.125,.25,.375,.5,.625,.75,.875,1].map(mix=>ideal.clone().lerp(pole,mix).normalize());
    if(previous){
      const prior=previous.elbow.clone().sub(centre);prior.addScaledVector(direction,-prior.dot(direction)).normalize();
      // Include the previous elbow plane and nearby planes explicitly. The
      // ideal/hint interpolation alone has a discontinuity when they oppose.
      for(const angle of [-30,-15,-7.5,0,7.5,15,30])bends.push(prior.clone().applyAxisAngle(direction,angle*Math.PI/180));
    }
    for(const bend of bends){
      const elbow=centre.clone().addScaledVector(bend,radius);
      const forearm=wrist.clone().sub(elbow).normalize(),angle=Math.acos(T.MathUtils.clamp(forearm.dot(hand),-1,1));
      const relative=elbow.clone().sub(shoulder).divideScalar(scale),lateral=relative.dot(right)*(side?1:-1);
      const score=angle*angle*.15+Math.max(0,angle-.62)**2*8+Math.max(0,angle-1.05)**2*1000+Math.max(0,lateral-lateralLimit)**2*(lateralLimit<0||!cabDoor?2000:55)+Math.max(0,-lateral-.07)**2*(cabDoor?80:1000)+Math.max(0,relative.y+(cabDoor?.12:.18))**2*(cabDoor?25:150)+Math.max(0,-relative.dot(forward)-.16)**2*40
        +Math.max(0,distance-(l1+l2)*.985)**2*10000+.000003*roll*roll
        +((previous?.rotation.angleTo(rotation)||0)**2*3+(previous?elbow.distanceToSquared(previous.elbow)/(scale*scale)*60:0))*.05/Math.max(.01,dt);
      if(score<best){best=score;result={rotation,wrist,pole:bend};}
    }
  }
  return result;
}
/** World-space foot/hand constraints are applied after the animation mixer, never
 * followed by a second global grounding pass that would move planted contacts. */
export class NathanContactRig{
  readonly feet:Limb[]=[];readonly arms:Limb[]=[];readonly errors:number[]=[];
  readonly grasps:NathanGrasp[]=[];
  readonly handContacts:({target:T.Vector3;centre:T.Vector3;tangent:T.Vector3;gripping:boolean}|undefined)[]=[];
  private hip:T.Object3D;private saved=new Map<T.Object3D,T.Quaternion>();
  private neutral=new Map<T.Object3D,T.Quaternion>();private torso:T.Object3D[]=[];
  private holds:(T.Vector3|undefined)[]=[];private gripSet?:[V3,V3][];private gripPhase?:number;
  private graspHistory:({rotation:T.Quaternion;elbow:T.Vector3}|undefined)[]=[];
  private transfers:({from:T.Vector3;axis:T.Vector3;phase:number;elapsed:number}|undefined)[]=[];
  constructor(private root:T.Object3D,private model:T.Object3D,private offset:T.Object3D,private restRoot?:T.Quaternion,graspClip?:T.AnimationClip){
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
      if(graspClip){
        const grasp=new NathanGrasp(hand,model,graspClip,side,hand.getWorldScale(new T.Vector3()).y/root.getWorldScale(new T.Vector3()).y);
        // Calibrate every profile in the same neutral pose. A blended access
        // clip can contain finger translations as well as rotations.
        for(const radius of [.010,.032,.012])grasp.setRadius(radius);
        this.grasps.push(grasp);
      }
    }
    model.traverse(n=>{if(n instanceof T.Bone)this.neutral.set(n,n.quaternion.clone());});
    this.torso=['hip','spine_01','spine_02','spine_03','neck','head'].map(bone).filter(Boolean);
  }
  restore(){for(const [bone,q] of this.saved)bone.quaternion.copy(q);this.saved.clear();}
  resetGrips(resetPose=true){this.holds=[];this.gripSet=undefined;this.gripPhase=undefined;if(resetPose){this.graspHistory=[];this.transfers=[];this.handContacts.length=0;}}
  private sameGrips(next?:[V3,V3][]) {
    if(this.gripSet===next)return true;
    if(!this.gripSet||!next||this.gripSet.length!==next.length)return false;
    return this.gripSet.every((segment,i)=>segment.every((point,j)=>point.every((value,k)=>Math.abs(value-next[i][j][k])<1e-5)));
  }
  stabilize(){if(!this.restRoot)return;const bone=this.model.getObjectByName('rp_nathan_animated_003_walking_root')!;this.saved.set(bone,bone.quaternion.clone());bone.quaternion.copy(this.restRoot);this.root.updateWorldMatrix(true,true);}
  sole(index:number){return this.feet[index].end.localToWorld(this.feet[index].sole.clone());}
  apply(pose:NathanContact,dt=1/60){
    this.root.updateWorldMatrix(true,true);this.errors.length=0;
    const priorContacts=this.handContacts.slice();this.handContacts.length=0;
    for(const limb of pose.handsOnly?this.arms:[...this.feet,...this.arms])for(const bone of [limb.upper,limb.lower,limb.end])if(!this.saved.has(bone))this.saved.set(bone,bone.quaternion.clone());
    const scale=this.root.getWorldScale(new T.Vector3()).y,rotation=this.root.getWorldQuaternion(new T.Quaternion());
    const forward=new T.Vector3(0,0,-1).applyQuaternion(rotation),right=new T.Vector3(1,0,0).applyQuaternion(rotation);
    // Access has its own contact phase. An unrelated looping climbing clip must
    // not twist the chest/head or reverse the elbow between two planted grips.
    if(pose.procedural){
      const fixedHands=this.arms.flatMap((l,i)=>pose.keepFreeHandMotion&&!pose.handGrips?.[i]?.length?[]:[l.upper,l.lower,l.end]);
      const bones=new Set([...this.torso,...this.feet.flatMap(l=>[l.upper,l.lower,l.end]),...fixedHands,...this.arms.map(l=>l.upper.parent!)]);
      for(const bone of bones){if(!this.saved.has(bone))this.saved.set(bone,bone.quaternion.clone());const q=this.neutral.get(bone);if(q)bone.quaternion.copy(q);}
    }
    // Remove the source clip's sustained forward hunch only while sitting.
    // Pelvis/torso are solved before feet and hands so contacts do not drift.
    if(pose.seated)for(const bone of this.torso){this.saved.set(bone,bone.quaternion.clone());bone.quaternion.slerp(this.neutral.get(bone)!,pose.steeringBlend??1);}
    this.root.updateWorldMatrix(true,true);
    // Keep handholds when a caller reconstructs an equivalent rail array each frame.
    if(!this.sameGrips(pose.grips)){
      this.resetGrips(false);this.gripSet=pose.grips;
      // Preserve a completed rim-to-rail transfer at the cab phase boundary.
      // Re-selecting a shoulder-nearest grip here made the hand jump 190 mm.
      for(let i=0;i<2;i++)if(priorContacts[i]){
        const target=priorContacts[i]!.target,lines=pose.handGrips?.[i]??pose.grips;
        if(lines?.some(([a,b])=>new T.Line3(new T.Vector3(...a),new T.Vector3(...b)).closestPointToPoint(target,true,new T.Vector3()).distanceTo(target)<.01*scale))this.holds[i]=target.clone();
      }
    }
    const phase=pose.gripGait?.phase,direction=phase!==undefined&&this.gripPhase!==undefined&&phase<this.gripPhase?-1:1;
    if(phase!==undefined&&this.gripPhase!==undefined&&Math.abs(phase-this.gripPhase)>1)this.holds=[];
    const footRotations=this.feet.map(f=>rotation.clone().multiply(f.rotation));
    const targets=this.feet.map((f,i)=>new T.Vector3(...pose.feet[i]).sub(f.sole.clone().multiply(f.end.getWorldScale(new T.Vector3())).applyQuaternion(footRotations[i])));
    const hipTarget=pose.seated?new T.Vector3(...pose.seated):this.root.localToWorld(new T.Vector3(0,pose.hipHeight??.89,0));
    // Lower the pelvis only as much as necessary to keep both feet reachable.
    if(!pose.handsOnly&&!pose.seated)for(let i=0;i<2;i++){
      const f=this.feet[i],hip=pos(f.upper),length=hip.distanceTo(pos(f.lower))+pos(f.lower).distanceTo(pos(f.end));
      const dx=hip.x-targets[i].x,dz=hip.z-targets[i].z,vertical=Math.sqrt(Math.max(.04*scale*scale,(length*.99)**2-dx*dx-dz*dz));
      hipTarget.y=Math.min(hipTarget.y,targets[i].y+vertical-(hip.y-pos(this.hip).y));
    }
    if(!pose.handsOnly)this.offset.position.add(this.root.worldToLocal(hipTarget.clone()).sub(this.root.worldToLocal(pos(this.hip))));this.root.updateWorldMatrix(true,true);
    if(pose.lean){const spine=this.model.getObjectByName('rp_nathan_animated_003_walking_spine_01')!;if(!this.saved.has(spine))this.saved.set(spine,spine.quaternion.clone());worldRotation(spine,new T.Quaternion().setFromAxisAngle(right,-pose.lean).multiply(spine.getWorldQuaternion(new T.Quaternion())));}
    for(let i=0;i<2;i++){
      if(pose.handsOnly&&!pose.hands?.[i])continue;
      const f=this.feet[i];if(!pose.handsOnly){solveLimb(f.upper,f.lower,f.end,targets[i],forward);
      worldRotation(f.end,footRotations[i]);this.errors.push(this.sole(i).distanceTo(new T.Vector3(...pose.feet[i])));}
      const grips=pose.handGrips?.[i]??pose.grips;
      const arm=this.arms[i],grasp=this.grasps[i],cylinder=grasp&&(pose.gripHands||pose.freeHands||!!grips?.length);let target=pose.hands?.[i],tangent=pose.handTangents?new T.Vector3(...pose.handTangents[i]):undefined;
      let transferWeight=1,transferring=false;
      grasp?.setRadius(pose.gripRadius??.012);
      // Keep the unoccupied hand's natural walking swing when one hand holds
      // the tank rail; older two-hand vehicle climbing still resets both arms.
      if(pose.freeHands&&(!pose.keepFreeHandMotion||!!target||!!grips?.length)){
        for(const bone of [arm.upper,arm.lower,arm.end,...(grasp?.fingers.keys()||[])]){
          if(!this.saved.has(bone))this.saved.set(bone,bone.quaternion.clone());bone.quaternion.copy(this.neutral.get(bone)!);
        }
        arm.upper.updateWorldMatrix(true,true);
      }
      const freeRotation=arm.end.getWorldQuaternion(new T.Quaternion()),freeWrist=pos(arm.end),freePole=pos(arm.lower).sub(pos(arm.upper)).normalize();
      // All rails use the enclosed finger space, never the middle of the palm.
      const handRotation=grips||pose.gripHands?rotation.clone().multiply(arm.rotation):arm.end.getWorldQuaternion(new T.Quaternion());
      const palmOffset=arm.sole.clone().multiply(arm.end.getWorldScale(new T.Vector3())).applyQuaternion(handRotation);
      const railAxis=(point:T.Vector3)=>{
        let nearest=Infinity,axis=up.clone();
        for(const [a,b] of grips||[]){const line=new T.Line3(new T.Vector3(...a),new T.Vector3(...b)),distance=line.closestPointToPoint(point,true,new T.Vector3()).distanceToSquared(point);
          if(distance<nearest&&line.distanceSq()>1e-10){nearest=distance;axis=line.delta(new T.Vector3()).normalize();}}
        if(axis.y<0)axis.negate();return axis;
      };
      if(!target&&grips?.length){
        const shoulder=pos(arm.upper),reach=shoulder.distanceTo(pos(arm.lower))+pos(arm.lower).distanceTo(pos(arm.end));
        const reachable=(p:T.Vector3,axis?:T.Vector3)=>{
          if(!cylinder)return p.distanceTo(shoulder)<reach*.98+palmOffset.length();
          const q=grasp.rotation(p,shoulder,axis||railAxis(p),i,forward),offset=grasp.centre.clone().multiply(arm.end.getWorldScale(new T.Vector3())).applyQuaternion(q);
          return p.clone().sub(offset).distanceTo(shoulder)<reach*.985;
        };
        const desired=pose.gripAim?new T.Vector3(...pose.gripAim[i]):shoulder.clone().addScaledVector(forward,.27*scale).addScaledVector(right,pose.freeHands?(i?1:-1)*.08*scale:0).addScaledVector(up,-.02*scale);
        if(pose.gripGait&&!pose.gripAim)desired.addScaledVector(new T.Vector3(...pose.gripGait.advance),direction);
        let best=Infinity;
        for(const [a,b] of grips){const line=new T.Line3(new T.Vector3(...a),new T.Vector3(...b)),p=line.closestPointToPoint(desired,true,new T.Vector3()),axis=line.delta(new T.Vector3()).normalize();if(axis.y<0)axis.negate();
          // A predicted next handhold can be too far down/up a rail while the
          // rail itself is reachable. Retain contact at the nearest point.
          if(!reachable(p,axis))line.closestPointToPoint(shoulder,true,p);
          const other=i?this.holds[0]:this.holds[1];
          if(pose.freeHands&&other&&p.distanceTo(other)<.09*scale)continue;
          const d=p.distanceTo(desired);if(reachable(p,axis)&&d<best){best=d;target=p.toArray() as V3;}}
        if(!target&&this.holds[i]&&reachable(this.holds[i]!))target=this.holds[i]!.toArray() as V3;
        if(phase!==undefined&&target){
          const t=phase-Math.floor(phase),held=this.holds[i],canHold=held&&reachable(held);
          const transfer=pose.settleGrips||(t<=.2||t>=.8)&&Math.floor(phase)%2===i;
          if(!canHold)this.holds[i]=new T.Vector3(...target);
          else if(transfer)held!.lerp(new T.Vector3(...target),1-Math.exp(-18*dt));
          // A straight interpolation cuts inside a curved handle. Re-project
          // the retained grasp onto this hand's own physical centreline.
          const hold=this.holds[i]!;let nearest=Infinity,projected=hold.clone();
          for(const [a,b] of grips){const point=new T.Line3(new T.Vector3(...a),new T.Vector3(...b)).closestPointToPoint(hold,true,new T.Vector3()),distance=point.distanceToSquared(hold);if(distance<nearest){nearest=distance;projected=point;}}
          hold.copy(projected);target=hold.toArray() as V3;
        }
      }
      // Missing rail targets previously left the climbing animation's arms folded behind the back.
      if(!target&&pose.gripGait&&!pose.disableClimbFallback){
        const shoulder=pos(arm.upper);
        target=shoulder.clone().addScaledVector(forward,.19*scale).addScaledVector(right,(i?1:-1)*.16*scale).addScaledVector(up,-.24*scale).toArray() as V3;
      }
      if(target&&cylinder){
        const old=priorContacts[i],next=new T.Vector3(...target);
        if(!this.transfers[i]&&grips&&old?.gripping&&old.target.distanceTo(next)>.15*scale&&!sameGripRail(old.target,next,grips,scale)){
          this.transfers[i]={from:old.centre.clone(),axis:old.tangent.clone(),phase:phase??0,elapsed:0};
        }
        const transfer=this.transfers[i];
        if(transfer){
          transfer.elapsed+=dt;
          const progress=phase===undefined?transfer.elapsed/.32:Math.abs(phase-transfer.phase)/.4;
          if(progress>=1)this.transfers[i]=undefined;
          else{
            const t=T.MathUtils.smoothstep(progress,0,1),axis=tangent||railAxis(next);
            target=transfer.from.clone().lerp(next,t).addScaledVector(up,.035*scale*Math.sin(Math.PI*t)).toArray() as V3;
            tangent=transfer.axis.clone().lerp(axis,t).normalize();transferWeight=1-Math.sin(Math.PI*t);transferring=true;
          }
        }
      }
      if(target){
        let fitted:ReturnType<typeof fitGrasp>|undefined;
        const preferredPole=pose.elbowPole?new T.Vector3(...pose.elbowPole):up.clone().negate().addScaledVector(right,(i?1:-1)*.12).addScaledVector(forward,-.18).normalize();
        if((grips||pose.gripHands)&&cylinder){
          tangent??=railAxis(new T.Vector3(...target));
          const history=this.graspHistory[i],previous=history?{rotation:rotation.clone().multiply(history.rotation),elbow:history.elbow.clone().multiplyScalar(scale).applyQuaternion(rotation).add(pos(arm.upper))}:undefined;
          fitted=fitGrasp(arm,grasp,new T.Vector3(...target),tangent,i,forward,right,scale,preferredPole,pose.elbowLimits?.[i],!!(pose.elbowLimits||pose.seated),previous,dt);
          handRotation.copy(fitted.rotation);
          palmOffset.copy(grasp.centre).multiply(arm.end.getWorldScale(new T.Vector3())).applyQuaternion(handRotation);
          for(const [bone,q] of grasp.fingers){if(!this.saved.has(bone))this.saved.set(bone,bone.quaternion.clone());bone.quaternion.copy(q);}
        }else if(grips||pose.gripHands){
          const shoulder=pos(arm.upper),delta=new T.Vector3(...target).sub(shoulder),distance=delta.length(),toward=delta.normalize(),length=palmOffset.length();
          const minimum=Math.abs(shoulder.distanceTo(pos(arm.lower))-pos(arm.lower).distanceTo(pos(arm.end)))+.01*scale;
          // Near the shoulder, bend the wrist around the rail rather than
          // putting it inside the arm's unreachable inner radius.
          if(distance-length<minimum&&distance>1e-6){const cosine=T.MathUtils.clamp((distance*distance+length*length-minimum*minimum)/(2*distance*length),-1,1),side=right.clone().addScaledVector(toward,-right.dot(toward));if(side.lengthSq()<1e-8)side.copy(up).addScaledVector(toward,-up.dot(toward));side.normalize();toward.multiplyScalar(cosine).addScaledVector(side,Math.sqrt(1-cosine*cosine));}
          handRotation.premultiply(new T.Quaternion().setFromUnitVectors(palmOffset.clone().normalize(),toward));palmOffset.copy(toward).multiplyScalar(length);
        }
        const wrist=new T.Vector3(...target).sub(palmOffset),aim=cylinder?wrist.clone():pos(arm.end).lerp(wrist,pose.handWeight??1);
        if(pose.freeHands){const weight=pose.handWeight??1,closedRotation=handRotation.clone();aim.copy(freeWrist).lerp(wrist,weight).addScaledVector(up,.10*scale*Math.sin(Math.PI*weight));if(pose.handApproach)aim.addScaledVector(new T.Vector3(...pose.handApproach),Math.sin(Math.PI*weight));handRotation.copy(freeRotation).slerp(closedRotation,weight);}
        const weight=pose.freeHands?(pose.handWeight??1):1;
        if(transferring){
          // The released hand travels between fixtures. Keep that free reach
          // inside arm length as the body continues down to the next tread.
          const shoulder=pos(arm.upper),reach=shoulder.distanceTo(pos(arm.lower))+pos(arm.lower).distanceTo(pos(arm.end));
          if(aim.distanceTo(shoulder)>reach*.985)aim.sub(shoulder).setLength(reach*.985).add(shoulder);
          target=aim.clone().add(palmOffset).toArray() as V3;
        }
        const pole=fitted?(pose.freeHands?freePole:preferredPole).clone().lerp(fitted.pole,weight).normalize():preferredPole;
        const error=solveLimb(arm.upper,arm.lower,arm.end,aim,pole);
        if(pose.freeHands&&weight<1){
          // Reach/release with a straight wrist. Blending two world-space hand
          // rotations while the elbow follows an arc bent the wrist backward
          // halfway through the transfer, even though both endpoints were valid.
          const neutral=arm.lower.getWorldQuaternion(new T.Quaternion()).multiply(this.neutral.get(arm.end)!);
          handRotation.copy(neutral).slerp(fitted?.rotation||handRotation.clone(),T.MathUtils.smoothstep(weight,.65,1));
        }
        // Put pronation/supination in the forearm. Applying the whole world-space
        // grasp rotation to the wrist alone used to turn it almost 180 degrees.
        if(cylinder){
          const rest=arm.lower.getWorldQuaternion(new T.Quaternion()).multiply(this.neutral.get(arm.end)!);
          const delta=handRotation.clone().multiply(rest.invert());
          const axis=pos(arm.end).sub(pos(arm.lower)).normalize(),projection=delta.x*axis.x+delta.y*axis.y+delta.z*axis.z;
          const twist=new T.Quaternion(axis.x*projection,axis.y*projection,axis.z*projection,delta.w).normalize();
          if(twist.w<0)twist.set(-twist.x,-twist.y,-twist.z,-twist.w);
          worldRotation(arm.lower,twist.multiply(arm.lower.getWorldQuaternion(new T.Quaternion())));
        }
        this.errors.push(error);worldRotation(arm.end,handRotation);
        if(fitted){const inverse=rotation.clone().invert();this.graspHistory[i]={rotation:inverse.clone().multiply(handRotation),elbow:pos(arm.lower).sub(pos(arm.upper)).applyQuaternion(inverse).divideScalar(scale)};}
      }
      if(pose.freeHands||transferring){
        const weight=target?T.MathUtils.smoothstep(pose.handWeight??1,.55,1)*transferWeight:0;
        for(const bone of [...(grasp?.fingers.keys()||[])]){
          if(!this.saved.has(bone))this.saved.set(bone,bone.quaternion.clone());
          bone.quaternion.copy(this.neutral.get(bone)!.clone().slerp(bone.quaternion,weight));
        }
      }
      arm.upper.updateWorldMatrix(true,true);
      if(target&&cylinder&&tangent)this.handContacts[i]={target:new T.Vector3(...target),centre:arm.end.localToWorld(grasp.centre.clone()),tangent:tangent.clone(),gripping:!transferring&&(pose.handWeight??1)>.999};
    }
    this.gripPhase=phase;
    this.model.updateWorldMatrix(true,true);
  }
}

export function standingContact(root:T.Object3D):NathanContact{
  return {feet:[root.localToWorld(new T.Vector3(-.12,.005,-.1)).toArray() as V3,root.localToWorld(new T.Vector3(.12,.005,-.1)).toArray() as V3]};
}

