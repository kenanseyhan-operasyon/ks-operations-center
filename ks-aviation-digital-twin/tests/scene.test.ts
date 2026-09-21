import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { importScene, validateScene, SceneHistory, moveEntities, newEntity } from '../src/scene-data';
import { local, geographic, tileOf, tileCorner } from '../src/geo';
import { aircraftLocalToWorld } from '../src/aircraft-specs';
import { setAircraftDoor } from '../src/aircraft-model';
import { DEFAULT_PHOTO, photoToWorld, validatePhoto } from '../src/photo-ground';
import { makeObject, applyTransform } from '../src/objects';

const source=JSON.parse(fs.readFileSync('public/data/adb-legacy.json','utf8'));
const scene=importScene(source);
assert.equal(scene.entities.length,61);
assert.equal(scene.groups.length,4);
assert.deepEqual(new Set(scene.entities.map(o=>o.id)),new Set(source.objects.map((o:any)=>o.id)));
assert.equal(scene.entities.filter(o=>o.kind==='aircraft').length,32);
for(const o of scene.entities){
  const original=source.objects.find((a:any)=>a.id===o.id);
  if(!o.points){const pos=geographic(o.position[0],o.position[2]);assert.ok(Math.abs(pos.lat-original.lat)<1e-9);assert.ok(Math.abs(pos.lon-original.lon)<1e-9);}
  const group=makeObject(o);const box=new THREE.Box3().setFromObject(group);assert.ok(!box.isEmpty(),`${o.name}: geometry missing`);assert.ok(box.min.toArray().every(Number.isFinite));assert.ok(box.min.y>=-.05,`${o.name}: under ground`);
  const uuid=group.uuid;const children=group.children.map(c=>c.uuid);o.position[0]+=.5;o.heading+=5;applyTransform(group,o);
  assert.equal(group.uuid,uuid);assert.deepEqual(group.children.map(c=>c.uuid),children);assert.equal(group.position.x,o.position[0]);assert.ok(group.visible);
}
const p=local(38.2798,27.1522),tile=tileOf(38.2798,27.1522,19),a=tileCorner(Math.floor(tile.x),Math.floor(tile.y),19),b=tileCorner(Math.floor(tile.x)+1,Math.floor(tile.y)+1,19);
assert.ok(p[0]>=a[0]&&p[0]<=b[0]&&p[1]>=a[1]&&p[1]<=b[1]);
const history=new SceneHistory(importScene(source)),selected=new Set(history.current.entities.slice(0,3).map(o=>o.id)),before=JSON.stringify(history.current);
history.change(d=>moveEntities(d,selected,2,-3));const moved=JSON.stringify(history.current);assert.notEqual(moved,before);assert.ok(history.undo());assert.equal(JSON.stringify(history.current),before);assert.ok(history.redo());assert.equal(JSON.stringify(history.current),moved);
history.change(d=>{d.entities=d.entities.filter(o=>!selected.has(o.id));});assert.equal(history.current.entities.length,58);assert.ok(history.undo());assert.equal(history.current.entities.length,61);
const restored=validateScene(JSON.parse(JSON.stringify(history.current)));assert.deepEqual(restored.entities.map(o=>o.position),history.current.entities.map(o=>o.position));
assert.throws(()=>importScene({schema:'KS_AIRPORT_3D_V2',airport:'BJV',objects:[]}));
const invalid=structuredClone(restored);invalid.entities[0].position[0]=NaN;assert.throws(()=>validateScene(invalid));
const duplicate=structuredClone(restored);duplicate.entities[1].id=duplicate.entities[0].id;assert.throws(()=>validateScene(duplicate));
const truck=newEntity('R14',16,20);assert.equal(truck.position[1],0);assert.ok(truck.id);
console.log('PASS: 61 legacy objects / 4 groups preserved; coordinates, ground placement, stable transforms, undo/redo, deletion recovery and import validation.');

