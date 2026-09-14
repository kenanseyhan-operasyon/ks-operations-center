import * as THREE from 'three';
export function cloneModel(group){
  const copy=group.clone(true);
  copy.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();}});
  return copy;
}
export function disposeModel(group,{textures=false}={}){
  const seen=new Set();
  group.traverse(o=>{if(!o.isMesh)return;o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(textures)for(const val of Object.values(m))if(val?.isTexture&&!seen.has(val)){seen.add(val);val.dispose();}
    m.dispose();
  }});
}
export function geometryBytes(group){let size=0;group.traverse(o=>{if(o.isMesh){for(const a of Object.values(o.geometry.attributes))size+=a.array?.byteLength||0;size+=o.geometry.index?.array.byteLength||0;}});return size;}
export class ModelHistory {
  constructor(limit=128*1024*1024){this.undoStack=[];this.redoStack=[];this.limit=limit;}
  push(group){this.undoStack.push(cloneModel(group));this.redoStack.forEach(x=>disposeModel(x));this.redoStack=[];while(this.undoStack.length>1&&(this.undoStack.length>12||this.undoStack.reduce((n,x)=>n+geometryBytes(x),0)>this.limit))disposeModel(this.undoStack.shift());}
  undo(current){if(!this.undoStack.length)return null;this.redoStack.push(cloneModel(current));return this.undoStack.pop();}
  redo(current){if(!this.redoStack.length)return null;this.undoStack.push(cloneModel(current));return this.redoStack.pop();}
  clear(){[...this.undoStack,...this.redoStack].forEach(x=>disposeModel(x));this.undoStack=[];this.redoStack=[];}
}
export function bakeStaticScene(scene){
  scene.updateMatrixWorld(true);const group=new THREE.Group();group.name='KS Ekipman';
  let triangles=0;
  scene.traverse(o=>{
    if(!o.isMesh)return;
    const base=o.geometry.clone(),p=base.attributes.position;
    if(!p)return;
    if(o.isSkinnedMesh||Object.keys(base.morphAttributes).length){
      const v=new THREE.Vector3();for(let i=0;i<p.count;i++){o.getVertexPosition(i,v);p.setXYZ(i,v.x,v.y,v.z);}
      delete base.attributes.skinIndex;delete base.attributes.skinWeight;base.morphAttributes={};
    }
    let geometry=base.index?base.toNonIndexed():base;
    if(geometry!==base)base.dispose();
    geometry.applyMatrix4(o.matrixWorld);
    if(o.matrixWorld.determinant()<0){
      for(const a of Object.values(geometry.attributes))for(let i=0;i<a.count;i+=3)for(let k=0;k<a.itemSize;k++){
        const at=(i+1)*a.itemSize+k,bt=(i+2)*a.itemSize+k,val=a.array[at];a.array[at]=a.array[bt];a.array[bt]=val;
      }
    }
    geometry.computeVertexNormals();
    const material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=o.name||'Parça '+(group.children.length+1);mesh.visible=o.visible;
    geometry.computeBoundingBox();const pivot=geometry.boundingBox.getCenter(new THREE.Vector3());geometry.translate(-pivot.x,-pivot.y,-pivot.z);mesh.position.copy(pivot);
    group.add(mesh);triangles+=geometry.attributes.position.count/3;
  });
  if(!group.children.length)throw new Error('GLB içinde düzenlenebilir yüzey bulunamadı.');
  if(triangles>2000000){disposeModel(group);throw new Error('Bu model 2.000.000 yüzey sınırını aşıyor. Eğitim kullanımı için modeli sadeleştir.');}
  return group;
}

export function projectPlanarUV(geometry){
  const g=geometry.clone(),p=g.attributes.position;
  if(!p)throw new Error('Kaplama için konum verisi bulunamadı.');
  g.computeBoundingBox();const box=g.boundingBox,size=box.getSize(new THREE.Vector3());
  const axes=[['x','y'],['x','z'],['z','y']].sort((a,b)=>size[b[0]]*size[b[1]]-size[a[0]]*size[a[1]])[0];
  const uv=new Float32Array(p.count*2),minA=box.min[axes[0]],minB=box.min[axes[1]],spanA=Math.max(size[axes[0]],1e-8),spanB=Math.max(size[axes[1]],1e-8);
  for(let i=0;i<p.count;i++){uv[i*2]=(p['get'+axes[0].toUpperCase()](i)-minA)/spanA;uv[i*2+1]=(p['get'+axes[1].toUpperCase()](i)-minB)/spanB;}
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g;
}

