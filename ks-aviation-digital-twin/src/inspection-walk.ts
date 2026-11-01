import type {Entity} from './scene-data';
import {inspectionLayout,type V3} from './inspection-layout';
import {localToWorld,worldToLocal} from './facility-data';
/** Shared with the visible merged landing and treads. Returned route runs from roof to inspection landing. */
export function inspectionWalk(o:Entity):V3[]{
 const l=inspectionLayout(o),n=Math.max(3,Math.ceil(o.height/.18)),d=l.run/n;
 const p:V3[]=[l.point(-.16,.014,l.lowerZ+.28),l.point(0,.014,-l.L/2+l.landing+d/2)];
 for(let i=2;i<=n;i++)p.push(l.point(0,o.height*(i-1)/(n-1)+.014,-l.L/2+l.landing+(i-.5)*d));
 p.push(l.point(0,o.height+.014,l.upperZ));
 // Entry overlaps the roof by 0.55m; it never faces the exterior void.
 p.push(l.point(l.R-o.radius+.55,o.height+.014,l.upperZ));
 return p.reverse().map(q=>localToWorld(o,q));
}
export function inspectionSurface(o:Entity,p:V3){
 const q=worldToLocal(o,p),l=inspectionLayout(o),a=Math.atan2(q[0],q[2]),d=Math.atan2(Math.sin(a-l.start),Math.cos(a-l.start)),z=l.lowerZ+d*l.R/l.sign,x=l.R-Math.hypot(q[0],q[2]);
 if(z< -l.L/2||z>l.L/2)return;
 const n=Math.max(3,Math.ceil(o.height/.18)),tread=l.run/n;
 let h:number;
 if(z<=-l.L/2+l.landing+tread){if(x< -l.w/2-.2||x>l.w/2)return;h=0;}
 else if(z>=l.L/2-l.landing){if(x< -l.w/2||x>l.R-o.radius+.35)return;h=o.height;}
 else {if(Math.abs(x)>l.w/2)return;const i=Math.floor((z+l.L/2-l.landing)/tread)+1;h=o.height*(i-1)/(n-1);}
 return o.position[1]+(h+.014)*o.scale;
}
