import * as T from 'three';
import type {Entity} from './scene-data';
import {PERSON_PRESET,validatePersonnel,type PersonPose,type PersonCamera,type PersonSocket} from './personnel-data';
import {personnelRig} from './personnel-model';
import {accessPath,personSocket,personBlocked,groundPath,reachPoint,aircraftRefuelPoint,type V3} from './personnel-navigation';
import {isRefueller} from './refueller-series';
import {isFacilityGate} from './facility-gates';
import {localToWorld,worldToLocal} from './facility-data';
import {applyTransform,disposeObject} from './objects';
import './personnel.css';

type Hooks={
  entities:()=>Entity[];object:(id:string)=>T.Group|undefined;eye:(id:string)=>T.Object3D|undefined;
  select:(id:string)=>void;add:()=>void;edit:()=>boolean;checkpoint:()=>void;changed:()=>void;
  camera:(active:boolean)=>void;driveKey:(key:string,down:boolean)=>boolean;drive:(e:Entity)=>boolean;stopDrive:()=>void;speed:(id:string)=>number;cab:(on:boolean)=>boolean;
  gateAmount:(id:string)=>number;operate:(e:Entity,action:'valve'|'door')=>boolean;platform:(id:string)=>void;
  ready:()=>boolean;notify:(text:string)=>void;
};
type Journey={points:V3[];index:number;pose:PersonPose;complete?:()=>void;targetId?:string;targetPose?:string};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const labels:Record<string,[string,string]>={idle:['Hazır','Ready'],walk:['Yürüyor','Walking'],bend:['Eğiliyor','Bending'],crouch:['Çömeliyor','Crouching'],reach:['Uzanıyor','Reaching'],valve:['Vanayı çeviriyor','Turning valve'],climb:['Merdivende','Climbing'],seated:['Sürücü koltuğunda','In driver seat'],refuel:['İkmal bağlantısı','Refuel connection']};

