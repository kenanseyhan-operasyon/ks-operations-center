import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {JSDOM} from 'jsdom';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {WebGLBackground} from 'three/src/renderers/webgl/WebGLBackground.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {VehicleRig} from '../src/vehicle-rig';
import {CabDrivingView} from '../src/cab-driving-view';
import {DrivingPanel} from '../src/driving-panel';
import {Workspace} from '../src/workspace';
import {R14,r14Dimensions} from '../src/r14-spec';
import {newEntity} from '../src/scene-data';
import {applyTransform} from '../src/objects';
import {portraitInput,syncPortraitLock} from '../src/portrait-lock';

const bytes=fs.readFileSync('public/models/refueller-38k-r14.glb');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const originalShell=gltf.scene.getObjectByName('Low_Short_Cab_Shell') as T.Mesh,originalGlass=gltf.scene.getObjectByName('Windshield_Glass') as T.Mesh;
const originalPositions=Array.from(originalShell.geometry.attributes.position.array),originalMaterial=originalGlass.material;
function prepare(articulated=true){const model=clone(gltf.scene),rig=new VehicleRig(model,articulated);model.updateMatrixWorld(true);return {model,rig};}
const left=prepare(),right=prepare(false);
for(const {model,rig} of [left,right]){
  const eye=rig.cab.eye.getWorldPosition(new T.Vector3());
  for(const dir of [[-1,0,0],[0,0,1],[0,0,-1],[-1,0,-.25]]){
    const ray=new T.Raycaster(eye,new T.Vector3().fromArray(dir).normalize(),0,.35);
    const hits=ray.intersectObject(model,true).filter(h=>!( (h.object as T.Mesh).material as T.Material).transparent);
    assert.equal(hits.length,0,'Forward and side window sightlines are open through the actual model');
  }
  const shell=model.getObjectByName('Low_Short_Cab_Shell') as T.Mesh;
  assert.notEqual(shell.geometry,originalShell.geometry);assert.ok(shell.geometry.attributes.position.count<30000,'Aperture cuts do not explode the mesh budget');
  assert.ok(rig.cab.glass.transparent&&!rig.cab.glass.depthWrite&&rig.cab.glass.opacity<.2);
  const ordinaryShell=shell.geometry;
  rig.cab.setInside(true);assert.ok(rig.cab.glass.opacity<.08);
  assert.equal(model.getObjectByName('INSTRUMENT_HOOD'),undefined,'The marked shelf must not obstruct the windscreen');
  for(const degrees of [-35,-25,-20,-15,55,60]){
    const yaw=degrees*Math.PI/180,ray=new T.Raycaster(eye,new T.Vector3(-Math.cos(yaw),0,-Math.sin(yaw)),0,.6);
    const hits=ray.intersectObject(model,true).filter(h=>!((h.object as T.Mesh).material as T.Material).transparent);
    assert.equal(hits.length,0,`The former solid corner at ${degrees} degrees is see-through from the seat`);
  }
  assert.ok((model.getObjectByName('CAB_TRANSPARENT_CORNERS') as T.Mesh).visible);rig.cab.setInside(false);
  assert.equal(shell.geometry,ordinaryShell,'Exiting the cab restores the original exterior');
  assert.equal(model.getObjectByName('CAB_TRANSPARENT_CORNERS')!.visible,false);
  rig.cab.update({speed:5,rpm:1250,gear:2,steer:.35,running:true,night:false});assert.equal(rig.cab.wheel.rotation.z,-.35*14);
  assert.equal(rig.cab.mirrors.length,2);assert.ok(rig.cab.mirrors.some(m=>m.side===1));
}
assert.deepEqual(Array.from(originalShell.geometry.attributes.position.array),originalPositions,'Cached GLB remains untouched');assert.equal(originalGlass.material,originalMaterial);assert.equal((originalMaterial as T.Material).opacity,1);
const state={speed:2,rpm:980,gear:2,steer:.15,running:true,night:false,signal:'left',rate:1};
const dom=new JSDOM('<!doctype html><body></body>',{pretendToBeVisual:true,url:'https://test.invalid'});
for(const name of ['window','document','HTMLElement','HTMLButtonElement','Option','screen','localStorage','navigator'])Object.defineProperty(globalThis,name,{value:(dom.window as any)[name],configurable:true});
Object.assign(globalThis,{innerWidth:1200,innerHeight:800,devicePixelRatio:1,matchMedia:()=>({matches:false})});
function canvas(w:number,h:number,rotate=false){const host=document.createElement('section'),el=document.createElement('div');document.body.append(host);host.append(el);Object.defineProperties(el,{clientWidth:{value:w},clientHeight:{value:h}});el.getBoundingClientRect=()=>({left:0,top:0,width:rotate?h:w,height:rotate?w:h} as DOMRect);el.setPointerCapture=()=>{};el.releasePointerCapture=()=>{};el.hasPointerCapture=()=>false;return el;}
function pointer(el:HTMLElement,type:string,x:number,y:number,id=1){const e=new dom.window.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true});Object.defineProperties(e,{pointerId:{value:id},pointerType:{value:'touch'}});el.dispatchEvent(e);}
for(const portrait of [false,true]){
  Object.assign(globalThis,{innerWidth:portrait?844:1280,innerHeight:portrait?390:720});syncPortraitLock(portrait);
  const el=canvas(portrait?390:1280,portrait?844:720,portrait),input=portraitInput(el),camera=new T.PerspectiveCamera(42,el.clientWidth/el.clientHeight,.05,30000),keys=new Set<string>();
  const view=new CabDrivingView(camera,input,el.parentElement!,portrait,{key:(k,down)=>{down?keys.add(k):keys.delete(k);},exit:()=>view.exit()});
  const {model,rig}=left,entity=newEntity('R14',400,-210);entity.heading=73;entity.scale=1.7;
  const root=new T.Group(),orient=new T.Group();root.add(orient);orient.rotation.y=-Math.PI/2;orient.add(model);model.scale.setScalar(entity.length/R14.length);model.position.set(-R14.centreX*model.scale.x,.454*model.scale.x,-R14.centreZ*model.scale.x);applyTransform(root,entity);
  view.enter(rig.cab);view.update(state,0);assert.ok(view.active&&!view.hud.hidden);const start=camera.position.clone();
  assert.ok(camera.position.distanceTo(rig.cab.eye.getWorldPosition(new T.Vector3()))<1e-8);
  entity.position[0]+=20;entity.position[2]-=30;entity.heading+=60;applyTransform(root,entity);view.update(state,100);
  assert.ok(camera.position.distanceTo(start)>20);assert.ok(camera.position.distanceTo(rig.cab.eye.getWorldPosition(new T.Vector3()))<1e-8,'Camera follows the physical driver eye through translation, yaw and scale');
  const expected=new T.Vector3(-1,0,0).transformDirection(model.matrixWorld);assert.ok(camera.getWorldDirection(new T.Vector3()).dot(expected)>.998,'Forward gaze follows the cab heading');
  const position=camera.position.clone(),orientation=camera.quaternion.clone();let mapClicks=0;el.addEventListener('pointerup',()=>mapClicks++);
  pointer(el,'pointerdown',200,200);pointer(el,'pointermove',240,220);pointer(el,'pointerup',240,220);view.update(state,200);
  assert.equal(mapClicks,0,'Cab gaze cannot leak through to map click-to-go');assert.ok(!camera.quaternion.equals(orientation));assert.ok(camera.position.equals(position),'Looking around never leaves the seat');
  pointer(el,'pointerdown',200,200,2);pointer(el,'pointerdown',300,200,3);const yaw=(view as any).yaw;pointer(el,'pointermove',350,200,3);pointer(el,'pointercancel',350,200,3);pointer(el,'pointerup',200,200,2);assert.equal((view as any).yaw,yaw,'Second finger cancels a look drag cleanly');
  input.dispatchEvent(new dom.window.WheelEvent('wheel',{deltaY:-50000,cancelable:true,bubbles:true}));view.update(state,300);assert.ok(camera.fov>=48&&camera.fov<=90);assert.ok(camera.position.equals(position));
  const gas=view.hud.querySelector<HTMLButtonElement>('[data-cab-key="w"]')!,steering=view.hud.querySelector<HTMLButtonElement>('[data-cab-key="a"]')!;gas.setPointerCapture=steering.setPointerCapture=()=>{};
  pointer(gas,'pointerdown',10,10,10);pointer(steering,'pointerdown',20,10,11);assert.ok(keys.has('w')&&keys.has('a'),'Phone can steer and accelerate together');pointer(gas,'pointercancel',10,10,10);assert.ok(!keys.has('w')&&keys.has('a'));pointer(steering,'pointerup',20,10,11);assert.equal(keys.size,0,'Pedal and steering releases cannot get stuck');
  const ahead=view.hud.querySelector<HTMLButtonElement>('[data-look="centre"]')!;ahead.click();view.update(state,400);assert.ok(camera.getWorldDirection(new T.Vector3()).dot(expected)>.998);
  assert.equal(view.hud.querySelector('[data-speed]')!.textContent,'7.2');assert.equal(view.hud.querySelector('[data-gear]')!.textContent,'D2');
  keys.add('w');view.setLanguage('en');assert.equal(keys.size,0);assert.ok(view.hud.textContent!.includes('LEFT MIRROR')&&view.hud.textContent!.includes('SURROUND VIEW'));view.setLanguage('tr');assert.ok(view.hud.textContent!.includes('SOL AYNA')&&view.hud.textContent!.includes('ÜSTTEN ÇEVRE'));
  // Render the actual scene from each moving mirror camera; record WebGL calls without a browser/session.
  let renderTarget:any=null;const viewport=new T.Vector4(0,0,el.clientWidth,el.clientHeight),scissor=viewport.clone();let scissorTest=true,draws=0;const snapshots:{camera:T.Camera;target:T.WebGLRenderTarget}[]=[];const overlayFlips:number[]=[];
  const renderer:any={extensions:{has:()=>true},getClearColor:(c:T.Color)=>c.set('#94adb7'),getClearAlpha:()=>1,setClearColor(){},getRenderTarget:()=>renderTarget,setRenderTarget:(t:any)=>{renderTarget=t;},getViewport:(v:T.Vector4)=>v.copy(viewport),setViewport:(...a:any[])=>{a.length===1?viewport.copy(a[0]):viewport.set(a[0],a[1],a[2],a[3]);},getScissor:(v:T.Vector4)=>v.copy(scissor),setScissor:(...a:any[])=>{a.length===1?scissor.copy(a[0]):scissor.set(a[0],a[1],a[2],a[3]);},getScissorTest:()=>scissorTest,setScissorTest:(b:boolean)=>{scissorTest=b;},clear(){},clearDepth(){},render(_s:T.Scene,c:T.PerspectiveCamera){draws++;if(renderTarget){assert.ok(rig.cab.mirrors.every(m=>!m.surface.visible),'Mirrors are excluded from their own render passes');assert.equal(rig.cab.isInside,false,'Auxiliary cameras see the solid exterior');snapshots.push({camera:c.clone(),target:renderTarget});}else overlayFlips.push((view as any).quad.scale.x);}};
  const ground=new T.Scene(),scene=new T.Scene();scene.add(root);view.renderViews(renderer,ground,scene,1000);assert.equal(draws,6);view.renderViews(renderer,ground,scene,1001);assert.equal(draws,6,'Mirror refresh budget limits extra render passes');assert.equal(renderTarget,null);assert.equal(scissorTest,true);assert.deepEqual(viewport.toArray(),[0,0,el.clientWidth,el.clientHeight]);assert.ok(rig.cab.mirrors.every(m=>m.surface.visible));
  for(let i=0;i<2;i++){
    const mirror=rig.cab.mirrors[i],snap=snapshots[i*2],mirrorPosition=mirror.eye.getWorldPosition(new T.Vector3());assert.ok(snap.camera.position.distanceTo(mirrorPosition)<1e-8);assert.ok(snap.camera.getWorldDirection(new T.Vector3()).dot(expected)<-.95,'Each mirror looks rearward, not through the windscreen');assert.ok(snap.target.width<=256&&snap.target.height<=384);
    assert.equal(snap.target.texture.type,T.HalfFloatType,'Preserve unclipped linear light in the mirror pass');assert.ok((mirror.surface.material as T.Material).toneMapped&&(view as any).quad.material.toneMapped,'Apply the main view exposure once at mirror display');
    const uv=mirror.surface.geometry.attributes.uv;assert.ok(uv.getX(0)>uv.getX(1),'Physical mirror flips the horizontal image');
    snap.camera.updateMatrixWorld(true);const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices((snap.camera as T.PerspectiveCamera).projectionMatrix,(snap.camera as T.PerspectiveCamera).matrixWorldInverse));
    for(const angle of [-.30,0,.30]){rig.setArticulation(angle);model.updateMatrixWorld(true);const body=model.getObjectByName('Tank_Shell')!;const box=new T.Box3().setFromObject(body);assert.ok(frustum.intersectsBox(box),'Moving articulated tank remains in the rear mirror field');}
  }
  const surround=snapshots[4],top=surround.camera as T.OrthographicCamera;
  assert.ok(top.isOrthographicCamera&&top.getWorldDirection(new T.Vector3()).y<-.999,'Surround camera looks vertically down');
  assert.ok(top.up.dot(expected)>.999,'The vehicle front stays at the top of the inset');
  assert.ok(surround.target.width<=256&&surround.target.height<=256);
  const bounds=new T.Box3().setFromObject(model,true);for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const projected=new T.Vector3(x,y,z).project(top);assert.ok(Math.abs(projected.x)<.9&&Math.abs(projected.y)<.9,'The full vehicle plus space around it fits the overhead view');
  }
  Object.defineProperty(view.hud,'clientHeight',{value:el.clientHeight});for(const frame of view.hud.querySelectorAll<HTMLElement>('[data-mirror],[data-surround]'))Object.defineProperties(frame,{offsetLeft:{value:frame.dataset.mirror==='left'?10:el.clientWidth-100},offsetTop:{value:150},offsetWidth:{value:90},offsetHeight:{value:135}});
  view.renderOverlay(renderer);assert.equal(draws,9);assert.deepEqual(overlayFlips,[-1,-1,1],'Mirrors flip, the overhead view keeps left/right correct');assert.deepEqual(viewport.toArray(),[0,0,el.clientWidth,el.clientHeight]);
  renderer.extensions.has=()=>false;renderer.render=()=>{throw new Error('render lost');};assert.throws(()=>view.renderViews(renderer,ground,scene,2000));assert.equal(renderTarget,null);assert.ok(rig.cab.mirrors.every(m=>m.surface.visible),'Render failure restores scene state');assert.ok(rig.cab.isInside,'Render failure restores the transparent interior corners');assert.ok((view as any).targets.every((t:T.WebGLRenderTarget)=>t.texture.type===T.UnsignedByteType),'Older GPUs fall back to supported mirror buffers');
  // Exercise Three's actual background color encoder. With autoClear=false,
  // switching back from a linear target used to leave the next screen clear dark.
  let encoded:number[]=[],screenClears:number[][]=[];renderTarget=null;let fail=false;
  const skyRenderer:any={...renderer,outputColorSpace:T.SRGBColorSpace,autoClear:false,xr:{getEnvironmentBlendMode:()=> 'opaque'},
    clear(){if(!renderTarget)screenClears.push([...encoded]);else {const rgb=new T.Color(skyRenderer.getClearColor(new T.Color())).getRGB({r:0,g:0,b:0},T.LinearSRGBColorSpace);assert.deepEqual(encoded,[rgb.r,rgb.g,rgb.b,.73],'Offscreen sky is consistently linear before every clear');}},
    render(s:T.Scene){if(fail)throw new Error('render lost');background.render(s);}};
  const background=WebGLBackground(skyRenderer,{}, {buffers:{color:{setClear:(r:number,g:number,b:number,a:number)=>{encoded=[r,g,b,a];},setMask(){}},depth:{setTest(){},setMask(){}}}}, {},false,false);
  Object.assign(skyRenderer,{getClearColor:(c:T.Color)=>c.copy(background.getClearColor()),getClearAlpha:()=>background.getClearAlpha(),setClearColor:(c:T.Color,a:number)=>background.setClearColor(c,a)});
  for(const [index,sky] of ['#94adb7','#07111e'].entries()){
    skyRenderer.setClearColor(new T.Color(sky),.73);const expectedClear=[...encoded];screenClears=[];
    for(let frame=0;frame<30;frame++){
      view.renderViews(skyRenderer,ground,scene,3000+index*4000+frame*16);skyRenderer.clear();skyRenderer.render(ground,camera);skyRenderer.clearDepth();skyRenderer.render(scene,camera);view.renderOverlay(skyRenderer);
    }
    assert.equal(screenClears.length,30);assert.ok(screenClears.every(c=>c.every((v,i)=>Math.abs(v-expectedClear[i])<1e-8)),'Day/night sky must stay constant across mirror-refresh and skipped frames');
    fail=true;assert.throws(()=>view.renderViews(skyRenderer,ground,scene,6000+index*4000));fail=false;assert.deepEqual(encoded,expectedClear,'Failed auxiliary rendering restores the screen clear color too');assert.ok(rig.cab.isInside);
  }
  keys.add('w');view.exit();assert.equal(keys.size,0);assert.equal(camera.fov,42);assert.equal(camera.near,.05);assert.ok(view.hud.hidden);assert.ok(rig.cab.mirrors.every(m=>(m.surface.material as T.MeshBasicMaterial).map===null));const count=draws;view.renderOverlay(renderer);assert.equal(draws,count);view.dispose();
}
syncPortraitLock(false);

