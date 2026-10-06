import type { Pose } from './vehicle-motion';

const wrap=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
/** No lateral slip at the trailer axle: integrate the actual hitch displacement.
 * Works forwards and backwards; stopping never straightens a parked trailer. */
export function followHitch(before:Pose,after:Pose,relativeAngle:number,offset:number,wheelbase:number):number{
  if(wheelbase<=0)return relativeAngle;
  const yaw=wrap(after.heading-before.heading);
  const steps=Math.max(1,Math.ceil(Math.hypot(after.x-before.x,after.z-before.z)/.05),Math.ceil(Math.abs(yaw)/.02));
  let heading=before.heading+relativeAngle;
  let hx=before.x+Math.sin(before.heading)*offset,hz=before.z-Math.cos(before.heading)*offset;
  for(let i=1;i<=steps;i++){
    const t=i/steps,h=before.heading+yaw*t;
    const x=before.x+(after.x-before.x)*t+Math.sin(h)*offset,z=before.z+(after.z-before.z)*t-Math.cos(h)*offset;
    const dx=x-hx,dz=z-hz,half=heading+(dx*Math.cos(heading)+dz*Math.sin(heading))/(2*wheelbase);
    heading+=(dx*Math.cos(half)+dz*Math.sin(half))/wheelbase;hx=x;hz=z;
  }
  return wrap(heading-after.heading);
}
