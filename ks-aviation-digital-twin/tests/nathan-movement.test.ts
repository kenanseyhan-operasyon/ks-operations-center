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
import { bindNathanInput, isNathanInputEvent } from '../src/nathan-input';
import { planNathanRoute } from '../src/nathan-route';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { configureWorkspaceOrbit } from '../src/camera-navigation';
import { bridgeRailingOpenings, localToWorld } from '../src/facility-data';
import { bridgeTanks, makeRoofBridge, planRoofRoute, roofHeight, tankRoofPoint } from '../src/nathan-roof';
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
  const top=access!.points.at(-1)!;
  const floor=vehicleRoot.getObjectByName(kind==='rear'?'Tank_Top_Walkway':'Platform_Grey_Floor')!;
  assert.ok(Math.abs(top[1]-new T.Box3().setFromObject(floor,true).max.y-.012*truck.scale)<.001,'Landing follows the actual floor, including the lowered platform');
  if(kind==='rear')assert.ok(top[2]>truck.position[2]+5,'Roof landing is beside the rear ladder, not roof centre');
  person.position=[access!.points[0][0]-2,0,access!.points[0][2]+2];applyTransform(personRoot,person);control.open(person);
  assert.ok(control.climb(truck.id,kind),notices.at(-1));assert.equal(control.blocksVehicle(truck.id),true);
  tick(7);assert.ok(['climbing','aligning','preparing','walking'].includes(control.phase),control.phase);
  tick(35);assert.equal(control.phase,'standing',notices.at(-1));assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...top))<.03,`Landing ${kind}: actual ${person.position}, expected ${top}`);soles();
  assert.equal(person.nathan?.support?.kind,kind);assert.equal(control.blocksVehicle(truck.id),true);
  // Ground clicks now queue the real descent; the full interaction suite covers it.
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
const originalSeed = JSON.stringify(seed);
const crossover = seed.entities.find(e => e.preset === 'CROSSOVER_STAIR')!;
objects.set(crossover.id, makeObject(crossover)); entities = [...seed.entities, person];
const crossing = makeNathanAccess(crossover, objects.get(crossover.id), 'steps', nav(), -1)!;
assert.ok(crossing, 'The screenshot stair over the actual 2.2 m ADB bund is usable');
assert.equal(makeNathanAccess(crossover,objects.get(crossover.id),'steps',new NathanNavigation(entities,.6,undefined,undefined,person.id),-1),undefined,'A scaled-up person must fit between the stair rails');
const entry = crossing.points[0], exit = crossing.points.at(-1)!;
const outward = new T.Vector3(...entry).sub(new T.Vector3(...exit)).normalize();
const outside = new T.Vector3(...entry).addScaledVector(outward, 1.5).toArray() as V3;
const inside: V3 = [-15, 0, -23];
assert.equal(nav().path(outside, inside), undefined, 'The containment wall remains impassable on ground');
assert.ok(planNathanRoute(outside, inside, nav(), entities, id => objects.get(id))?.some(leg => leg.access?.crossingSide));
person.position = [...outside]; applyTransform(personRoot, person); control.open(person);
let highest = 0;
const checkCrossing = () => {
  highest = Math.max(highest, person.position[1]);
  assert.equal(nav().blocked(person.position, person.nathan?.support?.targetId), false, 'Full body clears the real wall throughout the crossing');
};
assert.ok(control.walkTo(inside), notices.at(-1)); tick(55, checkCrossing);
assert.equal(control.phase, 'idle', notices.at(-1)); assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...inside)) < .03);
assert.ok(highest > 2.4); assert.equal(person.nathan?.support, undefined); soles();
assert.ok(control.walkTo(outside)); tick(55, checkCrossing); assert.equal(control.phase, 'idle');
assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...outside)) < .03); soles();
console.log('PASS actual ADB tank yard: exterior → crossover over intact wall → interior target → return outside');

