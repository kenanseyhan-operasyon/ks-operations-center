import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {JSDOM} from 'jsdom';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {newEntity,validateScene,type Entity} from '../src/scene-data';
import {PERSON_PRESET} from '../src/personnel-data';
import {makeObject,applyTransform} from '../src/objects';
import {personnelRig} from '../src/personnel-model';
import {PersonnelModule} from '../src/personnel';
import {personSocket,groundPath,personBlocked,accessPath,aircraftRefuelPoint} from '../src/personnel-navigation';
import {closedAnimationPack} from '../src/model-animations';
import {VehicleRig} from '../src/vehicle-rig';
import {R14} from '../src/r14-spec';
import {FacilityNetwork} from '../src/facility-network';
import {updateFacilityVisual} from '../src/facility-model';

const operator=newEntity(PERSON_PRESET,0,0),person=makeObject(operator),rig=personnelRig(person)!;
const bounds=new T.Box3().setFromObject(person);
assert.ok(bounds.min.y>-.005&&bounds.min.y<.01,'Boot soles stand on the ground');assert.ok(Math.abs(bounds.max.y-operator.height)<.03);
const eye=rig.eyeWorld();assert.ok(eye.y>1.6&&eye.y<1.75);const materials=new Set<T.Material>();person.traverse(n=>{if(n instanceof T.Mesh)materials.add(n.material as T.Material);});
const glass=[...materials].find(m=>m.transparent) as T.MeshStandardMaterial;assert.ok(glass.opacity>.8);rig.update(.3,'idle',0,true);assert.ok(glass.opacity<.3,'Night safety glasses are clear');
for(const pose of ['walk','bend','crouch','climb','seated','reach','valve','refuel'] as const){rig.update(1,pose,1,false);person.updateMatrixWorld(true);person.traverse(n=>assert.ok(n.matrixWorld.elements.every(Number.isFinite)));}
rig.update(1,'crouch',0,false);assert.ok(rig.eyeWorld().y<eye.y-.35,'Crouching lowers the eye, body and knee joints');rig.update(1,'idle',0,false);rig.setEyes(true);assert.equal(rig.head.visible,false);rig.setEyes(false);

const building=newEntity('BUILDING',0,0);building.width=4;building.length=4;
const path=groundPath([-5,0,0],[5,0,0],[building]);assert.ok(path&&path.length>1,'Route walks around the building');assert.ok(path!.every(p=>!personBlocked(p,[building])));
const fence=newEntity('FENCE_WALL',0,0);fence.points=[[0,-100],[0,100]];assert.equal(groundPath([-2,0,0],[2,0,0],[fence]),undefined,'No traversal through a fence');
const gate=newEntity('MAIN_GATE',0,0);gate.points=[[0,-4],[0,4]];assert.ok(personBlocked([0,0,0],[gate]));assert.equal(personBlocked([0,0,0],[gate],undefined,()=>1),false);
assert.equal(groundPath([0,0,0],[70,0,0],[]),undefined);
const tank=newEntity('TANK',10,5);tank.heading=37;tank.scale=1.1;const stairs=accessPath(tank)!;assert.ok(stairs.length>50);assert.ok(Math.abs(stairs.at(-1)![1]-(tank.height+.27)*tank.scale)<1e-8);tank.facility={stairs:false};assert.equal(accessPath(tank),undefined);

const bytes=fs.readFileSync('public/models/refueller-38k-r14.glb'),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const model=gltf.scene,pack=closedAnimationPack(model,gltf.animations),truck=newEntity('R14',0,0),vehicleRig=new VehicleRig(model),bb=new T.Box3().setFromObject(model),s=truck.length/R14.length;
model.scale.setScalar(s);model.position.set(-R14.centreX*s,-bb.min.y*s,-R14.centreZ*s);const orient=new T.Group();orient.rotation.y=-Math.PI/2;orient.add(model);const vehicleRoot=new T.Group();vehicleRoot.add(orient);applyTransform(vehicleRoot,truck);
const platform=personSocket(truck,vehicleRoot,'platform')!,roof=personSocket(truck,vehicleRoot,'roof')!;
assert.ok(platform&&roof);assert.ok(platform[1]>0&&platform[1]<3);assert.ok(roof[1]>platform[1]);
const platformSteps=accessPath(truck,vehicleRoot,'platform')!,roofSteps=accessPath(truck,vehicleRoot,'roof')!;
assert.ok(platformSteps.length>=5&&roofSteps.length>=9,'Paths use real model steps');
assert.ok(platformSteps.every(p=>p.every(Number.isFinite)));assert.ok(Math.abs(platformSteps.at(-1)![1]-platform[1])<.02);

