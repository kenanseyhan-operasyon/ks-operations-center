import {BufferGeometry,Float32BufferAttribute,Matrix4,Mesh,Object3D,ShapeUtils,Vector2,Vector3} from 'three';
import type {Entity} from './scene-data';
import {FACILITY_CATALOG,localToWorld} from './facility-data';
import {groundFillContours,isGroundFill} from './ground-fill';
type P=[number,number];
type Patch={points:P[];top:number;minX:number;maxX:number;minZ:number;maxZ:number};
type Vertex={p:Vector3;attributes:Record<string,number[]>};
const EPS=1e-8;
export const isSurfaceMarking=(e:Entity)=>!isGroundFill(e)&&(!e.facility?.mount&&FACILITY_CATALOG[e.preset]?.category==='markings'||e.preset==='DRAIN');
/** World-space triangles also preserve concave and divided fill boundaries. */
export function groundSurfacePatches(entities:Entity[]):Patch[]{
 return entities.filter(isGroundFill).flatMap(e=>groundFillContours(e).flatMap(contour=>{
  const world=contour.map(p=>{const v=localToWorld(e,[p[0],0,p[1]]);return [v[0],v[2]] as P;});
  return ShapeUtils.triangulateShape(world.map(p=>new Vector2(...p)),[]).map(indices=>{
   const points=indices.map(i=>world[i]),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
   return {points,top:e.position[1]+e.height*e.scale,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
  });
 })).sort((a,b)=>b.top-a.top);
}
function interpolate(a:Vertex,b:Vertex,t:number):Vertex{
 return {p:a.p.clone().lerp(b.p,t),attributes:Object.fromEntries(Object.keys(a.attributes).map(k=>[k,a.attributes[k].map((v,i)=>v+(b.attributes[k][i]-v)*t)]))};
}
/** Partition a triangle/polygon without stretching across a raised surface edge. */
function partition(poly:Vertex[],patch:Patch){
 let inside=poly;const outside:Vertex[][]=[];
 const [a,b,c]=patch.points,sign=((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>0?1:-1;
 for(let edge=0;edge<3&&inside.length;edge++){
  const a=patch.points[edge],b=patch.points[(edge+1)%3],distance=(v:Vertex)=>sign*((b[0]-a[0])*(v.p.z-a[1])-(b[1]-a[1])*(v.p.x-a[0]));
  const d=inside.map(distance);if(d.every(n=>n>=-EPS))continue;
  if(d.every(n=>n<=EPS)){outside.push(inside);inside=[];break;}
  const positive:Vertex[]=[],negative:Vertex[]=[];
  for(let i=0;i<inside.length;i++){
   const u=inside[i],v=inside[(i+1)%inside.length],du=d[i],dv=d[(i+1)%inside.length];
   if(du>=-EPS)positive.push(u);if(du<=EPS)negative.push(u);
   if((du>EPS&&dv< -EPS)||(du< -EPS&&dv>EPS)){const at=interpolate(u,v,du/(du-dv));positive.push(at);negative.push(at);}
  }
  if(negative.length>=3)outside.push(negative);inside=positive;
 }
 return {inside,outside};
}
function overlaps(poly:Vertex[],p:Patch){return Math.max(...poly.map(v=>v.p.x))>=p.minX-EPS&&Math.min(...poly.map(v=>v.p.x))<=p.maxX+EPS&&Math.max(...poly.map(v=>v.p.z))>=p.minZ-EPS&&Math.min(...poly.map(v=>v.p.z))<=p.maxZ+EPS;}
/** Render-only adjustment: saved transforms, boundaries, materials and UVs stay intact. */
export function conformGroundMarkings(model:Object3D,entity:Entity,patches:Patch[]){
 if(!isSurfaceMarking(entity)||!patches.length)return;
 const raised=patches.filter(p=>p.top>entity.position[1]+EPS);if(!raised.length)return;
 model.updateMatrixWorld(true);
 model.traverse(node=>{
  if(!(node instanceof Mesh))return;const source=node.geometry as BufferGeometry,position=source.getAttribute('position');if(!position)return;
  source.computeBoundingBox();const bounds=source.boundingBox!.clone().applyMatrix4(node.matrixWorld),relevant=raised.filter(p=>bounds.max.x>=p.minX&&bounds.min.x<=p.maxX&&bounds.max.z>=p.minZ&&bounds.min.z<=p.maxZ);if(!relevant.length)return;
  const attributes=Object.entries(source.attributes).filter(([name])=>name!=='position'),out:Record<string,number[]>={position:[]};for(const [name]of attributes)out[name]=[];
  const inverse=new Matrix4().copy(node.matrixWorld).invert(),index=source.index,count=index?index.count:position.count;let changed=false;
  const vertex=(i:number):Vertex=>({p:new Vector3().fromBufferAttribute(position,i).applyMatrix4(node.matrixWorld),attributes:Object.fromEntries(attributes.map(([name,attr])=>[name,Array.from({length:attr.itemSize},(_,k)=>attr.getComponent(i,k))]))});
  const geometry=new BufferGeometry();
  const emit=(poly:Vertex[],lift:number,materialIndex:number)=>{
   for(let i=1;i+1<poly.length;i++){
    const triangle=[poly[0],poly[i],poly[i+1]],cross=new Vector3().subVectors(triangle[1].p,triangle[0].p).cross(new Vector3().subVectors(triangle[2].p,triangle[0].p));if(cross.lengthSq()<1e-20)continue;
    const start=out.position.length/3;for(const v of triangle){const p=v.p.clone();p.y+=lift;p.applyMatrix4(inverse);out.position.push(p.x,p.y,p.z);for(const[name]of attributes)out[name].push(...v.attributes[name]);}
    if(Array.isArray(node.material))geometry.addGroup(start,3,materialIndex);
   }
  };
  for(let i=0;i<count;i+=3){
   let remaining=[Array.from({length:3},(_,j)=>vertex(index?index.getX(i+j):i+j))];const materialIndex=source.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex||0;
   for(const patch of relevant){
    const next:Vertex[][]=[];for(const poly of remaining){if(!overlaps(poly,patch)){next.push(poly);continue;}const parts=partition(poly,patch);if(parts.inside.length>=3){emit(parts.inside,patch.top-entity.position[1],materialIndex);changed=true;}next.push(...parts.outside);}remaining=next;if(!remaining.length)break;
   }
   for(const poly of remaining)emit(poly,0,materialIndex);
  }
  if(!changed){geometry.dispose();return;}
  geometry.setAttribute('position',new Float32BufferAttribute(out.position,3));for(const[name,attr]of attributes)geometry.setAttribute(name,new Float32BufferAttribute(out[name],attr.itemSize));geometry.computeBoundingBox();geometry.computeBoundingSphere();node.geometry=geometry;source.dispose();
 });
}
