import {FrontSide,Material,Mesh,Object3D,LatheGeometry,Box3,Vector2,Vector3,BufferGeometry} from 'three';

/** More silhouette segments for the three small circular roof covers. Their
 * original centres, diameter and height stay fixed in the cached mesh frame. */
export function refineVehicleHatches(model:Object3D,own:(geometry:BufferGeometry)=>BufferGeometry){
 model.traverse(node=>{
  if(!(node instanceof Mesh)||!/^Tank_Inspection_Hatch(?:_\d+)?$/.test(node.name))return;
  node.geometry.computeBoundingBox();const b=node.geometry.boundingBox as Box3,c=b.getCenter(new Vector3()),size=b.getSize(new Vector3());
  const r=size.x/2,bevel=Math.min(.0015,size.y/4),profile=[[0,-size.y/2],[r-bevel,-size.y/2],[r,-size.y/2+bevel],[r,size.y/2-bevel],[r-bevel,size.y/2],[0,size.y/2]].map(([radius,y])=>new Vector2(radius,y));
  const geometry=new LatheGeometry(profile,128);geometry.scale(1,1,size.z/size.x);geometry.translate(c.x,c.y,c.z);node.geometry=own(geometry);
 });
}

// These parts are closed solids. Rendering their inner faces lets those faces
// break through thin edges under logarithmic depth, producing dashed seams.
const closedSurface=/^(?:Common_Flat_Grey_Floor|Platform_Grey_Floor|Tank_Inspection_Hatch(?:_\d+)?|Fixed_Step(?:_\d+)?|Ladder_Stringer(?:_\d+)?|Tank_Rail_(?:Long|Post)(?:_\d+)?|(?:Rear_Leaf_)?Gate_(?:Reinforced_Upright|Rail)(?:_\d+)?|DOOR_STEP_COVER)$/;
const solidCache=new WeakMap<BufferGeometry,boolean>();
/** Only outward, watertight solids may discard their interior faces. Open skins,
 * labels and inconsistently oriented imported surfaces retain their two sides. */
export function isOutwardSolid(g:BufferGeometry){
 const cached=solidCache.get(g);if(cached!==undefined)return cached;
 const p=g.getAttribute('position'),index=g.index,edges=new Map<string,{count:number;direction:number}>();let volume=0,valid=!!p;
 if(p)for(let i=0;i<(index?.count||p.count);i+=3){
  const v=[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k));
  if(v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).lengthSq()<1e-18)continue;
  volume+=v[0].dot(v[1].clone().cross(v[2]))/6;
  const keys=v.map(point=>point.toArray().map(x=>Math.round(x*1e6)).join(','));
  for(let k=0;k<3;k++){const a=keys[k],b=keys[(k+1)%3],key=a<b?a+'/'+b:b+'/'+a,e=edges.get(key)||{count:0,direction:0};e.count++;e.direction+=a<b?1:-1;edges.set(key,e);}
 }
 g.computeBoundingBox();const size=g.boundingBox?.getSize(new Vector3());
 valid=valid&&edges.size>0&&!!size&&volume>Math.max(1e-15,size.x*size.y*size.z*1e-6)&&[...edges.values()].every(e=>e.count===2&&e.direction===0);
 solidCache.set(g,valid);return valid;
}
export function stabilizeVehicleSurfaces(model:Object3D,own:(material:Material)=>void){
 const copies=new Map<Material,Material>();
 model.traverse(node=>{
  if(!(node instanceof Mesh))return;
  const sources=Array.isArray(node.material)?node.material:[node.material];
  if(sources.every(m=>m.transparent||m.side===FrontSide))return;
  if(!closedSurface.test(node.name)&&!isOutwardSolid(node.geometry))return;
  const exterior=(source:Material)=>{if(source.transparent||source.side===FrontSide)return source;let material=copies.get(source);if(!material){material=source.clone();material.side=FrontSide;copies.set(source,material);own(material);}return material;};
  node.material=Array.isArray(node.material)?node.material.map(exterior):exterior(node.material);
 });
}
