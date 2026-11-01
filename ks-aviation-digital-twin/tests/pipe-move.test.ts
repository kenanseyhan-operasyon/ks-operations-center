import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newEntity,validateScene,SceneHistory} from '../src/scene-data';
import {pipeRoutes,translatePipePieces} from '../src/pipe-editing';
import {localToWorld} from '../src/facility-data';
import {makeObject,applyTransform} from '../src/objects';
const a=newEntity('PIPE_RED',0,0),b=newEntity('PIPE_RED',0,2),fixed=newEntity('PIPE_VALVE',9,9);
a.facility={pipePath:[[0,1,0],[1,1,0],[3,1,0],[4,1,0]],routeEdited:true};b.facility=structuredClone(a.facility);
const entities=[a,b,fixed],before=structuredClone(entities),pieces=[{routeId:a.id+':pipePath',index:1},{routeId:b.id+':pipePath',index:1}];
const moved=translatePipePieces(entities,pieces,[.3,.5,-.2]);assert.deepEqual(moved,pieces);
for(let i=0;i<2;i++){assert.deepEqual(entities[i].facility!.pipePath![0],before[i].facility!.pipePath![0]);assert.deepEqual(entities[i].facility!.pipePath![3],before[i].facility!.pipePath![3]);for(const j of [1,2])assert.ok(entities[i].facility!.pipePath![j].every((v,k)=>Math.abs(v-before[i].facility!.pipePath![j][k]-[.3,.5,-.2][k])<1e-9));}
assert.deepEqual(fixed,before[2]);const snapshot=JSON.stringify(entities);assert.throws(()=>translatePipePieces(entities,pieces,[0,NaN,0]));assert.equal(JSON.stringify(entities),snapshot);
const source=newEntity('PIPE_RED',0,0);source.facility={pipePath:[[0,1,0],[0,1,10]]};const target=newEntity('PIPE_RED',0,0);target.facility={supplyId:source.id,pipePath:[[4,1,5],[6,1,5]],supplyRoute:[[2,1,5]]};
const network=[source,target],r=pipeRoutes(network).find(r=>r.key==='supplyRoute')!,n=r.points.length;
const result=translatePipePieces(network,[{routeId:r.id,index:0}],[.2,.3,.4]);const after=pipeRoutes(network).find(p=>p.id===r.id)!;assert.equal(after.points.length,n+1,'Combined XYZ creates only one fixed-end connector');assert.equal(result[0].index,1);assert.deepEqual(after.points[0],r.points[0]);assert.deepEqual(after.points.at(-1),r.points.at(-1));
const scene=validateScene({...JSON.parse(readFileSync('docs/backups/adb-before-fire-lines-revision-6.json','utf8')).payload,entities});const h=new SceneHistory(scene),orig=JSON.stringify(h.current.entities);h.change(()=>translatePipePieces(h.current.entities,pieces,[.1,0,0]));const saved=JSON.stringify(validateScene(h.current).entities);h.undo();assert.equal(JSON.stringify(h.current.entities),orig);h.redo();assert.equal(JSON.stringify(validateScene(h.current).entities),saved);
// The custom island must be pickable like other entities and obey stored transforms.
const island=newEntity('CANOPY',2,3);island.id='mtfhc483jg7zz9';const model=makeObject(island);assert.equal(model.userData.entityId,island.id);island.position=[4,0,7];island.heading=45;applyTransform(model,island);assert.deepEqual(model.position.toArray(),island.position);assert.equal(model.rotation.y,-Math.PI/4);
console.log('PASS XYZ translation, multiple retained sections, untouched boundary/valve points, one connector per vector edit, invalid input atomicity, undo redo reload, canopy selection identity and transform');
