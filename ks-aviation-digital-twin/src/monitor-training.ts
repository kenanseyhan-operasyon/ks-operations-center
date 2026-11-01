import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Entity} from './scene-data';
import {localToWorld,worldToLocal} from './facility-data';
export type MonitorSetting={yaw:number;elevation:number;opening:number;lossBar:number};
export const defaultMonitor=():MonitorSetting=>({yaw:0,elevation:30,opening:1,lossBar:2});
/** Direct manipulation uses deltas, not camera direction, so the model stays independent of view mode. */
export function aimMonitorByDrag(s:MonitorSetting,dx:number,dy:number){
 s.yaw=T.MathUtils.clamp(s.yaw+dx*.28,-150,150);
 s.elevation=T.MathUtils.clamp(s.elevation-dy*.20,0,75);
 return s;
}
export function adjustMonitorOpening(s:MonitorSetting,wheelDelta:number){
 s.opening=T.MathUtils.clamp(Math.round((s.opening+(wheelDelta<0?.05:-.05))*20)/20,0,1);
 return s;
}
/** The operator must be close enough for both hands to reach the yoke, not just within control-panel range. */
export function canGripMonitor(o:Entity,p:number[]){
 const q=worldToLocal(o,p as [number,number,number]);
 return q[2]<=-.35&&q[2]>=-1.35&&Math.abs(q[0])<=.7&&Math.abs(q[1])<.6;
}
export function behindMonitor(o:Entity,p:number[]){const q=worldToLocal(o,p as [number,number,number]);return q[2]<-.25&&q[2]>-2.5&&Math.abs(q[0])<1.1&&Math.abs(q[1])<.6;}
/** Training approximation: 10 bar source, explicit estimated loss, ideal nozzle velocity.
 * Not a calibrated reach/flow curve or extinguishing effectiveness model. */
