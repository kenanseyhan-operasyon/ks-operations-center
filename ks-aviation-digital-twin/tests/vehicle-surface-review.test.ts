import assert from 'node:assert/strict';
import * as T from 'three';
import {cornerIndicatorGeometry} from '../src/cab-corner-indicator';
import {stabilizeVehicleSurfaces,isOutwardSolid} from '../src/vehicle-surfaces';

// Orthographic silhouettes must remain triangular from the front and rectangular
// from the side, on both mirrored corners and on both the lens and its housing.
function hullCount(points:number[][]){
 const unique=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(o:number[],a:number[],b:number[])=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const half=(list:number[][])=>{const h:number[][]=[];for(const p of list){while(h.length>1&&cross(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p);}return h;};
 return half(unique).length+half([...unique].reverse()).length-2;
}
for(const side of [-1,1])for(const lens of [false,true]){
 const g=cornerIndicatorGeometry(side,lens),p=g.attributes.position,front:number[][]=[],lateral:number[][]=[];
 for(let i=0;i<p.count;i++){front.push([p.getY(i),p.getZ(i)]);lateral.push([p.getX(i),p.getY(i)]);}
 assert.equal(hullCount(front),3,'Front silhouette is a triangle');
 assert.equal(hullCount(lateral),4,'Side silhouette is a rectangle');
 const centre=new T.Vector3();for(let i=0;i<p.count;i++)centre.add(new T.Vector3().fromBufferAttribute(p,i));centre.multiplyScalar(1/p.count);
 for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().add(b).add(c).multiplyScalar(1/3).sub(centre))>0,'Every prism face points outwards');}
 g.dispose();
}
const model=new T.Group(),source=new T.MeshStandardMaterial({side:T.DoubleSide}),geometry=new T.BoxGeometry(),owned:T.Material[]=[];
const openGeometry=new T.PlaneGeometry();assert.ok(isOutwardSolid(geometry));assert.equal(isOutwardSolid(openGeometry),false);
for(const name of ['Common_Flat_Grey_Floor','Fixed_Step_1','Tank_Rail_Long_1','Tank_Shell','CAB_GLASS']){const m=new T.Mesh(['Tank_Shell','CAB_GLASS'].includes(name)?openGeometry:geometry,source);m.name=name;model.add(m);}
stabilizeVehicleSurfaces(model,m=>owned.push(m));
for(const n of model.children as T.Mesh[])assert.equal((n.material as T.Material).side,['Tank_Shell','CAB_GLASS'].includes(n.name)?T.DoubleSide:T.FrontSide);
assert.equal(source.side,T.DoubleSide,'Cached source material remains unchanged');
assert.equal(owned.length,1,'Closed solids share one owned clone');
for(const n of model.children as T.Mesh[])assert.equal(n.geometry,['Tank_Shell','CAB_GLASS'].includes(n.name)?openGeometry:geometry,'Collision and animation geometry remains unchanged');
openGeometry.dispose();
owned.forEach(m=>m.dispose());source.dispose();geometry.dispose();
console.log('PASS triangular-front/rectangular-side signals and scoped exterior materials');

// Paint masks close imported triangle T junctions, retain holes in lettering,
// preserve placement under transforms, and release their own texture only.
const {stabilizeVehicleMarkings}=await import('../src/vehicle-markings');
const markingRoot=new T.Group(),shape=new T.Shape();shape.moveTo(-1,-1);shape.lineTo(1,-1);shape.lineTo(1,1);shape.lineTo(-1,1);shape.closePath();
const hole=new T.Path();hole.moveTo(-.3,-.3);hole.lineTo(-.3,.3);hole.lineTo(.3,.3);hole.lineTo(.3,-.3);hole.closePath();shape.holes.push(hole);
const labelGeometry=new T.ShapeGeometry(shape),labelMaterial=new T.MeshStandardMaterial({color:'#123456',side:T.DoubleSide}),label=new T.Mesh(labelGeometry,labelMaterial);label.name='Cab_SOCAR_Wordmark';label.position.set(3,2,1);markingRoot.add(label);markingRoot.updateWorldMatrix(true,true);
const originalLabelBounds=new T.Box3().setFromObject(label),paintGeometries:T.BufferGeometry[]=[],paintMaterials:T.Material[]=[];
stabilizeVehicleMarkings(markingRoot,g=>{paintGeometries.push(g);return g;},m=>paintMaterials.push(m));
const paint=label.material as T.MeshStandardMaterial,mask=paint.map!.image as {data:Uint8Array;width:number;height:number},alpha=(x:number,y:number)=>mask.data[(Math.floor(y*mask.height)*mask.width+Math.floor(x*mask.width))*4+3];
assert.equal(alpha(.5,.5),0,'Letter counter stays transparent');assert.equal(alpha(.15,.5),255,'Solid paint remains continuous');assert.ok(new T.Box3().setFromObject(label).equals(originalLabelBounds),'Paint keeps its original bounds');assert.equal(labelMaterial.map,null,'Source material is untouched');assert.ok(paint.map!.generateMipmaps);assert.equal(paint.alphaTest,.35);
let released=false;paint.map!.addEventListener('dispose',()=>released=true);paintMaterials.forEach(m=>m.dispose());assert.ok(released,'Owned paint texture is released');paintGeometries.forEach(g=>g.dispose());labelGeometry.dispose();labelMaterial.dispose();
console.log('PASS continuous mipmapped paint, transparent counters, transformed bounds and owned texture cleanup');
