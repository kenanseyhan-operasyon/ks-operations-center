import type {Entity} from './scene-data';
import {localToWorld,worldToLocal} from './facility-data';
import {pathSections,type Point2} from './site-path';
type Path=ReturnType<typeof pathSections>;
const paths=new WeakMap<Entity,Path>();
const world=(e:Entity,p:Point2):Point2=>{const v=localToWorld(e,[p[0],0,p[1]]);return [v[0],v[2]];};
const local=(e:Entity,p:Point2):Point2=>{const v=worldToLocal(e,[p[0],e.position[1],p[1]]);return [v[0],v[2]];};
export const curbPath=(e:Entity)=>paths.get(e)||pathSections(e.points||[],e.width,e.facility?.closed,Math.max(.45/e.scale,e.width*1.5));
/** Join nearby open endpoints without rewriting the user's saved drawing. */
export function resolveCurbJoins(entities:Entity[]){
 const curbs=entities.filter(e=>e.preset==='CURB'&&e.points?.length),ends:{e:Entity;index:number;p:Point2;inside:Point2;width:number;top:number}[]=[];
 for(const e of curbs){const path=pathSections(e.points!,e.width,e.facility?.closed,Math.max(.45/e.scale,e.width*1.5));paths.set(e,path);if(path.closed)continue;for(const i of [0,path.points.length-1])ends.push({e,index:i,p:world(e,path.points[i]),inside:world(e,path.points[i===0?1:i-1]),width:e.width*e.scale,top:e.position[1]+e.height*e.scale});}
 const pairs:{a:typeof ends[number];b:typeof ends[number];distance:number}[]=[];
 for(let i=0;i<ends.length;i++)for(let j=i+1;j<ends.length;j++){const a=ends[i],b=ends[j],distance=Math.hypot(a.p[0]-b.p[0],a.p[1]-b.p[1]);if(a.e!==b.e&&Math.abs(a.top-b.top)<.015&&distance<=Math.max(.45,Math.max(a.width,b.width)*2))pairs.push({a,b,distance});}
 const used=new Set<typeof ends[number]>(),joins:typeof pairs=[];
 for(const pair of pairs.sort((a,b)=>a.distance-b.distance)){if(used.has(pair.a)||used.has(pair.b))continue;used.add(pair.a);used.add(pair.b);joins.push(pair);const p:Point2=[(pair.a.p[0]+pair.b.p[0])/2,(pair.a.p[1]+pair.b.p[1])/2];for(const end of [pair.a,pair.b])paths.get(end.e)!.points[end.index]=local(end.e,p);}
 for(const e of curbs){const p=paths.get(e)!;paths.set(e,pathSections(p.points,e.width,p.closed));}
 for(const {a,b} of joins){
  const centre=world(a.e,paths.get(a.e)!.points[a.index]),unit=(x:Point2,y:Point2):Point2=>{const d=Math.hypot(y[0]-x[0],y[1]-x[1])||1;return [(y[0]-x[0])/d,(y[1]-x[1])/d];},u=unit(a.inside,centre),v=unit(centre,b.inside),normal=(d:Point2):Point2=>[-d[1],d[0]],n=normal(u),m=normal(v),cross=(x:Point2,y:Point2)=>x[0]*y[1]-x[1]*y[0];
  const edge=(side:number):Point2=>{const p:Point2=[centre[0]+side*n[0]*a.width/2,centre[1]+side*n[1]*a.width/2],q:Point2=[centre[0]+side*m[0]*b.width/2,centre[1]+side*m[1]*b.width/2],den=cross(u,v);let hit:Point2;if(Math.abs(den)<.0001)hit=[(p[0]+q[0])/2,(p[1]+q[1])/2];else{const t=cross([q[0]-p[0],q[1]-p[1]],v)/den;hit=[p[0]+u[0]*t,p[1]+u[1]*t];}const distance=Math.hypot(hit[0]-centre[0],hit[1]-centre[1]),limit=Math.max(a.width,b.width)*2;return distance>limit?[centre[0]+(hit[0]-centre[0])*limit/distance,centre[1]+(hit[1]-centre[1])*limit/distance]:hit;};
  const left=edge(1),right=edge(-1);for(const [end,reverse] of [[a,a.index===0],[b,b.index!==0]] as const){const section=paths.get(end.e)!.sections[end.index];section.left=local(end.e,reverse?right:left);section.right=local(end.e,reverse?left:right);}
 }
}
type Edge={a:Point2;b:Point2;entity:Entity};
function boundaryEdges(entities:Entity[]){const edges:Edge[]=[];for(const e of entities)if(e.preset==='CURB'){const p=curbPath(e);for(let i=0;i<p.sections.length-(p.closed?0:1);i++)for(const side of ['left','right'] as const)edges.push({a:world(e,p.sections[i][side]),b:world(e,p.sections[(i+1)%p.sections.length][side]),entity:e});}return edges;}
const distance=(a:Point2,b:Point2)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function nearest(point:Point2,edges:Edge[]){let best:{point:Point2;edge:Edge;distance:number}|undefined;for(const edge of edges){const dx=edge.b[0]-edge.a[0],dz=edge.b[1]-edge.a[1],t=Math.max(0,Math.min(1,((point[0]-edge.a[0])*dx+(point[1]-edge.a[1])*dz)/(dx*dx+dz*dz||1))),p:Point2=[edge.a[0]+dx*t,edge.a[1]+dz*t],d=distance(point,p);if(!best||d<best.distance)best={point:p,edge,distance:d};}return best;}
export function groundCurbAtPoint(point:Point2,entities:Entity[],tolerance=.4){const at=nearest(point,boundaryEdges(entities));return at&&at.distance<=tolerance?at.edge.entity:undefined;}
export function snapGroundPoint(point:Point2,entities:Entity[],tolerance=.4):Point2{const at=nearest(point,boundaryEdges(entities));return at&&at.distance<=tolerance?at.point:point;}
/** Follow the curb's actual edge between nearby clicks instead of cutting across a corner. */
export function traceCurbBoundary(a:Point2,b:Point2,entities:Entity[]):Point2[]{
 const edges=boundaryEdges(entities),start=nearest(a,edges),end=nearest(b,edges);if(!start||!end||start.distance>.401||end.distance>.401)return [a,b];if(start.edge===end.edge)return [start.point,end.point];
 const key=(p:Point2)=>p.map(v=>Math.round(v*1e5)).join(':'),nodes=new Map<string,Point2>(),adj=new Map<string,{id:string;cost:number}[]>();
 const link=(a:Point2,b:Point2)=>{const x=key(a),y=key(b);nodes.set(x,a);nodes.set(y,b);for(const[u,v]of [[x,y],[y,x]]){const list=adj.get(u)||[];list.push({id:v,cost:distance(a,b)});adj.set(u,list);}};
 for(const e of edges)link(e.a,e.b);for(const [at,e]of [[start.point,start.edge],[end.point,end.edge]] as const){link(at,e.a);link(at,e.b);}
 const from=key(start.point),to=key(end.point),cost=new Map([[from,0]]),previous=new Map<string,string>(),pending=new Set(nodes.keys());
 while(pending.size){let current:string|undefined,best=Infinity;for(const id of pending)if((cost.get(id)??Infinity)<best){best=cost.get(id)!;current=id;}if(!current)break;if(current===to)break;pending.delete(current);for(const edge of adj.get(current)||[])if(best+edge.cost<(cost.get(edge.id)??Infinity)){cost.set(edge.id,best+edge.cost);previous.set(edge.id,current);}}
 if((cost.get(to)??Infinity)>distance(a,b)*1.65+.35)return [a,b];const result:Point2[]=[];let at=to;for(let n=0;n<=nodes.size;n++){result.push(nodes.get(at)!);if(at===from)return result.reverse();const before=previous.get(at);if(!before)break;at=before;}return [a,b];
}
export function fitGroundBoundary(points:Point2[],entities:Entity[],closed=true):Point2[]{
 if(!entities.some(e=>e.preset==='CURB'))return points.map(p=>[...p]);const snapped=points.map(p=>snapGroundPoint(p,entities)),result:Point2[]=[];
 for(let i=0;i<snapped.length-(closed?0:1);i++){const route=traceCurbBoundary(snapped[i],snapped[(i+1)%snapped.length],entities);for(const p of route.slice(0,-1))if(!result.length||distance(result.at(-1)!,p)>1e-5)result.push([...p]);}if(!closed&&snapped.length)result.push(snapped.at(-1)!);
 const clean:Point2[]=[];for(const p of result)if(!clean.length||distance(clean.at(-1)!,p)>.02)clean.push(p);if(closed&&clean.length>2&&distance(clean[0],clean.at(-1)!)<.02)clean.pop();
 for(let i=clean.length-1;i>=0&&clean.length>3;i--){if(!closed&&(i===0||i===clean.length-1))continue;const a=clean[(i+clean.length-1)%clean.length],p=clean[i],b=clean[(i+1)%clean.length],length=distance(a,b);if(length>.001&&Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))/length<.002&&distance(a,p)+distance(p,b)<length+.005)clean.splice(i,1);}
 return clean;
}
