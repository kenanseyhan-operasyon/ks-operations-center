import * as T from 'three';
import {Builder,type V} from './facility-geometry';
export type PipeEndRadii={start?:number;end?:number;length?:number};
/** Rounded, continuous centreline: trim adjacent spans before fitting elbows. */
export function roundedPipeCurve(points:V[],bend=.16){
 const p=points.map(v=>new T.Vector3(...v)).filter((v,i,a)=>!i||v.distanceTo(a[i-1])>1e-6),curve=new T.CurvePath<T.Vector3>();
 if(p.length<2)return curve;let last=p[0];
 for(let i=1;i<p.length-1;i++){
  const a=p[i-1],b=p[i],c=p[i+1],incoming=b.clone().sub(a),outgoing=c.clone().sub(b),cut=Math.min(bend,incoming.length()*.4,outgoing.length()*.4);
  if(cut<1e-5||incoming.clone().normalize().dot(outgoing.clone().normalize())>.9999){curve.add(new T.LineCurve3(last,b));last=b;continue;}
  const start=b.clone().addScaledVector(incoming.normalize(),-cut),end=b.clone().addScaledVector(outgoing.normalize(),cut);
  if(last.distanceTo(start)>1e-6)curve.add(new T.LineCurve3(last,start));curve.add(new T.QuadraticBezierCurve3(start,b,end));last=end;
 }
 if(last.distanceTo(p.at(-1)!)>1e-6)curve.add(new T.LineCurve3(last,p.at(-1)!));return curve;
}
/** Allocate subdivisions per fitting, not per total pipe length. A 30 m straight
 * must not consume the samples needed by a 16 cm elbow. TubeGeometry normally
 * samples uniformly by arc length, which skipped whole elbows on long routes. */
export function pipeTubeGeometry(curve:T.CurvePath<T.Vector3>,radius:number,endRadii?:PipeEndRadii){
 const original=curve.curves.filter(c=>c.getLength()>1e-7),length=original.reduce((sum,c)=>sum+c.getLength(),0),transition=endRadii?.length??.12;
 // Give a reducer its own rings on the end straights. With only one ring per
 // straight span, changing an end radius would taper the entire collector.
 let travelled=0;
 const spans=original.flatMap(span=>{
  const size=span.getLength(),from=travelled,to=from+size;travelled=to;
  if(!(span instanceof T.LineCurve3))return [span];
  const cuts=[from,...[endRadii?.start===undefined?undefined:transition,endRadii?.end===undefined?undefined:length-transition].filter((v):v is number=>v!==undefined&&v>from+1e-7&&v<to-1e-7).sort((a,b)=>a-b),to];
  return cuts.slice(1).map((end,i)=>new T.LineCurve3(span.getPoint((cuts[i]-from)/size),span.getPoint((end-from)/size)));
 });
 const counts=spans.map(c=>c instanceof T.LineCurve3?1:16);
 const ends:number[]=[],distances:number[]=[];let total=0,distance=0;for(let i=0;i<counts.length;i++){total+=counts[i];ends.push(total);distances.push(distance);distance+=spans[i].getLength();}
 class FittingSamples extends T.Curve<T.Vector3>{
  constructor(){super();}
  locate(t:number){const x=Math.max(0,Math.min(1,t))*total;let i=ends.findIndex(end=>x<end-1e-9);if(i<0)i=ends.length-1;return {i,u:Math.max(0,Math.min(1,(x-(i?ends[i-1]:0))/counts[i]))};}
  getPoint(t:number,target=new T.Vector3()){const {i,u}=this.locate(t);return spans[i].getPoint(u,target);}
  getPointAt(t:number,target=new T.Vector3()){return this.getPoint(t,target);}
  getTangent(t:number,target=new T.Vector3()){const {i,u}=this.locate(t);return spans[i].getTangent(u,target);}
  getTangentAt(t:number,target=new T.Vector3()){return this.getTangent(t,target);}
 }
 const samples=new FittingSamples(),geometry=new T.TubeGeometry(samples,total,radius,16,false);
 if(endRadii){
  const positions=geometry.getAttribute('position'),center=new T.Vector3();
  for(let row=0;row<=total;row++){
   const t=row/total,{i,u}=samples.locate(t),at=distances[i]+spans[i].getLength()*u;samples.getPoint(t,center);
   let r=radius;
   if(endRadii.start!==undefined&&at<transition)r=endRadii.start+(radius-endRadii.start)*at/transition;
   if(endRadii.end!==undefined&&length-at<transition)r=endRadii.end+(radius-endRadii.end)*(length-at)/transition;
   for(let side=0;side<=16;side++){const vertex=row*17+side;positions.setXYZ(vertex,center.x+(positions.getX(vertex)-center.x)*r/radius,center.y+(positions.getY(vertex)-center.y)*r/radius,center.z+(positions.getZ(vertex)-center.z)*r/radius);}
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();
 }
 return geometry;
}
/** Split at the ground plane, including risers, so above-ground portions stay visible. */
export function splitAtGrade(points:V[],grade=0){
 const parts:{buried:boolean;points:V[]}[]=[];
 const add=(a:V,b:V)=>{if(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-6)return;const buried=(a[1]+b[1])/2<grade-1e-6,last=parts.at(-1);if(last?.buried===buried)last.points.push(b);else parts.push({buried,points:[a,b]});};
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if((a[1]-grade)*(b[1]-grade)<0){const t=(grade-a[1])/(b[1]-a[1]),q=a.map((n,j)=>n+(b[j]-n)*t) as V;add(a,q);add(q,b);}else add(a,b);}return parts;
}
export function makePipeTube(b:Builder,points:V[],radius:number,color:string,grade=0,bend=.16,endRadii?:PipeEndRadii){
 const parts=splitAtGrade(points,grade);
 for(const [index,part] of parts.entries()){
  const curve=roundedPipeCurve(part.points,Math.max(radius*1.5,bend));if(!curve.curves.length)continue;
  const geo=pipeTubeGeometry(curve,radius,endRadii?{length:endRadii.length,start:index===0?endRadii.start:undefined,end:index===parts.length-1?endRadii.end:undefined}:undefined);
  if(part.buried){const g=new T.Group();g.name='PIPE_UNDERGROUND';g.visible=false;g.userData.underground=true;
   const material=new T.MeshBasicMaterial({color,transparent:true,opacity:.65,depthTest:false,depthWrite:false});const m=new T.Mesh(geo,material);m.renderOrder=1105;g.add(m);b.g.add(g);
  }else {const mesh=b.mesh(geo,[0,0,0],color);mesh.userData.pipeTube=true;}
 }
}
export function setUndergroundVisible(root:T.Object3D,visible:boolean){root.traverse(o=>{if(o.userData.underground)o.visible=visible;});}
export function visibleInHierarchy(o:T.Object3D){for(let n:T.Object3D|null=o;n;n=n.parent)if(!n.visible)return false;return true;}


