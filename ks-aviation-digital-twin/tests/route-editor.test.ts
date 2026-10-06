import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {DrivingPanel} from '../src/driving-panel';
import {RouteHandles} from '../src/route-handles';
import {FacilityGates} from '../src/facility-gates';
import {newEntity} from '../src/scene-data';
import {r14Dimensions} from '../src/r14-spec';
import {syncPortraitLock} from '../src/portrait-lock';
import type {DriveRoute,Point} from '../src/vehicle-motion';
import type {DriveCheckpoint} from '../src/drive-checkpoint';
import type {RouteDisplay} from '../src/route-planning';

// Offline DOM events exercise production controls without using a signed-in browser.
const dom=new JSDOM('<!doctype html><body></body>',{pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','HTMLButtonElement','Option','screen'])Object.defineProperty(globalThis,key,{value:(dom.window as any)[key],configurable:true});
Object.assign(globalThis,{innerWidth:800,innerHeight:600});
const captures=new WeakMap<HTMLElement,Set<number>>();
dom.window.HTMLElement.prototype.setPointerCapture=function(id:number){const s=captures.get(this)||new Set();s.add(id);captures.set(this,s);};
dom.window.HTMLElement.prototype.hasPointerCapture=function(id:number){return !!captures.get(this)?.has(id);};
dom.window.HTMLElement.prototype.releasePointerCapture=function(id:number){captures.get(this)?.delete(id);};
function pointer(target:Element,type:string,x:number,y:number,id=1){const e=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0});Object.defineProperties(e,{pointerId:{value:id},pointerType:{value:'touch'}});target.dispatchEvent(e);}
function fixture(z=r14Dimensions().frontAxleOffset,heading=0){
  const host=document.createElement('div');document.body.append(host);
  const vehicle=newEntity('R14',0,z);vehicle.id='v';vehicle.heading=heading;
  const gate=newEntity('MAIN_GATE',0,0);gate.points=[[-6,0],[6,0]];gate.id='gate';
  const entities=[vehicle,gate],routes:DriveRoute[]=[],states:DriveCheckpoint[]=[],running=new Set<string>(),gates=new FacilityGates(),notices:string[]=[];
  let saved=0,display:RouteDisplay={points:[]},locked=false,handles:RouteHandles|undefined;
  const panel=new DrivingPanel(host,{entities:()=>entities,routes:()=>routes,driveStates:()=>states,
    retainDrive:(id,s)=>{const i=states.findIndex(x=>x.vehicleId===id);if(i>=0)states.splice(i,1);if(s)states.push(s);},
    save:()=>saved++,saveRoute:r=>{const i=routes.findIndex(x=>x.id===r.id);if(i>=0)routes.splice(i,1);routes.push(r);},checkpoint(){},changed(){},
    running:id=>running.has(id),engine:(id,on)=>{on?running.add(id):running.delete(id);},blocked:()=>false,wheelbase:()=>r14Dimensions().wheelbase,articulation:()=>r14Dimensions(),
    move:(_,m)=>{vehicle.position=[m.pose.x,0,m.pose.z];vehicle.heading=m.pose.heading*180/Math.PI;vehicle.trailerAngle=m.trailerAngle;},
    path:d=>{display=d;handles?.set(d);},gateWaiting:(e,m)=>gates.waiting(e,m.pose,m.speed,m.throttle<0,entities)?.id,openGate:()=>{gate.gateOpen=true;},notify:s=>notices.push(s),focus(){}});
  handles=new RouteHandles(host,{world:(x,y)=>[x,y],project:p=>p,begin:i=>panel.beginPointDrag(i),move:(i,x,z)=>panel.movePoint(i,x,z),end:c=>panel.endPointDrag(c),lock:on=>{locked=on;}});
  Object.defineProperties(handles.layer,{clientWidth:{value:800,configurable:true},clientHeight:{value:600,configurable:true}});
  handles.layer.getBoundingClientRect=()=>({left:0,top:0,width:800,height:600} as DOMRect);
  const button=(name:string)=>panel.element.querySelector<HTMLButtonElement>(`[data-drive="${name}"]`)!;
  const tap=(name:string)=>button(name).click();
  const tick=(dt:number)=>{gates.update(dt,entities,running,()=>undefined);panel.tick(dt);};
  panel.open(vehicle);
  return {panel,handles,host,vehicle,gate,gates,routes,states,running,notices,button,tap,tick,get display(){return display;},get saved(){return saved;},get locked(){return locked;}};
}
const f=fixture();f.tap('draw');assert.equal(f.panel.drawing,true);assert.deepEqual(f.panel.points,[[0,0]]);
for(const [x,z] of [[0,-20],[12,-20],[30,-80]])f.panel.click(x,z);
assert.equal(f.handles.layer.querySelectorAll('button').length,4);assert.ok(f.display.danger!.some(Boolean));
f.tap('finish');assert.equal(f.routes.length,0,'Invalid route remains editable');assert.ok(f.panel.element.querySelector('[data-route-feedback]')!.textContent!.includes('Kırmızı'));
const original=structuredClone(f.panel.points),node=(i:number)=>f.handles.layer.querySelector(`[data-route-node="${i}"]`)!;
let leaked=0;f.host.addEventListener('pointermove',()=>leaked++);
pointer(node(1),'pointerdown',0,-20);assert.ok(f.locked);pointer(f.handles.layer,'pointermove',2,-22);pointer(f.handles.layer,'pointerup',2,-22);
assert.equal(f.locked,false);assert.equal(leaked,0,'Drag does not pan the map or camera');assert.deepEqual(f.panel.points[1],[2,-22]);assert.deepEqual(f.panel.points.filter((_,i)=>i!==1),original.filter((_,i)=>i!==1));
f.tap('undo-point');assert.deepEqual(f.panel.points,original);
pointer(node(1),'pointerdown',0,-20);pointer(f.handles.layer,'pointermove',4,-24);pointer(f.handles.layer,'pointercancel',4,-24);assert.deepEqual(f.panel.points,original,'Touch cancellation restores the draft');assert.equal(f.locked,false);
pointer(node(1),'pointerdown',0,-20);pointer(f.handles.layer,'pointermove',7,-24);pointer(f.host,'pointerdown',20,20,2);assert.deepEqual(f.panel.points,original,'Second finger cancels point editing');assert.equal(f.locked,false);
pointer(node(0),'pointerdown',0,0);pointer(f.handles.layer,'pointermove',3,4);pointer(f.handles.layer,'pointerup',3,4);assert.deepEqual(f.panel.points[0],[0,0],'Vehicle start stays fixed');
node(1).dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.deepEqual(f.panel.points[1],[.5,-20]);f.tap('undo-point');assert.deepEqual(f.panel.points,original);
f.tap('save');assert.equal(f.saved,0,'Unfinished draft cannot masquerade as a saved route');assert.ok(f.button('reset').disabled&&f.button('resume').disabled);
f.panel.setLanguage('en');assert.ok(f.panel.element.querySelector('[data-route-feedback]')!.textContent!.includes('Red section'));f.panel.setLanguage('tr');
f.tap('fix-point');assert.equal(f.display.danger!.some(Boolean),false);assert.deepEqual(f.panel.points.filter((_,i)=>i!==1),original.filter((_,i)=>i!==1));f.tap('finish');
assert.equal(f.panel.drawing,false);assert.equal(f.routes.length,1);assert.equal(f.routes[0].reference,'front-axle');assert.equal(f.routes[0].startHeading,0);assert.equal(f.handles.layer.hidden,true);
f.tap('save');assert.equal(f.saved,1);
const savedPoints=structuredClone(f.routes[0].points);f.tap('edit-route');f.panel.click(3,-5);assert.equal(f.panel.points.length,5);f.tap('undo-point');assert.deepEqual(f.panel.points,savedPoints);
f.panel.beginPointDrag(2);f.tap('delete-point');assert.equal(f.panel.points.length,3);f.tap('undo-point');assert.deepEqual(f.panel.points,savedPoints);f.tap('cancel');assert.deepEqual(f.routes[0].points,savedPoints);

