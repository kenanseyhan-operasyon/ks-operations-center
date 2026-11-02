import * as T from 'three';
import type {NathanActor} from '../nathan-model';
import {SkinnedBounds} from '../skinned-bounds';
import type {MixamoMotion} from './mixamo-mocap';

type V3 = [number,number,number];
type Sample = {time:number;hip:T.Vector3;feet:[T.Vector3,T.Vector3];hands:[T.Vector3,T.Vector3]};
type Support = {distance:number;height:number};
export type DescentTerrain='stairs'|'level';
const PREFIX='rp_nathan_animated_003_walking_';
const tuple=(p:T.Vector3):V3=>[p.x,p.y,p.z];
const median=(values:number[])=>{
  const sorted=values.slice().sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
};

export interface MixamoPreviewSnapshot {
  motionId:string;
  label:string;
  elapsed:number;
  duration:number;
  progress:number;
  paused:boolean;
  finished:boolean;
  position:V3;
  cameraTarget:V3;
  feet:[V3,V3];
  gripEnabled:boolean;
  gripActive:boolean;
  gripError:number;
  speed:1|2|4;
  stairCount:number;
  railAvailable:boolean;
  sourceWarning?:string;
  descentTerrain:DescentTerrain;
}

/** A source-motion viewer, deliberately independent of the spiral motor.
 *
 * The FBX's retargeted pelvis translation and every lower-body joint are
 * evaluated directly. Grounding happens once when selecting a recording.
 * The optional rail pass is handsOnly and targets just the right arm;
 * neither NathanActor.update() nor procedural foot IK is called here.
 */
export class MixamoPreview {
  readonly stage=new T.Group();
  active=false;
  private motion?:MixamoMotion;
  private action?:T.AnimationAction;
  private elapsed=0;
  private paused=true;
  private finished=false;
  private speed:1|2|4=1;
  private gripEnabled=false;
  private gripWeight=0;
  private rail?:T.Line3;
  private railSegments:[V3,V3][]=[];
  private stairCount=0;
  private supports:Support[]=[];
  private forward=new T.Vector3(0,0,-1);
  private sourceWarning?:string;
  private descentTerrain:DescentTerrain='stairs';
  private descentSamples:Sample[]=[];
  private descentBaseOffsetY=0;
  private descentElevation=0;
  private saved?:{
    position:T.Vector3;rotation:T.Quaternion;offset:T.Vector3;
    index:number;playing:boolean;controlled:boolean;
    bones:{bone:T.Object3D;position:T.Vector3;rotation:T.Quaternion;scale:T.Vector3}[];
  };

  constructor(private actor:NathanActor,scene:T.Object3D){
    this.stage.name='NATHAN_MIXAMO_CAPTURE_STAGE';
    this.stage.visible=false;
    scene.add(this.stage);
  }

