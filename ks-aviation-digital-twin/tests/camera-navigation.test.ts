import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {configureWorkspaceOrbit,constrainCameraHeight,zoomFreeCamera,clickApproachOffset,CAMERA_CEILING} from '../src/camera-navigation';
import {FreeCamera} from '../src/free-camera';
import {boundedView} from '../src/static-ground';
import {portraitInput,portraitPoint,syncPortraitLock} from '../src/portrait-lock';
import {Workspace} from '../src/workspace';
import {DrivingPanel} from '../src/driving-panel';
const dom=new JSDOM('<!doctype html><body></body>',{pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','screen'])Object.defineProperty(globalThis,key,{value:(dom.window as any)[key],configurable:true});
Object.assign(globalThis,{innerWidth:1200,innerHeight:800});
function canvas(width=800,height=600,physicalWidth=width,physicalHeight=height){
  const el=document.createElement('div');document.body.append(el);Object.defineProperties(el,{clientWidth:{value:width},clientHeight:{value:height}});
  el.getBoundingClientRect=()=>({left:0,top:0,width:physicalWidth,height:physicalHeight} as DOMRect);
  el.setPointerCapture=()=>{};el.releasePointerCapture=()=>{};el.hasPointerCapture=()=>false;return el;
}
function camera(width=800,height=600){const c=new THREE.PerspectiveCamera(42,width/height,.05,30000);c.position.set(0,100,130);c.lookAt(0,0,0);c.updateMatrixWorld();return c;}
function groundAt(c:THREE.Camera,x:number,y:number,w:number,h:number){c.updateMatrixWorld();const r=new THREE.Raycaster();r.setFromCamera(new THREE.Vector2(x/w*2-1,1-y/h*2),c);return r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3())!;}
function wheel(el:HTMLElement,x:number,y:number,deltaY:number){el.dispatchEvent(new dom.window.WheelEvent('wheel',{clientX:x,clientY:y,deltaY,bubbles:true,cancelable:true}));}
function pointer(el:HTMLElement,type:string,x:number,y:number,id:number){const e=new dom.window.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true});Object.defineProperties(e,{pointerId:{value:id},pointerType:{value:'touch'}});el.dispatchEvent(e);}
for(const portrait of [false,true]){
  const w=portrait?390:800,h=portrait?844:600;Object.assign(globalThis,{innerWidth:portrait?844:w,innerHeight:portrait?390:h});syncPortraitLock(portrait);
  const el=canvas(w,h,portrait?844:w,portrait?390:h),c=camera(w,h),input=portraitInput(el),orbit=new OrbitControls(c,input);configureWorkspaceOrbit(orbit);orbit.enableDamping=false;orbit.update();
  const x=portrait?610:640,y=portrait?190:350,[lx,ly]=portraitPoint(x,y,el.getBoundingClientRect(),w,h,portrait?90:0),point=groundAt(c,lx,ly,w,h),before=point.clone().project(c),distance=c.position.distanceTo(point);
  wheel(el,x,y,-120);constrainCameraHeight(c);c.updateMatrixWorld();const after=point.clone().project(c);
  assert.ok(c.position.distanceTo(point)<distance,'Wheel moves toward the chosen point');assert.ok(Math.hypot(after.x-before.x,after.y-before.y)<1e-6,'Pointer-ground anchor survives zoom, including portrait coordinates');assert.ok(orbit.target.length()>1,'Orbit centre follows navigation');
  const zoomed=c.position.clone();wheel(el,x,y,120);assert.ok(c.position.distanceTo(point)>zoomed.distanceTo(point));
  const original=c.position.clone();pointer(el,'pointerdown',portrait?420:300,portrait?130:250,1);pointer(el,'pointerdown',portrait?420:500,portrait?270:350,2);pointer(el,'pointermove',portrait?400:530,portrait?320:410,2);pointer(el,'pointermove',portrait?440:270,portrait?100:200,1);pointer(el,'pointerup',portrait?400:530,portrait?320:410,2);pointer(el,'pointerup',portrait?440:270,portrait?100:200,1);
  assert.ok(c.position.distanceTo(original)>1,'Phone pinch/pan remains functional');assert.ok(c.position.toArray().every(Number.isFinite));orbit.dispose();
}
syncPortraitLock(false);Object.assign(globalThis,{innerWidth:800,innerHeight:600});
const el=canvas(),c=camera(),free=new FreeCamera(c,el,()=>{});free.enabled=true;free.sync();const picked=groundAt(c,650,350,800,600),orientation=c.quaternion.clone(),oldDistance=c.position.distanceTo(picked);
wheel(el,650,350,-120);assert.ok(c.position.distanceTo(picked)<oldDistance);assert.ok(c.quaternion.equals(orientation),'Free look zoom preserves viewing direction');const projection=picked.clone().project(c);assert.ok(Math.abs(projection.x-(650/800*2-1))<1e-6);
c.position.set(17000,40,-18000);free.constrain();assert.deepEqual(c.position.toArray(),[17000,40,-18000],'No raster-centred horizontal clamp');free.move(50,0,0);assert.ok(c.position.x>17000);free.move(0,0,-100);assert.equal(c.position.y,.25);c.position.y=30000;free.constrain();assert.equal(c.position.y,CAMERA_CEILING);
for(let i=0;i<100;i++)zoomFreeCamera(c,el,400,599,-120);assert.ok(c.position.y>=.25);assert.ok(c.position.toArray().every(Number.isFinite));
assert.deepEqual(boundedView([16000,-19000],200).center,[16000,-19000]);assert.equal(boundedView([0,0],1).span,15);assert.ok(boundedView([NaN,Infinity],Infinity).center.every(Number.isFinite));

