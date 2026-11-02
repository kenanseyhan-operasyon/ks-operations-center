import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {JSDOM} from 'jsdom';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {newEntity} from '../src/scene-data';
import {NATHAN_MODEL_URL,NATHAN_PRESET} from '../src/nathan-data';
import {NathanActor,makeNathanPlaceholder} from '../src/nathan-model';
import {retargetCmu11319,retargetCmu8334Ascent,CMU_UP_NAME,CMU_DOWN_NAME,CMU_83_UP_NAME,CMU_TO_NATHAN_BONES} from '../src/nathan2/cmu-mocap';

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://test.invalid'});
for(const key of ['window','document','HTMLElement','HTMLCanvasElement'])Object.defineProperty(globalThis,key,{value:(dom.window as any)[key],configurable:true});
dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
const text=fs.readFileSync('public/mocap/cmu/113_19.bvh','utf8');
assert.ok(text.startsWith('HIERARCHY'),'Actually downloaded CMU BVH should be readable without network');
assert.ok(text.includes('Frames: 804'),'Source recording must be CMU 113_19 with 804 motion frames');
const bytes=fs.readFileSync('public'+NATHAN_MODEL_URL),loader=new GLTFLoader();
loader.register(()=>({name:'KS_NODE_TEXTURE',loadTexture:async()=>new T.Texture()}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const person=newEntity(NATHAN_PRESET,0,0),root=makeNathanPlaceholder(person),actor=new NathanActor(root,gltf,person.height);
const result=retargetCmu11319(actor,text);
assert.equal(result.sourceFrames,804);
assert.ok(result.sourceSeconds>6.6&&result.sourceSeconds<6.8);
assert.ok(result.mappedBones>=19,'Must transfer both legs, hips, spine, both arms, hands');
assert.equal(result.ascent.name,CMU_UP_NAME);assert.equal(result.descent.name,CMU_DOWN_NAME);
for(const [kind,clip] of [['up',result.ascent],['down',result.descent]] as const){
 assert.ok(clip.duration>1.5&&clip.duration<2.5,kind+' trim length');
 assert.ok(clip.tracks.length>=19,kind+' must have actual joint animation, not an empty fallback');
 assert.ok(clip.tracks.every(x=>x.name.startsWith('rp_nathan_animated_003_walking_')&&x.name.endsWith('.quaternion')),'Only native Nathan joint rotations may be retargeted');
 assert.ok(!clip.tracks.some(x=>x.name.includes('root.position')),'Never replay CMU translation as double root motion');
 const joints=new Set(clip.tracks.map(x=>x.name.split('.quaternion')[0].replace('rp_nathan_animated_003_walking_','')));
 for(const name of ['hip','upperleg_l','lowerleg_l','foot_l','upperleg_r','lowerleg_r','foot_r','hand_l','hand_r'])assert.ok(joints.has(name),kind+' missing '+name);
 for(const t of clip.tracks){
   for(let i=0;i<t.values.length;i+=4){
    const v=t.values,mag=Math.hypot(v[i],v[i+1],v[i+2],v[i+3]);
    assert.ok(Number.isFinite(mag)&&Math.abs(mag-1)<.07,'Invalid retarget quaternion '+kind+' '+t.name);
   }
 }
 assert.equal(actor.addExternalMotion(clip),true,'Actually install '+kind+' in Nathan mixer');
 assert.ok(actor.motion(clip.name,.7),'Actually PLAY '+kind+' on the real skinned rig');
 for(let i=0;i<5;i++)actor.update(.04);
 const mesh: T.Object3D=actor.model.getObjectByName('rp_nathan_animated_003_walking_foot_l')!;
 assert.ok(mesh.getWorldPosition(new T.Vector3()).isVector3);
 console.log('PASS CMU actual Nathan GLB retarget: '+JSON.stringify({kind,clip:clip.name,frames:clip.tracks[0].times.length,mappedBones:result.mappedBones,duration:clip.duration}));
}
assert.ok(Object.keys(CMU_TO_NATHAN_BONES).length>=20);
const ordinaryText=fs.readFileSync('public/mocap/cmu/83_34.bvh','utf8');
assert.ok(ordinaryText.includes('Frames: 968'),'The additional NORMAL stair motion must be a true downloaded CMU capture');
const normal=retargetCmu8334Ascent(actor,ordinaryText);
assert.equal(normal.sourceFrames,968);
assert.equal(normal.ascent.name,CMU_83_UP_NAME);
assert.ok(normal.ascent.duration>2&&normal.ascent.duration<3,'Natural stairs clip trimmed, not standing/walking on level ground');
assert.ok(normal.mappedBones>=19);
assert.ok(normal.ascent.tracks.length>=19);
assert.equal(actor.addExternalMotion(normal.ascent),true);
assert.equal(actor.motion(CMU_83_UP_NAME,.7),true);
for(let i=0;i<5;i++)actor.update(.04);
function jointTravel(clip:T.AnimationClip,name:string){
 const track=clip.tracks.find(t=>t.name.endsWith(name+'.quaternion'))!;
 const q0=new T.Quaternion().fromArray(track.values,0);
 let max=0;
 for(let i=4;i<track.values.length;i+=4)max=Math.max(max,q0.angleTo(new T.Quaternion().fromArray(track.values,i)));
 return max;
}
for(const [label,clip] of [['CMU 83 normal stairs',normal.ascent],['CMU 113 ascent',result.ascent],['CMU 113 descent',result.descent]] as const){
 assert.ok(jointTravel(clip,'upperleg_l')>.08,label+' left leg must actually animate');
 assert.ok(jointTravel(clip,'upperleg_r')>.08,label+' right leg must actually animate');
 assert.ok(jointTravel(clip,'lowerleg_l')>.08,label+' left knee must actually articulate');
 console.log('PASS REAL MOCAP '+JSON.stringify({label,duration:clip.duration,legSwingRadians:jointTravel(clip,'upperleg_l'),tracks:clip.tracks.length}));
}
actor.dispose();
console.log('PASS CMU 113_19 genuine free stair ascent and descent mapped, installed and played on Nathan actual skeleton');
