import {newEntity,type Entity,type SceneData} from './scene-data';
import {portPosition,worldToLocal,localToWorld,type FacilitySettings} from './facility-data';
export type Point3=[number,number,number];
export const FIRE_REFERENCE='SOCAR-ADB-2026-10-24';
export const FIRE_LAYOUT_REVISION=10;
export const FIRE_GROUP='socar-adb-fire-reference-20261024';
export const fireId=(key:string)=>`adb-fire-${key}`;
const red='#b63530',yellow='#e9ce49';
const tankIds=['mtfgd0f5ucmhs2','mtfgdsfpr7rq8i'];
export const MONITOR_IDS=[
 '246150dc-cb83-4f89-812a-1128f9aaae2b',
 'a51cb392-2737-46ac-9c2a-9830e63109e3',
 '24b73628-9d60-42f1-9e81-e59fada1b947',
 '8467e638-4199-4838-abcc-e165465cd34e'
];
export const FIRE_CIRCUITS=[
 {key:'foam-1',name:'Tank 1 · Köpük',control:'foam-1-inlet',outlet:'foam-1-outlet',color:yellow},
 {key:'foam-2',name:'Tank 2 · Köpük',control:'foam-2-inlet',outlet:'foam-2-outlet',color:yellow},
 {key:'cool-1',name:'Tank 1 · Soğutma',control:'cool-1-valve',outlet:'cool-1-outlet',color:red},
 {key:'cool-2',name:'Tank 2 · Soğutma',control:'cool-2-valve',outlet:'cool-2-outlet',color:red},
 {key:'loading',name:'Dolum adası · Sprinkler',control:'loading-valve',outlet:'loading-outlet',color:red},
 {key:'receiving',name:'Mal kabul · Sprinkler',control:'receiving-valve',outlet:'receiving-outlet',color:red},
 ...MONITOR_IDS.map((id,i)=>({key:`monitor-${i+1}`,name:`Yangın monitörü ${i+1}`,control:`monitor-${i+1}-valve`,outlet:id,color:red}))
];
/** Survey plan orientation is fitted to the two existing SOCAR tanks. Existing
 * scene transforms and unrelated entities are never replaced by the reference. */
export function fireFrame(entities:Entity[]){
 const t1=entities.find(e=>e.id===tankIds[0]&&e.kind==='tank'),t2=entities.find(e=>e.id===tankIds[1]&&e.kind==='tank');
 if(!t1||!t2)return;
 const dx=t2.position[0]-t1.position[0],dz=t2.position[2]-t1.position[2],distance=Math.hypot(dx,dz);
 if(distance<5||distance>60)return;
 const v=[dx/distance,dz/distance],u=[-v[1],v[0]],heading=Math.atan2(-v[0],v[1])*180/Math.PI;
 const world=(x:number,y:number,z:number):Point3=>[t1.position[0]+u[0]*x+v[0]*z,y+t1.position[1],t1.position[2]+u[1]*x+v[1]*z];
 const local=(p:Point3):Point3=>{const x=p[0]-t1.position[0],z=p[2]-t1.position[2];return [x*u[0]+z*u[1],p[1]-t1.position[1],x*v[0]+z*v[1]];};
 return {tanks:[t1,t2],distance,heading,world,local};
}
export function referenceConnectionPoints(source:Entity,target:Entity,key:'supplyId'|'concentrateId'='supplyId'):Point3[]{
 const routes=target.facility?.[key==='supplyId'?'supplyRoute':'concentrateRoute'];
 let a=key==='concentrateId'&&target.preset==='FIRE_MONITOR'&&source.preset==='FOAM_DRUM'?localToWorld(source,[0,source.height+.02,0]):portPosition(source);const z=portPosition(target,key==='supplyId'?'in':'foam');
 const tap=target.facility?.[key==='supplyId'?'supplyTap':'concentrateTap'];
 const aim=tap?localToWorld(source,tap):routes?.length?localToWorld(target,routes[0]):z,path=source.facility?.pipePath?.map(p=>localToWorld(source,p));
 if(path&&path.length>1){let best=Infinity;for(let i=1;i<path.length;i++){
  const p=path[i-1],q=path[i],v=q.map((n,k)=>n-p[k]),length=v.reduce((s,n)=>s+n*n,0),t=length?Math.max(0,Math.min(1,v.reduce((s,n,k)=>s+n*(aim[k]-p[k]),0)/length)):0;
  const candidate=p.map((n,k)=>n+v[k]*t) as Point3,d=candidate.reduce((s,n,k)=>s+(n-aim[k])**2,0);if(d<best){best=d;a=candidate;}
 }}
 return [a,...(routes||[]).map(p=>localToWorld(target,p)),z].filter((p,i,all)=>!i||Math.hypot(...p.map((v,k)=>v-all[i-1][k]))>.0001);
}
/** Client-side reference migration only. Never writes the published cloud scene.
 * Preserve user controls and unrelated geometry; the current revision is installed once. */
