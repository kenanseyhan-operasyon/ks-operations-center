import {Builder} from './facility-geometry';
import {newEntity,type Entity,type SceneData} from './scene-data';
import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export type SupportPart={ownerId:string;key:string;position:[number,number,number];heading:number;scale:number;width:number;height:number;color:string;style:'post'|'rack'};
export function singleSupport(style:'post'|'rack',width:number,height:number,color:string){
 const b=new Builder();
 if(style==='rack'){
  for(const side of [-1,1]){const x=side*(width/2-.03);b.box(.2,.05,.2,[x,.025,0],color);b.rod([x,.05,0],[x,height,0],.027,color);}
  for(const y of [.20,.67])b.rod([-width/2,y*height/1.22,0],[width/2,y*height/1.22,0],.026,color);
 }else{b.box(width,.025,width,[0,.0125,0],color);b.rod([0,.025,0],[0,height,0],.018,color);}
 const g=b.finish();g.name='PIPE_SUPPORT_PART';return g;
}
export function detachSupport(scene:SceneData,part:SupportPart){
 const owner=scene.entities.find(e=>e.id===part.ownerId);if(!owner||owner.facility?.removedSupports?.includes(part.key))return;
 const e=newEntity('PIPE_SUPPORT',part.position[0],part.position[2]);Object.assign(e,{name:part.style==='rack'?'Boru traversi · tek parça':'Boru ayağı · tek parça',position:[...part.position],heading:part.heading,scale:part.scale,width:part.width,height:part.height,length:part.width,color:part.color,facility:{supportStyle:part.style}});
 owner.facility={...owner.facility,removedSupports:[...(owner.facility?.removedSupports||[]),part.key]};scene.entities.push(e);return e;
}
export function supportAvailable(owner:Entity,key:string){return !owner.facility?.removedSupports?.includes(key);}
/** One draw call for automatic supports, while triangle ranges keep each part selectable. */
export function batchSupports(root:T.Group){
 const parts=root.children.filter(o=>o.userData.autoSupport),geometries:T.BufferGeometry[]=[],ranges:{end:number;part:SupportPart}[]=[];let count=0,material:T.Material|undefined;
 for(const part of parts){part.updateMatrix();part.traverse(node=>{if(!(node instanceof T.Mesh))return;node.updateMatrix();const geo=node.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(part.matrix,node.matrix));geometries.push(geo);count+=(geo.index?.count??geo.getAttribute('position').count)/3;if(!material)material=node.material as T.Material;else if(node.material!==material)(node.material as T.Material).dispose();node.geometry.dispose();});ranges.push({end:count,part:part.userData.autoSupport});root.remove(part);}
 if(!geometries.length)return;const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!merged)throw Error('Mesnet geometrisi birleştirilemedi.');const mesh=new T.Mesh(merged,material);mesh.name='PIPE_SUPPORT_BATCH';mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.supportRanges=ranges;root.add(mesh);
}
export function supportFromHit(hit:T.Intersection):SupportPart|undefined{
 const ranges=hit.object.userData.supportRanges as {end:number;part:SupportPart}[]|undefined;if(ranges&&hit.faceIndex!==undefined&&hit.faceIndex!==null)return ranges.find(r=>hit.faceIndex!<r.end)?.part;
 for(let o:T.Object3D|null=hit.object;o;o=o.parent)if(o.userData.autoSupport)return o.userData.autoSupport;
}
