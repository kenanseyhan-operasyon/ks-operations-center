import assert from 'node:assert/strict';
import * as T from 'three';
import {newEntity} from '../src/scene-data';
import {makeObject,disposeObject} from '../src/objects';
import {conformGroundMarkings,groundSurfacePatches} from '../src/ground-markings';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<2e-5,`${a} != ${b}`);
const fill=newEntity('GRASS_FILL',0,0);fill.points=[[-2,-3],[2,-3],[2,3],[-2,3]];fill.height=.2;
const hit=(model:T.Object3D,x:number,z:number)=>{model.updateMatrixWorld(true);return new T.Raycaster(new T.Vector3(x,3,z),new T.Vector3(0,-1,0),0,4).intersectObject(model,true)[0];};
const area=(model:T.Object3D)=>{let sum=0;model.traverse(n=>{if(!(n instanceof T.Mesh))return;const g=n.geometry,p=g.getAttribute('position'),idx=g.index;for(let i=0;i<(idx?.count||p.count);i+=3){const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(n.matrixWorld));sum+=Math.abs((v[1].x-v[0].x)*(v[2].z-v[0].z)-(v[1].z-v[0].z)*(v[2].x-v[0].x))/2;}});return sum;};
const ground=newEntity('WALKWAY',0,0);ground.points=[[-5,-2],[5,-2],[5,2],[-5,2]];const original=JSON.stringify(ground),model=makeObject(ground),before=hit(model,.75,.3),beforeArea=area(model);
conformGroundMarkings(model,ground,groundSurfacePatches([fill]));near(hit(model,.75,.3).point.y,.218);near(hit(model,3,0).point.y,.018);near(hit(model,-3,0).point.y,.018);near(area(model),beforeArea);near(hit(model,.75,.3).uv!.x,before.uv!.x);near(hit(model,.75,.3).uv!.y,before.uv!.y);assert.equal(JSON.stringify(ground),original,'Saved entity is untouched');disposeObject(model);
for(const preset of ['GROUND_LINE','FOOTPRINTS','WALKWAY','HATCH_AREA','GROUND_ARROW','DRAIN']){
 const e=newEntity(preset,0,0);e.points=preset==='WALKWAY'||preset==='HATCH_AREA'?[[-1,-1],[1,-1],[1,1],[-1,1]]:[[-1,0],[1,0]];const object=makeObject(e);object.updateMatrixWorld(true);const y=new T.Box3().setFromObject(object).max.y;conformGroundMarkings(object,e,groundSurfacePatches([fill]));object.updateMatrixWorld(true);near(new T.Box3().setFromObject(object).max.y,y+.2);disposeObject(object);
}
const raised={...fill,id:'higher',height:.4},m=makeObject(ground);conformGroundMarkings(m,ground,groundSurfacePatches([fill,raised]));near(hit(m,0,0).point.y,.418);disposeObject(m);
const elevated={...ground,position:[0,.7,0] as [number,number,number]},high=makeObject(elevated);conformGroundMarkings(high,elevated,groundSurfacePatches([fill]));near(hit(high,0,0).point.y,.718);disposeObject(high);
const transformed={...ground,position:[8,0,5] as [number,number,number],heading:37,scale:1.4},tf={...fill,position:[8,.1,5] as [number,number,number],heading:37,scale:1.4},tm=makeObject(transformed);conformGroundMarkings(tm,transformed,groundSurfacePatches([tf]));near(hit(tm,8,5).point.y,.1+.2*1.4+.018*1.4);disposeObject(tm);
const concave={...fill,points:[[-4,-4],[4,-4],[4,4],[2,4],[2,-2],[-2,-2],[-2,4],[-4,4]] as [number,number][]},wide={...ground,points:[[-6,-6],[6,-6],[6,6],[-6,6]] as [number,number][]},cm=makeObject(wide);conformGroundMarkings(cm,wide,groundSurfacePatches([concave]));near(hit(cm,0,2).point.y,.018);near(hit(cm,-3,2).point.y,.218);disposeObject(cm);
const divided={...fill,facility:{fillCut:[[-4,0],[4,0]] as [[number,number],[number,number]],fillSide:1 as const}},dm=makeObject(ground);conformGroundMarkings(dm,ground,groundSurfacePatches([divided]));near(hit(dm,0,1).point.y,.218);near(hit(dm,0,-1).point.y,.018);disposeObject(dm);
const base=newEntity('GROUND',0,0);base.points=ground.points;const baseModel=makeObject(base);conformGroundMarkings(baseModel,base,groundSurfacePatches([fill]));near(hit(baseModel,0,0).point.y,.018);disposeObject(baseModel);
const tank=newEntity('TANK',0,0),tankModel=makeObject(tank),oldBounds=new T.Box3().setFromObject(tankModel).clone();conformGroundMarkings(tankModel,tank,groundSurfacePatches([fill]));assert.ok(new T.Box3().setFromObject(tankModel).equals(oldBounds));disposeObject(tankModel);
console.log('PASS markings follow fill only inside actual boundaries; UVs, area, transforms, raised objects and scene data preserved.');
