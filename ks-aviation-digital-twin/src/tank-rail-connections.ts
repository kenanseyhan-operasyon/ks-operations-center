import type {TankOpening} from './facility-data';
import type {V} from './facility-geometry';
export type RailRun={a:V;b:V;joinA?:V;joinB?:V};
/** The last flight overlaps the roof landing: stop its rails at the landing entrance. */
export function outsideLanding(a:V,b:V,landing:{angle:number;inner:number;outer:number;depth:number;height:number}):RailRun[]{
  const {angle,inner,outer,depth,height}=landing,s=Math.sin(angle),c=Math.cos(angle);
  const coords=(p:V)=>[p[0]*s+p[2]*c,p[0]*c-p[2]*s,p[1]];
  const ca=coords(a),cb=coords(b),bounds=[[inner-.025,outer+.025],[-depth/2-.025,depth/2+.025],[height-1.1,height+.23]];
  let lo=0,hi=1;
  for(let i=0;i<3;i++){const d=cb[i]-ca[i],[min,max]=bounds[i];if(Math.abs(d)<1e-9){if(ca[i]<min||ca[i]>max)return [{a,b}];}else{const t0=(min-ca[i])/d,t1=(max-ca[i])/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));}}
  if(hi<=lo)return [{a,b}];
  const at=(t:number):V=>a.map((v,i)=>v+(b[i]-v)*t) as V,result:RailRun[]=[];
  if(lo>1e-8)result.push({a,b:at(lo)});if(hi<1-1e-8)result.push({a:at(hi),b});return result;
}
/** Clip only where the bridge walking corridor meets the same deck elevation. */
export function connectRail(a:V,b:V,openings:TankOpening[]):RailRun[]{
  let runs:RailRun[]=[{a,b}];
  for(const opening of openings){
    const circle=opening.circle;
    if(circle){runs=runs.flatMap(run=>{
      const a=run.a,b=run.b,dx=b[0]-a[0],dz=b[2]-a[2],x=a[0]-circle.center[0],z=a[2]-circle.center[2],aa=dx*dx+dz*dz,bb=2*(x*dx+z*dz),cc=x*x+z*z-circle.radius*circle.radius,cuts=[0,1];
      const disc=bb*bb-4*aa*cc;if(aa>1e-12&&disc>=0)for(const t of [(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)])if(t>0&&t<1)cuts.push(t);
      if(Math.abs(b[1]-a[1])>1e-9)for(const h of [-.23,.23]){const t=(circle.center[1]+h-a[1])/(b[1]-a[1]);if(t>0&&t<1)cuts.push(t);}
      cuts.sort((a,b)=>a-b);const at=(t:number):V=>a.map((v,i)=>v+(b[i]-v)*t) as V,result:RailRun[]=[];
      for(let i=1;i<cuts.length;i++){const lo=cuts[i-1],hi=cuts[i],p=at((lo+hi)/2);if(hi-lo<1e-8||Math.hypot(p[0]-circle.center[0],p[2]-circle.center[2])<circle.radius&&Math.abs(p[1]-circle.center[1])<.23)continue;result.push({a:at(lo),b:at(hi),joinA:lo===0?run.joinA:undefined,joinB:hi===1?run.joinB:undefined});}return result;
    });continue;}
    const c=opening.corridor;
    if(!c)continue;const dx=c.end[0]-c.start[0],dz=c.end[2]-c.start[2],len=Math.hypot(dx,dz);if(len<.05)continue;
    const ux=dx/len,uz=dz/len;
    const coordinates=(p:V)=>[(p[0]-c.start[0])*ux+(p[2]-c.start[2])*uz,(p[0]-c.start[0])*uz-(p[2]-c.start[2])*ux,p[1]-c.start[1]-((p[0]-c.start[0])*ux+(p[2]-c.start[2])*uz)/len*(c.end[1]-c.start[1])];
    const inside=(p:number[])=>p[0]>=-.02&&p[0]<=len+.02&&Math.abs(p[1])<c.width/2+.025&&Math.abs(p[2])<.23;
    const join=(p:V):V|undefined=>{const q=coordinates(p);if(Math.abs(q[1])<c.width/2+.024)return;const along=Math.max(0,Math.min(len,q[0])),side=Math.sign(q[1])||1;return [c.start[0]+ux*along+uz*side*c.width/2,c.start[1]+along/len*(c.end[1]-c.start[1]),c.start[2]+uz*along-ux*side*c.width/2];};
    runs=runs.flatMap(run=>{
      const ca=coordinates(run.a),cb=coordinates(run.b),cuts=[0,1];
      for(const [axis,limits] of [[0,[-.02,len+.02]],[1,[-c.width/2-.025,c.width/2+.025]],[2,[-.23,.23]]] as [number,number[]][]){const d=cb[axis]-ca[axis];if(Math.abs(d)>1e-9)for(const v of limits){const t=(v-ca[axis])/d;if(t>0&&t<1)cuts.push(t);}}
      cuts.sort((x,y)=>x-y);const at=(t:number):V=>run.a.map((v,i)=>v+(run.b[i]-v)*t) as V,result:RailRun[]=[];
      if(!cuts.slice(1).some((hi,i)=>inside(coordinates(at((cuts[i]+hi)/2)))))return [run];
      for(let i=1;i<cuts.length;i++){const lo=cuts[i-1],hi=cuts[i];if(hi-lo<1e-8||inside(coordinates(at((lo+hi)/2))))continue;const p=at(lo),q=at(hi);result.push({a:p,b:q,joinA:lo>0?join(p):run.joinA,joinB:hi<1?join(q):run.joinB});}return result;
    });
  }
  return runs;
}