  select(motion:MixamoMotion){
    if(!this.active){
      const bones:{bone:T.Object3D;position:T.Vector3;rotation:T.Quaternion;scale:T.Vector3}[]=[];
      this.actor.model.traverse(bone=>{
        if(bone instanceof T.Bone)bones.push({bone,position:bone.position.clone(),rotation:bone.quaternion.clone(),scale:bone.scale.clone()});
      });
      this.saved={position:this.actor.root.position.clone(),rotation:this.actor.root.quaternion.clone(),
        offset:this.actor.offset.position.clone(),index:this.actor.index,playing:this.actor.playing,
        controlled:this.actor.controlled,bones};
    }
    this.actor.contact();
    this.actor.mixer.stopAllAction();
    this.actor.root.position.set(0,0,0);
    this.actor.root.quaternion.identity();
    this.actor.offset.position.set(0,0,0);
    this.actor.playing=false;
    this.actor.controlled=true;
    this.motion=motion;
    this.sourceWarning=motion.note;
    this.descentSamples=[];this.descentElevation=0;
    this.actor.addExternalMotion(motion.clip);
    this.actor.index=this.actor.clips.findIndex(clip=>clip.name===motion.clip.name);
    this.action=this.actor.actions[this.actor.index];
    this.action.reset().setLoop(T.LoopOnce,1).setEffectiveWeight(1).setEffectiveTimeScale(0).play();
    this.action.clampWhenFinished=true;
    this.active=true;
    this.stage.visible=true;
    this.elapsed=0;
    this.paused=false;
    this.finished=false;
    this.gripWeight=this.gripEnabled?1:0;
    this.evaluate(0);

    // The actor's route root stays at the origin. Only this fixed offset is
    // calibrated; subsequent motion remains entirely in the imported clip.
    const startHip=this.point('hip');
    this.actor.offset.position.x-=startHip.x;
    this.actor.offset.position.z-=startHip.z;
    this.actor.root.updateWorldMatrix(true,true);
    const bounds=new T.Box3();
    this.actor.model.traverse(node=>{
      if(node instanceof T.SkinnedMesh)new SkinnedBounds(node).measure(new T.Box3(),bounds,node.matrixWorld);
      else if(node instanceof T.Mesh)bounds.union(new T.Box3().setFromObject(node,true));
    });
    if(Number.isFinite(bounds.min.y))this.actor.offset.position.y+=.006-bounds.min.y;
    this.actor.root.updateWorldMatrix(true,true);

    const samples:Sample[]=[];
    const frames=Math.max(20,Math.ceil(motion.duration*60));
    for(let frame=0;frame<=frames;frame++){
      const time=motion.duration*frame/frames;
      this.evaluate(time);
      samples.push({time,hip:this.point('hip'),feet:this.feet(),hands:this.hands()});
    }
    // A descending capture may extend below its first supporting tread. Move
    // the complete recording once so the lower landing is above world ground;
    // never alter the captured pelvis or leg channels frame by frame.
    if(motion.kind==='stairs-down'&&!motion.previewOnly){
      const lift=Math.max(0,.025-Math.min(...samples.flatMap(sample=>sample.feet.map(foot=>foot.y))));
      if(lift>0){
        this.actor.offset.position.y+=lift;
        for(const sample of samples){sample.hip.y+=lift;for(const point of [...sample.feet,...sample.hands])point.y+=lift;}
      }
    }
    if(motion.kind==='stairs-down'){
      this.descentTerrain='stairs';
      this.descentSamples=samples;
      this.descentBaseOffsetY=this.actor.offset.position.y;
      this.rebuildDescentTerrain();
    }else{
      this.evaluate(0);
      this.buildStage(samples,motion.kind);
      this.render(0,true);
    }
  }

