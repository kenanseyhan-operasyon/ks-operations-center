import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { portraitViewport,portraitPoint,portraitInput,syncPortraitLock } from '../src/portrait-lock';
import { toggleNativeFullscreen } from '../src/fullscreen';
assert.deepEqual(portraitViewport(393,740,true),{width:393,height:740,turn:0});
assert.deepEqual(portraitViewport(844,390,true),{width:390,height:844,turn:90});
assert.equal(portraitViewport(844,390,true,270).turn,-90);
assert.deepEqual(portraitViewport(1440,900,false),{width:1440,height:900,turn:0});
const rect={left:10,top:20,width:844,height:390};
assert.deepEqual(portraitPoint(854,20,rect,390,844,90),[0,0]);
assert.deepEqual(portraitPoint(10,410,rect,390,844,90),[390,844]);
assert.deepEqual(portraitPoint(10,410,rect,390,844,-90),[0,0]);

// Exercise real OrbitControls: pointer-down on canvas, moves/up on document.
const doc:any=Object.assign(new EventTarget(),{body:{classList:{toggle(){}},style:{setProperty(){}}},fullscreenElement:null});
Object.assign(globalThis,{innerWidth:844,innerHeight:390,screen:{orientation:{angle:90}},document:doc});
const canvas:any=Object.assign(new EventTarget(),{style:{},clientWidth:390,clientHeight:844,ownerDocument:doc,getRootNode:()=>doc,getBoundingClientRect:()=>rect,setPointerCapture(){},releasePointerCapture(){},hasPointerCapture(){return false;}});
syncPortraitLock(true);const input=portraitInput(canvas);
const camera=new THREE.PerspectiveCamera(42,390/844,.1,1000);camera.position.set(0,10,20);
const controls=new OrbitControls(camera,input);controls.enableDamping=false;
const pointer=(type:string,x:number,y:number)=>Object.assign(new Event(type),{pointerId:1,pointerType:'mouse',clientX:x,clientY:y,pageX:x,pageY:y,button:0,buttons:1});
const originalPhi=controls.getPolarAngle();canvas.dispatchEvent(pointer('pointerdown',430,200));doc.dispatchEvent(pointer('pointermove',430,240));doc.dispatchEvent(pointer('pointerup',430,240));
assert.ok(Math.abs(controls.getAzimuthalAngle())>.1,'Physical vertical motion maps to portrait horizontal orbit');
assert.ok(Math.abs(controls.getPolarAngle()-originalPhi)<1e-8,'Portrait horizontal drag must not tilt camera');
const stopped=camera.position.clone();doc.dispatchEvent(pointer('pointermove',430,280));assert.ok(camera.position.equals(stopped),'Pointer-up releases document listeners');controls.dispose();
syncPortraitLock(false);

const unsupported:any={documentElement:{}};assert.equal(await toggleNativeFullscreen(unsupported),'unavailable');
const denied:any={documentElement:{requestFullscreen:async()=>{throw Error('Not allowed');}}};assert.equal(await toggleNativeFullscreen(denied),'unavailable');
const standard:any={documentElement:{requestFullscreen:async()=>{standard.fullscreenElement=standard.documentElement;}},exitFullscreen:async()=>{standard.fullscreenElement=null;}};
assert.equal(await toggleNativeFullscreen(standard),'entered');assert.equal(await toggleNativeFullscreen(standard),'exited');
const prefixed:any={documentElement:{webkitRequestFullscreen:async()=>{prefixed.webkitFullscreenElement=prefixed.documentElement;}},webkitExitFullscreen:async()=>{prefixed.webkitFullscreenElement=null;}};
assert.equal(await toggleNativeFullscreen(prefixed),'entered');assert.equal(await toggleNativeFullscreen(prefixed),'exited');
console.log('PASS: portrait layout in both landscape directions, real Three.js orbit/document gestures, native/prefixed/unsupported/rejected fullscreen paths.');
