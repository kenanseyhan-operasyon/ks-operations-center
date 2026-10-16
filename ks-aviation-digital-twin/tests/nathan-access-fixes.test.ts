import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {JSDOM} from 'jsdom';
import {newEntity,validateScene,type Entity} from '../src/scene-data';
import {NathanNavigation} from '../src/nathan-navigation';
import {planNathanRoute} from '../src/nathan-route';
import {localToWorld} from '../src/facility-data';
import {NathanActors,parseNathanAccessClips} from '../src/nathan-model';
import {NathanController} from '../src/nathan-controller';
import {NATHAN_PRESET} from '../src/nathan-data';
import {applyTransform,makeObject} from '../src/objects';
import type {V3} from '../src/personnel-navigation';
import {VehicleRig} from '../src/vehicle-rig';
import {R14} from '../src/r14-spec';
import {closedAnimationPack} from '../src/model-animations';
import {makeNathanAccess} from '../src/nathan-access';
import {driverPose} from '../src/nathan-driver';
import {stairPose} from '../src/nathan-stair-gait';
import {Workspace} from '../src/workspace';
import {NathanCamera} from '../src/nathan-camera';
import {bindNathanInput} from '../src/nathan-input';

const dom=new JSDOM('<body><canvas></canvas></body>');Object.assign(globalThis,{window:dom.window,document:dom.window.document});dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
const seed=validateScene(JSON.parse(fs.readFileSync('public/data/adb-test-seed.json','utf8')));
for(const gate of seed.entities.filter(e=>e.preset==='PEDESTRIAN_GATE')){
 const nav=new NathanNavigation(seed.entities),a=localToWorld(gate,[.06,0,2.4]),b=localToWorld(gate,[.06,0,-3]);
 const plan=planNathanRoute(a,b,nav,seed.entities,()=>undefined);
 assert.ok(plan?.some(l=>l.gate?.id===gate.id),`Actual ADB emergency door ${gate.id}: ${JSON.stringify({a,b,plan})}`);
 assert.ok(planNathanRoute(b,a,nav,seed.entities,()=>undefined)?.some(l=>l.gate?.id===gate.id),'Both approach sides');
}
console.log('PASS both actual ADB emergency doors: automatic route in both directions with main gates closed');
const indexed=new NathanNavigation(seed.entities),all=(indexed as unknown as {obstacles:{bottom:number;top:number;hit:(p:V3)=>boolean}[]}).obstacles;
let random=17;const rand=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;};
for(let i=0;i<10000;i++){const p:V3=[rand()*120-60,rand()*4,rand()*120-60];assert.equal(indexed.blocked(p),all.some(o=>p[1]<o.top+.025&&p[1]+1.78>o.bottom&&o.hit(p)),'Spatial index preserves precise obstacle clearance');}
const exitGate=seed.entities.find(e=>e.id==='8d3c50cf-90aa-4655-89df-3af373f183ca')!;
assert.ok(planNathanRoute([4.53,0,2.5],localToWorld(exitGate,[.06,0,-3]),indexed,seed.entities,()=>undefined)?.some(l=>l.gate?.id===exitGate.id),'Route from the real facility vehicle area to outside');
console.log('PASS obstacle index matches 10,000 exact collision samples; route from actual ADB vehicle area to emergency exit');
const curb=newEntity('CURB',0,0);curb.height=.15;curb.width=.15;curb.points=[[-5,0],[5,0]];
const curbNav=new NathanNavigation([curb]);assert.ok(curbNav.path([0,0,-2],[0,0,2]));assert.equal(curbNav.surface([0,0,0]),.15);
curb.height=.3;assert.equal(new NathanNavigation([curb]).blocked([0,0,0]),true);
const fence=newEntity('FENCE_WALL',0,0);fence.points=[[-10,0],[10,0]];assert.equal(new NathanNavigation([fence]).blocked([0,0,0]),true);
console.log('PASS 15 cm curb is a supporting step; tall curb and fence remain obstacles');

