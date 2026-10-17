import * as T from 'three';
import type {Entity} from './scene-data';
import type {V3} from './personnel-navigation';
import type {NathanNavigation} from './nathan-navigation';
import type {NathanAccess} from './nathan-access';
import {stairPose} from './nathan-stair-gait';
import type {NathanContact} from './nathan-contact';
import {cabUnits} from './cab-reference';

export type DriverLanding={seat:V3;feet:[V3,V3];hands:[V3,V3];heading:number};
const world=(n:T.Object3D,p:T.Vector3)=>n.localToWorld(p.clone()).toArray() as V3;
export function driverLanding(root:T.Object3D,heading:number):DriverLanding|undefined{
  const seat=root.getObjectByName('DRIVER_SEAT'),wheel=root.getObjectByName('DRIVER_STEERING_WHEEL');
  const pedals=[root.getObjectByName('DRIVER_PEDAL_TARGET_0'),root.getObjectByName('DRIVER_PEDAL_TARGET_1')];if(!seat||!wheel||pedals.some(p=>!p))return;
  return {seat:seat.getWorldPosition(new T.Vector3()).toArray() as V3,heading,
    feet:pedals.map(p=>p!.getWorldPosition(new T.Vector3()).toArray() as V3) as [V3,V3],
    hands:[world(wheel,new T.Vector3(cabUnits(-.17),cabUnits(.128),0)),world(wheel,new T.Vector3(cabUnits(.17),cabUnits(.128),0))]};
}
export function makeDriverAccess(e:Entity,root:T.Object3D,nav:NathanNavigation):NathanAccess|undefined{
  root.updateWorldMatrix(true,true);
  const seat=root.getObjectByName('DRIVER_SEAT'),wheel=root.getObjectByName('DRIVER_STEERING_WHEEL'),threshold=root.getObjectByName('CAB_DRIVER_THRESHOLD');
  if(!seat||!wheel||!threshold||Math.abs(e.position[1])>.05)return;
  const inverse=root.matrixWorld.clone().invert(),box=(n:T.Mesh)=>{n.geometry.computeBoundingBox();return n.geometry.boundingBox!.clone().applyMatrix4(inverse.clone().multiply(n.matrixWorld));};
  const treads:T.Vector3[]=[];root.traverse(n=>{if(n instanceof T.Mesh&&n.name.startsWith('CAB_ACCESS_STEP_LEFT_')){const b=box(n),p=b.getCenter(new T.Vector3());p.y=b.max.y;p.x-=.04;treads.push(p);}});
  if(treads.length<3)return;treads.sort((a,b)=>a.y-b.y);
  const bottom=treads[0].clone();bottom.x-=1.10;bottom.z+=1.65;bottom.y=0;
  let entry=world(root,bottom);for(let i=0;i<25&&nav.blocked(entry);i++){bottom.x-=.1;entry=world(root,bottom);}
  if(nav.blocked(entry))return;
  const corner=bottom.clone();corner.z=treads[0].z;
  const near=treads[0].clone();near.x-=.28;near.y=0;
  const landing=root.worldToLocal(threshold.getWorldPosition(new T.Vector3()));
  const stops=[bottom];for(const [a,b] of [[bottom,corner],[corner,near]]){const count=Math.max(1,Math.ceil(a.distanceTo(b)/.3));for(let i=1;i<=count;i++)stops.push(a.clone().lerp(b,i/count));}
  stops.push(...treads,landing);
  const outward=new T.Vector3(-1,0,0).transformDirection(root.matrixWorld),heading=e.heading+90;
  const driver=driverLanding(root,e.heading)!;
  const points=stops.map(p=>world(root,p));
  for(let i=1;i<points.length;i++)if(!nav.clear(points[i-1],points[i],e.id))return;
  const length=points.slice(1).reduce((n,p,i)=>n+new T.Vector3(...p).distanceTo(new T.Vector3(...points[i])),0)+.7*e.scale;
  const grips:[V3,V3][]=[];root.traverse(n=>{if(!(n instanceof T.Mesh)||!n.name.startsWith('CAB_GRAB_HANDLE'))return;const b=new T.Box3().setFromObject(n),c=b.getCenter(new T.Vector3());if(root.worldToLocal(c.clone()).x>0)return;const h=n.geometry.parameters as {height?:number};if(h.height)grips.push([world(n,new T.Vector3(0,-h.height/2,0)),world(n,new T.Vector3(0,h.height/2,0))]);});
  return {targetId:e.id,kind:'driver',points,heading,length,crest:.8,driver,contacts:{stops:points,heading,scale:e.scale,outward:outward.toArray() as V3,ladder:false,grips}};
}
/** Step into the actual doorway, crouch under the roof, then turn onto the seat.
 * The last segment constrains the pelvis, feet and hands to the cab fixtures. */