// Clicking the stair chooses the reachable end; pause/reload retains which end.
assert.ok(control.climb(crossover.id, 'steps')); tick(6);
assert.ok(person.nathan?.support?.crossingSide); control.pause();
const crossingPosition = [...person.position], savedSide = person.nathan!.support!.crossingSide;
const reloaded = validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',groups:[],entities,source:'test'});
person = reloaded.entities.find(e => e.id === person.id)!; entities = [...seed.entities, person]; actors.sync(entities, objects); control.sync();
control.close(); control.open(person); assert.equal(person.nathan?.support?.crossingSide, savedSide);
assert.deepEqual(person.position, crossingPosition); control.resume(); tick(35, checkCrossing);
assert.equal(control.phase, 'idle'); assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...exit)) < .03);
assert.ok(control.climb(crossover.id, 'steps')); tick(5); assert.equal(person.nathan?.support?.crossingSide, 1);
assert.ok(control.descend()); tick(35); assert.equal(control.phase, 'idle');
assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...exit)) < .03, 'Return-to-entry descends to the same side');
assert.ok(control.walkTo(outside)); tick(5); const midStair = [...person.position];
assert.ok(control.walkTo(inside)); assert.deepEqual(person.position, midStair, 'Retarget on stairs never teleports to ground');
tick(55, checkCrossing); assert.equal(control.phase, 'idle');
assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...inside)) < .03);
const noStair = entities.filter(e => e.id !== crossover.id), closedNav = new NathanNavigation(noStair, .34, undefined, undefined, person.id);
assert.equal(planNathanRoute(outside, inside, closedNav, noStair, () => undefined), undefined, 'Removing the link never permits walking through the wall');
const obstruction = newEntity('BUILDING', crossover.position[0], crossover.position[2]); obstruction.position[1] = crossover.height + .8; obstruction.height = .4; obstruction.width = obstruction.length = 2;
assert.equal(makeNathanAccess(crossover, objects.get(crossover.id), 'steps', new NathanNavigation([...entities, obstruction], .34, undefined, undefined, person.id), -1), undefined, 'Insufficient headroom blocks the crossing');
obstruction.position = [...exit]; obstruction.height = 2;
assert.equal(makeNathanAccess(crossover, objects.get(crossover.id), 'steps', new NathanNavigation([...entities, obstruction], .34, undefined, undefined, person.id), -1), undefined, 'A blocked exit cannot be skipped by extending the access path');
assert.equal(JSON.stringify(seed), originalSeed, 'The 178-object facility snapshot is unchanged');
console.log('PASS crossover direction, pause/save/reload/resume, return-to-entry, queued retarget, missing stairs and blocked access');

// Actual ADB tank spiral stairs, roof hatch, bridge and the second tank's stairs.
const tankA=seed.entities.find(e=>e.name==='T1')!,tankB=seed.entities.find(e=>e.name==='T2')!;
const tankBridge=seed.entities.find(e=>e.preset==='TANK_BRIDGE')!;
for(const tank of [tankA,tankB])objects.set(tank.id,makeObject(tank,bridgeRailingOpenings(tank,seed.entities)));
objects.set(tankBridge.id,makeObject(tankBridge));
person.position=[...outside];delete person.nathan!.support;applyTransform(personRoot,person);control.open(person);
const tankNav=nav();let usedBund=false,usedTankStairs=false;
const checkTankBody=()=>{
  const support=person.nathan?.support;
  if(support?.crossingSide)usedBund=true;if(support?.kind==='tank'&&support.progress<1)usedTankStairs=true;
  const except=support?.kind==='tank'&&support.progress===1?[support.targetId,tankBridge.id]:support?.targetId;
  assert.equal(tankNav.blocked(person.position,except),false,'Tank route clears other objects and the central roof hatch');
};
const until=(condition:()=>boolean,seconds:number,check=()=>{})=>{
  for(let i=0;i<seconds*20&&!condition();i++){control.tick(.05);if(i%4===0)actor.update(.05);check();}
  assert.ok(condition(),`Timed out: ${control.phase}, ${control.message}, ${JSON.stringify(person.position)}`);
};
assert.ok(control.tankTo(tankA.id),notices.at(-1));
until(()=>person.nathan?.support?.kind==='tank'&&(person.nathan.support.progress||0)>.25,110,checkTankBody);
control.pause();const spiralPosition=[...person.position];
let savedTank=validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',groups:[],entities,source:'test'});
person=savedTank.entities.find(e=>e.id===person.id)!;entities=[...seed.entities,person];actors.sync(entities,objects);control.sync();control.close();control.open(person);
assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...spiralPosition))<1e-8);control.resume();
until(()=>control.phase==='standing',90,checkTankBody);assert.equal(person.nathan?.support?.targetId,tankA.id);assert.equal(person.nathan?.support?.kind,'tank');
assert.ok(Math.abs(person.position[1]-roofHeight(tankA))<.01);assert.ok(usedBund&&usedTankStairs);soles();
const acrossRoof=localToWorld(tankA,[0,tankA.height+.282,tankA.radius-.7]);
assert.ok(control.tankTo(tankA.id,acrossRoof));until(()=>control.phase==='standing',35,checkTankBody);
assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...acrossRoof))<.03);
assert.equal(control.tankTo(tankA.id,localToWorld(tankA,[tankA.radius-.1,tankA.height+.282,0])),false,'Never walk through the roof railing or off the roof');
console.log('PASS exterior → bund crossover → actual T1 curved stairs → pause/save/reload/resume → roof; roof walking avoids hatch and railing');