export function mergeMeshes(meshes){
  if(!Array.isArray(meshes)||meshes.length<2)throw new Error('Birleştirmek için en az iki parça seç.');
  const positions=[],normals=[],uvs=[],materials=[],groups=[];let vertexStart=0;
  for(const mesh of meshes){
    mesh.updateMatrix();const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),p=source.attributes.position;
    if(!p){source.dispose();continue;}
    const n=source.attributes.normal,uv=source.attributes.uv,matrix=mesh.matrix.clone(),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),v=new THREE.Vector3();
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(matrix);positions.push(v.x,v.y,v.z);
      if(n){v.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);normals.push(v.x,v.y,v.z);}else normals.push(0,1,0);
      if(uv)uvs.push(uv.getX(i),uv.getY(i));else uvs.push(0,0);
    }
    const sourceMaterials=Array.isArray(mesh.material)?mesh.material:[mesh.material],materialOffset=materials.length;
    sourceMaterials.forEach(m=>materials.push(m.clone()));
    if(source.groups.length)for(const group of source.groups)groups.push({start:vertexStart+group.start,count:group.count,materialIndex:materialOffset+group.materialIndex});
    else groups.push({start:vertexStart,count:p.count,materialIndex:materialOffset});
    vertexStart+=p.count;source.dispose();
  }
  if(!positions.length)throw new Error('Birleştirilecek yüzey bulunamadı.');
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  groups.forEach(g=>geometry.addGroup(g.start,g.count,g.materialIndex));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const merged=new THREE.Mesh(geometry,materials);merged.name=meshes.map(m=>m.name).join(' + ').slice(0,80);merged.userData={training:{title:merged.name,description:'',action:''}};return merged;
}
function subsetGeometry(source,faces){
  const g=new THREE.BufferGeometry();
  for(const [name,a]of Object.entries(source.attributes)){
    const values=new a.array.constructor(faces.length*3*a.itemSize);let offset=0;
    for(const face of faces)for(let v=0;v<3;v++)for(let k=0;k<a.itemSize;k++)values[offset++]=a.array[(face*3+v)*a.itemSize+k];
    g.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize,a.normalized));
  }
  const groups=source.groups;
  if(groups.length){let last=-1,start=0,count=0;
    faces.forEach((face,i)=>{const mat=groups.find(x=>face*3>=x.start&&face*3<x.start+x.count)?.materialIndex||0;
      if(mat!==last){if(count)g.addGroup(start,count,last);last=mat;start=i*3;count=0;}count+=3;});
    if(count)g.addGroup(start,count,last);
  }
  g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function splitDisconnected(mesh,{minFaces=30,maxParts=200}={}){
  const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=source.attributes.position,total=Math.floor(p.count/3);
  if(total<2)throw new Error('Bu parçada ayrılabilecek bağlantısız yüzey bulunamadı.');
  source.computeBoundingBox();const eps=Math.max(source.boundingBox.getSize(new THREE.Vector3()).length()*1e-6,1e-8),parent=new Int32Array(total),rank=new Uint8Array(total),owner=new Map();
  for(let i=0;i<total;i++)parent[i]=i;
  const find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
  const join=(a,b)=>{a=find(a);b=find(b);if(a===b)return;if(rank[a]<rank[b])[a,b]=[b,a];parent[b]=a;if(rank[a]===rank[b])rank[a]++;};
  for(let face=0;face<total;face++)for(let v=0;v<3;v++){
    const i=face*3+v,key=[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n/eps)).join(',');const other=owner.get(key);if(other===undefined)owner.set(key,face);else join(face,other);
  }
  const groups=new Map();for(let face=0;face<total;face++){const root=find(face);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(face);}
  let components=[...groups.values()].sort((a,b)=>b.length-a.length);if(components.length<2){if(source!==mesh.geometry)source.dispose();throw new Error('Bu GLB geometrik olarak tek bağlantılı parça. Yüzey boyama ile ayırabilirsin.');}
  const keep=components.filter((faces,i)=>i===0||faces.length>=minFaces).slice(0,maxParts),small=components.filter(faces=>!keep.includes(faces)).flat();if(small.length)keep[0]=keep[0].concat(small);
  const result=keep.map((faces,index)=>{const part=new THREE.Mesh(subsetGeometry(source,faces),Array.isArray(mesh.material)?mesh.material.map(m=>m.clone()):mesh.material.clone());part.name=(mesh.name||'Parça')+' — '+(index+1);part.position.copy(mesh.position);part.quaternion.copy(mesh.quaternion);part.scale.copy(mesh.scale);part.userData=structuredClone(mesh.userData||{});return part;});
  if(source!==mesh.geometry)source.dispose();return result;
}
export function splitFaces(mesh,selection){
  if(mesh.geometry.index)throw new Error('Parça ayırma için üçgen yüzey gerekir.');
  const n=mesh.geometry.attributes.position.count/3;
  const chosen=[],remaining=[];
  for(let i=0;i<n;i++)(selection.has(i)?chosen:remaining).push(i);
  if(!chosen.length||!remaining.length)throw new Error('Parçanın bir bölümünü boya; tüm yüzeyi seçme.');
  const newMesh=new THREE.Mesh(subsetGeometry(mesh.geometry,chosen),Array.isArray(mesh.material)?mesh.material.map(m=>m.clone()):mesh.material.clone());
  newMesh.name=(mesh.name||'Parça')+' — ayrılan';newMesh.position.copy(mesh.position);newMesh.quaternion.copy(mesh.quaternion);newMesh.scale.copy(mesh.scale);
  const old=mesh.geometry;mesh.geometry=subsetGeometry(old,remaining);old.dispose();return newMesh;
}
export function buildWeldMap(geometry){
  const p=geometry.attributes.position,unique=[],map=new Map(),indices=new Int32Array(p.count);
  geometry.computeBoundingBox();const eps=Math.max(geometry.boundingBox.getSize(new THREE.Vector3()).length()*1e-6,1e-8);
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n/eps)).join(',');
    let id=map.get(key);if(id===undefined){id=unique.length;map.set(key,id);unique.push({vertices:[],neighbors:new Set()});}
    unique[id].vertices.push(i);indices[i]=id;
  }
  for(let i=0;i<p.count;i+=3)for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a!==b&&indices[i+a]!==indices[i+b])unique[indices[i+a]].neighbors.add(indices[i+b]);
  return unique;
}
export function sculpt(mesh,worldPoint,radius,strength,mode,weldMap){
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
  mesh.updateMatrixWorld(true);
  const inv=mesh.matrixWorld.clone().invert(),normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const updates=[],v=new THREE.Vector3(),normal=new THREE.Vector3(),avg=new THREE.Vector3(),local=new THREE.Vector3();
  for(const item of weldMap){
    const i=item.vertices[0];v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
    const distance=v.distanceTo(worldPoint);if(distance>=radius)continue;
    const falloff=Math.pow(1-distance/radius,2);
    if(mode==='smooth'){
      avg.set(0,0,0);let count=0;
      for(const neighbor of item.neighbors){avg.add(local.fromBufferAttribute(p,weldMap[neighbor].vertices[0]));count++;}
      if(!count)continue;avg.divideScalar(count).applyMatrix4(mesh.matrixWorld);
      v.lerp(avg,Math.min(.5,strength*falloff*4));
    }else{
      normal.set(0,0,0);for(const j of item.vertices)normal.add(local.fromBufferAttribute(n,j));
      normal.applyMatrix3(normalMatrix).normalize();v.addScaledVector(normal,radius*strength*falloff*(mode==='shrink'?-1:1));
    }
    v.applyMatrix4(inv);updates.push([item,v.clone()]);
  }
  for(const [item,v]of updates)for(const i of item.vertices)p.setXYZ(i,v.x,v.y,v.z);
  if(updates.length){p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();}
  return updates.length;
}
export function facesInBrush(mesh,worldPoint,radius){
  mesh.updateMatrixWorld(true);const p=mesh.geometry.attributes.position,result=[],v=new THREE.Vector3(),center=new THREE.Vector3();
  for(let i=0;i<p.count;i+=3){center.set(0,0,0);for(let k=0;k<3;k++)center.add(v.fromBufferAttribute(p,i+k));center.divideScalar(3).applyMatrix4(mesh.matrixWorld);
    if(center.distanceToSquared(worldPoint)<=radius*radius)result.push(i/3);
  }
  return result;
}
export function selectionGeometry(mesh,faces){return subsetGeometry(mesh.geometry,[...faces].sort((a,b)=>a-b));}
export function checkGLB(arrayBuffer){
  if(arrayBuffer.byteLength<20||arrayBuffer.byteLength>50*1024*1024)throw new Error('GLB dosyası geçersiz veya 50 MB sınırını aşıyor.');
  const view=new DataView(arrayBuffer);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==arrayBuffer.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw new Error('Geçerli bir GLB 2.0 dosyası seç.');
  const length=view.getUint32(12,true);if(length+20>arrayBuffer.byteLength)throw new Error('GLB dosyası eksik.');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(arrayBuffer,20,length)).trim());
  for(const item of [...(json.buffers||[]),...(json.images||[])])if(item.uri&&!item.uri.startsWith('data:'))throw new Error('Modelin dokularını ve verilerini GLB içine gömerek dışa aktar.');
  if(!json.meshes?.length)throw new Error('GLB içinde yüzey yok.');return json;
}
