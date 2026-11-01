import assert from 'node:assert/strict';
import * as T from 'three';
import {newEntity,validateScene,SceneHistory} from '../src/scene-data';
import {tankStairLayout,stairSweepTo,tankPoint,rotateTankStairs} from '../src/tank-stairs';
import {accessPath} from '../src/personnel-navigation';
import {bridgeRailingOpenings,localToWorld,validateFacility} from '../src/facility-data';
import {makeTankAccess} from '../src/facility-model';
import {connectRail} from '../src/tank-rail-connections';
import {makeTankLogos} from '../src/tank-logo';
import {disposeObject} from '../src/objects';

for(const clockwise of [true,false])for(const heading of [0,37,-125]){
 const tank=newEntity('TANK',7,-3);tank.heading=heading;tank.scale=1.4;
 const base=tankPoint(1.1,tank.radius+1.5,.135),exit=tankPoint(-.7,tank.radius-.6,tank.height+.27);
 tank.facility={stairs:true,clockwise,stairStart:1.1*180/Math.PI,stairSweep:stairSweepTo(tank,base,exit,clockwise),stairBase:base,stairExit:exit};
 const layout=tankStairLayout(tank),path=accessPath(tank)!;
 assert.ok(layout.pieces.filter(p=>p.landing).length>=3,'Tall tanks have intermediate landings');
 for(const p of layout.pieces){assert.ok(p.y1-p.y0<=.185+1e-9,'Every riser remains below 185 mm');if(p.landing&&!p.roofLanding){assert.equal(p.y0,p.y1);assert.ok(Math.abs(p.b-p.a)*layout.radius>=1.19,'Landing walking length is retained');}}
 assert.deepEqual(path[0],localToWorld(tank,base));assert.deepEqual(path.at(-1),localToWorld(tank,exit),'Operator exits at the exact selected roof point');
 const end=tankPoint(layout.start+layout.sweep,tank.radius,0);assert.ok(Math.abs(Math.atan2(Math.sin(Math.atan2(end[0],end[2])+.7),Math.cos(Math.atan2(end[0],end[2])+.7)))<1e-8,'Either direction reaches the selected azimuth');
 const before=structuredClone(tank),rotated=rotateTankStairs(tank.facility,37),turned=tankStairLayout({...tank,facility:rotated});
 assert.equal(turned.pieces.length,layout.pieces.length);assert.equal(rotated.stairSweep,tank.facility.stairSweep);assert.equal(rotated.clockwise,clockwise);assert.deepEqual(tank,before,'Rotation does not mutate the tank or original settings');
 const angle=37*Math.PI/180;for(let i=0;i<layout.path.length;i++){const [x,y,z]=layout.path[i],q=turned.path[i];assert.ok(Math.abs(q[0]-(Math.cos(angle)*x+Math.sin(angle)*z))<1e-8);assert.equal(q[1],y);assert.ok(Math.abs(q[2]-(-Math.sin(angle)*x+Math.cos(angle)*z))<1e-8,'Every stair point, landing and picked end follows the same rigid rotation');}
 const inverse=rotateTankStairs(rotated,-37);for(const key of ['stairBase','stairExit'] as const)assert.ok(inverse[key]!.every((n,i)=>Math.abs(n-tank.facility![key]![i])<1e-8));
 const geometry=makeTankAccess(tank);const bounds=new T.Box3().setFromObject(geometry);assert.ok(bounds.min.y>=0,'Access never shifts the complete tank upward');disposeObject(geometry);
 const data=validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',source:'test',entities:[tank],groups:[]});assert.deepEqual(data.entities[0].facility,tank.facility);
 const history=new SceneHistory(data);history.change(d=>{d.entities[0].facility!.clockwise=!clockwise});history.undo();assert.equal(history.current.entities[0].facility?.clockwise,clockwise);
}
const crossing={angle:0,halfAngle:.2,corridor:{start:[0,11,-3] as [number,number,number],end:[0,11,3] as [number,number,number],width:1.2}};
const clipped=connectRail([-2,11,0],[2,11,0],[crossing]);assert.equal(clipped.length,2);assert.ok(clipped[0].b[0]<-.6&&clipped[1].a[0]>.6);assert.ok(clipped[0].joinB&&clipped[1].joinA,'Both railing cut ends connect to bridge sides');
assert.equal(connectRail([-2,4,0],[2,4,0],[crossing]).length,1,'A bridge overhead does not remove stair railings below it');
assert.equal(connectRail([-2,11,7],[2,11,7],[crossing]).length,1,'Rails past either bridge end stay intact');
// The final flight must not leave internal posts or diagonal rails in the roof landing.
for(const clockwise of [true,false])for(const stairStart of [0,37]){
 const tank=newEntity('TANK',0,0);tank.facility={clockwise,stairStart,stairSweep:270};
 const layout=tankStairLayout(tank),top=layout.start+layout.sweep,H=layout.height;
 const access=makeTankAccess(tank);access.updateMatrixWorld(true);
 const radial=new T.Vector3(Math.sin(top),0,Math.cos(top)),tangent=new T.Vector3(Math.cos(top),0,-Math.sin(top));
 for(const offset of [-.3,0,.3])for(const h of [.3,.54,.85]){
  const origin=radial.clone().multiplyScalar(tank.radius-.6).addScaledVector(tangent,offset);origin.y=H+h;
  assert.equal(new T.Raycaster(origin,radial,0,layout.radius+.2-(tank.radius-.6)).intersectObject(access,true).length,0,'Roof landing walking width is clear in both stair directions');
 }
 const boundary=radial.clone().multiplyScalar(layout.radius+.7);boundary.y=H+.54;
 assert.ok(new T.Raycaster(boundary,radial.clone().negate(),0,.5).intersectObject(access,true).length>0,'Outer landing guardrail is retained');
 disposeObject(access);
}
for(const clockwise of [true,false]){
 const tank=newEntity('TANK',0,0);tank.facility={clockwise,stairStart:clockwise?-180:180,stairSweep:270};
 const bridge=newEntity('TANK_BRIDGE',0,0),H=tank.height+.27;bridge.width=.9;
 bridge.facility={bridgeStart:{parentId:tank.id,point:[tank.radius-.6,H,0]},bridgeEnd:{point:[tank.radius+8,H,0]}};
 const access=makeTankAccess(tank,bridgeRailingOpenings(tank,[tank,bridge]));access.updateMatrixWorld(true);
 for(const offset of [-.3,0,.3])for(const h of [.3,.54,.85])assert.equal(new T.Raycaster(new T.Vector3(tank.radius-.6,H+h,offset),new T.Vector3(1,0,0),0,3).intersectObject(access,true).length,0,'A bridge through the upper landing has no blocking tank or stair rail');
 disposeObject(access);
}
const endCut=connectRail([0,11,-4],[0,11,0],[crossing]);assert.equal(endCut.length,1);assert.equal(endCut[0].joinB,undefined,'A corridor end cut must not add a diagonal connector across the walking lane');
// Only the open outer edge of the tank-hugging flight has a handrail.
for(const clockwise of [true,false]){
 const tank=newEntity('TANK',0,0);tank.facility={clockwise,stairSweep:270};const layout=tankStairLayout(tank),piece=layout.pieces.find(p=>!p.landing&&p.y1>2)!;
 const angle=(piece.a+piece.b)/2,y=(piece.y0+piece.y1)/2+.54,access=makeTankAccess(tank);access.updateMatrixWorld(true);
 const origin=new T.Vector3(...tankPoint(angle,layout.radius,y)),inward=new T.Vector3(-Math.sin(angle),0,-Math.cos(angle));
 assert.equal(new T.Raycaster(origin,inward,0,layout.width/2+.1).intersectObject(access,true).length,0,'No flight rail is generated against the tank wall');
 assert.ok(new T.Raycaster(origin,inward.clone().negate(),0,layout.width/2+.1).intersectObject(access,true).length>0,'The outer flight handrail remains');disposeObject(access);
}
const tank=newEntity('TANK',0,0),logos=makeTankLogos(tank);assert.equal(logos.children.length,2);const a=logos.children[0] as T.Mesh,b=logos.children[1] as T.Mesh;a.geometry.computeBoundingBox();b.geometry.computeBoundingBox();assert.ok(a.geometry.boundingBox!.max.x>0&&b.geometry.boundingBox!.min.x<0,'Logo meshes occupy opposite tank faces');
assert.equal(makeTankLogos({...tank,facility:{logoEnabled:false}}).children.length,0);
assert.equal(validateFacility({logoData:'data:image/svg+xml;base64,AAAA'})?.logoData,undefined,'Only bitmap uploads are saved');
const saved=validateFacility({logoData:'data:image/png;base64,AAAA',logoEnabled:true,logoAngle:60,logoWidth:4,stairExit:[1,11,2]});assert.equal(saved?.logoData,'data:image/png;base64,AAAA');assert.deepEqual(saved?.stairExit,[1,11,2]);disposeObject(logos);
console.log('PASS: both stair directions, exact entry/exit, horizontal landings, riser height, transforms, persistence/undo, same-level rail connections, overhead separation and opposite logos.');