const lift=pack.actions.get('Platform_Raise_4s')!;lift.time=lift.getClip().duration;pack.mixer.update(0);model.updateMatrixWorld(true);const raised=personSocket(truck,vehicleRoot,'platform')!;assert.ok(raised[1]>platform[1]+.2,'Socket follows the actual animated floor');lift.time=0;pack.mixer.update(0);

const dom=new JSDOM('<!doctype html><body></body>',{url:'https://test.invalid',pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','HTMLButtonElement','HTMLInputElement','HTMLFormElement','FormData'])Object.defineProperty(globalThis,name,{value:(dom.window as any)[name],configurable:true});
dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
const valve=newEntity('PIPE_VALVE',3,0),source=newEntity('WATER_SOURCE',3,3);valve.facility!.supplyId=source.id;const cabin=newEntity('GUARD_CABIN',10,0),stair=newEntity('MOBILE_STAIR',6,-5);
let entities=[operator,valve,source,cabin,stair,truck];const objects=new Map(entities.map(e=>[e.id,e.id===truck.id?vehicleRoot:e.id===operator.id?person:makeObject(e)]));const scene=new T.Scene();objects.forEach(o=>scene.add(o));const network=new FacilityNetwork();let checkpoints=0,changes=0,driving=false,driveSpeed=0,cameraOn=false,designer=true;const notices:string[]=[];
let module:PersonnelModule;module=new PersonnelModule(document.body,{
  entities:()=>entities,object:id=>objects.get(id),eye:id=>id===truck.id?vehicleRig.cab.eye:undefined,
  select:()=>{},add:()=>{},edit:()=>designer,checkpoint:()=>checkpoints++,changed:()=>{changes++;module.sync();},camera:on=>{cameraOn=on;},
  driveKey:()=>true,drive:()=>{driving=true;return true;},stopDrive:()=>{driving=false;},speed:()=>driveSpeed,cab:()=>true,gateAmount:()=>0,
  operate:(e,a)=>{if(a==='valve'){if(!network.active)network.start(entities);network.operate(e,entities);updateFacilityVisual(e,objects.get(e.id)!,network,0);return true;}const d=objects.get(e.id)?.getObjectByName('PERSON_OPERABLE_DOOR');if(d){d.rotation.y=d.rotation.y===0?-1.6:0;return true;}return false;},
  platform:()=>{lift.time=lift.time?0:lift.getClip().duration;pack.mixer.update(0);},ready:()=>true,notify:s=>notices.push(s)
});
module.open(operator);const click=(action:string)=>module.element.querySelector<HTMLButtonElement>(`[data-person-action="${action}"]`)!.click();const choose=(id:string)=>{const el=module.element.querySelector<HTMLSelectElement>('[data-person-target]')!;el.value=id;el.dispatchEvent(new dom.window.Event('change'));};let now=0;const tick=(seconds:number)=>{for(let t=0;t<seconds;t+=.05){now+=50;module.tick(.05,now,false);}};
for(const mode of ['eyes','rear','front','top'] as const){module.view(mode);tick(.1);const p=module.cameraPose()!;assert.ok(p&&p.position.toArray().every(Number.isFinite));assert.ok(p.position.distanceTo(p.target)>.2);assert.equal(cameraOn,true);}
module.view('rear');operator.position=[-10,0,-8];module.key('w',true);tick(1);module.key('w',false);tick(.1);assert.ok(operator.position[2]<-9,'W moves the real entity');assert.ok(checkpoints&&changes);
module.key('w',true);window.dispatchEvent(new dom.window.Event('blur'));const paused=[...operator.position];tick(.3);assert.deepEqual(operator.position,paused,'Focus loss clears held controls');
operator.position=[3,0,-3];choose(valve.id);click('valve');tick(10);assert.equal(network.open.get(valve.id),false,'Reaching the target operates the connected facility network');assert.equal(valve.facility?.open,true,'An exercise preserves configured valve defaults');
choose(cabin.id);click('door');tick(15);assert.notEqual(objects.get(cabin.id)!.getObjectByName('PERSON_OPERABLE_DOOR')!.rotation.y,0,'Door leaf actually opens');
operator.position=[6,0,-8];choose(stair.id);click('climb');tick(12);assert.equal(operator.personnel?.attachment?.socket,'landing');assert.ok(Math.abs(operator.position[1]-stair.height)<.03);click('descend');tick(12);assert.equal(operator.personnel?.attachment,undefined);assert.ok(Math.abs(operator.position[1])<.01);
operator.position=[platformSteps[0][0],0,platformSteps[0][2]];choose(truck.id);click('platform');tick(15);assert.equal(operator.personnel?.attachment?.socket,'platform',notices.at(-1));assert.equal(module.blocksVehicle(truck.id),true);
click('lift');tick(.2);assert.ok(Math.abs(operator.position[1]-raised[1])<.02,'Operator follows lifting basket');const attachment=structuredClone(operator.personnel!.attachment);click('descend');tick(.1);assert.deepEqual(operator.personnel!.attachment,attachment,'No descent through empty air from a raised basket');click('lift');tick(.1);click('descend');tick(15);assert.equal(operator.personnel!.attachment,undefined);
operator.position=[-truck.width/2-2,0,-truck.length*.36];choose(truck.id);click('drive');tick(10);assert.ok(driving,'Existing driving system is opened');assert.equal(operator.personnel?.attachment?.socket,'driver');const original=[...operator.position];truck.position[0]+=5;truck.heading=20;applyTransform(vehicleRoot,truck);tick(.2);assert.ok(Math.abs(operator.position[0]-original[0])>1,'Seated driver follows the vehicle');assert.equal(module.blocksVehicle(truck.id),false);
driveSpeed=2;click('descend');assert.equal(operator.personnel?.attachment?.socket,'driver','Cannot leave a moving vehicle');driveSpeed=0;click('descend');tick(.2);assert.equal(operator.personnel?.attachment,undefined);assert.equal(driving,false);
const aircraft=newEntity('A320',0,25),point=aircraftRefuelPoint(aircraft)!;entities.push(aircraft);const aircraftRoot=makeObject(aircraft);objects.set(aircraft.id,aircraftRoot);scene.add(aircraftRoot);
// Platform rehearsal at a reachable coupling. Test a held/released deadman through actual UI.
operator.position=[point[0]-.5,point[1]-1.6,point[2]];truck.position=[point[0]-3,0,point[2]];delete operator.personnel!.attachment;module.open(operator);choose(aircraft.id);const sel=module.element.querySelector<HTMLSelectElement>('[data-person-vehicle]')!;sel.value=truck.id;sel.dispatchEvent(new dom.window.Event('change'));click('refuel');tick(5);assert.ok(scene.getObjectByName('PERSON_REFUEL_HOSE'),notices.at(-1));module.key(' ',true);tick(1);assert.ok(module.element.querySelector('output')!.textContent!.includes('basılı'));module.key(' ',false);tick(.3);assert.ok(module.element.querySelector('output')!.textContent!.includes('bırakıldı'));const litres=truck.fuelLitres;tick(1);assert.equal(truck.fuelLitres,litres,'Rehearsal never fabricates fuel transfers');click('disconnect');assert.equal(scene.getObjectByName('PERSON_REFUEL_HOSE'),undefined);
const saved=validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',entities,groups:[],source:'personnel-test'});assert.equal(saved.entities[0].kind,'person');assert.deepEqual(saved.entities[0].personnel,operator.personnel);const round=validateScene(JSON.parse(JSON.stringify(saved)));assert.deepEqual(round,saved);
module.close();assert.equal(cameraOn,false);assert.equal(rig.head.visible,true);designer=false;const before=operator.name;module.open(operator);const form=module.element.querySelector<HTMLFormElement>('[data-person-settings]')!;(form.elements.namedItem('name') as HTMLInputElement).value='Forbidden';form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));assert.equal(operator.name,before,'Visitor cannot persist appearance edits');
console.log('PASS: metre-scale PPE, pose/camera transforms, night lenses, obstacle paths, real GLB stairs and lift sockets, keyboard/focus loss, actual valve and door changes, climb/descend, driver attachment, vehicle interlocks, deadman release, scene round-trip and edit permissions.');dom.window.close();
