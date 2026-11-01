import assert from 'node:assert/strict';
import * as T from 'three';
import {R14,R14_WHEEL_SCALE} from '../src/r14-spec';

/** Inspect the fitted GLB, not a copy of the construction formulas. */
export function reviewVehicleConnections(model:T.Object3D,articulated:boolean,pack:{mixer:T.AnimationMixer;actions:Map<string,T.AnimationAction>}){
 model.updateWorldMatrix(true,true);
 const meshes:T.Mesh[]=[];model.traverse(n=>{if(n instanceof T.Mesh)meshes.push(n);});
 const rungs=meshes.filter(n=>/^Rear_Ladder_Close_Step/.test(n.name)),upper=rungs.find(n=>n.name==='Rear_Ladder_Close_Step_1')!;
 const section=new T.Box3().setFromObject(upper).getSize(new T.Vector3());
 assert.equal(rungs.length,11);
 for(const rung of rungs)assert.ok(new T.Box3().setFromObject(rung).getSize(new T.Vector3()).distanceTo(section)<1e-6,`${rung.name}: all eleven rungs have one section`);

 // Sample structural triangles against each actual wheel's local tyre envelope.
 // Axles and hubs are deliberately excluded: they terminate inside the wheel.
 const tyres=meshes.filter(n=>n.name==='R14_TYRE'),structure=meshes.filter(n=>/^(Chassis_Crossmember|Tank_Saddle_|Tank_Curved_Saddle|Clean_Chassis_Rail|R14_TRAILER_(FRAME|GUARD)|R14_TRACTOR_RAIL)/.test(n.name));
 let samples=0;
 const trailer=model.getObjectByName(articulated?'R14_ARTICULATED_TRAILER':'R14_RIGID_CHASSIS')!,front=model.children.filter(n=>/^R14_WHEEL_0_/.test(n.name));
 for(const angle of articulated?[-R14.maxArticulation,0,R14.maxArticulation]:[0])for(const steer of [-.55,0,.55]){
 trailer.rotation.y=angle;for(const pivot of front)pivot.rotation.y=steer;model.updateWorldMatrix(true,true);
 for(const mesh of structure){
  const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
  const box=new T.Box3().setFromObject(mesh),nearby=tyres.filter(t=>box.intersectsBox(new T.Box3().setFromObject(t)));
  if(!nearby.length)continue;
  for(let i=0;i<(index?.count||p.count);i+=3){
   const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld));
   const steps=Math.max(1,Math.ceil(Math.max(v[0].distanceTo(v[1]),v[1].distanceTo(v[2]),v[2].distanceTo(v[0]))/.004));
   for(let a=0;a<=steps;a++)for(let b=0;b<=steps-a;b++){
    const world=v[0].clone().multiplyScalar(1-(a+b)/steps).addScaledVector(v[1],a/steps).addScaledVector(v[2],b/steps);samples++;
    for(const tyre of nearby){const q=tyre.worldToLocal(world.clone()),radius=Math.hypot(q.x,q.y),inside=Math.abs(q.z)<.035*R14_WHEEL_SCALE-.0005&&radius>.055*R14_WHEEL_SCALE&&radius<R14.tyreRadius-.0005;assert.ok(!inside,`${mesh.name} intersects ${tyre.parent!.parent!.name} at ${world.toArray()}`);}
   }
  }
 }
 }
 trailer.rotation.y=0;for(const pivot of front)pivot.rotation.y=0;model.updateWorldMatrix(true,true);
 if(articulated){
  const frames=meshes.filter(n=>n.name==='R14_TRAILER_FRAME'),mounts=meshes.filter(n=>n.name==='R14_TRAILER_GUARD_MOUNT'),arms=meshes.filter(n=>n.name==='R14_TRAILER_GUARD_OUTRIGGER');
  assert.equal(frames.length,2);assert.equal(arms.length,4);
  for(const mount of mounts){const b=new T.Box3().setFromObject(mount);assert.ok(arms.some(arm=>b.intersectsBox(new T.Box3().setFromObject(arm))),'Every guard upright meets its outrigger');}
  for(const arm of arms)assert.ok(frames.some(frame=>new T.Box3().setFromObject(frame).intersectsBox(new T.Box3().setFromObject(arm))),'Every outrigger joins the chassis');
  for(const z of [.065,.245])for(let i=1;i<300;i++){
   const x=R14.hitchX+(1.51-R14.hitchX)*i/300,ray=new T.Raycaster(new T.Vector3(x,.1,z),new T.Vector3(0,-1,0));
   assert.ok(ray.intersectObjects(frames).length,`No open frame seam at ${x}/${z}`);
  }
 }
 // Every upper/middle rail intersection stays joined at all folding angles.
 const action=pack.actions.get('Tank_Railing_Raise')!,posts=meshes.filter(n=>/^Tank_Rail_Post(?:_\d+)?$/.test(n.name)),rails=meshes.filter(n=>/^Tank_Rail_Long(?:_\d+)?$/.test(n.name));
 for(let frame=0;frame<=40;frame++){
  action.time=action.getClip().duration*frame/40;pack.mixer.update(0);model.updateWorldMatrix(true,true);
  for(const post of posts){post.geometry.computeBoundingBox();const end=post.geometry.boundingBox!.max.y;
   for(const height of [end/2,end]){
    const point=post.localToWorld(new T.Vector3(0,height,0));
    assert.ok(rails.some(rail=>{rail.geometry.computeBoundingBox();const b=rail.geometry.boundingBox!,a=new T.Vector3(b.min.x,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2).applyMatrix4(rail.matrixWorld),z=new T.Vector3(b.max.x,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2).applyMatrix4(rail.matrixWorld);return new T.Line3(a,z).closestPointToPoint(point,true,new T.Vector3()).distanceTo(point)<.0002;}),`Post/rail joint gap at ${post.name}/${height}/${frame}`);
   }
  }
 }
 action.time=0;pack.mixer.update(0);model.updateWorldMatrix(true,true);
 console.log(`PASS ${articulated?'articulated':'rigid'} connections: 11 equal rungs, ${samples} tyre clearance samples, continuous frame/guard mounts and 656 folding post joints`);
}
