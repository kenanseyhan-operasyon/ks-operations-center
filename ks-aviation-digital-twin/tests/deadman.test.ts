import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {JSDOM} from 'jsdom';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VehicleRig} from '../src/vehicle-rig';
import {closedAnimationPack} from '../src/model-animations';
import {NathanActor,parseNathanAccessClips,type NathanActors} from '../src/nathan-model';
import {NathanController} from '../src/nathan-controller';
import {DeadmanSession} from '../src/deadman-session';
import {DeadmanPanel} from '../src/deadman-panel';
import {newEntity,type Entity} from '../src/scene-data';
import {applyTransform} from '../src/objects';
import {NATHAN_PRESET} from '../src/nathan-data';
import {R14} from '../src/r14-spec';

const dom=new JSDOM('<body><main></main></body>',{pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','HTMLButtonElement'])Object.defineProperty(globalThis,name,{value:(dom.window as any)[name],configurable:true});
dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
async function read(path:string){const b=fs.readFileSync(path),l=new GLTFLoader();l.register(()=>({name:'QA_TEXTURE',loadTexture:async()=>new T.Texture()}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const [vehicle,asset]=await Promise.all([read('public/models/refueller-38k-r14.glb'),read('public/models/personnel/KS_Nathan_15_Hareket.glb')]);
asset.animations.push(...parseNathanAccessClips(JSON.parse(fs.readFileSync('public/models/personnel/nathan-access-animations.json','utf8'))));
const model=vehicle.scene,pack=closedAnimationPack(model,vehicle.animations),rig=new VehicleRig(model),d=rig.deadman;
rig.optimizeRendering(vehicle.animations);
const truck=newEntity('R14',0,0),root=new T.Group(),orient=new T.Group();root.add(orient);orient.rotation.y=-Math.PI/2;orient.add(model);
const scale=13.5/2.47;model.scale.setScalar(scale);model.position.set(-R14.centreX*scale,.454*scale,-R14.centreZ*scale);applyTransform(root,truck);
const person=newEntity(NATHAN_PRESET,0,0),personRoot=new T.Group(),actor=new NathanActor(personRoot,asset,1.78);
let entities:Entity[]=[truck,person];const objects=new Map([[truck.id,root],[person.id,personRoot]]);
const actors={states:new Map([[person.id,{actor}]])} as unknown as NathanActors;
let session:DeadmanSession;const notices:string[]=[];
const control=new NathanController(actors,{entities:()=>entities,object:id=>objects.get(id),gateAmount:()=>0,speed:()=>0,prepare:()=>true,
 checkpoint:()=>{},changed:()=>{},input:()=>{},ui:()=>{},notify:s=>notices.push(s),toolBusy:()=>session?.busy,canTarget:p=>session?.canTarget(p),canStep:p=>session?.canStep(p)});
session=new DeadmanSession({controller:control,entities:()=>entities,object:id=>objects.get(id),actor:id=>id===person.id?actor:undefined,
 device:id=>id===truck.id?d:undefined,operator:()=>person,activate:e=>{if(control.id!==e.id||!control.capturing)control.open(e);},speed:()=>0,notify:s=>notices.push(s)});
const panel=new DeadmanPanel(document.querySelector('main')!,session),button=(name:string)=>panel.element.querySelector<HTMLButtonElement>(`[data-dm="${name}"]`)!;
const frame=()=>{d.update(.05);control.tick(.05);session.beforeActors(.05);actor.update(.05);session.afterActors();panel.sync();};
const tick=(seconds:number,check?:()=>void)=>{for(let i=0;i<seconds/.05;i++){frame();check?.();}};
const start=d.approach().addScaledVector(d.normal(),2);person.position=start.toArray() as [number,number,number];applyTransform(personRoot,person);
panel.open(truck.id);button('door').click();tick(1);assert.ok(d.amount>.99);assert.equal(d.pressed,false);
assert.ok(session.take(),notices.join(' | ')+' approach '+d.approach().toArray()+' start '+person.position);let steps=0;
while(session.phase!=='held'&&steps++<500)frame();
assert.equal(session.phase,'held',notices.join(' | '));assert.ok(d.deployed);assert.ok(d.cableLength>.1);
const holdError=()=>d.handle.getWorldPosition(new T.Vector3()).distanceTo(actor.contactRig!.arms[1].end.localToWorld(actor.contactRig!.grasps[1].centre.clone()));
assert.ok(holdError()<.001,'Handle follows the actual enclosed finger cavity');assert.equal(d.setOpen(false),false,'Cannot close over a deployed lead');
assert.equal(control.climb(truck.id,'rear'),false,'Hands carrying equipment cannot climb a ladder');
assert.equal(control.preview(),false,'Preview cannot take ownership from a held device');
const leverBefore=d.lever.rotation.x;
button('hold').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:' ',bubbles:true}));assert.equal(d.pressed,true);tick(.3);assert.ok(d.lever.rotation.x>leverBefore+.15,'Squeezing folds the lever toward the grip');
dom.window.dispatchEvent(new dom.window.KeyboardEvent('keyup',{key:' ',bubbles:true}));assert.equal(d.pressed,false);
button('hold').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));dom.window.dispatchEvent(new dom.window.Event('blur'));assert.equal(d.pressed,false);
const pointer=(type:string)=>{const e=new dom.window.MouseEvent(type,{button:0,bubbles:true});Object.defineProperty(e,'pointerId',{value:7});return e;};
button('hold').dispatchEvent(pointer('pointerdown'));assert.equal(d.pressed,true);button('hold').dispatchEvent(pointer('pointercancel'));assert.equal(d.pressed,false);
button('hold').dispatchEvent(pointer('pointerdown'));button('hold').dispatchEvent(new dom.window.Event('lostpointercapture'));assert.equal(d.pressed,false);
session.press(true);control.setMode('camera');frame();assert.equal(d.pressed,false);control.setMode('person');
console.log('PASS real Nathan approaches, reaches, grasps; normally-open pointer/keyboard/focus inputs and access ownership');

