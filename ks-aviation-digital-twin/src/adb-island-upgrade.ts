import {correctAdbTankTops} from './adb-tank-correction';
import {newEntity,type Entity,type SceneData} from './scene-data';
import {localToWorld,worldToLocal} from './facility-data';
type V=[number,number,number];
/** Additive upgrade of shared revision 23. Existing edited pipe routes are untouched. */
export function upgradeAdbIslands(scene:SceneData){
 const es=scene.entities;
 for(const [id,preset] of [['mtfhc483jg7zz9','ADB_LOADING_ISLAND'],['adb-fire-receiving-roof','ADB_RECEIVING_ISLAND']]){const o=es.find(e=>e.id===id);if(o?.preset==='CANOPY')o.preset=preset;}
 correctAdbTankTops(scene);
 for(const [roofId,key] of [['mtfhc483jg7zz9','loading'],['adb-fire-receiving-roof','receiving']] as const){
  const roof=es.find(e=>e.id===roofId);if(!roof)continue;
  const gid=`adb-fuel-${key}`;if(scene.groups.some(g=>g.id===gid))continue; // Deleted/moved modules remain user choices on later loads.
  scene.groups.push({id:gid,name:key==='loading'?'Dolum · modüler Jet A-1':'Mal kabul · modüler Jet A-1'});
  for(let lane=0;lane<(key==='loading'?2:1);lane++){
   let previous:Entity|undefined;
   for(const [i,preset] of ['FUEL_PUMP','FUEL_FILTER','FUEL_METER','FUEL_HOSE'].entries()){
    const o=newEntity(preset,0,0,'tr');o.id=`${gid}-${lane}-${i}`;o.groupId=gid;o.name=`${key==='loading'?'Dolum':'Mal kabul'} ${lane+1} · ${o.name}`;
    const x=key==='loading'?(lane?-.51:.51):0,z=[-2.15,-.55,.8,2.15][i],y=key==='loading'?.18:0;
    o.position=localToWorld(roof,[x,y,z]);o.heading=roof.heading;o.scale=roof.scale;
    o.facility={circuit:`fuel-${key}-${lane}`,supplyId:previous?.id,tag:`${key==='loading'?'D':'M'}${lane+1}-${i+1}`,reference:'ADB-PHOTO-FIT-2026-10-30'};
    es.push(o);
    previous=o;
   }
  }
 }
}