export function driverPose(access:NathanAccess,progress:number,descending=false){
  const data=access.contacts!,driver=access.driver!,p=T.MathUtils.clamp(progress,0,1),phase=Math.min(1,p/.8)*data.stops.length;
  const step=Math.min(data.stops.length-1,Math.floor(phase)),a=data.stops[Math.max(0,step-1)],b=data.stops[Math.min(data.stops.length-1,step+1)];
  const ground=a[1]<.01&&b[1]<.01;
  const heading=ground?Math.atan2(b[0]-a[0],-(b[2]-a[2]))*180/Math.PI+(descending?180:0):access.heading;
  const walk=stairPose({...data,heading},Math.min(1,p/.8));
  // Keep the pelvis and knees outside the sill until the trailing foot clears
  // the floor. Feet stay constrained to the real treads throughout this shift.
  const floor=data.stops.at(-1)![1],lowest=Math.min(...walk.contact.feet.map(f=>f[1]));
  const standOff=.30*data.scale*(1-T.MathUtils.smoothstep(lowest,floor-.09*data.scale,floor));
  const outward=new T.Vector3(...data.outward);
  const shift=T.MathUtils.smoothstep(walk.root[1],floor-1.05*data.scale,floor-.80*data.scale);
  walk.root=new T.Vector3(...walk.root).addScaledVector(outward,standOff*shift).toArray() as V3;
  // Stay upright on the lower treads; crouch only as the head approaches the
  // lintel. Early crouching pushes the thighs through the floor's front edge.
  walk.contact.hipHeight=Math.min(.89,(floor-walk.root[1])/data.scale+.58);
  const right=new T.Vector3(Math.cos(access.heading*Math.PI/180),0,Math.sin(access.heading*Math.PI/180));
  walk.contact.elbowPole=outward.clone().addScaledVector(right,.8).add(new T.Vector3(0,-.6,0)).toArray() as V3;
  if(walk.root[1]>.05*data.scale)walk.contact.grips=data.grips;
  if(p<=.8)return {...walk,heading};
  const t=T.MathUtils.smoothstep(p,.8,1),scale=data.scale;
  const root=new T.Vector3(...walk.root).lerp(new T.Vector3(...driver.seat).add(new T.Vector3(0,-.529*scale,0)),t);
  const feet=walk.contact.feet.map((v,i)=>new T.Vector3(...v).lerp(new T.Vector3(...driver.feet[i]),t).toArray() as V3) as [V3,V3];
  const seated=new T.Vector3(...walk.root).add(new T.Vector3(0,.59*scale,0)).lerp(new T.Vector3(...driver.seat),t).toArray() as V3;
  const h=access.heading*Math.PI/180,side=new T.Vector3(Math.cos(h),0,Math.sin(h));
  const hands=driver.hands.map((hand,i)=>{
    const desired=new T.Vector3(...walk.root).add(new T.Vector3(0,1.02*scale,0)).addScaledVector(side,(i?1:-1)*.25*scale);
    const candidates=(data.grips||[]).map(([a,b])=>new T.Line3(new T.Vector3(...a),new T.Vector3(...b)).closestPointToPoint(desired,true,new T.Vector3()));
    candidates.sort((a,b)=>a.distanceToSquared(desired)-b.distanceToSquared(desired));
    // Transfer one hand at a time: the other stays on the fixed handle or rim.
    const handTime=T.MathUtils.smoothstep(t,i?.3:0,i?1:.3);
    return (candidates[0]||desired).lerp(new T.Vector3(...hand),handTime).toArray() as V3;
  }) as [V3,V3];
  const contact:NathanContact={feet,seated,lean:.12*t,hands,gripHands:true,elbowPole:outward.clone().multiplyScalar(1-t).add(new T.Vector3(0,-1,0)).toArray() as V3};
  return {root:root.toArray() as V3,contact,heading:access.heading+(driver.heading-access.heading)*t};
}