assert.ok(control.crossBridge(tankBridge.id));until(()=>person.nathan?.support?.kind==='bridge'&&(person.nathan.support.progress||0)>.3,50,checkTankBody);
control.pause();const bridgePosition=[...person.position];
savedTank=validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',groups:[],entities,source:'test'});
person=savedTank.entities.find(e=>e.id===person.id)!;entities=[...seed.entities,person];actors.sync(entities,objects);control.sync();control.close();control.open(person);
assert.equal(person.nathan?.support?.fromTankId,tankA.id);assert.equal(person.nathan?.support?.toTankId,tankB.id);
assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...bridgePosition))<1e-8);control.resume();
until(()=>control.phase==='standing',50,checkTankBody);assert.equal(person.nathan?.support?.targetId,tankB.id);soles();
assert.ok(control.tankTo(tankA.id));until(()=>control.phase==='standing',60,checkTankBody);assert.equal(person.nathan?.support?.targetId,tankA.id);
assert.ok(control.walkTo(outside));until(()=>control.phase==='idle',180,checkTankBody);assert.equal(person.nathan?.support,undefined);
assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...outside))<.03);soles();
console.log('PASS T1 roof → real bridge → pause/save/reload/resume → T2 roof → bridge back → tank stairs → ground → outside bund');

assert.ok(control.crossBridge(tankBridge.id));until(()=>control.phase==='standing',180,checkTankBody);
assert.ok([tankA.id,tankB.id].includes(person.nathan!.support!.targetId),'Ground bridge command climbs a connected tank first');
const currentTank=person.nathan!.support!.targetId;
assert.ok(control.crossBridge(tankBridge.id));until(()=>person.nathan?.support?.kind==='bridge'&&(person.nathan.support.progress||0)>.2,50,checkTankBody);
const blocker=newEntity('BUILDING',tankBridge.position[0],tankBridge.position[2]);blocker.position[1]=roofHeight(tankA);blocker.width=1;blocker.length=1;blocker.height=2;
entities.push(blocker);tick(1);assert.equal(control.phase,'paused');assert.equal(person.nathan?.support?.kind,'bridge');
entities=entities.filter(e=>e.id!==blocker.id);assert.ok(control.descend());until(()=>control.phase==='idle',130,checkTankBody);assert.equal(person.nathan?.support,undefined);
const current=seed.entities.find(e=>e.id===currentTank)!;const currentAccess=makeNathanAccess(current,objects.get(current.id),'tank',nav())!;
assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...currentAccess.points[0]))<.03,'Bridge return exits via the entry tank stairs');
const noBridge=entities.filter(e=>e.id!==tankBridge.id),withoutBridge=new NathanNavigation(noBridge,.34,undefined,undefined,person.id);
assert.equal(planRoofRoute(tankRoofPoint(tankA),tankA.id,tankRoofPoint(tankB),tankB.id,noBridge,withoutBridge,.34),undefined,'An unconnected tank cannot be reached across air');
const narrow=structuredClone(tankBridge);narrow.width=.6;assert.equal(makeRoofBridge(narrow,tankA.id,entities,nav(),.34),undefined);
assert.deepEqual(bridgeTanks(tankBridge,entities)?.map(t=>t.id),[tankB.id,tankA.id]);
assert.equal(JSON.stringify(seed),originalSeed,'Tank and bridge geometry/settings are unchanged');
console.log('PASS ground-to-bridge command, bridge obstruction/stop, return to tank stairs, missing bridge and insufficient width');

// Dynamic blocker closes a route after planning: stop/replan instead of tunnelling.
entities=[person];person.position=[0,0,0];control.open(person);assert.ok(control.walkTo([6,0,0]));tick(1);const fence=newEntity('WALL',3,0);fence.points=[[0,-100],[0,100]];entities.push(fence);tick(10,()=>assert.ok(person.position[0]<2.6));assert.equal(control.phase,'idle');
const removed=person.id;entities=[];control.sync();assert.equal(control.active,false);assert.equal(input,false);entities=[person];objects.set(removed,personRoot);
person.nathan!.support={targetId:truck.id,kind:'rear',progress:1};person.position[1]=2.8;control.sync();assert.equal(person.position[1],0);assert.equal(person.nathan?.support,undefined,'Deleted support returns Nathan to ground even when the management panel is closed');
console.log('PASS dynamic obstacle, selected entity removal and deleted support recovery');

