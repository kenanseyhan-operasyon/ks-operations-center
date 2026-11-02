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
  plantedFoot:0|1|undefined;outsideHand:0|1|undefined;speed:LabSpeed;message:string};
const toArray=(a:T.Vector3):V3=>[a.x,a.y,a.z];
const v=(a:readonly number[])=>new T.Vector3(a[0],a[1],a[2]);
const lerp=(a:V3,b:V3,t:number):V3=>toArray(v(a).lerp(v(b),t));
const smooth=(t:number)=>{const x=T.MathUtils.clamp(t,0,1);return x*x*(3-2*x);};
const tau=2*Math.PI;

/** A single, immutable path for visual treads, root motion, and foot targets. */
export class StairArc {
  readonly layout:ReturnType<typeof tankStairLayout>;
  readonly points:V3[];
  readonly lengths:number[]=[0];
  readonly total:number;
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
  /** Physical tread height from the exact same StairPiece list as the mesh. */
  treadAt(world:V3):number{
    const p=worldToLocal(this.tank,world),angle=Math.atan2(p[0],p[2]);
    let best=Infinity,y=p[1];
    for(const piece of this.layout.pieces){
      if(piece.roofLanding)continue;
      const mid=(piece.a+piece.b)*.5;
      const unwrapped=angle+Math.round((mid-angle)/tau)*tau;
      const a=Math.min(piece.a,piece.b),b=Math.max(piece.a,piece.b);
      const radial=Math.abs(unwrapped-T.MathUtils.clamp(unwrapped,a,b))*this.layout.radius;
      const score=radial*3+Math.abs(p[1]-piece.y1);
      if(score<best){best=score;y=piece.y1;}
    }
    // Approach and roof are not treads. Do not pull the shoes onto a rail.
    return best<.48?localToWorld(this.tank,[0,y,0])[1]:world[1];
  }
  outsideRailAt(metres:number):[V3,V3]|undefined{
    const root=this.at(metres),p=worldToLocal(this.tank,root),angle=Math.atan2(p[0],p[2]);
    let nearest:{piece:(typeof this.layout.pieces)[number],u:number,score:number}|undefined;
    for(const piece of this.layout.pieces){
      if(piece.roofLanding||Math.abs(piece.b-piece.a)<1e-6)continue;
      const mid=(piece.a+piece.b)/2;
      const unwrapped=angle+Math.round((mid-angle)/tau)*tau;
      const u=T.MathUtils.clamp((unwrapped-piece.a)/(piece.b-piece.a),0,1);
      const a=piece.a+(piece.b-piece.a)*u,y=T.MathUtils.lerp(piece.y0,piece.y1,u);
      const score=Math.abs(unwrapped-a)*this.layout.radius+Math.abs(p[1]-y)*2;
      if(!nearest||score<nearest.score)nearest={piece,u,score};
    }
    if(!nearest||nearest.score>.65)return;
    const {piece,u}=nearest,r=this.layout.radius+this.layout.width/2+.025;
    const point=(fraction:number):V3=>{
      const t=T.MathUtils.clamp(fraction,0,1),a=T.MathUtils.lerp(piece.a,piece.b,t);
      const y=T.MathUtils.lerp(piece.y0,piece.y1,t)+1.08;
      return localToWorld(this.tank,[Math.sin(a)*r,y,Math.cos(a)*r]);
    };
    const a=point(u-.1),b=point(u+.1);
    return v(a).distanceTo(v(b))>.014?[a,b]:undefined;
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
  private desired:1|-1=1;
  private status='Hazır. NORMAL yürüyüş; koşma kullanılmaz.';
  constructor(readonly tank:Entity){
    this.stairs=new StairArc(tank);
    this.initial=[...this.stairs.at(0)];this.position=[...this.initial];
    this.heading=this.stairs.headingAt(0,1);
  }
  setSpeed(n:LabSpeed){this.speed=n;}
  reset(){this.distance=0;this.position=[...this.initial];this.activity='ready';this.heading=this.stairs.headingAt(0,1);this.status='Başlangıçta.';}
  up(){
    if(this.distance>=this.stairs.total-.05){this.status='Nathan zaten tank çatısında.';return;}
    this.desired=1;this.activity='align';this.status='Merdivene normal yürüyüşle hizalanıyor.';
  }
  down(){
    if(this.distance<=.05){this.status='Önce merdivenden yukarı çıkmalı.';return;}
    this.desired=-1;this.activity='align';this.status='Aşağı gidiş yönüne dönüyor; dış korkuluk eli değişebilir.';
  }
  stop(){this.activity='ready';this.status='DUR. Bulunduğu basamaktaki pozisyon korunuyor.';}
  private turn(target:number,dt:number):number{
    let error=(target-this.heading+540)%360-180;
    this.heading+=(Math.sign(error)*Math.min(Math.abs(error),150*dt));
    return Math.abs(error);
  }
  tick(dt:number):MotorPose{
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
    const contact=moving?this.stairContacts(direction):undefined;
    const inTurn=this.activity==='align';
    return {position:[...this.position],heading:this.heading,activity:this.activity,
      progress:this.distance/this.stairs.total,motion:moving&&!inTurn?'Nathan_Original_Walk':'Idle',
      motionRate:.49/1.15,contact:contact?.pose,plantedFoot:contact?.plantedFoot,
      outsideHand:contact?.outsideHand,speed:this.speed,message:this.status};
  }
  private stairContacts(direction:1|-1):{pose:NathanContact,plantedFoot:0|1,outsideHand:0|1}|undefined{
    const rail=this.stairs.outsideRailAt(this.distance);
    if(!rail)return;
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
      target[1]=Math.max(target[1],this.stairs.treadAt(target))+.007*this.tank.scale;
      return target;
    };
    const planted=shoe(index*stride,stanceLeg);
    const origin=shoe((index-1)*stride,swingLeg),dest=shoe((index+1)*stride,swingLeg);
    const moving=lerp(origin,dest,smooth(phase));
    moving[1]=T.MathUtils.lerp(origin[1],dest[1],smooth(phase))+.12*this.tank.scale*Math.sin(Math.PI*phase);
    const feet:[V3,V3]=[[...planted],[...planted]];feet[stanceLeg]=planted;feet[swingLeg]=moving;
    const outer=outsideRailHand(this.tank.position,this.position,this.heading);
    const midpoint=lerp(rail[0],rail[1],.5),fade=Math.min(1,smooth((this.distance-.4)/.45),smooth((length-.4-this.distance)/.45));
    const pose:NathanContact={feet,grips:[rail],handGrips:outer===0?[[rail],[]]:[[],[rail]],
      gripAim:[midpoint,midpoint],handWeight:fade,
      freeHands:true,keepFreeHandMotion:true,gripHands:true,procedural:true,
      disableClimbFallback:true,hipHeight:.89,gripRadius:.024,elbowPole:[0,-1,0]};
    return {pose,plantedFoot:stanceLeg,outsideHand:outer};
  }
}
