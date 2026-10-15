import * as T from 'three';
import type { Entity } from './scene-data';
import type { V3 } from './personnel-navigation';
import { bridgeSpan, localToWorld } from './facility-data';
import type { NathanNavigation } from './nathan-navigation';

export type RoofLeg = { surfaceId: string; kind: 'tank' | 'bridge'; points: V3[]; fromTankId?: string; toTankId?: string };
const length = (a: V3,b: V3) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export const roofHeight = (tank: Entity) => tank.position[1]+(tank.height+.282)*tank.scale;
export const roofRadius = (tank: Entity,radius: number) => tank.radius*tank.scale-radius-.16*tank.scale;
export function tankRoofPoint(tank: Entity): V3 {
  const f=tank.facility||{},angle=((f.stairStart??0)+(f.sweep??180)*(f.clockwise===false?-1:1))*Math.PI/180;
  return localToWorld(tank,[Math.sin(angle)*(tank.radius-.65),tank.height+.282,Math.cos(angle)*(tank.radius-.65)]);
}
export function bridgeTanks(bridge: Entity,entities: Entity[]) {
  const f=bridge.facility;
  if(bridge.preset!=='TANK_BRIDGE'||!f)return;
  const a=entities.find(e=>e.id===(f.bridgeStart?.parentId||f.tankA)&&e.kind==='tank');
  const b=entities.find(e=>e.id===(f.bridgeEnd?.parentId||f.tankB)&&e.kind==='tank');
  return a&&b&&a.id!==b.id?[a,b] as const:undefined;
}
export function roofBridgeIds(tankId: string,entities: Entity[]) {
  return entities.filter(e=>bridgeTanks(e,entities)?.some(t=>t.id===tankId)).map(e=>e.id);
}
export function onTankRoof(tank: Entity,p: V3,radius: number) {
  return Math.abs(p[1]-roofHeight(tank))<.08&&Math.hypot(p[0]-tank.position[0],p[2]-tank.position[2])<=roofRadius(tank,radius)+.005;
}
export function makeRoofBridge(bridge: Entity,fromTankId: string,entities: Entity[],nav: NathanNavigation,radius: number): RoofLeg | undefined {
  const tanks=bridgeTanks(bridge,entities),span=bridgeSpan(bridge,entities);
  if(!tanks||!span||bridge.width*bridge.scale<2*radius+.1||!tanks.some(t=>t.id===fromTankId))return;
  const [a,b]=tanks,dx=span.end[0]-span.start[0],dz=span.end[2]-span.start[2],run=Math.hypot(dx,dz);
  if(run<.1||Math.abs(span.end[1]-span.start[1])/run>.5)return;
  const portal=(tank:Entity,point:V3,sign:number):V3|undefined=>{
    const safe=roofRadius(tank,radius);
    for(let t=0;t<tank.radius*tank.scale*2;t+=.025){
      const p:V3=[point[0]+sign*dx/run*t,roofHeight(tank),point[2]+sign*dz/run*t];
      if(Math.hypot(p[0]-tank.position[0],p[2]-tank.position[2])<=safe)return p;
    }
  };
  const pa=portal(a,span.start,-1),pb=portal(b,span.end,1);if(!pa||!pb)return;
  const points:V3[]=[pa,[span.start[0],span.start[1]+.02,span.start[2]],[span.end[0],span.end[1]+.02,span.end[2]],pb];
  if(points.slice(1).some((p,i)=>!nav.clear(points[i],p,bridge.id)))return;
  if(fromTankId===b.id)points.reverse();
  return {surfaceId:bridge.id,kind:'bridge',points,fromTankId,toTankId:fromTankId===a.id?b.id:a.id};
}
/** Recover a paused bridge walk from its actual saved foot position, never a snap. */
export function remainingRoofBridge(leg: RoofLeg,position: V3): RoofLeg | undefined {
  const point=new T.Vector3(...position);let best=Infinity,index=-1;
  for(let i=1;i<leg.points.length;i++){
    const a=new T.Vector3(...leg.points[i-1]),b=new T.Vector3(...leg.points[i]),line=new T.Line3(a,b);
    const projected=line.closestPointToPoint(point,true,new T.Vector3()),d=projected.distanceTo(point);
    if(d<best){best=d;index=i;}
  }
  if(best>.3||index<0)return;
  return {...leg,points:[[...position],...leg.points.slice(index)]};
}

/** Only roof disks and connected bridge decks participate; no route across air. */
export function planRoofRoute(start: V3,fromTankId: string,end: V3,toTankId: string,entities: Entity[],nav: NathanNavigation,radius: number): RoofLeg[] | undefined {
  const from=entities.find(e=>e.id===fromTankId&&e.kind==='tank'),to=entities.find(e=>e.id===toTankId&&e.kind==='tank');
  if(!from||!to||!onTankRoof(from,start,radius)||!onTankRoof(to,end,radius))return;
  const nodes:{point:V3;tankId:string}[]=[{point:start,tankId:fromTankId},{point:end,tankId:toTankId}];
  type Edge={from:number;to:number;leg:RoofLeg;cost:number};
  const links=new Map<number,Edge>();
  for(const bridge of entities.filter(e=>e.preset==='TANK_BRIDGE').slice(0,24)){
    const tanks=bridgeTanks(bridge,entities);if(!tanks)continue;
    const forward=makeRoofBridge(bridge,tanks[0].id,entities,nav,radius),reverse=makeRoofBridge(bridge,tanks[1].id,entities,nav,radius);
    if(!forward||!reverse)continue;
    const a=nodes.length,b=a+1;nodes.push({point:forward.points[0],tankId:tanks[0].id},{point:forward.points.at(-1)!,tankId:tanks[1].id});
    const cost=forward.points.slice(1).reduce((s,p,i)=>s+length(forward.points[i],p),0);
    links.set(a,{from:a,to:b,leg:forward,cost});links.set(b,{from:b,to:a,leg:reverse,cost});
  }
  const costs=new Map([[0,0]]),previous=new Map<number,Edge>(),closed=new Set<number>();
  for(;;){
    const current=[...costs.keys()].filter(i=>!closed.has(i)).sort((a,b)=>costs.get(a)!-costs.get(b)!)[0];
    if(current===undefined)return;if(current===1)break;closed.add(current);
    const edges:Edge[]=[],link=links.get(current);if(link&&!closed.has(link.to))edges.push(link);
    const a=nodes[current],tank=entities.find(e=>e.id===a.tankId)!;
    for(let i=1;i<nodes.length;i++){
      const b=nodes[i];if(i===current||closed.has(i)||a.tankId!==b.tankId)continue;
      const route=nav.path(a.point,b.point,p=>onTankRoof(tank,p,radius),roofBridgeIds(tank.id,entities));
      if(!route)continue;
      const points=[a.point,...route];edges.push({from:current,to:i,leg:{surfaceId:tank.id,kind:'tank',points},cost:points.slice(1).reduce((s,p,j)=>s+length(points[j],p),0)});
    }
    for(const edge of edges){const cost=costs.get(current)!+edge.cost;if(cost<(costs.get(edge.to)??Infinity)){costs.set(edge.to,cost);previous.set(edge.to,edge);}}
  }
  const route:RoofLeg[]=[];for(let i=1;i!==0;){const edge=previous.get(i)!;route.unshift(edge.leg);i=edge.from;}
  return route;
}
