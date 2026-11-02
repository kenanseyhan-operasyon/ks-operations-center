import * as T from 'three';
import type {Entity} from '../scene-data';
import type {NathanContact} from '../nathan-contact';
import {tankStairLayout} from '../tank-stairs';
import {localToWorld,worldToLocal} from '../facility-data';
import {outsideRailHand,stairStepPhase} from '../nathan-motion-contract';

export type V3=[number,number,number];
export type LabActivity='ready'|'approach'|'align'|'spiral-up'|'spiral-down'|'roof'|'ground';
export type LabSpeed=1|2|4;
export type MotorPose={position:V3;heading:number;activity:LabActivity;progress:number;
  motion:'Idle'|'Nathan_Original_Walk';motionRate:number;contact?:NathanContact;
  plantedFoot:0|1|undefined;outsideHand:0|1|undefined;speed:LabSpeed;message:string;paused:boolean};
const toArray=(a:T.Vector3):V3=>[a.x,a.y,a.z];
const v=(a:readonly number[])=>new T.Vector3(a[0],a[1],a[2]);
const lerp=(a:V3,b:V3,t:number):V3=>toArray(v(a).lerp(v(b),t));
const smooth=(t:number)=>{const x=T.MathUtils.clamp(t,0,1);return x*x*(3-2*x);};
type MotorContact={pose:NathanContact;plantedFoot:0|1|undefined;outsideHand:0|1|undefined};

