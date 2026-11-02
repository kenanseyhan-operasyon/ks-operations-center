import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {JSDOM} from 'jsdom';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {NathanActor,makeNathanPlaceholder} from '../src/nathan-model';
import {NATHAN_MODEL_URL,NATHAN_PRESET} from '../src/nathan-data';
import {newEntity} from '../src/scene-data';
import {Nathan2Motor} from '../src/nathan2/engine';
import {retargetCmu8334Ascent,CMU_83_UP_NAME} from '../src/nathan2/cmu-mocap';
import {applyLabAnimation} from '../src/nathan2/playback';

const dom=new JSDOM('<!doctype html><html><body></body></html>');
for(const key of ['window','document','HTMLElement','HTMLCanvasElement'])Object.defineProperty(globalThis,key,{value:(dom.window as any)[key],configurable:true});
dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
const bytes=fs.readFileSync('public'+NATHAN_MODEL_URL),loader=new GLTFLoader();
loader.register(()=>({name:'KS_QA_TEXTURE',loadTexture:async()=>new T.Texture()}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const person=newEntity(NATHAN_PRESET,0,0),root=makeNathanPlaceholder(person),actor=new NathanActor(root,gltf,person.height);
const source=retargetCmu8334Ascent(actor,fs.readFileSync('public/mocap/cmu/83_34.bvh','utf8'));
actor.addExternalMotion(source.ascent);actor.select(actor.clips.findIndex(c=>c.name===CMU_83_UP_NAME),false);
const tank=newEntity('TANK',0,0),motor=new Nathan2Motor(tank);
motor.distance=6.12;motor.activity='spiral-up';motor.heading=motor.stairs.headingAt(motor.distance,1);
const pose={...motor.tick(0),contact:undefined};
const bones:T.Bone[]=[];actor.model.traverse(n=>{if(n instanceof T.Bone)bones.push(n);});
const snapshot=()=>bones.map(b=>b.quaternion.clone().normalize());
applyLabAnimation(actor,pose,CMU_83_UP_NAME,motor.distance,motor.stairs.total,tank.scale,1/60);
const at60Hz=snapshot(),time=actor.actions[actor.index].time;
// The same path position has the same pose regardless of integration step.
// This catches a second mixer time advance after path-based sampling.
for(const dt of [1/120,1/30,.04]){
 applyLabAnimation(actor,pose,CMU_83_UP_NAME,motor.distance,motor.stairs.total,tank.scale,dt);
 assert.ok(Math.abs(actor.actions[actor.index].time-time)<1e-10,'Mixer must not advance the distance clock twice');
 bones.forEach((b,i)=>assert.ok(b.quaternion.clone().normalize().angleTo(at60Hz[i])<1e-6,'Pose must be independent of render frame time: '+b.name));
}
const beforePause=snapshot(),offsetBefore=actor.offset.position.clone();
for(let i=0;i<20;i++)applyLabAnimation(actor,{...pose,paused:true},'Idle',0,motor.stairs.total,tank.scale,.04);
assert.equal(actor.clips[actor.index].name,CMU_83_UP_NAME,'Pause must not switch to Idle and release the saved pose');
assert.equal(actor.actions[actor.index].time,time);
assert.ok(actor.offset.position.equals(offsetBefore));
bones.forEach((b,i)=>assert.ok(b.quaternion.clone().normalize().angleTo(beforePause[i])<1e-6,'Pause must preserve every bone'));
actor.dispose();
console.log('PASS Nathan2 actual-rig distance clock: no double advance, frame-rate-independent pose, exact paused pose');
