import {newEntity,type SceneData} from './scene-data';
import {localToWorld,worldToLocal} from './facility-data';
import {detailFingerprint} from './adb-pipe-details';
import type {Point3} from './socar-fire-layout';
const baseline:Record<string,string>={'24b73628-9d60-42f1-9e81-e59fada1b947':'2ab7797c:193','a51cb392-2737-46ac-9c2a-9830e63109e3':'eb2daded:194','246150dc-cb83-4f89-812a-1128f9aaae2b':'9e7c45fd:193','8467e638-4199-4838-abcc-e165465cd34e':'c27b4c04:192','adb-fire-main-west':'21e7ede0:407','adb-fire-main-north':'fc804b76:178','adb-fire-main-south':'fc09a063:262'};
/** Repair only revision-19 monitors whose former supply valve is absent. */
export function repairAdbMonitors(scene:SceneData){
 let changed=false;const mains=scene.entities.filter(e=>['adb-fire-main-west','adb-fire-main-north','adb-fire-main-south'].includes(e.id)&&detailFingerprint(e)===baseline[e.id]);
 for(const monitor of scene.entities.filter(e=>e.preset==='FIRE_MONITOR'&&detailFingerprint(e)===baseline[e.id])){
  const f=monitor.facility!;if(f.monitorBottomInlet||!f.supplyId||scene.entities.some(e=>e.id===f.supplyId))continue;
  let best:{source:typeof monitor;tap:Point3;distance:number}|undefined;
  for(const source of mains){const path=source.facility!.pipePath!.map(p=>localToWorld(source,p));for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];if(Math.abs(a[1]-b[1])>.01)continue;const dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz;if(l<.01)continue;const t=Math.max(0,Math.min(1,((monitor.position[0]-a[0])*dx+(monitor.position[2]-a[2])*dz)/l)),tap:Point3=[a[0]+dx*t,a[1],a[2]+dz*t],distance=Math.hypot(monitor.position[0]-tap[0],monitor.position[2]-tap[2]);if(!best||distance<best.distance)best={source,tap,distance};}}
  if(!best||best.distance<.5||best.distance>3)continue;
  const {source,tap,distance}=best,dx=(monitor.position[0]-tap[0])/distance,dz=(monitor.position[2]-tap[2])/distance,valve=newEntity('PIPE_VALVE',tap[0]+dx*distance*.38,tap[2]+dz*distance*.38);
  valve.id=f.supplyId;valve.name=`${f.tag} · Su vanası`;valve.heading=-Math.atan2(dx,dz)*180/Math.PI;valve.scale=.46;valve.position[1]=tap[1]-.65*valve.scale;
  valve.facility={open:true,valveStyle:'lever',supplyId:source.id,supplyTap:worldToLocal(source,tap),supplyRoute:[],pipeDiameter:.1016,routeEdited:true,reference:f.reference,circuit:f.circuit,tag:f.tag};
  scene.entities.push(valve);f.monitorBottomInlet=true;f.pipeDiameter=.1016;f.supplyRoute=[worldToLocal(monitor,[monitor.position[0],tap[1],monitor.position[2]])];f.routeEdited=true;changed=true;
 }
 return changed;
}
