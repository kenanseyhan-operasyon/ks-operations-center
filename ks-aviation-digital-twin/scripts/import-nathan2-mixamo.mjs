// Explicit import of the user-supplied Mixamo captures. The published
// asset contains movement only, without duplicate character meshes.
// Usage: node scripts/import-nathan2-mixamo.mjs <FBX directory> [additional FBX directories...]
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';

const inputs=process.argv.slice(2);
if(!inputs.length)throw Error('Usage: node scripts/import-nathan2-mixamo.mjs <FBX directory> [additional FBX directories...]');
const prefix='rp_nathan_animated_003_walking_';
const definitions=[
 {id:'start-walking',label:'Yürümeye başla',file:'Start Walking.fbx',name:'Mixamo_Start_Walking',kind:'start'},
 {id:'walking',label:'Yürü',file:'Walking.fbx',name:'Mixamo_Walking',kind:'walk'},
 {id:'stop-walking',label:'Yürüyüşü bitir',file:'Stop Walking.fbx',name:'Mixamo_Stop_Walking',kind:'stop'},
 {id:'ascending-stairs',label:'Merdiven A',file:'Ascending Stairs.fbx',name:'Mixamo_Ascending_Stairs',kind:'stairs'},
 {id:'walking-up-stairs',label:'Merdiven B',file:'Walking Up The Stairs.fbx',name:'Mixamo_Walking_Up_The_Stairs',kind:'stairs'},
 {id:'descending-stairs',label:'İniş kaydı',file:'Descending Stairs (1).fbx',name:'Mixamo_Descending_Stairs',kind:'stairs-down',previewOnly:true,note:'Bu kayıt son bölümde çömelme içerir; doğal merdiven inişi olarak doğrulanmadı.'},
 {id:'driving',label:'Araç kullan',file:'Driving (1).fbx',name:'Mixamo_Driving',kind:'driving'}
];
const mapping={
 hip:'Hips',spine_01:'Spine',spine_02:'Spine1',spine_03:'Spine2',neck:'Neck',head:'Head',
 shoulder_l:'LeftShoulder',upperarm_l:'LeftArm',lowerarm_l:'LeftForeArm',hand_l:'LeftHand',
 shoulder_r:'RightShoulder',upperarm_r:'RightArm',lowerarm_r:'RightForeArm',hand_r:'RightHand',
 upperleg_l:'LeftUpLeg',lowerleg_l:'LeftLeg',foot_l:'LeftFoot',ball_l:'LeftToeBase',
 upperleg_r:'RightUpLeg',lowerleg_r:'RightLeg',foot_r:'RightFoot',ball_r:'RightToeBase'
};
for(const [side,origin] of [['l','Left'],['r','Right']])
 for(const [finger,source] of [['thumb','Thumb'],['index','Index'],['middle','Middle'],['ring','Ring'],['pinky','Pinky']])
  for(let joint=1;joint<=3;joint++)mapping[`${finger}_0${joint}_${side}`]=`${origin}Hand${source}${joint}`;

