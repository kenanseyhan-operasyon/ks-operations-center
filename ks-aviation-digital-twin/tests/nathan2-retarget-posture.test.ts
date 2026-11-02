import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {JSDOM} from 'jsdom';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {newEntity} from '../src/scene-data';
import {NATHAN_MODEL_URL,NATHAN_PRESET} from '../src/nathan-data';
import {NathanActor,makeNathanPlaceholder} from '../src/nathan-model';
import {retargetCmu11319,retargetCmu8334Ascent,NATHAN_RIG_PREFIX} from '../src/nathan2/cmu-mocap';

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://test.invalid'});
for(const key of ['window','document','HTMLElement','HTMLCanvasElement'])
  Object.defineProperty(globalThis,key,{value:(dom.window as any)[key],configurable:true});
dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
const bytes=fs.readFileSync('public'+NATHAN_MODEL_URL),loader=new GLTFLoader();
loader.register(()=>({name:'KS_TEST_TEXTURE_NO_GL',loadTexture:async()=>new T.Texture()}));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const person=newEntity(NATHAN_PRESET,0,0);
const actor=new NathanActor(makeNathanPlaceholder(person),gltf,person.height);
const before=new Map<string,number[]>();
actor.model.traverse(node=>{if(node instanceof T.Bone)before.set(node.name,node.quaternion.toArray());});
const a=retargetCmu8334Ascent(actor,fs.readFileSync('public/mocap/cmu/83_34.bvh','utf8'));
const b=retargetCmu11319(actor,fs.readFileSync('public/mocap/cmu/113_19.bvh','utf8'));
actor.model.traverse(node=>{if(node instanceof T.Bone)assert.deepEqual(node.quaternion.toArray(),before.get(node.name),'Retargeting must not change the live actor pose');});

const reports=[];
for(const clip of [a.ascent,b.ascent,b.descent]){
  const target=clone(gltf.scene);
  target.traverse(node=>{if(node instanceof T.SkinnedMesh)node.skeleton.pose();});
  const mixer=new T.AnimationMixer(target),action=mixer.clipAction(clip);
  action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const point=(name:string)=>target.getObjectByName(NATHAN_RIG_PREFIX+name)!.getWorldPosition(new T.Vector3());
  const angles:number[]=[],thighAngles:number[]=[],shinAngles:number[]=[];
  const positions:{left:number[],right:number[]}[]=[];
  for(let time=0;time<=clip.duration;time+=1/60){
    mixer.setTime(time);target.updateMatrixWorld(true);
    const torso=point('neck').sub(point('hip')).normalize();
    angles.push(T.MathUtils.radToDeg(torso.angleTo(new T.Vector3(0,1,0))));
    const leg=point('lowerleg_l').sub(point('upperleg_l')).normalize();
    const shin=point('foot_l').sub(point('lowerleg_l')).normalize();
    thighAngles.push(Math.atan2(leg.z,-leg.y));
    shinAngles.push(Math.atan2(shin.z,-shin.y));
    positions.push({left:point('foot_l').toArray(),right:point('foot_r').toArray()});
  }
  const range=(arr:number[])=>Math.max(...arr)-Math.min(...arr);
  let seamMaxDegrees=0,adjacentMaxDegrees=0;
  for(const track of clip.tracks){
    seamMaxDegrees=Math.max(seamMaxDegrees,T.MathUtils.radToDeg(new T.Quaternion().fromArray(track.values,0).angleTo(new T.Quaternion().fromArray(track.values,track.values.length-4))));
    for(let i=4;i<track.values.length;i+=4)adjacentMaxDegrees=Math.max(adjacentMaxDegrees,T.MathUtils.radToDeg(new T.Quaternion().fromArray(track.values,i-4).angleTo(new T.Quaternion().fromArray(track.values,i))));
  }
  const report={clip:clip.name,frames:angles.length,torsoMeanDegrees:angles.reduce((s,n)=>s+n,0)/angles.length,
    torsoMaxDegrees:Math.max(...angles),torsoMinDegrees:Math.min(...angles),
    leftThighSwingDegrees:T.MathUtils.radToDeg(range(thighAngles)),leftShinSwingDegrees:T.MathUtils.radToDeg(range(shinAngles)),seamMaxDegrees,adjacentMaxDegrees};
  reports.push(report);
  console.log('NATHAN2_RETARGET_POSTURE '+JSON.stringify(report));
  assert.ok(report.torsoMaxDegrees<30,'Actual Nathan hip-to-neck vector must remain upright: '+JSON.stringify(report));
  assert.ok(report.leftThighSwingDegrees>10,'Retarget must retain a real thigh stride, not freeze Nathan upright');
  assert.ok(report.leftShinSwingDegrees>10,'Retarget must retain knee articulation');
  assert.ok(report.seamMaxDegrees<.06,'Loop boundary must not snap back to a different joint pose');
  assert.ok(report.adjacentMaxDegrees<30,'A source ankle flip or seam correction must not introduce an abrupt internal joint jump');
  assert.ok(positions.every(p=>[...p.left,...p.right].every(Number.isFinite)),'Every sampled leg point must be finite');
  assert.ok(clip.tracks.every(t=>t.name.endsWith('.quaternion')),'Only rotations: the laboratory motor exclusively owns translation');
  for(const track of clip.tracks)for(let i=0;i<track.values.length;i+=4){
    const q=new T.Quaternion().fromArray(track.values,i);
    assert.ok(Math.abs(q.length()-1)<1e-5,'Every output quaternion must be normalized');
  }
  mixer.stopAllAction();mixer.uncacheRoot(target);
}
actor.dispose();
console.log('PASS actual Nathan bind axes, upright body and moving legs for both free CMU recordings');
