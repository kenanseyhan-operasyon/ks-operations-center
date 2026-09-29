import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { airportFrame,AIRPORT_TARGET,RUNWAY_BEARING } from '../src/airport-view';
import { closedAnimationPack } from '../src/model-animations';
import { pavementTone } from '../src/ground-tone';
for(const [w,h,upright] of [[1440,900,false],[393,740,true],[844,390,true],[320,568,true]] as const){
  const f=airportFrame(w,h,upright),camera=new THREE.PerspectiveCamera(42,w/h,.05,30000);camera.position.copy(AIRPORT_TARGET).add(f.offset);camera.lookAt(AIRPORT_TARGET);camera.updateMatrixWorld();
  for(const [x,z] of [[-1250,-3850],[1750,-3850],[-1250,1250],[1750,1250]]){const p=new THREE.Vector3(x,0,z).project(camera);assert.ok(Math.abs(p.x)<.92&&Math.abs(p.y)<.86,`${w}x${h}: airport fits`);}
  const a=AIRPORT_TARGET.clone().add(new THREE.Vector3(Math.sin(RUNWAY_BEARING),0,Math.cos(RUNWAY_BEARING)).multiplyScalar(1500)).project(camera),b=AIRPORT_TARGET.clone().project(camera);
  assert.ok(upright?Math.abs(a.x-b.x)<.01:Math.abs(a.y-b.y)<.01,'Runway axis stays upright on phone and horizontal on desktop');
}
assert.equal(airportFrame(393,740,true).bearing,airportFrame(844,390,true).bearing,'Phone rotation preserves airport bearing');
const cream=pavementTone(230,228,220);assert.ok(cream[0]<210&&cream[1]<210&&cream[2]<210);assert.ok(cream[0]>cream[2]);assert.deepEqual(pavementTone(60,95,48),[60,95,48],'Vegetation retains its color');

// Load real GLB geometry and animation tracks without texture decoding (no GPU needed).
const bytes=readFileSync('public/models/refueller-38k-r14.glb'),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length).toString());
json.materials=[];json.images=[];json.textures=[];for(const mesh of json.meshes)for(const p of mesh.primitives)delete p.material;
const js=Buffer.from(JSON.stringify(json)),padding=(4-js.length%4)%4,chunk=Buffer.concat([js,Buffer.alloc(padding,32)]),bin=bytes.subarray(20+length),total=Buffer.alloc(20+chunk.length+bin.length);
bytes.copy(total,0,0,12);total.writeUInt32LE(total.length,8);total.writeUInt32LE(chunk.length,12);total.writeUInt32LE(0x4e4f534a,16);chunk.copy(total,20);bin.copy(total,20+chunk.length);
const gltf=await new GLTFLoader().parseAsync(total.buffer.slice(total.byteOffset,total.byteOffset+total.byteLength),'');
const pack=closedAnimationPack(gltf.scene,gltf.animations),clip=gltf.animations.find(c=>c.name==='Tank_Railing_Raise')!,track=clip.tracks[0],binding=THREE.PropertyBinding.parseTrackName(track.name),hinge=gltf.scene.getObjectByName(binding.nodeName)!;
assert.ok(hinge);const closed=new THREE.Quaternion().fromArray(track.values,0);assert.ok(hinge.quaternion.angleTo(closed)<1e-5,'Actual R14 hinge starts folded at first animation key');
const action=pack.actions.get(clip.name)!;assert.equal(action.paused,true);pack.mixer.update(5);assert.ok(hinge.quaternion.angleTo(closed)<1e-5,'Waiting does not raise the railing');
action.paused=false;action.timeScale=1;action.play();pack.mixer.update(clip.duration+1);assert.ok(hinge.quaternion.angleTo(closed)>.5,'Open reaches upright pose');
action.paused=false;action.timeScale=-1;action.play();pack.mixer.update(clip.duration+1);assert.ok(hinge.quaternion.angleTo(closed)<1e-5,'Close returns to folded pose');
console.log('PASS: desktop horizontal / phone fixed bearing, full airport framing, pavement contrast, real R14 closed initialization and reversible railing animation.');
