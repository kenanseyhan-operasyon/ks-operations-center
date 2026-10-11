import * as THREE from 'three';
import type {Entity} from './scene-data';
import {bridgeAnchorWorld,worldToLocal,type BridgeAnchor} from './facility-data';

/** Read the visible roof intersection, never its projection onto the ground. */
export function pickBridgeAnchor(ray:THREE.Raycaster,hits:THREE.Intersection[],entities:Entity[],start?:BridgeAnchor,ignoreId?:string):BridgeAnchor|undefined{
  const visible=hits.find(h=>{let o:THREE.Object3D|null=h.object;while(o&&!o.userData.entityId)o=o.parent;return o?.userData.entityId!==ignoreId;});
  let object:THREE.Object3D|null=visible?.object||null;while(object&&!object.userData.entityId)object=object.parent;
  const parent=entities.find(o=>o.id===object?.userData.entityId);
  if(parent?.kind==='tank'){
    if(start?.parentId===parent.id)return;
    const y=parent.position[1]+(parent.height+.28)*parent.scale,point=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-y),new THREE.Vector3());
    if(!point)return;const local=worldToLocal(parent,point.toArray() as [number,number,number]);
    if(Math.hypot(local[0],local[2])>parent.radius+.02)return;
    return {parentId:parent.id,point:local};
  }
  if(!start)return;
  // A second elevated platform may be selected at its actual top surface.
  if(parent&&visible?.face){const normal=visible.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(visible.object.matrixWorld));if(parent.kind==='structure'&&normal.y>.75&&visible.point.y>.5)return {parentId:parent.id,point:worldToLocal(parent,visible.point.toArray() as [number,number,number])};return;}
  // An unoccupied second point remains at the first roof's height.
  const a=bridgeAnchorWorld(start,entities);if(!a)return;
  const p=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-a[1]),new THREE.Vector3());
  return p?{point:p.toArray() as [number,number,number]}:undefined;
}

export function bridgePreview(start:[number,number,number],end?:[number,number,number],width=1.05){
  const group=new THREE.Group();group.name='BRIDGE_PLACEMENT_PREVIEW';
  const material=new THREE.MeshBasicMaterial({color:0xb7ff3c,depthTest:false,transparent:true,opacity:.9});
  for(const p of end?[start,end]:[start]){const dot=new THREE.Mesh(new THREE.SphereGeometry(.15,12,8),material);dot.position.fromArray(p);dot.renderOrder=1000;group.add(dot);}
  if(end){const dx=end[0]-start[0],dz=end[2]-start[2],l=Math.hypot(dx,dz);if(l>.05){const x=dz/l*width/2,z=-dx/l*width/2,pts:THREE.Vector3[]=[];
    for(const side of [-1,1]){for(const h of [0,1.05])pts.push(new THREE.Vector3(start[0]+x*side,start[1]+h,start[2]+z*side),new THREE.Vector3(end[0]+x*side,end[1]+h,end[2]+z*side));for(const p of [start,end])pts.push(new THREE.Vector3(p[0]+x*side,p[1],p[2]+z*side),new THREE.Vector3(p[0]+x*side,p[1]+1.05,p[2]+z*side));}
    const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xb7ff3c,depthTest:false}));line.renderOrder=1000;group.add(line);
  }}return group;
}