async function read(path:string){const b=fs.readFileSync(path),l=new GLTFLoader();l.register(()=>({name:'T',loadTexture:async()=>new T.Texture()}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const [asset,vehicle]=await Promise.all([read('public/models/personnel/KS_Nathan_15_Hareket.glb'),read('public/models/refueller-38k-r14.glb')]);
asset.animations.push(...parseNathanAccessClips(JSON.parse(fs.readFileSync('public/models/personnel/nathan-access-animations.json','utf8'))));
const person=newEntity(NATHAN_PRESET,0,0),personRoot=makeObject(person),objects=new Map([[person.id,personRoot]]);let entities:Entity[]=[person];
const actors=new NathanActors(()=>{},async()=>asset);actors.sync(entities,objects);await new Promise(r=>setTimeout(r,0));const actor=actors.states.get(person.id)!.actor!;assert.equal(actor.clips.length,19);
for(const clip of ['Climbing_Up_Ladder','Climbing_Down_Wall','Descending_Stairs']){
 assert.ok(actor.motion(clip));for(let i=0;i<30;i++){actor.update(.05);const box=new T.Box3().setFromObject(personRoot,true);assert.ok(box.getSize(new T.Vector3()).y>1.1&&box.getSize(new T.Vector3()).y<2.1,`${clip} upright, metre scale`);}
}
console.log('PASS three imported FBX clips, compatible skeleton, upright scale and all 19 animations available');
actor.motion('Idle');actor.update(.1);actor.firstPerson(true);
actor.model.traverse(n=>{if(!(n instanceof T.SkinnedMesh))return;const head=new Set<number>();n.skeleton.bones.forEach((b,i)=>{for(let a:T.Object3D|null=b;a;a=a.parent)if(/_(head|neck)$/.test(a.name)){head.add(i);break;}});
 const skin=n.geometry.attributes.skinIndex,w=n.geometry.attributes.skinWeight;for(const i of n.geometry.index!.array)for(let k=0;k<4;k++)if(head.has(skin.array[i*4+k]))assert.ok(w.array[i*4+k]<.05,'Eyes, mouth, jaw and all head descendants are removed in first person');
});actor.firstPerson(false);console.log('PASS first-person geometry excludes face/eyes/jaw; original mesh restored');

for(const gate of seed.entities.filter(e=>e.preset==='PEDESTRIAN_GATE')){
 const data=structuredClone(seed.entities);entities=[...data,person];const g=data.find(e=>e.id===gate.id)!;person.position=localToWorld(g,[.06,0,2.4]);applyTransform(personRoot,person);
 const target=localToWorld(g,[.06,0,-3]);let operations=0;
 const control=new NathanController(actors,{entities:()=>entities,object:id=>objects.get(id),gateAmount:id=>data.find(e=>e.id===id)?.facility?.open?1:0,speed:()=>0,prepare:()=>true,checkpoint:()=>{},changed:()=>{},ui:()=>{},input:()=>{},notify:()=>{},operate:id=>{data.find(e=>e.id===id)!.facility!.open=true;operations++;}});
 control.open(person);assert.ok(control.walkTo(target));for(let i=0;i<2400&&control.phase!=='idle'||i<1;i++){control.tick(.05);if(i%10===0)actor.update(.05);if(i>2399)break;}
 // The gate operation intentionally has an idle pose while its hand action runs.
 for(let i=0;i<1800;i++){control.tick(.05);if(i%10===0)actor.update(.05);if(operations&&Math.hypot(person.position[0]-target[0],person.position[2]-target[2])<.03)break;}
 assert.equal(operations,1);assert.ok(Math.hypot(person.position[0]-target[0],person.position[2]-target[2])<.03,control.message);control.close();
}
console.log('PASS actual ADB route → approach → open panic door → walk outside, without opening main gates');

const truck=newEntity('R14',0,0),model=vehicle.scene,pack=closedAnimationPack(model,vehicle.animations),rig=new VehicleRig(model);
model.updateWorldMatrix(true,true);
for(const side of ['LEFT','RIGHT'])for(let i=1;i<=3;i++){
 const step=model.getObjectByName(`CAB_ACCESS_STEP_${side}_${i}`)!;assert.ok(step);
 const box=new T.Box3().setFromObject(step);assert.ok(box.max.x<R14.frontAxle-R14.tyreRadius-.005,'Cab steps are ahead of the entire tyre, with clearance');
}
const bumperStep=model.getObjectByName('Rear_Ladder_Close_Step_BUMPER')!,bumperBox=new T.Box3().setFromObject(bumperStep);
assert.ok(bumperBox.getSize(new T.Vector3()).y<.012);
for(let i=0;i<2;i++){const box=new T.Box3().setFromObject(model.getObjectByName(`Rear_Ladder_Close_Step_LOWER_${i}`)!);assert.ok(box.getCenter(new T.Vector3()).x>1.54);assert.ok(box.max.y<bumperBox.min.y);}
console.log('PASS cab steps clear both tyres; two rear steps are outside the bumper; bumper centre is a thin tread');
const scale=truck.length/R14.length,bounds=new T.Box3().setFromObject(model);model.scale.setScalar(scale);model.position.set(-R14.centreX*scale,-bounds.min.y*scale,-R14.centreZ*scale);
const truckRoot=new T.Group(),orient=new T.Group();orient.rotation.y=-Math.PI/2;orient.add(model);truckRoot.add(orient);applyTransform(truckRoot,truck);objects.set(truck.id,truckRoot);entities=[truck,person];
for(const name of ['Tank_Railing_Raise','Platform_Gate_Open']){const a=pack.actions.get(name)!;a.time=a.getClip().duration;}pack.mixer.update(0);rig.cab.setDoor('left',true);for(let i=0;i<20;i++)rig.cab.updateDoors(.05);
const navigation=()=>new NathanNavigation(entities,.34,undefined,id=>objects.get(id),person.id);
for(const kind of ['rear','platform','driver'] as const){
 const access=makeNathanAccess(truck,truckRoot,kind,navigation())!;assert.ok(access?.contacts);
 for(const down of [false,true]){
  actor.contact();let supported=0,missing=0;const missed:number[]=[];
  for(let i=0;i<=200;i++){
   const p=down?1-i/200:i/200,pose=kind==='driver'?driverPose(access,p,down):stairPose(access.contacts!,p);
   person.position=pose.root;person.heading='heading' in pose?pose.heading as number:access.heading;applyTransform(personRoot,person);
   actor.motion(kind==='driver'&&p>.8?'Driving':down?'Climbing_Down_Wall':'Climbing_Up_Ladder',.7);actor.contact(pose.contact);actor.update(.05);
   assert.ok(actor.contactRig!.errors.every(e=>e<.035),`${kind} ${down?'down':'up'} ${p} reach ${actor.contactRig!.errors}`);
   const belowLanding=Math.min(...pose.contact.feet.map(f=>f[1]))<access.contacts!.stops.at(-1)![1]-.05;
   if(pose.root[1]>.12&&belowLanding&&(kind!=='driver'||p<.8)){supported++;if(actor.contactRig!.errors.length<4){missing++;missed.push(Number(p.toFixed(3)));}}
  }
  console.log(`CONTACT ${kind} ${down?'down':'up'}: ${supported-missing}/${supported} samples with both hands on reachable rails`);
  assert.equal(missing,0,`${kind} ${down?'descent':'ascent'} missing rail contact below landing at ${missed}`);
 }
}
console.log('PASS actual up/down clips: sampled ladder flights have reachable feet and hand contacts; release on the landing');

// Real Workspace gate/lift/door handlers with the actual GLB animation mixer.
actor.contact();delete person.nathan!.support;
for(const a of pack.actions.values()){a.time=0;a.paused=true;}pack.open.clear();pack.mixer.update(0);
rig.cab.setDoor('left',false);for(let i=0;i<20;i++)rig.cab.updateDoors(.05);
let running=false;const notices:string[]=[];
const workspace:any={mixers:new Map([[truck.id,pack]]),vehicleRigs:new Map([[truck.id,rig]]),nathanLiftRequests:new Set(),history:{current:{entities}},driving:{motion:{speed:0}},say:(s:string)=>s,notify:(s:string)=>notices.push(s),updateAnimationButtons:()=>{}};
workspace.animateFor=(...args:any[])=>(Workspace.prototype as any).animateFor.apply(workspace,args);
const control=new NathanController(actors,{entities:()=>entities,object:id=>objects.get(id),gateAmount:()=>0,speed:()=>0,
 prepare:(id,kind)=>(Workspace.prototype as any).prepareNathanAccess.call(workspace,id,kind),
 accessGate:(id,open)=>(Workspace.prototype as any).nathanPlatformGate.call(workspace,id,open),
 checkpoint:()=>{},changed:()=>control.sync(),ui:()=>{},input:()=>{},notify:s=>notices.push(s),
 platform:id=>workspace.animateFor(id,'Platform_Raise_4s'),driver:(_id,on)=>{running=on;},door:(_id,on)=>rig.cab.setDoor('left',on)});
workspace.nathanControl=control;
let frames=0;
const tick=(seconds:number,check:()=>void=()=>{})=>{for(let i=0;i<Math.ceil(seconds/.05);i++){
 pack.mixer.update(.05);rig.cab.updateDoors(.05);
 for(const id of workspace.nathanLiftRequests)if(pack.actions.get('Platform_Gate_Open')!.time<=.02){workspace.nathanLiftRequests.delete(id);workspace.animateFor(id,'Platform_Raise_4s',true);}
 rig.setPlatformRaised(pack.open.has('Platform_Raise_4s')||workspace.nathanLiftRequests.has(truck.id));
 control.tick(.05);if(frames++%10===0)actor.update(.05);check();
}};
let access=makeNathanAccess(truck,truckRoot,'platform',navigation())!;
person.position=[access.points[0][0]-1,0,access.points[0][2]];applyTransform(personRoot,person);control.open(person);
assert.ok(control.climb(truck.id,'platform'));let gateOpened=false;
tick(50,()=>{if(pack.actions.get('Platform_Gate_Open')!.time>.05)gateOpened=true;});
assert.equal(control.phase,'standing',control.message);assert.ok(gateOpened);assert.equal(pack.actions.get('Platform_Gate_Open')!.time,0,'Spring gate closes after passing without requesting a lift');
const floor=truckRoot.getObjectByName('Platform_Grey_Floor')!,anchor=floor.worldToLocal(new T.Vector3(...person.position));
const button=truckRoot.getObjectByName('Platform_Lift_Toggle_Button') as T.Mesh,buttonMat=button.material as T.MeshStandardMaterial;
assert.ok(buttonMat.color.g>buttonMat.color.r);
// A real screen ray must hit the green physical button, not a panel shortcut.
const canvas=document.querySelector('canvas')!;canvas.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:800,height:600,right:800,bottom:600,toJSON(){}});
canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
const camera=new T.PerspectiveCamera(50,4/3,.01,100);const buttonPoint=new T.Box3().setFromObject(button).getCenter(new T.Vector3());actor.update(.05);camera.position.copy(actor.eyePoint());camera.lookAt(buttonPoint);camera.updateMatrixWorld(true);truckRoot.userData.entityId=truck.id;
Object.assign(workspace,{inputCanvas:canvas,camera,objects,setMenu:()=>{}});
const buttonRay=new T.Raycaster();buttonRay.setFromCamera(new T.Vector2(),camera);assert.equal(buttonRay.intersectObject(truckRoot,true)[0].object,button,'Lift button is visible from the occupant eye');
(Workspace.prototype as any).pickNathanTarget.call(workspace,{clientX:400,clientY:300});
tick(6,()=>assert.ok(floor.worldToLocal(new T.Vector3(...person.position)).distanceTo(anchor)<.0001,'Occupant remains attached to lifting floor'));
assert.ok(pack.actions.get('Platform_Raise_4s')!.time>3.9,notices.at(-1));assert.ok(buttonMat.color.r>buttonMat.color.g&&buttonMat.emissiveIntensity>=1);
control.togglePlatform();tick(6);assert.equal(pack.actions.get('Platform_Raise_4s')!.time,0);assert.ok(buttonMat.color.g>buttonMat.color.r);
control.togglePlatform();tick(6);
const target:V3=[access.points[0][0]-2,0,access.points[0][2]+2];assert.ok(control.walkTo(target));
tick(65);assert.equal(control.phase,'idle',control.message);assert.equal(person.nathan?.support,undefined);assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...target))<.03);assert.equal(pack.actions.get('Platform_Gate_Open')!.time,0);
console.log('PASS platform: spring gate → actual green button → red/lift with occupant → green/lower → ground target lowers, opens, descends, closes and walks');

