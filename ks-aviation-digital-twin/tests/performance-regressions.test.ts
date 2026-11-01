import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {SkinnedBounds} from '../src/skinned-bounds';
import {NathanActor,parseNathanAccessClips} from '../src/nathan-model';
import {surfaceProjector} from '../src/surface-projector';
import {antialiasSize} from '../src/scene-antialias';
import {batchVehicle} from '../src/vehicle-batching';
import {VehicleRig} from '../src/vehicle-rig';
import {closedAnimationPack} from '../src/model-animations';
import {JSDOM} from 'jsdom';

for(const [width,height,dpr] of [[1280,720,1],[1920,1080,2],[3840,2160,2],[390,844,3],[0,0,1]])for(const mobile of [false,true]){
 const size=antialiasSize(width,height,dpr,mobile);
 assert.ok(size.width*size.height<=(mobile?1500000:3000000),'High-DPI screens obey the pixel budget');
 assert.ok(size.width>=1&&size.height>=1);
}

function parseGLB(path:string){const b=fs.readFileSync(path),length=b.readUInt32LE(12);return {doc:JSON.parse(b.subarray(20,20+length).toString()),bin:b.subarray(28+length)};}
const original=parseGLB('public/models/personnel/KS_Nathan_15_Hareket.glb'),runtime=parseGLB('public/models/personnel/KS_Nathan_Runtime.glb');
assert.deepEqual(runtime.doc.animations,original.doc.animations);
assert.deepEqual(runtime.doc.nodes,original.doc.nodes);
assert.deepEqual(runtime.doc.skins,original.doc.skins);
assert.deepEqual(runtime.doc.meshes,original.doc.meshes);
assert.deepEqual(runtime.doc.accessors,original.doc.accessors);
assert.ok(runtime.bin.length<original.bin.length*.3,'Runtime download has a substantial reduction');
for(let i=0;i<original.doc.bufferViews.length;i++)if(i!==original.doc.images[0].bufferView){
 const a=original.doc.bufferViews[i],b=runtime.doc.bufferViews[i];
 assert.ok(original.bin.subarray(a.byteOffset||0,(a.byteOffset||0)+a.byteLength).equals(runtime.bin.subarray(b.byteOffset||0,(b.byteOffset||0)+b.byteLength)),`Geometry/animation buffer ${i} stays byte-identical`);
}
const loader=new GLTFLoader();loader.register(()=>({name:'TEST_TEXTURE',loadTexture:async()=>new T.Texture()}));
const bytes=fs.readFileSync('public/models/personnel/KS_Nathan_Runtime.glb');
const asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
asset.animations.push(...parseNathanAccessClips(JSON.parse(fs.readFileSync('public/models/personnel/nathan-access-animations.json','utf8'))));
const root=new T.Group();root.position.set(12,.7,-4);root.rotation.y=.75;root.scale.setScalar(.87);
const actor=new NathanActor(root,asset,1.78),point=new T.Vector3(),transform=new T.Matrix4();let poses=0,maxError=0;
const meshes:T.SkinnedMesh[]=[];actor.model.traverse(n=>{if(n instanceof T.SkinnedMesh)meshes.push(n);});
for(let clip=0;clip<actor.clips.length;clip++)for(const fraction of [.13,.5,.89]){
 actor.select(clip,false);actor.mixer.setTime(actor.clips[clip].duration*fraction);root.updateWorldMatrix(true,true);
 for(const mesh of meshes){
  transform.copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
  const local=new T.Box3(),entity=new T.Box3(),expectedLocal=new T.Box3(),expectedEntity=new T.Box3();
  new SkinnedBounds(mesh).measure(local,entity,transform);
  for(let i=0;i<mesh.geometry.attributes.position.count;i++){
   mesh.getVertexPosition(i,point);expectedLocal.expandByPoint(point);expectedEntity.expandByPoint(point.applyMatrix4(transform));
  }
  const error=Math.max(local.min.distanceTo(expectedLocal.min),local.max.distanceTo(expectedLocal.max),entity.min.distanceTo(expectedEntity.min),entity.max.distanceTo(expectedEntity.max));
  maxError=Math.max(maxError,error);assert.ok(error<1e-7,`${actor.clips[clip].name}: exact skinned bounds ${error}`);
 }
 poses++;
}
actor.dispose();console.log(`PASS ${poses} Nathan poses: exact skinning bounds, max error ${maxError}; original rig and animation bytes`);

