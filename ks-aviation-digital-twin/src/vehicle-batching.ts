import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Merge rigid siblings by material, never across a hinge or animation target.
 * Original named meshes remain raycast/collision proxies, with an invisible
 * material, so doors, walking surfaces and saved interaction targets keep their
 * identity and exact geometry. Only the merged mesh submits triangles to GPU. */
export function batchVehicle(model:T.Object3D,clips:T.AnimationClip[],ownGeometry:(g:T.BufferGeometry)=>T.BufferGeometry,ownMaterial:(m:T.Material)=>void,boundaries:Iterable<T.Object3D>=[]){
 const animated=new Set(clips.flatMap(clip=>clip.tracks.map(track=>T.PropertyBinding.parseTrackName(track.name).nodeName)));
 const roots=new Set([model,...boundaries]);
 model.updateWorldMatrix(true,true);
 model.traverse(node=>{if(animated.has(node.name)||/^(DEADMAN_|FUEL_LEVEL_NEEDLE)/.test(node.name))roots.add(node);});
 const buckets=new Map<T.Object3D,Map<string,T.Mesh[]>>();
 const dynamic=/Lamp|Lens|Beacon|Indicator|Marker_Amber|Display|Backlit|Manometer|Toggle_Button|DEADMAN_DEPLOYED_CABLE/i;
 model.traverse(node=>{
  if(!(node instanceof T.Mesh)||node instanceof T.SkinnedMesh||!node.parent||!node.visible||animated.has(node.name)||dynamic.test(node.name)||Array.isArray(node.material)||node.material.transparent||!node.material.visible||node.geometry.morphAttributes.position?.length||node.geometry.drawRange.start!==0||Number.isFinite(node.geometry.drawRange.count))return;
  if(roots.has(node)||node.scale.x*node.scale.y*node.scale.z<=0)return;
  // Cab mode swaps window geometry, materials and individual access trims.
  for(let parent:T.Object3D|null=node;parent&&parent!==model;parent=parent.parent)
   if(!parent.visible||/^(KS_LOW_CAB_C3|CAB_|DRIVER_|PASSENGER_|DOOR_|LIVE_MIRROR)/.test(parent.name))return;
  let parent=node.parent;while(parent.parent&&!roots.has(parent))parent=parent.parent;
  if(new T.Matrix4().copy(parent.matrixWorld).invert().multiply(node.matrixWorld).determinant()<=0)return;
  const attributes=Object.keys(node.geometry.attributes).sort().map(key=>{const a=node.geometry.attributes[key];return `${key}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;}).join('/');
  const key=`${node.material.uuid}/${node.renderOrder}/${node.layers.mask}/${!!node.geometry.index}/${attributes}`;
  let group=buckets.get(parent);if(!group){group=new Map();buckets.set(parent,group);}
  const list=group.get(key)||[];list.push(node);group.set(key,list);
 });
 let sources=0,batches=0;
 for(const [parent,groups] of buckets)for(const meshes of groups.values()){
  if(meshes.length<2)continue;
  const inverse=parent.matrixWorld.clone().invert();
  const parts=meshes.map(mesh=>mesh.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)));
  const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());if(!geometry)continue;
  const material=meshes[0].material as T.Material,merged=new T.Mesh(ownGeometry(geometry),material);
  merged.name=`R14_STATIC_BATCH_${batches++}`;merged.renderOrder=meshes[0].renderOrder;merged.layers.mask=meshes[0].layers.mask;
  merged.userData.sharedAsset=true;merged.userData.renderBatch=true;merged.raycast=()=>{};
  let offset=0;merged.userData.batchSources=meshes.map(mesh=>{const row={uuid:mesh.uuid,offset,count:mesh.geometry.attributes.position.count};offset+=row.count;return row;});
  merged.geometry.computeBoundingBox();merged.geometry.computeBoundingSphere();parent.add(merged);
  const proxy=material.clone();proxy.visible=false;ownMaterial(proxy);
  for(const mesh of meshes){mesh.material=proxy;mesh.userData.renderProxy=true;}sources+=meshes.length;
 }
 return {sources,batches,savedDraws:sources-batches};
}
