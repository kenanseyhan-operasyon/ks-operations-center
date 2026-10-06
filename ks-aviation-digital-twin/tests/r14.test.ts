import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {VehicleRig} from '../src/vehicle-rig';
import {VehicleMotion} from '../src/vehicle-motion';
import {R14,r14Dimensions} from '../src/r14-spec';
import {newEntity,validateScene} from '../src/scene-data';
import {captureDriveCheckpoint,restoreDriveCheckpoint} from '../src/drive-checkpoint';

const bytes=fs.readFileSync('public/models/refueller-38k-r14.glb');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const sourceTank=gltf.scene.getObjectByName('Tank_Shell') as THREE.Mesh;
const sourcePositions=Array.from(sourceTank.geometry.attributes.position.array);
function prepare(){
  const model=clone(gltf.scene),mixer=new THREE.AnimationMixer(model);
  for(const clip of gltf.animations){const a=mixer.clipAction(clip);a.play();a.time=0;a.paused=true;}mixer.update(0);
  const animatedParents=new Map<THREE.Object3D,THREE.Object3D|null>();
  for(const clip of gltf.animations)for(const track of clip.tracks){
    const name=THREE.PropertyBinding.parseTrackName(track.name).nodeName;
    THREE.PropertyBinding.findNode(model,name)?.traverse(n=>{if(n instanceof THREE.Mesh)animatedParents.set(n,n.parent);});
  }
  const rig=new VehicleRig(model);
  for(const [mesh,parent] of animatedParents)assert.equal(mesh.parent,parent,'Animated meshes stay attached to their original hinge or lift');
  return {model,rig,mixer};
}
const {model,rig,mixer}=prepare();
const ground=R14.axleY-R14.tyreRadius;
assert.equal(rig.wheels.length,6);
assert.equal(model.getObjectByName('Original_Wheel_Pair_Front'),undefined);
assert.equal(model.getObjectByName('Clean_Chassis_Rail'),undefined);
assert.ok(model.getObjectByName('Single_Tank'));
assert.ok(model.getObjectByName('R14_KINGPIN'));
const ports:THREE.Object3D[]=[];model.traverse(n=>{if(n.name==='R14_FILL_CAP')ports.push(n);});assert.equal(ports.length,2);
for(const distance of [0,.023,.15,.37,1.2]){
  rig.update(distance,.35,.6);model.updateMatrixWorld(true);
  for(const wheel of rig.wheels){
    const b=new THREE.Box3().setFromObject(wheel.spin,true);
    assert.ok(Math.abs(b.min.y-ground)<.00015,'Every tyre stays on the same ground plane while spinning and steering');
    assert.ok(b.max.y<=R14.axleY+R14.tyreRadius+.00001,'No rotating fender fragments');
  }
}
rig.setArticulation(0);model.updateMatrixWorld(true);
const tank=model.getObjectByName('Tank_Shell') as THREE.Mesh;
assert.ok(new THREE.Box3().setFromObject(tank,true).min.x>=.0999,'Tank front clears the tractor equipment');
const tyreBounds=new THREE.Box3().setFromObject(model,true);assert.ok(tyreBounds.min.y>=ground-.00015);
const cab=model.getObjectByName('KS_LOW_CAB_C3')!,cabPos=cab.getWorldPosition(new THREE.Vector3());
const gate=model.getObjectByName('Rear_Leaf_Gate_Rail')!,gatePos=gate.getWorldPosition(new THREE.Vector3());
const hitch=rig.trailer.getWorldPosition(new THREE.Vector3());
for(const angle of [-R14.maxArticulation,0,R14.maxArticulation]){
  rig.setArticulation(angle);model.updateMatrixWorld(true);
  assert.ok(rig.trailer.getWorldPosition(new THREE.Vector3()).distanceTo(hitch)<1e-9,'Coupling cannot separate');
  assert.ok(cab.getWorldPosition(new THREE.Vector3()).distanceTo(cabPos)<1e-9,'Cab does not rotate with trailer');
  assert.ok(gate.getWorldPosition(new THREE.Vector3()).distanceTo(gatePos)<1e-9,'Both platform gate leaves stay on the tractor');
  for(const wheel of rig.wheels.filter(w=>w.trailer)){
    const p=wheel.pivot.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(Math.hypot(p.x-hitch.x,p.z-hitch.z)-Math.hypot(R14.trailerAxle-R14.hitchX,.19))<1e-8);
  }
}
for(const clip of gltf.animations){
  for(const track of clip.tracks){const binding=THREE.PropertyBinding.parseTrackName(track.name);assert.ok(THREE.PropertyBinding.findNode(model,binding.nodeName),'Existing animation target still exists');}
  const a=mixer.clipAction(clip);a.paused=false;a.time=clip.duration/2;mixer.update(0);a.paused=true;
}
const other=prepare();rig.setArticulation(.5);assert.equal(other.rig.trailer.rotation.y,0,'Vehicle instances are independent');
assert.deepEqual(Array.from(sourceTank.geometry.attributes.position.array),sourcePositions,'Cached GLB geometry is unchanged');

