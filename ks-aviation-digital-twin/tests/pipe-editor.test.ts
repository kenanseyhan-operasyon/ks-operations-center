import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import * as T from 'three';
import {newEntity,validateScene,SceneHistory} from '../src/scene-data';
import {pipeRoutes,writePipeRoute,transformPipeRoutes,nudgePipeSection,writeConnectedPipeRoute,pipePointLocked,straightenPipeRange} from '../src/pipe-editing';
import {pipeTubeGeometry,roundedPipeCurve,splitAtGrade,setUndergroundVisible,visibleInHierarchy} from '../src/pipe-geometry';
import {makeNetworkConnections,makeFacilityObject,updateFacilityVisual} from '../src/facility-model';
import {installSocarFireLayout,fireId,FIRE_REFERENCE,FIRE_LAYOUT_REVISION,fireFrame} from '../src/socar-fire-layout';
import {portPosition,localToWorld,worldToLocal} from '../src/facility-data';
import {fireDiagram} from '../src/socar-fire-diagram';
import {FacilityNetwork} from '../src/facility-network';
import {PipeEditor} from '../src/pipe-editor';
const scene=validateScene(JSON.parse(readFileSync('docs/backups/adb-before-fire-lines-revision-6.json','utf8')).payload);installSocarFireLayout(scene);
const get=(key:string)=>scene.entities.find(e=>e.id===fireId(key))!;
const frame=fireFrame(scene.entities)!;
for(const key of ['foam','cool']){
 const route=(k:number)=>get(`${key}-${k}-outlet`).facility!.supplyRoute!.map(p=>frame.local(localToWorld(get(`${key}-${k}-outlet`),p)));
 assert.ok(route(1).find(p=>p[2]>-30)![1]>route(2).find(p=>p[2]>-30)![1]+.4,'Tank 1 above Tank 2');
}
const loading=get('loading-outlet'),receiving=get('receiving-outlet');
const levels=[loading,receiving].map(e=>frame.local(localToWorld(e,e.facility!.supplyRoute![3]))[1]);assert.ok(Math.abs(levels[0]-levels[1])<1e-6&&levels[0]>.7,'Loading and receiving side-by-side on upper rack');
for(const k of ['loading','receiving'])assert.equal(get(k+'-valve').facility?.open,true,'Photo lever valves open');
assert.equal(get('foam-1-mixer').facility?.inlineMixer,true);assert.equal(get('foam-suction').color,'#aebbbe');
// Only the lower Tank 2 branches descend at the bay; upper runs stay horizontal.
for(const key of ['foam-1-outlet','foam-2-outlet','cool-1-outlet','cool-2-outlet','loading-outlet','receiving-outlet']){
 const e=get(key),pts=e.facility!.supplyRoute!.map(p=>frame.local(localToWorld(e,p))),lower=key==='foam-2-outlet'||key==='cool-2-outlet';
 assert.ok(Math.abs(pts[0][1]-.77)<1e-8);
 assert.ok(Math.abs(pts[1][1]-.77)<1e-8,'Straight level exit up to the corner');
 if(lower){assert.ok(Math.abs(pts[2][1]-.3)<1e-8);assert.ok(Math.hypot(pts[1][0]-pts[2][0],pts[1][2]-pts[2][2])<1e-8,'Lower branch drops vertically, never diagonally');}
}
assert.equal(scene.entities.some(e=>e.id===fireId('hose-2')),false,'No second invented hose outlet');
const perimeter=get('main-west').facility!.pipePath!.map(p=>frame.local(localToWorld(get('main-west'),p)));
assert.ok(perimeter.at(-2)![2]>29&&perimeter.at(-1)![0]>perimeter.at(-2)![0]+5,'Low line reaches the far fence corner and follows the return');
assert.ok(perimeter.slice(2).every(p=>Math.abs(p[1]-.3)<1e-8));
const loadingPoints=loading.facility!.supplyRoute!.map(p=>localToWorld(loading,p));
assert.ok(loadingPoints.every(p=>p[1]>=0),'No fabricated negative channel depth');
assert.ok(Number.isInteger(loading.facility!.unverifiedSupplySpan));
const oldHose=newEntity('FIRE_HOSE_OUTLET',3,5);oldHose.id=fireId('hose-2');oldHose.groupId=get('water-header').groupId;oldHose.facility={reference:FIRE_REFERENCE,routeEdited:true,supplyRoute:[[1,.3,0]]};
const migration=structuredClone(scene);migration.entities.push(oldHose);migration.entities.find(e=>e.id===fireId('water-header'))!.facility!.referenceRevision=5;
installSocarFireLayout(migration);assert.deepEqual({...migration.entities.find(e=>e.id===oldHose.id)!,facility:undefined},{...oldHose,facility:undefined},'An operator-edited retired outlet is retained');
const net=new FacilityNetwork();net.start(scene.entities);
const valve=get('loading-valve'),g=makeFacilityObject(valve)!;updateFacilityVisual(valve,g,net,0);assert.equal(g.getObjectByName('FACILITY_VALVE_HANDLE')!.rotation.y,0);net.operate(valve,scene.entities);updateFacilityVisual(valve,g,net,0);assert.equal(g.getObjectByName('FACILITY_VALVE_HANDLE')!.rotation.y,Math.PI/2);
for(const k of [1]){const h=get('hose-'+k);assert.equal(h.preset,'FIRE_HOSE_OUTLET');assert.equal(net.states.get(h.id)?.flowing,false);net.operate(h,scene.entities);assert.equal(net.states.get(h.id)?.fluid,'water');assert.equal(net.states.get(h.id)?.flowing,true);}
const connection=makeNetworkConnections(scene.entities),buried:T.Object3D[]=[];connection.traverse(o=>{if(o.userData.underground)buried.push(o);});assert.ok(buried.length>0);assert.ok(buried.every(o=>!o.visible&&!visibleInHierarchy(o.children[0])));setUndergroundVisible(connection,true);assert.ok(buried.every(o=>o.visible));setUndergroundVisible(connection,false);assert.ok(buried.every(o=>!o.visible));
assert.deepEqual(splitAtGrade([[0,1,0],[0,-1,0],[2,-1,0],[2,1,0]]).map(p=>p.buried),[false,true,false]);
const curve=roundedPipeCurve([[0,0,0],[2,0,0],[2,0,2]],.2);assert.deepEqual(curve.getPoint(0).toArray(),[0,0,0]);assert.deepEqual(curve.getPoint(1).toArray(),[2,0,2]);assert.ok(curve.curves.some(c=>c instanceof T.QuadraticBezierCurve3));
assert.notEqual(fireDiagram(scene.entities),fireDiagram(scene.entities,'',true),'Diagram follows the same underground toggle');
const a=newEntity('PIPE_RED',0,0),b=newEntity('PIPE_RED',1,0);a.facility={pipePath:[[0,1,0],[0,1,2],[0,1,4]]};b.facility={pipePath:[[0,1,0],[0,1,2],[0,1,4]]};const routes=pipeRoutes([a,b]),ids=new Set(routes.map(r=>r.id));
transformPipeRoutes([a,b],ids,2,1,1);assert.equal(a.facility.pipePath![2][2],5);assert.equal(b.facility.pipePath![2][2],5);assert.equal(a.facility.pipePath![0][2],0);assert.equal(b.position[0]-a.position[0],1,'Parallel spacing preserved');
const before=JSON.stringify([a,b]);assert.throws(()=>transformPipeRoutes([a,b],ids,2,-3,1));assert.equal(JSON.stringify([a,b]),before,'Invalid batch is atomic');
const anchored=pipeRoutes(scene.entities).find(r=>r.entity===loading&&r.key==='supplyRoute')!,points=structuredClone(anchored.points);points[1][1]+=.1;writePipeRoute(anchored,points);assert.deepEqual(portPosition(loading,'in'),anchored.points.at(-1));assert.equal(loading.facility?.routeEdited,true);
const bad=structuredClone(points);bad[0][0]++;assert.throws(()=>writePipeRoute(anchored,bad));
// A new reference revision must preserve the operator's own route adjustments.
get('water-header').facility!.referenceRevision=2;const edited=structuredClone(loading.facility);assert.equal(installSocarFireLayout(scene),true);assert.deepEqual({...scene.entities.find(e=>e.id===loading.id)!.facility,referenceRevision:0},{...edited,referenceRevision:0});
assert.equal(get('water-header').facility?.referenceRevision,FIRE_LAYOUT_REVISION);
// User's measured compact bay and 90 cm transverse supports.
const bayKeys=['water-header','foam-1-inlet','foam-2-inlet','foam-1-mixer','foam-2-mixer','foam-1-outlet-valve','foam-2-outlet-valve','cool-1-valve','cool-2-valve','loading-valve','receiving-valve','foam-isolation','foam-suction'];
const bayBounds=new T.Box3();let officeClearance=Infinity;
const offices=scene.entities.filter(e=>e.preset==='BUILDING'&&e.name.includes('OFİS'));
for(const key of bayKeys){const e=get(key),g=makeFacilityObject(e)!;g.updateMatrixWorld(true);g.traverse(o=>{if(!(o instanceof T.Mesh))return;const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++){
 const local=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).toArray() as [number,number,number],world=localToWorld(e,local);
 bayBounds.expandByPoint(new T.Vector3(...worldToLocal(get('water-header'),world)));
 for(const office of offices){const q=worldToLocal(office,world),dx=Math.max(0,Math.abs(q[0])-office.width/2),dz=Math.max(0,Math.abs(q[2])-office.length/2);officeClearance=Math.min(officeClearance,Math.hypot(dx,dz)*office.scale);}
}});}
const baySize=bayBounds.getSize(new T.Vector3());console.log('Measured valve bay',baySize.x,baySize.z,'office clearance',officeClearance);
assert.ok(baySize.x<=2.501&&baySize.z<=2.201,'Actual valve/flange/handle/header mesh fits 2.5 × 2.2 m');
assert.ok(officeClearance>=.9,'At least 90 cm open strip between valve bay and office');
const rack=get('pipe-rack'),rackGroup=makeFacilityObject(rack)!;const centers=rack.facility!.pipePath!,a0=new T.Vector3(...centers[0]),b0=new T.Vector3(...centers[1]),along=b0.clone().sub(a0).normalize(),across=new T.Vector3(along.z,0,-along.x);let min=Infinity,max=-Infinity;
rackGroup.updateMatrixWorld(true);rackGroup.traverse(o=>{if(!(o instanceof T.Mesh))return;const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(Math.abs(v.y-.20)<.028||Math.abs(v.y-.67)<.028){const d=v.sub(a0).dot(across);min=Math.min(min,d);max=Math.max(max,d);}}});assert.ok(Math.abs(max-min-.9)<.002,'Transverse metal bars are 90 cm');
for(const key of ['foam-1-outlet','foam-2-outlet','cool-1-outlet','cool-2-outlet']){const e=get(key),source=scene.entities.find(n=>n.id===e.facility!.supplyId)!,connectionPoints=pipeRoutes(scene.entities).find(r=>r.entity===e&&r.key==='supplyRoute')!.points,own=e.facility!.pipePath!.map(p=>localToWorld(e,p));const incoming=new T.Vector3(...connectionPoints.at(-1)!).sub(new T.Vector3(...connectionPoints.at(-2)!)).normalize(),outgoing=new T.Vector3(...own[1]).sub(new T.Vector3(...own[0])).normalize();assert.ok(incoming.dot(outgoing)>.99999,'Tank inlet seam is on a straight, never on a sharp corner');}
// Receiving header enters on a straight seam, ends downward and has working night lights.
const receiver=get('receiving-outlet'),own=receiver.facility!.pipePath!.map(p=>localToWorld(receiver,p));
const incoming=pipeRoutes(scene.entities).find(r=>r.entity===receiver&&r.key==='supplyRoute')!.points;
const v1=new T.Vector3(...incoming.at(-1)!).sub(new T.Vector3(...incoming.at(-2)!)).normalize(),v2=new T.Vector3(...own[1]).sub(new T.Vector3(...own[0])).normalize();
assert.ok(v1.dot(v2)>.9999,'Receiving inlet is a straight mesh seam');
assert.ok(own.at(-1)![1]<own.at(-2)![1]-1,'Video terminal downward return');
const roof=get('receiving-roof'),roofMesh=makeFacilityObject(roof)!,lights:T.Light[]=[];
roofMesh.traverse(n=>{if(n instanceof T.Light)lights.push(n);});assert.equal(lights.length,2);
updateFacilityVisual(roof,roofMesh,net,0,true);assert.ok(lights.every(l=>l.intensity>0&&!l.castShadow));
updateFacilityVisual(roof,roofMesh,net,0,false);assert.ok(lights.every(l=>l.intensity===0));
const dom=new JSDOM('<main></main>');for(const name of ['window','document','HTMLElement','HTMLButtonElement','HTMLInputElement','HTMLSelectElement'])Object.defineProperty(globalThis,name,{value:(dom.window as any)[name],configurable:true});
const history=new SceneHistory({...scene,entities:[a,b]});let allowed=false,message='';const editor=new PipeEditor(document.querySelector('main')!,{entities:()=>history.current.entities,edit:()=>allowed,change:fn=>history.change(()=>fn()),select:()=>{},undo:()=>{history.undo();},redo:()=>{history.redo();},notify:s=>message=s});editor.open();
const click=(s:string)=>editor.element.querySelector<HTMLButtonElement>(s)!.click();const input=(s:string,v:string)=>editor.element.querySelector<HTMLInputElement>(s)!.value=v;
click('[data-all]');input('[data-cut]','1');input('[data-delta]','100');const original=JSON.stringify(history.current.entities);click('[data-bulk]');assert.equal(JSON.stringify(history.current.entities),original,'Viewer cannot modify');
allowed=true;click('[data-bulk]');assert.notEqual(JSON.stringify(history.current.entities),original);assert.equal(history.past.length,1,'Batch uses one undo step');click('[data-undo]');assert.equal(JSON.stringify(history.current.entities),original);click('[data-redo]');assert.notEqual(JSON.stringify(history.current.entities),original);
input('[data-point="1"][data-axis-index="1"]','2');click('[data-apply]');assert.equal(history.current.entities[0].facility?.pipePath?.[1][1],2);assert.ok(message.includes('güncellendi'));
click('[data-insert="0"]');assert.equal(history.current.entities[0].facility?.pipePath?.length,4);click('[data-remove="1"]');assert.equal(history.current.entities[0].facility?.pipePath?.length,3);
const saved=validateScene(history.current);assert.equal(saved.entities[0].facility?.routeEdited,true);assert.equal(saved.entities[0].facility?.bendRadius,.16);
console.log('PASS: field rack levels, open/closed lever direction, local hose outlets, underground off/on and diagram, rounded elbows, anchored point edits, atomic parallel stretch, migration, editor access guard and undo/redo');


