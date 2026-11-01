import './site-ground-fit.test';
import './ground-markings.test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {newEntity,validateScene,type Entity} from '../src/scene-data';
import {boundaryFill,curbInterior,cutPolygon,drawnFillHeight,fillHeightAt,groundFillContours,splitGroundArea,updateGroundFills} from '../src/ground-fill';
import {localToWorld,remapFacilityReferences} from '../src/facility-data';
import {pathSections,polygonArea,type Point2} from '../src/site-path';
import {makeObject,disposeObject} from '../src/objects';
import {NathanNavigation} from '../src/nathan-navigation';
import {makeNathanAccess} from '../src/nathan-access';
import {tankStairLayout} from '../src/tank-stairs';
import {makeTankAccess} from '../src/facility-model';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const curb=newEntity('CURB',0,0);curb.points=[[-10,-8],[10,-8],[10,8],[-10,8],[-9.9,-7.95]];
const fill=boundaryFill(curb,'concrete'),inside=curbInterior(curb)!;near(Math.abs(polygonArea(inside)),(20-.22)*(16-.22));near(fill.height,.2);
assert.throws(()=>boundaryFill({...curb,points:[[-10,-8],[10,-8],[10,8]]},'grass'),/kapat/,'Open boundaries must not be silently filled');
assert.equal(drawnFillHeight([[0,0],[1,0],[1,1]], [curb]),.2);
const openCurb=newEntity('CURB',2,3);openCurb.points=[[-3,0],[3,0]];openCurb.position[1]=.1;openCurb.height=.3;openCurb.scale=1.4;openCurb.heading=37;
near(drawnFillHeight([[20,20],[30,20],[30,30]],[curb,openCurb],openCurb.id),.52);
assert.equal(openCurb.points.length,2);assert.equal(openCurb.facility?.closed,undefined,'Reference height must not close the curb');
const model=makeObject(fill),bounds=new T.Box3().setFromObject(model);near(bounds.min.y,0);near(bounds.max.y,.2);
const ray=new T.Raycaster(new T.Vector3(0,2,0),new T.Vector3(0,-1,0));near(ray.intersectObject(model,true)[0].point.y,.2);disposeObject(model);
for(const reverse of [false,true]){
 const cut=splitGroundArea(curb,reverse?[12,0]:[-12,0],reverse?[-12,0]:[12,0],[0,4]),[concrete,grass]=cut;
 near(groundFillContours(concrete).reduce((s,p)=>s+Math.abs(polygonArea(p)),0)+groundFillContours(grass).reduce((s,p)=>s+Math.abs(polygonArea(p)),0),Math.abs(polygonArea(inside)));
 near(fillHeightAt(concrete,[0,4])!,.2);assert.equal(fillHeightAt(concrete,[0,-4]),undefined);near(fillHeightAt(grass,[0,-4])!,.2);
 const nav=new NathanNavigation([curb,...cut]);near(nav.surface([0,0,4]),.2);near(nav.surface([0,0,-4]),.2);near(nav.surface([25,0,0]),0);assert.equal(nav.blocked([0,.2,4]),false);
 const roundtrip=validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',entities:[curb,...cut],groups:[],source:'test'});assert.deepEqual(roundtrip.entities[1].facility?.fillCut,concrete.facility?.fillCut);assert.equal(roundtrip.entities[1].facility?.fillSide,concrete.facility?.fillSide);
 curb.position=[3,.1,7];curb.heading=37;curb.scale=1.4;curb.height=.3;updateGroundFills([curb,...cut]);const p=localToWorld(curb,[0,0,4]);near(fillHeightAt(concrete,[p[0],p[2]])!,.52);assert.deepEqual(concrete.position,curb.position);near(concrete.height,.3);curb.position=[0,0,0];curb.heading=0;curb.scale=1;curb.height=.2;
}
assert.throws(()=>splitGroundArea(curb,[-12,0],[12,0],[0,0]),/uzakta/);assert.throws(()=>splitGroundArea(curb,[-12,20],[12,20],[0,4]),/iki parçaya/);
// A line can cut a concave area into disconnected grass islands without bridging the empty notch.
const u:Point2[]=[[-4,-4],[4,-4],[4,4],[2,4],[2,-2],[-2,-2],[-2,4],[-4,4]];
const islands=cutPolygon(u,[-6,0],[6,0],1),bottom=cutPolygon(u,[-6,0],[6,0],-1);assert.equal(islands.length,2);near([...islands,...bottom].reduce((s,p)=>s+Math.abs(polygonArea(p)),0),Math.abs(polygonArea(u)));
for(const reversed of [false,true]){
 const path=pathSections(reversed?[...curb.points!].reverse():curb.points!,.22,false,.45);assert.equal(path.closed,true);
 const wall=newEntity('WALL',0,0);wall.points=[[-2,-2],[2,-2],[2,2],[-2,2],[-2,-1.95]];wall.thickness=.3;wall.height=1.8;
 const object=makeObject(wall);object.updateMatrixWorld(true);const box=new T.Box3().setFromObject(object);near(box.max.x,2.15);near(box.min.x,-2.15);near(box.min.z,-2.15);
 const hits=new T.Raycaster(new T.Vector3(-2,3,-2),new T.Vector3(0,-1,0)).intersectObject(object,true);assert.ok(hits.length,'The closing corner is physically joined');disposeObject(object);
}
const tank=newEntity('TANK',0,0);tank.facility={stairSweep:270};updateGroundFills([curb,fill,tank]);near(tankStairLayout(tank).base,.335);
const route=makeNathanAccess(tank,undefined,'tank',new NathanNavigation([curb,fill,tank]));assert.ok(route,'Nathan still accepts tank stairs above the new ground');near(route!.points[0][1],.2);assert.ok(route!.points[1][1]>.33);
updateGroundFills([tank]);near(tankStairLayout(tank).base,.135);
const tall={...fill,height:.4} as Entity;assert.equal(new NathanNavigation([tall]).blocked([0,0,0]),true,'High fill is not a walk-through obstacle');
for(const clockwise of [true,false]){
 const tank=newEntity('TANK',0,0);tank.facility={clockwise,stairSweep:270};const layout=tankStairLayout(tank),model=makeTankAccess(tank);model.updateMatrixWorld(true);
 const entry=new T.Vector3(...layout.entry),end=new T.Vector3(Math.sin(layout.start)*layout.radius,layout.base,Math.cos(layout.start)*layout.radius),mid=entry.clone().add(end).multiplyScalar(.5),d=end.clone().sub(entry),side=new T.Vector3(d.z,0,-d.x).normalize(),outer=mid.dot(side)>0?side:side.negate();mid.y=layout.base+.54;
 assert.equal(new T.Raycaster(mid,outer.clone().negate(),0,layout.width/2+.04).intersectObject(model,true).length,0,'Tank-side ground handrail is removed');assert.ok(new T.Raycaster(mid,outer,0,layout.width/2+.04).intersectObject(model,true).length,'Open outer ground handrail remains');
 const radial=new T.Vector3(Math.sin(layout.start),0,Math.cos(layout.start)),origin=radial.clone().multiplyScalar(tank.radius-.1);origin.y=.065;
 assert.ok(new T.Raycaster(origin,radial,0,1.5).intersectObject(model,true).length,'Base bracket reaches the tank wall');disposeObject(model);
}
const crossover=makeObject(newEntity('CROSSOVER_STAIR',0,0));crossover.updateMatrixWorld(true);const feet=new T.Raycaster(new T.Vector3(.525,1,2.5),new T.Vector3(0,-1,0),0,1.1).intersectObject(crossover,true);assert.ok(feet.some(h=>(h.object as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>).material.color.getHexString()==='aebbbe'),'Crossover foot is grounded grey steel');disposeObject(crossover);
const copiedPair=splitGroundArea(curb,[-12,0],[12,0],[0,4]);
const originalPairId=copiedPair[0].facility!.fillPairId;
const copied=structuredClone(copiedPair),mapping=new Map(copied.map((e,i)=>[e.id,`copy-${i}`]));
copied.forEach(e=>{e.id=mapping.get(e.id)!;});remapFacilityReferences(copied,mapping);
assert.ok(copied.every(e=>!e.facility!.fillBoundaryId),'Copies without the curb detach from the original boundary');
assert.equal(copied[0].facility!.fillPairId,copied[1].facility!.fillPairId);
assert.notEqual(copied[0].facility!.fillPairId,originalPairId,'Copied division cannot replace the original pair');
const linked=structuredClone(copiedPair);remapFacilityReferences(linked,new Map([[curb.id,'copied-curb']]));assert.ok(linked.every(e=>e.facility!.fillBoundaryId==='copied-curb'));
console.log('PASS curb-height solid concrete/grass, both divider directions, concave islands, transforms, persistence, copy references, joined corners and Nathan access above fill.');