access=makeNathanAccess(truck,truckRoot,'driver',navigation())!;person.position=[access.points[0][0]-1,0,access.points[0][2]];applyTransform(personRoot,person);control.open(person);assert.ok(control.climb(truck.id,'driver'));
let openingWait=false;
tick(60,()=>{const amount=rig.cab.doorAmount();if(rig.cab.doors.get('left')!.open&&amount>0&&amount<.999){openingWait=true;assert.ok(!person.nathan?.support,'No boarding while the door is opening');}});
assert.ok(openingWait);assert.ok(control.seated,control.message);assert.ok(running);assert.ok(rig.cab.doorsClosed);
workspace.nathanCamera={mode:'eyes'};(Workspace.prototype as any).syncCabVisibility.call(workspace);assert.ok(rig.cab.isInside);assert.equal(truckRoot.getObjectByName('CAB_TRANSPARENT_CORNERS')!.visible,true);
workspace.nathanCamera.mode='free';(Workspace.prototype as any).syncCabVisibility.call(workspace);assert.equal(rig.cab.isInside,false);
const exit:V3=[access.points[0][0]-2,0,access.points[0][2]+1];assert.ok(control.walkTo(exit));tick(65);
assert.equal(control.phase,'idle',control.message);assert.equal(person.nathan?.support,undefined);assert.equal(running,false);assert.ok(rig.cab.doorsClosed);assert.ok(new T.Vector3(...person.position).distanceTo(new T.Vector3(...exit))<.03);
console.log('PASS driver: wait outside open door → steps → seat/start/close → V transparent corners → ground target exits by steps and walks');