function motion(){const m=new VehicleMotion({x:0,z:0,heading:0});Object.assign(m,r14Dimensions());m.throttle=1;return m;}
const straight=motion();for(let i=0;i<100;i++)straight.step(.05);assert.equal(straight.trailerAngle,0);
const curves=[];
for(const turn of [-.55,.55]){
  const results=[];
  for(const dt of [.01,.05]){const m=motion();m.turn=turn;for(let t=0;t<12-dt/2;t+=dt)m.step(dt);assert.equal(m.articulationBlocked,false);assert.ok(m.trailerAngle*turn<0,'Trailer follows inside the tractor turn');results.push(m);}
  assert.ok(Math.abs(results[0].trailerAngle-results[1].trailerAngle)<.004,'Trailer following is frame-rate stable');curves.push(results[1]);
}
assert.ok(Math.abs(curves[0].trailerAngle+curves[1].trailerAngle)<1e-10,'Left/right symmetry');
const parked=curves[1],angle=parked.trailerAngle;parked.stop();for(let i=0;i<20;i++)parked.step(.05);assert.equal(parked.trailerAngle,angle,'Pause does not straighten the tank');
const reverse=motion();reverse.throttle=-1;reverse.trailerAngle=.1;for(let i=0;i<80;i++)reverse.step(.05);assert.ok(reverse.trailerAngle>.1,'Reverse articulation is physical, not forward-only easing');
const limited=motion();limited.turn=1;for(let i=0;i<2500&&!limited.articulationBlocked;i++)limited.step(.05);assert.equal(limited.articulationBlocked,true);assert.equal(limited.speed,0);assert.ok(Math.abs(limited.trailerAngle)<=R14.maxArticulation);
const entity=newEntity('R14',3,4);entity.trailerAngle=.35;
const scene=validateScene(JSON.parse(JSON.stringify({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',entities:[entity],groups:[],source:'test'})));
assert.equal(scene.entities[0].trailerAngle,.35,'Manual parked angle survives JSON/cloud validation');
delete entity.trailerAngle;assert.equal(validateScene({...scene,entities:[entity]}).entities[0].trailerAngle,undefined,'Legacy scene stays valid');
// Pre-articulation route checkpoints keep their original path and remain resumable.
const route={id:'legacy',name:'Old route',vehicleId:entity.id,points:[[0,0],[0,-30]] as [number,number][],speedKmh:8,approachKmh:2,approachDistance:10};
const old=new VehicleMotion({x:0,z:0,heading:0});old.startRoute(route);for(let i=0;i<50;i++)old.step(.05);
const checkpoint=captureDriveCheckpoint(entity.id,old)!;assert.equal(checkpoint.trailer,undefined);
const restored=new VehicleMotion(old.pose);Object.assign(restored,r14Dimensions());assert.ok(restoreDriveCheckpoint(restored,checkpoint,route));assert.equal(restored.wheelbase,old.wheelbase);assert.equal(restored.trailerAngle,0);
rig.dispose();other.rig.dispose();
console.log('PASS: R14 clean grounded wheels; independent chassis/kingpin; both filling ports; shared model and animation preservation; forward/reverse articulation, turn limit, frame rates and old/new scene compatibility.');
