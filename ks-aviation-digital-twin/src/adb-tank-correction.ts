import {tankStairLayout} from './tank-stairs';
import {newEntity,type SceneData} from './scene-data';
import {localToWorld,worldToLocal} from './facility-data';
import {inspectionLayout,type V3} from './inspection-layout';
/** One-time correction: retain every existing feed/riser vertex before the ring. */
export function correctAdbTankTops(scene:SceneData){
 for(let k=1;k<=2;k++){
  const es=scene.entities,tank=es.find(e=>e.id===(k===1?'mtfgd0f5ucmhs2':'mtfgdsfpr7rq8i')),access=es.find(e=>e.id===`adb-fire-foam-${k}-inspection`),foam=es.find(e=>e.id===`adb-fire-foam-${k}-outlet`),cool=es.find(e=>e.id===`adb-fire-cool-${k}-outlet`);
  if(!tank||!access||!foam?.facility?.pipePath?.length||!cool?.facility?.pipePath?.length)continue;
  if(access.facility?.tag!=='PHOTO-STAIR-31'){
   const chamber=worldToLocal(tank,localToWorld(foam,foam.facility.pipePath.at(-2)!));
   access.position=[tank.position[0],tank.position[1]+(tank.height-1.25)*tank.scale,tank.position[2]];access.heading=tank.heading;access.scale=tank.scale;access.radius=tank.radius;access.width=.95;access.length=3.65;access.height=1.52;
   access.facility={...access.facility,tag:'PHOTO-STAIR-31',tankA:tank.id,stairStart:Math.atan2(chamber[0],chamber[2])*180/Math.PI,clockwise:false};
  }
  if(cool.facility.tag==='LEVEL-STAIR-20261031')continue;
  const l=inspectionLayout(access),H=tank.height,idx=cool.facility.ringStartIndex??3;
  const old=cool.facility.pipePath.map(p=>worldToLocal(tank,localToWorld(cool,p))),anchor=old[idx];if(!anchor)continue;
  const base=anchor[1],angle0=Math.atan2(anchor[0],anchor[2]),ring:V3[]=[];
  for(let i=0;i<=192;i++){
   const a=angle0+i*Math.PI/96,d=Math.atan2(Math.sin(a-l.start),Math.cos(a-l.start))*l.sign;
   const span=Math.abs(l.upperAngle-l.start),lo=-.8/l.R,hi=span+.8/l.R,margin=.22;
   const blend=d>=lo-margin&&d<=hi+margin?Math.max(0,Math.min(1,(d-lo+margin)/margin,(hi+margin-d)/margin)):0;
   let mainBlend=0;const main=tankStairLayout(tank);for(const piece of main.pieces){if(piece.y1+1.9<base||piece.y0>base+.1)continue;const mid=(piece.a+piece.b)/2,aa=a+Math.round((mid-a)/(2*Math.PI))*2*Math.PI,lo=Math.min(piece.a,piece.b)-.10,hi=Math.max(piece.a,piece.b)+.10;mainBlend=Math.max(mainBlend,Math.max(0,Math.min(1,(aa-lo+.18)/.18,(hi+.18-aa)/.18)));}
   const r=tank.radius+.18+Math.max(blend,mainBlend)*Math.max(1.28,l.R+l.w/2+.35-(tank.radius+.18));
   ring.push([Math.sin(a)*r,base,Math.cos(a)*r]);
  }
  // Keep the join at the original riser and preserve the entire rising pipe.
  ring[0]=[...anchor];ring[ring.length-1]=[...anchor];
  cool.facility.pipePath=[...cool.facility.pipePath.slice(0,idx),...ring.map(p=>worldToLocal(cool,localToWorld(tank,p)))];cool.facility.ringStartIndex=idx;cool.facility.tag='LEVEL-STAIR-20261031';
  const id=`adb-roof-cooling-${k}`;let roof=es.find(e=>e.id===id);
  if(!roof){roof=newEntity('TANK_COOLING',0,0,'tr');roof.id=id;es.push(roof);}
  roof.preset='TANK_COOLING';roof.name=`Tank ${k} · Ø5 m / 0,50 m çatı soğutma`;roof.position=[...tank.position];roof.heading=tank.heading;roof.scale=tank.scale;roof.color='#bc302a';
  const a=anchor,angle=Math.atan2(a[0],a[2]),y=H+.27+.5,near=2.85;
  const circle=Array.from({length:97},(_,i):V3=>[2.5*Math.sin(angle+i*Math.PI/48),y,2.5*Math.cos(angle+i*Math.PI/48)]);
  // Horizontal inward feed, vertical offset, horizontal connection: two elbows.
  const elbow:V3=[near*Math.sin(angle),H+.30,near*Math.cos(angle)];
  roof.facility={...roof.facility,open:true,circuit:`cool-${k}`,supplyId:cool.id,supplyTap:worldToLocal(cool,localToWorld(tank,a)),supplyRoute:[a],pipeDiameter:.05,pipePath:[a,[a[0],H+.30,a[2]],elbow,[elbow[0],y,elbow[2]],...circle],ringStartIndex:4,reference:'ADB-PHOTO-2026-10-30',tag:'ROOF-RING-5M'};
 }
}
