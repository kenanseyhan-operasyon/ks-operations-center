import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { importScene, validateScene, SceneHistory, moveEntities, newEntity } from '../src/scene-data';
import { local, geographic, tileOf, tileCorner } from '../src/geo';
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
