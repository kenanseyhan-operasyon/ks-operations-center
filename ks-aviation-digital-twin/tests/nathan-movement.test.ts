import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import { JSDOM } from 'jsdom';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { newEntity, validateScene, type Entity } from '../src/scene-data';
import { NATHAN_PRESET, NATHAN_MODEL_URL } from '../src/nathan-data';
import { NathanActors } from '../src/nathan-model';
import { NathanController } from '../src/nathan-controller';
import { NathanPanel } from '../src/nathan-panel';
import { NathanNavigation } from '../src/nathan-navigation';
import { makeNathanAccess, nathanAccessKind, sampleAccess, type NathanAccessKind } from '../src/nathan-access';
import { bindNathanInput } from '../src/nathan-input';
import { applyTransform, makeObject } from '../src/objects';
import { closedAnimationPack } from '../src/model-animations';
import { VehicleRig } from '../src/vehicle-rig';
import { R14 } from '../src/r14-spec';
import type { V3 } from '../src/personnel-navigation';

const dom = new JSDOM('<!doctype html><body><div id="host"></div><canvas></canvas></body>', {url:'https://test.invalid', pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','HTMLButtonElement','HTMLInputElement','HTMLFormElement','FormData'])Object.defineProperty(globalThis,name,{value:(dom.window as any)[name],configurable:true});
dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
const readGLB = async (path: string, texture = false) => {
  const bytes=fs.readFileSync(path),loader=new GLTFLoader();
  if(texture)loader.register(()=>({name:'KS_HEADLESS_TEXTURE',loadTexture:async()=>new T.Texture()}));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
};
const [asset, vehicle] = await Promise.all([readGLB(`public${NATHAN_MODEL_URL}`,true),readGLB('public/models/refueller-38k-r14.glb')]);
const seed=validateScene(JSON.parse(fs.readFileSync('public/data/adb-test-seed.json','utf8')));
const truck=newEntity('R14',16,20);let person=newEntity(NATHAN_PRESET,12,30);truck.heading=0;
let entities:Entity[]=[person,truck];
const model=clone(vehicle.scene),pack=closedAnimationPack(model,vehicle.animations),rig=new VehicleRig(model),bounds=new T.Box3().setFromObject(model),scale=truck.length/R14.length;
model.scale.setScalar(scale);model.position.set(-R14.centreX*scale,-bounds.min.y*scale,-R14.centreZ*scale);
const orient=new T.Group();orient.rotation.y=-Math.PI/2;orient.add(model);const vehicleRoot=new T.Group();vehicleRoot.add(orient);vehicleRoot.userData.entityId=truck.id;applyTransform(vehicleRoot,truck);
const personRoot=makeObject(person),objects=new Map([[person.id,personRoot],[truck.id,vehicleRoot]]);
const actors=new NathanActors(()=>{},async()=>asset);actors.sync(entities,objects);await new Promise(r=>setTimeout(r,0));const actor=actors.states.get(person.id)!.actor!;assert.ok(actor);
const bone=(suffix:string)=>actor.model.getObjectByName(`rp_nathan_animated_003_walking_${suffix}`)!.getWorldPosition(new T.Vector3());
const toe=bone('ball_l').sub(bone('foot_l'));assert.ok(toe.z<0,'Actual foot/toe points along heading zero (-Z)');
let checkpoints=0,commits=0,input=false,vehicleSpeed=0,gate=0,accessReady=true;const notices:string[]=[];
const control=new NathanController(actors,{
  entities:()=>entities,object:id=>objects.get(id),gateAmount:()=>gate,speed:()=>vehicleSpeed,
  prepare:(_id,kind)=>{if(!accessReady)return false;const action=pack.actions.get(kind==='rear'?'Tank_Railing_Raise':'Platform_Gate_Open');if(action){action.time=action.getClip().duration;pack.mixer.update(0);}return true;},
  checkpoint:()=>checkpoints++,changed:()=>{commits++;control.sync();},input:on=>{input=on;},ui:()=>{},notify:text=>notices.push(text)
});
const nav=()=>new NathanNavigation(entities,.34,()=>gate,id=>objects.get(id),person.id);
const tick=(seconds:number,check?:()=>void)=>{for(let t=0;t<seconds;t+=.05){control.tick(.05);if(Math.round(t*20)%4===0)actor.update(.05);check?.();}};
const soles=()=>{const box=new T.Box3().setFromObject(personRoot,true);assert.ok(Math.abs(box.min.y-person.position[1]-.005*person.scale)<.0002,`Feet stay above supporting surface: ${box.min.y} / ${person.position[1]}`);};
control.open(person);assert.equal(input,true);
const start=[...person.position];assert.ok(control.walkTo([12,0,22]));tick(1);assert.notDeepEqual(person.position,start);assert.equal(actor.clips[actor.index].name,'Nathan_Original_Walk');
const previousHeading=person.heading;assert.ok(control.walkTo([8,0,32]));control.tick(.05);assert.ok(Math.abs(((person.heading-previousHeading+540)%360)-180)<8,'Heading turns at a bounded rate on retarget');
tick(25,()=>{assert.equal(nav().blocked(person.position),false);});assert.ok(Math.hypot(person.position[0]-8,person.position[2]-32)<.03);assert.equal(control.phase,'idle');assert.equal(actor.clips[actor.index].name,'Idle');soles();
assert.ok(checkpoints&&commits);console.log('PASS walk, retarget, bounded turning, arrival Idle and actual skinned feet');

const building=newEntity('BUILDING',0,0);building.width=4;building.length=5;building.heading=32;
const wall=newEntity('WALL',0,0);wall.points=[[0,-100],[0,100]];
let navigation=new NathanNavigation([building]);const detour=navigation.path([-6,0,0],[6,0,0]);assert.ok(detour&&detour.length>1);let previous:V3=[-6,0,0];for(const p of detour!){assert.ok(navigation.clear(previous,p));previous=p;}
assert.equal(new NathanNavigation([wall]).path([-2,0,0],[2,0,0]),undefined);
const gateEntity=newEntity('MAIN_GATE',0,0);gateEntity.points=[[0,-100],[0,100]];
assert.equal(new NathanNavigation([gateEntity],.34,()=>0).path([-2,0,0],[2,0,0]),undefined);
assert.ok(new NathanNavigation([gateEntity],.34,()=>1).path([-2,0,0],[2,0,0]));
const equipment=newEntity('MANIFOLD',0,0);assert.ok(new NathanNavigation([equipment]).blocked([0,0,0]));
assert.equal(new NathanNavigation([]).path([0,0,0],[121,0,0]),undefined);
console.log('PASS A* rotated obstacles, walls, equipment, closed/open gates, bounded routes');

for(const kind of ['rear','platform'] as NathanAccessKind[]){
  const access=makeNathanAccess(truck,vehicleRoot,kind,nav());assert.ok(access,kind);
  assert.equal(nav().blocked(access!.points[0]),false,'Entrance is outside the vehicle clearance');
  const top=access!.points.at(-1)!;assert.ok(top[1]>1.5);if(kind==='rear')assert.ok(top[2]>truck.position[2]+5,'Roof landing is beside the rear ladder, not roof centre');
  person.position=[access!.points[0][0]-2,0,access!.points[0][2]+2];applyTransform(personRoot,person);control.open(person);
  assert.ok(control.climb(truck.id,kind),notices.at(-1));assert.equal(control.blocksVehicle(truck.id),true);
  tick(7);assert.ok(['climbing','aligning','preparing','walking'].includes(control.phase),control.phase);
  tick(35);assert.equal(control.phase,'standing',notices.at(-1));assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...top))<.03);soles();
  assert.equal(person.nathan?.support?.kind,kind);assert.equal(control.blocksVehicle(truck.id),true);
  assert.equal(control.walkTo([8,0,30]),false,'Never walk off a platform into empty air');
  const saved=validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',groups:[],entities,source:'test'});assert.deepEqual(saved.entities[0].nathan?.support,person.nathan?.support);
  person=saved.entities.find(e=>e.id===person.id)!;entities=entities.map(e=>e.id===person.id?person:e);actors.sync(entities,objects);control.sync();
  const beforeMove=person.position[0];truck.position[0]+=2;applyTransform(vehicleRoot,truck);control.sync();assert.ok(Math.abs(person.position[0]-beforeMove-2)<.001,'Saved local support follows a moved vehicle');truck.position[0]-=2;applyTransform(vehicleRoot,truck);control.sync();
  control.close();const standing=[...person.position];tick(1);assert.deepEqual(person.position,standing,'Closing/scene switch preserves elevated position');control.open(person);
  accessReady=false;assert.ok(control.descend());const waitPosition=[...person.position];tick(1);assert.equal(control.phase,'preparing');assert.deepEqual(person.position,waitPosition,'Descent waits for the reopened gate after reload');accessReady=true;tick(1);assert.ok(actor.actions[actor.index].getEffectiveTimeScale()<0,'Descent reverses the real clip');
  control.pause();const paused=[...person.position];tick(1);assert.deepEqual(person.position,paused,'Pause on ladder retains height');
  assert.ok(control.descend());tick(40);assert.equal(control.phase,'idle');assert.equal(person.nathan?.support,undefined);assert.equal(control.blocksVehicle(truck.id),false);soles();
  console.log(`PASS actual R14 ${kind} entrance → align → climb → landing → persist → pause → reversed descent → ground`);
}

