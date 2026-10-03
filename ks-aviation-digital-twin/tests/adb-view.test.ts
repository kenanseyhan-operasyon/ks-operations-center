import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { airportFrame,AIRPORT_TARGET } from '../src/airport-view';
import { closedAnimationPack } from '../src/model-animations';
import { VehicleRig } from '../src/vehicle-rig';
import { VehicleLighting } from '../src/vehicle-lighting';
import { pavementTone } from '../src/ground-tone';
for(const [w,h,upright] of [[1440,900,false],[393,740,true],[844,390,true],[320,568,true]] as const){
  const f=airportFrame(w,h,upright),camera=new THREE.PerspectiveCamera(42,w/h,.05,30000);camera.position.copy(AIRPORT_TARGET).add(f.offset);camera.lookAt(AIRPORT_TARGET);camera.updateMatrixWorld();
  for(const [x,z] of [[-1250,-3850],[1750,-3850],[-1250,1250],[1750,1250]]){const p=new THREE.Vector3(x,0,z).project(camera);assert.ok(Math.abs(p.x)<.961&&Math.abs(p.y)<.961,`${w}x${h}: airport fits`);}
  assert.ok(f.offset.clone().normalize().y>.99999999,'Airport opens straight overhead in 3D');
  const a=AIRPORT_TARGET.clone().add(new THREE.Vector3(0,0,1).multiplyScalar(1500)).project(camera),b=AIRPORT_TARGET.clone().project(camera);
  assert.ok(upright?Math.abs(a.x-b.x)<.01:Math.abs(a.y-b.y)<.01,'Image edges stay upright on phone and horizontal on desktop');
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
const lens=gltf.scene.getObjectByName('Headlamp_Lens') as THREE.Mesh;
assert.ok(lens,'Actual R14 headlamp is present');const original=lens.material as THREE.MeshStandardMaterial,groundScene=new THREE.Scene(),rig=new VehicleLighting(gltf.scene,groundScene);
const lightMaterial=lens.material as THREE.MeshStandardMaterial;
assert.notEqual(lightMaterial,original,'Vehicle owns its emissive material');
assert.equal(lightMaterial.emissiveIntensity,0,'Engine starts stopped, lamps off');
rig.update(true,true,0);assert.ok(lightMaterial.emissiveIntensity>2,'Night headlights activate with engine');assert.ok(groundScene.children[0].visible,'Night ground light pools visible');
rig.update(true,false,0);assert.ok(lightMaterial.emissiveIntensity>0,'Day running lamps stay on');assert.equal(groundScene.children[0].visible,false,'Day does not draw ground light pools');
rig.update(false,true,0);assert.equal(lightMaterial.emissiveIntensity,0,'Stopping engine switches off lamps');assert.equal(groundScene.children[0].visible,false);rig.dispose();assert.equal(lens.material,original);assert.equal(groundScene.children.length,0,'Removal releases light effects');
console.log('PASS: night/engine lights on real GLB; desktop horizontal / phone fixed bearing, full airport framing, pavement contrast, real R14 closed initialization and reversible railing animation.');

// Existing front and rear lenses flash independently; tyre axes come from actual GLB geometry.
const lights2=new VehicleLighting(gltf.scene,groundScene);
const rightFront=gltf.scene.getObjectByName('Amber_Indicator') as THREE.Mesh,leftFront=gltf.scene.getObjectByName('Amber_Indicator_1') as THREE.Mesh;
const intensity=(n:THREE.Mesh)=>(n.material as THREE.MeshStandardMaterial).emissiveIntensity;
lights2.update(true,false,0,'left');assert.equal(intensity(rightFront),0);assert.ok(intensity(leftFront)>0);assert.ok(intensity(gltf.scene.getObjectByName('Rear_Indicator_Left') as THREE.Mesh)>0);assert.equal(intensity(gltf.scene.getObjectByName('Rear_Indicator_Right') as THREE.Mesh),0);
lights2.update(true,false,0,'right');assert.ok(intensity(rightFront)>0);assert.equal(intensity(leftFront),0);
lights2.update(true,false,450,'right');assert.equal(intensity(rightFront),0,'Indicators have an off phase');
lights2.update(true,false,0,'hazard',true);assert.ok(intensity(rightFront)>0&&intensity(leftFront)>0);assert.equal(intensity(gltf.scene.getObjectByName('Rear_Position_Lamp_Left') as THREE.Mesh),6,'Braking brightens rear stop lamps');lights2.dispose();
gltf.scene.scale.setScalar(5);gltf.scene.updateMatrixWorld(true);const wheels=new VehicleRig(gltf.scene);assert.equal(wheels.wheels.length,6);assert.equal(wheels.wheels.filter(w=>w.front).length,2);assert.ok(wheels.wheelbase>6&&wheels.wheelbase<8);
const centres=wheels.wheels.map(w=>w.pivot.position.clone());wheels.update(8,.3);for(const [i,w] of wheels.wheels.entries()){assert.ok(w.spin.rotation.z>0);assert.equal(w.pivot.rotation.y,w.front?-.3:0);assert.ok(w.pivot.position.distanceTo(centres[i])<1e-9,'Tyres turn at fixed axle centres');}wheels.update(-2,-.2);assert.ok(wheels.wheels.every(w=>w.spin.rotation.z<0),'Reverse reverses tyre spin');wheels.dispose();
console.log('PASS: six real R14 tyres split into stable pivots, front-only steering, reverse spin, existing front/rear left/right/hazard signals and brake lamps.');
