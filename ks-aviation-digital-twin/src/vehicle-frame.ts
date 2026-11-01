import * as T from 'three';
import {R14} from './r14-spec';

/** One continuous web through both neck bends; separate square-cut beams left
 * open wedges at their joints. Native coordinates, before trailer attachment. */
export function trailerFrameGeometry(){
 const points=[new T.Vector2(R14.hitchX,-.212),new T.Vector2(.27,-.23),new T.Vector2(.52,-.31),new T.Vector2(1.51,-.31)];
 const normals=points.slice(1).map((p,i)=>{const d=p.clone().sub(points[i]).normalize();return new T.Vector2(-d.y,d.x);});
 const edge=(side:number)=>points.map((p,i)=>{
  const before=normals[Math.max(0,i-1)],after=normals[Math.min(normals.length-1,i)],miter=before.clone().add(after).normalize();
  return p.clone().addScaledVector(miter,side*.018/miter.dot(after));
 });
 const outline=[...edge(1),...edge(-1).reverse()],shape=new T.Shape(outline),g=new T.ExtrudeGeometry(shape,{depth:.028,bevelEnabled:false,steps:1});
 g.translate(0,0,-.014);g.computeBoundingBox();g.computeBoundingSphere();return g;
}

/** Crossmembers and saddle feet must stop inside the tyre sidewalls. Keep the
 * original centre, vertical contacts and animation parents; clone vertices. */
export function clearFrameTyreSides(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry){
 model.updateWorldMatrix(true,true);
 model.traverse(n=>{
  if(!(n instanceof T.Mesh)||!/^(Chassis_Crossmember|Tank_Saddle_Base)(?:_\d+)?$/.test(n.name))return;
  const b=new T.Box3().setFromObject(n),g=own(n.geometry.clone()),p=g.attributes.position,inverse=n.matrixWorld.clone().invert(),half=Math.min((b.max.z-b.min.z)/2,.145);
  for(let i=0;i<p.count;i++){
   const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld);
   v.z=R14.centreZ+(v.z-R14.centreZ)*half/((b.max.z-b.min.z)/2);
   v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);
  }
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();n.geometry=g;
 });
}
