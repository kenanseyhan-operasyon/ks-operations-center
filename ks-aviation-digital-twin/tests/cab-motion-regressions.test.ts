import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VehicleRig} from '../src/vehicle-rig';
import {closedAnimationPack} from '../src/model-animations';
import {NathanActor,parseNathanAccessClips} from '../src/nathan-model';
import {makeDriverAccess,driverPose,driverLanding} from '../src/nathan-driver';
import {NathanNavigation} from '../src/nathan-navigation';
import {newEntity} from '../src/scene-data';
import {applyTransform} from '../src/objects';
import {NATHAN_PRESET} from '../src/nathan-data';
import {R14} from '../src/r14-spec';
import {cabPoint} from '../src/cab-reference';

async function read(path:string){const b=fs.readFileSync(path),loader=new GLTFLoader();loader.register(()=>({name:'QA_TEXTURE',loadTexture:async()=>new T.Texture()}));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const vehicle=await read('public/models/refueller-38k-r14.glb');
closedAnimationPack(vehicle.scene,vehicle.animations);
const rig=new VehicleRig(vehicle.scene),cab=rig.cab;
for(const side of ['left','right'] as const){
  const hinge=cab.doors.get(side)!.hinge,mirror=cab.mirrors.find(m=>m.side===(side==='left'?1:-1))!;
  assert.equal(mirror.surface.parent,hinge);assert.equal(mirror.eye.parent,hinge);assert.equal(mirror.target.parent,hinge);
  const housing:T.Object3D[]=[];hinge.traverse(n=>{if(/^Mirror_(Left|Right)$/.test(n.name))housing.push(n);});assert.equal(housing.length,1);
  const pieces=[housing[0],mirror.surface,mirror.eye,mirror.target];
  const local=pieces.map(n=>hinge.worldToLocal(n.getWorldPosition(new T.Vector3())));
  cab.setDoor(side,true);
  for(let i=0;i<20;i++){cab.updateDoors(.05);pieces.forEach((n,j)=>assert.ok(hinge.worldToLocal(n.getWorldPosition(new T.Vector3())).distanceTo(local[j])<1e-7));}
  cab.setDoor(side,false);for(let i=0;i<20;i++)cab.updateDoors(.05);
}
const handles:T.Mesh[]=[];vehicle.scene.traverse(n=>{if(n instanceof T.Mesh&&/^CAB_ENTRY_.*GRIP$/.test(n.name))handles.push(n);});
assert.equal(handles.length,6);assert.ok(handles.every(m=>m.geometry instanceof T.TubeGeometry));
cab.setInside(true);assert.ok(handles.every(m=>!m.visible));assert.equal(vehicle.scene.getObjectByName('CAB_REFERENCE_ACCESS')!.visible,false);
cab.setInside(false);assert.ok(handles.every(m=>m.visible));assert.ok(cab.mirrors.every(m=>m.surface.visible));
const asset=await read('public/models/personnel/KS_Nathan_15_Hareket.glb'),actor=new NathanActor(new T.Group(),asset,1.78,{clip:'Idle',loop:true,speed:1});
const original=asset.animations.find(c=>c.name==='Idle')!,fixed=actor.clips.find(c=>c.name==='Idle')!;
let count=0;for(const track of fixed.tracks){if(!/_thumb_0[123]_[lr]\.quaternion$/.test(track.name))continue;count++;
  const rest=asset.scene.getObjectByName(track.name.split('.')[0])!.quaternion,raw=original.tracks.find(t=>t.name===track.name)!;
  for(let i=0;i<track.values.length;i+=4){const q=new T.Quaternion().fromArray(track.values,i),angle=rest.angleTo(new T.Quaternion().fromArray(raw.values,i));assert.ok(Math.abs(q.length()-1)<1e-6);assert.ok(rest.angleTo(q)<=angle*.181+1e-5);}
}assert.equal(count,6);
assert.equal(actor.clips.find(c=>c.name==='Driving'),asset.animations.find(c=>c.name==='Driving'),'Grasp clip stays untouched');
actor.motion('Driving');actor.update(.05);assert.equal(actor.settings.clip,'Idle');actor.release();assert.equal(actor.clips[actor.index].name,'Idle');assert.equal(actor.playing,false);
console.log('PASS both complete door mirrors, six curved handles, interior/exterior restoration, relaxed thumb tracks and preview/control isolation');

// A black liner and the white source floor formerly occupied the same plane.
const shell=vehicle.scene.getObjectByName('Low_Short_Cab_Shell')!;
vehicle.scene.updateWorldMatrix(true,true);
for(const x of [.35,.70,1.1])for(const z of [-.7,0,.7]){
  const ray=new T.Raycaster(new T.Vector3(...cabPoint(x,1.3,z)),new T.Vector3(0,-1,0));
  assert.ok(ray.intersectObject(shell).every(h=>Math.abs(h.point.y-cabPoint(0,1.2,0)[1])>.0001),'No painted floor beneath the rubber liner at the same height');
}
const model=vehicle.scene,metres=13.5/2.47,truck=newEntity('R14',0,0),root=new T.Group(),orient=new T.Group();
root.add(orient);orient.rotation.y=-Math.PI/2;orient.add(model);model.scale.setScalar(metres);model.position.set(-R14.centreX*metres,.454*metres,-R14.centreZ*metres);applyTransform(root,truck);
cab.setDoor('left',true);for(let i=0;i<20;i++)cab.updateDoors(.05);
asset.animations.push(...parseNathanAccessClips(JSON.parse(fs.readFileSync('public/models/personnel/nathan-access-animations.json','utf8'))));
actor.dispose();const person=newEntity(NATHAN_PRESET,0,0),personRoot=new T.Group(),worker=new NathanActor(personRoot,asset,1.78),entities=[truck,person],objects=new Map([[truck.id,root],[person.id,personRoot]]);
const access=makeDriverAccess(truck,root,new NathanNavigation(entities,.34,undefined,id=>objects.get(id),person.id))!;
assert.ok(access);
const bone=(name:string)=>worker.model.getObjectByName('rp_nathan_animated_003_walking_'+name)!;
const local=(n:T.Object3D)=>personRoot.worldToLocal(n.getWorldPosition(new T.Vector3()));
let checked=0,maxContact=0;
for(const fps of [30,60])for(const down of [false,true]){
  worker.contact();
  for(let frame=0;frame<=4*fps;frame++){
    const p=down?1-frame/(4*fps):frame/(4*fps),pose=driverPose(access,p,down);
    person.position=pose.root;person.heading=pose.heading;applyTransform(personRoot,person);
    worker.motion(p>.8?'Driving':pose.root[1]<.01?'Nathan_Original_Walk':'Climbing_Up_Ladder',.7,down&&p<=.8&&pose.root[1]>=.01);worker.contact(pose.contact);worker.update(1/fps);
    assert.ok(worker.contactRig!.errors.every(e=>e<.012),`Reach at ${fps} fps / ${down} / ${p}: ${worker.contactRig!.errors}`);
    if(pose.contact.freeHands&&pose.contact.handWeight===1&&pose.root[1]>.25&&p<.8&&Math.min(...pose.contact.feet.map(f=>f[1]))<1.15)assert.equal(worker.contactRig!.handContacts.filter(Boolean).length,2,'Both hands have distinct reachable rail contacts');
    if(!pose.groundWalk&&p<.8&&(pose.contact.handWeight??0)===1)for(const [i,c] of worker.contactRig!.handContacts.entries()){
      assert.ok(c);if(!c.gripping)continue;const assigned=access.contacts!.handGrips![i];
      const error=Math.min(...assigned.map(([a,b])=>new T.Line3(new T.Vector3(...a),new T.Vector3(...b)).closestPointToPoint(c.target,true,new T.Vector3()).distanceTo(c.target)));
      assert.ok(error<.002,`Own grip: hand ${i}, progress ${p}, down ${down}, distance ${error}`);
      const side=personRoot.worldToLocal(c.target.clone()).x;assert.ok(i?side>.08:side<-.08,'The hands never cross the body midline');
    }
    if(pose.groundWalk){assert.equal(pose.contact.handWeight,0);assert.equal(pose.contact.grips,undefined);assert.equal(pose.contact.handGrips,undefined);}
    for(const c of worker.contactRig!.handContacts){if(!c?.gripping)continue;const error=c.centre.distanceTo(c.target);maxContact=Math.max(maxContact,error);assert.ok(error<.012,'Measure the enclosed grasp centre, not just the wrist');checked++;}
    if(pose.contact.freeHands&&!pose.contact.gripGait){for(const side of ['l','r'])assert.ok(local(bone('hand_'+side)).y<local(bone('upperarm_'+side)).y-.25,'Hands are down before the ground turn');}
  }
}
assert.ok(checked>200);

// The real rim is axisymmetric. Even several steering-wheel turns must not
// carry the hands into an impossible crossed-arm position.
const seated=driverPose(access,1);person.position=seated.root;person.heading=seated.heading;applyTransform(personRoot,person);
for(const steer of [-7,-.3,0,.3,7]){
  cab.wheel.rotation.z=steer;root.updateWorldMatrix(true,true);const d=driverLanding(root,truck.heading)!;
  worker.motion('Driving');worker.contact({...seated.contact,hands:d.hands,handTangents:d.handTangents});for(let i=0;i<20;i++)worker.update(1/60);
  const hip=local(bone('hip')),head=local(bone('head'));
  assert.ok(Math.abs(head.z-hip.z)<.12,'Seated torso stays upright instead of hunching 250 mm forward');
  assert.ok(worker.contactRig!.handContacts[0]!.centre.distanceTo(worker.contactRig!.handContacts[1]!.centre)>.28,'Steering never crosses the hands');
  for(const [i,side] of ['l','r'].entries()){
    const c=worker.contactRig!.handContacts[i]!;assert.ok(c.centre.distanceTo(c.target)<.003);
    const inWheel=cab.wheel.worldToLocal(c.centre.clone());assert.ok(Math.abs(Math.hypot(inWheel.x,inWheel.y)*metres-.213)<.003,'Grasp encloses the physical rim centreline');
    const axis=new T.Vector3(0,0,1).transformDirection(bone('hand_'+side).matrixWorld);assert.ok(Math.abs(axis.dot(c.tangent))>.999,'Fingers wrap across the rim tangent');
    const proximal=bone('index_02_'+side).getWorldPosition(new T.Vector3()).sub(bone('index_01_'+side).getWorldPosition(new T.Vector3())).normalize();
    const distal=bone('index_end_'+side).getWorldPosition(new T.Vector3()).sub(bone('index_03_'+side).getWorldPosition(new T.Vector3())).normalize();
    assert.ok(proximal.dot(distal)<-.4,'Fingertips curl around the rim instead of pointing away');
  }
}
root.position.add(new T.Vector3(10,0,8));root.rotation.y+=.4;root.scale.setScalar(1.3);root.updateMatrix();
const moved=driverLanding(root,0)!;
for(const p of moved.hands){const q=cab.wheel.worldToLocal(new T.Vector3(...p));assert.ok(Math.abs(Math.hypot(q.x,q.y)*metres-.213)<.003,'Moving/scaled vehicle updates the wheel frame before solving hands');}
console.log(`PASS ${checked} actual grasp contacts at 30/60 fps, max error ${(maxContact*1000).toFixed(2)} mm; relaxed ground turn, upright seat, full-lock rim grip, noncoincident floor`);
worker.dispose();rig.dispose();
