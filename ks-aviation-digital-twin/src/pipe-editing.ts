import type {Entity} from './scene-data';
import {localToWorld,worldToLocal,isNetwork} from './facility-data';
import {referenceConnectionPoints,fireFrame,type Point3} from './socar-fire-layout';
export type PipeKey='pipePath'|'supplyRoute'|'concentrateRoute';
export type PipeRoute={id:string;entity:Entity;key:PipeKey;name:string;points:Point3[];anchored:boolean};
export function pipeRoutes(entities:Entity[]):PipeRoute[]{
 const map=new Map(entities.map(e=>[e.id,e])),result:PipeRoute[]=[];
 for(const e of entities){const f=e.facility;if(!f||e.preset==='PIPE_RACK')continue;
  if(f.pipePath?.length)result.push({id:e.id+':pipePath',entity:e,key:'pipePath',name:e.name+' · boru',points:f.pipePath.map(p=>localToWorld(e,p)),anchored:false});
  for(const [key,sourceKey,label] of [['supplyRoute','supplyId','su / ana bağlantı'],['concentrateRoute','concentrateId','konsantre bağlantısı']] as const){const source=map.get(f[sourceKey]||'');if(source&&isNetwork(e))result.push({id:e.id+':'+key,entity:e,key,name:e.name+' · '+label,points:referenceConnectionPoints(source,e,sourceKey),anchored:true});}
 }return result;
}
export function pipeEditFrame(entities:Entity[]){const f=fireFrame(entities);return {local:(p:Point3)=>f?f.local(p):[...p] as Point3,world:(p:Point3)=>f?f.world(...p):[...p] as Point3};}
export function validatePipePoints(points:Point3[]){
 if(points.length<2||points.length>256||points.some(p=>p.length!==3||p.some(n=>!Number.isFinite(n)||Math.abs(n)>50000)))throw Error('2–256 geçerli nokta girin.');
 for(let i=1;i<points.length;i++)if(Math.hypot(...points[i].map((v,j)=>v-points[i-1][j]))<.01)throw Error('Ardışık noktalar en az 1 cm ayrı olmalı.');
}
export function writePipeRoute(route:PipeRoute,points:Point3[]){
 validatePipePoints(points);
 if(route.anchored)for(const i of [0,points.length-1]){const original=i===0?route.points[0]:route.points.at(-1)!;if(Math.hypot(...points[i].map((v,j)=>v-original[j]))>.001)throw Error('Bağlantı uçları ekipmana bağlıdır; uç için ekipmanı taşıyın.');}
 const e=route.entity;e.facility={...e.facility,[route.key]:(route.anchored?points.slice(1,-1):points).map(p=>worldToLocal(e,p)),routeEdited:true};
}
/** Plan first, validate all, then mutate: one undo operation can safely wrap the batch. */
export function transformPipeRoutes(entities:Entity[],ids:Set<string>,axis:0|1|2,delta:number,cut?:number,side:1|-1=1){
 if(cut!==undefined&&!Number.isFinite(cut))throw Error('Kesit konumu geçerli bir sayı olmalı.');
 if(!Number.isFinite(delta)||Math.abs(delta)>100)throw Error('Değişim en fazla ±100 m olabilir.');
 const frame=pipeEditFrame(entities),routes=pipeRoutes(entities).filter(r=>ids.has(r.id));if(!routes.length)throw Error('En az bir hat seçin.');
 const plans=routes.map(route=>{const points=route.points.map((p,i)=>{
  if(route.anchored&&(i===0||i===route.points.length-1))return [...p] as Point3;
  const q=frame.local(p);if(cut===undefined||(q[axis]-cut)*side>1e-5)q[axis]+=delta;return frame.world(q);
 });validatePipePoints(points);return {route,points};});
 for(const p of plans)writePipeRoute(p.route,p.points);return plans.length;
}


