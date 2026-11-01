import type {Entity} from './scene-data';
import type {FacilitySettings} from './facility-data';
export type StairPoint=[number,number,number];
export type StairPiece={a:number;b:number;y0:number;y1:number;landing:boolean;roofLanding?:boolean};
const tau=Math.PI*2;
export const tankPoint=(a:number,r:number,y:number):StairPoint=>[Math.sin(a)*r,y,Math.cos(a)*r];
/** Rotate the complete existing access around the tank, including picked ends. */
export function rotateTankStairs(settings:FacilitySettings,deltaDegrees:number):FacilitySettings{
  if(!Number.isFinite(deltaDegrees))return {...settings};
  const delta=deltaDegrees%360,a=delta*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const rotate=([x,y,z]:StairPoint):StairPoint=>[c*x+s*z,y,-s*x+c*z];
  const next={...settings,stairStart:(((settings.stairStart??0)+delta+180)%360+360)%360-180};
  if(settings.stairBase)next.stairBase=rotate(settings.stairBase);
  if(settings.stairExit)next.stairExit=rotate(settings.stairExit);
  return next;
}
/** One source of truth for the visible treads, landings and operator route. */
export function tankStairLayout(o:Entity){
  const f=o.facility||{},width=f.stairWidth??.9,radius=o.radius+width/2+.12,height=o.height+.27,base=.135+(f.stairFloor??0);
  const start=(f.stairStart??0)*Math.PI/180,sign=f.clockwise===false?-1:1;
  const sweep=(f.stairSweep??f.sweep??180)*Math.PI/180*sign;
  const landingDepth=Math.max(1.1,width+.2),landingAngle=Math.min(Math.asin(Math.min(.95,(landingDepth/2-.02)/(radius+width/2+.025))),Math.abs(sweep)*.2);
  const roofLanding={angle:start+sweep,inner:o.radius-.32,outer:radius+width/2+.1,depth:landingDepth,height,entryAngle:start+sweep-sign*landingAngle};
  const count=f.stairLandings===false?0:Math.max(1,Math.min(8,Math.ceil((height-base)/3)-1));
  const flat=Math.min((f.stairLandingLength??1.2)/radius,Math.abs(sweep)*.35/Math.max(1,count));
  const flight=(Math.abs(sweep)-flat*count-landingAngle)/(count+1),rise=(height-base)/(count+1),pieces:StairPiece[]=[];
  let angle=start,y=base;
  for(let i=0;i<=count;i++){
    const steps=Math.max(1,Math.ceil(rise/.185));
    for(let j=0;j<steps;j++){const next=angle+sign*flight/steps,top=base+rise*(i+(j+1)/steps);pieces.push({a:angle,b:next,y0:y,y1:top,landing:false});angle=next;y=top;}
    if(i<count){const next=angle+sign*flat;pieces.push({a:angle,b:next,y0:y,y1:y,landing:true});angle=next;}
  }
  pieces.push({a:angle,b:start+sweep,y0:height,y1:height,landing:true,roofLanding:true});
  const entry:StairPoint=f.stairBase?[f.stairBase[0],base,f.stairBase[2]]:[Math.sin(start)*radius-Math.cos(start)*sign*.8,base,Math.cos(start)*radius+Math.sin(start)*sign*.8];
  const exit:StairPoint=f.stairExit?[f.stairExit[0],height,f.stairExit[2]]:tankPoint(start+sweep,o.radius-.6,height);
  const path:StairPoint[]=[entry,tankPoint(start,radius,base)];
  for(const p of pieces){if(p.landing){const n=Math.max(2,Math.ceil((p.b-p.a)*sign*radius/.25));for(let i=1;i<=n;i++)path.push(tankPoint(p.a+(p.b-p.a)*i/n,radius,p.y1));}else path.push(tankPoint((p.a+p.b)/2,radius,p.y1));}
  path.push(tankPoint(start+sweep,radius,height),exit);
  return {width,radius,height,base,start,sweep,sign,pieces,path,entry,exit,roofLanding};
}
/** Preserve the clicked exit angle; add a turn only when needed for the rise. */
export function stairSweepTo(o:Entity,start:StairPoint,end:StairPoint,clockwise:boolean){
  const sign=clockwise?1:-1,a=Math.atan2(start[0],start[2]),b=Math.atan2(end[0],end[2]);
  let sweep=((b-a)*sign%tau+tau)%tau;
  const radius=o.radius+(o.facility?.stairWidth??.9)/2+.12;
  const flats=Math.max(1,Math.min(8,Math.ceil((o.height+.135)/3)-1));
  const minimum=((o.height+.135)*1.4+flats*(o.facility?.stairLandingLength??1.2))/radius;
  while(sweep<minimum)sweep+=tau;
  return sweep*180/Math.PI;
}
