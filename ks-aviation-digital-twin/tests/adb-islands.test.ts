import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateScene,newEntity} from '../src/scene-data';
import {upgradeAdbIslands} from '../src/adb-island-upgrade';
import {installSocarFireLayout} from '../src/socar-fire-layout';
import {inspectionLayout} from '../src/inspection-layout';
import {bridgeRailingOpenings,localToWorld,worldToLocal} from '../src/facility-data';
import {FuelExercise} from '../src/fuel-exercise';
import {makeFacilityObject,makeNetworkConnections} from '../src/facility-model';
import * as T from 'three';
const original=JSON.parse(fs.readFileSync('docs/backups/adb-before-fire-lines-revision-6.json','utf8')).payload,scene=validateScene(original);installSocarFireLayout(scene);const before=structuredClone(scene);
upgradeAdbIslands(scene);const once=JSON.stringify(scene);upgradeAdbIslands(scene);assert.equal(JSON.stringify(scene),once,'Upgrade is idempotent');
const changed=new Set(['mtfhc483jg7zz9','adb-fire-receiving-roof','adb-fire-foam-1-inspection','adb-fire-foam-2-inspection','adb-fire-cool-1-outlet','adb-fire-cool-2-outlet']);
for(const e of before.entities)if(!changed.has(e.id))assert.deepEqual(scene.entities.find(n=>n.id===e.id),e,`Preserve ${e.id}`);
assert.equal(scene.entities.filter(e=>e.preset==='FUEL_PUMP').length,3);
for(let k=1;k<=2;k++){
 const access=scene.entities.find(e=>e.id===`adb-fire-foam-${k}-inspection`)!,tank=scene.entities.find(e=>e.id===access.facility!.tankA)!,cool=scene.entities.find(e=>e.id===`adb-fire-cool-${k}-outlet`)!,roof=scene.entities.find(e=>e.id===`adb-roof-cooling-${k}`)!;
 const previous=before.entities.find(e=>e.id===cool.id)!;assert.deepEqual(cool.facility!.pipePath!.slice(0,3),previous.facility!.pipePath!.slice(0,3),'Keep existing vertical feed points');
 const level=cool.facility!.pipePath!.slice(cool.facility!.ringStartIndex);assert.ok(level.every(p=>Math.abs(p[1]-level[0][1])<1e-8),'Constant elevation around both stairs');
 assert.ok(roof.facility!.pipePath!.slice(roof.facility!.ringStartIndex).every(p=>Math.abs(p[1]-tank.height-.77)<1e-8),'Roof surface plus 50cm');
 const l=inspectionLayout(access),entry=worldToLocal(tank,localToWorld(access,l.roofEntry));
 assert.ok(Math.hypot(entry[0],entry[2])<tank.radius-.2,'Upper landing overlaps roof rather than opening outside');
 assert.equal(access.facility!.clockwise,false,'Flight reversed from the erroneous screenshot');
 assert.ok(bridgeRailingOpenings(tank,scene.entities).some(g=>Math.abs(Math.atan2(Math.sin(g.angle-Math.atan2(entry[0],entry[2])),Math.cos(g.angle-Math.atan2(entry[0],entry[2]))))<.001),'Roof railing has a matching entry gap');
 for(const p of roof.facility!.pipePath!.slice(roof.facility!.ringStartIndex))assert.ok(Math.abs(Math.hypot(p[0],p[2])-2.5)<1e-8,'Roof ring is exactly 5m in diameter');
 for(const p of cool.facility!.pipePath!.slice(cool.facility!.ringStartIndex)){const q=worldToLocal(tank,localToWorld(cool,p)),a=Math.atan2(q[0],q[2]),d=Math.atan2(Math.sin(a-l.start),Math.cos(a-l.start));if(d<=0&&d>=l.upperAngle-l.start)assert.ok(Math.hypot(q[0],q[2])>l.R+l.w/2+.2,'Cooling pipe stays outside the full stair/railing envelope');}
}

assert.equal(scene.entities.filter(e=>e.id.startsWith('adb-roof-cooling')).length,2);
for(const e of scene.entities.filter(e=>e.preset.startsWith('FUEL_')||e.preset==='FOAM_INSPECTION_ACCESS')){const g=makeFacilityObject(e)!;const box=new T.Box3().setFromObject(g);assert.ok(Number.isFinite(box.min.x)&&box.max.y>box.min.y);}
const f=new FuelExercise();f.hoseId=scene.entities.find(e=>e.preset==='FUEL_HOSE')!.id;f.tick(.1,scene.entities);assert.equal(f.litres,0);f.bonded=f.coupled=f.valve=f.pump=f.held=true;f.tick(.2,scene.entities);assert.equal(f.litres,1);f.held=false;f.tick(.2,scene.entities);assert.equal(f.litres,1);f.held=true;f.stopped=true;f.tick(.2,scene.entities);assert.equal(f.litres,1);f.stopped=false;f.source=1.1;f.tick(.2,scene.entities);assert.equal(f.litres,1.1);
f.reset();f.bonded=f.coupled=f.valve=f.pump=f.held=true;scene.entities.find(e=>e.id===f.hoseId)!.facility!.supplyId='missing';f.tick(.2,scene.entities);assert.equal(f.litres,0);
assert.ok(makeNetworkConnections(scene.entities).children.length>0);
console.log('Existing scene preserved; modular islands, stair geometry and fuel interlocks pass.');
