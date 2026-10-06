import {r14Dimensions} from '../src/r14-spec';
import assert from 'node:assert/strict';
import { VehicleMotion, type DriveRoute } from '../src/vehicle-motion';
import { captureDriveCheckpoint, restoreDriveCheckpoint, type DriveCheckpoint } from '../src/drive-checkpoint';
import { newEntity, validateScene, type SceneData } from '../src/scene-data';
import { CloudStore, CloudConflict } from '../src/cloud-store';

const route: DriveRoute = {id:'route-resume',name:'Resume test',vehicleId:'truck',points:[[0,0],[0,-60],[30,-110]],speedKmh:8,approachKmh:2,approachDistance:20};
const poseEqual = (a:VehicleMotion,b:VehicleMotion) => {
  assert.ok(Math.abs(a.trailerAngle-b.trailerAngle)<1e-8,'Resume preserves trailer angle');
  assert.ok(Math.hypot(a.pose.x-b.pose.x,a.pose.z-b.pose.z)<1e-8,'Resume preserves position');
  assert.ok(Math.abs(Math.atan2(Math.sin(a.pose.heading-b.pose.heading),Math.cos(a.pose.heading-b.pose.heading)))<1e-8,'Resume preserves heading');
};
function snapshot(m:VehicleMotion,r:DriveRoute=route):SceneData {
  const truck=newEntity('R14',m.pose.x,m.pose.z);truck.id=r.vehicleId;truck.heading=m.pose.heading*180/Math.PI;truck.trailerAngle=m.trailerAngle;truck.fuelLitres=17500;truck.name='3002';
  return validateScene(JSON.parse(JSON.stringify({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',entities:[truck],groups:[],fleetNumbers:{2000:2004,3000:3007},source:'checkpoint-test',routes:[r],driving:[captureDriveCheckpoint(truck.id,m,truck.scale)]})));
}
function reopen(scene:SceneData):VehicleMotion {
  const truck=scene.entities[0],m=new VehicleMotion({x:truck.position[0],z:truck.position[2],heading:truck.heading*Math.PI/180});
  m.wheelbase=7; // Another device may be using fallback geometry while the GLB loads.
  assert.equal(restoreDriveCheckpoint(m,scene.driving![0],scene.routes![0]),true);
  assert.equal(m.speed,0);assert.equal(m.throttle,0);assert.equal(m.turn,0);assert.equal(m.brake,false);
  return m;
}
const original=new VehicleMotion({x:.25,z:0,heading:0});Object.assign(original,r14Dimensions());original.trailerAngle=.1;original.wheelbase=6.4;original.startRoute(route);
while(original.progress<75)original.step(.016);
assert.ok(Math.abs(original.pose.heading)>.1,'Checkpoint is on a bend, not just a straight line');
const saved=snapshot(original),resumed=reopen(saved);
assert.equal(resumed.mode,'paused');assert.equal(resumed.wheelbase,original.wheelbase);
assert.deepEqual(resumed.path,original.path,'Rebuild from original start and heading');
assert.equal(resumed.progress,original.progress);assert.equal(resumed.distance,original.distance);poseEqual(original,resumed);
const updatedModel=new VehicleMotion(statePose(saved));Object.assign(updatedModel,r14Dimensions());
assert.ok(restoreDriveCheckpoint(updatedModel,{...saved.driving![0],trailer:{...saved.driving![0].trailer!,wheelbase:5.952,hitchOffset:.6285}},route));
assert.equal(updatedModel.trailerWheelbase,r14Dimensions().trailerWheelbase,'Old saves use the current model coupling geometry');
assert.equal(updatedModel.progress,original.progress);poseEqual(updatedModel,original);
for(let i=0;i<200;i++)resumed.step(.05);
poseEqual(original,resumed);assert.equal(resumed.progress,original.progress,'Restored drive must wait for Resume');
original.stop();original.mode='route';resumed.mode='route';
for(let i=0;i<30;i++){original.step(.05);resumed.step(.05);poseEqual(original,resumed);}

// Stop/reopen repeatedly on alternating device frame rates, through slow approach and completion.
let current=resumed;
for(const dt of [.016,.05,.016,.05]){
  const before=current.progress,currentScene=snapshot(current);current=reopen(currentScene);
  assert.equal(current.progress,before);current.mode='route';
  for(let i=0;i<240;i++)current.step(dt);
}
current.mode='route';let steps=0;
while(current.mode==='route'&&steps++<30000){current.step(.05);if(current.remaining<15&&current.remaining>1)assert.ok(current.speed*3.6<=2.01);}
assert.equal(current.mode,'complete');assert.equal(current.speed,0);assert.ok(Math.hypot(current.pose.x-30,current.pose.z+110)<.011);
const parked=reopen(snapshot(current));assert.equal(parked.mode,'complete');parked.step(.1);poseEqual(parked,current);

// Legacy scenes remain valid. Invalid checkpoints cannot teleport vehicles or block scene loading.
const legacy=structuredClone(saved);delete legacy.driving;assert.equal(validateScene(legacy).driving,undefined);
const state=saved.driving![0];
for(const corrupt of [{version:2},{progress:NaN},{distance:Infinity},{wheelbase:0},{scale:0},{status:'route'},{routeId:'missing'},{routeKey:'obsolete'},{pose:{...state.pose,x:100}}]){
  assert.equal(validateScene({...saved,driving:[{...state,...corrupt}]}).driving,undefined);
}
for(const edit of ['position','heading','scale','route','remove'] as const){
  const changed=structuredClone(saved);
  if(edit==='position')changed.entities[0].position[0]+=1;
  if(edit==='heading')changed.entities[0].heading+=20;
  if(edit==='scale')changed.entities[0].scale=2;
  if(edit==='route')changed.routes![0].points[1][0]+=1;
  if(edit==='remove')changed.entities=[];
  assert.equal(validateScene(changed).driving,undefined,`${edit} invalidates old drive progress`);
}
for(const corrupt of [{progress:999999},{progress:state.progress+1},{start:{...state.start,heading:Math.PI}},{status:'complete'}]){
  const target=new VehicleMotion(state.pose),before=structuredClone(target);
  assert.equal(restoreDriveCheckpoint(target,{...state,...corrupt} as DriveCheckpoint,route),false);
  assert.deepEqual(structuredClone(target),before,'Rejected resume must not change motion');
}
assert.equal(captureDriveCheckpoint('truck',new VehicleMotion(state.pose)),undefined,'Manual movement has no automatic resume');
const initial=new VehicleMotion({x:0,z:0,heading:2*Math.PI});initial.startRoute(route);assert.equal(reopen(snapshot(initial)).progress,0);

// Real CloudStore clients with isolated device storage. The transport simulates only the server.
let revision=0,payload:SceneData|undefined;
const auth={access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,user:{id:'test-owner'}};
const request=(async(url:string,init?:RequestInit)=>{
  if(url==='/cloud-config.json')return Response.json({url:'https://checkpoint-test.supabase.co',anonKey:'sb_publishable_test'});
  if(url.includes('/auth/'))return Response.json(auth);
  assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer test-token');
  if(url.includes('/rpc/')){
    const body=JSON.parse(init!.body as string);
    if(body.p_expected_revision!==revision)return Response.json({code:'40001'},{status:409});
    // JSONB storage does not preserve object key order.
    payload=JSON.parse(JSON.stringify(body.p_payload));revision++;
    return Response.json({revision,updated_at:new Date().toISOString()});
  }
  return Response.json(payload?[{revision,payload,updated_at:new Date().toISOString()}]:[]);
}) as typeof fetch;
const deviceStorage=()=>{const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)} as Storage;};
const pcStorage=deviceStorage(),phoneStorage=deviceStorage(),pc=new CloudStore(request,pcStorage),phone=new CloudStore(request,phoneStorage);
await pc.init();await phone.init();await pc.signIn('test@example.test','test-only');await phone.signIn('test@example.test','test-only');
await pc.save(saved);const onPhone=(await phone.read())!;phone.revision=onPhone.revision;
assert.equal(onPhone.payload.entities[0].fuelLitres,17500);assert.equal(onPhone.payload.entities[0].name,'3002');assert.deepEqual(onPhone.payload.fleetNumbers,{2000:2004,3000:3007});
const phoneDrive=reopen(onPhone.payload);poseEqual(phoneDrive,reopen(saved));phoneDrive.mode='route';for(let i=0;i<200;i++)phoneDrive.step(.05);
const phoneSave=snapshot(phoneDrive);await phone.save(phoneSave);
await assert.rejects(()=>pc.save(saved),CloudConflict);
const reloadPC=new CloudStore(request,pcStorage);await reloadPC.init();const backOnPC=(await reloadPC.read())!;
const pcDrive=reopen(backOnPC.payload);assert.equal(pcDrive.progress,phoneDrive.progress);poseEqual(pcDrive,phoneDrive);
assert.equal(backOnPC.revision,2);assert.notEqual(backOnPC.payload.driving![0].progress,saved.driving![0].progress);
assert.equal(backOnPC.payload.entities[0].fuelLitres,17500);assert.deepEqual(backOnPC.payload.fleetNumbers,saved.fleetNumbers);
console.log('PASS: curved halfway save/reopen/resume; unloaded model; repeated PC/phone transfers; slow approach/completion; invalid and legacy data; cloud conflict preserves latest drive.');
function statePose(scene:SceneData){const e=scene.entities[0];return {x:e.position[0],z:e.position[2],heading:e.heading*Math.PI/180};}
