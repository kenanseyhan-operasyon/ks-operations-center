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
import {numberRefueller,refuellerDimensions} from '../src/refueller-series';

const bytes=fs.readFileSync('public/models/refueller-38k-r14.glb');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const sourceTank=gltf.scene.getObjectByName('Tank_Shell') as THREE.Mesh;
const sourcePositions=Array.from(sourceTank.geometry.attributes.position.array);
const sourceHose=gltf.scene.getObjectByName('Delivery_Hose_Taut_Parked') as THREE.Mesh;
const sourceHosePositions=Array.from(sourceHose.geometry.attributes.position.array);
function prepare(articulated=true){
  const model=clone(gltf.scene),mixer=new THREE.AnimationMixer(model);
  for(const clip of gltf.animations){const a=mixer.clipAction(clip);a.play();a.time=0;a.paused=true;}mixer.update(0);
  const animatedParents=new Map<THREE.Object3D,THREE.Object3D|null>();
  for(const clip of gltf.animations)for(const track of clip.tracks){
    const name=THREE.PropertyBinding.parseTrackName(track.name).nodeName;
    THREE.PropertyBinding.findNode(model,name)?.traverse(n=>{if(n instanceof THREE.Mesh)animatedParents.set(n,n.parent);});
  }
  const rig=new VehicleRig(model,articulated);
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
assert.ok(Math.abs(new THREE.Box3().setFromObject(tank,true).min.x+.035)<1e-5,'The wide tank body retains its original full length');
assert.ok(Math.abs(model.getObjectByName('R14_KINGPIN')!.getWorldPosition(new THREE.Vector3()).x-R14.tractorAxle)<1e-8,'The kingpin is above the tractor rear axle');
model.traverse(n=>{if(n.name==='R14_TRACTOR_RAIL')assert.ok(new THREE.Box3().setFromObject(n,true).max.x<.176,'No protruding tractor rails behind the coupling');});
assert.equal(rig.gauges.length,2);
assert.ok(rig.gauges[0].getWorldPosition(new THREE.Vector3()).z<R14.centreZ&&rig.gauges[1].getWorldPosition(new THREE.Vector3()).z>R14.centreZ,'One level gauge on each side');
for(const litres of [0,19000,38000]){rig.setFuelLevel(litres);for(const gauge of rig.gauges){assert.equal(gauge.userData.fuelLitres,litres);assert.ok(Math.abs(gauge.getObjectByName('FUEL_LEVEL_NEEDLE')!.rotation.z-(225-270*litres/38000)*Math.PI/180)<1e-9);}}
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
// Check actual equipment vertices against the tank surface throughout its sweep;
// overlapping axis-aligned bounding boxes alone are not a collision.
const equipment:THREE.Mesh[]=[];
model.traverse(n=>{if(!(n instanceof THREE.Mesh))return;for(let p=n.parent;p;p=p.parent)if(p===rig.trailer)return;equipment.push(n);});
const tankMaterial=tank.material,probeMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});tank.material=probeMaterial;
const ray=new THREE.Raycaster(),up=new THREE.Vector3(0,1,0),vertex=new THREE.Vector3();
for(let degrees=-55;degrees<=55;degrees+=5){
  rig.setArticulation(degrees*Math.PI/180);model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(tank,true);
  for(const mesh of equipment){
    if(!new THREE.Box3().setFromObject(mesh,true).intersectsBox(bounds))continue;
    const positions=mesh.geometry.getAttribute('position'),seen=new Set<string>();
    for(let i=0;i<positions.count;i++){
      vertex.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);if(!bounds.containsPoint(vertex))continue;
      const key=vertex.toArray().map(v=>v.toFixed(5)).join();if(seen.has(key))continue;seen.add(key);ray.set(vertex,up);
      const hits=ray.intersectObject(tank,false).map(h=>h.distance).filter((d,i,a)=>!i||d-a[i-1]>.00001);
      assert.equal(hits.length%2,0,`${mesh.name} must stay outside the tank at ${degrees} degrees`);
    }
  }
}
tank.material=tankMaterial;probeMaterial.dispose();
const drumBounds=new THREE.Box3().setFromObject(model.getObjectByName('Large_Reference_Hose_Drum')!,true),filterBounds=new THREE.Box3().setFromObject(model.getObjectByName('Transverse_Filter_Behind_Panel')!,true);
assert.ok(drumBounds.min.x>filterBounds.max.x,'Repositioned drum remains behind the filter');
for(const clip of gltf.animations){
  for(const track of clip.tracks){const binding=THREE.PropertyBinding.parseTrackName(track.name);assert.ok(THREE.PropertyBinding.findNode(model,binding.nodeName),'Existing animation target still exists');}
  const a=mixer.clipAction(clip);a.paused=false;a.time=clip.duration/2;mixer.update(0);a.paused=true;
}
const other=prepare();rig.setArticulation(.5);assert.equal(other.rig.trailer.rotation.y,0,'Vehicle instances are independent');
assert.deepEqual(Array.from(sourceTank.geometry.attributes.position.array),sourcePositions,'Cached GLB geometry is unchanged');
assert.deepEqual(Array.from(sourceHose.geometry.attributes.position.array),sourceHosePositions,'Coupling clearance never changes cached hose geometry');
const rigid=prepare(false),rigidTank=rigid.model.getObjectByName('Tank_Shell') as THREE.Mesh;
assert.deepEqual(Array.from(rigidTank.geometry.attributes.position.array),sourcePositions,'2000 preserves the original 38k tank');
assert.ok(rigid.model.getObjectByName('Clean_Chassis_Rail'),'2000 preserves the original single chassis');
assert.equal(rigid.model.getObjectByName('R14_KINGPIN'),undefined);
const rigidPose=new THREE.Box3().setFromObject(rigidTank,true);rigid.rig.update(3,.2,.5);rigid.model.updateMatrixWorld(true);
assert.deepEqual(new THREE.Box3().setFromObject(rigidTank,true),rigidPose,'2000 tank stays fixed to its chassis while driving');
assert.equal(refuellerDimensions('R14_2000').trailerWheelbase,0);
assert.deepEqual(Array.from((rigid.model.getObjectByName('Delivery_Hose_Taut_Parked') as THREE.Mesh).geometry.attributes.position.array),sourceHosePositions,'2000 keeps its original equipment layout');
assert.ok(Math.abs(rigid.rig.wheelbase*13.5/R14.length-refuellerDimensions('R14_2000').wheelbase)<1e-9);

