import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {JSDOM} from 'jsdom';
import {newEntity,validateScene} from '../src/scene-data';
import {NATHAN_PRESET} from '../src/nathan-data';
import {NathanActors} from '../src/nathan-model';
import {NathanController} from '../src/nathan-controller';
import {NathanNavigation} from '../src/nathan-navigation';
import {makeNathanAccess} from '../src/nathan-access';
import {stairPose} from '../src/nathan-stair-gait';
import {driverPose} from '../src/nathan-driver';
import {NathanCamera} from '../src/nathan-camera';
import {VehicleRig} from '../src/vehicle-rig';
import {VehicleLighting} from '../src/vehicle-lighting';
import {R14} from '../src/r14-spec';
import {closedAnimationPack} from '../src/model-animations';
import {applyTransform,makeObject} from '../src/objects';
import {Workspace} from '../src/workspace';

const dom=new JSDOM('<body><canvas></canvas></body>',{pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document});dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
async function read(path:string){const b=fs.readFileSync(path),l=new GLTFLoader();l.register(()=>({name:'TEST_TEXTURE',loadTexture:async()=>new T.Texture()}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const [asset,vehicle]=await Promise.all([read('public/models/personnel/KS_Nathan_15_Hareket.glb'),read('public/models/refueller-38k-r14.glb')]);
const truck=newEntity('R14',0,0),person=newEntity(NATHAN_PRESET,-4,8),model=clone(vehicle.scene),pack=closedAnimationPack(model,vehicle.animations),rig=new VehicleRig(model);
const scale=truck.length/R14.length,bounds=new T.Box3().setFromObject(model);model.scale.setScalar(scale);model.position.set(-R14.centreX*scale,-bounds.min.y*scale,-R14.centreZ*scale);
const root=new T.Group(),orient=new T.Group();orient.rotation.y=-Math.PI/2;orient.add(model);root.add(orient);applyTransform(root,truck);
const personRoot=makeObject(person),objects=new Map([[truck.id,root],[person.id,personRoot]]),entities=[truck,person];
const actors=new NathanActors(()=>{},async()=>asset);actors.sync(entities,objects);await new Promise(r=>setTimeout(r,0));const actor=actors.states.get(person.id)!.actor!;
const navigation=()=>new NathanNavigation(entities,.34,undefined,id=>objects.get(id),person.id);
for(const name of ['Tank_Railing_Raise','Platform_Gate_Open']){const a=pack.actions.get(name)!;a.time=a.getClip().duration;}pack.mixer.update(0);
for(const kind of ['rear','platform'] as const){
  const access=makeNathanAccess(truck,root,kind,navigation())!;assert.ok(access?.contacts);
  let grips=0,maxError=0;
  for(const down of [false,true])for(let i=0;i<=100;i++){
    const p=down?1-i/100:i/100,pose=stairPose(access.contacts!,p);person.position=pose.root;person.heading=access.heading;applyTransform(personRoot,person);
    actor.motion(kind==='rear'?'Climbing_Ladder':'Climbing',.7,down);actor.contact(pose.contact);actor.update(.05);
    const errors=actor.contactRig!.errors;maxError=Math.max(maxError,...errors);if(errors.length>2)grips++;
    assert.ok(errors.every(e=>e<.003),`${kind} ${p}: foot/hand contact error ${errors}`);
    for(let f=0;f<2;f++)assert.ok(actor.contactRig!.sole(f).distanceTo(new T.Vector3(...pose.contact.feet[f]))<.003);
  }
  assert.ok(grips>20,`${kind}: reachable hands actually contact the modeled rails (${grips} frames)`);
  console.log(`PASS ${kind}: 202 ascent/descent poses; contact error ${maxError.toFixed(7)} m; hand contacts in ${grips} frames`);
}
actor.contact();
const driverAccess=makeNathanAccess(truck,root,'driver',navigation())!;assert.ok(driverAccess);
for(let i=0;i<=100;i++){
  const pose=driverPose(driverAccess,i/100);person.position=pose.root;person.heading=pose.heading;applyTransform(personRoot,person);actor.motion(i>80?'Driving':'Climbing');actor.contact(pose.contact);actor.update(.05);
  assert.ok(actor.contactRig!.errors.every(e=>e<.035),`Driver contact ${i}: ${actor.contactRig!.errors}`);
  const head=actor.model.getObjectByName('rp_nathan_animated_003_walking_head')!.getWorldPosition(new T.Vector3()),native=model.worldToLocal(head);
  if(native.z<.335)assert.ok(native.y<.035,'Head clears the real cab roof during boarding');
}
actor.contact();console.log('PASS 101 boarding poses: doorway crouch, foot/hand reach and cab head clearance');
// The shell, glass, trim and interior lining all leave the same real doorway.
const rayDoor=()=>{model.updateWorldMatrix(true,true);const p=model.localToWorld(new T.Vector3(-.711,-.17,.32)),d=new T.Vector3(0,0,1).transformDirection(model.matrixWorld);return new T.Raycaster(p,d,0,.14*scale).intersectObject(root,true).filter(h=>/DOOR|Shell/.test(h.object.name));};
assert.ok(rayDoor().length>0,'Closed leaf blocks the cab aperture');rig.cab.setDoor('left',true);for(let i=0;i<20;i++)rig.cab.updateDoors(.05);
assert.equal(rig.cab.doorsClosed,false);assert.equal(rayDoor().length,0,'Opened actual door leaves a clear boarding aperture');
rig.cab.setDoor('left',false);for(let i=0;i<20;i++)rig.cab.updateDoors(.05);assert.ok(rayDoor().length>0);assert.equal(rig.cab.doorsClosed,true);
console.log('PASS actual cab door shell, glazing and interior open/close together');

const light=new VehicleLighting(model,new T.Scene()),indicators:T.Mesh[]=[];model.traverse(n=>{if(n instanceof T.Mesh&&/^Amber_Indicator(?:_|$)/.test(n.name))indicators.push(n);});
assert.equal(indicators.length,2);for(const mesh of indicators)assert.ok(new T.Box3().setFromObject(mesh).getSize(new T.Vector3()).y>.09,'Front amber lens has a visible face');
for(const mesh of indicators){
  const centre=new T.Box3().setFromObject(mesh).getCenter(new T.Vector3()),direction=new T.Vector3(-1,0,0).transformDirection(model.matrixWorld);
  const hit=new T.Raycaster(centre.clone().addScaledVector(direction,.8),direction.negate(),0,1).intersectObject(root,true).find(h=>!((h.object as T.Mesh).material as T.Material).transparent);
  assert.equal(hit?.object,mesh,'Front signal face is visible, not covered by the cab shell');
}
const intensity=(m:T.Mesh)=>(m.material as T.MeshStandardMaterial).emissiveIntensity;
light.update(true,false,0,'left');assert.equal(indicators.filter(m=>intensity(m)>0).length,1);light.update(true,false,0,'right');assert.equal(indicators.filter(m=>intensity(m)>0).length,1);
light.update(false,true,0,'hazard');assert.ok(indicators.every(m=>intensity(m)>0));light.update(false,true,500,'hazard');assert.ok(indicators.every(m=>intensity(m)===0));light.dispose();
console.log('PASS two visible front indicators: left, right, hazards and blink-off');

for(const a of pack.actions.values()){a.time=0;a.paused=true;}pack.open.clear();pack.mixer.update(0);
let running=false,drive=false;const notices:string[]=[];
const workspace:any={mixers:new Map([[truck.id,pack]]),vehicleRigs:new Map([[truck.id,rig]]),nathanLiftRequests:new Set(),history:{current:{entities}},driving:{motion:{speed:0}},say:(s:string)=>s,notify:(s:string)=>notices.push(s),updateAnimationButtons:()=>{}};
workspace.animateFor=(...args:any[])=>(Workspace.prototype as any).animateFor.apply(workspace,args);
const control=new NathanController(actors,{entities:()=>entities,object:id=>objects.get(id),gateAmount:()=>0,speed:()=>0,
  prepare:(id,kind)=>(Workspace.prototype as any).prepareNathanAccess.call(workspace,id,kind),
  checkpoint:()=>{},changed:()=>control.sync(),ui:()=>{},input:()=>{},notify:s=>notices.push(s),
  operate:id=>{const e=entities.find(e=>e.id===id)!;e.facility={...e.facility,open:!e.facility?.open};},
  platform:id=>workspace.animateFor(id,'Platform_Raise_4s'),driver:(_id,on)=>{drive=on;running=on;},door:(_id,on)=>rig.cab.setDoor('left',on)});workspace.nathanControl=control;
const tick=(n:number,check?:()=>void)=>{for(let i=0;i<Math.ceil(n/.05);i++){
  pack.mixer.update(.05);rig.cab.updateDoors(.05);
  for(const id of workspace.nathanLiftRequests){if(pack.actions.get('Platform_Gate_Open')!.time<=.02){workspace.nathanLiftRequests.delete(id);workspace.animateFor(id,'Platform_Raise_4s',true);}}
  control.tick(.05);if(i%4===0||i===Math.ceil(n/.05)-1)actor.update(.05);check?.();
}};
let access=makeNathanAccess(truck,root,'platform',navigation())!;person.position=[access.points[0][0]-1,0,access.points[0][2]];applyTransform(personRoot,person);control.open(person);assert.ok(control.climb(truck.id,'platform'));tick(45);
assert.equal(control.phase,'standing',notices.at(-1));assert.equal(person.nathan?.support?.anchor,'Platform_Grey_Floor');
const floor=root.getObjectByName('Platform_Grey_Floor')!,local=floor.worldToLocal(new T.Vector3(...person.position));
control.togglePlatform();tick(7,()=>{assert.ok(floor.worldToLocal(new T.Vector3(...person.position)).distanceTo(local)<.0001,'Operator follows animated floor without drift');});
assert.ok(pack.actions.get('Platform_Raise_4s')!.time>3.9);assert.equal(pack.actions.get('Platform_Gate_Open')!.time,0,'Occupied lift closes its gate first');
const saved=validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',groups:[],entities,source:'test'});assert.equal(saved.entities.find(e=>e.id===person.id)!.nathan!.support!.anchor,'Platform_Grey_Floor');
assert.ok(control.descend());tick(55);assert.equal(control.phase,'idle',notices.at(-1));assert.equal(person.nathan?.support,undefined);assert.equal(person.position[1],0);
console.log('PASS board platform → close gate → raise with occupant → lower → open gate → descend');

for(const a of pack.actions.values()){a.time=0;a.paused=true;}pack.open.clear();pack.mixer.update(0);
access=makeNathanAccess(truck,root,'driver',navigation())!;assert.ok(access);person.position=[access.points[0][0]-1,0,access.points[0][2]];applyTransform(personRoot,person);control.open(person);assert.ok(control.climb(truck.id,'driver'));tick(45);
assert.equal(control.seated,true,notices.at(-1));assert.equal(running,true);assert.equal(drive,true);assert.equal(rig.cab.doorsClosed,true);assert.equal(control.blocksVehicle(truck.id),false);
const final=driverPose(makeNathanAccess(truck,root,'driver',navigation())!,1);assert.ok(actor.contactRig!.errors.every(e=>e<.035),`Seated limbs: ${actor.contactRig!.errors}`);assert.ok(personRoot.position.distanceTo(new T.Vector3(...final.root))<.001);
const seatedLocal=rig.cab.seat.worldToLocal(new T.Vector3(...person.position));truck.position[0]+=7;truck.heading=38;applyTransform(root,truck);tick(.2);assert.ok(rig.cab.seat.worldToLocal(new T.Vector3(...person.position)).distanceTo(seatedLocal)<.001);
assert.ok(control.descend());tick(45);assert.equal(control.phase,'idle',notices.at(-1));assert.equal(running,false);assert.equal(rig.cab.doorsClosed,true);assert.equal(person.position[1],0);
console.log('PASS walk to driver door → open → board → sit → start engine → close door → move with cab → exit');

const gate=newEntity('PEDESTRIAN_GATE',0,0);const closed=new NathanNavigation([gate]),opened=new NathanNavigation([{...gate,facility:{...gate.facility,open:true}}]);
assert.equal(closed.clear([0,0,-1],[0,0,1]),false);assert.equal(opened.clear([0,0,-1],[0,0,1]),true);assert.equal(opened.blocked([-.55,0,-.5]),true,'Open leaf still obstructs its sweep side');
console.log('PASS emergency gate changes the traversable opening, retaining posts and swung leaf');
gate.position=[20,0,15];entities.push(gate);objects.set(gate.id,makeObject(gate));person.position=[20,0,12];applyTransform(personRoot,person);control.open(person);
assert.ok(control.operateGate(gate.id));tick(15);assert.equal(gate.facility?.open,true,'Operator approaches and operates the panic gate');
assert.ok(control.walkTo([20,0,17]));tick(20);assert.equal(control.phase,'idle');assert.ok(Math.abs(person.position[2]-17)<.03);
console.log('PASS Nathan approaches emergency gate, opens it and walks through');

const canvas=document.querySelector('canvas')!,camera=new T.PerspectiveCamera(42,1,.1,10000);canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
let locked=false;const view=new NathanCamera(camera,canvas,()=>({entity:person,actor}),on=>locked=on);view.set('eyes');assert.equal(locked,true);assert.ok(camera.position.distanceTo(actor.eyePoint())<1e-8);
const start=camera.quaternion.clone();const pointer=(type:string,x:number,y:number)=>{const e=new dom.window.MouseEvent(type,{clientX:x,clientY:y,cancelable:true});Object.defineProperty(e,'pointerId',{value:1});canvas.dispatchEvent(e);};
pointer('pointerdown',100,100);pointer('pointermove',160,125);pointer('pointerup',160,125);view.update();assert.ok(!camera.quaternion.equals(start));
for(const mode of ['rear','front','top'] as const){view.set(mode);assert.ok(camera.position.toArray().every(Number.isFinite));}
view.set('free');assert.equal(locked,false);assert.equal(camera.near,.1);assert.equal(camera.fov,42);assert.deepEqual(camera.up.toArray(),[0,1,0]);
console.log('PASS operator eye/rear/front/top views and restored free-camera projection');
// Exercise the real Workspace keyboard binding, including repeat/modifier/text guards.
const host=document.createElement('div');host.innerHTML='<select id="wsGround"></select><input id="wsSearch"><form id="wsProperties"></form><input id="wsImportFile">';document.body.append(host);
const keys:string[]=[],ws:any=Object.create(Workspace.prototype),keyboardControl:any={active:true,capturing:true,seated:false,view:'free',setView(v:string){this.view=v;},pause(){},setMode(){}};
Object.assign(ws,{root:host,active:true,editing:false,freeMode:false,nathanControl:keyboardControl,$:(s:string)=>host.querySelector(s),bindPad(){},setMenu(){},driving:{key(k:string,down:boolean){if(down)keys.push(k);return k==='c';}},session:{dirty:()=>false},history:{current:{}}});ws.bind();
const key=(k:string,options:any={},target:HTMLElement=document.body)=>target.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true,...options}));
key('v');assert.equal(keyboardControl.view,'eyes');key('v',{repeat:true});assert.equal(keyboardControl.view,'eyes');key('c');assert.ok(keys.includes('c'));assert.equal(keyboardControl.view,'eyes');key('v');assert.equal(keyboardControl.view,'free');
key('v',{ctrlKey:true});assert.equal(keyboardControl.view,'free');key('v',{},host.querySelector('input')!);assert.equal(keyboardControl.view,'free');
key('w');assert.ok(!keys.includes('w'),'On-foot control does not leak to driving');keyboardControl.seated=true;key('w');assert.ok(keys.includes('w'),'Seated operator forwards driving input');ws.active=false;
console.log('PASS V operator view, C vehicle cabin, repeat/modifier/text guards and driving handoff');
actor.dispose();rig.dispose();