truck.heading=47;truck.scale=1.2;truck.trailerAngle=.22;applyTransform(vehicleRoot,truck);rig.setArticulation(truck.trailerAngle);
for(const kind of ['rear','platform'] as NathanAccessKind[]){const a=makeNathanAccess(truck,vehicleRoot,kind,nav());assert.ok(a,`Rotated scaled articulated ${kind}`);assert.ok(a!.points.every(p=>p.every(Number.isFinite)));assert.deepEqual(sampleAccess(a!,1),a!.points.at(-1));}
truck.heading=0;truck.scale=1;truck.trailerAngle=0;applyTransform(vehicleRoot,truck);rig.setArticulation(0);
const lift=pack.actions.get('Platform_Raise_4s')!;lift.time=lift.getClip().duration;pack.mixer.update(0);assert.equal(makeNathanAccess(truck,vehicleRoot,'platform',nav()),undefined,'Raised platform with an unsafe gap is rejected');lift.time=0;pack.mixer.update(0);
let picked:T.Object3D|undefined;vehicleRoot.traverse(n=>{if(n.name.startsWith('Rear_Ladder_Close_Step'))picked=n;});assert.equal(nathanAccessKind(picked!,truck),'rear');
vehicleSpeed=1;assert.equal(control.climb(truck.id,'rear'),false);vehicleSpeed=0;
console.log('PASS rotated/scaled/articulated access, actual mesh picking, moving vehicle and raised basket rejection');

