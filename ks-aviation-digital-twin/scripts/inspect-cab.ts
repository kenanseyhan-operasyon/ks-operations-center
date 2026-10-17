/** Offline geometry projection for cab QA. No browser/GPU or production state.
 * CAB_QA_DIR=/absolute/path esbuild ... then node the bundled output.
 * JSON contains projected vertices for a depth-buffered diagnostic renderer. */
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VehicleRig} from '../src/vehicle-rig';
import {closedAnimationPack} from '../src/model-animations';
import {newEntity} from '../src/scene-data';
import {applyTransform,makeObject} from '../src/objects';
import {R14} from '../src/r14-spec';
import {cabPoint} from '../src/cab-reference';
import {NathanActors,parseNathanAccessClips} from '../src/nathan-model';
import {NATHAN_PRESET} from '../src/nathan-data';
import {NathanNavigation} from '../src/nathan-navigation';
import {makeDriverAccess,driverPose} from '../src/nathan-driver';
import {makeNathanAccess} from '../src/nathan-access';
import {stairPose} from '../src/nathan-stair-gait';
const out=process.env.CAB_QA_DIR;if(!out)throw new Error('Set CAB_QA_DIR to the diagnostic output folder');fs.mkdirSync(out,{recursive:true});
async function read(path:string){const b=fs.readFileSync(path),l=new GLTFLoader();l.register(()=>({name:'QA_TEXTURE',loadTexture:async()=>new T.Texture()}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const vehicle=await read('public/models/refueller-38k-r14.glb'),model=vehicle.scene,pack=closedAnimationPack(model,vehicle.animations),rig=new VehicleRig(model);
const truck=newEntity('R14',0,0),root=new T.Group(),orient=new T.Group();root.add(orient);orient.rotation.y=-Math.PI/2;orient.add(model);model.scale.setScalar(truck.length/R14.length);model.position.set(-R14.centreX*model.scale.x,.454*model.scale.x,-R14.centreZ*model.scale.x);applyTransform(root,truck);
const point=(p:number[])=>model.localToWorld(new T.Vector3(...cabPoint(...p as [number,number,number])));
function exportView(name:string,eye:number[],look:number[],span=4.1,person?:T.Object3D,top=false){
 if(process.env.CAB_QA_VIEWS&&!process.env.CAB_QA_VIEWS.split(',').includes(name))return;
 root.updateWorldMatrix(true,true);person?.updateWorldMatrix(true,true);
 const camera=new T.OrthographicCamera(-span*.65,span*.65,span/2,-span/2,.01,50);camera.position.copy(point(eye));if(top)camera.up.set(0,0,-1);camera.lookAt(point(look));camera.updateMatrixWorld(true);
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const meshes:unknown[]=[];
 for(const group of [root,...(person?[person]:[])])group.traverse(n=>{
  if(!(n instanceof T.Mesh))return;for(let p:T.Object3D|null=n;p;p=p.parent)if(!p.visible)return;
  if(group===root&&!frustum.intersectsBox(new T.Box3().setFromObject(n,true)))return;
  const g=n.geometry,mat=(Array.isArray(n.material)?n.material[0]:n.material) as T.MeshStandardMaterial;
  if(mat.transparent&&mat.opacity<.2)return;
  const vs=[],ns=[];for(let i=0;i<g.attributes.position.count;i++){const v=n.getVertexPosition(i,new T.Vector3()).applyMatrix4(n.matrixWorld);ns.push(v.toArray());vs.push(v.project(camera).toArray());}
  meshes.push({vs,world:ns,side:mat.side,ids:Array.from(g.index?.array||Array.from({length:vs.length},(_,i)=>i)),color:group===person?'#5684a5':'#'+(mat.color?.getHexString()||'777777'),name:n.name});
 });fs.writeFileSync(out+'/'+name+'.json',JSON.stringify(meshes));console.log('Projected',name);
}
exportView('layout-side',[2,1.6,8],[2,1.5,0],4.2);
exportView('layout-top',[2,9,.4],[2,0,.4],4.6,undefined,true);
exportView('cab-closed-side',[.9,1.45,7],[.9,1.45,0],3.4);
exportView('cab-closed-front',[-6,1.5,0],[.7,1.5,0],3.4);
rig.cab.setDoor('left',true);for(let i=0;i<20;i++)rig.cab.updateDoors(.05);
exportView('cab-open-side',[.9,1.5,7],[.9,1.5,0],3.4);
exportView('cab-open-oblique',[-3,3.1,5],[.9,1.3,.4],3.7);
exportView('cab-open-top',[.8,8,.6],[.8,0,.6],4.8,undefined,true);
const asset=await read('public/models/personnel/KS_Nathan_15_Hareket.glb');asset.animations.push(...parseNathanAccessClips(JSON.parse(fs.readFileSync('public/models/personnel/nathan-access-animations.json','utf8'))));
const person=newEntity(NATHAN_PRESET,0,0),personRoot=makeObject(person),entities=[truck,person],objects=new Map([[truck.id,root],[person.id,personRoot]]),actors=new NathanActors(()=>{},async()=>asset);actors.sync(entities,objects);await new Promise(r=>setTimeout(r,0));const actor=actors.states.get(person.id)!.actor!;
const access=makeDriverAccess(truck,root,new NathanNavigation(entities,.34,undefined,id=>objects.get(id),person.id))!;
console.log('Stops',JSON.stringify(access.contacts!.stops.map(p=>{const q=model.worldToLocal(new T.Vector3(...p));return [(q.x+.8958)*model.scale.x,(q.y+.454)*model.scale.x,(q.z-.155)*model.scale.x];})));
for(const p of [.5,.6,.7,.8,.9,1]){
 const pose=driverPose(access,p);person.position=pose.root;person.heading=pose.heading;applyTransform(personRoot,person);actor.motion(p>.8?'Driving':pose.root[1]<.01?'Nathan_Original_Walk':'Climbing_Up_Ladder');actor.contact(pose.contact);for(let i=0;i<6;i++)actor.update(.05);
 exportView('driver-'+p,[.9,1.5,7],[.9,1.5,.4],3.4,personRoot);
 exportView('driver-oblique-'+p,[-3,3,5],[.9,1.4,.4],3.7,personRoot);
 console.log('Driver',p,'head',actor.eyePoint().toArray(),'errors',actor.contactRig!.errors);
}
const gate=pack.actions.get('Platform_Gate_Open')!;gate.time=gate.getClip().duration;pack.mixer.update(0);
const platform=makeNathanAccess(truck,root,'platform',new NathanNavigation(entities,.34,undefined,id=>objects.get(id),person.id))!;
for(const p of [.65,1]){
 const pose=stairPose(platform.contacts!,p);person.position=pose.root;person.heading=platform.heading;applyTransform(personRoot,person);
 actor.contact();actor.motion(p===1?'Idle':'Climbing_Up_Ladder');actor.contact(pose.contact);for(let i=0;i<6;i++)actor.update(.05);
 exportView('platform-'+p,[2.5,1.6,8],[2.5,1.6,0],3.9,personRoot);
}
rig.dispose();actors.sync([],new Map());
