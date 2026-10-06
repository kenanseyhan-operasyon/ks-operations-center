import assert from 'node:assert/strict';
import {analyzeRoute,improveRoutePoint,routeStart,pathPoints} from '../src/route-planning';
import {VehicleMotion,type DriveRoute,type Point} from '../src/vehicle-motion';
import {refuellerDimensions} from '../src/refueller-series';
import {captureDriveCheckpoint,restoreDriveCheckpoint} from '../src/drive-checkpoint';
import {newEntity,validateScene} from '../src/scene-data';
import {CloudStore} from '../src/cloud-store';

const geometry=refuellerDimensions('R14'),points:Point[]=[[0,0],[0,-60],[30,-110]];
const route:DriveRoute={id:'front-route',name:'Front axle',vehicleId:'truck',points,reference:'front-axle',startHeading:0,speedKmh:8,approachKmh:2,approachDistance:20};
const close=(a:number,b:number,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
for(const preset of ['R14','R14_2000'])for(const dt of [.016,.05]){
  const g=refuellerDimensions(preset),m=new VehicleMotion(routeStart(points,0,g.frontAxleOffset));Object.assign(m,g);m.startRoute(route);
  let steps=0,turned=false;
  while(m.mode==='route'&&steps++<30000){
    m.step(dt);assert.equal(m.articulationBlocked,false,'Preview-feasible route must remain drivable');
    let i=m.path.findIndex(p=>p.s>=m.progress);if(i<0)i=m.path.length-1;
    const b=m.path[i],a=m.path[Math.max(0,i-1)],t=(m.progress-a.s)/(b.s-a.s||1);
    const front=[m.pose.x+Math.sin(m.pose.heading)*g.frontAxleOffset,m.pose.z-Math.cos(m.pose.heading)*g.frontAxleOffset];
    close(front[0],a.anchorX!+(b.anchorX!-a.anchorX!)*t);close(front[1],a.anchorZ!+(b.anchorZ!-a.anchorZ!)*t);
    assert.ok(Math.abs(m.steer)<=Math.PI/5*1.02+.001);
    if(m.progress>65&&m.progress<80){turned=true;assert.ok(Math.hypot(m.pose.x-front[0],m.pose.z-front[1])>5,'Line is at the axle, away from body centre');}
    if(preset==='R14')assert.ok(Math.abs(m.trailerAngle)<=g.maxTrailerAngle);
  }
  assert.equal(m.mode,'complete');assert.ok(turned);close(m.pose.x+Math.sin(m.pose.heading)*g.frontAxleOffset,30,.011);close(m.pose.z-Math.cos(m.pose.heading)*g.frontAxleOffset,-110,.011);
}
const tight:Point[]=[[0,0],[0,-20],[12,-20],[30,-80]],original=structuredClone(tight),bad=analyzeRoute(tight,0,geometry,'front-axle');
assert.ok(bad.issues.includes('steering')&&bad.issues.includes('trailer'));assert.ok(bad.danger.some(Boolean)&&bad.danger.some(x=>!x),'Highlight specific sections, not the whole route');
assert.deepEqual(bad.nodes,[1,2]);assert.deepEqual(pathPoints(bad.path)[0],tight[0]);
const improved=improveRoutePoint(tight,1,0,geometry,'front-axle')!;assert.ok(improved);assert.deepEqual(tight,original,'No in-place mutation');
assert.deepEqual(improved.filter((_,i)=>i!==1),original.filter((_,i)=>i!==1),'Only the selected point changes');
assert.equal(analyzeRoute(improved,0,geometry,'front-axle').issues.length,0);
assert.equal(improveRoutePoint(tight,0,0,geometry,'front-axle'),undefined);assert.equal(improveRoutePoint(tight,3,0,geometry,'front-axle'),undefined);
assert.ok(analyzeRoute([[0,0],[0,20]],0,geometry,'front-axle').issues.includes('start'));
assert.ok(analyzeRoute([[0,0],[0,-.1],[0,-50]],0,geometry,'front-axle').issues.includes('short'));

// A real front-axle run saves halfway through a bend and opens stopped on a second device.
const m=new VehicleMotion(routeStart(points,0,geometry.frontAxleOffset));Object.assign(m,geometry);m.startRoute(route);while(m.progress<78)m.step(.016);
const truck=newEntity('R14',m.pose.x,m.pose.z);truck.id='truck';truck.heading=m.pose.heading*180/Math.PI;truck.trailerAngle=m.trailerAngle;
const scene=validateScene(JSON.parse(JSON.stringify({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',entities:[truck],groups:[],source:'front-test',routes:[route],driving:[captureDriveCheckpoint(truck.id,m,truck.scale)]})));
assert.equal(scene.routes![0].reference,'front-axle');assert.equal(scene.driving![0].frontAxleOffset,geometry.frontAxleOffset);
let saved:unknown;const auth={access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,user:{id:'test-owner',email:'test@example.test'}};
const fakeFetch=(async(url:string,options?:RequestInit)=>{
  if(url==='/cloud-config.json')return Response.json({url:'https://test.supabase.co',anonKey:'sb_publishable_test'});
  if(url.includes('/auth/'))return Response.json(auth);
  if(url.includes('/rpc/')){saved=JSON.parse(options?.body as string).p_payload;return Response.json({revision:1,updated_at:new Date().toISOString()});}
  return Response.json([{revision:1,payload:saved,updated_at:new Date().toISOString()}]);
}) as typeof fetch;
const storage=()=>{const data=new Map();return {getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)} as Storage;};
const pc=new CloudStore(fakeFetch,storage()),phone=new CloudStore(fakeFetch,storage());await pc.init();await phone.init();await pc.signIn('test@example.test','test-only');await phone.signIn('test@example.test','test-only');await pc.save(scene);
const loaded=validateScene((await phone.read())!.payload),resumed=new VehicleMotion({...m.pose});
assert.ok(restoreDriveCheckpoint(resumed,loaded.driving![0],loaded.routes![0]));assert.equal(resumed.mode,'paused');assert.equal(resumed.speed,0);assert.deepEqual(resumed.path,m.path);assert.equal(resumed.progress,m.progress);
resumed.step(.05);assert.deepEqual(resumed.pose,m.pose,'Opening never starts the vehicle');
m.stop();m.mode='route';resumed.mode='route';
for(let i=0;i<100;i++){m.step(.05);resumed.step(.05);assert.deepEqual(resumed.pose,m.pose);close(resumed.trailerAngle,m.trailerAngle);}
const altered=structuredClone(loaded);delete altered.driving![0].frontAxleOffset;assert.equal(validateScene(altered).driving,undefined,'Malformed axle checkpoint is ignored safely');
console.log('PASS: 2000/3000 front-axle tracking at 20/60 FPS, local red sections and single-point fix, front-axle halfway cloud save/reopen/resume on independent test clients.');