export class PersonnelModule {
  readonly element=document.createElement('aside');private lang:'tr'|'en'='tr';private personId?:string;private targetId='';private vehicleId='';
  private pose:PersonPose='idle';private cameraMode:PersonCamera='rear';private journey?:Journey;private keys=new Set<string>();private checkpointed=false;private activeControl=false;
  private timer=0;private onTimer?:()=>void;private reach?:T.Vector3;private lookYaw=0;private lookPitch=0;private statusAt=0;private picking=false;private moved=0;
  private hose?:T.Mesh;private nozzle?:T.Group;private connected?:{aircraft:string;vehicle:string;point:V3};private holding=false;private holdSeconds=0;private hoseAt=0;
  private lastSource?:Entity;private status='';
  constructor(private host:HTMLElement,private hooks:Hooks){
    this.element.className='ws-personnel';this.element.hidden=true;this.element.setAttribute('aria-label','İkmal personeli');host.append(this.element);
    window.addEventListener('blur',()=>this.pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
  }
  private t(tr:string,en:string){return this.lang==='tr'?tr:en;}
  private get person(){return this.hooks.entities().find(e=>e.id===this.personId&&e.preset===PERSON_PRESET);}
  get active(){return this.activeControl&&!!this.person;}
  get following(){return this.active&&this.cameraMode!=='free';}
  get inside(){return this.following&&this.cameraMode==='eyes';}
  get isPicking(){return this.picking;}
  setLanguage(lang:'tr'|'en'){this.lang=lang;if(!this.element.hidden)this.render();}
  open(e?:Entity){
    if(e?.preset===PERSON_PRESET&&e.id!==this.personId){this.stop();this.personId=e.id;}
    this.personId??=this.hooks.entities().find(o=>o.preset===PERSON_PRESET)?.id;
    this.element.hidden=false;this.render();
  }
  selection(e?:Entity){if(e?.preset===PERSON_PRESET&&!this.active){this.personId=e.id;if(!this.element.hidden)this.render();}}
  sync(){
    const e=this.person;if(this.personId&&!e){this.stop();this.personId=undefined;}
    if(e!==this.lastSource){const old=this.lastSource;this.lastSource=e;if(old&&this.active)this.stop();}
    if(!this.element.hidden)this.render();
  }
  close(){this.stop();this.element.hidden=true;}
  private begin(){if(!this.checkpointed){this.hooks.checkpoint();this.checkpointed=true;}}
  pause(){this.keys.clear();this.holding=false;this.picking=false;this.journey=undefined;this.timer=0;this.onTimer=undefined;if(this.pose==='walk'||this.pose==='climb'||this.pose==='reach'||this.pose==='valve')this.pose=this.person?.personnel?.attachment?.socket==='driver'?'seated':'idle';this.commit();}
  private commit(){if(this.checkpointed){this.checkpointed=false;this.hooks.changed();}}
  stop(){
    if(this.person?.personnel?.attachment?.socket==='driver'&&this.activeControl)this.hooks.stopDrive();
    this.pause();this.disconnect();this.activeControl=false;this.hooks.camera(false);
    for(const e of this.hooks.entities())if(e.kind==='person')personnelRig(this.hooks.object(e.id))?.setEyes(false);
  }
  private start(){
    if(!this.person||!this.hooks.ready())return false;
    const wasActive=this.activeControl,attachment=this.person.personnel?.attachment;
    if(!wasActive&&attachment?.socket!=='driver')this.hooks.stopDrive();
    this.activeControl=true;this.lastSource=this.person;
    if(!wasActive&&attachment?.socket==='driver'){const vehicle=this.hooks.entities().find(o=>o.id===attachment.targetId);if(vehicle)this.hooks.drive(vehicle);}this.lookYaw=this.lookPitch=0;this.hooks.camera(this.cameraMode!=='free');return true;
  }
  key(key:string,down:boolean){
    if(!this.active)return false;
    if(this.person?.personnel?.attachment?.socket==='driver'){
      if(down&&['1','2','3','4'].includes(key)){this.view((['eyes','rear','front','top'] as PersonCamera[])[Number(key)-1]);return true;}return this.hooks.driveKey(key,down);
    }
    if(!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','c','b',' ','escape','1','2','3','4'].includes(key))return false;
    if(down&&!this.keys.has(key)){
      if(key==='escape'){this.pause();this.render();return true;}
      if(['1','2','3','4'].includes(key)){this.view((['eyes','rear','front','top'] as PersonCamera[])[Number(key)-1]);return true;}
      if(key==='c'){this.action(this.pose==='crouch'?'stand':'crouch');return true;}
      if(key==='b'){this.action(this.pose==='bend'?'stand':'bend');return true;}
    }
    if(down)this.keys.add(key);else this.keys.delete(key);if(key===' ')this.holding=down&&!!this.connected;return true;
  }
  bindInput(canvas:HTMLElement){
    let pointer:number|undefined,last=[0,0];
    canvas.addEventListener('pointerdown',e=>{const ev=e as PointerEvent;if(!this.following||this.picking||ev.button!==0||this.person?.personnel?.attachment?.socket==='driver'&&this.cameraMode==='eyes')return;pointer=ev.pointerId;last=[ev.clientX,ev.clientY];this.moved=0;canvas.setPointerCapture(pointer);ev.stopImmediatePropagation();},true);
    canvas.addEventListener('pointermove',e=>{const ev=e as PointerEvent;if(pointer!==ev.pointerId)return;const dx=ev.clientX-last[0],dy=ev.clientY-last[1];last=[ev.clientX,ev.clientY];this.moved+=Math.abs(dx)+Math.abs(dy);this.lookYaw-=dx*.005;this.lookPitch=T.MathUtils.clamp(this.lookPitch+dy*.004,-1.05,1.05);ev.stopImmediatePropagation();},true);
    const release=(e:Event)=>{const ev=e as PointerEvent;if(pointer!==ev.pointerId)return;pointer=undefined;ev.stopImmediatePropagation();};canvas.addEventListener('pointerup',release,true);canvas.addEventListener('pointercancel',release,true);
  }
  view(mode:PersonCamera){
    this.cameraMode=mode;this.lookYaw=this.lookPitch=0;
    if(this.start()){const driver=this.person?.personnel?.attachment?.socket==='driver';this.hooks.cab(!!driver&&mode==='eyes');this.hooks.camera(mode!=='free');}
    this.render();
  }
  cameraPose(){
    const e=this.person,root=e&&this.hooks.object(e.id),rig=personnelRig(root);if(!this.following||!e||!root||!rig)return;
    const eye=rig.eyeWorld(),yaw=e.heading*Math.PI/180+this.lookYaw,h=e.height*e.scale,forward=new T.Vector3(Math.sin(yaw),0,-Math.cos(yaw)),target=eye.clone();let position:T.Vector3;
    if(this.cameraMode==='eyes'){position=eye.clone();target.addScaledVector(forward,4*Math.cos(this.lookPitch));target.y-=Math.sin(this.lookPitch)*4;}
    else if(this.cameraMode==='top'){target.set(e.position[0],e.position[1]+h*.5,e.position[2]);position=target.clone().add(new T.Vector3(.001,h*4,.01));}
    else{target.y-=h*.22;position=target.clone().addScaledVector(forward,(this.cameraMode==='front'?1:-1)*h*2.4);position.y+=h*(.45+this.lookPitch);}
    return {position,target};
  }
  walkTo(point:V3){
    this.picking=false;const e=this.person;if(!e||!this.active)return;
    if(e.personnel?.attachment){this.tell('Önce personeli aşağı indirin.','Bring the operator down first.');return;}
    const path=groundPath(e.position,point,this.hooks.entities(),e.id,this.hooks.gateAmount);if(!path){this.tell('Yürüme yolu kapalı veya hedef 65 metreden uzak. Daha yakın, açık bir nokta seçin.','Path blocked or destination farther than 65 metres. Choose a closer clear point.');this.render();return;}
    this.begin();this.journey={points:path,index:0,pose:'walk',complete:()=>this.commit()};this.pose='walk';this.render();
  }
  pick(x:number,z:number){if(!this.picking)return false;this.walkTo([x,this.person?.position[1]||0,z]);return true;}
  private tell(tr:string,en:string){this.status=this.t(tr,en);this.hooks.notify(this.status);this.updateStatus();}
  private target(){return this.hooks.entities().find(o=>o.id===this.targetId);}
  private approach(target:Entity,point:V3,complete:()=>void){
    const e=this.person!;if(e.personnel?.attachment){if(new T.Vector3(...e.position).distanceTo(new T.Vector3(point[0],e.position[1],point[2]))>1.5){this.tell('Hedefe yaklaşmak için önce aşağı inin.','Step down before approaching this target.');return;}complete();return;}
    const options:V3[]=[];for(let i=0;i<12;i++){const a=i/12*Math.PI*2;options.push([point[0]+Math.sin(a)*.72,e.position[1],point[2]+Math.cos(a)*.72]);}
    options.sort((a,b)=>Math.hypot(a[0]-e.position[0],a[2]-e.position[2])-Math.hypot(b[0]-e.position[0],b[2]-e.position[2]));
    for(const p of options){const path=groundPath(e.position,p,this.hooks.entities(),e.id,this.hooks.gateAmount);if(path){this.begin();this.journey={points:path,index:0,pose:'walk',targetId:target.id,targetPose:JSON.stringify([target.position,target.heading,target.scale]),complete:()=>{e.heading=Math.atan2(point[0]-e.position[0],-(point[2]-e.position[2]))*180/Math.PI;complete();}};return;}}
    this.tell('Bu hedefe açık bir yürüme yolu bulunamadı.','No clear walking path to this target.');
  }
  private operate(action:'valve'|'door'){
    const e=this.person,target=this.target();if(!e||!target)return;
    const valid=action==='valve'?target.preset==='PIPE_VALVE':isFacilityGate(target)||target.preset==='GUARD_CABIN'||!!this.hooks.object(target.id)?.getObjectByName('REFUEL_PANEL_COVER');
    if(!valid){this.tell(action==='valve'?'Hedef olarak hat vanası seçin.':'Hedef olarak tesis kapısı, bekçi mobosu veya A320 ikmal panelini seçin.',action==='valve'?'Choose a line valve.':'Choose a facility gate, guard cabin or A320 refuel panel.');return;}
    const point=reachPoint(target,action),targetPose=JSON.stringify([target.position,target.heading,target.scale]);this.approach(target,point,()=>{
      if(Math.abs(point[1]-(e.position[1]+e.height*.66*e.scale))>e.height*.5*e.scale){this.tell('Hedef el erişiminin dışında; uygun platforma çıkın.','Target is outside hand reach; use a suitable platform.');this.commit();return;}
      this.pose=action==='valve'?'valve':'reach';this.reach=new T.Vector3(...point);this.timer=1.6;this.onTimer=()=>{const current=this.hooks.entities().find(o=>o.id===target.id);if(current&&JSON.stringify([current.position,current.heading,current.scale])===targetPose&&this.hooks.operate(current,action))this.tell(action==='valve'?'Vana konumu değişti.':'Kapı konumu değişti.',action==='valve'?'Valve position changed.':'Door position changed.');this.pose='idle';this.reach=undefined;this.commit();};
    });
  }
  private climb(socket:PersonSocket){
    const e=this.person,target=this.target();if(!e||!target)return;
    if(e.personnel?.attachment){this.tell('Önce mevcut yerden aşağı inin.','Step down from the current support first.');return;}
    if(Math.abs(this.hooks.speed(target.id))>.01){this.tell('Önce aracı durdurun.','Stop the vehicle first.');return;}
    if(socket==='platform'){const steps=accessPath(target,this.hooks.object(target.id),socket);if(steps&&steps.at(-1)![1]-steps.at(-2)![1]>.80){this.tell('Önce araç platformunu alçaltın.','Lower the vehicle platform first.');return;}}
    const path=accessPath(target,this.hooks.object(target.id),socket);if(!path){this.tell('Bu hedefte uygun merdiven bulunamadı. Modelin yüklenmesini bekleyin veya merdivenli bir parça seçin.','No suitable access steps found. Wait for the model or select a part with stairs.');return;}
    const ground=groundPath(e.position,path[0],this.hooks.entities(),e.id,this.hooks.gateAmount);if(!ground){this.tell('Merdiven girişine açık yol bulunamadı.','No clear path to the bottom of the stairs.');return;}
    this.begin();const anchor=JSON.stringify([target.position,target.heading,target.scale]),ascend=()=>{this.journey={points:path.slice(1),index:0,pose:'climb',targetId:target.id,targetPose:anchor,complete:()=>{e.personnel=validatePersonnel(e.personnel);e.personnel.attachment={targetId:target.id,socket,headingOffset:e.heading-target.heading};this.pose='idle';this.commit();this.render();}};};
    this.journey={points:ground,index:0,pose:'walk',targetId:target.id,targetPose:anchor,complete:ascend};
  }
  private descend(){
    const e=this.person,a=e?.personnel?.attachment;if(!e||!a)return;
    const target=this.hooks.entities().find(o=>o.id===a.targetId);if(!target){delete e.personnel!.attachment;return;}
    if(Math.abs(this.hooks.speed(target.id))>.01){this.tell('İnmeden önce aracı durdurun.','Stop the vehicle before getting out.');return;}
    if(a.socket==='driver'){
      this.hooks.stopDrive();this.hooks.cab(false);const point=localToWorld(target,[-target.width/2-.75,0,-target.length*.36]);
      if(personBlocked(point,this.hooks.entities(),e.id,this.hooks.gateAmount)){this.tell('Sürücü kapısının çıkışı kapalı.','Driver door exit is blocked.');return;}
      this.begin();delete e.personnel!.attachment;e.position=point;e.heading=target.heading+270;this.pose='idle';this.hooks.camera(this.cameraMode!=='free');this.commit();this.render();return;
    }
    const path=accessPath(target,this.hooks.object(target.id),a.socket);if(!path)return;
    if(a.socket==='platform'&&path.at(-1)![1]-path.at(-2)![1]>.80){this.tell('İnmeden önce platformu alçaltın.','Lower the platform before stepping down.');return;}
    this.begin();delete e.personnel!.attachment;this.journey={points:[...path].reverse(),index:0,pose:'climb',targetId:target.id,targetPose:JSON.stringify([target.position,target.heading,target.scale]),complete:()=>{this.pose='idle';this.commit();this.render();}};
  }
  private drive(){
    const e=this.person,target=this.target();if(!e||!target||!isRefueller(target.preset)){this.tell('Bir ikmal aracı seçin.','Select a refuelling vehicle.');return;}
    if(this.hooks.entities().some(p=>p.id!==e.id&&p.personnel?.attachment?.targetId===target.id&&p.personnel.attachment.socket==='driver')){this.tell('Sürücü koltuğu dolu.','Driver seat is occupied.');return;}
    if(e.personnel?.attachment){this.tell('Önce aşağı inin.','Step down first.');return;}
    if(Math.abs(this.hooks.speed(target.id))>.01||!this.hooks.eye(target.id)){this.tell('Araç durmalı ve modeli yüklenmiş olmalı.','Vehicle must be stopped and its model loaded.');return;}
    const door=localToWorld(target,[-target.width/2,1,-target.length*.36]);
    this.approach(target,door,()=>{e.personnel=validatePersonnel(e.personnel);e.personnel.attachment={targetId:target.id,socket:'driver'};this.pose='seated';if(!this.hooks.drive(target)){delete e.personnel.attachment;this.pose='idle';}this.hooks.camera(this.cameraMode!=='free');if(this.cameraMode==='eyes')this.hooks.cab(true);this.commit();this.render();});
  }
  private refuel(){
    const e=this.person,a=this.target(),vehicle=this.hooks.entities().find(o=>o.id===this.vehicleId),point=a&&aircraftRefuelPoint(a);
    if(!e||!a||!point||!vehicle||!isRefueller(vehicle.preset)){this.tell('A320/B737 hedef uçağı ve hortumun çıkacağı ikmal aracını seçin.','Choose an A320/B737 and a refuelling vehicle for the hose.');return;}
    if(Math.abs(this.hooks.speed(vehicle.id))>.01){this.tell('İkmal aracı durmalı.','Refuelling vehicle must be stopped.');return;}
    const reach=()=>{
      const scale=e.height/1.78*e.scale,shoulder=new T.Vector3(e.position[0],e.position[1]+1.44*scale,e.position[2]);
      if(shoulder.distanceTo(new T.Vector3(...point))>.89*scale){this.tell('Kanat bağlantısı el erişiminin dışında. Aracı uygun konuma alın, platforma çıkıp yüksekliğini ayarlayın.','Wing coupling is out of reach. Position the vehicle, board the platform and adjust its height.');this.commit();return;}
      if(Math.hypot(point[0]-vehicle.position[0],point[2]-vehicle.position[2])>18){this.tell('Hortum 18 metrelik çalışma mesafesini aşıyor.','Hose exceeds the 18 metre working distance.');this.commit();return;}
      this.pose='reach';this.reach=new T.Vector3(...point);e.heading=Math.atan2(point[0]-e.position[0],-(point[2]-e.position[2]))*180/Math.PI;const attachment=e.personnel?.attachment;if(attachment){const support=this.hooks.entities().find(o=>o.id===attachment.targetId);if(support)attachment.headingOffset=e.heading-support.heading;}this.timer=1.8;
      this.onTimer=()=>{this.connected={aircraft:a.id,vehicle:vehicle.id,point};this.pose='refuel';this.holdSeconds=0;this.tell('Hortum bağlı. İkmal hareketini görmek için deadman düğmesini basılı tutun.','Hose connected. Hold the deadman control to rehearse refuelling.');this.render();this.commit();};
    };
    if(e.personnel?.attachment)reach();else this.approach(a,point,reach);
  }
  private disconnect(){if(this.hose){disposeObject(this.hose);this.hose.removeFromParent();this.hose=undefined;}if(this.nozzle){disposeObject(this.nozzle);this.nozzle.removeFromParent();this.nozzle=undefined;}this.connected=undefined;this.holding=false;this.reach=undefined;if(this.pose==='refuel')this.pose='idle';}
  action(action:string){
    if(action==='close'){this.close();return;}if(action==='add'){this.hooks.add();return;}if(action==='edit'){if(this.hooks.edit()&&this.person)this.hooks.select(this.person.id);return;}
    if(!this.start()){this.tell('Önce kitaplıktan personel ekleyin ve 3D görünümü açın.','Add an operator from the library and open 3D first.');return;}
    if(action==='stop'){this.pause();this.disconnect();this.pose=this.person?.personnel?.attachment?.socket==='driver'?'seated':'idle';this.hooks.stopDrive();this.activeControl=false;this.hooks.camera(false);}
    else if(action==='descend')this.descend();else if(action==='drive')this.drive();
    else if(action==='valve'||action==='door'){this.pause();this.disconnect();this.operate(action);}
    else if(['climb','platform','roof'].includes(action)){this.pause();this.disconnect();this.climb(action==='climb'?'landing':action as PersonSocket);}
    else if(action==='lift'){this.disconnect();const a=this.person?.personnel?.attachment;if(a?.socket==='platform')this.hooks.platform(a.targetId);else this.tell('Önce araç platformuna çıkın.','Board the vehicle platform first.');}
    else if(action==='refuel'){this.pause();this.disconnect();this.refuel();}
    else if(action==='disconnect')this.disconnect();
    else if(action==='walk'){this.pause();this.picking=true;this.view('free');this.tell('Yürüyeceği noktayı zeminde seçin.','Choose a destination on the ground.');}
    else if(['stand','bend','crouch'].includes(action)){this.pause();this.disconnect();if(this.person?.personnel?.attachment?.socket!=='driver')this.pose=action==='stand'?'idle':action as PersonPose;}
    this.render();
  }
  tick(dt:number,now:number,night:boolean){
    const e=this.person;
    if(this.active&&!e){this.stop();return;}
    // Occupants follow the moving basket, articulated tanker roof and real driver eye.
    for(const person of this.hooks.entities().filter(p=>p.kind==='person')){
      const a=person.personnel?.attachment,root=this.hooks.object(person.id);if(!root)continue;
      if(a){const target=this.hooks.entities().find(o=>o.id===a.targetId),point=target&&personSocket(target,this.hooks.object(target.id),a.socket,this.hooks.eye(target.id));if(point){person.position=[...point];if(a.socket==='driver')person.position[1]-=1.278*(person.height/1.78)*person.scale;person.heading=target!.heading+(a.headingOffset||0)+(a.socket==='roof'?(target!.trailerAngle||0)*180/Math.PI:0);}else if(!target){delete person.personnel!.attachment;person.position[1]=0;}}
      applyTransform(root,person);const rig=personnelRig(root),active=this.active&&person.id===e?.id;
      rig?.setEyes(active&&this.inside);rig?.update(dt,active?this.pose:a?.socket==='driver'?'seated':'idle',active&&this.pose==='walk'?1:0,night,active?this.reach:undefined);
    }
    if(!this.active||!e)return;
    if(this.journey){
      const j=this.journey,target=j.targetId&&this.hooks.entities().find(o=>o.id===j.targetId);
      if(j.targetId&&(!target||JSON.stringify([target.position,target.heading,target.scale])!==j.targetPose||Math.abs(this.hooks.speed(j.targetId))>.01)){this.pause();this.tell('Hedef taşındı; hareket durduruldu.','Target moved; action stopped.');return;}
      const p=j.points[j.index],v=new T.Vector3(...p).sub(new T.Vector3(...e.position)),distance=v.length(),travel=Math.min(distance,dt*(j.pose==='climb'?.62:1.25));
      if(distance>.001){this.pose=j.pose==='climb'&&Math.abs(v.y)<.025&&Math.hypot(v.x,v.z)>.4?'walk':j.pose;e.position=new T.Vector3(...e.position).addScaledVector(v,travel/distance).toArray() as V3;if(Math.hypot(v.x,v.z)>.03)e.heading=Math.atan2(v.x,-v.z)*180/Math.PI;}
      if(distance<=travel+.005){e.position=[...p];j.index++;if(j.index>=j.points.length){this.journey=undefined;this.pose='idle';j.complete?.();}}
    }else if(!e.personnel?.attachment&&!this.connected){
      const pressed=(...names:string[])=>names.some(n=>this.keys.has(n)),forward=Number(pressed('w','arrowup'))-Number(pressed('s','arrowdown')),turn=Number(pressed('d','arrowright'))-Number(pressed('a','arrowleft'));
      if(forward||turn){this.begin();e.heading+=turn*dt*100;const a=e.heading*Math.PI/180,speed=this.pose==='crouch'?.45:1.25,p:V3=[e.position[0]+Math.sin(a)*dt*forward*speed,e.position[1],e.position[2]-Math.cos(a)*dt*forward*speed];if(!personBlocked(p,this.hooks.entities(),e.id,this.hooks.gateAmount)){e.position=p;if(this.pose!=='crouch')this.pose=forward?'walk':'idle';}}
      else if(this.pose==='walk'){this.pose='idle';this.commit();}
    }
    if(this.timer>0){this.timer-=dt;if(this.timer<=0){const fn=this.onTimer;this.onTimer=undefined;fn?.();}}
    if(this.connected){
      const vehicle=this.hooks.entities().find(o=>o.id===this.connected!.vehicle),aircraft=this.hooks.entities().find(o=>o.id===this.connected!.aircraft),point=aircraft&&aircraftRefuelPoint(aircraft);
      if(!vehicle||!point||Math.abs(this.hooks.speed(vehicle.id))>.01||new T.Vector3(...point).distanceTo(new T.Vector3(...this.connected.point))>.03){this.disconnect();this.tell('Araç veya uçak hareket etti; ikmal denemesi durdu.','Vehicle or aircraft moved; refuelling rehearsal stopped.');}
      else{if(this.holding)this.holdSeconds+=dt;this.drawHose(now);}
    }
    const root=this.hooks.object(e.id);if(root)applyTransform(root,e);if(now-this.statusAt>200){this.statusAt=now;this.updateStatus();}
  }
  blocksVehicle(id:string){return this.hooks.entities().some(e=>e.personnel?.attachment?.targetId===id&&e.personnel.attachment.socket!=='driver')||this.connected?.vehicle===id||this.journey?.targetId===id&&this.journey.pose==='climb';}
  private drawHose(now:number){
    if(!this.connected||now-this.hoseAt<100)return;this.hoseAt=now;const e=this.person!,rig=personnelRig(this.hooks.object(e.id)),vehicle=this.hooks.entities().find(o=>o.id===this.connected!.vehicle),parent=this.hooks.object(e.id)?.parent;if(!rig||!vehicle||!parent)return;
    const start=new T.Vector3(...localToWorld(vehicle,[-vehicle.width/2,1.1,0])),end=new T.Vector3(...this.connected.point),hand=rig.handWorld(),low=start.clone().lerp(end,.5);low.y=Math.max(.12,Math.min(start.y,end.y)-.9);
    const curve=new T.CatmullRomCurve3([start,low,hand,end]);const geometry=new T.TubeGeometry(curve,36,.032,7,false);
    if(!this.hose){this.hose=new T.Mesh(geometry,new T.MeshStandardMaterial({color:'#202c33',roughness:.85}));this.hose.name='PERSON_REFUEL_HOSE';parent.add(this.hose);}else{this.hose.geometry.dispose();this.hose.geometry=geometry;}
    if(!this.nozzle){this.nozzle=new T.Group();const coupling=new T.Mesh(new T.CylinderGeometry(.065,.048,.15,12),new T.MeshStandardMaterial({color:'#a8b2b6',metalness:.7,roughness:.3}));this.nozzle.add(coupling);parent.add(this.nozzle);}this.nozzle.position.copy(end);(this.hose.material as T.MeshStandardMaterial).emissive.set(this.holding?'#0a3834':'#000000');
  }
  private updateStatus(){
    const el=this.element.querySelector('output');if(el){const pose=labels[this.pose]?.[this.lang==='tr'?0:1]||'';el.textContent=this.connected?this.t(`Hortum bağlı · Deadman ${this.holding?'basılı':'bırakıldı'} · ${this.holdSeconds.toFixed(1)} sn`,`Hose connected · Deadman ${this.holding?'held':'released'} · ${this.holdSeconds.toFixed(1)} s`):this.active?pose+(this.journey?this.t(' · Hedefe ilerliyor',' · Moving to target'):''):this.t('Bir personel seçin ve bir hareket başlatın.','Choose an operator and start an action.');}
    this.element.querySelectorAll<HTMLButtonElement>('[data-person-view]').forEach(b=>b.setAttribute('aria-pressed',String(this.active&&this.cameraMode===b.dataset.personView)));
  }
  private render(){
    const expanded=Array.from(this.element.querySelectorAll('details')).map(d=>d.open);
    const people=this.hooks.entities().filter(e=>e.preset===PERSON_PRESET),e=this.person,targets=this.hooks.entities().filter(o=>o.kind!=='person'&&(o.kind==='tank'||o.kind==='aircraft'||isRefueller(o.preset)||isFacilityGate(o)||['PIPE_VALVE','GUARD_CABIN','MOBILE_STAIR','CROSSOVER_STAIR'].includes(o.preset))),vehicles=targets.filter(o=>isRefueller(o.preset));
    const button=(action:string,tr:string,en:string)=>`<button data-person-action="${action}" ${!e?'disabled':''}>${this.t(tr,en)}</button>`;
    this.element.innerHTML=`<header><strong>${this.t('İkmal personeli','Refuelling operator')}</strong><button data-person-action="close" aria-label="${this.t('Personel panelini kapat','Close personnel panel')}">×</button></header><div class="person-body"><label>${this.t('Personel','Operator')}<select data-person-select><option value="">${this.t('Seçin','Choose')}</option>${people.map(o=>`<option value="${esc(o.id)}" ${o.id===e?.id?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label><div class="person-row"><button data-person-action="add">＋ ${this.t('Personel ekle','Add operator')}</button>${button('edit','Düzenle','Edit')}</div>${e?`<div class="person-views">${(['eyes','rear','front','top','free'] as PersonCamera[]).map((mode,i)=>`<button data-person-view="${mode}" aria-pressed="${this.active&&this.cameraMode===mode}">${[this.t('Gözünden','Eyes'),this.t('Arkadan','Rear'),this.t('Önden','Front'),this.t('Üstten','Top'),this.t('Serbest','Free')][i]}</button>`).join('')}</div><output aria-live="off"></output><div class="person-row">${button('stand','Ayağa kalk','Stand')}${button('bend','Eğil','Bend')}${button('crouch','Çömel','Crouch')}${button('walk','Noktaya yürü','Walk to point')}</div><div class="person-pad"><button data-person-key="w" aria-label="${this.t('İleri yürü','Walk forward')}">↑</button><button data-person-key="a" aria-label="${this.t('Sola dön','Turn left')}">↶</button>${button('stop','Dur','Stop')}<button data-person-key="d" aria-label="${this.t('Sağa dön','Turn right')}">↷</button><button data-person-key="s" aria-label="${this.t('Geri yürü','Walk backwards')}">↓</button></div><small>W/A/S/D · C: ${this.t('çömel','crouch')} · B: ${this.t('eğil','bend')} · 1–4: ${this.t('kamera','camera')}</small><label>${this.t('Etkileşim hedefi','Interaction target')}<select data-person-target><option value="">${this.t('Vana, kapı, merdiven, araç veya uçak','Valve, door, stairs, vehicle or aircraft')}</option>${targets.map(o=>`<option value="${esc(o.id)}" ${o.id===this.targetId?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label><div class="person-actions">${button('valve','Vana aç / kapat','Open / close valve')}${button('door','Kapı aç / kapat','Open / close door')}${button('climb','Merdiven çık','Climb stairs')}${button('platform','Araç platformuna çık','Board platform')}${button('roof','Araç üstüne çık','Climb vehicle roof')}${button('lift','Platformu yükselt / indir','Raise / lower platform')}${button('drive','Sürücü koltuğuna geç','Take driver seat')}${button('descend','Aşağı in / araçtan in','Step down / get out')}</div><details><summary>${this.t('Uçak ikmali hareketi','Aircraft refuelling motion')}</summary><label>${this.t('Hortumun çıkacağı araç','Hose vehicle')}<select data-person-vehicle><option value="">${this.t('İkmal aracını seçin','Choose refuelling vehicle')}</option>${vehicles.map(o=>`<option value="${esc(o.id)}" ${o.id===this.vehicleId?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label><div class="person-row">${button('refuel','Hortumu bağla','Connect hose')}${button('disconnect','Hortumu ayır','Disconnect hose')}</div><button class="person-deadman" data-deadman ${!this.connected?'disabled':''}>${this.t('DEADMAN · Basılı tut','DEADMAN · Hold')}</button><small>${this.t('Hedef olarak A320/B737 seçin. Bağlantı el erişiminde olmalı. Hortum ve deadman hareket denemesi; yakıt miktarı değiştirilmez.','Choose an A320/B737 within hand reach. Hose and deadman motion rehearsal; fuel quantities remain unchanged.')}</small></details><details><summary>${this.t('Personeli düzenle','Edit operator')}</summary><form data-person-settings><label>${this.t('Adı','Name')}<input name="name" maxlength="100" value="${esc(e.name)}"></label><div class="person-row"><label>${this.t('Boy (m)','Height (m)')}<input name="height" type="number" min="1.5" max="2.05" step=".01" value="${e.height}"></label><label>${this.t('Üniforma','Uniform')}<input name="color" type="color" value="${esc(e.color)}"></label></div><label>${this.t('Yelek','Vest')}<select name="vest"><option value="yellow" ${e.personnel?.vest!=='orange'?'selected':''}>${this.t('Sarı','Yellow')}</option><option value="orange" ${e.personnel?.vest==='orange'?'selected':''}>${this.t('Turuncu','Orange')}</option></select></label><label>${this.t('Ten tonu','Skin tone')}<select name="skin">${['light','medium','dark'].map((v,i)=>`<option value="${v}" ${(e.personnel?.skin||'medium')===v?'selected':''}>${[this.t('Açık','Light'),this.t('Orta','Medium'),this.t('Koyu','Dark')][i]}</option>`).join('')}</select></label><button type="submit">${this.t('Uygula','Apply')}</button></form><small>${this.t('İş ayakkabısı · reflektif yelek · koruyucu kep · gündüz koyu / gece şeffaf iş gözlüğü','Work boots · reflective vest · bump cap · dark daytime / clear night safety glasses')}</small></details>`:`<p>${this.t('Kitaplıktan ikmal personeli ekleyin; ardından burada hareketlerini ve kamerasını yönetin.','Add a refuelling operator from the library, then control movements and cameras here.')}</p>`}</div>`;
    this.element.querySelectorAll<HTMLButtonElement>('[data-person-action]').forEach(b=>b.onclick=()=>this.action(b.dataset.personAction!));
    this.element.querySelectorAll<HTMLButtonElement>('[data-person-view]').forEach(b=>b.onclick=()=>this.view(b.dataset.personView as PersonCamera));
    this.element.querySelector<HTMLSelectElement>('[data-person-select]')!.onchange=ev=>{this.stop();this.personId=(ev.target as HTMLSelectElement).value||undefined;if(this.personId)this.hooks.select(this.personId);this.render();};
    const target=this.element.querySelector<HTMLSelectElement>('[data-person-target]');if(target)target.onchange=()=>{this.targetId=target.value;};
    const vehicle=this.element.querySelector<HTMLSelectElement>('[data-person-vehicle]');if(vehicle)vehicle.onchange=()=>{this.vehicleId=vehicle.value;};
    this.element.querySelectorAll<HTMLButtonElement>('[data-person-key],[data-deadman]').forEach(b=>{const key=b.dataset.personKey||' ';b.onpointerdown=ev=>{ev.preventDefault();if(!this.start())return;b.setPointerCapture(ev.pointerId);this.key(key,true);};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>this.key(key,false);});
    const form=this.element.querySelector<HTMLFormElement>('[data-person-settings]');if(form)form.onsubmit=ev=>{ev.preventDefault();if(!e||!this.hooks.edit())return;this.stop();const f=new FormData(form);this.begin();e.name=String(f.get('name')).trim().slice(0,100)||this.t('İkmal personeli','Refuelling operator');e.height=T.MathUtils.clamp(Number(f.get('height'))||1.78,1.5,2.05);e.color=String(f.get('color'));e.personnel={...validatePersonnel({skin:f.get('skin'),vest:f.get('vest')}),attachment:e.personnel?.attachment};this.commit();this.render();};
    this.element.querySelectorAll('details').forEach((d,i)=>{d.open=expanded[i]||false;});
    this.updateStatus();
  }
}
