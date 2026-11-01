import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {validateScene} from '../src/scene-data';
import {repairAdbPipePassages} from '../src/adb-pipe-passages';
import {localToWorld,worldToLocal} from '../src/facility-data';
import {drainSegments,insideDrainOpening,pipeTrenchSections} from '../src/drain-geometry';
import {makeObject} from '../src/objects';
const before=validateScene(JSON.parse(fs.readFileSync('tests/fixtures/adb-passages-r18.json','utf8'))),scene=structuredClone(before);
assert.equal(repairAdbPipePassages(scene),true);assert.equal(repairAdbPipePassages(scene),false);
const loading=scene.entities.find(e=>e.id==='adb-fire-loading-outlet')!,receiving=scene.entities.find(e=>e.id==='adb-fire-receiving-outlet')!,roof=scene.entities.find(e=>e.id==='adb-fire-receiving-roof')!;
for(const e of [loading,receiving])assert.deepEqual(e.facility!.supplyRoute!.slice(0,6),before.entities.find(x=>x.id===e.id)!.facility!.supplyRoute!.slice(0,6),'valve and upstream route preserved');
for(const e of before.entities.filter(e=>![loading.id,receiving.id].includes(e.id)))assert.deepEqual(scene.entities.find(x=>x.id===e.id),e,'other saved objects untouched');
const access=scene.entities.filter(e=>e.id.startsWith('adb-passage-'));assert.equal(access.length,2);
for(const e of access){assert.equal(e.facility!.trenchDepth,.5);assert.equal(e.facility!.trenchGrate,false);const floor=makeObject(e).getObjectByName('DRAIN_FLOOR')!;assert.ok(Math.abs(new T.Box3().setFromObject(floor).max.y+.5)<1e-6);const d=drainSegments([e])[0],p:[number,number,number]=[(d.a[0]+d.b[0])/2,.15,(d.a[2]+d.b[2])/2];assert.equal(insideDrainOpening(p,[d]),true,'opening cuts concrete curb height');p[1]=.4;assert.equal(insideDrainOpening(p,[d]),false,'upper concrete stays intact');}
const p=loading.facility!.supplyRoute!.map(p=>localToWorld(loading,p));assert.equal(p.filter(p=>Math.abs(p[1]+.18)<1e-7).length,4);const parts=pipeTrenchSections(p.slice(7,11),scene.entities);assert.ok(parts.every(p=>p.exposed),'pipe visible throughout channel and both concrete passages');
const r=receiving.facility!.pipePath!.map(p=>worldToLocal(roof,localToWorld(receiving,p)));
assert.ok(Math.abs(r[3][0])<1e-8&&Math.abs(r[4][0])<1e-8,'header on roof centre');assert.ok(Math.abs(r[3][2]+r[4][2])<1e-8,'start, midpoint and terminal outlet symmetric');
for(let i=1;i<r.length-1;i++){const a=new T.Vector3(...r[i]).sub(new T.Vector3(...r[i-1])).normalize(),b=new T.Vector3(...r[i+1]).sub(new T.Vector3(...r[i])).normalize();assert.ok(Math.abs(a.dot(b))<1e-8,'roof elbows 90 degrees');}
const roundtrip=validateScene(scene);for(const e of access)assert.deepEqual(roundtrip.entities.find(x=>x.id===e.id)!.facility,e.facility,'opening settings persist');
const edited=structuredClone(before),target=edited.entities.find(e=>e.id===loading.id)!;target.facility!.supplyRoute![6][0]+=.01;const saved=JSON.stringify(target);repairAdbPipePassages(edited);assert.equal(JSON.stringify(target),saved);assert.equal(edited.entities.filter(e=>e.id.startsWith('adb-passage-')).length,0,'later route not overwritten');
console.log('PASS revision18 route preservation, symmetric receiving header, right-angle elbows, 50cm passages, visible channel pipe and saved opening settings');
