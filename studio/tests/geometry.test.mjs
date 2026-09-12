import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bakeStaticScene,splitFaces,buildWeldMap,sculpt,ModelHistory,checkGLB,disposeModel} from '../public/geometry.mjs';
import {fixtureGLB} from './fixture.mjs';
test('static conversion preserves world bounds and splits faces with UVs/materials',()=>{
  const source=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(2,3,4),new THREE.MeshStandardMaterial({color:'red'}));mesh.position.set(5,2,1);mesh.rotation.y=.3;source.add(mesh);
  const before=new THREE.Box3().setFromObject(source),model=bakeStaticScene(source),after=new THREE.Box3().setFromObject(model);
  assert.ok(before.min.distanceTo(after.min)<1e-5);assert.ok(before.max.distanceTo(after.max)<1e-5);
  const part=model.children[0],count=part.geometry.attributes.position.count;
  const separated=splitFaces(part,new Set([0,1]));model.add(separated);
  assert.equal(part.geometry.attributes.position.count+separated.geometry.attributes.position.count,count);
  assert.equal(separated.geometry.attributes.uv.count,6);
  assert.equal(separated.material.color.getHex(),mesh.material.color.getHex());
  assert.ok(separated.position.equals(part.position));assert.throws(()=>splitFaces(part,new Set()));
  disposeModel(source);disposeModel(model);
});
test('sculpt changes vertices and undo/redo preserves shape plus part transforms',()=>{
  const source=new THREE.Group();source.add(new THREE.Mesh(new THREE.SphereGeometry(1,16,8),new THREE.MeshStandardMaterial()));
  const model=bakeStaticScene(source),mesh=model.children[0],history=new ModelHistory();
  const original=Array.from(mesh.geometry.attributes.position.array);history.push(model);
  const count=sculpt(mesh,new THREE.Vector3(0,1,0),.8,.2,'grow',buildWeldMap(mesh.geometry));
  assert.ok(count>0);assert.notDeepEqual(Array.from(mesh.geometry.attributes.position.array),original);
  mesh.position.x=3;
  const restored=history.undo(model);assert.deepEqual(Array.from(restored.children[0].geometry.attributes.position.array),original);assert.equal(restored.children[0].position.x,0);
  const redone=history.redo(restored);assert.equal(redone.children[0].position.x,3);
  history.clear();disposeModel(source);disposeModel(model);disposeModel(restored);disposeModel(redone);
});
test('browser GLB checker verifies real binary format',()=>{
  const b=fixtureGLB(),a=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);assert.equal(checkGLB(a).nodes.length,2);
  const bad=a.slice(0);new DataView(bad).setUint32(0,0,true);assert.throws(()=>checkGLB(bad));
});
