import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {JSDOM} from 'jsdom';
import {NATHAN_PRESET,NATHAN_MODEL_URL,validateNathan} from '../src/nathan-data';
import {NathanActor,NathanActors,makeNathanPlaceholder} from '../src/nathan-model';
import {NathanPanel} from '../src/nathan-panel';
import {newEntity,validateScene,SceneHistory,moveEntities,type SceneData} from '../src/scene-data';
import {makeObject,applyTransform,disposeObject} from '../src/objects';
import {GSELibrary} from '../src/gse-library';

const bytes=fs.readFileSync(`public${NATHAN_MODEL_URL}`);
assert.equal(bytes.length,25874096);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'579deba138d7311119821ffd37cf10694533322d79bcbe63dabffcbb6b65c3ef');
// Node has no image decoder. Stub texture decoding only; use the actual geometry,
// skin, hierarchy and every AnimationClip from the unmodified supplied GLB.
const loader=new GLTFLoader().register(()=>({name:'KS_HEADLESS_TEXTURE',loadTexture:async()=>new T.Texture()}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
assert.equal(gltf.animations.length,16);
assert.deepEqual(gltf.animations.map(c=>c.name),['Climbing','Climbing_Ladder','Climbing_To_Top','Crouch_To_Stand','Driving','Idle','Jumping_Down','Kneeling_Down','Nathan_Original_Walk','Opening','Opening_1','Pulling_Lever','Running','Running_Up_Stairs','Shaking_Hands_2','Walking_Turn_180']);
const entity=newEntity(NATHAN_PRESET,13,-7),root=new T.Group();entity.heading=37;entity.position[1]=2;entity.scale=1.4;applyTransform(root,entity);
const actor=new NathanActor(root,gltf,1.78,entity.nathan),secondRoot=new T.Group(),second=new NathanActor(secondRoot,gltf,1.78);
const mesh=(o:T.Object3D)=>{let found:T.SkinnedMesh|undefined;o.traverse(n=>{if(n instanceof T.SkinnedMesh)found=n;});return found!;};
assert.notEqual(mesh(actor.model).skeleton.bones[0],mesh(second.model).skeleton.bones[0]);
assert.equal(mesh(actor.model).geometry,mesh(second.model).geometry);
assert.ok(new T.Box3().setFromObject(root,true).max.y<4.8,'Centimetre export is normalized to metres');
const pose=(a:NathanActor)=>mesh(a.model).skeleton.bones.map(b=>b.quaternion.toArray()).flat();
const pickBox=new T.Box3().setFromObject(root,true),pickTarget=pickBox.getCenter(new T.Vector3()),pickOrigin=pickTarget.clone().add(new T.Vector3(3,1,5));const ray=new T.Raycaster(pickOrigin,pickTarget.clone().sub(pickOrigin).normalize());assert.ok(ray.intersectObject(root,true).length,'Actual animated skin remains ray-selectable');
const stationaryPose=pose(second),position=root.position.toArray(),rotation=root.quaternion.toArray(),scale=root.scale.toArray();
const samples:{clip:string;frames:number;minY:number;maxHeight:number}[]=[];
const start=performance.now();
for(let index=0;index<actor.clips.length;index++){
  actor.stop();actor.select(index,false);actor.play();
  let minY=Infinity,maxHeight=0;const frames=Math.ceil(actor.clips[index].duration*10)+1;
  for(let frame=0;frame<frames;frame++){
    actor.update(.1);
    const box=new T.Box3().setFromObject(root,true);
    minY=Math.min(minY,box.min.y);maxHeight=Math.max(maxHeight,(box.max.y-entity.position[1])/entity.scale);
    assert.ok(Number.isFinite(box.min.y)&&Number.isFinite(box.max.y));
    assert.ok(Math.abs(box.min.y-(entity.position[1]+.005*entity.scale))<.0001,`${actor.clips[index].name} remains above ground`);
    assert.ok(Math.hypot(box.getCenter(new T.Vector3()).x-entity.position[0],box.getCenter(new T.Vector3()).z-entity.position[2])<3,'No root-motion drift');
  }
  samples.push({clip:actor.clips[index].name,frames,minY,maxHeight});
}
assert.deepEqual(root.position.toArray(),position);assert.deepEqual(root.quaternion.toArray(),rotation);assert.deepEqual(root.scale.toArray(),scale);
assert.deepEqual(pose(second),stationaryPose,'Each copy has an independent skeleton');
actor.select(8,false);actor.play();actor.update(.1);const paused=pose(actor),time=actor.mixer.time;actor.pause();actor.update(.1);assert.deepEqual(pose(actor),paused);assert.equal(actor.mixer.time,time);
actor.play();actor.update(.1);assert.notDeepEqual(pose(actor),paused);
actor.select(5);assert.ok(actor.actions[8].isScheduled()&&actor.actions[5].isScheduled(),'Crossfade has both clips active');for(let i=0;i<4;i++)actor.update(.1);assert.equal(actor.actions[8].isScheduled(),false);
actor.stop();assert.equal(actor.playing,false);assert.equal(actor.actions[actor.index].time,0);
actor.configure({clip:'Climbing',loop:false,speed:2});actor.play();for(let i=0;i<12;i++)actor.update(.1);assert.equal(actor.playing,false,'One-shot stops at completion');
// Regression: the source walk's first two frames spread both arms every 1.833 s.
// The runtime loop must remain a walking pose over many seams and fast retargets.
assert.ok(Math.abs(gltf.animations[8].duration-1.833333373)<1e-6,'Source clip is unchanged');
assert.ok(Math.abs(actor.clips[8].duration-.9)<1e-6);
const bone=(suffix:string)=>actor.model.getObjectByName(`rp_nathan_animated_003_walking_${suffix}`)!;
const armAngle=(side:string)=>bone(`hand_${side}`).getWorldPosition(new T.Vector3()).sub(bone(`shoulder_${side}`).getWorldPosition(new T.Vector3())).angleTo(new T.Vector3(0,-1,0))*180/Math.PI;
actor.select(5,false);actor.motion('Idle');
let maximumArmAngle=0,maximumSeamStep=0;
let previousArms=['upperarm_l','upperarm_r'].map(s=>bone(s).quaternion.clone());
for(let frame=0;frame<720;frame++){
  actor.motion(frame<60&&Math.floor(frame/3)%2===0?'Idle':'Nathan_Original_Walk',frame<60?.2:1);
  actor.update(1/60);
  const weight=actor.actions.reduce((sum,a)=>sum+(a.isScheduled()?a.getEffectiveWeight():0),0);
  assert.ok(Math.abs(weight-1)<1e-5,'Interrupted crossfades never expose the bind pose');
  maximumArmAngle=Math.max(maximumArmAngle,armAngle('l'),armAngle('r'));
  const arms=['upperarm_l','upperarm_r'].map(s=>bone(s).quaternion.clone());
  maximumSeamStep=Math.max(maximumSeamStep,...arms.map((q,i)=>q.angleTo(previousArms[i])));previousArms=arms;
}
assert.ok(maximumArmAngle<45,`Arms stay in a natural walk: ${maximumArmAngle.toFixed(1)}°`);
assert.ok(maximumSeamStep<.15,`No abrupt shoulder jump at loop boundaries: ${maximumSeamStep}`);
console.log(`PASS 720 actual skinned frames: repeated walk seams and interrupted fades; maximum arm angle ${maximumArmAngle.toFixed(1)}°`);
const scene:SceneData={schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',source:'Nathan test',groups:[],entities:[entity,newEntity('REFUEL_OPERATOR',0,0),newEntity('R14',0,0)]};
entity.nathan={clip:'Driving',loop:false,speed:.5};entity.position[1]=-5;
const restored=validateScene(JSON.parse(JSON.stringify(scene)));assert.equal(restored.entities[0].preset,NATHAN_PRESET);assert.equal(restored.entities[0].position[1],0);assert.deepEqual(restored.entities[0].nathan,entity.nathan);assert.equal(restored.entities[0].personnel,undefined);assert.equal(restored.entities[1].preset,'REFUEL_OPERATOR');
const history=new SceneHistory(restored),selected=new Set([entity.id]);history.change(d=>moveEntities(d,selected,3,5));history.change(d=>{d.entities[0].heading=90;});assert.equal(history.current.entities[0].heading,90);history.undo();assert.equal(history.current.entities[0].heading,37);history.redo();assert.equal(history.current.entities[0].heading,90);
history.change(d=>{d.entities=d.entities.filter(e=>e.id!==entity.id);});assert.equal(history.current.entities.length,2);history.undo();assert.equal(history.current.entities[0].preset,NATHAN_PRESET);
assert.deepEqual(validateNathan({clip:'Idle',loop:true,speed:NaN}),{clip:'Idle',loop:true,speed:1});
const e=newEntity(NATHAN_PRESET,0,0),placeholder=makeObject(e),objects=new Map([[e.id,placeholder]]);let loads=0;
const actors=new NathanActors(()=>{},async()=>{loads++;return gltf;});const settle=()=>new Promise(r=>setTimeout(r,0));
actors.sync([e],objects,false);assert.equal(actors.states.size,0);actors.sync([e],objects);await settle();assert.equal(actors.states.get(e.id)?.status,'ready');assert.equal(placeholder.getObjectByName('NATHAN_LOADING_MARKER'),undefined);
const rootIdentity=placeholder;actors.pause();actors.sync([e],objects);assert.equal(objects.get(e.id),rootIdentity,'Scene transitions retain the same selectable object');assert.equal(loads,1);
let geometryDisposals=0;mesh(actors.states.get(e.id)!.actor!.model).geometry.addEventListener('dispose',()=>geometryDisposals++);
const replacement=makeNathanPlaceholder(e);objects.set(e.id,replacement);actors.sync([e],objects);disposeObject(rootIdentity);await settle();assert.equal(actors.states.get(e.id)?.root,replacement);assert.equal(geometryDisposals,0,'Deleting one copy cannot dispose cached shared geometry');
let resolve!:(v:typeof gltf)=>void;const delayed=new NathanActors(()=>{},()=>new Promise(r=>resolve=r));delayed.sync([e],objects);delayed.sync([],objects);resolve(gltf);await settle();assert.equal(delayed.states.size,0,'Deleted loading entity cannot reappear');
let resolveLatest!:(v:typeof gltf)=>void;const latest=new NathanActors(()=>{},()=>new Promise(r=>resolveLatest=r));const latestRoot=makeNathanPlaceholder(e),latestObjects=new Map([[e.id,latestRoot]]);latest.sync([e],latestObjects);const updated=structuredClone(e);updated.nathan={clip:'Driving',loop:false,speed:.5};latest.sync([updated],latestObjects);resolveLatest(gltf);await settle();assert.equal(latest.states.get(e.id)!.actor!.settings.clip,'Driving','Load completes with the latest restored scene preferences');latest.sync([],latestObjects);
let attempts=0;const failed=new NathanActors(()=>{},async()=>{if(++attempts===1)throw new Error('simulated offline');return gltf;});const warn=console.warn;console.warn=()=>{};failed.sync([e],objects);await settle();console.warn=warn;assert.equal(failed.states.get(e.id)?.status,'error');failed.retry(e);await settle();assert.equal(failed.states.get(e.id)?.status,'ready');assert.equal(attempts,2);

const dom=new JSDOM('<main></main>');Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement});
let edits=0,configs=0;const panel=new NathanPanel(document.querySelector('main')!,actors,{entity:id=>id===e.id?e:undefined,configure:(_e,s)=>{e.nathan=s;configs++;},edit:()=>{edits++;},ready:()=>true});panel.open(e);
const select=panel.element.querySelector<HTMLSelectElement>('[data-nathan-clips]')!;assert.equal(select.options.length,16);select.value='4';select.dispatchEvent(new dom.window.Event('change'));assert.equal(actors.states.get(e.id)!.actor!.settings.clip,'Driving');assert.equal(configs,1);
const click=(key:string)=>panel.element.querySelector<HTMLButtonElement>(`[data-nathan="${key}"]`)!.click();click('play');assert.equal(actors.states.get(e.id)!.actor!.playing,true);click('pause');assert.equal(actors.states.get(e.id)!.actor!.playing,false);click('stop');click('edit');assert.equal(edits,1);assert.equal(panel.element.hidden,true);panel.open(e);
let cameraKeys=0;window.addEventListener('keydown',()=>cameraKeys++);window.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'w',cancelable:true}));assert.equal(cameraKeys,1,'Animation panel does not capture camera keys');
assert.match(panel.element.textContent!,/sonraki aşamalarda/);panel.selection(newEntity('R14',0,0));assert.equal(panel.element.hidden,true);panel.open(e);panel.setLanguage('en');assert.match(panel.element.textContent!,/later stages/);
let placed='';const library=new GSELibrary(document.querySelector('main')!,preset=>placed=preset);library.toggle();library.element.querySelector<HTMLButtonElement>('[data-place="NATHAN_OPERATOR"]')!.click();assert.equal(placed,NATHAN_PRESET);assert.ok(library.element.querySelector('[data-place="REFUEL_OPERATOR"]'));assert.ok(library.element.querySelector('[data-place="R14"]'));
actor.dispose();second.dispose();actors.sync([],objects);failed.sync([],objects);
console.log(JSON.stringify({result:'PASS',bytes:bytes.length,animations:16,poseFrames:samples.reduce((n,s)=>n+s.frames,0),seconds:Number(((performance.now()-start)/1000).toFixed(2)),samples},null,2));