const shell=new T.Mesh(new T.SphereGeometry(2,32,24),new T.MeshBasicMaterial({side:T.DoubleSide}));shell.position.set(1,.5,-.4);shell.rotation.set(.2,.3,.1);shell.scale.set(2,.6,.8);shell.updateWorldMatrix(true,true);
const project=surfaceProjector(shell),bounds=new T.Box3().setFromObject(shell),ray=new T.Raycaster();
for(let i=1;i<15;i++)for(let j=1;j<12;j++)for(const side of [-1,1]){
 const x=T.MathUtils.lerp(bounds.min.x,bounds.max.x,i/15),y=T.MathUtils.lerp(bounds.min.y,bounds.max.y,j/12);
 ray.set(new T.Vector3(x,y,side>0?bounds.max.z+1:bounds.min.z-1),new T.Vector3(0,0,-side));
 const hit=ray.intersectObject(shell)[0],z=project(x,y,side);
 assert.equal(z===undefined,!hit);if(hit)assert.ok(Math.abs(z!-hit.point.z)<1e-8,'Indexed paint projection matches triangle raycasts');
}

const model=new T.Group(),hinge=new T.Group();model.add(hinge);const material=new T.MeshBasicMaterial(),geo=new T.BoxGeometry(),ownedG:T.BufferGeometry[]=[],ownedM:T.Material[]=[];
for(let i=0;i<5;i++){const n=new T.Mesh(geo,material);n.name=`fixed_${i}`;n.position.set(i*2,0,0);hinge.add(n);}
const moving=new T.Mesh(geo,material);moving.name='animated';moving.position.y=4;hinge.add(moving);
const mirrored=new T.Group();mirrored.scale.x=-1;model.add(mirrored);for(let i=0;i<3;i++){const mesh=new T.Mesh(geo,material);mesh.position.z=10+i*2;mirrored.add(mesh);}
const clip=new T.AnimationClip('move',1,[new T.VectorKeyframeTrack('animated.position',[0,1],[0,4,0,0,5,0])]);
const before=new T.Box3().setFromObject(model),stats=batchVehicle(model,[clip],g=>{ownedG.push(g);return g;},m=>ownedM.push(m),[hinge]);
assert.equal(stats.savedDraws,4);assert.ok(moving.material.visible);assert.ok(new T.Box3().setFromObject(model).equals(before));
assert.ok(material.visible,'Source/shared material stays intact');
assert.ok(mirrored.children.every(n=>(n as T.Mesh).material===material),'Mirrored parents retain renderer winding and front faces');
hinge.rotation.y=.6;model.updateWorldMatrix(true,true);
const fixed=model.getObjectByName('fixed_2')!,at=fixed.getWorldPosition(new T.Vector3());ray.set(at.clone().add(new T.Vector3(0,4,0)),new T.Vector3(0,-1,0));
assert.equal(ray.intersectObject(model,true)[0].object,fixed,'Named interaction survives merging and hinge motion');
assert.ok(model.getObjectByName('R14_STATIC_BATCH_0')!.parent===hinge);
console.log('PASS bounded antialias resolution, exact paint projection, rigid draw merging and retained animated/pickable parts');

const dom=new JSDOM('<body></body>');Object.assign(globalThis,{document:dom.window.document,window:dom.window});dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
const vehicleBytes=fs.readFileSync('public/models/refueller-38k-r14.glb');
for(const articulated of [false,true]){
 const vehicle=await loader.parseAsync(vehicleBytes.buffer.slice(vehicleBytes.byteOffset,vehicleBytes.byteOffset+vehicleBytes.byteLength),'');
 const pack=closedAnimationPack(vehicle.scene,vehicle.animations),rig=new VehicleRig(vehicle.scene,articulated);
 const stats=rig.optimizeRendering([...pack.actions.values()].map(action=>action.getClip()));assert.ok(stats.savedDraws>400,'Rigid vehicle parts are combined');
 const meshes=new Map<string,T.Mesh>(),batches:T.Mesh[]=[];vehicle.scene.traverse(n=>{if(n instanceof T.Mesh){meshes.set(n.uuid,n);if(n.userData.renderBatch)batches.push(n);}});
 for(const phase of [0,.35,.7,1]){
  for(const action of pack.actions.values())action.time=action.getClip().duration*phase;pack.mixer.update(0);
  rig.update(phase*7,phase*.3,phase*.4);rig.setFuelLevel(phase*38000);rig.cab.setDoor('left',true);rig.cab.updateDoors(.1);rig.cab.setInside(phase>.5);rig.deadman.update(.1);vehicle.scene.updateWorldMatrix(true,true);
  for(const batch of batches)for(const source of batch.userData.batchSources as {uuid:string;offset:number;count:number}[]){
   const mesh=meshes.get(source.uuid)!;
   for(const index of [0,Math.floor(source.count/2),source.count-1]){
    const expected=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,index).applyMatrix4(mesh.matrixWorld);
    const actual=new T.Vector3().fromBufferAttribute(batch.geometry.attributes.position,source.offset+index).applyMatrix4(batch.matrixWorld);
    assert.ok(expected.distanceTo(actual)<1e-5,`${mesh.name}: batched render follows its moving part`);
   }
  }
 }
 rig.dispose();console.log(`PASS ${articulated?'articulated':'rigid'} vehicle: ${stats.savedDraws} fewer submissions; geometry follows platform, rails, wheels, cab and tank at four poses`);
}
