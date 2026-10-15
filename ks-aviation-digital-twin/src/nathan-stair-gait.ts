import * as T from 'three';
import type {V3} from './personnel-navigation';
import type {NathanContact} from './nathan-contact';
export type StairContacts={stops:V3[];heading:number;scale:number;outward:V3;ladder:boolean;grips?:[V3,V3][]};
const smooth=(t:number)=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
/** One foot remains planted while the other clears the riser, crosses and lands.
 * Reverse progress follows the same contacts while still facing a steep ladder. */
export function stairPose(data:StairContacts,progress:number):{root:V3;contact:NathanContact}{
  const {stops,scale}=data,last=stops.length-1,phase=T.MathUtils.clamp(progress,0,1)*(last+1),step=Math.min(last,Math.floor(phase)),t=phase-step;
  const moving=step%2,old=Math.max(0,step-1),fixed=step,next=Math.min(last,step+1);
  const points=[new T.Vector3(...stops[fixed]),new T.Vector3(...stops[fixed])];
  const a=new T.Vector3(...stops[old]),b=new T.Vector3(...stops[next]);
  const swing=a.clone().lerp(b,smooth((t-.2)/.6)),height=Math.max(a.y,b.y)+.11*scale;
  swing.y=t<.25?T.MathUtils.lerp(a.y,height,smooth(t/.25)):t>.75?T.MathUtils.lerp(height,b.y,smooth((t-.75)/.25)):height;
  if(progress===1)swing.copy(b);
  points[moving]=swing;
  const h=data.heading*Math.PI/180,side=new T.Vector3(Math.cos(h),0,Math.sin(h));
  const central=points[0].clone().add(points[1]).multiplyScalar(.5);central.y=(stops[fixed][1]+T.MathUtils.lerp(a.y,b.y,smooth(t)))/2;
  const weight=Math.min(smooth(phase),smooth((last+1-phase)));
  central.addScaledVector(new T.Vector3(...data.outward),data.ladder?.27*scale*weight:0);
  const feet=points.map((p,i)=>p.addScaledVector(side,(i?1:-1)*.12*scale).add(new T.Vector3(0,.005*scale,0)).toArray() as V3) as [V3,V3];
  return {root:central.toArray() as V3,contact:{feet,grips:weight>.02?data.grips:undefined,hipHeight:data.ladder?.85:.89}};
}
