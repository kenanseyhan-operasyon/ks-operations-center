import type {Entity} from './scene-data';
import {localToWorld,worldToLocal} from './facility-data';
import {pipeRoutes,nearestPipePiece,validatePipePoints,type PipeRoute} from './pipe-editing';
import type {Point3} from './socar-fire-layout';
export type AssemblyPlan={before:string;entities:Entity[];delta:Point3;routes:PipeRoute[];movedIds:string[];fixedNames:string[]};
export function assemblyOptions(entities:Entity[],rootId:string){
 const ids=new Set([rootId]);let changed=true;
 while(changed){changed=false;for(const e of entities)if(!ids.has(e.id)&&[e.facility?.supplyId,e.facility?.concentrateId].some(id=>id&&ids.has(id))){ids.add(e.id);changed=true;}}
 return entities.filter(e=>ids.has(e.id));
}
/** Build an immutable transaction. Only explicitly selected bodies move; outgoing
 * route waypoints follow those bodies while the next unselected equipment port stays fixed. */
export function planAssembly(entities:Entity[],routeId:string,movedIds:Set<string>,point:Point3):AssemblyPlan{
 const before=JSON.stringify(entities),copy=structuredClone(entities),oldRoutes=pipeRoutes(entities),root=oldRoutes.find(r=>r.id===routeId);
 if(!root?.anchored)throw Error('Kollektöre bağlı vana girişini seçin.');
 const sourceKey=root.key==='concentrateRoute'?'concentrateId':'supplyId',tapKey=root.key==='concentrateRoute'?'concentrateTap':'supplyTap';
 const source=entities.find(e=>e.id===root.entity.facility?.[sourceKey]);
 if(!source?.facility?.pipePath)throw Error('Bu girişin ana boru güzergâhı bulunamadı.');
 if(!movedIds.has(root.entity.id)||movedIds.has(source.id))throw Error('Vana seçili, ana kollektör sabit olmalı.');
 const allowed=new Set(assemblyOptions(entities,root.entity.id).map(e=>e.id));
 for(const id of movedIds){const e=entities.find(e=>e.id===id);if(!allowed.has(id)||e?.facility?.mount)throw Error('Yalnız bu dala bağlı, yüzeye sabitlenmemiş ekipmanları seçin.');}
 const hit=nearestPipePiece(pipeRoutes([source]).filter(r=>r.key==='pipePath'),point);if(!hit)throw Error('Ana boru üzerinde bir nokta seçin.');
 const delta=hit.point.map((v,j)=>v-root.points[0][j]) as Point3;
 if(delta.some(v=>!Number.isFinite(v))||Math.hypot(...delta)>100)throw Error('Hareket en fazla 100 m olabilir.');
 if(Math.hypot(...delta)<.001)throw Error('Yeni giriş yeri mevcut yerle aynı.');
 for(const e of copy)if(movedIds.has(e.id)){e.position=e.position.map((v,j)=>v+delta[j]) as Point3;e.facility={...e.facility,routeEdited:true};}
 const affected=new Set<string>(),fixed=new Set<string>();
 for(const r of oldRoutes){
  const target=copy.find(e=>e.id===r.entity.id)!,f=target.facility!;
  if(!r.anchored){if(movedIds.has(target.id))affected.add(r.id);continue;}
  const key=r.key==='concentrateRoute'?'concentrateId':'supplyId',tap=r.key==='concentrateRoute'?'concentrateTap':'supplyTap';
  const oldSource=entities.find(e=>e.id===r.entity.facility?.[key])!,newSource=copy.find(e=>e.id===oldSource.id)!;
  const moveTarget=movedIds.has(target.id),moveSource=movedIds.has(oldSource.id);
  if(!moveTarget&&!moveSource)continue;
  // Both selected bodies: rigid translation. Boundary route: all intermediate
  // waypoints follow the moving side, but the outside equipment remains fixed.
  const inner=r.points.slice(1,-1).map(p=>p.map((v,j)=>v+delta[j]) as Point3);
  f[r.key]=inner.map(p=>worldToLocal(target,p));f.routeEdited=true;
  if(oldSource.facility?.pipePath){
   const desired=moveSource?r.points[0].map((v,j)=>v+delta[j]) as Point3:r.points[0];
   f[tap]=worldToLocal(newSource,desired);
  }
  if(!moveTarget)fixed.add(target.name);if(!moveSource&&oldSource.id!==source.id)fixed.add(oldSource.name);
  affected.add(r.id);
 }
 const newRoot=copy.find(e=>e.id===root.entity.id)!;
 newRoot.facility![tapKey]=worldToLocal(source,hit.point);
 const routes=pipeRoutes(copy).filter(r=>affected.has(r.id));
 for(const r of routes)validatePipePoints(r.points);
 return {before,entities:copy,delta,routes,movedIds:[...movedIds],fixedNames:[...fixed]};
}
/** Slide within the current straight collector segment, never jump around a corner. */
export function assemblyStepPoint(entities:Entity[],routeId:string,metres:number):Point3{
 const route=pipeRoutes(entities).find(r=>r.id===routeId);if(!route?.anchored||!Number.isFinite(metres))throw Error('Geçerli vana girişi ve mesafe seçin.');
 const source=entities.find(e=>e.id===route.entity.facility?.[route.key==='concentrateRoute'?'concentrateId':'supplyId']);
 const hit=source&&nearestPipePiece(pipeRoutes([source]).filter(r=>r.key==='pipePath'),route.points[0]);if(!hit)throw Error('Ana kollektör bulunamadı.');
 const a=hit.route.points[hit.index],b=hit.route.points[hit.index+1],len=Math.hypot(...b.map((v,j)=>v-a[j]));
 const offset=Math.hypot(...hit.point.map((v,j)=>v-a[j]))+metres;
 if(offset<0||offset>len)throw Error('Bu mesafe kollektörün düz bölümünü aşıyor. Daha küçük adım seçin.');
 return a.map((v,j)=>v+(b[j]-v)*offset/len) as Point3;
}
export function applyAssembly(entities:Entity[],plan:AssemblyPlan){
 if(JSON.stringify(entities)!==plan.before)throw Error('Sahne değişti. Önizlemeyi yeniden oluşturun.');
 for(let i=0;i<entities.length;i++){entities[i].position=[...plan.entities[i].position];entities[i].facility=structuredClone(plan.entities[i].facility);}
}