/** A single, immutable path for visual treads, root motion, and foot targets. */
export class StairArc {
  readonly layout:ReturnType<typeof tankStairLayout>;
  readonly points:V3[];
  readonly lengths:number[]=[0];
  readonly total:number;
  readonly railSegments:[V3,V3][];
  constructor(readonly tank:Entity){
    this.layout=tankStairLayout(tank);
    // One approach point on the actual ground, followed by the source-of-truth
    // staircase positions. No invisible teleport between first/last treads.
    const entry=v(localToWorld(tank,this.layout.entry));
    const first=v(localToWorld(tank,this.layout.path[1]));
    const toEntry=entry.clone().sub(first).setY(0).normalize();
    const approach=entry.clone().addScaledVector(toEntry,1.3*tank.scale);
    approach.y=tank.position[1];
    this.points=[toArray(approach),...this.layout.path.map(p=>localToWorld(tank,p))];
    for(let i=1;i<this.points.length;i++){
      const segment=v(this.points[i]).distanceTo(v(this.points[i-1]));
      this.lengths.push(this.lengths[i-1]+segment);
    }
    this.total=this.lengths.at(-1)!;
    // Match the continuous tube rendered by main.ts. Give the grasp solver a
    // stable connected rail, not a short moving fragment that loses its lock
    // whenever the nearest StairPiece changes.
    const controls:T.Vector3[]=[],outer=this.layout.radius+this.layout.width/2+.025;
    for(const piece of this.layout.pieces){
      const n=Math.max(2,Math.ceil(Math.abs(piece.b-piece.a)*this.layout.radius/.22));
      for(let j=0;j<=n;j++){
        const u=j/n,a=T.MathUtils.lerp(piece.a,piece.b,u),y=T.MathUtils.lerp(piece.y0,piece.y1,u)+1.08;
        const point=v(localToWorld(tank,[Math.sin(a)*outer,y,Math.cos(a)*outer]));
        // Adjacent pieces repeat their shared endpoint. A zero-length knot
        // makes centripetal Catmull-Rom briefly backtrack at flat landings.
        if(!controls.length||controls.at(-1)!.distanceToSquared(point)>=1e-12)controls.push(point);
      }
    }
    const curve=new T.CatmullRomCurve3(controls,false,'centripetal');
    curve.arcLengthDivisions=Math.max(200,controls.length*8);
    // TubeGeometry samples getPointAt(i / tubularSegments); use its exact
    // segment count so fingers enclose the rendered tube, not a nearby chord.
    const samples=curve.getSpacedPoints(controls.length*2);
    this.railSegments=samples.slice(1).map((p,i)=>[toArray(samples[i]),toArray(p)]);
  }
  at(metres:number):V3{
    const d=T.MathUtils.clamp(metres,0,this.total);
    let left=0,right=this.lengths.length-1;
    while(left<right){const m=(left+right)>>1;if(this.lengths[m]<d)left=m+1;else right=m;}
    const i=Math.max(1,left),a=this.lengths[i-1],b=this.lengths[i];
    return lerp(this.points[i-1],this.points[i],b-a>1e-8?(d-a)/(b-a):1);
  }
  headingAt(metres:number,direction:1|-1):number{
    const here=v(this.at(metres)),ahead=v(this.at(metres+direction*.15));
    if(ahead.distanceToSquared(here)<1e-8)ahead.copy(here).sub(v(this.at(metres-direction*.15)));
    else ahead.sub(here);
    return Math.atan2(ahead.x,-ahead.z)*180/Math.PI;
  }
  /** Top faces of the actual lab meshes, not the sloping interpolation path.
   * Multiple flights share the same X/Z after a complete turn, so only the
   * nearby storey can support this foot. At an overlap, use the upper face.
   */
  treadAt(world:V3):number{
    const p=worldToLocal(this.tank,world),surfaces:number[]=[];
    const rectangle=(x:number,z:number,width:number,depth:number,yaw:number,top:number)=>{
      if(Math.abs(top-p[1])>.48)return;
      const dx=p[0]-x,dz=p[2]-z,c=Math.cos(yaw),s=Math.sin(yaw);
      const localX=c*dx-s*dz,localZ=s*dx+c*dz;
      if(Math.abs(localX)<=width/2+1e-7&&Math.abs(localZ)<=depth/2+1e-7)surfaces.push(top);
    };
    for(const piece of this.layout.pieces){
      if(piece.roofLanding)continue;
      const a=(piece.a+piece.b)/2;
      rectangle(Math.sin(a)*this.layout.radius,Math.cos(a)*this.layout.radius,
        this.layout.width,Math.max(.13,Math.abs(piece.b-piece.a)*this.layout.radius+.04),a+Math.PI/2,piece.y1);
    }
    const entry=this.layout.entry,first=this.layout.path[1];
    rectangle((entry[0]+first[0])/2,(entry[2]+first[2])/2,this.layout.width,
      v(entry).distanceTo(v(first))+.08,Math.atan2(first[0]-entry[0],first[2]-entry[2]),entry[1]);
    const landing=this.layout.roofLanding,r=(landing.inner+landing.outer)/2;
    rectangle(Math.sin(landing.angle)*r,Math.cos(landing.angle)*r,landing.outer-landing.inner,
      landing.depth,landing.angle+Math.PI/2,landing.height);
    if(Math.hypot(p[0],p[2])<=this.tank.radius-.08&&Math.abs(p[1]-this.layout.height)<.48)
      surfaces.push(this.layout.height);
    // Ground is a real support only near ground level, never a substitute for
    // a missing elevated tread. Keep the route height for unsupported queries.
    if(!surfaces.length&&Math.abs(p[1])<.30)surfaces.push(0);
    const y=surfaces.length?Math.max(...surfaces):p[1];
    return localToWorld(this.tank,[0,y,0])[1];
  }
  outsideRailAt(metres:number):[V3,V3]|undefined{
    const root=this.at(metres),p=worldToLocal(this.tank,root),angle=Math.atan2(p[0],p[2]);
    const radius=this.layout.radius+this.layout.width/2+.025;
    const aim=v(localToWorld(this.tank,[Math.sin(angle)*radius,p[1]+1.08,Math.cos(angle)*radius]));
    let best=Infinity,point:T.Vector3|undefined,tangent:T.Vector3|undefined;
    for(const [a,b] of this.railSegments){
      const line=new T.Line3(v(a),v(b)),candidate=line.closestPointToPoint(aim,true,new T.Vector3()),score=candidate.distanceToSquared(aim);
      if(score<best){best=score;point=candidate;tangent=line.delta(new T.Vector3()).normalize();}
    }
    if(!point||!tangent||best>(.65*this.tank.scale)**2)return;
    return [toArray(point.clone().addScaledVector(tangent,-.01*this.tank.scale)),toArray(point.clone().addScaledVector(tangent,.01*this.tank.scale))];
  }
}

