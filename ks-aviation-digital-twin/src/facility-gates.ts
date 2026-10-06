import * as THREE from 'three';
import type {Entity} from './scene-data';
import type {Pose,Point} from './vehicle-motion';
import {R14} from './r14-spec';

export const isFacilityGate=(e:Entity)=>e.kind==='wall'&&(e.wallStyle==='gate'||e.preset==='MAIN_GATE')&&!!e.points?.length;
export function gateSegments(e:Entity):[Point,Point][]{
  const h=e.heading*Math.PI/180,c=Math.cos(h),s=Math.sin(h);
  const points=(e.points||[]).map(([x,z]):Point=>[e.position[0]+e.scale*(c*x-s*z),e.position[2]+e.scale*(s*x+c*z)]);
  return points.slice(1).map((p,i)=>[points[i],p]);
}
const distance=(p:Point,a:Point,b:Point)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
export function vehicleFootprint(e:Entity,pose:Pose={x:e.position[0],z:e.position[2],heading:e.heading*Math.PI/180}):Point[][]{
  const rectangle=(x:number,z:number,h:number,front:number,rear:number,width:number):Point[]=>[[-1,front],[1,front],[1,-rear],[-1,-rear]].map(([side,d])=>[x+Math.sin(h)*d+Math.cos(h)*side*width/2,z-Math.cos(h)*d+Math.sin(h)*side*width/2]);
  if(e.preset!=='R14')return [rectangle(pose.x,pose.z,pose.heading,e.length*e.scale/2,e.length*e.scale/2,e.width*e.scale+.3)];
  const s=e.length/R14.length*e.scale,h=pose.heading,hitch=(R14.centreX-R14.hitchX)*s,w=Math.max(e.width*e.scale,.568*s)+.3;
  return [rectangle(pose.x,pose.z,h,(R14.centreX+.92)*s,(.175-R14.centreX)*s,w),rectangle(pose.x+Math.sin(h)*hitch,pose.z-Math.cos(h)*hitch,h+(e.trailerAngle||0),(R14.hitchX+.035)*s,(1.55-R14.hitchX)*s,w)];
}
/** Convex rectangle against the finite gate line, including its posts. */
export function gateIntersects(polygons:Point[][],a:Point,b:Point,margin=.25){
  return polygons.some(poly=>{
    const axes:Point[]=[[b[1]-a[1],a[0]-b[0]]];
    for(let i=0;i<poly.length;i++){const q=poly[(i+1)%poly.length];axes.push([q[1]-poly[i][1],poly[i][0]-q[0]]);}
    return axes.every(([x,z])=>{const len=Math.hypot(x,z)||1,values=poly.map(p=>(p[0]*x+p[1]*z)/len),u=(a[0]*x+a[1]*z)/len,v=(b[0]*x+b[1]*z)/len;return Math.max(...values)+margin>=Math.min(u,v)&&Math.min(...values)-margin<=Math.max(u,v);});
  });
}
export function setGateOpening(root:THREE.Object3D,amount:number){root.traverse(n=>{if(n.userData.gateTravel!==undefined)n.position.z=n.userData.closedZ+n.userData.gateTravel*amount;});}
type GateState={amount:number;hold:number;requested:boolean;occupied:boolean};
export class FacilityGates{
  private states=new Map<string,GateState>();
  amount(id:string){return this.states.get(id)?.amount||0;}
  update(dt:number,entities:Entity[],running:ReadonlySet<string>,object:(id:string)=>THREE.Object3D|undefined){
    let changed=false;
    const gates=entities.filter(isFacilityGate),vehicles=entities.filter(e=>e.kind==='vehicle'),ids=new Set(gates.map(e=>e.id));
    for(const id of this.states.keys())if(!ids.has(id))this.states.delete(id);
    for(const gate of gates){
      const state=this.states.get(gate.id)||{amount:gate.gateOpen?1:0,hold:0,requested:false,occupied:false},segments=gateSegments(gate);
      state.occupied=vehicles.some(v=>segments.some(([a,b])=>gateIntersects(vehicleFootprint(v),a,b,.6)));
      const approaching=vehicles.some(v=>running.has(v.id)&&segments.some(([a,b])=>distance([v.position[0],v.position[2]],a,b)<v.length*v.scale/2+12));
      state.requested=!!gate.gateOpen||state.occupied||approaching;
      if(state.requested)state.hold=4;else state.hold=Math.max(0,state.hold-dt);
      const previous=state.amount;state.amount=THREE.MathUtils.clamp(state.amount+(state.requested||state.hold>0?dt:-dt)/2.5,0,1);changed ||= state.amount!==previous;
      this.states.set(gate.id,state);const root=object(gate.id);if(root)setGateOpening(root,state.amount);
    }
    return changed;
  }
  waiting(vehicle:Entity,pose:Pose,speed:number,reverse:boolean,entities:Entity[]):Entity|undefined{
    const look=(reverse?-1:1)*(1.2+Math.abs(speed)*.2),next={...pose,x:pose.x+Math.sin(pose.heading)*look,z:pose.z-Math.cos(pose.heading)*look};
    return entities.find(g=>isFacilityGate(g)&&this.amount(g.id)<.995&&gateSegments(g).some(([a,b])=>gateIntersects(vehicleFootprint(vehicle,pose),a,b)||gateIntersects(vehicleFootprint(vehicle,next),a,b)));
  }
  nearest(vehicle:Entity,entities:Entity[]){return entities.filter(isFacilityGate).map(g=>({g,d:Math.min(...gateSegments(g).map(([a,b])=>distance([vehicle.position[0],vehicle.position[2]],a,b)))})).filter(x=>x.d<60).sort((a,b)=>a.d-b.d)[0]?.g;}
}