/** Move a chosen vertex or straight section, keeping attached equipment ports fixed. */
export function nudgePipeSection(route:PipeRoute,entities:Entity[],index:number,segment:boolean,axis:0|1|2,delta:number){
 if(!Number.isInteger(index)||index<0||index>=route.points.length-(segment?1:0))throw Error('Geçerli bir nokta veya parça seçin.');
 if(!Number.isFinite(delta)||Math.abs(delta)>100)throw Error('Değişim en fazla ±100 m olabilir.');
 const indices=segment?[index,index+1]:[index];
 if(indices.some(i=>pipePointLocked(route,entities,i)))throw Error('Bu uç vana / ekipman ağzıdır; yanına ＋ ile iç nokta ekleyin.');
 const frame=pipeEditFrame(entities),points=route.points.map((p,i)=>{const q=frame.local(p);if(indices.includes(i))q[axis]+=delta;return frame.world(q);});
 writeConnectedPipeRoute(route,points,entities);
}

/** An attached pipe endpoint may be moved with its adjoining pipe vertex.
 * Valve/tank ports and interior manifold taps remain equipment-controlled. */
export function connectedPipeVertex(route:PipeRoute,entities:Entity[],index:number){
 if(!route.anchored||index!==0&&index!==route.points.length-1)return;
 const e=index===0?entities.find(e=>e.id===route.entity.facility?.[route.key==='concentrateRoute'?'concentrateId':'supplyId']):route.entity;
 const path=e?.facility?.pipePath;if(!e||!path)return;
 const vertex=path.findIndex(p=>Math.hypot(...localToWorld(e,p).map((v,j)=>v-route.points[index][j]))<.001);
 return vertex<0?undefined:{entity:e,index:vertex};
}
export function pipePointLocked(route:PipeRoute,entities:Entity[],index:number){return route.anchored&&(index===0||index===route.points.length-1)&&!connectedPipeVertex(route,entities,index);}
export function writeConnectedPipeRoute(route:PipeRoute,points:Point3[],entities:Entity[]){
 validatePipePoints(points);
 const updates=new Map<Entity,Point3[]>();
 if(route.anchored)for(const i of [0,points.length-1]){
  const oldIndex=i===0?0:route.points.length-1;
  if(Math.hypot(...points[i].map((v,j)=>v-route.points[oldIndex][j]))<.001)continue;
  const joint=connectedPipeVertex(route,entities,oldIndex);if(!joint)throw Error('Bu nokta vana / ekipman ağzıdır. Yanındaki ＋ ile düzenlenebilir dirsek noktası ekleyin.');
  const path=updates.get(joint.entity)||structuredClone(joint.entity.facility!.pipePath!);path[joint.index]=worldToLocal(joint.entity,points[i]);updates.set(joint.entity,path);
 }
 for(const path of updates.values())validatePipePoints(path);
 for(const [e,path] of updates)e.facility={...e.facility,pipePath:path,routeEdited:true};
 const e=route.entity;e.facility={...e.facility,[route.key]:(route.anchored?points.slice(1,-1):points).map(p=>worldToLocal(e,p)),routeEdited:true};
}
export function straightenPipeRange(route:PipeRoute,start:number,end:number,entities:Entity[]){
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>=route.points.length||end-start<2)throw Error('Aralarında en az bir nokta bulunan başlangıç ve bitiş seçin.');
 const points=structuredClone(route.points),a=points[start],b=points[end];
 for(let i=start+1;i<end;i++)points[i]=a.map((v,j)=>v+(b[j]-v)*(i-start)/(end-start)) as Point3;
 writeConnectedPipeRoute(route,points,entities);
}

