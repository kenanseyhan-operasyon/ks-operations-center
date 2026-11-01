import * as T from 'three';
import {DEADMAN_CABLE_LENGTH, type VehicleDeadman} from './vehicle-deadman';
import type {NathanActor} from './nathan-model';
import type {NathanController} from './nathan-controller';
import {NathanNavigation} from './nathan-navigation';
import type {Entity} from './scene-data';
import type {V3} from './personnel-navigation';

type Hooks={controller:NathanController;entities:()=>Entity[];object:(id:string)=>T.Group|undefined;
  actor:(id:string)=>NathanActor|undefined;device:(id:string)=>VehicleDeadman|undefined;
  operator:(point:T.Vector3)=>Entity|undefined;activate:(e:Entity)=>void;notify:(s:string)=>void;
  gateAmount?:(id:string)=>number;speed:(id:string)=>number;};
export type DeadmanPhase='stowed'|'approaching'|'reaching'|'lifting'|'held'|'returning'|'lowering'|'releasing';
const tuple=(v:T.Vector3)=>v.toArray() as V3;

/** One physical switch, one operator. The deadman is an enable signal, not a fuel-flow simulation. */
export class DeadmanSession {
  vehicleId?:string;operatorId?:string;phase:DeadmanPhase='stowed';
  private deviceRef?:VehicleDeadman;private actorRef?:NathanActor;private vehicleMatrix?:T.Matrix4;
  private elapsed=0;private route:T.Vector3[]=[];private nav?:NathanNavigation;private navAge=0;
  private start=new T.Vector3();private lastRoot?:T.Vector3;
  constructor(private h:Hooks){}
  get device(){return this.vehicleId?this.h.device(this.vehicleId):undefined;}
  get occupied(){return this.phase!=='stowed';}
  get busy(){return this.occupied&&this.h.controller.id===this.operatorId;}
  get pressed(){return !!this.device?.pressed;}
  get canPress(){return this.phase==='held'&&this.h.controller.id===this.operatorId&&this.h.controller.capturing;}
  select(id:string){if(this.occupied&&id!==this.vehicleId){this.h.notify('Önce eldeki deadman’ı kutusuna bırakın.');return false;}this.vehicleId=id;return !!this.device;}
  toggle(){const d=this.device;if(!d)return; if(!d.setOpen(!d.open))this.h.notify('Kapağı kapatmadan önce deadman’ı yerine bırakın.');}
  blocksVehicle(id:string){return this.occupied&&id===this.vehicleId;}
  take(){
    const d=this.device;if(!d||this.occupied)return false;
    if(Math.abs(this.h.speed(this.vehicleId!))>.01){this.h.notify('Deadman’ı almadan önce aracı durdurun.');return false;}
    const person=this.h.operator(d.approach()),actor=person&&this.h.actor(person.id);
    if(!person||!actor){this.h.notify('Önce sahneye Nathan ekleyin ve modelin yüklenmesini bekleyin.');return false;}
    if(person.nathan?.support||Math.abs(person.position[1])>.23){this.h.notify('Deadman’ı almak için Nathan zeminde olmalı.');return false;}
    this.h.activate(person);this.operatorId=person.id;this.actorRef=actor;this.deviceRef=d;
    d.box.updateWorldMatrix(true,false);this.vehicleMatrix=d.box.matrixWorld.clone();d.setOpen(true);
    if(!this.h.controller.walkTo(tuple(d.approach()))){this.reset();return false;}
    this.phase='approaching';this.elapsed=0;return true;
  }
  returnToBox(){
    if(!this.occupied)return false;this.press(false);
    const person=this.person,d=this.device;if(!person||!d){this.reset();return false;}
    if(!d.deployed){this.h.controller.pause();this.reset();return true;}
    this.h.activate(person);
    if(!this.h.controller.walkTo(tuple(d.approach())))return false;
    this.phase='returning';this.elapsed=0;return true;
  }
  press(on:boolean){this.device?.press(on&&this.canPress);}
  private get person(){return this.h.entities().find(e=>e.id===this.operatorId);}
  private carry(){return this.actorRef!.root.localToWorld(new T.Vector3(.21,1.12,-.30));}
  private setPose(point:T.Vector3,weight=1,lean=0){this.actorRef?.toolContact({hands:[undefined,tuple(point)],handTangents:[[0,1,0],[0,1,0]],handWeight:weight,gripHands:true,freeHands:true,gripRadius:.016,lean});}
  private nextRoute(point:T.Vector3){
    const p=new T.Vector3(point.x,.018,point.z),r=this.route;
    if(!r.length)return [p];
    // Retracing or a clear shortcut returns cable to the cabinet instead of accumulating breadcrumbs.
    for(let i=0;i<r.length;i++)if(this.nav?.clear(tuple(r[i]),tuple(p)))return [...r.slice(0,i+1),p];
    return r.at(-1)!.distanceTo(p)<.08?[...r.slice(0,-1),p]:[...r,p];
  }
  canTarget(point:V3){
    if(!this.busy||!this.device?.deployed)return true;
    const p=new T.Vector3(...point),outlet=this.device.outlet.getWorldPosition(new T.Vector3());
    return Math.hypot(p.x-outlet.x,p.z-outlet.z)<DEADMAN_CABLE_LENGTH-.65;
  }
  canStep(point:V3){
    if(!this.busy||!this.device?.deployed||!this.person)return true;
    const delta=new T.Vector3(...point).sub(new T.Vector3(...this.person.position)),end=this.carry().add(delta);end.y-=.107;
    // Leave 35 cm for wrist rotation and the small hand/cable motion between animation samples.
    return this.device.cableCurve(end,this.nextRoute(new T.Vector3(...point))).getLength()<=DEADMAN_CABLE_LENGTH-.35;
  }
  beforeActors(dt:number){
    if(!this.occupied)return;const d=this.device,person=this.person,actor=this.actorRef,c=this.h.controller;
    d?.box.updateWorldMatrix(true,false);
    if(!d||d!==this.deviceRef||!person||!actor||this.h.actor(person.id)!==actor||!d.box.parent||
      d.box.matrixWorld.elements.some((v,i)=>Math.abs(v-this.vehicleMatrix!.elements[i])>1e-5)) {this.reset();return;}
    if(!this.canPress)this.press(false);
    // A manual scene relocation is not a walk and must not leave a stretched live lead behind.
    const root=actor.root.getWorldPosition(new T.Vector3());
    if(this.lastRoot&&root.distanceTo(this.lastRoot)>1){this.reset();return;}this.lastRoot=root;
    this.navAge+=dt;if(!this.nav||this.navAge>.5){this.nav=new NathanNavigation(this.h.entities(),.055,this.h.gateAmount,this.h.object,person.id);this.navAge=0;}
    if(d.deployed)this.route=this.nextRoute(root);
    if(c.id!==person.id||!c.active){
      if(!d.deployed){this.reset();return;}actor.motion('Idle');this.phase='held';this.setPose(this.carry());return;
    }
    if(this.phase==='approaching'||this.phase==='returning'){
      if(d.deployed)this.setPose(this.carry());
      if(c.phase==='walking')return;
      if(root.distanceTo(d.approach())>.13){if(!d.deployed)this.reset();else this.phase='held';return;}
      // Face the cabinet squarely: the right hand and its clip are offset, the torso is not twisted.
      const face=root.clone().addScaledVector(d.normal(),-1);
      if(c.facePoint(tuple(face),dt)>1||d.amount<.98)return;
      this.elapsed=0;
      if(this.phase==='approaching')this.phase='reaching';
      else{this.phase='lowering';this.start.copy(this.carry());}
    }
    if(['reaching','lifting','lowering','releasing'].includes(this.phase)&&c.phase==='walking'){
      if(!d.deployed){this.reset();return;}this.phase='held';
    }
    this.elapsed+=dt;
    if(this.phase==='reaching'){
      const reach=T.MathUtils.smoothstep(this.elapsed,0,.7);this.setPose(d.dockPoint(),reach,.4*reach);
      if(this.elapsed>=.85){
        const contact=actor.contactRig?.handContacts[1];
        if(!contact||contact.centre.distanceTo(d.dockPoint())>.025){this.h.notify('Nathan tutamağa erişemedi. Kutunun önündeki alanı kontrol edin.');this.reset();return;}
        d.deployed=true;this.start.copy(d.dockPoint());this.phase='lifting';this.elapsed=0;this.route=[d.approach()];
      }
    }
    if(this.phase==='lifting'){
      const t=T.MathUtils.smoothstep(this.elapsed,0,.65);this.setPose(this.start.clone().lerp(this.carry(),t),1,.4*(1-t));
      if(t===1){this.phase='held';this.elapsed=0;}
    }else if(this.phase==='held')this.setPose(this.carry());
    else if(this.phase==='lowering'){
      const t=T.MathUtils.smoothstep(this.elapsed,0,.65);this.setPose(this.start.clone().lerp(d.dockPoint(),t),1,.4*t);
      if(t===1){d.stow();this.phase='releasing';this.elapsed=0;}
    }else if(this.phase==='releasing'){
      const t=T.MathUtils.smoothstep(this.elapsed,0,.55);this.setPose(d.dockPoint(),1-t,.4*(1-t));
      if(t===1){this.reset();d.setOpen(false);}
    }
  }
  afterActors(){
    const d=this.device,rig=this.actorRef?.contactRig;if(!d?.deployed||!rig)return;
    const hand=rig.arms[1].end,centre=hand.localToWorld(rig.grasps[1].centre.clone());
    // The calibrated finger cavity is the grip centre, not the wrist or palm surface.
    const rotation=hand.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2));
    d.setHandle(centre,rotation);d.drawCable(this.route);
  }
  reset(){if(this.deviceRef?.box.parent)this.deviceRef.stow();else this.deviceRef?.press(false);this.actorRef?.toolContact();this.operatorId=undefined;this.actorRef=undefined;this.deviceRef=undefined;this.vehicleMatrix=undefined;this.phase='stowed';this.route=[];this.lastRoot=undefined;this.nav=undefined;}
}