// Regression: every short elbow must retain its own samples even between 200 m spans.
for(const length of [2,200]){
 const c=roundedPipeCurve([[0,1,0],[length,1,0],[length,1,2]],.16),g=pipeTubeGeometry(c,.05),p=g.getAttribute('position'),radial=16;
 assert.equal(g.parameters.tubularSegments,18,'Two straight spans + 16 elbow subdivisions, independent of pipe length');
 const elbow=c.curves[1];
 for(let ring=1;ring<=17;ring++){
  const center=new T.Vector3();for(let j=0;j<radial;j++)center.add(new T.Vector3().fromBufferAttribute(p,ring*(radial+1)+j));center.divideScalar(radial);
  assert.ok(center.distanceTo(elbow.getPoint((ring-1)/16))<.00002,'Rendered ring lies on elbow, not a long chord across it');
 }
 g.dispose();
}
const wallRoutes=[loading,receiving].map(e=>e.facility!.supplyRoute!.map(p=>frame.local(localToWorld(e,p))));
for(const index of [4,5,6])assert.ok(new T.Vector3(...wallRoutes[0][index]).distanceTo(new T.Vector3(...wallRoutes[1][index]))>.2,'Loading and receiving wall routes do not occupy identical points');
console.log('PASS: long-run elbow mesh samples and separate wall pipe routes');