// The real ADB snapshot, plus exactly one Nathan and one mobile stair.
const stair=newEntity('MOBILE_STAIR',0,0),seedNav=new NathanNavigation(seed.entities);let free:V3|undefined;
// Find an unobstructed apron patch near the facility. Do not edit the shipped seed.
outer:for(let x=-90;x<=90;x+=5)for(let z=-90;z<=90;z+=5){if([[x,z],[x-3,z-5],[x,z-5],[x,z+4]].every(([a,b])=>!seedNav.blocked([a,0,b]))){free=[x,0,z];break outer;}}
assert.ok(free);stair.position=[...free!];person.position=[free![0]-3,0,free![2]-6];applyTransform(personRoot,person);objects.set(stair.id,makeObject(stair));entities=[...seed.entities,person,stair];
control.open(person);assert.ok(control.climb(stair.id,'steps'),notices.at(-1));tick(50);assert.equal(control.phase,'standing',notices.at(-1));assert.ok(Math.abs(person.position[1]-stair.height)<.02);soles();assert.ok(control.descend());tick(50);assert.equal(control.phase,'idle');assert.equal(person.position[1],0);soles();
console.log(`PASS ADB ${seed.entities.length} existing objects + one Nathan + one stair: ascent and descent at ${free}`);

// Existing facility refueller in the unchanged, crowded ADB scene (no relocated obstacles).
const facilityTruck=seed.entities.find(e=>e.preset==='R14')!;
Object.assign(truck,structuredClone(facilityTruck));objects.set(truck.id,vehicleRoot);vehicleRoot.userData.entityId=truck.id;applyTransform(vehicleRoot,truck);
entities=[...seed.entities.filter(e=>e.id!==truck.id),truck,person];
for(const kind of ['rear','platform'] as NathanAccessKind[]){
  const access=makeNathanAccess(truck,vehicleRoot,kind,nav());assert.ok(access,`ADB existing refueller ${kind} corridor`);
  const entry=access!.points[0];let start:V3|undefined;
  for(const [dx,dz] of [[-2,0],[2,0],[0,-2],[0,2]]){const p:V3=[entry[0]+dx,0,entry[2]+dz];if(nav().path(p,entry)){start=p;break;}}
  assert.ok(start,'Reachable starting position beside existing facility vehicle');person.position=start!;applyTransform(personRoot,person);control.open(person);
  assert.ok(control.climb(truck.id,kind),notices.at(-1));tick(50);assert.equal(control.phase,'standing',notices.at(-1));soles();
  assert.ok(control.descend());tick(50);assert.equal(control.phase,'idle');soles();
  console.log(`PASS existing ADB facility refueller ${kind}: ${entry.map(n=>n.toFixed(2))} approach, climb, landing and descent`);
}

