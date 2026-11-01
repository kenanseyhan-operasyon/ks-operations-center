import {inspectionStair} from './foam-inspection-stair';
import {singleSupport,supportAvailable,batchSupports} from './editable-supports';
import {localToWorld} from './facility-data';
import {makePipeTube} from './pipe-geometry';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Entity} from './scene-data';
import {Builder,type V} from './facility-geometry';
/** Reference outlets are complete pipes, not decorative disconnected jets.
 * Nozzle spacing/elevations are visual reconstruction, not hydraulic design. */
export function makeReferencePipe(b:Builder,o:Entity):boolean{
 if(o.preset==='FOAM_INSPECTION_ACCESS'){
  inspectionStair(b,o);
  return true;
 }
 if(o.facility?.connectionHeads){
  const rise=o.facility.connectionHeads===2?.75:0,steel='#aebbbe';
  const points:V[]=rise?[[0,0,0],[0,0,.10],[0,rise,.10],[0,rise,.42]]:[[0,0,0],[0,0,.42]];
  makePipeTube(b,points,.0508,o.color,-o.position[1],.14);b.flange([0,rise,.30],o.color,'z',.13);
  const ends:V[]=o.facility.connectionHeads===2?[[-.16,rise-.12,.60],[.16,rise-.12,.60]]:[[0,rise,.52]];
  for(const end of ends){b.rod([0,rise,.42],end,.067,steel);const cap=b.cyl(.082,.025,end,steel);cap.rotation.x=Math.PI/2;for(const side of [-1,1])b.box(.035,.055,.035,[end[0]+side*.085,end[1],end[2]],steel);}
  if(rise){b.box(.20,.04,.20,[0,-o.position[1]+.02,.1],steel);b.rod([0,-o.position[1],.1],[0,rise-.14,.1],.025,steel);}
  return true;
 }
 const path=o.facility?.pipePath;if(!path?.length)return false;
 if(o.preset==='PIPE_RACK'){
  for(let i=1;i<path.length;i++){const a=path[i-1],z=path[i],dx=z[0]-a[0],dz=z[2]-a[2],length=Math.hypot(dx,dz);if(!length)continue;
   const nx=dz/length,nz=-dx/length,count=Math.ceil(length/3.2);
   for(let n=0;n<=count;n++){const x=a[0]+dx*n/count,q=a[2]+dz*n/count;
    const key=`rack:${i}:${n}`;if(!supportAvailable(o,key))continue;
    const part=singleSupport('rack',.9,1.22,o.color),angle=Math.atan2(dx,dz);part.position.set(x,0,q);part.rotation.y=angle;part.userData.autoSupport={ownerId:o.id,key,position:localToWorld(o,[x,0,q]),heading:o.heading-angle*180/Math.PI,scale:o.scale,width:.9,height:1.22,color:o.color,style:'rack'};b.g.add(part);
   }
  }batchSupports(b.g);return true;
 }
 const r=(o.facility?.pipeDiameter??.1016)/2;
 // The collector owns both of its bends; its smaller neighbours meet on
 // straight tangents through short reducers, without an exposed annular end.
 const reducer=o.id==='adb-fire-water-header'?{start:.0508,end:.0508,length:.12}:undefined;
 if(o.preset==='TANK_COOLING'&&o.facility?.ringStartIndex){const start=o.facility.ringStartIndex;makePipeTube(b,path.slice(0,start+1),r,o.color,-o.position[1]/o.scale,.16);makePipeTube(b,path.slice(start),r,o.color,-o.position[1]/o.scale,.10);}else makePipeTube(b,path,r,o.color,-o.position[1]/o.scale,o.facility?.bendRadius??.16,reducer);
 if(o.preset==='PIPE_RED'||o.preset==='PIPE_YELLOW'){
  for(let i=1;i<path.length;i++){
   const a=path[i-1],z=path[i],length=Math.hypot(z[0]-a[0],z[2]-a[2]);const height=o.position[1]+a[1]*o.scale,floor=-o.position[1]/o.scale;if(Math.abs(z[1]-a[1])>.1||height<.2||height>2)continue;
   const count=Math.max(1,Math.ceil(length/3.5));for(let n=0;n<=count;n++){
    const t=n/count,p:V=[a[0]+(z[0]-a[0])*t,a[1],a[2]+(z[2]-a[2])*t];
    const key=`low:${i}:${n}`;if(!supportAvailable(o,key))continue;const h=p[1]-r-floor,part=singleSupport('post',.2,h,'#b8c2c1');part.position.set(p[0],floor,p[2]);part.userData.autoSupport={ownerId:o.id,key,position:localToWorld(o,[p[0],floor,p[2]]),heading:o.heading,scale:o.scale,width:.2,height:h,color:'#b8c2c1',style:'post'};b.g.add(part);
   }
  }batchSupports(b.g);return true;
 }
 const jet=new THREE.Group();jet.name='FACILITY_JET';jet.visible=false;
 const material=new THREE.MeshBasicMaterial({color:'#9bd5ed',transparent:true,opacity:.35,depthWrite:false});
 const stream=(a:V,z:V,radius=.018)=>{
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...z),delta=end.clone().sub(start);
  const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),5),material);
  m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());jet.add(m);
 };
 if(o.preset==='TANK_COOLING'){
  const ring=path.slice(o.facility?.ringStartIndex??2),roof=o.facility?.tag==='ROOF-RING-5M';
  if(roof)for(let j=0;j<5;j++){const a=Math.atan2(ring[0][0],ring[0][2])+j*Math.PI*2/5,p:V=[2.5*Math.sin(a),ring[0][1],2.5*Math.cos(a)],foot:V=[p[0],p[1]-.5,p[2]];const leg=b.rod(foot,[p[0],p[1]-.025,p[2]],.025,'#aebbbe');leg.name='ROOF_RING_SUPPORT_'+j;b.box(.18,.02,.18,[foot[0],foot[1]+.01,foot[2]],'#aebbbe');}
  for(let i=0;i<ring.length-1;i+=roof?8:4){const p=ring[i],end:V=[p[0],p[1]+(roof?.10:-.18),p[2]];
   b.rod(p,end,.018,'#aebbbe');b.cyl(.032,.015,end,'#b9a357');
   if(roof){const a=Math.atan2(p[0],p[2]);for(const d of [-.4,0,.4])stream(end,[p[0]+Math.sin(a+d)*.8,p[1]-.17,p[2]+Math.cos(a+d)*.8]);}
   else for(const k of [-1,0,1])stream(end,[p[0]+k*.14,Math.max(.2,p[1]-2.3),p[2]+k*.14]);
  }
 }else if(o.preset==='SPRINKLER'){
  const receiving=o.facility?.circuit==='receiving',drop=o.facility?.sprinklerDrop??.18;const spans=path.slice(1).map((z,i)=>({a:path[i],z,length:Math.abs(z[1]-path[i][1])<.01?Math.hypot(z[0]-path[i][0],z[2]-path[i][2]):0})).sort((a,b)=>b.length-a.length);const {a,z}=spans[0],count=receiving?2:4;for(let i=0;i<count;i++){
   const t=(receiving?i:i+.5)/count,p:V=[a[0]+(z[0]-a[0])*t,a[1],a[2]+(z[2]-a[2])*t];
   b.rod(p,[p[0],p[1]-drop,p[2]],receiving?.028:.015,receiving?o.color:'#aebbbe');b.cyl(.045,.018,[p[0],p[1]-drop-.02,p[2]],'#b9a357');
   for(let j=0;j<8;j++){const angle=j*Math.PI/4;stream([p[0],p[1]-drop-.04,p[2]],[p[0]+Math.cos(angle)*1.2,Math.max(.1,p[1]-drop-2.4),p[2]+Math.sin(angle)*1.2],.014);}
  }
  if(receiving){const p=path.at(-1)!;b.cyl(.04,.025,p,'#b9a357');for(const k of [-1,0,1])stream(p,[p[0]+k*.7,p[1]-1.5,p[2]],.014);}
 }else if(o.preset==='TANK_FOAM_INLET'){
  const p=path[path.length-2],z=path[path.length-1];b.cyl(.16,.5,[p[0],p[1]+.15,p[2]],'#e9ce49');b.cyl(.2,.035,[p[0],p[1]+.42,p[2]],'#aebbbe');
  const rim=b.cyl(.085,.028,[p[0]+.158,p[1]+.15,p[2]],'#576365');rim.rotation.z=Math.PI/2;const glass=b.cyl(.065,.03,[p[0]+.177,p[1]+.15,p[2]],'#9dc7d0');glass.rotation.z=Math.PI/2;
  b.label(o.facility?.tag||'FC',.42,.18,[p[0],p[1]+.1,p[2]+.17]);stream(z,[z[0],z[1]-.8,z[2]],.055);
 }
 const pieces=jet.children.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh).map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});
 if(pieces.length){const merged=mergeGeometries(pieces,false);pieces.forEach(p=>p.dispose());if(merged){jet.children.forEach(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});jet.clear();jet.add(new THREE.Mesh(merged,material));}}
 b.g.add(jet);return true;
}