// Independent edits keep all other vertices, equipment and other routes fixed.
const one=newEntity('PIPE_RED',7,9);one.facility={pipePath:[[0,1,0],[0,1,2],[0,1,4],[0,1,6]]};
let routeOne=pipeRoutes([one])[0],beforeOne=structuredClone(routeOne.points);
nudgePipeSection(routeOne,[one],1,false,0,.25);routeOne=pipeRoutes([one])[0];
assert.equal(routeOne.points[1][0],beforeOne[1][0]+.25);
for(const i of [0,2,3])assert.deepEqual(routeOne.points[i],beforeOne[i]);
beforeOne=structuredClone(routeOne.points);nudgePipeSection(routeOne,[one],1,true,1,.2);routeOne=pipeRoutes([one])[0];
for(const i of [1,2])assert.equal(routeOne.points[i][1],beforeOne[i][1]+.2);
for(const i of [0,3])assert.deepEqual(routeOne.points[i],beforeOne[i]);
assert.throws(()=>nudgePipeSection(anchored,scene.entities,0,true,0,.1));
const beforeNudge=JSON.stringify(history.current.entities);input('[data-part]','1');input('[data-step]','20');click('[data-nudge-axis="2"][data-nudge-sign="1"]');
assert.notEqual(JSON.stringify(history.current.entities),beforeNudge);click('[data-undo]');assert.equal(JSON.stringify(history.current.entities),beforeNudge);click('[data-redo]');assert.notEqual(JSON.stringify(history.current.entities),beforeNudge);
console.log('PASS: isolated vertex and section edits, locked endpoints and UI undo/redo');