T.TextureLoader.prototype.load=function(){return new T.Texture();};
const buffer=p=>{const b=fs.readFileSync(p);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
const gltfLoader=new GLTFLoader();
gltfLoader.register(()=>({name:'ANIMATION_ONLY',loadTexture:async()=>new T.Texture()}));
const targetFile=new URL('../public/models/personnel/KS_Nathan_Runtime.glb',import.meta.url);
if(!fs.existsSync(targetFile))throw Error('Run npm run prebuild before importing Mixamo');
const target=await gltfLoader.parseAsync(buffer(targetFile),'');
const point=node=>node.getWorldPosition(new T.Vector3());
const quaternion=node=>node.getWorldQuaternion(new T.Quaternion());
const depth=node=>{let n=0;for(let p=node.parent;p;p=p.parent)n++;return n;};
const records=[];

for(const definition of definitions){
 const locations=inputs.map(input=>path.join(input,definition.file)).filter(file=>fs.existsSync(file));
 if(locations.length!==1)throw Error(`Expected exactly one source for ${definition.file}; found ${locations.length}`);
 const bytes=buffer(locations[0]);
 const source=new FBXLoader().parse(bytes,'');
 const sourceClip=source.animations.find(clip=>clip.name==='mixamo.com');
 if(!sourceClip||sourceClip.duration<=0)throw Error(`Missing Mixamo capture: ${definition.file}`);
 const scene=clone(target.scene);
 source.updateMatrixWorld(true);scene.updateMatrixWorld(true);
 const bindings=Object.entries(mapping).map(([suffix,name])=>{
  // FBXLoader may also create zero-length, duplicate-name terminal bones.
  // getObjectByName returns the actual animated parent, just like the mixer.
  const src=source.getObjectByName('mixamorig'+name),dst=scene.getObjectByName(prefix+suffix);
  if(!src?.isBone||!dst?.isBone)throw Error(`Missing rig mapping ${name} -> ${suffix}`);
  return {src,dst,inverseSourceRest:quaternion(src).invert(),targetRest:quaternion(dst)};
 }).sort((a,b)=>depth(a.dst)-depth(b.dst));
 const srcHip=source.getObjectByName('mixamorigHips'),dstHip=scene.getObjectByName(prefix+'hip');
 const sourceHipRest=point(srcHip),targetHipRest=point(dstHip);
 const legLength=(root,names)=>{
  const points=names.map(name=>point(root.getObjectByName(name)));
  return points[0].distanceTo(points[1])+points[1].distanceTo(points[2]);
 };
 const sourceLeg=(legLength(source,['mixamorigLeftUpLeg','mixamorigLeftLeg','mixamorigLeftFoot'])+
  legLength(source,['mixamorigRightUpLeg','mixamorigRightLeg','mixamorigRightFoot']))/2;
 const targetLeg=(legLength(scene,[prefix+'upperleg_l',prefix+'lowerleg_l',prefix+'foot_l'])+
  legLength(scene,[prefix+'upperleg_r',prefix+'lowerleg_r',prefix+'foot_r']))/2;
 const translationScale=targetLeg/sourceLeg;
 if(!(translationScale>.005&&translationScale<.02))throw Error('Unexpected Mixamo/Nathan scale');
 const bindBones=[];
 scene.traverse(node=>{if(node.isBone)bindBones.push({node,position:node.position.clone(),scale:node.scale.clone(),quaternion:node.quaternion.clone()});});
 const soles=['l','r'].map(side=>{
  const foot=scene.getObjectByName(prefix+'foot_'+side),ball=point(scene.getObjectByName(prefix+'ball_'+side));
  ball.y=.005;
  return {foot,local:foot.worldToLocal(ball)};
 });
 const fps=30,frames=Math.round(sourceClip.duration*fps)+1;
 const times=Array.from({length:frames},(_,i)=>i===frames-1?sourceClip.duration:i/fps);
 const values=bindings.map(()=>[]),hipPositions=[],hips=[],leftFoot=[],rightFoot=[];
 const sourceMixer=new T.AnimationMixer(source);
 const sourceAction=sourceMixer.clipAction(sourceClip);
 sourceAction.setLoop(T.LoopOnce,1);sourceAction.clampWhenFinished=true;sourceAction.play();
 const desired=new T.Quaternion(),parent=new T.Quaternion();
 for(let i=0;i<frames;i++){
  sourceMixer.setTime(times[i]);source.updateMatrixWorld(true);
  // Root translation is kept. Only its source units/body scale are converted;
  // no treadmill cancellation, constant-speed path or procedural leg target.
  const hipWorld=point(srcHip).sub(sourceHipRest).multiplyScalar(translationScale).add(targetHipRest);
  dstHip.position.copy(dstHip.parent.worldToLocal(hipWorld.clone()));
  hipPositions.push(...dstHip.position.toArray());
  for(let j=0;j<bindings.length;j++){
   const binding=bindings[j];
   desired.copy(quaternion(binding.src)).multiply(binding.inverseSourceRest).multiply(binding.targetRest);
   binding.dst.parent.getWorldQuaternion(parent);
   binding.dst.quaternion.copy(parent).invert().multiply(desired).normalize();
   if(i){const previous=new T.Quaternion().fromArray(values[j],(i-1)*4);if(previous.dot(binding.dst.quaternion)<0){const q=binding.dst.quaternion;q.set(-q.x,-q.y,-q.z,-q.w);}}
   binding.dst.updateWorldMatrix(false,false);
   values[j].push(...binding.dst.quaternion.toArray());
  }
  scene.updateMatrixWorld(true);
  hips.push(point(dstHip).toArray());
  leftFoot.push(soles[0].foot.localToWorld(soles[0].local.clone()).toArray());
  rightFoot.push(soles[1].foot.localToWorld(soles[1].local.clone()).toArray());
 }
 const tracks=bindings.map((binding,i)=>new T.QuaternionKeyframeTrack(binding.dst.name+'.quaternion',times,values[i]));
 // Reset unanimated bones and local offsets explicitly: changing from another
 // Nathan action cannot leave an old root/arm/finger transform in this clip.
 const mapped=new Set(bindings.map(binding=>binding.dst));
 for(const bind of bindBones){
  if(!mapped.has(bind.node))tracks.push(new T.QuaternionKeyframeTrack(bind.node.name+'.quaternion',[0],bind.quaternion.toArray()));
  tracks.push(new T.VectorKeyframeTrack(bind.node.name+'.position',bind.node===dstHip?times:[0],bind.node===dstHip?hipPositions:bind.position.toArray()));
  tracks.push(new T.VectorKeyframeTrack(bind.node.name+'.scale',[0],bind.scale.toArray()));
 }
 const clip=new T.AnimationClip(definition.name,sourceClip.duration,tracks).optimize();
 const serialized=T.AnimationClip.toJSON(clip);delete serialized.uuid;
 const displacement=new T.Vector3().fromArray(hips.at(-1)).sub(new T.Vector3().fromArray(hips[0])).toArray();
 const record={...definition,duration:sourceClip.duration,source:{file:definition.file,sha256:createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),duration:sourceClip.duration,frames,translationScale},mappedBones:bindings.length,displacement,trajectory:{times,hips,leftFoot,rightFoot},clip:serialized};
 records.push(record);
 console.log(JSON.stringify({id:record.id,duration:record.duration,mappedBones:record.mappedBones,translationScale,displacement}));
 sourceMixer.stopAllAction();sourceMixer.uncacheRoot(source);
}
const destination=new URL('../public/mocap/mixamo/nathan-mixamo.json',import.meta.url);
fs.mkdirSync(new URL('.',destination),{recursive:true});
fs.writeFileSync(destination,JSON.stringify({schema:1,coordinateSpace:'Nathan GLTF model space, metres, forward +Z; apply actor normalizer afterwards',motions:records},(key,value)=>typeof value==='number'?Number(value.toFixed(7)):value));
console.log(`Imported ${records.length} Mixamo captures: ${fs.statSync(destination).size} bytes`);