// Walking keeps the opposite arm and legs animated, while the physical switch stays in the hand.
const near=d.approach().addScaledVector(d.normal(),5);assert.ok(control.walkTo(near.toArray() as [number,number,number]));
let footMin=Infinity,footMax=-Infinity,leftMin=Infinity,leftMax=-Infinity,maxBend=0;
tick(9,()=>{
 assert.ok(holdError()<.001);assert.ok(d.cableLength<=40);
 const foot=actor.contactRig!.sole(0).y;footMin=Math.min(footMin,foot);footMax=Math.max(footMax,foot);
 const left=actor.contactRig!.arms[0].upper.quaternion.x;leftMin=Math.min(leftMin,left);leftMax=Math.max(leftMax,left);
 const arm=actor.contactRig!.arms[1],p=(n:T.Object3D)=>n.getWorldPosition(new T.Vector3()),palm=p(actor.model.getObjectByName('rp_nathan_animated_003_walking_middle_01_r')!).sub(p(arm.end)).normalize(),forearm=p(arm.end).sub(p(arm.lower)).normalize();
 maxBend=Math.max(maxBend,Math.acos(T.MathUtils.clamp(palm.dot(forearm),-1,1))*180/Math.PI);
 const path=d.cableCurve(d.handle.localToWorld(new T.Vector3(0,-.107,0)),(session as any).route);
 assert.ok(path.getPoints(120).every(p=>p.y>=.0179),'Cable must not pass below the floor');
});
assert.ok(leftMax-leftMin>.03,'Opposite arm keeps its walking swing');assert.ok(footMax-footMin>.025,'Feet still lift and plant during the original walk');assert.ok(maxBend<65,`Wrist bend ${maxBend}`);
const shortLength=d.cableLength;
const far=d.approach().addScaledVector(d.normal(),50);assert.equal(control.walkTo(far.toArray() as [number,number,number]),false);
// The step guard also rejects a path whose end itself is within 40 m but whose routed cable is longer.
const route=(session as any).route as T.Vector3[];const saved=route.map(p=>p.clone());
(session as any).route=[route[0],route[0].clone().add(new T.Vector3(0,0,39)),new T.Vector3(...person.position)];
(session as any).nav={clear:()=>false};assert.equal(session.canStep(new T.Vector3(...person.position).addScaledVector(d.normal(),.1).toArray() as [number,number,number]),false);
(session as any).route=saved;(session as any).nav=undefined;
const limitTarget=d.approach().addScaledVector(d.normal(),38);assert.ok(control.walkTo(limitTarget.toArray() as [number,number,number]));
let maxCable=0;tick(45,()=>{maxCable=Math.max(maxCable,d.cableLength);assert.ok(d.cableLength<=40,'Real step-by-step walking never overextends the live cable');});
assert.ok(maxCable>38&&maxCable<=40,'Exercise the physical payout limit');assert.equal(control.phase,'idle');assert.ok(notices.some(s=>s.includes('40 m kablo sınırı')));
assert.ok(session.returnToBox());steps=0;while(session.occupied&&steps++<1200)frame();
assert.equal(session.phase,'stowed',notices.join(' | '));assert.equal(d.deployed,false);assert.equal(d.pressed,false);assert.equal(d.cableLength,0);assert.equal(d.open,false);
assert.ok(d.handle.position.distanceTo(d.dock.position)<1e-8);assert.ok(shortLength>4);
console.log(`PASS natural walking with held switch, wrist bend ${maxBend.toFixed(1)}°, continuous grounded cable, payout ${maxCable.toFixed(2)} / 40 m, return and release`);

truck.heading=37;applyTransform(root,truck);person.position=d.approach().addScaledVector(d.normal(),1).toArray() as [number,number,number];applyTransform(personRoot,person);
assert.ok(session.take());steps=0;while(session.phase!=='held'&&steps++<500)frame();assert.equal(session.phase,'held');session.press(true);
entities=[truck];frame();assert.equal(session.phase,'stowed');assert.equal(d.pressed,false);assert.equal(d.deployed,false);assert.equal(session.blocksVehicle(truck.id),false);
console.log('PASS removing an operator releases and stows the switch without an orphaned hand/cable');
actor.dispose();rig.dispose();dom.window.close();

