import * as T from 'three';
import type {Entity} from './scene-data';
import type {V3} from './personnel-navigation';
import type {NathanNavigation} from './nathan-navigation';
import type {NathanAccess} from './nathan-access';
import {stairPose} from './nathan-stair-gait';
import type {NathanContact} from './nathan-contact';

export type DriverLanding={seat:V3;feet:[V3,V3];hands:[V3,V3];heading:number};
const world=(n:T.Object3D,p:T.Vector3)=>n.localToWorld(p.clone()).toArray() as V3;
export function driverLanding(root:T.Object3D,heading:number):DriverLanding|undefined{
  const seat=root.getObjectByName('DRIVER_SEAT'),wheel=root.getObjectByName('DRIVER_STEERING_WHEEL');if(!seat||!wheel)return;
  return {seat:seat.getWorldPosition(new T.Vector3()).toArray() as V3,heading,
    feet:[world(seat.parent!,new T.Vector3(-.806,-.228,.280)),world(seat.parent!,new T.Vector3(-.806,-.228,.230))],
    hands:[world(wheel,new T.Vector3(-.032,.024,0)),world(wheel,new T.Vector3(.032,.024,0))]};
}
export function makeDriverAccess(e:Entity,root:T.Object3D,nav:NathanNavigation):NathanAccess|undefined{
  root.updateWorldMatrix(true,true);
  const seat=root.getObjectByName('DRIVER_SEAT'),wheel=root.getObjectByName('DRIVER_STEERING_WHEEL'),floor=root.getObjectByName('CAB_FLOOR') as T.Mesh;
  if(!seat||!wheel||!floor||Math.abs(e.position[1])>.05)return;
  const inverse=root.matrixWorld.clone().invert(),box=(n:T.Mesh)=>{n.geometry.computeBoundingBox();return n.geometry.boundingBox!.clone().applyMatrix4(inverse.clone().multiply(n.matrixWorld));};
  const treads:T.Vector3[]=[];root.traverse(n=>{if(n instanceof T.Mesh&&n.name.startsWith('CAB_ACCESS_STEP_LEFT_')){const b=box(n),p=b.getCenter(new T.Vector3());p.y=b.max.y;treads.push(p);}});
  if(treads.length<3)return;treads.sort((a,b)=>a.y-b.y);
  const bottom=treads[0].clone();bottom.x-=1.10;bottom.z+=1.65;bottom.y=0;
  let entry=world(root,bottom);for(let i=0;i<25&&nav.blocked(entry);i++){bottom.x-=.1;entry=world(root,bottom);}
  if(nav.blocked(entry))return;
  const corner=bottom.clone();corner.z=treads[0].z;
  const near=treads[0].clone();near.x-=.28;near.y=0;
  const f=box(floor),landing=treads.at(-1)!.clone();landing.x=f.min.x+.26;landing.y=f.max.y+.012;
  landing.z+=.33;
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
  walk.contact.hipHeight=.89-.30*T.MathUtils.smoothstep(p,.3,.72);
  if(p<=.8)return {...walk,heading};
  const t=T.MathUtils.smoothstep(p,.8,1),scale=data.scale;
  const root=new T.Vector3(...walk.root).lerp(new T.Vector3(...driver.seat).add(new T.Vector3(0,-.529*scale,0)),t);
  const feet=walk.contact.feet.map((v,i)=>new T.Vector3(...v).lerp(new T.Vector3(...driver.feet[i]),t).toArray() as V3) as [V3,V3];
  const seated=new T.Vector3(...walk.root).add(new T.Vector3(0,.59*scale,0)).lerp(new T.Vector3(...driver.seat),t).toArray() as V3;
  const contact:NathanContact={feet,seated,lean:.12*t,hands:driver.hands,handWeight:t};
  return {root:root.toArray() as V3,contact,heading:access.heading+(driver.heading-access.heading)*t};
}