function motion(){const m=new VehicleMotion({x:0,z:0,heading:0});Object.assign(m,r14Dimensions());m.throttle=1;return m;}
const straight=motion();for(let i=0;i<100;i++)straight.step(.05);assert.equal(straight.trailerAngle,0);
const curves=[];
for(const turn of [-.3,.3]){
  const results=[];
  for(const dt of [.01,.05]){const m=motion();m.turn=turn;for(let t=0;t<12-dt/2;t+=dt)m.step(dt);assert.equal(m.articulationBlocked,false);assert.ok(m.trailerAngle*turn<0,'Trailer follows inside the tractor turn');results.push(m);}
  assert.ok(Math.abs(results[0].trailerAngle-results[1].trailerAngle)<.004,'Trailer following is frame-rate stable');curves.push(results[1]);
}
assert.ok(Math.abs(curves[0].trailerAngle+curves[1].trailerAngle)<1e-10,'Left/right symmetry');
const parked=curves[1],angle=parked.trailerAngle;parked.stop();for(let i=0;i<20;i++)parked.step(.05);assert.equal(parked.trailerAngle,angle,'Pause does not straighten the tank');
const reverse=motion();reverse.throttle=-1;reverse.trailerAngle=.1;for(let i=0;i<80;i++)reverse.step(.05);assert.ok(reverse.trailerAngle>.1,'Reverse articulation is physical, not forward-only easing');
// Hold full steering long enough for several complete circles: no sudden stop,
// no trailer-angle clamp/sliding, and full speed on desktop or a slow phone frame.
for(const dt of [.01,.05,.1])for(const kmh of [2,8,25])for(const turn of [-1,1]){
  const m=motion();m.turn=turn;m.maxKmh=kmh;let yaw=0,assisted=false;
  for(let i=0;i<150/dt;i++){
    const previous=m.pose.heading;m.step(dt);yaw+=Math.atan2(Math.sin(m.pose.heading-previous),Math.cos(m.pose.heading-previous));assisted||=m.steeringAssisted;
    assert.equal(m.articulationBlocked,false,'Forward steering must not trap a vehicle in empty space');assert.ok(Math.abs(m.trailerAngle)<=R14.maxArticulation);
  }
  assert.ok(Math.abs(yaw)>Math.PI*2&&assisted);assert.ok(Math.abs(m.trailerAngle)>50*Math.PI/180,'The former 22-degree cutoff is gone');assert.ok(Math.abs(m.speed-kmh/3.6)<1e-8);
  m.turn=0;for(let i=0;i<1000;i++)m.step(dt);assert.ok(Math.abs(m.trailerAngle)<.5,'Releasing steering straightens the tank');
}
// At the reverse mechanical guard, inputs and steering continue to work.
for(const side of [-1,1]){
  const m=motion();m.trailerAngle=side*54*Math.PI/180;m.throttle=-1;m.turn=side;
  for(let i=0;i<100;i++)m.step(.05);
  assert.ok(m.articulationBlocked);assert.equal(m.speed,0);assert.equal(m.throttle,-1);assert.equal(m.turn,side);assert.equal(m.steer,side*Math.PI/5);
  const stopped={...m.pose},bent=m.trailerAngle;m.turn=-side;
  for(let i=0;i<100;i++)m.step(.05);
  assert.equal(m.articulationBlocked,false);assert.ok(m.speed<0&&Math.abs(m.trailerAngle)<Math.abs(bent));assert.notDeepEqual(m.pose,stopped);
  m.throttle=1;m.turn=0;for(let i=0;i<150;i++)m.step(.05);assert.equal(m.articulationBlocked,false);assert.ok(m.speed>0);
}
const fullLock=motion();fullLock.trailerAngle=-R14.maxArticulation;fullLock.steer=Math.PI/5;fullLock.turn=1;fullLock.speed=25/3.6;fullLock.maxKmh=25;
assert.ok(fullLock.step(.1)>0);assert.equal(fullLock.articulationBlocked,false);assert.ok(Math.abs(fullLock.trailerAngle)<=R14.maxArticulation,'Saved full-lock poses can pull forward immediately');
const legacyBent=motion();legacyBent.trailerAngle=.6;for(let i=0;i<150;i++)legacyBent.step(.05);assert.equal(legacyBent.articulationBlocked,false);assert.ok(Math.abs(legacyBent.trailerAngle)<.4,'Old parked angles can straighten without deleting their saved pose');
const entity=newEntity('R14',3,4);entity.trailerAngle=.35;
const scene=validateScene(JSON.parse(JSON.stringify({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',entities:[entity],groups:[],source:'test'})));
assert.equal(scene.entities[0].trailerAngle,.35,'Manual parked angle survives JSON/cloud validation');
delete entity.trailerAngle;assert.equal(validateScene({...scene,entities:[entity]}).entities[0].trailerAngle,undefined,'Legacy scene stays valid');
// Pre-articulation route checkpoints keep their original path and remain resumable.
const route={id:'legacy',name:'Old route',vehicleId:entity.id,points:[[0,0],[0,-30]] as [number,number][],speedKmh:8,approachKmh:2,approachDistance:10};
const old=new VehicleMotion({x:0,z:0,heading:0});old.startRoute(route);for(let i=0;i<50;i++)old.step(.05);
const checkpoint=captureDriveCheckpoint(entity.id,old)!;assert.equal(checkpoint.trailer,undefined);
const restored=new VehicleMotion(old.pose);Object.assign(restored,r14Dimensions());assert.ok(restoreDriveCheckpoint(restored,checkpoint,route));assert.equal(restored.wheelbase,old.wheelbase);assert.equal(restored.trailerAngle,0);
const fleet=validateScene({...scene,entities:[],fleetNumbers:undefined});
for(const [preset,name] of [['R14_2000','2001'],['R14','3001'],['R14_2000','2002'],['R14','3002']]){const e=newEntity(preset,0,0);numberRefueller(fleet,e);fleet.entities.push(e);assert.equal(e.name,name);}
// High water marks survive deletion, JSON/cloud reload and copies carrying old names.
fleet.entities=[];const reload=validateScene(JSON.parse(JSON.stringify(fleet)));
for(const [preset,name] of [['R14_2000','2003'],['R14','3003']]){const e=newEntity(preset,0,0);numberRefueller(reload,e);reload.entities.push(e);assert.equal(e.name,name);}
const imported=newEntity('R14',0,0);imported.name='3050';reload.entities.push(imported);const next=newEntity('R14',0,0);numberRefueller(reload,next);assert.equal(next.name,'3051');
const custom={...imported,name:'Kenan 38'};assert.equal(validateScene({...scene,entities:[custom]}).entities[0].name,'Kenan 38','Custom vehicle names survive migration');
rig.dispose();other.rig.dispose();rigid.rig.dispose();
console.log('PASS: 2000 preserved rigid tank/chassis; independent persistent 2000/3000 numbering; full 3000 tank and forward hitch; two fuel gauges; clean grounded wheels; preserved animations; forward/reverse articulation, turn limit and old/new scene compatibility.');