  setSpeed(speed:1|2|4){this.speed=speed;}
  pause(){if(this.active)this.paused=true;}
  resume(){
    if(!this.active)return;
    if(this.finished)this.replay();
    else this.paused=false;
  }
  replay(){
    if(!this.active)return;
    this.elapsed=0;this.finished=false;this.paused=false;
    this.actor.contactRig?.resetGrips();
    this.render(0,true);
  }
  seek(seconds:number){
    if(!this.active||!this.motion||!Number.isFinite(seconds))return;
    this.elapsed=T.MathUtils.clamp(seconds,0,this.motion.duration);
    this.paused=true;this.finished=this.elapsed>=this.motion.duration;
    this.actor.contactRig?.resetGrips();
    this.render(0,true);
  }
  setRailGrip(enabled:boolean){
    this.gripEnabled=enabled&&!!this.rail&&!this.motion?.previewOnly&&this.motion?.kind!=='driving';
    if(this.active){
      this.actor.contactRig?.resetGrips();
      // A paused A/B comparison must change only the arm, at the same time.
      this.render(0,true);
    }
  }
  /** Geometry comparison only: the source timeline, bone rotations and
   * relative hip translation stay identical in both views. */
  setDescentTerrain(terrain:DescentTerrain){
    if(terrain!=='stairs'&&terrain!=='level')return;
    if(!this.active||this.motion?.kind!=='stairs-down'||terrain===this.descentTerrain)return;
    this.descentTerrain=terrain;
    this.rebuildDescentTerrain();
  }
  tick(dt:number){
    if(!this.active||!this.motion)return;
    if(!this.paused&&!this.finished){
      this.elapsed=Math.min(this.motion.duration,this.elapsed+T.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.1)*this.speed);
      if(this.elapsed>=this.motion.duration){this.finished=true;this.paused=true;}
      this.render(dt);
    }
  }

  deactivate(){
    if(!this.active)return;
    this.actor.contact();
    this.actor.mixer.stopAllAction();
    if(this.saved){
      this.actor.root.position.copy(this.saved.position);
      this.actor.root.quaternion.copy(this.saved.rotation);
      this.actor.offset.position.copy(this.saved.offset);
      for(const state of this.saved.bones){state.bone.position.copy(state.position);state.bone.quaternion.copy(state.rotation);state.bone.scale.copy(state.scale);}
      this.actor.index=this.saved.index;
      this.actor.playing=this.saved.playing;
      this.actor.controlled=this.saved.controlled;
      this.saved=undefined;
    }
    this.actor.root.updateWorldMatrix(true,true);
    this.active=false;this.stage.visible=false;this.action=undefined;
  }

  snapshot():MixamoPreviewSnapshot {
    const hip=this.point('hip'),neck=this.point('neck');
    const floor=this.supportHeight(hip);
    const contact=this.actor.contactRig?.handContacts[1];
    return {motionId:this.motion?.id||'',label:this.motion?.label||'',elapsed:this.elapsed,
      duration:this.motion?.duration||0,progress:this.motion?this.elapsed/this.motion.duration:0,
      paused:this.paused,finished:this.finished,position:[hip.x,floor,hip.z],
      cameraTarget:tuple(hip.clone().lerp(neck,.35)),feet:this.feet().map(tuple) as [V3,V3],
      gripEnabled:this.gripEnabled,gripActive:!!contact&&this.gripWeight>.99,
      gripError:contact?contact.target.distanceTo(contact.centre):0,speed:this.speed,stairCount:this.stairCount,
      railAvailable:!!this.rail&&!this.motion?.previewOnly&&this.motion?.kind!=='driving',sourceWarning:this.sourceWarning,
      descentTerrain:this.descentTerrain};
  }

  private point(suffix:string){
    return this.actor.model.getObjectByName(PREFIX+suffix)?.getWorldPosition(new T.Vector3())||this.actor.root.position.clone();
  }
  private feet():[T.Vector3,T.Vector3]{
    const rig=this.actor.contactRig;
    return rig?[rig.sole(0),rig.sole(1)]:[this.point('foot_l'),this.point('foot_r')];
  }
  private hands():[T.Vector3,T.Vector3]{
    const rig=this.actor.contactRig;
    return rig?rig.arms.map(arm=>arm.end.localToWorld(arm.sole.clone())) as [T.Vector3,T.Vector3]:
      [this.point('hand_l'),this.point('hand_r')];
  }
  private evaluate(time:number){
    if(!this.action)return;
    this.actor.contactRig?.restore();
    this.action.enabled=true;this.action.paused=false;this.action.time=time;
    this.action.setEffectiveTimeScale(0);
    this.actor.mixer.update(0);
    this.actor.root.updateWorldMatrix(true,true);
  }
  private render(dt:number,immediate=false){
    this.evaluate(this.elapsed);
    const rig=this.actor.contactRig;
    const targetWeight=this.gripEnabled?1:0;
    this.gripWeight=immediate?targetWeight:T.MathUtils.lerp(this.gripWeight,targetWeight,1-Math.exp(-12*Math.max(0,dt)));
    if(!rig||!this.rail||this.gripWeight<.0001){rig?.resetGrips();return;}
    const shoulder=rig.arms[1].upper.getWorldPosition(new T.Vector3());
    const aim=shoulder.clone().addScaledVector(this.forward,.10).add(new T.Vector3(0,-.34,0));
    const grip=this.rail.closestPointToPoint(aim,true,new T.Vector3());
    const tangent=this.rail.delta(new T.Vector3()).normalize();
    const feet=this.feet().map(tuple) as [V3,V3];
    rig.apply({handsOnly:true,feet,hands:[undefined,tuple(grip)],
      grips:this.railSegments,handGrips:[[],this.railSegments],
      handTangents:[tuple(tangent),tuple(tangent)],gripAim:[tuple(grip),tuple(grip)],
      handWeight:this.gripWeight,freeHands:true,keepFreeHandMotion:true,
      blendFromAnimatedHand:true,gripHands:true,procedural:false,
      disableClimbFallback:true,gripRadius:.031,elbowPole:[0,-1,0]},Math.max(1/60,dt));
  }

  private supportHeight(point:T.Vector3){
    const distance=point.dot(this.forward);
    let height=0;
    for(const support of this.supports)if(distance>=support.distance)height=support.height;
    return height;
  }

  private rebuildDescentTerrain(){
    if(!this.descentSamples.length)return;
    const first=this.descentSamples[0],last=this.descentSamples.at(-1)!;
    // A single scene placement change lifts the complete unmodified clip to
    // the upper platform. There is no second root-motion path, vertical
    // animation correction, or attempt to straighten the recorded knees.
    this.descentElevation=this.descentTerrain==='stairs'?Math.max(.20,first.hip.y-last.hip.y):0;
    this.actor.offset.position.y=this.descentBaseOffsetY+this.descentElevation;
    const shifted=(point:T.Vector3)=>point.clone().add(new T.Vector3(0,this.descentElevation,0));
    const samples=this.descentSamples.map(sample=>({time:sample.time,hip:shifted(sample.hip),
      feet:sample.feet.map(shifted) as [T.Vector3,T.Vector3],hands:sample.hands.map(shifted) as [T.Vector3,T.Vector3]}));
    this.evaluate(0);
    this.buildStage(samples,'stairs-down');
    this.render(0,true);
  }

  private buildStage(samples:Sample[],kind:MixamoMotion['kind']){
    for(const object of this.stage.children.slice()){
      object.traverse(child=>{
        if(child instanceof T.Mesh||child instanceof T.Line){
          child.geometry.dispose();
          const materials=Array.isArray(child.material)?child.material:[child.material];
          for(const material of materials)material.dispose();
        }
      });
      this.stage.remove(object);
    }
    this.rail=undefined;this.railSegments=[];
    const stairs=kind==='stairs';
    const first=samples[0],last=samples.at(-1)!;
    this.forward.copy(last.hip).sub(first.hip).setY(0);
    if(this.forward.length()<.04)this.forward.set(0,0,-1);else this.forward.normalize();
    const sideways=new T.Vector3(-this.forward.z,0,this.forward.x);
    const allFeet=samples.flatMap(sample=>sample.feet);
    const distances=allFeet.map(point=>point.dot(this.forward));
    const low=Math.min(...distances)-.50,high=Math.max(...distances)+.60;
    const base=new T.Mesh(new T.BoxGeometry(1.50,.08,high-low),new T.MeshStandardMaterial({color:'#38565f',roughness:.88,metalness:.08}));
    base.position.copy(this.forward).multiplyScalar((low+high)/2);base.position.y=-.045;
    base.rotation.y=Math.atan2(this.forward.x,this.forward.z);
    this.stage.add(base);
    this.supports=[{distance:low,height:0}];
    this.stairCount=0;

    if(kind==='driving'){
      this.gripEnabled=false;this.gripWeight=0;
      this.buildDrivingStation(samples);
      return;
    }
    if(kind==='stairs-down'){
      // This supplied recording lowers the hips while its toes remain on a
      // single plane. The requested raised-step scene is a comparison, not
      // validation: no rail or foot constraint conceals the source motion.
      this.gripEnabled=false;this.gripWeight=0;
      if(this.descentTerrain==='stairs')this.buildDescendingSteps(samples,low,high);
      return;
    }

    if(stairs){
      // Find near-stationary source foot contacts. Geometry is fitted to the
      // recording; no foot, knee or pelvis is fitted to synthetic geometry.
      const candidates:{distance:number;height:number;speed:number}[]=[];
      for(let side=0;side<2;side++){
        const choices=[];
        for(let i=1;i<samples.length-1;i++){
          const point=samples[i].feet[side],delta=samples[i+1].feet[side].clone().sub(samples[i-1].feet[side]);
          const interval=samples[i+1].time-samples[i-1].time;
          choices.push({distance:point.dot(this.forward),height:point.y,speed:delta.length()/interval,vertical:Math.abs(delta.y)/interval});
        }
        const threshold=choices.map(c=>c.speed).sort((a,b)=>a-b)[Math.floor(choices.length*.38)]||.3;
        candidates.push(...choices.filter(c=>c.speed<=Math.max(.16,threshold)&&c.vertical<.32));
      }
      candidates.sort((a,b)=>a.height-b.height);
      const clusters:typeof candidates[]=[];
      for(const candidate of candidates){
        const group=clusters.at(-1);
        if(group&&Math.abs(candidate.height-median(group.map(c=>c.height)))<.09)group.push(candidate);
        else clusters.push([candidate]);
      }
      const contacts=clusters.filter(c=>c.length>=3).map(group=>({
        height:median(group.map(c=>c.height))-.006,
        distance:median(group.map(c=>c.distance))
      })).filter(c=>c.height>.07).sort((a,b)=>a.height-b.height);
      // Preserve only ascending support levels. A swing-foot pause at its
      // apex is not an extra tread and is rejected by distance ordering.
      let previousDistance=Math.min(...first.feet.map(p=>p.dot(this.forward)));
      for(const contact of contacts){
        if(contact.distance<previousDistance+.06)continue;
        const edge=(previousDistance+contact.distance)/2;
        this.supports.push({distance:edge,height:contact.height});
        previousDistance=contact.distance;
      }
      this.stairCount=this.supports.length-1;
      // The recordings end as the next swing begins. Continue the measured
      // staircase a little beyond the captured landings so that the last
      // frame does not face a wall or an implausibly long top tread.
      if(this.supports.length>=3){
        const a=this.supports.at(-2)!,b=this.supports.at(-1)!;
        const run=b.distance-a.distance,rise=b.height-a.height;
        if(run>.12&&rise>.10)while(this.supports.at(-1)!.distance+run<high-.08){
          const lastSupport=this.supports.at(-1)!;
          this.supports.push({distance:lastSupport.distance+run,height:lastSupport.height+rise});
        }
      }
      for(let i=1;i<this.supports.length;i++){
        const support=this.supports[i],end=this.supports[i+1]?.distance??high;
        const depth=Math.max(.12,end-support.distance),height=support.height;
        const tread=new T.Mesh(new T.BoxGeometry(1.10,height,depth),new T.MeshStandardMaterial({color:i%2?'#bcced4':'#d4c18a',roughness:.65,metalness:.25}));
        tread.position.copy(this.forward).multiplyScalar(support.distance+depth/2);tread.position.y=height/2;
        tread.rotation.y=Math.atan2(this.forward.x,this.forward.z);this.stage.add(tread);
      }
    }

    const rise=stairs?Math.max(0,last.hip.y-first.hip.y):0;
    const travel=last.hip.clone().sub(first.hip).dot(this.forward);
    const slope=stairs&&travel>.05?rise/travel:0;
    const hipStart=first.hip.dot(this.forward);
    const railPoint=(distance:number)=>this.forward.clone().multiplyScalar(distance)
      .addScaledVector(sideways,.45).setY(1.02+(distance-hipStart)*slope);
    const railStart=railPoint(low+.10),railEnd=railPoint(high-.10);
    this.rail=new T.Line3(railStart,railEnd);
    this.railSegments=[[tuple(railStart),tuple(railEnd)]];
    const tube=new T.Mesh(new T.CylinderGeometry(.031,.031,railStart.distanceTo(railEnd),14),new T.MeshStandardMaterial({color:'#ecd166',roughness:.45,metalness:.4}));
    tube.position.copy(railStart).lerp(railEnd,.5);
    tube.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),railEnd.clone().sub(railStart).normalize());
    this.stage.add(tube);
    for(const point of [railStart,railEnd]){
      const floor=this.supportHeight(point),height=point.y-floor;
      const post=new T.Mesh(new T.CylinderGeometry(.022,.022,height,10),new T.MeshStandardMaterial({color:'#b8a35c',roughness:.5,metalness:.3}));
      post.position.copy(point);post.position.y=floor+height/2;this.stage.add(post);
    }
  }

  private buildDescendingSteps(samples:Sample[],low:number,high:number){
    const first=samples[0],last=samples.at(-1)!;
    const travel=Math.max(.32,last.hip.clone().sub(first.hip).dot(this.forward));
    const run=travel/2;
    const firstFoot=Math.min(...first.feet.map(foot=>foot.dot(this.forward)));
    const upperEdge=firstFoot+run/2,lowerEdge=upperEdge+run;
    const lowerHeight=.006;
    this.supports=[{distance:low,height:this.descentElevation},
      {distance:upperEdge,height:(this.descentElevation+lowerHeight)/2},
      {distance:lowerEdge,height:lowerHeight}];
    this.stairCount=2;
    for(let i=0;i<this.supports.length;i++){
      const support=this.supports[i],end=this.supports[i+1]?.distance??high;
      const depth=Math.max(.12,end-support.distance),thickness=Math.max(.08,support.height);
      const material=new T.MeshStandardMaterial({color:i===0?'#d4c18a':i===1?'#bcced4':'#75929d',roughness:.7,metalness:.18});
      const tread=new T.Mesh(new T.BoxGeometry(1.10,thickness,depth),material);
      tread.name=i===0?'MIXAMO_DESCENT_UPPER_LANDING':i===1?'MIXAMO_DESCENT_STEP':'MIXAMO_DESCENT_LOWER_LANDING';
      tread.position.copy(this.forward).multiplyScalar(support.distance+depth/2);
      tread.position.y=support.height-thickness/2;
      tread.rotation.y=Math.atan2(this.forward.x,this.forward.z);
      this.stage.add(tread);
    }
  }

  private buildDrivingStation(samples:Sample[]){
    const first=samples[0],hip=first.hip;
    const sideways=new T.Vector3(-this.forward.z,0,this.forward.x);
    const yaw=Math.atan2(this.forward.x,this.forward.z);
    const cushion=new T.MeshStandardMaterial({color:'#293b43',roughness:.94});
    const frame=new T.MeshStandardMaterial({color:'#71838a',metalness:.62,roughness:.45});
    const rubber=new T.MeshStandardMaterial({color:'#131f24',roughness:.85});
    const seatTop=(this.point('upperleg_l').y+this.point('upperleg_r').y)/2-.085;
    const box=(name:string,width:number,height:number,depth:number,position:T.Vector3,material:T.Material)=>{
      const mesh=new T.Mesh(new T.BoxGeometry(width,height,depth),material);
      mesh.name=name;mesh.position.copy(position);mesh.rotation.y=yaw;this.stage.add(mesh);return mesh;
    };
    const cylinder=(name:string,a:T.Vector3,b:T.Vector3,radius:number,material:T.Material)=>{
      const delta=b.clone().sub(a);
      const mesh=new T.Mesh(new T.CylinderGeometry(radius,radius,delta.length(),14),material);
      mesh.name=name;mesh.position.copy(a).lerp(b,.5);
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
      this.stage.add(mesh);return mesh;
    };

    // Props follow the captured seated posture. The animation is not fitted
    // to a seat, wheel, pedals, or the facility's driving controller.
    const seatCentre=hip.clone().addScaledVector(this.forward,.08).setY(seatTop-.035);
    box('MIXAMO_DRIVER_SEAT',.53,.07,.48,seatCentre,cushion);
    const backCentre=hip.clone().addScaledVector(this.forward,-.20).setY(seatTop+.30);
    const back=box('MIXAMO_DRIVER_BACKREST',.53,.60,.075,backCentre,cushion);
    const torso=this.point('neck').sub(hip).normalize();
    const lean=-Math.atan2(torso.dot(this.forward),torso.y);
    back.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(sideways,lean));
    cylinder('MIXAMO_DRIVER_SEAT_PEDESTAL',seatCentre.clone().setY(.02),seatCentre.clone().setY(seatTop-.07),.085,frame);
    box('MIXAMO_DRIVER_SEAT_BASE',.48,.035,.40,seatCentre.clone().setY(.0175),frame);

    const palms=samples.map(sample=>sample.hands[0].clone().add(sample.hands[1]).multiplyScalar(.5));
    const middle=palms.reduce((sum,point)=>sum.add(point),new T.Vector3()).divideScalar(palms.length);
    const handSpan=median(samples.map(sample=>sample.hands[0].distanceTo(sample.hands[1])));
    const radius=T.MathUtils.clamp(handSpan*.60,.19,.25);
    const normal=this.forward.clone().negate().add(new T.Vector3(0,.35,0)).normalize();
    const wheelUp=new T.Vector3(0,1,0).addScaledVector(normal,-normal.y).normalize();
    const upperOffset=Math.sqrt(Math.max(.003,radius*radius-handSpan*handSpan/4));
    const centre=middle.clone().addScaledVector(wheelUp,-upperOffset);
    const wheel=new T.Mesh(new T.TorusGeometry(radius,.018,10,48),rubber);
    wheel.name='MIXAMO_DRIVER_STEERING_WHEEL';wheel.position.copy(centre);
    wheel.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);this.stage.add(wheel);
    const hub=new T.Mesh(new T.CylinderGeometry(.055,.055,.045,20),rubber);
    hub.name='MIXAMO_DRIVER_STEERING_HUB';hub.position.copy(centre);
    hub.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),normal);this.stage.add(hub);
    for(const direction of [sideways.clone(),sideways.clone().negate(),wheelUp.clone().negate()])
      cylinder('MIXAMO_DRIVER_WHEEL_SPOKE',centre,centre.clone().addScaledVector(direction,radius-.015),.012,frame);
    const columnEnd=centre.clone().addScaledVector(this.forward,.38).add(new T.Vector3(0,-.30,0));
    cylinder('MIXAMO_DRIVER_STEERING_COLUMN',centre,columnEnd,.033,frame);
    cylinder('MIXAMO_DRIVER_COLUMN_SUPPORT',columnEnd.clone().setY(.025),columnEnd,.04,frame);

    // The right foot in this capture is raised over the accelerator position.
    // A small fixed pedal makes that original pose understandable without IK.
    const pedalCentre=first.feet[1].clone();pedalCentre.y=Math.max(.035,pedalCentre.y-.018);
    box('MIXAMO_DRIVER_PEDAL',.13,.025,.20,pedalCentre,rubber);
  }
}
