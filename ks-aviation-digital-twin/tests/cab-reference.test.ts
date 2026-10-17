import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VehicleRig} from '../src/vehicle-rig';
import {closedAnimationPack} from '../src/model-animations';
import {R14} from '../src/r14-spec';
import {newEntity} from '../src/scene-data';
import {applyTransform,makeObject} from '../src/objects';
import {NATHAN_PRESET} from '../src/nathan-data';
import {NathanActors,parseNathanAccessClips} from '../src/nathan-model';
import {NathanNavigation} from '../src/nathan-navigation';
import {makeDriverAccess,driverPose} from '../src/nathan-driver';
async function read(path:string){const b=fs.readFileSync(path),l=new GLTFLoader();l.register(()=>({name:'QA_TEXTURE',loadTexture:async()=>new T.Texture()}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const vehicle=await read('public/models/refueller-38k-r14.glb'),model=vehicle.scene,pack=closedAnimationPack(model,vehicle.animations),rig=new VehicleRig(model);
const metres=13.5/2.47,bounds=(name:string)=>new T.Box3().setFromObject(model.getObjectByName(name)!,true);
model.updateWorldMatrix(true,true);
const close=(got:number,want:number,label:string,tolerance=.001)=>assert.ok(Math.abs(got-want)<tolerance,`${label}: ${got} expected ${want}`);
// Expected numbers are transcribed independently from the manufacturer's
// printed p.42, not imported from the implementation's configuration.
const floor=bounds('CAB_FLOOR'),roof=bounds('CAB_HEADLINER'),shell=bounds('Low_Short_Cab_Shell');
close(floor.getSize(new T.Vector3()).z*metres,2,'2,000 mm clear interior width');
close((roof.min.y-floor.max.y)*metres,1.51,'1,510 mm interior headroom');
close(shell.getSize(new T.Vector3()).x*metres,1.65,'1,650 mm day cab length');
close((bounds('Low_Roof_Cap').max.y-floor.max.y)*metres,1.591,'1,591 mm exterior floor to roof');
close((bounds('CAB_FRONT_FENDER_LEFT').max.z-bounds('CAB_FRONT_FENDER_RIGHT').min.z)*metres,2.49,'2,490 mm fender envelope');
const rim=model.getObjectByName('STEERING_RIM') as T.Mesh;rim.geometry.computeBoundingBox();close(rim.geometry.boundingBox!.getSize(new T.Vector3()).x*metres,.45,'450 mm steering wheel');
for(const side of ['LEFT','RIGHT']){
 const steps=[1,2,3].map(i=>bounds(`CAB_ACCESS_STEP_${side}_${i}`));
 for(const [i,rise] of [.277,.286,.263].entries())close(((steps[i+1]?.max.y??floor.max.y)-steps[i].max.y)*metres,rise,'Manufacturer tread rise');
 for(const b of steps)assert.ok(b.max.x<R14.frontAxle-R14.tyreRadius-.025/metres,'Every cab tread precedes the full tyre by at least 25 mm');
}
close((rig.wheels.find(w=>w.front)!.pivot.position.x+.8958)*metres,1.510,'Drawing-derived axle location');
assert.equal(model.getObjectByName('Cab_Lower_Reference_Correction'),undefined,'Remove obsolete step/fender corrections');
// The front tyre must remain clear of the fixed platform flight at full lock.
const stairs:T.Object3D[]=[];model.traverse(n=>{if(n.name.startsWith('Fixed_Step'))stairs.push(n);});
for(const steer of [-.55,0,.55]){rig.update(0,steer,0);model.updateWorldMatrix(true,true);for(const wheel of rig.wheels.filter(w=>w.front))for(const step of stairs)assert.ok(!new T.Box3().setFromObject(wheel.spin,true).intersectsBox(new T.Box3().setFromObject(step,true)),'Steered front tyre clears platform treads');}
rig.update(0,0,0);rig.cab.setDoor('left',true);for(let i=0;i<20;i++)rig.cab.updateDoors(.05);
close(Math.abs(rig.cab.doors.get('left')!.hinge.rotation.y),Math.PI/2,'90 degree complete door');
for(const name of ['DRIVER_DOOR_PANEL','Door_Left','DOOR_STEP_COVER']){const candidates:T.Object3D[]=[];model.traverse(n=>{if(n.name===name)candidates.push(n);});assert.ok(candidates.some(n=>{for(let p=n.parent;p;p=p.parent)if(p.name==='DRIVER_DOOR_HINGE')return true;return false;}),`${name} follows door`);}
console.log('PASS manufacturer dimensions: 2490 / 1650 / 2000 / 1510 / 1591 / 450 mm; 277 / 286 / 263 mm tread rises; tyre clearance at steering lock; complete 90° door');

const truck=newEntity('R14',0,0),root=new T.Group(),orient=new T.Group();root.add(orient);orient.rotation.y=-Math.PI/2;orient.add(model);model.scale.setScalar(metres);model.position.set(-R14.centreX*metres,.454*metres,-R14.centreZ*metres);applyTransform(root,truck);root.updateWorldMatrix(true,true);
const asset=await read('public/models/personnel/KS_Nathan_15_Hareket.glb');asset.animations.push(...parseNathanAccessClips(JSON.parse(fs.readFileSync('public/models/personnel/nathan-access-animations.json','utf8'))));
const person=newEntity(NATHAN_PRESET,0,0),personRoot=makeObject(person),entities=[truck,person],objects=new Map([[truck.id,root],[person.id,personRoot]]),actors=new NathanActors(()=>{},async()=>asset);actors.sync(entities,objects);await new Promise(r=>setTimeout(r,0));const actor=actors.states.get(person.id)!.actor!;
const access=makeDriverAccess(truck,root,new NathanNavigation(entities,.34,undefined,id=>objects.get(id),person.id))!;
assert.ok(access);
const cabCoords=(point:T.Vector3)=>{const p=model.worldToLocal(point.clone());return new T.Vector3((p.x+.8958)*metres,(p.y+.454)*metres,(p.z-.155)*metres);};
let roofIntrusion=0,doorIntrusion=0,floorIntrusion=0,maxHead=-Infinity;const collisions:Record<string,number>={};
for(const down of [false,true]){
 actor.contact();
 for(let i=0;i<=100;i++){
  const p=down?1-i/100:i/100,pose=driverPose(access,p,down);person.position=pose.root;person.heading=pose.heading;applyTransform(personRoot,person);actor.motion(p>.8?'Driving':pose.root[1]<.01?'Nathan_Original_Walk':'Climbing_Up_Ladder',.7,down&&p<=.8&&pose.root[1]>=.01);actor.contact(pose.contact);actor.update(.05);
  assert.ok(actor.contactRig!.errors.every(e=>e<.035),`Foot/hand targets remain reachable ${down?'down':'up'} ${p}: ${actor.contactRig!.errors}`);
  if(pose.root[1]>.12&&p<.8&&Math.min(...pose.contact.feet.map(f=>f[1]))<1.15)assert.equal(actor.contactRig!.errors.length,4,`Both hands remain on reachable rails at ${down?'down':'up'} ${p}`);
  // Inspect actual skinned surface vertices against the solid floor, roof and
  // open door plane; this supplements limb-target tests with body clearance.
  actor.model.traverse(n=>{if(!(n instanceof T.SkinnedMesh))return;
   const indices=n.geometry.index?.array||Array.from({length:n.geometry.attributes.position.count},(_,i)=>i),seen=new Set<number>();
   for(const index of indices){if(seen.has(index))continue;seen.add(index);
    const world=n.getVertexPosition(index,new T.Vector3()).applyMatrix4(n.matrixWorld),q=cabCoords(world);
    if(q.z<1.10&&q.z>-.9&&q.x>.10&&q.x<1.6)maxHead=Math.max(maxHead,q.y);
    if(q.z<.99&&q.z>-.99&&q.x>.10&&q.x<1.60&&q.y>2.714&&q.y<2.80)roofIntrusion++;
    if(q.z<.99&&q.z>-.99&&q.x>.10&&q.x<1.60&&q.y>1.17&&q.y<1.195){floorIntrusion++;const key='floor '+down+' '+p.toFixed(2)+' '+n.skeleton.bones[n.geometry.attributes.skinIndex.getX(index)].name;collisions[key]=(collisions[key]||0)+1;}
    if(q.x>.045&&q.x<.095&&q.z>1.2&&q.z<2.55&&q.y>1.3&&q.y<2.50){doorIntrusion++;const key='door '+down+' '+p.toFixed(2)+' '+n.skeleton.bones[n.geometry.attributes.skinIndex.getX(index)].name;collisions[key]=(collisions[key]||0)+1;}
   }
  });
 }
}
if(roofIntrusion||floorIntrusion||doorIntrusion)console.log('COLLISIONS',JSON.stringify(collisions));
console.log('BODY CLEARANCE',JSON.stringify({roofIntrusion,floorIntrusion,doorIntrusion,maxHead}));
assert.equal(roofIntrusion,0,'Skinned body must remain below the cab roof while entering/exiting');
assert.equal(doorIntrusion,0,'Skinned body must not pass through the open door leaf');
assert.equal(floorIntrusion,0,'Skinned body must not pass through the solid cab floor');
rig.dispose();actors.sync([],new Map());console.log('PASS 202 sampled boarding/alighting body poses: head, door leaf and floor clearance');
