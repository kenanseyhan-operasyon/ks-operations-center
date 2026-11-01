import type {Entity} from './scene-data';import {localToWorld} from './facility-data';import type {Point3} from './socar-fire-layout';
export function pipeSupports(points:Point3[],entities:Entity[],radius:number){
 const walls=entities.filter(e=>e.preset==='WALL'&&e.points?.length),result:{top:Point3;base:Point3;key:string}[]=[];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=Math.hypot(b[0]-a[0],b[2]-a[2]);if(len<.7||Math.abs(a[1]-b[1])>.12||Math.min(a[1],b[1])<1.8||Math.max(a[1],b[1])>3.5)continue;
 const count=Math.ceil(len/2.8);for(let j=0;j<count;j++){const t=(j+.5)/count,top=a.map((v,k)=>v+(b[k]-v)*t) as Point3;top[1]-=radius;let floor=0;
 for(const wall of walls){const p=wall.points!.map(p=>localToWorld(wall,[p[0],wall.height,p[1]]));for(let k=1;k<p.length;k++){const c=p[k-1],d=p[k],dx=d[0]-c[0],dz=d[2]-c[2],l=dx*dx+dz*dz;if(!l)continue;const u=Math.max(0,Math.min(1,((top[0]-c[0])*dx+(top[2]-c[2])*dz)/l));if(Math.hypot(top[0]-c[0]-dx*u,top[2]-c[2]-dz*u)<=wall.thickness*wall.scale/2+.035&&c[1]<top[1]-.025)floor=Math.max(floor,c[1]);}}
 result.push({key:`high:${i}:${j}`,top,base:[top[0],floor,top[2]]});}}
 return result;
}