// Production workspace navigation and flight without a WebGL/browser session.
let queue:FrameRequestCallback[]=[];Object.assign(globalThis,{requestAnimationFrame:(fn:FrameRequestCallback)=>{queue.push(fn);return queue.length;}});
const cam=camera(),orbit=new OrbitControls(cam,el);configureWorkspaceOrbit(orbit);let releases=0;
const scene={entities:[{id:'v',position:[40,0,-50],heading:0}],routes:[{id:'route',points:[[0,0],[0,100]]}]},initial=JSON.stringify(scene);
const ws:any=Object.create(Workspace.prototype);Object.assign(ws,{camera:cam,orbit,flight:0,freeMode:false,editing:false,airportOverview:true,selection:new Set(),history:{current:scene},plan:{enabled:false,span:200,view(center:any,span:number){this.center=center;this.span=span;}},free:{clear(){},sync(){},constrain(){constrainCameraHeight(cam);}},driving:{active:false,click:()=>false,releaseFollow:()=>{releases++;}},refreshSelection(){},updateTiles(){}});
const finish=()=>{for(let i=0;queue.length&&i<50;i++){const batch=queue;queue=[];batch.forEach(fn=>fn(performance.now()+2000));}assert.equal(queue.length,0);};
const oldOffset=cam.position.clone().sub(orbit.target),expected=clickApproachOffset(cam.position,orbit.target);
ws.clickMap(14000,-15000,undefined,false,true);finish();assert.ok(orbit.target.distanceTo(new THREE.Vector3(14000,0,-15000))<1e-6);assert.ok(cam.position.distanceTo(orbit.target.clone().add(expected))<1e-5);assert.ok(cam.position.clone().sub(orbit.target).normalize().distanceTo(oldOffset.normalize())<1e-6);assert.equal(ws.airportOverview,false);assert.ok(releases>0);assert.equal(JSON.stringify(scene),initial,'Navigation changes no scene entities or routes');
const current=cam.position.clone();ws.editing=true;ws.clickMap(0,0,'v',false,true);finish();assert.ok(cam.position.equals(current),'Selecting a design object does not move the camera');ws.editing=false;ws.clickMap(0,0,'v',false);finish();assert.ok(cam.position.equals(current),'Object-list selection does not navigate to bogus 0,0');ws.clickMap(0,0,'v',true,true);finish();assert.ok(cam.position.equals(current),'Multi-select does not navigate');
ws.driving.click=()=>true;ws.clickMap(400,-300,undefined,false,true);finish();assert.ok(cam.position.equals(current),'Route drawing consumes taps before camera navigation');
ws.driving.click=()=>false;ws.editing=true;ws.tool='MAIN_GATE';ws.draft=[];ws.updateDraft=()=>{};ws.finishDrawing=()=>{};ws.clickMap(3,8,undefined,false,true);assert.deepEqual(ws.draft,[[3,8]]);assert.ok(cam.position.equals(current),'Scene drawing consumes taps');ws.tool=undefined;
ws.driving.active=true;ws.clickMap(-14000,10000,undefined,false,true);finish();assert.ok(orbit.target.distanceTo(new THREE.Vector3(-14000,0,10000))<1e-6);assert.equal(JSON.stringify(scene),initial,'Looking elsewhere during a drive does not move the vehicle');
ws.plan.enabled=true;ws.clickMap(24000,-21000,undefined,false,true);assert.deepEqual(ws.plan.center,[24000,-21000]);assert.equal(ws.plan.span,160);
const drive:any=Object.create(DrivingPanel.prototype);drive.element=document.createElement('section');drive.follow=true;drive.updateStatus=()=>{};drive.releaseFollow();assert.equal(drive.follow,false,'Manual navigation releases vehicle camera follow');orbit.dispose();dom.window.close();
console.log('PASS: real OrbitControls cursor zoom and touch pinch in desktop/portrait layouts, free-look ray zoom, navigation beyond raster edges, click-to-go flight, driving follow release and unchanged design/route data.');
