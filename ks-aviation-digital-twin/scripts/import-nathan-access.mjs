// Run explicitly with the three supplied FBX files in the input directory.
// Keep only animation data; do not ship three duplicate 24 MB character skins.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const input=process.argv[2];if(!input)throw new Error('Usage: node scripts/import-nathan-access.mjs <FBX directory>');
T.TextureLoader.prototype.load=function(){return new T.Texture();};
const buffer=p=>{const b=fs.readFileSync(p);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
const loader=new GLTFLoader();loader.register(()=>({name:'ANIMATION_ONLY',loadTexture:async()=>new T.Texture()}));
const target=await loader.parseAsync(buffer(new URL('../public/models/personnel/KS_Nathan_15_Hareket.glb',import.meta.url)),'');
const clips=[],sources=[];
for(const [file,name] of [['Climbing (1).fbx','Climbing_Up_Ladder'],['Climbing Down Wall.fbx','Climbing_Down_Wall'],['Descending Stairs.fbx','Descending_Stairs']]){
 const bytes=buffer(path.join(input,file)),source=new FBXLoader().parse(bytes,''),clip=source.animations.find(c=>c.name==='mixamo.com');
 if(!clip)throw new Error(`Missing primary animation: ${file}`);
 const tracks=[];
 target.scene.traverse(b=>{
  if(!b.isBone)return;const from=source.getObjectByName(b.name);if(!from?.isBone)throw new Error(`Incompatible skeleton: ${b.name}`);
  const correction=b.quaternion.clone().multiply(from.quaternion.clone().invert());
  for(const property of ['position','quaternion','scale']){
   const original=clip.tracks.find(t=>t.name===`${b.name}.${property}`);
   if(!original){const Track=property==='quaternion'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack;tracks.push(new Track(`${b.name}.${property}`,[0],b[property].toArray()));continue;}
   const track=original.clone();
   for(let i=0;i<track.values.length;i+=track.getValueSize()){
    if(property==='quaternion')new T.Quaternion().fromArray(track.values,i).premultiply(correction).normalize().toArray(track.values,i);
    else if(property==='position')new T.Vector3().fromArray(track.values,i).sub(from.position).applyQuaternion(correction).add(b.position).toArray(track.values,i);
   }
   tracks.push(track.optimize());
  }
 });
 clips.push(T.AnimationClip.toJSON(new T.AnimationClip(name,clip.duration,tracks)));
 sources.push({file,sha256:createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),clip:'mixamo.com',name,duration:clip.duration});
}
// UUIDs are runtime identities, not reproducible asset data.
for(const clip of clips)delete clip.uuid;
const output=new URL('../public/models/personnel/nathan-access-animations.json',import.meta.url);
fs.writeFileSync(output,JSON.stringify({schema:1,sources,clips}));
console.log(`Imported ${clips.length} compatible clips: ${fs.statSync(output).size} bytes`);
