import assert from 'node:assert/strict';
import { deviceProfile,retainedTiles,pinchView } from '../src/device';
import { groundModes,validateScene,SceneHistory } from '../src/scene-data';
import { Imagery,MapPlane,PlanMap } from '../src/maps';
import { DEFAULT_PHOTO } from '../src/photo-ground';
assert.equal(deviceProfile(393,780,true,5,3).initialView,'2d');
assert.equal(deviceProfile(844,390,true,5,3).compact,true);
assert.equal(deviceProfile(1440,900,false,0,2).initialView,'3d');
assert.equal(deviceProfile(393,780,false,0,2).pixelRatio,1.25);
const old=[{key:'a',ready:true}],next=[{key:'b',ready:false},{key:'c',ready:false}];
assert.deepEqual(retainedTiles(old,next).map(t=>t.key),['a','b','c']);
next[0].ready=true;assert.ok(retainedTiles(old,next).some(t=>t.key==='a'));
next[1].ready=true;assert.deepEqual(retainedTiles(old,next),next);
// Pinch must keep the world point between both fingers fixed, while allowing panning.
const view=pinchView([10,20],200,400,800,[120,270],[140,290],2);
assert.equal(view.span,100);
const worldBefore=[10+(120-200)*.5,20+(270-400)*.5];
assert.deepEqual([view.center[0]+(140-200)*.25,view.center[1]+(290-400)*.25],worldBefore);
assert.equal(pinchView([0,0],20,400,800,[200,400],[200,400],10).span,15);
assert.deepEqual(groundModes(undefined),{airport:'photo',facility:'satellite'});
const h=new SceneHistory(validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',entities:[],groups:[],source:'test',groundPhoto:DEFAULT_PHOTO}));
h.change(d=>d.groundModes={airport:'overlay',facility:'plan'});h.undo();assert.equal(h.current.groundModes?.airport,'photo');h.redo();assert.equal(h.current.groundModes?.airport,'overlay');
// Exercise real tile and ground mesh lifecycles with controllable asynchronous images.
const images:any[]=[];
(globalThis as any).Image=class {crossOrigin='';onload=()=>{};onerror=()=>{};src='';constructor(){images.push(this);}};
const imagery=new Imagery(),plane=new MapPlane(imagery);imagery.onChange=()=>plane.sync();
imagery.update(0,0,185);assert.equal(images.length,49);images.slice().forEach(i=>i.onload());assert.equal(plane.meshes.size,49);
const retained=imagery.active[24].key;imagery.update(0,0,3000);assert.ok(plane.meshes.has(retained),'Do not remove an existing tile before new zoom tiles arrive');
const arrivals=images.slice(49);arrivals[0].onerror();arrivals.slice(1).forEach(i=>i.onload());assert.ok(plane.meshes.has(retained),'Failed replacement must retain the prior map');
for(const mesh of plane.meshes.values()){assert.equal((mesh.material as any).depthTest,false);assert.equal((mesh.material as any).depthWrite,false);}
imagery.enabled=false;imagery.update(0,0,1);assert.equal(plane.meshes.size,0);
// Real pointer handlers: a pinch never places or moves an object; taps still select.
const handlers:any={},ctx:any={};const canvas:any={className:'',setAttribute(){},getContext(){return ctx;},addEventListener(n:string,f:any){handlers[n]=f;},setPointerCapture(){},getBoundingClientRect(){return{left:0,top:0};}};
(globalThis as any).document={createElement(){return canvas;}};
(globalThis as any).ResizeObserver=class{observe(){}};
(globalThis as any).requestAnimationFrame=()=>1;
let clicks=0,drags=0;const map=new PlanMap({clientWidth:400,clientHeight:800,appendChild(){}} as any,new Imagery(),{photo:()=>undefined,markers:()=>[],serviceClick:()=>false,entities:()=>[],selection:()=>new Set(),editable:()=>true,drawing:()=>false,click:()=>clicks++,dragStart:()=>drags++,drag(){},dragEnd(){},change(){}});
map.enabled=true;const e=(pointerId:number,clientX:number,clientY:number,type='pointerdown')=>({pointerId,clientX,clientY,type,pointerType:'touch',button:0,shiftKey:false});
handlers.pointerdown(e(1,150,400));handlers.pointerdown(e(2,250,400));handlers.pointermove(e(2,350,400,'pointermove'));assert.equal(map.span,90);
handlers.pointerup(e(2,350,400,'pointerup'));handlers.pointerup(e(1,150,400,'pointerup'));assert.equal(clicks,0);assert.equal(drags,0);
handlers.pointerdown(e(3,200,400));handlers.pointerup(e(3,200,400,'pointerup'));assert.equal(clicks,1);
console.log('PASS: phone/landscape detection, pinch world anchoring, photo defaults/history, tile failure retention, ground render depth flags and real multi-touch selection guards.');
