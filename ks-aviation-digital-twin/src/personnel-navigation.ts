import * as T from 'three';
import type {Entity} from './scene-data';
import {localToWorld,worldToLocal} from './facility-data';
import {gateSegments,isFacilityGate} from './facility-gates';
import {AIRCRAFT_SPECS,aircraftLocalToWorld,pointLocal} from './aircraft-specs';
import type {PersonSocket} from './personnel-data';
export type V3=[number,number,number];
const distanceSegment=(x:number,z:number,a:number[],b:number[])=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=T.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);};

/** Footprint checks for ground walking, including finite fences and closed gates. */
export function personBlocked(point:V3,entities:Entity[],ignore?:string,gateAmount?:(id:string)=>number){
  for(const e of entities){
    if(e.id===ignore||e.kind==='person'||e.kind==='ground'||e.kind==='tree'||e.position[1]>point[1]+1.6)continue;
    if(isFacilityGate(e)&&((gateAmount?.(e.id)??(e.gateOpen?1:0))>.98))continue;
    if(e.kind==='wall'&&e.points?.length){if(gateSegments(e).some(([a,b])=>distanceSegment(point[0],point[2],a,b)<.3+e.thickness*e.scale/2))return true;continue;}
    const [x,,z]=worldToLocal(e,point),pad=.28/e.scale;
    if(e.kind==='tank'){if(Math.hypot(x,z)<e.radius+pad)return true;continue;}
    if(e.kind==='aircraft'){
      const spec=AIRCRAFT_SPECS[e.preset];if(!spec)continue;
      // Walk under a wing, but never through an engine or a landing gear.
      for(const s of [-1,1])if(Math.abs(x-s*spec.engineX)<spec.engineRadius+pad&&Math.abs(z-(spec.engineAft-spec.length/2))<spec.engineLength/2+pad)return true;
      if(Math.abs(x)<.6+pad&&Math.abs(z-(spec.noseGear-spec.length/2))<.6)return true;
      continue;
    }
    if(e.kind==='vehicle'||['BUILDING','GUARD_CABIN','DRIVER_WC','DIESEL_UNIT','FOAM_TANK','PUMP'].includes(e.preset))if(Math.abs(x)<e.width/2+pad&&Math.abs(z)<e.length/2+pad)return true;
  }return false;
}
export function groundPath(start:V3,end:V3,entities:Entity[],ignore?:string,gateAmount?:(id:string)=>number):V3[]|undefined{
  if(Math.hypot(end[0]-start[0],end[2]-start[2])>65)return;
  const clear=(a:V3,b:V3)=>{const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/.22));for(let i=1;i<=n;i++){const q:V3=[T.MathUtils.lerp(a[0],b[0],i/n),start[1],T.MathUtils.lerp(a[2],b[2],i/n)];if(personBlocked(q,entities,ignore,gateAmount))return false;}return true;};
  if(clear(start,end))return [end];
  const step=.65,minX=Math.min(start[0],end[0])-6,minZ=Math.min(start[2],end[2])-6,maxX=Math.max(start[0],end[0])+6,maxZ=Math.max(start[2],end[2])+6;
  const cell=(p:V3)=>[Math.round((p[0]-minX)/step),Math.round((p[2]-minZ)/step)],key=(x:number,z:number)=>`${x},${z}`,pos=(x:number,z:number):V3=>[minX+x*step,start[1],minZ+z*step];
  const [sx,sz]=cell(start),[ex,ez]=cell(end),first=key(sx,sz),open=new Set([first]),cost=new Map([[first,0]]),from=new Map<string,string>(),cells=new Map([[first,[sx,sz]]]),closed=new Set<string>();
  for(let k=0;k<9000&&open.size;k++){
    let current='',best=Infinity;for(const id of open){const [x,z]=cells.get(id)!,score=cost.get(id)!+Math.hypot(ex-x,ez-z);if(score<best){best=score;current=id;}}
    open.delete(current);closed.add(current);const [x,z]=cells.get(current)!,p=current===first?start:pos(x,z);
    if(Math.hypot(p[0]-end[0],p[2]-end[2])<step*1.5&&clear(p,end)){
      const path:V3[]=[end,p];let id=current;while(from.has(id)){id=from.get(id)!;if(id!==first){const q=cells.get(id)!;path.push(pos(q[0],q[1]));}}path.reverse();
      const short:V3[]=[];let a=start,i=0;while(i<path.length){let j=i;while(j+1<path.length&&clear(a,path[j+1]))j++;short.push(path[j]);a=path[j];i=j+1;}return short;
    }
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const xx=x+dx,zz=z+dz,id=key(xx,zz),q=pos(xx,zz);if(closed.has(id)||q[0]<minX||q[2]<minZ||q[0]>maxX||q[2]>maxZ||!clear(p,q))continue;
      const g=cost.get(current)!+Math.hypot(dx,dz);if(g>=(cost.get(id)??Infinity))continue;cost.set(id,g);from.set(id,current);cells.set(id,[xx,zz]);open.add(id);
    }
  }
}
function meshTop(root:T.Object3D,names:string[]){
  root.updateWorldMatrix(true,true);let chosen:T.Object3D|undefined;root.traverse(n=>{if(!chosen&&names.some(name=>n.name===name||n.name.startsWith(name+'_')))chosen=n;});
  if(!chosen)return;const b=new T.Box3().setFromObject(chosen),p=b.getCenter(new T.Vector3());p.y=b.max.y+.012;return {point:p,node:chosen};
}
export function personSocket(e:Entity,root:T.Object3D|undefined,socket:PersonSocket,eye?:T.Object3D):V3|undefined{
  if(socket==='driver'&&eye){eye.updateWorldMatrix(true,false);return eye.getWorldPosition(new T.Vector3()).toArray() as V3;}
  if(!root)return;
  if(socket==='platform')return meshTop(root,['Platform_Grey_Floor'])?.point.toArray() as V3|undefined;
  if(socket==='roof')return meshTop(root,['Tank_Top_Walkway'])?.point.toArray() as V3|undefined;
  if(socket==='landing')return accessPath(e,root)?.at(-1);
}
/** Access paths share the same dimensions and step counts as the actual models. */
export function accessPath(e:Entity,root?:T.Object3D,socket:PersonSocket='landing'):V3[]|undefined{
  if(e.kind==='tank'&&e.facility?.stairs!==false){
    const f=e.facility||{},H=e.height+.27,R=e.radius+(f.stairWidth??.9)/2+.12,start=(f.stairStart??0)*Math.PI/180,sweep=(f.sweep??180)*Math.PI/180*(f.clockwise===false?-1:1),N=Math.min(180,Math.max(4,Math.ceil(H/.185)));
    const path:V3[]=[[Math.sin(start)*R-Math.cos(start)*Math.sign(sweep)*.75,0,Math.cos(start)*R+Math.sin(start)*Math.sign(sweep)*.75]];
    for(let i=0;i<N;i++){const a=start+(i+.5)/N*sweep;path.push([Math.sin(a)*R,H*(i+1)/N,Math.cos(a)*R]);}
    const a=start+sweep;path.push([Math.sin(a)*R,H,Math.cos(a)*R],[Math.sin(a)*(e.radius-.6),H,Math.cos(a)*(e.radius-.6)]);
    return path.map(p=>localToWorld(e,p));
  }
  if(['MOBILE_STAIR','CROSSOVER_STAIR'].includes(e.preset)){
    const top=e.preset==='MOBILE_STAIR'?.75:1.1,run=(e.length-top)/(e.preset==='MOBILE_STAIR'?1:2),count=Math.max(4,Math.ceil(e.height/.2)),path:V3[]=[[0,0,-e.length/2-.5]];
    for(let i=0;i<count;i++)path.push([0,e.height*(i+1)/count,-e.length/2+run*(i+.5)/count]);path.push([0,e.height,0]);return path.map(p=>localToWorld(e,p));
  }
  if(!root||!['platform','roof'].includes(socket))return;
  root.updateWorldMatrix(true,true);const names=socket==='platform'?['Fixed_Step']:['Rear_Ladder_Close_Step'],steps:T.Vector3[]=[];
  root.traverse(n=>{if(!(n instanceof T.Mesh)||!names.some(name=>n.name===name||n.name.startsWith(name+'_')))return;const b=new T.Box3().setFromObject(n),p=b.getCenter(new T.Vector3());p.y=b.max.y;steps.push(p);});
  const top=personSocket(e,root,socket);if(!steps.length||!top)return;
  steps.sort((a,b)=>a.y-b.y);const first=steps[0],last=steps.at(-1)!,direction=first.clone().sub(new T.Vector3(...top));direction.y=0;
  if(direction.lengthSq()<.02)direction.set(0,0,1).applyAxisAngle(new T.Vector3(0,1,0),-e.heading*Math.PI/180);direction.normalize();
  const bottom=first.clone().addScaledVector(direction,.85);bottom.y=e.position[1];const path:V3[]=[bottom.toArray() as V3,...steps.map(p=>p.clone().addScaledVector(direction,.17).toArray() as V3)];
  if(socket!=='platform'&&last.y<top[1]-.4){const n=Math.ceil((top[1]-last.y)/.20);for(let i=1;i<n;i++)path.push([last.x,T.MathUtils.lerp(last.y,top[1],i/n),last.z]);}
  path.push(top);return path;
}
export function aircraftRefuelPoint(e:Entity){const spec=AIRCRAFT_SPECS[e.preset],p=spec?.points.find(p=>p.id==='REFUEL_COUPLING_R'&&p.quality!=='pending');return p?aircraftLocalToWorld(e,pointLocal(spec,p)):undefined;}
export function reachPoint(e:Entity,action:'valve'|'door'):V3{
  if(action==='valve')return localToWorld(e,[0,e.height+.13,0]);
  if(isFacilityGate(e)){const a=gateSegments(e)[0][0];return [a[0],e.position[1]+1.1,a[1]];}
  if(e.kind==='aircraft'){const spec=AIRCRAFT_SPECS[e.preset],p=spec?.points.find(p=>p.id==='REFUEL_PANEL'&&p.door&&p.quality!=='pending');if(p)return aircraftLocalToWorld(e,pointLocal(spec,p));}
  return localToWorld(e,[e.width*.20,1,e.length/2+.16]);
}
