import assert from 'node:assert/strict';
import { VehicleMotion,buildDrivePath,validateRoutes,type DriveRoute } from '../src/vehicle-motion';
import { validateScene,newEntity } from '../src/scene-data';
import { CloudStore,CloudConflict } from '../src/cloud-store';
const route:DriveRoute={id:'route',name:'Test',vehicleId:'truck',points:[[0,0],[0,-60],[30,-110]],speedKmh:8,approachKmh:2,approachDistance:20};
const motion=new VehicleMotion({x:0,z:0,heading:0});motion.maxKmh=8;motion.throttle=1;
for(let i=0;i<100;i++)motion.step(.05);assert.ok(motion.pose.z<-6);assert.ok(motion.speed<=8/3.6+.001);assert.equal(motion.pose.x,0);
motion.turn=1;for(let i=0;i<50;i++)motion.step(.05);assert.ok(motion.pose.x>0,'Right steering goes right');assert.equal(motion.signal,'right');
motion.brake=true;for(let i=0;i<30;i++)motion.step(.05);assert.equal(motion.speed,0,'Brake reaches zero');
motion.brake=false;motion.throttle=-1;motion.turn=0;for(let i=0;i<70;i++)motion.step(.05);assert.ok(motion.speed<0&&Math.abs(motion.speed)<=5/3.6,'Reverse is speed limited');
motion.step(.05,true,true);assert.equal(motion.speed,0,'Open equipment interlock prevents movement');
motion.throttle=1;motion.step(.1,false);assert.equal(motion.speed,0,'No engine, no drive');
assert.throws(()=>buildDrivePath([[0,0],[0,10]],0),/İlk noktayı/);
assert.throws(()=>buildDrivePath([[0,0],[0,-4],[2,-4]],0),/dar/,'Reject impossible sharp turns');
const path=buildDrivePath(route.points,0);assert.ok(path.length>100);assert.equal(path[0].heading,0);assert.ok(path.every(p=>Math.abs(p.curvature)<=Math.tan(Math.PI/5)/7*1.02));
const result=[];
for(const dt of [.016,.05]){
  const m=new VehicleMotion({x:0,z:0,heading:0});m.startRoute(route);let steps=0,approached=false,maxStep=0,last={...m.pose};
  while(m.mode==='route'&&steps++<30000){m.step(dt);maxStep=Math.max(maxStep,Math.hypot(m.pose.x-last.x,m.pose.z-last.z));last={...m.pose};if(m.remaining<15&&m.remaining>1){approached=true;assert.ok(m.speed*3.6<=2.01,'Slow approach zone honoured');}}
  assert.equal(m.mode,'complete');assert.equal(m.speed,0);assert.ok(approached);assert.ok(Math.hypot(m.pose.x-30,m.pose.z+110)<.011,'Exact parking endpoint');assert.ok(maxStep<=8/3.6*dt+.001,'No teleport');result.push(m.distance);
}
assert.ok(Math.abs(result[0]-result[1])<.02,'Frame-rate independent travel');
const paused=new VehicleMotion({x:0,z:0,heading:0});paused.startRoute(route);paused.step(.1);paused.stop();const p={...paused.pose};paused.step(.1);assert.deepEqual(paused.pose,p,'Pause does not drift');
const truck=newEntity('R14',0,0);truck.id='truck';const scene=validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',entities:[truck],groups:[],source:'test',routes:[route]});assert.equal(scene.routes![0].speedKmh,8);assert.deepEqual(validateScene(JSON.parse(JSON.stringify(scene))).routes,scene.routes,'Routes survive cloud/JSON round trip');assert.throws(()=>validateRoutes([{...route,points:[[Infinity,0],[0,0]]}]));

// Two independent devices use optimistic versions: the stale device cannot overwrite a newer save.
let revision=0,payload=scene;const auth={access_token:'fake-access',refresh_token:'fake-refresh',expires_at:Date.now()/1000+3600,user:{id:'owner',email:'test@example.test'}};
const fakeFetch=(async(url:string,options?:RequestInit)=>{
  if(url==='/cloud-config.json')return Response.json({url:'https://test.supabase.co',anonKey:'sb_publishable_test'});
  if(url.includes('/auth/'))return Response.json(auth);
  assert.ok((options?.headers as Record<string,string>).Authorization==='Bearer fake-access');
  if(url.includes('/rpc/')){const b=JSON.parse(options?.body as string);if(b.p_expected_revision!==revision)return Response.json({code:'40001',message:'Conflict'},{status:409});payload=b.p_payload;revision++;return Response.json({revision,updated_at:new Date().toISOString()});}
  return Response.json(revision?[{revision,payload,updated_at:new Date().toISOString()}]:[]);
}) as typeof fetch;
const storage=()=>{const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)||null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)} as Storage;};
const a=new CloudStore(fakeFetch,storage()),b=new CloudStore(fakeFetch,storage());await a.init();await b.init();await a.signIn('test@example.test','not-a-real-password');await b.signIn('test@example.test','not-a-real-password');
assert.equal(await a.read(),undefined);assert.equal((await a.save(scene)).revision,1);const loaded=await b.read();assert.deepEqual(loaded?.payload.routes,scene.routes);b.revision=loaded!.revision;await a.save(scene);await assert.rejects(()=>b.save(scene),CloudConflict);assert.equal(revision,2);b.signOut();await assert.rejects(()=>b.read(),/giriş/);
const offline=new CloudStore((async()=>{throw new TypeError('network offline');}) as typeof fetch,storage());await assert.rejects(()=>offline.init());
console.log('PASS: acceleration/braking/reverse/interlocks; smooth feasible routes, approach speed, exact stops at 20/60 FPS; route persistence; separate-device cloud conflict and sign-out checks.');