/** Deliberately independent of NathanController, Workspace and UI selection. */
export class Nathan2Motor {
  readonly stairs:StairArc;
  readonly initial:V3;
  position:V3;
  heading=0;
  distance=0;
  activity:LabActivity='ready';
  speed:LabSpeed=1;
  // Clip period is calibrated from the real imported Nathan_Original_Walk clip.
  // One full animation cycle must match two alternating 0.34 m footfalls.
  private walkCycleSeconds=.9;
  private desired:1|-1=1;
  private status='Hazır. NORMAL yürüyüş; koşma kullanılmaz.';
  private paused=false;
  private lastPose?:MotorPose;
  private feetTransition?:{from:[V3,V3];elapsed:number};
  constructor(readonly tank:Entity){
    this.stairs=new StairArc(tank);
    this.initial=[...this.stairs.at(0)];this.position=[...this.initial];
    this.heading=this.stairs.headingAt(0,1);
  }
  setSpeed(n:LabSpeed){this.speed=n;}
  setWalkCycleSeconds(seconds:number){if(Number.isFinite(seconds)&&seconds>.3&&seconds<3)this.walkCycleSeconds=seconds;}
  reset(){this.paused=false;this.lastPose=undefined;this.feetTransition=undefined;this.distance=0;this.position=[...this.initial];this.activity='ready';this.heading=this.stairs.headingAt(0,1);this.status='Başlangıçta.';}
  up(){
    if(this.distance>=this.stairs.total-.05){this.status='Nathan zaten tank çatısında.';return;}
    this.paused=false;
    this.desired=1;this.activity='align';this.status='Merdivene normal yürüyüşle hizalanıyor.';
  }
  down(){
    if(this.distance<=.05){this.status='Önce merdivenden yukarı çıkmalı.';return;}
    this.paused=false;
    this.desired=-1;this.activity='align';this.status='Aşağı gidiş yönüne dönüyor; dış korkuluk eli değişebilir.';
  }
  stop(){this.paused=true;this.activity='ready';this.status='Duraklatıldı. El, ayak ve gövde pozu korunuyor.';}
  private turn(target:number,dt:number):number{
    let error=(target-this.heading+540)%360-180;
    this.heading+=(Math.sign(error)*Math.min(Math.abs(error),150*dt));
    return Math.abs(error);
  }
  tick(dt:number):MotorPose{
    // The renderer must also pause its mixer/IK updates. Retain the last
    // contact targets so a pause cannot release the rail or re-ground feet.
    if(this.paused&&this.lastPose)return {...this.lastPose,activity:'ready',paused:true,speed:this.speed,message:this.status};
    const frame=T.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.05)*this.speed;
    if(this.activity==='align'){
      const h=this.stairs.headingAt(this.distance,this.desired);
      if(this.turn(h,frame)<3){this.activity=this.desired===1?'spiral-up':'spiral-down';this.status=this.desired===1?'Normal yürüyerek çıkıyor.':'Normal yürüyerek iniyor.';}
    }
    if(this.activity==='spiral-up'||this.activity==='spiral-down'){
      const direction=this.activity==='spiral-up'?1:-1;
      const targetHeading=this.stairs.headingAt(this.distance,direction);
      const error=this.turn(targetHeading,frame);
      if(error<27){
        // Ease-in/out only near the actual ground/roof thresholds, never jump.
        const endpoint=direction===1?this.stairs.total-this.distance:this.distance;
        const ease=.5+.5*smooth(Math.min(1,endpoint/.55));
        this.distance=T.MathUtils.clamp(this.distance+direction*.49*frame*ease,0,this.stairs.total);
        if(this.distance>=this.stairs.total){this.activity='roof';this.status='Tank çatısına yürüyerek ulaştı.';}
        if(this.distance<=0){this.activity='ground';this.status='Zemine yürüyerek indi, ışınlanma yok.';}
      }
    }
    this.position=[...this.stairs.at(this.distance)];
    const moving=this.activity==='spiral-up'||this.activity==='spiral-down';
    const direction:1|-1=this.activity==='spiral-down'?-1:1;
    const contact=moving?this.stairContacts(direction):this.standingContacts();
    if(this.lastPose&&this.lastPose.activity!==this.activity&&this.lastPose.contact){
      this.feetTransition={from:this.lastPose.contact.feet.map(p=>[...p]) as [V3,V3],elapsed:0};
    }
    if(this.feetTransition){
      this.feetTransition.elapsed+=frame;
      const alpha=smooth(this.feetTransition.elapsed/.35);
      contact.pose.feet=contact.pose.feet.map((p,i)=>lerp(this.feetTransition!.from[i],p,alpha)) as [V3,V3];
      if(alpha<1)contact.plantedFoot=undefined;else this.feetTransition=undefined;
    }
    const inTurn=this.activity==='align';
    const pose:MotorPose={position:[...this.position],heading:this.heading,activity:this.activity,
      progress:this.distance/this.stairs.total,motion:moving&&!inTurn?'Nathan_Original_Walk':'Idle',
      // Source clip cadence is tied to the actual length of one left-right
      // step pair. A hardcoded source speed (previously 1.15 m/s) made the
      // clip lag the route by ~50% and forced feet to jump via IK.
      motionRate:.49*this.walkCycleSeconds/(2*.34*this.tank.scale),contact:contact?.pose,plantedFoot:contact?.plantedFoot,
      outsideHand:contact?.outsideHand,speed:this.speed,message:this.status,paused:this.paused};
    this.lastPose=pose;
    return pose;
  }
  private standingContacts():MotorContact{
    const a=this.heading*Math.PI/180,right=[Math.cos(a),Math.sin(a)];
    const feet=([-1,1] as const).map(side=>{
      const p:V3=[this.position[0]+side*.11*right[0]*this.tank.scale,this.position[1],this.position[2]+side*.11*right[1]*this.tank.scale];
      p[1]=this.stairs.treadAt(p)+.007*this.tank.scale;return p;
    }) as [V3,V3];
    return {pose:{feet,handWeight:0,freeHands:true,keepFreeHandMotion:true,blendFromAnimatedHand:true,procedural:false,disableClimbFallback:true,hipHeight:.89,gripRadius:.031},plantedFoot:undefined,outsideHand:undefined};
  }
  private stairContacts(direction:1|-1):MotorContact{
    const rail=this.stairs.outsideRailAt(this.distance);
    const length=this.stairs.total;
    const stride=.34*this.tank.scale;
    const {index,phase,stanceLeg,swingLeg}=stairStepPhase(this.distance/length,length,stride,direction===-1);
    const at=(d:number)=>this.stairs.at(direction===1?d:length-d);
    const shoe=(d:number,side:0|1):V3=>{
      const p=at(T.MathUtils.clamp(d,0,length));
      const h=this.stairs.headingAt(direction===1?d:length-d,direction);
      const a=h*Math.PI/180,right=[Math.cos(a),Math.sin(a)];
      const s=side===0?-1:1;
      const target:V3=[p[0]+s*.11*right[0]*this.tank.scale,p[1],p[2]+s*.11*right[1]*this.tank.scale];
      target[1]=this.stairs.treadAt(target)+.007*this.tank.scale;
      return target;
    };
    const planted=shoe(index*stride,stanceLeg);
    const origin=shoe((index-1)*stride,swingLeg),dest=shoe((index+1)*stride,swingLeg);
    // Lift before crossing the riser, translate while clear, then lower onto
    // the destination. A sinusoid mixed with a height ramp crossed some upper
    // treads while the shoe was still up to 14 cm below their top surface.
    const travel=smooth((phase-.22)/.56),moving=lerp(origin,dest,travel);
    const apex=Math.max(origin[1],dest[1])+.055*this.tank.scale;
    moving[1]=phase<.22?T.MathUtils.lerp(origin[1],apex,smooth(phase/.22)):
      phase>.78?T.MathUtils.lerp(apex,dest[1],smooth((phase-.78)/.22)):apex;
    const feet:[V3,V3]=[[...planted],[...planted]];feet[stanceLeg]=planted;feet[swingLeg]=moving;
    const outer=outsideRailHand(this.tank.position,this.position,this.heading);
    const midpoint=rail?lerp(rail[0],rail[1],.5):undefined;
    const tangent=rail?toArray(v(rail[1]).sub(v(rail[0])).normalize()):undefined;
    const entry=this.stairs.lengths[2],exit=length-v(this.stairs.points.at(-1)!).distanceTo(v(this.stairs.points.at(-2)!));
    const horizontal=midpoint?Math.hypot(midpoint[0]-this.position[0],midpoint[2]-this.position[2]):Infinity;
    // Finish release before the route pivots inward onto the roof landing.
    const fade=midpoint?Math.min(smooth((this.distance-entry+.25)/.45),smooth((exit-.25-this.distance)/.5),smooth((.74*this.tank.scale-horizontal)/(.16*this.tank.scale))):0;
    const grips=midpoint&&fade>0?this.stairs.railSegments:[];
    const pose:NathanContact={feet,grips,handGrips:outer===0?[grips,[]]:[[],grips],
      ...(midpoint?{gripAim:[midpoint,midpoint] as [V3,V3]}:{}),
      // Preserve curve order over landings. Choosing the sign from tangent.y
      // flips the hand 180 degrees when Catmull-Rom has a tiny negative slope.
      ...(tangent?{handTangents:[tangent,tangent] as [V3,V3]}:{}),handWeight:fade,
      // Preserve the actual walk clip's animated hips, knees, torso and free arm.
      // The original procedural=true reset all those bones to bind pose every
      // frame, reducing visible walking to robotic two-bone target chasing.
      freeHands:true,keepFreeHandMotion:true,blendFromAnimatedHand:true,gripHands:true,procedural:false,
      disableClimbFallback:true,hipHeight:.89,gripRadius:.031,elbowPole:[0,-1,0]};
    return {pose,plantedFoot:stanceLeg,outsideHand:grips.length?outer:undefined};
  }
}