let taps=0,view:NathanCamera;
bindNathanInput(canvas,()=>view?.mode!=='eyes',()=>taps++);
view=new NathanCamera(camera,canvas,()=>({entity:person,actor}),()=>{},()=>taps++);view.set('eyes');
const pointer=(type:string,x:number,y:number,id=1,button=0)=>{const e=new dom.window.MouseEvent(type,{clientX:x,clientY:y,button,cancelable:true});Object.defineProperties(e,{pointerId:{value:id},pointerType:{value:'touch'}});canvas.dispatchEvent(e);};
pointer('pointerdown',100,100);pointer('pointerup',100,100);assert.equal(taps,1,'Eye view tap is dispatched once, not also by the ground gesture handler');
pointer('pointerdown',100,100);pointer('pointermove',140,120);pointer('pointerup',140,120);assert.equal(taps,1);
pointer('pointerdown',100,100);pointer('pointercancel',100,100);assert.equal(taps,1);
pointer('pointerdown',100,100);pointer('pointerdown',110,100,2);pointer('pointerup',100,100);pointer('pointerup',110,100,2);assert.equal(taps,1);
view.set('free');pointer('pointerdown',100,100);pointer('pointerup',100,100);assert.equal(taps,2);
console.log('PASS eye-view single tap, drag/look, cancel, two-finger suppression and return to free-camera targeting');
control.close();curb.height=.15;entities=[person,curb];person.position=[0,0,-2];applyTransform(personRoot,person);actor.contact();control.open(person);
assert.ok(control.walkTo([0,0,0]));tick(15);actor.update(.05);assert.equal(person.position[1],.15);
for(let i=0;i<2;i++){const sole=actor.contactRig!.sole(i);assert.ok(sole.y>=new NathanNavigation([curb]).surface(sole.toArray() as V3)-.005,'Foot does not penetrate the curb');}
assert.ok(control.walkTo([0,0,2]));tick(15);assert.equal(person.position[1],0);assert.equal(control.phase,'idle');
console.log('PASS animated curb approach → step up → stop on 15 cm support → step down and continue');
actor.dispose();rig.dispose();
