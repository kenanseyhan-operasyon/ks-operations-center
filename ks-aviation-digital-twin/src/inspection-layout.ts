import type {Entity} from './scene-data';
export type V3=[number,number,number];
export function inspectionLayout(o:Entity){
 const R=o.radius+.65,w=o.width,L=o.length,landing=.8,run=L-2*landing,lowerZ=-L/2+landing/2,upperZ=L/2-landing/2;
 const start=(o.facility?.stairStart??0)*Math.PI/180,sign=o.facility?.clockwise===false?-1:1;
 const point=(x:number,y:number,z:number):V3=>{const a=start+sign*(z-lowerZ)/R;return [Math.sin(a)*(R-x),y,Math.cos(a)*(R-x)];};
 const upperAngle=start+sign*(upperZ-lowerZ)/R;
 return {R,w,L,landing,run,lowerZ,upperZ,start,sign,upperAngle,point,roofEntry:point(R-o.radius+.35,o.height,upperZ)};
}
