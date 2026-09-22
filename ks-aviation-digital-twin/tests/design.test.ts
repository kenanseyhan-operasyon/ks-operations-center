import assert from 'node:assert/strict';
import * as THREE from 'three';
import { newEntity,validateScene,SceneHistory } from '../src/scene-data';
import { DesignSession } from '../src/design-session';
import { FLEET_SPECS } from '../src/fleet-specs';
import { makeObject,disposeObject } from '../src/objects';
import { StaticGround,GROUND_BOUNDS } from '../src/static-ground';
import { geographic,local } from '../src/geo';
import atlas from '../src/ground-atlas.json';
const data=validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',entities:[newEntity('BUILDING',12,15)],groups:[],source:'test',groundModes:{airport:'photo',facility:'satellite'}});
assert.equal(data.sharedGround,'ortho','Old per-view backgrounds migrate without moving objects');
const session=new DesignSession(data),h=new SceneHistory(data);assert.equal(session.dirty(data),false);
h.change(d=>{d.entities[0].width=19;d.entities[0].doorSide='short';d.entities[0].position[0]+=10;});
assert.equal(session.dirty(h.current),true);assert.equal(session.discard().entities[0].width,8);
assert.throws(()=>session.commit(h.current,()=>{throw new Error('quota');}));assert.equal(session.discard().entities[0].width,8,'Failed save cannot advance baseline');
let saved='';session.commit(h.current,j=>saved=j);assert.equal(JSON.parse(saved).entities[0].width,19);h.current.entities[0].width=44;const restored=session.discard();assert.equal(restored.entities[0].width,19);assert.equal(restored.entities[0].doorSide,'short');
for(const s of Object.values(FLEET_SPECS)){const o=newEntity(s.id,0,0),g=makeObject(o),box=new THREE.Box3().setFromObject(g),size=box.getSize(new THREE.Vector3());assert.ok(Math.abs(size.x-s.span)<1e-4,s.id+' span');assert.ok(Math.abs(size.y-s.height)<1e-4,s.id+' height');assert.ok(Math.abs(size.z-s.length)<1e-4,s.id+' length');assert.ok(Math.abs(box.min.y)<1e-6,s.id+' ground');assert.ok(g.getObjectByName('AIRCRAFT_BODY'));if(s.type!=='business')assert.ok(g.getObjectByName('PROPELLER'));disposeObject(g);}
for(const r of atlas){const nw=geographic(r.x,r.z),ne=geographic(r.x+r.width,r.z),a=local(nw.lat,nw.lon),b=local(ne.lat,ne.lon);assert.ok(Math.abs(b[0]-a[0]-r.width)<1e-6);}
// Static meshes and textures stay identical across view changes and load order.
const imgs:any[]=[];(globalThis as any).Image=class{onload=()=>{};onerror=()=>{};src='';constructor(){imgs.push(this);}};const ground=new StaticGround(()=>{});imgs[1].onload();imgs[0].onload();const children=[...ground.group.children];ground.sync(false);ground.sync(true);assert.deepEqual(ground.group.children,children);assert.equal(ground.ready,2);for(const m of children as THREE.Mesh[]){assert.equal((m.material as any).depthWrite,false);assert.equal((m.material as any).depthTest,false);}
assert.equal(GROUND_BOUNDS.maxX-GROUND_BOUNDS.minX,3000);
console.log('PASS: explicit save/discard and failed-save recovery; four manufacturer aircraft envelopes; common-ground migration, coordinate alignment and retained static mesh identities.');
// Real free-camera input paths: translation is not tied to an orbit target.
const { FreeCamera }=await import('../src/free-camera');
const events:Record<string,(e:any)=>void>={};
(globalThis as any).window={addEventListener(){}};(globalThis as any).document={addEventListener(){},hidden:false};
const camera=new THREE.PerspectiveCamera();camera.position.set(10,2,20);let movement=0;
const nav=new FreeCamera(camera,{addEventListener(name:string,fn:any){events[name]=fn;},setPointerCapture(){}} as any,()=>movement++);nav.enabled=true;nav.sync();nav.key('w',true);nav.update(1);nav.key('w',false);assert.ok(camera.position.z<20);const orientation=camera.quaternion.clone();nav.move(10,0,0);assert.ok(camera.quaternion.equals(orientation),'Moving preserves view direction instead of re-locking to scene center');
events.pointerdown({pointerId:1,clientX:0,clientY:0});events.pointermove({pointerId:1,clientX:1600,clientY:0});assert.ok(Math.abs(camera.quaternion.y)>0.01,'Unrestricted yaw');nav.move(0,0,-100);assert.equal(camera.position.y,.25);nav.clear();assert.ok(movement>0);
console.log('PASS: free camera translation, independent orientation, yaw input and ground floor clamp.');