export function monitorTrajectory(o:Entity,s:MonitorSetting,entities:Entity[]){
 const a=s.elevation*Math.PI/180,yaw=s.yaw*Math.PI/180,pivot=new T.Vector3(0,o.facility?.monitorBottomInlet?1.7:1.15,.25),direction=new T.Vector3(Math.sin(yaw)*Math.cos(a),Math.sin(a),Math.cos(yaw)*Math.cos(a));
 const mouth=pivot.addScaledVector(direction,.65),origin=new T.Vector3(...localToWorld(o,mouth.toArray() as [number,number,number]));
 direction.applyAxisAngle(new T.Vector3(0,1,0),-o.heading*Math.PI/180);
 const pressure=Math.max(0,10-s.lossBar)*s.opening*s.opening,speed=Math.sqrt(2*pressure*100000/1000)*.9,points=[origin.clone()];let hit='';
 for(let i=1;i<=600&&speed>0;i++){const t=i*.025,p=origin.clone().addScaledVector(direction,speed*t);p.y-=4.905*t*t;
  const tank=entities.find(e=>e.kind==='tank'&&p.y>=e.position[1]&&p.y<=e.position[1]+(e.height+.27)*e.scale&&Math.hypot(p.x-e.position[0],p.z-e.position[2])<=e.radius*e.scale);
  if(p.y<=0){p.y=0;hit='Zemin';}if(tank)hit=tank.name;points.push(p);if(hit)break;
 }
 return {points,pressure,hit,range:Math.hypot(points.at(-1)!.x-origin.x,points.at(-1)!.z-origin.z)};
}
export function prepareMonitor(g:T.Group,o:Entity){
 const pivot=new T.Group();pivot.name='MONITOR_AZIMUTH';pivot.position.set(0,o.facility?.monitorBottomInlet?1.7:1.15,.25);
 // Keep the inlet fixed; a separate articulated nozzle replaces the static barrel.
 const pitch=new T.Group();pitch.name='MONITOR_ELEVATION';pivot.add(pitch);
 const barrel=new T.Mesh(new T.CylinderGeometry(.095,.095,.65,12),new T.MeshStandardMaterial({color:'#aebbbe',metalness:.45,roughness:.5}));barrel.rotation.x=Math.PI/2;barrel.position.z=.325;pitch.add(barrel);
 // Operator-side yoke and two physical handgrips. They follow the monitor yaw.
 const steel=new T.MeshStandardMaterial({color:'#445259',metalness:.45,roughness:.55});
 // Place the yoke behind the pivot, within Nathan's REAL arm reach.
 // The old crossbar was over 30 cm beyond his animated palms even though
 // the logical contact flag read "gripping". Two steel cheeks extend the
 // moving yaw assembly to the operator-side crossbar.
 const yokeZ=-.59;
 // Batch the crossbar and both cheek supports into ONE mesh. Keeping the
 // fire-network draw-call budget prevents a regression in large ADB scenes.
 const yokeParts:T.BufferGeometry[]=[];
 const crossbar=new T.CylinderGeometry(.017,.017,.58,8);
 crossbar.rotateZ(Math.PI/2);crossbar.translate(0,-.14,yokeZ);yokeParts.push(crossbar);
 for(const x of [-.28,.28]){
  const cheek=new T.CylinderGeometry(.015,.015,Math.abs(yokeZ+.23),8);
  cheek.rotateX(Math.PI/2);cheek.translate(x,-.14,(yokeZ-.23)/2);yokeParts.push(cheek);
 }
 const merged=mergeGeometries(yokeParts);
 if(!merged)throw new Error('Cannot merge monitor rear-yoke fittings');
 yokeParts.forEach(g=>g.dispose());
 const crossbarAssembly=new T.Mesh(merged,steel);pivot.add(crossbarAssembly);
 for(const [name,x] of [['MONITOR_GRIP_LEFT',.28],['MONITOR_GRIP_RIGHT',-.28]] as const){
  const grip=new T.Mesh(new T.CylinderGeometry(.021,.021,.17,10),steel);
  grip.name=name;grip.position.set(x,-.06,yokeZ);pivot.add(grip);
 }
 g.add(pivot);
 const jet=g.getObjectByName('FACILITY_JET');if(jet){g.remove(jet);jet.traverse(n=>{if(n instanceof T.Mesh){n.geometry.dispose();}});}
 const stream=new T.Mesh(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([],3)),new T.MeshBasicMaterial({color:'#91cee8',transparent:true,opacity:.85}));stream.name='MONITOR_STREAM';stream.visible=false;stream.frustumCulled=false;stream.raycast=()=>{};g.add(stream);
}
export function updateMonitor(g:T.Group,o:Entity,s:MonitorSetting,flowing:boolean,foam:boolean,entities:Entity[]){
 const yaw=g.getObjectByName('MONITOR_AZIMUTH'),pitch=g.getObjectByName('MONITOR_ELEVATION'),line=g.getObjectByName('MONITOR_STREAM') as T.Mesh;
 if(!yaw||!pitch||!line)return;
 yaw.rotation.y=s.yaw*Math.PI/180;pitch.rotation.x=-s.elevation*Math.PI/180;line.visible=flowing&&s.opening>0;
 const key=JSON.stringify([s,o.position,o.heading,o.scale,entities.filter(e=>e.kind==='tank').map(e=>[e.position,e.radius,e.height,e.scale])]);
 if(line.userData.key!==key){line.userData.key=key;const result=monitorTrajectory(o,s,entities);line.userData.result=result;line.geometry.dispose();const points=result.points.map(p=>new T.Vector3(...worldToLocal(o,p.toArray() as [number,number,number])));line.geometry=points.length>1?new T.TubeGeometry(new T.CatmullRomCurve3(points),Math.min(160,points.length),.035,6,false):new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([],3));}
 (line.material as T.MeshBasicMaterial).color.set(foam?'#fff2cf':'#91cee8');
}
