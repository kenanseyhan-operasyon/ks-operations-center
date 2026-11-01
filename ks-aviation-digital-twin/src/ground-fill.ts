import {fitGroundBoundary,resolveCurbJoins} from './curb-joins';
import {ShapeUtils,Vector2} from 'three';
import {newEntity,type Entity} from './scene-data';
import {localToWorld,worldToLocal} from './facility-data';
import {tankStairLayout} from './tank-stairs';
import {pathSections,polygonArea,pointInPolygon,simplePolygon,type Point2} from './site-path';
export type FillMaterial='concrete'|'grass';
export const isGroundFill=(e:Entity)=>e.preset==='CONCRETE_FILL'||e.preset==='GRASS_FILL';
export function curbInterior(curb:Entity){
 if(curb.preset!=='CURB'||!curb.points)return;
 const path=pathSections(curb.points,curb.width,curb.facility?.closed,Math.max(.45/curb.scale,curb.width*1.5));
 if(!path.closed||!simplePolygon(path.points))return;
 const inside=polygonArea(path.points)>0?'left':'right',points=path.sections.map(s=>s[inside]);
 return simplePolygon(points)?points:undefined;
}
export const lineSide=(p:Point2,a:Point2,b:Point2)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
/** Clip triangles and cancel shared edges, keeping disconnected parts of concave areas separate. */
export function cutPolygon(p:Point2[],a:Point2,b:Point2,side:number):Point2[][]{
 const contour=polygonArea(p)<0?[...p].reverse():p,triangles=ShapeUtils.triangulateShape(contour.map(q=>new Vector2(...q)),[]),edges=new Map<string,[Point2,Point2]>();
 const key=(q:Point2)=>q.map(n=>Math.round(n*1e7)).join(':'),edgeKey=(u:Point2,v:Point2)=>[key(u),key(v)].sort().join('|');
 for(const triangle of triangles){const poly=triangle.map(i=>contour[i]),out:Point2[]=[];
  for(let i=0;i<poly.length;i++){
   const u=poly[i],v=poly[(i+1)%poly.length],du=lineSide(u,a,b)*side,dv=lineSide(v,a,b)*side;
   if(du>=-1e-9)out.push(u);
   if((du>1e-9&&dv< -1e-9)||(du< -1e-9&&dv>1e-9)){const t=du/(du-dv);out.push([u[0]+(v[0]-u[0])*t,u[1]+(v[1]-u[1])*t]);}
  }
  if(out.length<3||Math.abs(polygonArea(out))<1e-10)continue;
  if(polygonArea(out)<0)out.reverse();
  for(let i=0;i<out.length;i++){const u=out[i],v=out[(i+1)%out.length];if(key(u)===key(v))continue;const k=edgeKey(u,v);if(edges.has(k))edges.delete(k);else edges.set(k,[u,v]);}
 }
 const next=new Map<string,[Point2,Point2][]>();for(const edge of edges.values()){const list=next.get(key(edge[0]))||[];list.push(edge);next.set(key(edge[0]),list);}
 const result:Point2[][]=[];while(edges.size){const first=edges.values().next().value!,loop:Point2[]=[first[0]];let edge=first;
  for(let n=0;n<=triangles.length*4+4;n++){
   edges.delete(edgeKey(...edge));const at=edge[1];if(key(at)===key(loop[0]))break;loop.push(at);
   const candidate=next.get(key(at))?.find(e=>edges.has(edgeKey(...e)));if(!candidate)throw new Error('Zemin bölme sınırı kapatılamadı.');edge=candidate;
  }
  if(simplePolygon(loop))result.push(loop);
 }
 return result;
}
export const fillOutline=(e:Entity):Point2[]=>e.points||[[-e.width/2,-e.length/2],[e.width/2,-e.length/2],[e.width/2,e.length/2],[-e.width/2,e.length/2]];
const contoursCache=new WeakMap<Entity,{key:string;polygons:Point2[][]}>();
function rawGroundFillContours(e:Entity):Point2[][]{
 const p=fillOutline(e),key=JSON.stringify([p,e.facility?.fillCut,e.facility?.fillSide]),cached=contoursCache.get(e);if(cached?.key===key)return cached.polygons;
 const f=e.facility;if(!f?.fillCut||!f.fillSide)return [p];
 const polygons=cutPolygon(p,f.fillCut[0],f.fillCut[1],f.fillSide);contoursCache.set(e,{key,polygons});return polygons;
}
const fittedContours=new WeakMap<Entity,Point2[][]>();
export const groundFillContours=(e:Entity):Point2[][]=>fittedContours.get(e)||rawGroundFillContours(e);
export function boundaryFill(boundary:Entity,material:FillMaterial,lang:'tr'|'en'='tr'){
 const points=curbInterior(boundary);if(!points)throw new Error(lang==='tr'?'Önce bordür çizgisini kapatın; sınır kendi üzerinden geçmemeli.':'Close the curb first; its boundary must not cross itself.');
 const fill=newEntity(material==='concrete'?'CONCRETE_FILL':'GRASS_FILL',boundary.position[0],boundary.position[2],lang);
 fill.facility={fillBoundaryId:boundary.id};updateLinkedFill(fill,boundary,points);return fill;
}
function updateLinkedFill(fill:Entity,boundary:Entity,points:Point2[]){
 fill.points=points.map(p=>[...p]);fill.position=[...boundary.position];fill.heading=boundary.heading;fill.scale=boundary.scale;fill.height=boundary.height;
 fill.width=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));fill.length=Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]));
}
export function updateGroundFills(entities:Entity[]){
 resolveCurbJoins(entities);
 for(const e of entities)if(isGroundFill(e)&&e.facility?.fillBoundaryId){const boundary=entities.find(b=>b.id===e.facility!.fillBoundaryId),p=boundary&&curbInterior(boundary);if(boundary&&p)updateLinkedFill(e,boundary,p);else delete e.facility.fillBoundaryId;}
 const fills=entities.filter(isGroundFill);
 for(const fill of fills){fittedContours.delete(fill);if(fill.facility?.fillBoundaryId)continue;const contours=rawGroundFillContours(fill).map(poly=>{const world=poly.map(p=>{const v=localToWorld(fill,[p[0],0,p[1]]);return [v[0],v[2]] as Point2;}),fitted=fitGroundBoundary(world,entities);if(!simplePolygon(fitted))return poly;return fitted.map(p=>{const v=worldToLocal(fill,[p[0],fill.position[1],p[1]]);return [v[0],v[2]] as Point2;});});fittedContours.set(fill,contours);}

 for(const tank of entities)if(tank.kind==='tank'){
  const entry=localToWorld(tank,tankStairLayout(tank).entry),top=Math.max(tank.position[1],...fills.map(e=>fillHeightAt(e,[entry[0],entry[2]])??tank.position[1])),floor=Math.max(0,(top-tank.position[1])/tank.scale);
  if(floor>.0001)tank.facility={...tank.facility,stairFloor:Math.min(floor,Math.max(0,tank.height-.2))};else if(tank.facility?.stairFloor!==undefined)delete tank.facility.stairFloor;
 }
}
export function splitGroundArea(source:Entity,a:Point2,b:Point2,concretePoint:Point2,lang:'tr'|'en'='tr'){
 const local=(p:Point2):Point2=>{const v=worldToLocal(source,[p[0],source.position[1],p[1]]);return [v[0],v[2]];},A=local(a),B=local(b),C=local(concretePoint);
 const base=source.preset==='CURB'?boundaryFill(source,'concrete',lang):structuredClone(source),p=fillOutline(base);
 if(!p||!simplePolygon(p)||!pointInPolygon(C,p)||Math.hypot(B[0]-A[0],B[1]-A[1])<.05)throw new Error(lang==='tr'?'Geçerli bir sınır, iki ayrı çizgi noktası ve alan içinde beton tarafı seçin.':'Choose a valid boundary, two distinct line points and the concrete side inside the area.');
 const direction=lineSide(C,A,B);if(Math.abs(direction)<.01)throw new Error(lang==='tr'?'Beton tarafını çizgiden biraz uzakta seçin.':'Choose the concrete side away from the line.');
 const side=direction>0?1:-1;
 if([side,-side].some(s=>cutPolygon(p,A,B,s).reduce((sum,q)=>sum+Math.abs(polygonArea(q)),0)<.02))throw new Error(lang==='tr'?'Çizgi alanı iki parçaya ayırmalı.':'The line must divide the area into two parts.');
 return (['concrete','grass'] as const).map((material,i)=>{const e=newEntity(material==='concrete'?'CONCRETE_FILL':'GRASS_FILL',0,0,lang);Object.assign(e,{position:[...base.position],heading:base.heading,scale:base.scale,height:base.height,width:base.width,length:base.length,points:structuredClone(p)});e.facility={fillBoundaryId:base.facility?.fillBoundaryId,fillPairId:source.facility?.fillPairId||source.id,fillCut:[A,B],fillSide:(i===0?side:-side) as 1|-1};return e;});
}
export function fillHeightAt(e:Entity,p:Point2){
 const local=worldToLocal(e,[p[0],e.position[1],p[1]]);return groundFillContours(e).some(poly=>pointInPolygon([local[0],local[2]],poly))?e.position[1]+e.height*e.scale:undefined;
}
export function drawnFillHeight(points:Point2[],entities:Entity[],referenceId?:string){
 const reference=referenceId&&entities.find(e=>e.id===referenceId&&e.preset==='CURB');
 if(reference)return reference.position[1]+reference.height*reference.scale;
 const curbs=entities.filter(e=>e.preset==='CURB').flatMap(e=>{const p=curbInterior(e);return p&&points.every(q=>{const v=worldToLocal(e,[q[0],e.position[1],q[1]]);return pointInPolygon([v[0],v[2]],p);})?[{e,area:Math.abs(polygonArea(p))*e.scale*e.scale}]:[];}).sort((a,b)=>a.area-b.area);
 return curbs.length?curbs[0].e.position[1]+curbs[0].e.height*curbs[0].e.scale:.2;
}


