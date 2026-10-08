import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import * as THREE from 'three';
import {DrivingPanel} from '../src/driving-panel';
import {Workspace} from '../src/workspace';
import {PlanMap} from '../src/maps';
import {FacilityGates} from '../src/facility-gates';
import {newEntity} from '../src/scene-data';
import {r14Dimensions} from '../src/r14-spec';
import {VehicleMotion,type DriveRoute} from '../src/vehicle-motion';
import {restoreDriveCheckpoint,type DriveCheckpoint} from '../src/drive-checkpoint';
import {advanceSimulation} from '../src/simulation-clock';
import {nextRouteName} from '../src/route-management';
const dom=new JSDOM('<!doctype html><body></body>',{pretendToBeVisual:true,url:'https://test.invalid'});
for(const key of ['window','document','HTMLElement','HTMLButtonElement','Option','screen','localStorage','navigator'])Object.defineProperty(globalThis,key,{value:(dom.window as any)[key],configurable:true});
Object.assign(globalThis,{innerWidth:1200,innerHeight:800,devicePixelRatio:1,matchMedia:()=>({matches:false})});
function fixture(editor=true){
  const host=document.createElement('div');document.body.append(host);const vehicle=newEntity('R14',0,8);vehicle.id='v';
  const gate=newEntity('MAIN_GATE',0,0);gate.id='gate';gate.points=[[-6,0],[6,0]];
  const geometry=r14Dimensions(),route:DriveRoute={id:'r1',name:'3000 → Park',vehicleId:'v',reference:'front-axle',startHeading:0,points:[[0,8-geometry.frontAxleOffset],[0,-100]],speedKmh:25,approachKmh:2,approachDistance:20};
  const routes=[route,{...structuredClone(route),id:'r2'}],states:DriveCheckpoint[]=[],notices:string[]=[],running=new Set<string>(),entities=[vehicle,gate],gates=new FacilityGates();let editing=false,saves=0;
  const panel=new DrivingPanel(host,{entities:()=>entities,routes:()=>routes,driveStates:()=>states,retainDrive:(id,s)=>{const i=states.findIndex(s=>s.vehicleId===id);if(i>=0)states.splice(i,1);if(s)states.push(s);},save:()=>{saves++;},canSave:()=>editor,canDesign:()=>editing&&editor,enterDesign:()=>{editing=editor;return editor;},
    saveRoute:r=>{const i=routes.findIndex(x=>x.id===r.id);if(i<0)routes.push(r);else routes[i]=r;},removeRoute:id=>{const i=routes.findIndex(r=>r.id===id);if(i>=0)routes.splice(i,1);for(let i=states.length-1;i>=0;i--)if(states[i].routeId===id)states.splice(i,1);},checkpoint(){},changed(){},running:id=>running.has(id),engine:(id,on)=>{on?running.add(id):running.delete(id);},blocked:()=>false,wheelbase:()=>geometry.wheelbase,articulation:()=>geometry,move:(_,m)=>{vehicle.position=[m.pose.x,0,m.pose.z];vehicle.heading=m.pose.heading*180/Math.PI;vehicle.trailerAngle=m.trailerAngle;},path(){},gateWaiting:(e,m)=>gates.waiting(e,m.pose,m.speed,m.throttle<0,entities)?.id,openGate(){},notify:s=>notices.push(s),focus(){}});
  panel.open(vehicle);
  const button=(action:string)=>panel.element.querySelector<HTMLButtonElement>(`[data-drive="${action}"]`)!;
  const tap=(action:string)=>button(action).click();
  const set=(key:string,value:string)=>{const field=panel.element.querySelector<HTMLInputElement>(`[data-value="${key}"]`)!;field.value=value;field.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
  const tick=(dt:number)=>advanceSimulation(dt,panel.rate,(step,last)=>{gates.update(step,entities,running,()=>undefined);panel.tick(step,last);});
  return {panel,routes,states,vehicle,gate,gates,entities,geometry,notices,tap,button,set,tick,get saves(){return saves;},mode:(value:boolean)=>{editing=value;panel.refreshMode();}};
}
const f=fixture();
const options=[...f.panel.element.querySelectorAll<HTMLOptionElement>('[data-value="route"] option')].slice(1).map(o=>o.textContent);
assert.notEqual(options[0],options[1],'Existing duplicate names have distinct labels');
assert.ok(f.button('draw').hidden);f.tap('draw');assert.equal(f.panel.drawing,false,'Hidden controls cannot mutate routes outside design');
f.tap('enter-design');assert.equal(f.button('draw').hidden,false);
f.tap('engine');f.tap('play');for(let i=0;i<140;i++)f.tick(.05);f.tap('pause');assert.ok(f.states[0].progress>0);
const saved=structuredClone(f.states[0]),points=structuredClone(f.routes[0].points);
f.set('route-name','Tesisten uçak parkına');f.tap('rename-route');assert.equal(f.routes[0].name,'Tesisten uçak parkına');assert.equal(f.routes[0].id,'r1');assert.deepEqual(f.routes[0].points,points);assert.equal(f.states[0].routeKey,saved.routeKey);assert.equal(f.states[0].progress,saved.progress);
const restored=new VehicleMotion(saved.pose);Object.assign(restored,f.geometry);assert.ok(restoreDriveCheckpoint(restored,f.states[0],f.routes[0]),'Rename preserves halfway resume on another client');
f.set('route-name','3000 → Park');f.tap('rename-route');assert.equal(f.routes[0].name,'Tesisten uçak parkına','Duplicate rename rejected');
f.set('route-name','  ');f.tap('rename-route');assert.equal(f.routes[0].name,'Tesisten uçak parkına','Blank rename rejected');
f.set('route-name','<img src=x onerror=alert(1)>');f.tap('rename-route');assert.equal(f.panel.element.querySelector('img'),null,'Names are text, never HTML');
f.tap('delete-route');f.tap('cancel-delete');assert.equal(f.routes.length,2);assert.equal(f.states.length,1);
f.tap('resume');const position=[...f.vehicle.position];f.tap('delete-route');f.tap('confirm-delete');assert.equal(f.routes.length,1);assert.equal(f.routes[0].id,'r2');assert.equal(f.states.length,0);assert.equal(f.panel.motion!.mode,'manual');assert.deepEqual(f.vehicle.position,position);f.tap('save');assert.equal(f.saves,1);
assert.equal(nextRouteName(f.routes,'v','3000 → Park'),'3000 → Park (2)');
f.tap('draw');assert.ok(f.panel.drawing);f.panel.click(0,-150);const draft=structuredClone(f.panel.points);f.panel.refreshMode();assert.deepEqual(f.panel.points,draft,'Auth refresh preserves an authorized route draft');f.mode(false);assert.equal(f.panel.drawing,false);assert.ok(f.button('draw').hidden);f.panel.close();
const viewer=fixture(false);for(const action of ['enter-design','draw','rename-route','delete-route','confirm-delete','save'])viewer.tap(action);assert.equal(viewer.routes.length,2);assert.equal(viewer.saves,0);assert.equal(viewer.panel.drawing,false);assert.ok(viewer.button('enter-design').hidden);viewer.panel.setLanguage('en');assert.ok(viewer.panel.element.textContent!.includes('Test speed'));viewer.panel.close();

// Same real gate and articulated vehicle, 8× on phone/desktop frame rates.
function run(rate:number,fps:number){const x=fixture();x.set('test-rate',String(rate));x.tap('engine');x.tap('play');let realTime=0,waiting=false,approaching=false;
  for(let i=0;i<fps*200;i++){x.tick(1/fps);realTime+=1/fps;const m=x.panel.motion!;
    if(x.gates.amount('gate')<.99&&realTime*rate<2){assert.equal(m.progress,0);waiting=true;}
    assert.ok(Math.abs(m.trailerAngle)<=m.maxTrailerAngle);
    if(m.remaining<18&&m.mode==='route'){assert.ok(m.speed*3.6<=2.01);approaching=true;}
    if(m.mode==='complete')break;
  }
  assert.equal(x.panel.motion!.mode,'complete');assert.ok(waiting&&approaching);assert.equal(x.routes[0].speedKmh,25,'Test rate is not persisted as truck speed');const end={...x.panel.motion!.pose};x.panel.close();return {realTime,end};
}
const normal=run(1,60),fast=run(8,30);assert.ok(Math.abs(normal.realTime/fast.realTime-8)<.05);assert.ok(Math.hypot(normal.end.x-fast.end.x,normal.end.z-fast.end.z)<.01);
let total=0,max=0;advanceSimulation(.1,8,dt=>{total+=dt;max=Math.max(max,dt);});assert.ok(Math.abs(total-.8)<1e-9&&max<=.05);
const half=fixture();half.set('test-rate','8');half.tap('engine');half.tap('play');for(let i=0;i<35;i++)half.tick(1/30);half.tap('pause');assert.ok(half.states[0].progress>0);const halfMotion=new VehicleMotion(half.states[0].pose);Object.assign(halfMotion,half.geometry);assert.ok(restoreDriveCheckpoint(halfMotion,half.states[0],half.routes[0]));half.panel.close();assert.equal(half.panel.rate,1);

// The video regression: held gas/steering in an empty yard must stay responsive.
for(const lang of ['tr','en'] as const){
  const turn=fixture();turn.entities.splice(1);turn.panel.setLanguage(lang);turn.tap('engine');turn.panel.key('w',true);turn.panel.key('d',true);
  let yaw=0;for(let i=0;i<600;i++){const before=turn.panel.motion!.pose.heading;turn.tick(.05);const after=turn.panel.motion!.pose.heading;yaw+=Math.atan2(Math.sin(after-before),Math.cos(after-before));}
  const m=turn.panel.motion!;assert.ok(yaw>Math.PI*2&&m.speed>0);assert.equal(turn.notices.length,0,'Continuous forward turning must not trigger stop notifications');
  assert.ok(turn.panel.element.textContent!.includes(lang==='tr'?'Dönüş desteği':'Turn assist'));
  turn.panel.key('w',false);turn.panel.key('s',true);m.speed=0;m.trailerAngle=54*Math.PI/180;
  for(let i=0;i<150;i++)turn.tick(.05);
  assert.ok(m.articulationBlocked);assert.equal(m.turn,1,'The panel must not clear held steering at the reverse guard');assert.equal(m.throttle,-1);assert.equal(turn.notices.length,1,'Holding reverse shows one useful message');
  turn.panel.key('d',false);turn.panel.key('a',true);for(let i=0;i<100;i++)turn.tick(.05);
  assert.equal(m.articulationBlocked,false);assert.ok(m.speed<0,'Countersteering can recover without releasing/repressing the held reverse key');
  turn.panel.key('s',false);turn.panel.key('a',false);turn.panel.key('w',true);for(let i=0;i<120;i++)turn.tick(.05);
  assert.ok(m.speed>0);assert.equal(m.articulationBlocked,false);assert.equal(turn.routes.length,2);turn.panel.close();
}

// Exercise production 3D helper methods without a WebGL browser/session.
const object=new THREE.Group();object.add(new THREE.Mesh(new THREE.BoxGeometry(3,4,14)));const selected=newEntity('R14',0,0);
const workspace:any=Object.create(Workspace.prototype);Object.assign(workspace,{editing:false,plan:{enabled:false,draw(){}},scene:new THREE.Scene(),selectionBox:new THREE.Box3Helper(new THREE.Box3()),objects:new Map([[selected.id,object]]),selected:()=>[selected],routeHandles:{set(d:any){workspace.handles=d;}}});
for(const editing of [false,true,false]){workspace.editing=editing;workspace.updateSelectionBox();workspace.drawRoute({points:[[0,0],[0,-20]],handles:[[0,0],[0,-20]]});assert.equal(workspace.selectionBox.visible,editing);assert.equal(workspace.routeLine.visible,editing);assert.equal(!!workspace.handles.handles,editing);}
// Exercise actual 2D paint: selection and route colors disappear, picking data remains intact.
const strokes:string[]=[];const ctx:any=new Proxy({strokeStyle:'',measureText:()=>({width:20}),stroke(){strokes.push(this.strokeStyle);},strokeRect(){strokes.push(this.strokeStyle);}}, {get:(o,k)=>k in o?o[k]:()=>{}});
const map:any=Object.create(PlanMap.prototype);let helpers=false;Object.assign(map,{enabled:true,host:{clientWidth:800,clientHeight:600},canvas:{width:0,height:0},ctx,center:[0,0],span:100,bearing:0,imagery:{enabled:false,active:[]},draft:[],hooks:{helpersVisible:()=>helpers,entities:()=>[selected],selection:()=>new Set([selected.id]),photo:()=>undefined,route:()=>[[0,0],[0,-20]],markers:()=>[]}});
for(const visible of [false,true,false]){helpers=visible;strokes.length=0;map.paint();assert.equal(strokes.includes('#b7ff3c'),visible);assert.equal(strokes.includes('#57f7e5'),visible);}
console.log('PASS: distinct route labels, rename/delete/cancel and halfway preservation, designer/viewer controls, 8× gate/approach/trailer and resume, 2D/3D design-only helpers.');dom.window.close();