// Operational geometry must retain dimensions and anchors after scene transforms.
for(const preset of ['A320','B737']){
  const entity=newEntity(preset,0,0),root=makeObject(entity),bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x-entity.width)<.01,`${preset} span ${size.x}`);
  assert.ok(Math.abs(size.z-entity.length)<.01,`${preset} length ${size.z}`);
  assert.ok(Math.abs(size.y-entity.height)<.01,`${preset} height ${size.y}`);
  assert.ok(Math.abs(bounds.min.y)<.01,`${preset} tyres must touch apron`);
  for(const name of ['AIRCRAFT_BODY','ENGINE_1','ENGINE_2','LEFT_WING','RIGHT_WING','SERVICE_ANCHORS'])assert.ok(root.getObjectByName(name),`${preset}: ${name}`);
  const port=root.getObjectByName('REFUEL_COUPLING_R')!;assert.ok(port);
  if(preset==='A320'){
    assert.deepEqual(port.position.toArray(),[9.83,3.65,17.59-37.57/2]);
    assert.deepEqual(root.getObjectByName('REFUEL_PANEL')!.position.toArray(),[1.8,1.8,16.4-37.57/2]);
    assert.ok(!root.getObjectByName('REFUEL_COUPLING_L'),'Optional coupling is absent by default');
    const point=port.position.clone();root.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(point.x-.015,.01,point.z+.015),new THREE.Vector3(0,1,0));
    assert.ok(ray.intersectObject(root.getObjectByName('RIGHT_WING')!,true).length,'Fuel station must meet wing geometry');
  }else assert.ok(!root.getObjectByName('GROUND_NLG'),'Unverified bonding point must not become an active anchor');
  const originalId=port.uuid;entity.position=[10,2,-40];entity.heading=90;entity.scale=1.5;applyTransform(root,entity);root.updateMatrixWorld(true);
  const position=port.getWorldPosition(new THREE.Vector3());const expected=aircraftLocalToWorld(entity,port.position.toArray());assert.ok(position.distanceTo(new THREE.Vector3(...expected))<1e-9);assert.equal(port.uuid,originalId);
  const door=root.getObjectByName('FWD_CARGO_COVER')!,doorId=door.uuid;assert.ok(setAircraftDoor(root,'FWD_CARGO',true));assert.ok(Math.abs(door.rotation.z)>1);assert.ok(setAircraftDoor(root,'FWD_CARGO',false));assert.equal(door.rotation.z,0);assert.equal(door.uuid,doorId);
}
const photo={...DEFAULT_PHOTO,enabled:true,x:123,z:-45,rotation:90,width:1000,height:400};
const corners=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>photoToWorld(photo,u,v));
assert.ok(Math.abs(corners[1][1]-corners[0][1]-1000)<1e-9);
assert.ok(Math.abs(corners[2][0]-corners[1][0]+400)<1e-9);
const photoScene=validateScene({...restored,groundPhoto:photo});assert.deepEqual(validateScene(JSON.parse(JSON.stringify(photoScene))).groundPhoto,photo);
assert.equal(validatePhoto({width:NaN,height:-4,opacity:5}).height,100);assert.equal(validatePhoto({opacity:5}).opacity,1);
console.log('PASS: aircraft dimensions, ground contact, service references, optional/pending anchors, transformed positions, persistent door nodes and photo calibration round-trip.');

// Manufacturer envelopes, loaded variants, and stable selection after a transform.
for(const preset of ['APRON_BUS','BAGGAGE_TRACTOR','BAGGAGE_CART','BAGGAGE_CART_LOADED','BELT_LOADER']){
  const entity=newEntity(preset,0,0),root=makeObject(entity),box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
  for(const [axis,expected] of [['x',entity.width],['y',entity.height],['z',entity.length]] as const)assert.ok(Math.abs(size[axis]-expected)<.011,`${preset} ${axis}: ${size[axis]} expected ${expected}`);
  assert.ok(Math.abs(box.min.y)<.003,`${preset} ground contact`);
  assert.ok(root.getObjectByName('WHEELS'));assert.ok(root.getObjectByName('BODY'));
  if(preset==='BAGGAGE_CART_LOADED')assert.equal(root.getObjectByName('BAGGAGE_LOAD')?.children.length,16);
  const node=root.uuid;entity.heading=90;entity.position=[20,0,30];applyTransform(root,entity);assert.equal(root.uuid,node);assert.equal(root.userData.entityId,entity.id);
  const copy=validateScene({...restored,entities:[entity]});assert.equal(copy.entities[0].preset,preset);assert.equal(copy.entities[0].scale,1);
}
console.log('PASS: 5 GSE envelopes, tyre ground contact, loaded luggage, persistent nodes and save round-trip.');
