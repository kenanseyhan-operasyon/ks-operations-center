import assert from 'node:assert/strict';
import * as THREE from 'three';
import {newEntity,validateScene,SceneHistory} from '../src/scene-data';
import {bridgeAnchorWorld,bridgeSpan,bridgeRailingOpenings,localToWorld,updateFacilityAttachments,remapFacilityReferences} from '../src/facility-data';
import {pickBridgeAnchor} from '../src/tank-bridge';
import {makeObject,disposeObject} from '../src/objects';

const a=newEntity('TANK',-7,0),b=newEntity('TANK',8,0);a.heading=31;b.heading=-24;b.height=12;
const entities=[a,b],meshes=entities.map(e=>makeObject(e));meshes.forEach(g=>g.updateMatrixWorld(true));
function pick(target:THREE.Vector3,start?:Parameters<typeof pickBridgeAnchor>[3]){const origin=target.clone().add(new THREE.Vector3(0,15,16)),ray=new THREE.Raycaster(origin,target.clone().sub(origin).normalize());return pickBridgeAnchor(ray,ray.intersectObjects(meshes,true),entities,start);}
const firstWorld=new THREE.Vector3(-5,11.28,1),start=pick(firstWorld);assert.equal(start?.parentId,a.id);
assert.ok(new THREE.Vector3(...bridgeAnchorWorld(start!,entities)!).distanceTo(firstWorld)<.001,'Roof selection retains the visible point, not the ground projection');
assert.equal(pick(new THREE.Vector3(-25,0,15)),undefined,'Ground cannot start a tank bridge');
assert.equal(pick(new THREE.Vector3(-6,11.28,0),start),undefined,'Both ends cannot select the same tank');
const lastWorld=new THREE.Vector3(6,12.28,-1),end=pick(lastWorld,start);assert.equal(end?.parentId,b.id);
const free=pick(new THREE.Vector3(23,11.28,4),start);assert.equal(free?.parentId,undefined);assert.equal(bridgeAnchorWorld(free!,entities)![1],11.28,'A free endpoint keeps the starting roof height');
const bridge=newEntity('TANK_BRIDGE',0,0);bridge.width=1.4;bridge.facility={tankA:a.id,tankB:b.id,bridgeStart:start,bridgeEnd:end};entities.push(bridge);updateFacilityAttachments(entities);
const span=bridgeSpan(bridge,entities)!;assert.ok(new THREE.Vector3(...span.start).distanceTo(firstWorld)<.001);assert.ok(new THREE.Vector3(...span.end).distanceTo(lastWorld)<.001);assert.equal(bridge.facility.bridgeRise,1);

for(const tank of [a,b]){
  const gaps=bridgeRailingOpenings(tank,entities);assert.equal(gaps.length,1,'Each actual bridge crossing opens one passage');
  const g=makeObject(tank,gaps);g.updateMatrixWorld(true);const rail=g.getObjectByName('TANK_ROOF_RAILING')!;assert.ok(rail);
  const angle=gaps[0].angle;
  // Cast through three parallel walking paths across the actual bridge width.
  const s=span.start,e=span.end,dir=new THREE.Vector3(e[0]-s[0],0,e[2]-s[2]).normalize(),side=new THREE.Vector3(dir.z,0,-dir.x);
  for(const offset of [-.6,0,.6]){const origin=new THREE.Vector3(...s).addScaledVector(side,offset);origin.y=tank.position[1]+(tank.height+.81)*tank.scale;const ray=new THREE.Raycaster(origin,dir,0,bridge.length);assert.equal(ray.intersectObject(rail,true).length,0,'The walking width is clear of tank rails and posts');}
  const opposite=angle+Math.PI*.7,from=localToWorld(tank,[0,tank.height+.81,0]),to=localToWorld(tank,[Math.sin(opposite)*(tank.radius+1),tank.height+.81,Math.cos(opposite)*(tank.radius+1)]),direction=new THREE.Vector3(...to).sub(new THREE.Vector3(...from)).normalize();
  assert.ok(new THREE.Raycaster(new THREE.Vector3(...from),direction).intersectObject(rail,true).length>0,'Other sections of roof railing remain present');disposeObject(g);
}
const previous=bridgeSpan(bridge,entities)!;a.position[0]+=3;a.heading+=20;a.height+=2;updateFacilityAttachments(entities);const moved=bridgeSpan(bridge,entities)!;assert.equal(moved.start[1],previous.start[1]+2);assert.notDeepEqual(moved.start,previous.start);assert.deepEqual(moved.end,previous.end);
const data=validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',entities,groups:[],source:'bridge-test'});assert.deepEqual(data.entities[2].facility,bridge.facility,'Both surface anchors survive the existing cloud JSON format');
const history=new SceneHistory(data);history.change(d=>{d.entities=d.entities.filter(o=>o.id!==bridge.id);});assert.equal(bridgeRailingOpenings(a,history.current.entities).length,0,'Deleting a bridge restores the railing');history.undo();assert.equal(bridgeRailingOpenings(a,history.current.entities).length,1);
const copies=structuredClone(entities),mapping=new Map([[a.id,'a-copy'],[b.id,'b-copy']]);remapFacilityReferences(copies,mapping);assert.equal(copies[2].facility?.bridgeStart?.parentId,'a-copy');assert.equal(copies[2].facility?.bridgeEnd?.parentId,'b-copy');
meshes.forEach(disposeObject);
console.log('PASS: real roof ray picking, elevated two-point spans, oblique railing clearance across full bridge width, tank motion/height, deletion/undo and saved anchors.');
