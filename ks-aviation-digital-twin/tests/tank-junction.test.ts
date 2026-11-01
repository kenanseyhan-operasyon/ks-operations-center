import assert from 'node:assert/strict';
import * as T from 'three';
import {newEntity} from '../src/scene-data';
import {bridgeAccessOpenings,bridgeRailingOpenings,updateFacilityAttachments,localToWorld,rotateTankBridge} from '../src/facility-data';
import {tankStairLayout,tankPoint} from '../src/tank-stairs';
import {makeObject,disposeObject} from '../src/objects';

// Reproduce both stair entrances in the user's screenshot, including the bridge's own rails.
for(const clockwise of [true,false])for(const heading of [0,37])for(const scale of [1,1.3]){
 const a=newEntity('TANK',-7*scale,0),b=newEntity('TANK',7*scale,0);a.heading=b.heading=heading;a.scale=b.scale=scale;
 const worldExitAngles=[Math.PI/2,-Math.PI/2];
 for(const [i,tank] of [a,b].entries())tank.facility={clockwise,stairStart:(worldExitAngles[i]*180/Math.PI+heading)-(clockwise?270:-270),stairSweep:270};
 const bridge=newEntity('TANK_BRIDGE',0,0);bridge.width=1.2*scale;bridge.facility={tankA:a.id,tankB:b.id};
 const entities=[a,b,bridge];updateFacilityAttachments(entities);
 const create=()=>entities.map(o=>makeObject(o,o.kind==='tank'?bridgeRailingOpenings(o,entities):bridgeAccessOpenings(o,entities)));
 let meshes=create();meshes.forEach(g=>g.updateMatrixWorld(true));
 for(const tank of [a,b]){
  const layout=tankStairLayout(tank),{angle,depth}=layout.roofLanding,H=layout.height;
  const flat=layout.pieces.at(-1)!;assert.equal(flat.roofLanding,true);assert.equal(flat.y0,H);assert.equal(flat.y1,H);
  const flights=layout.pieces.filter(p=>!p.landing);assert.ok(Math.abs(flights.at(-1)!.b-layout.roofLanding.entryAngle)<1e-8);assert.equal(flights.at(-1)!.y1,H);
  for(const piece of flights){assert.ok(piece.y1-piece.y0<=.185+1e-9);if(piece.y1<H-1e-8&&piece.y1>H-1){const p=tankPoint((piece.a+piece.b)/2,layout.radius,piece.y1),t=p[0]*Math.cos(angle)-p[2]*Math.sin(angle);assert.ok(t*layout.sign < -depth/2,'No lower riser is hidden under the roof landing');}}
  const tangent=new T.Vector3(Math.cos(angle),0,-Math.sin(angle)).multiplyScalar(layout.sign);
  const originLocal=tankPoint(angle,layout.radius,H+.54);originLocal[0]-=tangent.x*1.05;originLocal[2]-=tangent.z*1.05;
  const origin=new T.Vector3(...localToWorld(tank,originLocal)),end=new T.Vector3(...localToWorld(tank,tankPoint(angle,layout.radius,H+.54))),dir=end.clone().sub(origin).normalize();
  for(const radialOffset of [-.28,0,.28]){const radial=new T.Vector3(Math.sin(angle),0,Math.cos(angle)),local:[number,number,number]=[originLocal[0]+radial.x*radialOffset,originLocal[1],originLocal[2]+radial.z*radialOffset],world=new T.Vector3(...localToWorld(tank,local));
   assert.equal(new T.Raycaster(world,dir,0,1.05*scale).intersectObjects(meshes,true).length,0,'Stair → landing → bridge is clear of BOTH models’ guardrails and posts');
  }
  const {inner,outer}=layout.roofLanding,barCount=Math.max(4,Math.ceil((outer-inner)/.065)),barRadius=inner+(outer-inner)*Math.round((layout.radius-inner)/(outer-inner)*barCount)/barCount;
  for(const t of [-.35,0,.35]){const local=tankPoint(angle,barRadius,H+.5);local[0]+=Math.cos(angle)*t;local[2]-=Math.sin(angle)*t;
   const ray=new T.Raycaster(new T.Vector3(...localToWorld(tank,local)),new T.Vector3(0,-1,0),0,scale);
   const hits=ray.intersectObjects(meshes,true);assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-(tank.position[1]+H*scale))<.04*scale,JSON.stringify({clockwise,heading,scale,t,hit:hits[0].point.y,expected:tank.position[1]+H*scale})+'Landing and bridge form a level walking surface, without a high final riser');
  }
 }
 // The span's remote side must remain guarded where no stair enters it.
 const centre=localToWorld(bridge,[0,.54,0]),across=new T.Vector3(...localToWorld(bridge,[1,.54,0])).sub(new T.Vector3(...centre)).normalize();
 assert.ok(new T.Raycaster(new T.Vector3(...centre),across,0,bridge.width).intersectObject(meshes[2],true).length>0,'Middle of the bridge retains side protection');
 const originalCuts=JSON.stringify(bridgeAccessOpenings(bridge,entities));assert.ok(rotateTankBridge(bridge,entities,1));assert.notEqual(JSON.stringify(bridgeAccessOpenings(bridge,entities)),originalCuts,'Bridge rotation recalculates reciprocal openings');
 meshes.forEach(disposeObject);meshes=create();meshes.forEach(disposeObject);
 a.facility!.stairs=false;assert.equal(bridgeAccessOpenings(bridge,entities).filter(o=>o.corridor).length,1,'Removing one stair restores its bridge-side railing');
}
console.log('PASS: both real stair/bridge models, both ends/directions, rotation/scale, clear approaches, level final treads, retained guardrails and dynamic openings.');
