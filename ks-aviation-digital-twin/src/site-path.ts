export type Point2=[number,number];
const dist=(a:Point2,b:Point2)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const polygonArea=(p:Point2[])=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2;
/** Consecutive duplicates and a nearly closed final click must not make tiny corner pieces. */
export function sitePath(raw:Point2[],closed=false,snap=.001){
 const points:Point2[]=[];for(const p of raw)if(!points.length||dist(points.at(-1)!,p)>.00001)points.push([...p]);
 if(points.length>3&&dist(points[0],points.at(-1)!)<=snap){points.pop();closed=true;}
 return {points,closed:closed&&points.length>=3};
}
export function pathSections(raw:Point2[],width:number,closed=false,snap=.001){
 const path=sitePath(raw,closed,snap),p=path.points,n=p.length,half=width/2;
 const normal=(a:Point2,b:Point2):Point2=>{const len=dist(a,b)||1;return [-(b[1]-a[1])/len,(b[0]-a[0])/len];};
 const sections=p.map((q,i)=>{
  const before=i>0?normal(p[i-1],q):path.closed?normal(p[n-1],q):normal(q,p[1]||q);
  const after=i<n-1?normal(q,p[i+1]):path.closed?normal(q,p[0]):before;
  const len=Math.hypot(before[0]+after[0],before[1]+after[1]);
  const m:Point2=len>.00001?[(before[0]+after[0])/len,(before[1]+after[1])/len]:after;
  const reach=Math.min(half*4,half/Math.max(.00001,m[0]*after[0]+m[1]*after[1]));
  return {center:q,left:[q[0]+m[0]*reach,q[1]+m[1]*reach] as Point2,right:[q[0]-m[0]*reach,q[1]-m[1]*reach] as Point2};
 });
 return {...path,sections};
}
export const pointInPolygon=(q:Point2,p:Point2[])=>{
 let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){
  const a=p[j],b=p[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
  if(Math.hypot(q[0]-a[0]-dx*t,q[1]-a[1]-dz*t)<.000001)return true;
  if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;
};
export function simplePolygon(p:Point2[]){
 if(p.length<3||Math.abs(polygonArea(p))<.02)return false;
 const cross=(a:Point2,b:Point2,c:Point2)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){
  if(j===i+1||i===0&&j===p.length-1)continue;
  const a=p[i],b=p[(i+1)%p.length],c=p[j],d=p[(j+1)%p.length];
  if(cross(a,b,c)*cross(a,b,d)<-1e-10&&cross(c,d,a)*cross(c,d,b)<-1e-10)return false;
 }return true;
}