// Dynamic blocker closes a route after planning: stop/replan instead of tunnelling.
entities=[person];person.position=[0,0,0];control.open(person);assert.ok(control.walkTo([6,0,0]));tick(1);const fence=newEntity('WALL',3,0);fence.points=[[0,-100],[0,100]];entities.push(fence);tick(10,()=>assert.ok(person.position[0]<2.6));assert.equal(control.phase,'idle');
const removed=person.id;entities=[];control.sync();assert.equal(control.active,false);assert.equal(input,false);entities=[person];objects.set(removed,personRoot);
person.nathan!.support={targetId:truck.id,kind:'rear',progress:1};person.position[1]=2.8;control.sync();assert.equal(person.position[1],0);assert.equal(person.nathan?.support,undefined,'Deleted support returns Nathan to ground even when the management panel is closed');
console.log('PASS dynamic obstacle, selected entity removal and deleted support recovery');

// DOM-level mouse/touch propagation tests; no GPU/browser is simulated here.
const canvas=document.querySelector('canvas')!;let managed=true,taps=0,cameraEvents=0;
const detach=bindNathanInput(canvas,()=>managed,()=>taps++);canvas.addEventListener('pointerup',()=>cameraEvents++);
const pointer=(type:string,id:number,x:number,y:number,touch=false)=>{const e=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0});Object.defineProperties(e,{pointerId:{value:id},pointerType:{value:touch?'touch':'mouse'}});canvas.dispatchEvent(e);};
pointer('pointerdown',1,10,10);pointer('pointerup',1,10,10);assert.equal(taps,1);assert.equal(cameraEvents,0);
pointer('pointerdown',2,20,20,true);pointer('pointerup',2,20,20,true);assert.equal(taps,2);
pointer('pointerdown',3,10,10,true);pointer('pointermove',3,30,10,true);pointer('pointerup',3,30,10,true);assert.equal(taps,2,'Dragging does not issue a walking target');
pointer('pointerdown',4,10,10,true);pointer('pointerdown',5,40,40,true);pointer('pointerup',4,10,10,true);pointer('pointerup',5,40,40,true);assert.equal(taps,2,'Two fingers never issue a target');
pointer('pointerdown',6,10,10,true);pointer('pointercancel',6,10,10,true);assert.equal(taps,2);
managed=false;pointer('pointerdown',7,10,10,true);pointer('pointerup',7,10,10,true);assert.equal(cameraEvents,1,'Camera mode preserves original listeners');detach();
const panel=new NathanPanel(document.querySelector('#host')!,actors,{entity:()=>person,configure:()=>{},edit:()=>{},ready:()=>true},control);
control.open(person);panel.open(person);assert.equal(panel.element.querySelectorAll('option').length,21);assert.ok(panel.element.textContent!.includes('Personeli Yönet'));
panel.element.querySelector<HTMLButtonElement>('[data-nathan="camera"]')!.click();assert.equal(control.mode,'camera');panel.element.querySelector<HTMLButtonElement>('[data-nathan="person"]')!.click();assert.equal(control.mode,'person');
const select=panel.element.querySelector<HTMLSelectElement>('[data-nathan-clips]')!;select.value='9';select.dispatchEvent(new dom.window.Event('change'));assert.equal(actor.index,9);assert.equal(control.mode,'camera');panel.element.querySelector<HTMLButtonElement>('[data-nathan="play"]')!.click();assert.equal(actor.index,9,'Preview Play retains chosen clip');assert.equal(actor.playing,true);
panel.element.querySelector<HTMLButtonElement>('[data-nathan="close"]')!.click();assert.equal(control.active,false);assert.equal(panel.element.hidden,true);
console.log('PASS mouse, touch, drag, multitouch, cancel, camera handoff and panel/preview modes');
console.log('All Nathan movement tests passed. Real browser/GPU rendering is not covered by this test.');