// User's marked DHMI route: foam-side low approach, upright rise, larger header.
const supply=get('main-feed'),header=get('water-header'),branch=get('main-west');
assert.equal(header.facility!.supplyId,supply.id);assert.equal(branch.facility!.supplyId,header.id);
assert.ok(header.facility!.pipeDiameter!>get('cool-1-outlet').facility!.pipeDiameter!*1.4);
const fp=supply.facility!.pipePath!.map(p=>localToWorld(supply,p)),hp=header.facility!.pipePath!.map(p=>localToWorld(header,p));
for(const p of fp.slice(0,-1))assert.ok(Math.abs(frame.local(p)[1]-.3)<1e-8,'DHMI stays low until its final rise');
assert.ok(Math.hypot(fp.at(-1)![0]-hp[0][0],fp.at(-1)![2]-hp[0][2])<1e-8,'Vertical inlet aligns with header');
assert.ok(Math.hypot(hp[0][0]-hp[1][0],hp[0][2]-hp[1][2])<1e-8,'Header inlet rises upright');
const port=portPosition(get('foam-2-inlet'),'in');assert.ok(new T.Vector3(...hp[1]).distanceTo(new T.Vector3(...port))<.5,'Feed reaches the foam-side end, not the opposite end');
console.log('PASS: foam-side DHMI rise, larger header and separate opposite-end perimeter branch');