// Exercise the real driving panel and workspace mode switch, preserving the current route/scene.
const host=document.createElement('div');host.innerHTML='<div id="stage"></div>';document.body.append(host);const el=canvas(1200,800),entity=newEntity('R14',100,200),entities=[entity],running=new Set<string>();
const camera=new T.PerspectiveCamera(42,1.5,.05,30000);camera.position.set(120,15,220);const orbit=new OrbitControls(camera,el);orbit.target.set(100,0,200);orbit.update();
const ws:any=Object.create(Workspace.prototype);let panel:DrivingPanel;
const view=new CabDrivingView(camera,el,el.parentElement!,false,{key:(k,d)=>panel.key(k,d),exit:()=>panel.setCabin(false)});
Object.assign(ws,{root:host,history:{current:{entities,routes:[],driving:[]}},camera,orbit,cabView:view,vehicleRigs:new Map([[entity.id,left.rig]]),flight:0,plan:{enabled:false},freeMode:false,selectionBox:{visible:true},routeLine:{visible:true},routeHandles:{set(){}},free:{enabled:false,paused:false,clear(){},sync(){}},setMenu(){},updatePad(){},drawRoute(){},updateSelectionBox(){},notify(){},say:(tr:string)=>tr});
panel=new DrivingPanel(host,{cabin:on=>ws.setCabin(on),entities:()=>entities,routes:()=>[],driveStates:()=>[],retainDrive(){},save(){},canSave:()=>false,canDesign:()=>false,saveRoute(){},checkpoint(){},changed(){},running:id=>running.has(id),engine:(id,on)=>{on?running.add(id):running.delete(id);},blocked:()=>false,wheelbase:()=>r14Dimensions().wheelbase,articulation:()=>r14Dimensions(),move(){},path(){},gateWaiting:()=>undefined,openGate(){},notify(){},focus(){}});ws.driving=panel;panel.open(entity);
const before=JSON.stringify(ws.history.current),offset=camera.position.clone().sub(new T.Vector3().fromArray(entity.position));
panel.key('c',true);panel.key('c',false);assert.ok(panel.inside&&view.active);assert.equal(orbit.enabled,false);assert.ok(panel.element.classList.contains('cab-compact'));assert.equal(ws.selectionBox.visible,false);assert.equal(ws.routeLine.visible,false);
panel.key('ı',true);panel.key('ı',false);assert.ok(running.has(entity.id),'Turkish I key starts the engine');panel.key('b',true);assert.ok(panel.horn);panel.key('b',false);assert.ok(!panel.horn);
assert.equal(JSON.stringify(ws.history.current),before,'Camera/engine/horn choices do not rewrite route or cloud data');
entity.position[0]+=10;panel.key('c',true);panel.key('c',false);assert.equal(orbit.enabled,true);assert.ok(!view.active&&!panel.inside);assert.ok(camera.position.distanceTo(new T.Vector3().fromArray(entity.position).add(offset))<1e-8,'Exterior view returns relative to the current vehicle position');
ws.freeMode=true;camera.lookAt(camera.position.clone().add(new T.Vector3(15,3,-5)));const freeDirection=camera.getWorldDirection(new T.Vector3());panel.setCabin(true);panel.close();assert.ok(!view.active&&!orbit.enabled&&ws.free.enabled);assert.ok(camera.getWorldDirection(new T.Vector3()).dot(freeDirection)>.999,'Returning to free view preserves its gaze');view.dispose();orbit.dispose();left.rig.dispose();right.rig.dispose();dom.window.close();
console.log('PASS: actual GLB window sightlines for both series, independent materials, driver-seat tracking, animated steering, desktop/rotated-phone gaze, live rear mirror framing and state restoration, TR/EN controls, safe cabin exit and unchanged saved data.');