// Landscape phone with the existing portrait lock maps touch coordinates correctly.
f.tap('edit-route');Object.defineProperties(f.handles.layer,{clientWidth:{value:600},clientHeight:{value:800}});syncPortraitLock(true);
pointer(node(1),'pointerdown',600,100);pointer(f.handles.layer,'pointermove',200,150);pointer(f.handles.layer,'pointerup',200,150);
assert.deepEqual(f.panel.points[1],[150,600]);syncPortraitLock(false);f.tap('cancel');f.panel.close();

for(const heading of [0,180]){
  const g=fixture(heading===0?8:-8,heading),m=g.panel.motion!,d=heading===0?1:-1;
  g.routes.push({id:'gate-route',name:'Through gate',vehicleId:'v',reference:'front-axle',startHeading:heading*Math.PI/180,points:[[0,d*(8-m.frontAxleOffset)],[0,-d*40]],speedKmh:8,approachKmh:2,approachDistance:10});
  g.panel.open(g.vehicle);g.tap('engine');g.tap('play');const active=g.panel.motion!;assert.equal(active.mode,'route');
  for(let i=0;i<40;i++)g.tick(.05);assert.equal(active.progress,0,'Closed gate preserves route progress while the vehicle waits');assert.equal(active.mode,'route');assert.ok(g.notices.some(s=>s.includes('Kapı açılıyor')));
  for(let i=0;i<30;i++)g.tick(.05);assert.ok(active.progress>0,'The same route resumes automatically after opening');
  g.tap('edit-route');assert.ok(g.button('resume').disabled);const progress=active.progress;g.tick(.1);assert.equal(active.progress,progress,'Editing a paused run never drives the vehicle');g.tap('cancel');g.tap('resume');assert.equal(active.mode,'route');
  let steps=0;while(active.mode==='route'&&steps++<10000)g.tick(.05);assert.equal(active.mode,'complete');
  for(let i=0;i<160;i++)g.tick(.05);assert.equal(g.gates.amount(g.gate.id),0,'Gate closes after the complete vehicle clears');g.panel.close();
}
const legacy=fixture();legacy.routes.push({id:'legacy',name:'Old route',vehicleId:'v',points:[[0,legacy.vehicle.position[2]],[0,-60]],speedKmh:8,approachKmh:2,approachDistance:20});legacy.panel.open(legacy.vehicle);
assert.ok(legacy.panel.element.querySelector('[data-route-feedback]')!.textContent!.includes('araç merkezini'));
const legacyPoints=structuredClone(legacy.routes[0].points);legacy.tap('edit-route');legacy.tap('finish');assert.equal(legacy.routes[0].reference,undefined);assert.deepEqual(legacy.routes[0].points,legacyPoints,'Editing does not silently reinterpret a legacy route');legacy.panel.close();
console.log('PASS: real DOM editor controls, localized feedback, pointer/keyboard edit and undo, touch cancellation/portrait lock, gate waiting and automatic route resume in both directions.');
dom.window.close();