export type PipePiece={routeId:string;index:number};
export function nearestPipePiece(routes:PipeRoute[],point:Point3){
 let best:{route:PipeRoute;index:number;distance:number;point:Point3}|undefined;
 for(const route of routes)for(let i=0;i<route.points.length-1;i++){
  const a=route.points[i],b=route.points[i+1],v=b.map((x,j)=>x-a[j]),size=v.reduce((s,x)=>s+x*x,0);
  const t=size?Math.max(0,Math.min(1,v.reduce((s,x,j)=>s+x*(point[j]-a[j]),0)/size)):0;
  const q=a.map((x,j)=>x+v[j]*t) as Point3,d=Math.hypot(...q.map((x,j)=>x-point[j]));
  if(!best||d<best.distance)best={route,index:i,distance:d,point:q};
 }return best;
}
/** Reconnect at the user's chosen pipe and exact projected tap, without moving it. */
export function connectPipeStart(route:PipeRoute,source:Entity,point:Point3){
 if(!route.anchored||source.id===route.entity.id||!source.facility?.pipePath?.length)throw Error('Başlangıç için başka bir ana boru seçin.');
 const hit=nearestPipePiece(pipeRoutes([source]).filter(r=>r.key==='pipePath'),point);if(!hit)throw Error('Geçerli ana boru bulunamadı.');
 const f=route.entity.facility!,foam=route.key==='concentrateRoute';
 const proposed=[hit.point,...route.points.slice(1)];validatePipePoints(proposed);
 f[foam?'concentrateId':'supplyId']=source.id;f[foam?'concentrateTap':'supplyTap']=worldToLocal(source,hit.point);
 f[route.key]=proposed.slice(1,-1).map(p=>worldToLocal(route.entity,p));f.routeEdited=true;
}
/** Plan on clones: shared vertices move only once and rejected edits are atomic. */
export function movePipePieces(entities:Entity[],pieces:PipePiece[],axis:0|1|2,delta:number){
 const vector:Point3=[0,0,0];vector[axis]=delta;return translatePipePieces(entities,pieces,vector);
}
export function translatePipePieces(entities:Entity[],pieces:PipePiece[],delta:Point3){
 if(delta.length!==3||delta.some(v=>!Number.isFinite(v)||Math.abs(v)>100))throw Error('Geçerli X, Y, Z hareketi girin (en fazla 100 m).');
 if(delta.every(v=>v===0))return pieces;
 const remapped=pieces.map(p=>({...p}));
 const copy=structuredClone(entities),routes=pipeRoutes(copy),frame=pipeEditFrame(copy),sets=new Map<string,Set<number>>();
 for(const piece of pieces){const r=routes.find(r=>r.id===piece.routeId);if(!r||piece.index<0||piece.index>=r.points.length-1)throw Error('Parçayı yeniden seçin.');const set=sets.get(r.id)||new Set<number>();set.add(piece.index);set.add(piece.index+1);sets.set(r.id,set);}
 if(!sets.size)throw Error('Sahneden en az bir parça seçin.');
 for(const [id,indices] of sets){const r=routes.find(r=>r.id===id)!;const points=r.points.map((p,i)=>{const q=frame.local(p);if(indices.has(i))for(let j=0;j<3;j++)q[j]+=delta[j];return frame.world(q);});if(r.anchored){if(indices.has(0)){points.unshift([...r.points[0]]);for(const piece of remapped)if(piece.routeId===id)piece.index++;const f=r.entity.facility!,source=copy.find(e=>e.id===f[r.key==='concentrateRoute'?'concentrateId':'supplyId']);if(source?.facility?.pipePath)f[r.key==='concentrateRoute'?'concentrateTap':'supplyTap']=worldToLocal(source,r.points[0]);}if(indices.has(r.points.length-1))points.push([...r.points.at(-1)!]);}writeConnectedPipeRoute(r,points,copy);}
 for(let i=0;i<entities.length;i++)if(JSON.stringify(copy[i].facility)!==JSON.stringify(entities[i].facility))entities[i].facility=copy[i].facility;
 return remapped;
}
export function resizePipePiece(route:PipeRoute,entities:Entity[],index:number,end:'start'|'end',delta:number){
 const a=route.points[index],b=route.points[index+1];if(!a||!b||!Number.isFinite(delta))throw Error('Geçerli parça ve uzunluk seçin.');
 const length=Math.hypot(...b.map((v,j)=>v-a[j]));if(length+delta<.01)throw Error('Parça en az 1 cm kalmalı.');
 const vertex=end==='start'?index:index+1;if(pipePointLocked(route,entities,vertex))throw Error('Bu uç ekipmana bağlı. Bağlantı yerini seçin veya diğer uçtan kısaltın.');
 const points=structuredClone(route.points);points[vertex]=points[vertex].map((v,j)=>v+(b[j]-a[j])/length*delta*(end==='start'?-1:1)) as Point3;writeConnectedPipeRoute(route,points,entities);
}

