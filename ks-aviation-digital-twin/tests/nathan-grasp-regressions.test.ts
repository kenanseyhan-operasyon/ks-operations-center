import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VehicleRig} from '../src/vehicle-rig';
import {closedAnimationPack} from '../src/model-animations';
import {NathanActor,parseNathanAccessClips} from '../src/nathan-model';
import {makeNathanAccess} from '../src/nathan-access';
import {driverPose} from '../src/nathan-driver';
import {stairPose} from '../src/nathan-stair-gait';
import {newEntity} from '../src/scene-data';
import {applyTransform} from '../src/objects';
import {NathanNavigation} from '../src/nathan-navigation';
import {NATHAN_PRESET} from '../src/nathan-data';
import {R14} from '../src/r14-spec';
async function read(path:string){const b=fs.readFileSync(path),l=new GLTFLoader();l.register(()=>({name:'QA_TEXTURE',loadTexture:async()=>new T.Texture()}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const vehicle=await read('public/models/refueller-38k-r14.glb'),model=vehicle.scene,pack=closedAnimationPack(model,vehicle.animations),rig=new VehicleRig(model),truck=newEntity('R14',0,0);
const root=new T.Group(),orient=new T.Group();root.add(orient);orient.rotation.y=-Math.PI/2;orient.add(model);const scale=13.5/2.47;model.scale.setScalar(scale);model.position.set(-R14.centreX*scale,.454*scale,-R14.centreZ*scale);applyTransform(root,truck);
for(const name of ['Tank_Railing_Raise','Platform_Gate_Open']){const a=pack.actions.get(name)!;a.time=a.getClip().duration;}pack.mixer.update(0);
rig.cab.setDoor('left',true);for(let i=0;i<20;i++)rig.cab.updateDoors(.05);
const asset=await read('public/models/personnel/KS_Nathan_15_Hareket.glb');asset.animations.push(...parseNathanAccessClips(JSON.parse(fs.readFileSync('public/models/personnel/nathan-access-animations.json','utf8'))));
const person=newEntity(NATHAN_PRESET,0,0),personRoot=new T.Group(),actor=new NathanActor(personRoot,asset,1.78),entities=[truck,person],objects=new Map([[truck.id,root],[person.id,personRoot]]);
const nav=new NathanNavigation(entities,.34,undefined,id=>objects.get(id),person.id),prefix='rp_nathan_animated_003_walking_';
const world=(n:T.Object3D)=>n.getWorldPosition(new T.Vector3());
// Keep the real hand surface, including finger and thumb triangles. A perfect
// IK target alone cannot detect a rail driven through the middle of the palm.
const skinHands:{mesh:T.SkinnedMesh;triangles:number[][]}[][]=[[],[]];
actor.model.traverse(n=>{if(!(n instanceof T.SkinnedMesh))return;
 const g=n.geometry,skin=g.attributes.skinIndex,weights=g.attributes.skinWeight,index=g.index!.array;
 for(let side=0;side<2;side++){
  const hand=actor.contactRig!.arms[side].end,bones=new Set<number>();
  n.skeleton.bones.forEach((bone,i)=>{for(let p:T.Object3D|null=bone;p;p=p.parent)if(p===hand){bones.add(i);break;}});
  const included=Array.from({length:g.attributes.position.count},(_,i)=>{let w=0;for(let j=0;j<4;j++)if(bones.has(skin.array[i*4+j]))w+=weights.array[i*4+j];return w>.7;});
  const triangles:number[][]=[];for(let i=0;i<index.length;i+=3)if([0,1,2].every(j=>included[index[i+j]]))triangles.push([index[i],index[i+1],index[i+2]]);
  skinHands[side].push({mesh:n,triangles});
 }
});
const posts:T.Mesh[]=[];model.traverse(n=>{if(n instanceof T.Mesh&&/^Basket_Vertical(?:_|$)/.test(n.name))posts.push(n);});
for(const kind of ['driver','platform','rear'] as const){
 const access=makeNathanAccess(truck,root,kind,nav)!;assert.ok(access?.contacts);
 let maxBend=0,held=0,transfers=0,postChecks=0,maxPalmPenetration=0;
 for(const down of [false,true]){
  actor.contact();
  for(let frame=0;frame<=100;frame++){
   const p=down?1-frame/100:frame/100,pose=kind==='driver'?driverPose(access,p,down):stairPose(access.contacts!,p);
   person.position=pose.root;person.heading='heading' in pose?pose.heading:access.heading;applyTransform(personRoot,person);
   actor.motion(kind==='driver'&&p>.8?'Driving':'Climbing_Up_Ladder',.7,down);actor.contact(pose.contact);actor.update(.05);
   const contacts=actor.contactRig!.handContacts;
   if(kind!=='driver'&&(pose.contact.handWeight??1)>.999&&contacts.filter(Boolean).length===2)assert.ok(contacts.some(c=>c?.gripping),'One hand remains held while the other changes supports');
   for(let side=0;side<2;side++){
    const arm=actor.contactRig!.arms[side],palm=world(actor.model.getObjectByName(prefix+'middle_01_'+(side?'r':'l'))!).sub(world(arm.end)).normalize(),forearm=world(arm.end).sub(world(arm.lower)).normalize();
    const bend=Math.acos(T.MathUtils.clamp(palm.dot(forearm),-1,1))*180/Math.PI;maxBend=Math.max(maxBend,bend);
    assert.ok(bend<70,`${kind} ${down?'down':'up'} ${p} hand ${side}: anatomical wrist bend ${bend.toFixed(1)}°`);
    const contact=contacts[side];if(contact&&!contact.gripping&&(pose.contact.handWeight??1)>.999)transfers++;if(!contact?.gripping)continue;held++;
    assert.ok(contact.centre.distanceTo(contact.target)<.003,'Enclosed finger space stays on the actual rail');
    const lines=pose.contact.handGrips?.[side];
    if(lines?.length)assert.ok(Math.min(...lines.map(([a,b])=>new T.Line3(new T.Vector3(...a),new T.Vector3(...b)).closestPointToPoint(contact.target,true,new T.Vector3()).distanceTo(contact.target)))<.003,'Each hand stays on its own side');
    if(kind==='platform'&&frame%4===0){
     for(const post of posts){
      const b=new T.Box3().setFromObject(post);if(b.distanceToPoint(contact.target)>.05)continue;
      post.geometry.computeBoundingBox();const local=post.geometry.boundingBox!.clone(),unit=post.getWorldScale(new T.Vector3());
      // 1.5 mm skin compression tolerance; the former palm-centre target
      // put the entire 44 mm post through the hand.
      local.min.add(new T.Vector3(.0015/unit.x,.0015/unit.y,.0015/unit.z));local.max.sub(new T.Vector3(.0015/unit.x,.0015/unit.y,.0015/unit.z));
      const inverse=post.matrixWorld.clone().invert();
      for(const {mesh,triangles}of skinHands[side]){
       const cache=new Map<number,T.Vector3>(),vertex=(i:number)=>{let v=cache.get(i);if(!v){v=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);cache.set(i,v);}return v;};
       for(const indices of triangles){postChecks++;const triangle=new T.Triangle(...indices.map(vertex) as [T.Vector3,T.Vector3,T.Vector3]);
        if(local.intersectsTriangle(triangle)){maxPalmPenetration++;}
       }
      }
     }
    }
   }
   if(kind!=='driver'&&pose.contact.feet.every(f=>f[1]<=.0120001))assert.ok(pose.contact.handWeight!<1e-6,'Release handholds once both feet are on the ground');
  }
 }
 assert.ok(held>40,kind+': the test exercises real held contacts');
 if(kind==='platform'){assert.ok(postChecks>1000);assert.equal(maxPalmPenetration,0,'Actual platform profile must not intersect the closed hand surface');}
 console.log(`PASS ${kind}: 202 ascent/descent and reach/release poses, ${held} held contacts, ${transfers} released transfer samples, maximum wrist bend ${maxBend.toFixed(2)}°, ${postChecks} hand/profile triangle checks`);
}
actor.dispose();rig.dispose();