// DOM-level mouse/touch propagation tests; no GPU/browser is simulated here.
const canvas=document.querySelector('canvas')!;let managed=true,taps=0,sceneClicks=0,cameraEvents=0;
Object.defineProperties(canvas,{clientWidth:{value:800},clientHeight:{value:600}});
canvas.getBoundingClientRect=()=>({left:0,top:0,width:800,height:600,right:800,bottom:600,x:0,y:0,toJSON(){}});
canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};
const detach=bindNathanInput(canvas,()=>managed,()=>taps++);
const camera=new T.PerspectiveCamera(45,800/600,.1,1000);camera.position.set(10,20,30);
const orbit=new OrbitControls(camera,canvas);configureWorkspaceOrbit(orbit);orbit.enableDamping=false;orbit.touches.ONE=T.TOUCH.PAN;orbit.update();
canvas.addEventListener('pointerup',e=>{cameraEvents++;if(!isNathanInputEvent(e)&&!managed)sceneClicks++;});
const pointer=(type:string,id:number,x:number,y:number,touch=false,button=0)=>{const e=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button});Object.defineProperties(e,{pointerId:{value:id},pointerType:{value:touch?'touch':'mouse'}});canvas.dispatchEvent(e);};
pointer('pointerdown',1,10,10);pointer('pointerup',1,10,10);assert.equal(taps,1);assert.equal(cameraEvents,1);assert.equal(sceneClicks,0);
pointer('pointerdown',2,20,20,true);pointer('pointerup',2,20,20,true);assert.equal(taps,2);
const beforeDrag=camera.position.clone(),beforeTarget=orbit.target.clone(),beforeLook=camera.quaternion.clone();
pointer('pointerdown',3,100,100);pointer('pointermove',3,200,100);pointer('pointerup',3,200,100);
assert.equal(taps,2,'Left dragging does not issue a walking target');assert.ok(camera.position.distanceTo(beforeDrag)>1,'Real OrbitControls pans while Nathan is managed');assert.ok(orbit.target.distanceTo(beforeTarget)>1);assert.ok(camera.quaternion.angleTo(beforeLook)<.0001,'Left drag pans without rotating');
const beforeRotate=camera.quaternion.clone();pointer('pointerdown',8,100,100,false,2);pointer('pointermove',8,200,100,false,2);pointer('pointerup',8,200,100,false,2);assert.ok(camera.quaternion.angleTo(beforeRotate)>.1,'Right drag still rotates');
const beforeTouch=camera.position.clone();pointer('pointerdown',9,100,100,true);pointer('pointermove',9,200,100,true);pointer('pointerup',9,200,100,true);assert.ok(camera.position.distanceTo(beforeTouch)>1,'One-finger drag pans');assert.equal(taps,2);
const beforePinch=camera.position.clone();pointer('pointerdown',4,100,100,true);pointer('pointerdown',5,200,200,true);pointer('pointermove',5,300,300,true);pointer('pointerup',4,100,100,true);pointer('pointerup',5,300,300,true);assert.equal(taps,2,'Two fingers never issue a target');assert.ok(camera.position.distanceTo(beforePinch)>1,'Pinch/pan reaches OrbitControls');
pointer('pointerdown',6,10,10,true);pointer('pointercancel',6,10,10,true);assert.equal(taps,2);
pointer('pointerdown',10,10,10);pointer('pointerup',10,10,10);assert.equal(taps,3,'A cancelled gesture cannot leave pointer ownership stuck');
managed=false;pointer('pointerdown',7,10,10,true);pointer('pointerup',7,10,10,true);assert.equal(sceneClicks,1,'Camera mode preserves original scene listeners');detach();orbit.dispose();
const panel=new NathanPanel(document.querySelector('#host')!,actors,{entity:()=>person,configure:()=>{},edit:()=>{},ready:()=>true},control);
control.open(person);panel.open(person);assert.equal(panel.element.querySelectorAll('option').length,21);assert.ok(panel.element.textContent!.includes('Personeli Yönet'));
panel.element.querySelector<HTMLButtonElement>('[data-nathan="camera"]')!.click();assert.equal(control.mode,'camera');panel.element.querySelector<HTMLButtonElement>('[data-nathan="person"]')!.click();assert.equal(control.mode,'person');
const select=panel.element.querySelector<HTMLSelectElement>('[data-nathan-clips]')!;select.value='9';select.dispatchEvent(new dom.window.Event('change'));assert.equal(actor.index,9);assert.equal(control.mode,'camera');panel.element.querySelector<HTMLButtonElement>('[data-nathan="play"]')!.click();assert.equal(actor.index,9,'Preview Play retains chosen clip');assert.equal(actor.playing,true);
panel.element.querySelector<HTMLButtonElement>('[data-nathan="close"]')!.click();assert.equal(control.active,false);assert.equal(panel.element.hidden,true);
console.log('PASS mouse, touch, drag, multitouch, cancel, camera handoff and panel/preview modes');
console.log('All Nathan movement tests passed. Real browser/GPU rendering is not covered by this test.');