export function installSocarFireLayout(scene:SceneData):boolean{
 const marker=scene.groups.find(g=>g.id===FIRE_GROUP),oldHeader=scene.entities.find(e=>e.id===fireId('water-header'));
 if(marker&&(!oldHeader||oldHeader.facility?.referenceRevision===FIRE_LAYOUT_REVISION))return false;
 const frame=fireFrame(scene.entities);if(!frame)return false;
 const {world,local,heading,tanks,distance}=frame;
 const previous=new Map(scene.entities.filter(e=>e.groupId===FIRE_GROUP&&e.facility?.reference===FIRE_REFERENCE&&e.id.startsWith('adb-fire-')).map(e=>[e.id,e]));
 const entities=scene.entities.filter(e=>!previous.has(e.id)),added:Entity[]=[],byId=new Map(entities.map(e=>[e.id,e]));
 const add=(key:string,preset:string,name:string,p:Point3,f:FacilitySettings={})=>{
  const e=newEntity(preset,p[0],p[2],'tr');e.id=fireId(key);e.name=name;e.position=p;e.heading=heading;e.groupId=FIRE_GROUP;
  e.facility={...e.facility,reference:FIRE_REFERENCE,referenceRevision:FIRE_LAYOUT_REVISION,...f};
  const old=previous.get(e.id)?.facility;
  if(previous.get(e.id)?.facility?.routeEdited){Object.assign(e,structuredClone(previous.get(e.id)!));e.facility!.referenceRevision=FIRE_LAYOUT_REVISION;}
  for(const k of ['open','enabled','ratio','ratioUnspecified','capacity','volume','flowLpm'] as const)if(old?.[k]!==undefined)(e.facility as Record<string,unknown>)[k]=old[k];
  added.push(e);byId.set(e.id,e);return e;
 };
 const route=(target:Entity,source:Entity,points:Point3[]=[],foam=false)=>{
  target.facility={...target.facility,[foam?'concentrateId':'supplyId']:source.id,[foam?'concentrateRoute':'supplyRoute']:points.map(p=>worldToLocal(target,p))};
 };
 const pipe=(key:string,name:string,points:Point3[],source:Entity,circuit:string,color=red)=>{
  const e=add(key,color===yellow?'PIPE_YELLOW':'PIPE_RED',name,points[0],{circuit,pipeDiameter:.1016});e.color=color;
  e.facility!.pipePath=points.map(p=>worldToLocal(e,p));route(e,source);return e;
 };
 const valve=(key:string,name:string,x:number,z:number,circuit:string,source:Entity,open=false)=>{
  const e=add(key,'PIPE_VALVE',name,world(x,.25,z),{circuit,tag:name,open,pipeDiameter:.1016,valveStyle:'lever'});e.scale=.8;route(e,source);return e;
 };
 const footprint=(id:string)=>{const e=byId.get(id);return e?.points?.map(p=>local(localToWorld(e,[p[0],0,p[1]])))||[];};
 const fence=footprint('efe2b18a-22a7-4e0c-9142-2bb292b9a3a2'),east=footprint('mth2tgcw0e7uce'),bund=footprint('271b17cb-99b0-46b5-a229-b12ec5ddf7ca');
 const along=(a:Point3,b:Point3,value:number,axis:0|2)=>{const other=axis===0?2:0;return a[other]+(b[other]-a[other])*(value-a[axis])/(b[axis]-a[axis]);};
 const westX=(z:number)=>fence.length>2?along(fence[1],fence[2],z,2):-6.2-(z+38)*.12;
 const southZ=(x:number)=>fence.length>3?along(fence[2],fence[3],x,0):-38-(x+6.2)*.08;
 const eastX=(z:number)=>east.length>1?along(east[0],east[1],z,2):28+z*.066;
 const sw=bund[2]||[-6.21,0,-7.77],se=bund[3]||[6.27,0,-8.39],bend=bund[4]||[7.07,0,2.55];
 const wallHeight=(byId.get('271b17cb-99b0-46b5-a229-b12ec5ddf7ca')?.height??1.7)+.38;
 const stores=entities.filter(e=>e.preset==='FOAM_TANK'&&local(e.position)[0]<15&&local(e.position)[2]<-25).sort((a,b)=>local(a.position)[0]-local(b.position)[0]);
 const foamSource=stores[0]||add('foam-store','FOAM_TANK','Köpük konsantresi · F-01',world(5.5,0,-38),{tag:'F-01'});
 const shelter=entities.find(e=>e.preset==='FOAM_SHELTER'),store=local((shelter||foamSource).position),mx=store[0]-3.1,mz=store[2]+1.6;
 // Construct the bay in the south fence's frame. Rotating only selected route
 // vertices afterwards bends straight runs and moves their shared junctions.
 const slope=southZ(mx+1)-southZ(mx),angle=Math.atan(slope),c=Math.cos(angle),sn=Math.sin(angle),bayHeading=heading-angle*180/Math.PI;
 const bay=(x:number,y:number,z:number):Point3=>world(mx+c*(x-mx)-sn*(z-mz),y,mz+sn*(x-mx)+c*(z-mz));
 const bayDistance=(mz-southZ(mx))*c;
 const bayTurnZ=(offset:number)=>mz+offset-bayDistance;
 const rack=(z:number,offset:number,y:number)=>world(westX(z)+offset,y,z);
 const intersect=(a:Point3,b:Point3,p:Point3,q:Point3):Point3=>{
  const dx=b[0]-a[0],dz=b[2]-a[2],ex=q[0]-p[0],ez=q[2]-p[2],cross=dx*ez-dz*ex;
  const t=((p[0]-a[0])*ez-(p[2]-a[2])*ex)/cross;
  return [a[0]+dx*t,a[1],a[2]+dz*t];
 };
 const southRackCorner=(offset:number,y:number):Point3=>{
  const a=local(bay(mx,y,bayTurnZ(offset))),b=local(bay(mx+1,y,bayTurnZ(offset)));
  const p:Point3=[westX(0)+offset,y,0],q:Point3=[westX(1)+offset,y,1];
  const at=intersect(a,b,p,q);return world(at[0],y,at[2]);
 };
 const offsetLine=(a:Point3,b:Point3,offset:number):[Point3,Point3]=>{
  const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),nx=-dz/length*offset,nz=dx/length*offset;
  return [[a[0]+nx,a[1],a[2]+nz],[b[0]+nx,b[1],b[2]+nz]];
 };
 // Two feeds from P04; their exact site labels remain unverified. The entrance
 // crossing is drawn below grade, with illustrative depth explicitly documented.
 const north=add('source-1','WATER_SOURCE','DHMİ yangın hattı 1',world(eastX(24)-.45,0,24),{circuit:'supply-1',enabled:true,tag:'DHMİ-1'});
 const south=add('source-2','WATER_SOURCE','DHMİ · yerden doğrudan giriş',world(23.3,0,southZ(23.3)+.3),{circuit:'supply-2',enabled:true,tag:'DHMİ-2'});
 south.facility!.pipePath=[world(23.3,-.45,southZ(23.3)+.3),world(23.3,.3,southZ(23.3)+.3)].map(p=>worldToLocal(south,p));
 const main1=valve('main-1','DHMİ 1 · Ana vana',eastX(23)-.45,23,'supply-1',north,true);
 // Gate 4 photos: no above-ground isolation valve at the ground inlet.
 const main2=south;
 const gateNozzle=add('gate-fire-connection','FIRE_HOSE_OUTLET','Acil çıkış dışı · çift başlı itfaiye bağlantısı',world(24.15,.3,southZ(24.15)-.48),{circuit:'supply-2',connectionHeads:2,open:false,pipeDiameter:.1016});
 gateNozzle.heading=heading+180;
 route(gateNozzle,south,[world(24.15,.3,southZ(23.3)+.3),world(24.15,.3,southZ(24.15)-.3)]);
 const road1=pipe('main-north','4 inç yangın suyu · kuzey kolu',[world(eastX(22)-.4,.3,22),world(eastX(-1)-.4,.3,-1)],main1,'supply-1');
 const road2=pipe('main-south','4 inç yangın suyu · güney kolu',[world(eastX(-24.5)-.4,.3,-24.5),world(eastX(-2)-.4,.3,-2)],main2,'supply-2');
 route(road2,main2,[world(23.3,-.4,southZ(23.3)+.5),world(eastX(-24.5)-.4,-.4,southZ(23.3)+.5),world(eastX(-24.5)-.4,-.4,-24.5)]);
 const cornerZ=southZ(westX(store[2])+.45)+.5;
 const northCorner:Point3=fence[1]||[-14.4,0,30.65],northEnd:Point3=fence[0]||[11,0,28.16];
 const terminalX=-4,terminalZ=along(northCorner,northEnd,terminalX,0)-.8; // Photo topology; endpoint distance remains a model fit.
 // User arrows, 27 October: DHMI enters at the foam-side end. Low horizontal
 // approach, vertical rise, then the wider header. Never feed via the far low tee.
 const feed=pipe('main-feed','DHMİ · alçak geliş ve kollektöre düşey giriş',[
  world(23.3,.3,southZ(23.3)+.3),bay(mx+.2,.3,bayTurnZ(.3*c)),
  bay(mx+.2,.3,mz+.6),bay(mx+.2,.45,mz+.6)],south,'manifold');
 const pitch=.38; // User-measured valve bay: 2.50 m wide, 2.20 m deep.
 // 150 mm is a visual size assumption, not a measured nominal diameter.
 const headerPoints=[bay(mx+.2,.45,mz+.6),bay(mx+.2,.77,mz+.6),bay(mx-2.08,.77,mz+.6),bay(mx-2.08,.77,mz+.20)];
 const header=pipe('water-header','SU HATTI · Kalın dağıtım kollektörü (çap yaklaşık)',headerPoints,feed,'manifold');
 header.heading=bayHeading;header.facility!.pipePath=headerPoints.map(p=>worldToLocal(header,p));
 header.facility!.pipeDiameter=.15;route(header,feed);
 // Three actual elbows: the header owns the first turn, then B stays parallel
 // to the valves until the outside edge of its own lane, drops vertically and
 // turns along the fence. The 1.3 m lane is a fitted offset, not a survey value.
 // Going farther through the adjacent upper lanes would intersect their pipes.
 const branchX=mx-2.08,branchZ=bayTurnZ(1.3);
 const west=pipe('main-west','B · Monitör ve tank çevre nozulu hattı',[
  bay(branchX,.77,mz+.20),bay(branchX,.77,branchZ),bay(branchX,.3,branchZ),
  southRackCorner(1.3,.3),rack(northCorner[2]-.8,1.3,.3),world(terminalX,.3,terminalZ)],header,'manifold');
 const headerNozzle=add('header-fire-connection','FIRE_HOSE_OUTLET','A · Vana öncesi itfaiye bağlantısı',bay(mx+.2,.77,mz+.6),{circuit:'manifold',connectionHeads:1,open:false,pipeDiameter:.1016});
 headerNozzle.heading=bayHeading+90;headerNozzle.facility!.pipePath=[[0,0,0],[0,0,.52]];route(headerNozzle,header);
 const bank=(key:string,name:string,index:number,circuit:string)=>{
  const x=mx-(index===1?.28:index*pitch),e=valve(key,name,x,mz,circuit,header);e.position=bay(x,.25,mz);e.heading=bayHeading+180;e.length=.65;e.width=.32;if(index>=4&&!previous.has(e.id))e.facility!.open=true;route(e,header,[bay(x,.77,mz+.6)]);return e;
 };
 const foamIsolation=valve('foam-isolation','KÖPÜK · Konsantre vanası',mx+.05,mz-.9,'concentrate',foamSource);
 foamIsolation.scale=.22;foamIsolation.position=bay(mx+.05,.807,mz-1.38);foamIsolation.heading=bayHeading-90;foamIsolation.facility!.pipeDiameter=.035;foamIsolation.color='#aebbbe';
 const foamPort=local(portPosition(foamSource));
 route(foamIsolation,foamSource,[world(foamPort[0],.95,foamPort[2]),world(mx+.38,.95,foamPort[2]),bay(mx+.38,.95,mz-1.38)]);
 const suction=pipe('foam-suction','Köpük konsantresi · emiş kollektörü',[bay(mx-.082,.95,mz-1.38),bay(mx-.14,.95,mz-.56)],foamIsolation,'concentrate',yellow);suction.facility!.pipeDiameter=.035;suction.color='#aebbbe';
 const support=add('pipe-rack','PIPE_RACK','Çit boyunca iki katlı boru mesnetleri',world(0,0,0),{circuit:'manifold'});
 support.facility!.pipePath=[rack(cornerZ,.8,0),rack(distance,.8,0)].map(p=>worldToLocal(support,p));
 const bankRun=(x:number,z:number,y:number,offset:number,exitZ=mz-.26):Point3[]=>{
  // Marked side view: horizontal valve exit, upright drop at the corner,
  // then the low horizontal run. No diagonal elevation-changing span.
  const turnZ=bayTurnZ(offset);
  return [bay(x,.77,exitZ-.12),bay(x,.77,turnZ),...(Math.abs(y-.77)>1e-6?[bay(x,y,turnZ)]:[]),southRackCorner(offset,y),rack(z,offset,y)];
 };
 for(let i=0;i<2;i++){
  const k=i+1,tank=tanks[i],z=i?distance:0,r=tank.radius*tank.scale,H=tank.position[1]-tanks[0].position[1]+tank.height*tank.scale,x=mx-(1-i)*.28;
  const inlet=bank(`foam-${k}-inlet`,`TANK ${k} · Köpük su girişi`,1-i,'foam-'+k);
  const eductor=add(`foam-${k}-mixer`,'FOAM_EDUCTOR',`Tank ${k} · Köpük karıştırıcısı`,bay(x,.25,mz-.56),{inlineMixer:true,circuit:'foam-'+k,ratioUnspecified:true,tag:`KAR-${k}`});
  eductor.length=.6;eductor.width=.26;eductor.scale=.8;eductor.heading=bayHeading+180;if(previous.get(eductor.id)?.facility?.ratio===undefined)delete eductor.facility!.ratio;eductor.color=yellow;route(eductor,inlet);
  // Videos 9 (15–24 s), 10 (0–6 s): metal tee, two separate blue lever valves,
  // threaded unions and an elbow into each mixer. Dimensions are visual fits.
  const small=valve(`foam-${k}-concentrate-valve`,`Tank ${k} · Köpük konsantresi küçük vana`,x,mz-.56,'concentrate',suction,true);
  small.scale=.12;small.length=.65;small.width=.32;small.position=bay(x+(i?-.065:.065),.95-.65*.12,mz-.56);small.heading=bayHeading+(i?-90:90);small.color='#aebbbe';small.facility!.pipeDiameter=.035;
  route(small,suction);route(eductor,small,[bay(x,.95,mz-.56)],true);
  const outletValve=valve(`foam-${k}-outlet-valve`,`TANK ${k} · Köpük hat vanası`,x,mz-1.10,'foam-'+k,eductor,true);outletValve.position=bay(x,.25,mz-1.10);outletValve.heading=bayHeading+180;outletValve.length=.65;outletValve.width=.32;outletValve.color=yellow;
  const foam=add(`foam-${k}-outlet`,'TANK_FOAM_INLET',`Tank ${k} · FC-0${k} köpük odası`,world(0,0,z),{circuit:'foam-'+k,tag:`FC-0${k}`,open:true,pipeDiameter:.1016});
  foam.facility!.pipePath=[world((westX(z)+.5-r-.3)/2,wallHeight+.15,z),world(-r-.3,wallHeight+.15,z),world(-r-.3,H-.6,z),world(-r+.1,H-.6,z)].map(p=>worldToLocal(foam,p));
  route(foam,outletValve,[...bankRun(x,z,i?.3:.77,.5,mz-1.36),rack(z,.5,wallHeight+.15)]);
  const waterValve=bank(`cool-${k}-valve`,`TANK ${k} · Soğutma`,3-i,'cool-'+k);
  const cooling=add(`cool-${k}-outlet`,'TANK_COOLING',`Tank ${k} · Çevresel soğutma hattı`,world(0,0,z),{circuit:'cool-'+k,open:true,pipeDiameter:.1016});
  const ring:Point3[]=[];
  for(let j=0;j<=80;j++){const angle=-.38+j*Math.PI/40,wrapped=Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle))),blend=Math.max(0,Math.min(1,(.40-wrapped)/.15)),rr=r+.18+.74*blend;ring.push(world(-Math.cos(angle)*rr,H+.48,z+Math.sin(angle)*rr));}
  cooling.facility!.ringStartIndex=3;
  cooling.facility!.pipePath=[world((westX(z-1.65)+.7-r-.5)/2,wallHeight,z-1.65),world(-r-.5,wallHeight,z-1.65),world(-r-.5,H+.48,z-1.65),...ring].map(p=>worldToLocal(cooling,p));
  const access=add(`foam-${k}-inspection`,'FOAM_INSPECTION_ACCESS',`Tank ${k} · Köpük camı kontrol sahanlığı ve merdiveni`,world(-r-.52,H-1.25,z),{});
  access.heading=heading+180;access.width=.85;access.length=2.6;access.height=2.3;
  route(cooling,waterValve,[...bankRun(mx-(3-i)*pitch,z-1.65,i?.3:.77,.7),rack(z-1.65,.7,wallHeight)]);
  tank.facility={...tank.facility,coolingManaged:true};
 }
 const gantry=entities.find(e=>e.id==='mtfhc483jg7zz9')||entities.find(e=>e.preset==='CANOPY');
 const notchA=bund[5]||[4.48,0,2.8],notchB=bund[6]||[4.61,0,9.9];
 const receiving=add('receiving-roof','CANOPY','Mal kabul · küçük metal sundurma',world((notchA[0]+notchB[0])/2+1.55,0,(notchA[2]+notchB[2])/2),{circuit:'receiving'});
 receiving.width=2.8;receiving.length=Math.max(3,notchB[2]-notchA[2]-.7);receiving.height=3.9;receiving.color='#b9c2c2';receiving.heading=heading-Math.atan2(notchB[0]-notchA[0],notchB[2]-notchA[2])*180/Math.PI;
 for(const [i,key,name] of [[0,'loading','DOLUM ADASI'],[1,'receiving','MAL KABUL']] as const){
  const roof=i?receiving:gantry;if(!roof)continue;
  const control=bank(`${key}-valve`,`${name} · Sprinkler`,4+i,key);
  const outlet=add(`${key}-outlet`,'SPRINKLER',`${name} · Üst püskürtme hattı`,[...roof.position],{circuit:key,open:true,pipeDiameter:.0762,sprinklerDrop:.65});
  const canopyPoint=(p:Point3)=>localToWorld(roof,p),roofY=roof.height-.25,half=roof.length*.44;
  const near=local(canopyPoint([0,0,-half]))[2]<local(canopyPoint([0,0,half]))[2]?-1:1;
  const columnWorld=i?[-.47,.47].map(x=>canopyPoint([roof.width*x,0,near*roof.length*.47])).sort((a,b)=>local(a)[0]-local(b)[0])[0]:canopyPoint([-.23,0,near*roof.length*.34]);
  const column=worldToLocal(roof,columnWorld),r=local(columnWorld),start=canopyPoint([0,roofY,near*half]),end=canopyPoint([0,roofY,-near*half]);
  if(i){
   // Video 12: under-roof cross turn, longitudinal header, final downward elbow.
   const a=canopyPoint([0,roofY,column[2]-near*.35]);
   outlet.facility!.pipePath=[a,end,canopyPoint([0,roofY-1.25,-near*half])].map(p=>worldToLocal(outlet,p));
   outlet.facility!.sprinklerDrop=1.25;
  }else outlet.facility!.pipePath=[start,end].map(p=>worldToLocal(outlet,p));
  const offset=.9+i*.2,level=.77,wall=wallHeight;
  // Parallel offsets of the surveyed wall, joined at their exact intersections.
  // The west approach extends that same line; no extra kink at the wall end.
  const wallOffset=.18+i*.24,[wallA,wallB]=offsetLine(sw,se,wallOffset),[wallC,wallD]=offsetLine(se,bend,wallOffset);
  const wallStart=intersect(wallA,wallB,[westX(0)+offset,0,0],[westX(1)+offset,0,1]),wallCorner=intersect(wallA,wallB,wallC,wallD);
  const wallEnd:Point3=[along(wallC,wallD,bend[2]-.35,2),wall,bend[2]-.35];
  const approach:Point3[]=[...bankRun(mx-(4+i)*pitch,wallStart[2],level,offset),world(wallStart[0],wall,wallStart[2]),world(wallCorner[0],wall,wallCorner[2]),world(...wallEnd)];
  if(!i){
   // P09–11/13: visible pipe follows the island curb before turning to the centre column.
   // The covered crossing has no surveyed depth: keep the hydraulic edge but omit its unseen span.
   const curb=canopyPoint([-roof.width*.19,.13,0]);
   approach.push(world(wallEnd[0],.13,wallEnd[2]));
   outlet.facility!.unverifiedSupplySpan=approach.length; // index in complete source + route + target path
   approach.push(curb,canopyPoint([-roof.width*.19,.13,column[2]]),canopyPoint([column[0],.13,column[2]]));
   const drain=add('loading-drain','DRAIN','Dolum adası · ızgaralı geçiş (konumu yaklaşık)',world(wallEnd[0],0,wallEnd[2]));
   drain.width=.45;drain.height=.05;drain.points=[world(wallEnd[0],0,wallEnd[2]),[curb[0],0,curb[2]] as Point3].map(p=>{const q=worldToLocal(drain,p);return [q[0],q[2]];});
  }else{
   // P11–12: wall-top run turns across the notch, then rises outside the small roof's column.
   approach.push(world(along(wallC,wallD,notchA[2]+.15,2),wall,notchA[2]+.15),world(r[0],wall,notchA[2]+.15),world(r[0],wall,r[2]));
  }
  approach.push(canopyPoint([column[0],roofY,column[2]]));
  if(i)approach.push(canopyPoint([0,roofY,column[2]]));else approach.push(start);
  route(outlet,control,approach);
 }
 for(let i=0;i<MONITOR_IDS.length;i++){
  const monitor=byId.get(MONITOR_IDS[i]);if(!monitor||monitor.facility?.supplyId&&!monitor.facility.supplyId.startsWith('adb-fire-'))continue;
  const pos=local(monitor.position),source=i<2?road1:i===2?road2:west,edge=i<3?eastX(pos[2])-.4:westX(pos[2])+.35,cx=pos[0]+(i<3?.45:-.45);
  const control=valve(`monitor-${i+1}-valve`,`MONİTÖR ${i+1} · Su vanası`,cx,pos[2]-.35,`monitor-${i+1}`,source,true);control.scale=.6;control.position[1]=.03;
  route(control,source,[world(edge,.3,pos[2]-.65),world(cx,.3,pos[2]-.65)]);
  monitor.facility={...monitor.facility,reference:FIRE_REFERENCE,referenceRevision:FIRE_LAYOUT_REVISION,circuit:`monitor-${i+1}`,tag:monitor.facility?.tag||`MON-${i+1}`};
  route(monitor,control,[world(cx,.3,pos[2]-.2)]);
  const drum=entities.filter(e=>e.preset==='FOAM_DRUM').map(e=>({e,d:Math.hypot(e.position[0]-monitor.position[0],e.position[2]-monitor.position[2])})).filter(a=>a.d<2).sort((a,b)=>a.d-b.d)[0]?.e;
  if(drum&&!monitor.facility.concentrateId){const p=localToWorld(drum,[0,drum.height+.05,0]),q=portPosition(monitor,'foam');route(monitor,drum,[p,[(p[0]+q[0])/2,.45,(p[2]+q[2])/2]],true);monitor.facility.ratioUnspecified=true;}
 }
 // P06–08 show one terminal riser beside a cabinet, after the fence corner.
 // Do not retain two invented intermediate outlets as field-confirmed equipment.
 const hose=add('hose-1','FIRE_HOSE_OUTLET','Çevre hattı sonu · kapaklı hortum bağlantısı (konumu yaklaşık)',world(terminalX+.4,0,terminalZ),{circuit:'manifold',open:false,tag:'YH-01',valveStyle:'lever',pipeDiameter:.1016});
 hose.heading=heading+90;route(hose,west);
 const cabinet=add('terminal-cabinet','HOSE_CABINET','Çevre hattı sonu · Yangın dolabı',world(terminalX+.65,0,terminalZ+.35));cabinet.heading=heading+180;
 // Removed defaults must never delete an operator-edited entity or break an edited route's source.
 for(const [id,old] of previous)if(!byId.has(id)&&old.facility?.routeEdited){added.push(structuredClone(old));byId.set(id,added.at(-1)!);}
 for(const e of added){const old=previous.get(e.id);if(old?.facility?.routeEdited){Object.assign(e,structuredClone(old));e.facility!.referenceRevision=FIRE_LAYOUT_REVISION;}}
 scene.entities=[...entities,...added];
 const name='SOCAR · Yangın suyu / köpük hatları · Fotoğraf eşleştirmesi';if(marker)marker.name=name;else scene.groups.push({id:FIRE_GROUP,name});
 return true;
}