// Connected pipe joints are editable, equipment ports remain fixed, and inserts retain endpoints.
const joinSource=newEntity('PIPE_RED',0,0),joinTarget=newEntity('PIPE_RED',0,0);
joinSource.facility={pipePath:[[0,1,0],[0,1,2]]};joinTarget.facility={pipePath:[[0,1,4],[0,1,6]],supplyId:joinSource.id,supplyRoute:[[1,1,3]],routeEdited:true};
const joined=[joinSource,joinTarget];let joinRoute=pipeRoutes(joined).find(r=>r.key==='supplyRoute')!;
assert.equal(pipePointLocked(joinRoute,joined,0),false);assert.equal(pipePointLocked(joinRoute,joined,joinRoute.points.length-1),false);
const jointPoints=structuredClone(joinRoute.points);jointPoints[0][0]+=.3;writeConnectedPipeRoute(joinRoute,jointPoints,joined);
assert.equal(joinSource.facility.pipePath![1][0],.3);assert.equal(joinSource.facility.routeEdited,true);
joinRoute=pipeRoutes(joined).find(r=>r.key==='supplyRoute')!;assert.deepEqual(joinRoute.points[0],jointPoints[0]);
const inserted=structuredClone(joinRoute.points);inserted.splice(1,0,[.5,1,2.5]);writeConnectedPipeRoute(joinRoute,inserted,joined);
joinRoute=pipeRoutes(joined).find(r=>r.key==='supplyRoute')!;assert.equal(joinRoute.points.length,4);
const ends=[structuredClone(joinRoute.points[0]),structuredClone(joinRoute.points.at(-1))];straightenPipeRange(joinRoute,0,3,joined);
joinRoute=pipeRoutes(joined).find(r=>r.key==='supplyRoute')!;assert.deepEqual([joinRoute.points[0],joinRoute.points.at(-1)],ends);
const jointAlong=new T.Vector3(...joinRoute.points.at(-1)!).sub(new T.Vector3(...joinRoute.points[0]));
for(const p of joinRoute.points.slice(1,-1))assert.ok(new T.Vector3(...p).sub(new T.Vector3(...joinRoute.points[0])).cross(jointAlong).length()<1e-8);
const jointSnapshot=JSON.stringify(joined),invalid=structuredClone(joinRoute.points);invalid[0]=[0,1,0];
assert.throws(()=>writeConnectedPipeRoute(joinRoute,invalid,joined));assert.equal(JSON.stringify(joined),jointSnapshot,'Invalid adjoining geometry is atomic');
console.log('PASS: editable connected pipe joints, point insertion, straightening and atomic validation');
