import {inspectionLayout} from './inspection-layout';
import type {Entity, Kind} from './scene-data';
import {tankStairLayout} from './tank-stairs';

export type FacilityCategory='fire'|'pipes'|'access'|'site'|'markings';
export type BridgeAnchor={parentId?:string;point:[number,number,number]};
export type TankOpening={angle:number;halfAngle:number;corridor?:{start:[number,number,number];end:[number,number,number];width:number};circle?:{center:[number,number,number];radius:number}};
export type FacilitySettings={
  reference?:string;referenceRevision?:number;routeEdited?:boolean;bendRadius?:number;valveStyle?:'lever';inlineMixer?:boolean;sprinklerDrop?:number;circuit?:string;ratioUnspecified?:boolean;coolingManaged?:boolean;
  supplyRoute?:[number,number,number][];concentrateRoute?:[number,number,number][];pipePath?:[number,number,number][];
  supplyTap?:[number,number,number];concentrateTap?:[number,number,number];
  removedSupports?:string[];supportStyle?:'post'|'rack';monitorBottomInlet?:boolean;trenchDepth?:number;trenchGrate?:boolean;trenchTop?:number;pipeDiameter?:number;unverifiedSupplySpan?:number;connectionHeads?:number;ringStartIndex?:number;
  closed?:boolean;fillBoundaryId?:string;fillPairId?:string;fillCut?:[[number,number],[number,number]];fillSide?:1|-1;stairFloor?:number;
  windowFront?:boolean;windowBack?:boolean;windowLeft?:boolean;windowRight?:boolean;
  containment?:boolean;eyeOpen?:boolean;showerOpen?:boolean;
  label?:string;textColor?:string;lineWidth?:number;pattern?:'solid'|'dash'|'footprints';
  open?:boolean;enabled?:boolean;supplyId?:string;concentrateId?:string;ratio?:number;
  capacity?:number;volume?:number;flowLpm?:number;tag?:string;
  sweep?:number;stairStart?:number;stairWidth?:number;clockwise?:boolean;stairs?:boolean;
  stairSweep?:number;stairLandings?:boolean;stairLandingLength?:number;stairBase?:[number,number,number];stairExit?:[number,number,number];
  logoEnabled?:boolean;logoData?:string;logoWidth?:number;logoHeight?:number;logoElevation?:number;logoAngle?:number;
  tankA?:string;tankB?:string;bridgeRise?:number;
  bridgeStart?:BridgeAnchor;bridgeEnd?:BridgeAnchor;
  mount?:{parentId:string;point:[number,number,number];normal:[number,number,number]};
  stopTargets?:string[];
};
type Spec={tr:string;en:string;kind:Kind;width:number;length:number;height:number;color:string;category:FacilityCategory;draw?:'line'|'area';network?:boolean;mountable?:boolean;settings?:FacilitySettings};
const spec=(tr:string,en:string,category:FacilityCategory,width:number,length:number,height:number,color='#e3e7e5',extra:Partial<Spec>={}):Spec=>({tr,en,category,width,length,height,color,kind:'structure',...extra});
export const FACILITY_CATALOG:Record<string,Spec>={
  ADB_LOADING_ISLAND:spec('Dolum adası N2 · SOCAR kanopi','Loading island N2 · SOCAR canopy','site',6,10,4,'#ffffff'),
  ADB_RECEIVING_ISLAND:spec('Mal kabul adası · sundurma','Receiving island · canopy','site',2.4,9.35,5,'#b9c2c2'),
  FUEL_PUMP:spec('Jet A-1 · motor pompa','Jet A-1 · motor pump','site',.65,1.4,.85,'#28734b'),
  FUEL_FILTER:spec('Jet A-1 · filtre separatör','Jet A-1 · filter separator','site',.8,1.35,1.8,'#e5e6dc'),
  FUEL_METER:spec('Jet A-1 · sayaç ve kumanda','Jet A-1 · meter and control','site',.55,.75,1.4,'#e5e6dc'),
  FUEL_HOSE:spec('Jet A-1 · hortum ve kaplin','Jet A-1 · hose and coupling','site',.7,1.5,1.2,'#242a2c'),
  FUEL_PIPE:spec('Jet A-1 · bağlantı borusu','Jet A-1 · connecting pipe','pipes',.1,1,.65,'#e5e6dc'),
  FOAM_INSPECTION_ACCESS:spec('Tank köpük merdiveni','Tank foam inspection stairs','access',.95,3.65,1.52,'#e3e7e5'),
  FIRE_HOSE_OUTLET:spec('Vanali yangın hortumu bağlantısı','Valved fire hose connection','fire',.55,.8,1.2,'#bd2927',{network:true,settings:{open:false,valveStyle:'lever'}}),
  FIRE_MONITOR:spec('Yangın monitörü','Fire monitor','fire',1.1,1.8,1.65,'#bd2927',{network:true,settings:{open:false}}),
  MONITOR_SHIELD:spec('Yay biçimli monitör duvarı','Curved monitor shield','fire',3.5,3.5,1.5,'#b72b29',{settings:{sweep:230}}),
  FOAM_DRUM:spec('Köpük bidonu · 200 L','Foam drum · 200 L','fire',.62,.62,.95,'#c12c28',{network:true,settings:{capacity:200,volume:200}}),
  FOAM_TANK:spec('Köpük tankı · 1.000 L','Foam tank · 1,000 L','fire',1.1,1.5,1.65,'#aebdbd',{network:true,settings:{capacity:1000,volume:1000,tag:'KPT01'}}),
  HOSE_CABINET:spec('Ayaklı yangın dolabı','Freestanding hose cabinet','fire',1.1,.48,1.65,'#bc302c'),
  WALL_HOSE_CABINET:spec('Duvar tipi yangın dolabı','Wall hose cabinet','fire',.8,.25,.9,'#bc302c',{mountable:true}),
  EXTINGUISHER_WALL:spec('Duvara takılan yangın tüpü','Wall extinguisher','fire',.25,.25,.75,'#cf3128',{mountable:true}),
  EXTINGUISHER_TROLLEY:spec('Tekerlekli yangın tüpü','Wheeled extinguisher','fire',.72,.85,1.25,'#bf2b25'),
  HYDRANT_POINT:spec('Hidrant / itfaiye bağlantısı','Hydrant / fire brigade connection','fire',.65,.65,1,'#b92b2b',{network:true,settings:{open:false}}),
  FIRE_ALARM:spec('Yangın alarm butonu','Fire alarm call point','fire',.18,.09,.22,'#c32e2b',{mountable:true,settings:{label:'YANGIN / FIRE',tag:'FA'}}),
  EMERGENCY_STOP:spec('Acil durdurma butonu','Emergency stop','fire',.2,.12,.22,'#f4cd31',{mountable:true,settings:{label:'ACİL STOP'}}),
  ALARM_BEACON:spec('İkaz lambası / siren','Warning beacon / sounder','fire',.22,.22,.4,'#ffad22',{mountable:true}),
  WATER_SOURCE:spec('Su besleme bağlantısı','Water supply connection','pipes',.6,1.2,1,'#b92c2b',{network:true,settings:{enabled:true}}),
  PIPE_SUPPORT:spec('Tek boru traversi · 90 cm','Single pipe support · 90 cm','pipes',.9,.2,1.22,'#dfe4df',{settings:{supportStyle:'rack'}}),
  PIPE_RACK:spec('İki katlı boru mesnedi','Two-level pipe rack','pipes',1.5,3,1.25,'#dfe4df',{draw:'line'}),
  PIPE_RED:spec('Kırmızı boru çiz','Draw red pipe','pipes',.12,3,.65,'#b72b29',{draw:'line',network:true}),
  PIPE_YELLOW:spec('Sarı boru çiz','Draw yellow pipe','pipes',.12,3,.65,'#e8c93d',{draw:'line',network:true}),
  PIPE_TEE:spec('T bağlantı / su kollektörü','T branch / water manifold','pipes',1.2,1.2,.65,'#b72b29',{network:true}),
  PIPE_ELBOW:spec('90° boru dirseği','90° pipe elbow','pipes',.6,.6,.65,'#b72b29',{network:true}),
  PIPE_VALVE:spec('Etiketli hat vanası','Tagged line valve','pipes',.45,.65,.95,'#b72b29',{network:true,settings:{open:true,tag:'FV'}}),
  FOAM_EDUCTOR:spec('Köpük emiş karıştırıcısı','Foam eductor','pipes',.55,1.2,.85,'#e6cb3d',{network:true,settings:{ratio:3}}),
  TANK_COOLING:spec('Tank soğutma çıkışı','Tank cooling outlet','pipes',1.2,1.2,.5,'#ba322d',{network:true,settings:{open:true}}),
  TANK_FOAM_INLET:spec('Tank köpük odası / girişi','Tank foam chamber / inlet','pipes',.45,.65,.8,'#e8c93d',{network:true,settings:{open:true}}),
  SPRINKLER:spec('Sprinkler / püskürtme çıkışı','Sprinkler / discharge outlet','pipes',.3,.3,.35,'#b72b29',{network:true,settings:{open:false}}),
  PRESSURE_GAUGE:spec('Manometreli boru','Pipe with pressure gauge','pipes',.35,.8,.9,'#b72b29',{network:true}),
  TANK_STAIR:spec('Sahanlıklı tank merdiveni','Tank stairs with landings','access',.9,1.2,11,'#dde5df'),
  TANK_BRIDGE:spec('İki tank arası köprü','Bridge between tanks','access',1.05,4,.18,'#b9c5c6'),
  CROSSOVER_STAIR:spec('Havuz duvarı geçiş merdiveni','Containment wall crossover','access',1.05,5,1.8,'#dce142'),
  MOBILE_STAIR:spec('Tekerlekli platform merdiveni','Mobile platform stairs','access',1,2.5,1.5,'#b2bec3'),
  PEDESTRIAN_GATE:spec('Panik barlı yaya kapısı','Pedestrian gate with panic bar','access',1.1,.1,2.1,'#e4e5df',{settings:{open:false}}),
  GUARD_CABIN:spec('Bekçi mobosu','Guard cabin','site',2.4,3,2.6),
  DRIVER_WC:spec('Şoför WC','Driver WC','site',1.6,2,2.5,'#e3e7e5',{settings:{label:'ŞOFÖR WC'}}),
  WASTE_SHELTER:spec('Tehlikeli atık sahası','Hazardous waste shelter','site',3.5,4,2.5,'#e1e4db',{settings:{label:'TEHLİKELİ ATIK'}}),
  SMOKING_AREA:spec('Sigara içme alanı','Smoking shelter','site',3,3,2.6,'#e3e7e5',{settings:{label:'SİGARA İÇME ALANI'}}),
  FOAM_SHELTER:spec('Köpük tankı kulübesi','Foam tank shelter','fire',3.2,2.6,2.7,'#e3e7e5',{settings:{label:'KÖPÜK TANKLARI'}}),
  DIESEL_UNIT:spec('Motorin tankı ve dispenser','Diesel tank and dispenser','site',2.1,3.8,2.6,'#e6e8e3',{settings:{label:'MOTORİN',containment:true}}),
  BOLLARD:spec('Sabit duba','Fixed bollard','site',.15,.15,1,'#e78334'),
  TRAFFIC_CONE:spec('Trafik konisi','Traffic cone','site',.5,.5,.75,'#ee8130'),
  CHAIN_POSTS:spec('Zincirli yaya ayrımı','Posts with pedestrian chain','site',.15,3,1,'#e78334'),
  IMPACT_BARRIER:spec('Sarı siyah koruma bariyeri','Yellow black impact barrier','site',.15,2.3,.85,'#e5de40'),
  CURB:spec('Sarı beyaz bordür çiz','Draw yellow white curb','site',.22,3,.2,'#ded13d',{draw:'line'}),
  CONCRETE_FILL:spec('Beton zemin dolgusu','Concrete ground fill','site',5,5,.2,'#bcbdb7',{kind:'ground',draw:'area'}),
  GRASS_FILL:spec('Çimen zemin dolgusu','Grass ground fill','site',5,5,.2,'#4c793b',{kind:'ground',draw:'area'}),
  DRAIN:spec('Izgaralı kanal çiz','Draw grated drain','site',.45,3,.06,'#555f60',{draw:'line'}),
  MANHOLE:spec('Yeşil rögar kapağı','Green manhole cover','site',.8,.8,.08,'#49854c'),
  SPILL_KIT:spec('Döküntü müdahale seti','Spill response bin','site',.6,.6,1,'#d04c43',{settings:{label:'SPILL KIT'}}),
  SAFETY_SHOWER:spec('Göz ve vücut duşu','Eyewash and safety shower','site',.75,.9,2.25,'#26774b',{network:true,settings:{eyeOpen:false,showerOpen:false}}),
  BOTTLE_EYEWASH:spec('Şişeli göz yıkama','Bottled eyewash station','site',.4,.14,.42,'#368552',{mountable:true}),
  SURFACE_SIGN:spec('Yüzeye takılan levha','Surface mounted sign','markings',1,.035,.6,'#247845',{mountable:true,settings:{label:'ACİL TOPLANMA YERİ',textColor:'#ffffff'}}),
  GROUND_TEXT:spec('Zemin yazısı','Ground text','markings',3,1,.02,'#ffffff',{settings:{label:'DUR',textColor:'#ffffff'}}),
  GROUND_ARROW:spec('Zemin yön oku','Ground direction arrow','markings',.75,2,.02,'#e9cb36'),
  ASSEMBLY_MARK:spec('Acil toplanma zemin işareti','Assembly point marking','markings',3.5,3.5,.02,'#258451',{settings:{label:'ACİL TOPLANMA NOKTASI'}}),
  GROUND_LINE:spec('Zemin çizgisi çiz','Draw ground line','markings',.12,3,.02,'#eccd36',{draw:'line',settings:{lineWidth:.12,pattern:'solid'}}),
  FOOTPRINTS:spec('Ayak izli güzergâh çiz','Draw footprint route','markings',.7,3,.02,'#eccd36',{draw:'line',settings:{pattern:'footprints'}}),
  WALKWAY:spec('Yeşil yürüme yolu alanı','Green walkway area','markings',3,3,.02,'#33865b',{kind:'ground',draw:'area',settings:{lineWidth:.1}}),
  HATCH_AREA:spec('Taralı yasak alan','Hatched exclusion area','markings',3,3,.02,'#e0bb36',{kind:'ground',draw:'area',settings:{lineWidth:.15}})
};
export const isNetwork=(o:Entity)=>!!FACILITY_CATALOG[o.preset]?.network;
export const isOutlet=(o:Entity)=>['FIRE_HOSE_OUTLET','FIRE_MONITOR','HYDRANT_POINT','TANK_COOLING','TANK_FOAM_INLET','SPRINKLER','SAFETY_SHOWER'].includes(o.preset);
export const isFoamStore=(o:Entity)=>['FOAM_DRUM','FOAM_TANK'].includes(o.preset);
export function facilityDefaults(preset:string):FacilitySettings|undefined {const c=FACILITY_CATALOG[preset];return c?{...c.settings}:undefined;}
export function validateFacility(raw:unknown):FacilitySettings|undefined{
  if(!raw||typeof raw!=='object')return undefined;const v=raw as Record<string,any>,o:FacilitySettings={};
  if(Number.isInteger(v.unverifiedSupplySpan)&&v.unverifiedSupplySpan>=0&&v.unverifiedSupplySpan<257)o.unverifiedSupplySpan=v.unverifiedSupplySpan;
  if(Number.isInteger(v.referenceRevision)&&v.referenceRevision>0)o.referenceRevision=Math.min(100,v.referenceRevision);
  if(Array.isArray(v.removedSupports))o.removedSupports=[...new Set(v.removedSupports.filter((x:unknown)=>typeof x==='string'&&x.length<160))].slice(0,2000) as string[];
  if(v.supportStyle==='post'||v.supportStyle==='rack')o.supportStyle=v.supportStyle;
  if(typeof v.trenchTop==='number'&&Number.isFinite(v.trenchTop))o.trenchTop=Math.max(.1,Math.min(1,v.trenchTop));
  if(typeof v.trenchDepth==='number'&&Number.isFinite(v.trenchDepth))o.trenchDepth=Math.max(.15,Math.min(3,v.trenchDepth));
  if(typeof v.sprinklerDrop==='number'&&Number.isFinite(v.sprinklerDrop))o.sprinklerDrop=Math.max(.1,Math.min(2,v.sprinklerDrop));
  for(const k of ['connectionHeads','ringStartIndex'] as const)if(typeof v[k]==='number'&&Number.isInteger(v[k])&&v[k]>=0&&v[k]<=256)o[k]=v[k];
  for(const k of ['reference','circuit'] as const)if(typeof v[k]==='string')o[k]=v[k].slice(0,100);
  if(v.valveStyle==='lever')o.valveStyle='lever';
  if(typeof v.bendRadius==='number'&&Number.isFinite(v.bendRadius))o.bendRadius=Math.max(.02,Math.min(3,v.bendRadius));
  for(const k of ['monitorBottomInlet','trenchGrate','routeEdited','inlineMixer','ratioUnspecified','coolingManaged'] as const)if(typeof v[k]==='boolean')o[k]=v[k];
  for(const k of ['supplyRoute','concentrateRoute','pipePath'] as const)if(Array.isArray(v[k])&&v[k].length<=256&&v[k].every((p:unknown)=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<50000)))o[k]=v[k].map((p:number[])=>[p[0],p[1],p[2]]);
  for(const k of ['supplyTap','concentrateTap'] as const)if(Array.isArray(v[k])&&v[k].length===3&&v[k].every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<50000))o[k]=[...v[k]] as [number,number,number];
  if(typeof v.pipeDiameter==='number'&&Number.isFinite(v.pipeDiameter))o.pipeDiameter=Math.max(.01,Math.min(2,v.pipeDiameter));
  for(const k of ['label','tag','supplyId','concentrateId','tankA','tankB','fillBoundaryId','fillPairId'] as const)if(typeof v[k]==='string')o[k]=v[k].slice(0,k==='label'?300:180);
  if(typeof v.stairFloor==='number'&&Number.isFinite(v.stairFloor))o.stairFloor=Math.max(0,Math.min(100,v.stairFloor));
  if(typeof v.closed==='boolean')o.closed=v.closed;
  if(v.fillSide===1||v.fillSide===-1)o.fillSide=v.fillSide;
  if(Array.isArray(v.fillCut)&&v.fillCut.length===2&&v.fillCut.every((p:unknown)=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<50000)))o.fillCut=v.fillCut.map((p:number[])=>[p[0],p[1]]) as [[number,number],[number,number]];
  if(/^#[a-f\d]{6}$/i.test(v.textColor||''))o.textColor=v.textColor;
  for(const k of ['stairLandings','logoEnabled','open','enabled','clockwise','stairs','windowFront','windowBack','windowLeft','windowRight','containment','eyeOpen','showerOpen'] as const)if(typeof v[k]==='boolean')o[k]=v[k];
  for(const [k,min,max] of [['stairSweep',1,1080],['stairLandingLength',.8,3],['logoWidth',.2,40],['logoHeight',.2,20],['logoElevation',.2,100],['logoAngle',-360,360],['lineWidth',.02,2],['ratio',0,6],['capacity',0,100000],['volume',0,100000],['flowLpm',0,5000],['sweep',30,330],['stairStart',-360,360],['stairWidth',.6,2],['bridgeRise',-100,100]] as const)if(typeof v[k]==='number'&&Number.isFinite(v[k]))o[k]=Math.max(min,Math.min(max,v[k]));
  if(typeof v.logoData==='string'&&v.logoData.length<2000000&&/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v.logoData))o.logoData=v.logoData;
  for(const k of ['stairBase','stairExit'] as const)if(Array.isArray(v[k])&&v[k].length===3&&v[k].every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<50000))o[k]=[...v[k]] as [number,number,number];
  if(['solid','dash','footprints'].includes(v.pattern))o.pattern=v.pattern;
  if(Array.isArray(v.stopTargets))o.stopTargets=v.stopTargets.filter((s:unknown)=>typeof s==='string').slice(0,30).map((s:string)=>s.slice(0,180));
  for(const k of ['bridgeStart','bridgeEnd'] as const){const a=v[k];if(a&&Array.isArray(a.point)&&a.point.length===3&&a.point.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<50000))o[k]={point:[...a.point] as [number,number,number],...(typeof a.parentId==='string'&&a.parentId?{parentId:a.parentId.slice(0,180)}:{})};}
  const m=v.mount;if(m&&typeof m.parentId==='string'&&[m.point,m.normal].every(a=>Array.isArray(a)&&a.length===3&&a.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<50000)))o.mount={parentId:m.parentId.slice(0,180),point:[m.point[0],m.point[1],m.point[2]],normal:[m.normal[0],m.normal[1],m.normal[2]]};
  if(o.capacity!==undefined&&o.volume!==undefined)o.volume=Math.min(o.capacity,o.volume);
  return o;
}
export function localToWorld(o:Entity,p:[number,number,number]):[number,number,number]{const a=-o.heading*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [o.position[0]+(c*p[0]+s*p[2])*o.scale,o.position[1]+p[1]*o.scale,o.position[2]+(-s*p[0]+c*p[2])*o.scale];}
export function worldToLocal(o:Entity,p:[number,number,number]):[number,number,number]{const a=o.heading*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=(p[0]-o.position[0])/o.scale,z=(p[2]-o.position[2])/o.scale;return [c*x+s*z,(p[1]-o.position[1])/o.scale,-s*x+c*z];}
export function bridgeAnchorWorld(anchor:BridgeAnchor,entities:Entity[]):[number,number,number]|undefined{
  if(!anchor.parentId)return [...anchor.point];
  const parent=entities.find(o=>o.id===anchor.parentId);if(!parent)return;
  const p:[number,number,number]=[...anchor.point];
  if(parent.kind==='tank'){p[1]=parent.height+.28;const r=Math.hypot(p[0],p[2]),limit=Math.max(.05,parent.radius-.04);if(r>limit){p[0]*=limit/r;p[2]*=limit/r;}}
  return localToWorld(parent,p);
}
/** Explicit roof clicks take precedence; older tank-pair bridges retain automatic attachment. */
export function bridgeSpan(o:Entity,entities:Entity[]):{start:[number,number,number];end:[number,number,number]}|undefined{
  const f=o.facility;if(o.preset!=='TANK_BRIDGE'||!f)return;
  if(f.bridgeStart&&f.bridgeEnd){const start=bridgeAnchorWorld(f.bridgeStart,entities),end=bridgeAnchorWorld(f.bridgeEnd,entities);return start&&end?{start,end}:undefined;}
  const a=entities.find(e=>e.id===f.tankA),b=entities.find(e=>e.id===f.tankB);if(a?.kind!=='tank'||b?.kind!=='tank'||a===b)return;
  const dx=b.position[0]-a.position[0],dz=b.position[2]-a.position[2],d=Math.hypot(dx,dz);
  if(d<=(a.radius*a.scale+b.radius*b.scale+.4))return;
  // Both ends overlap the roof, so there is no unsupported gap at the handrail.
  const ra=Math.max(.05,a.radius-.28)*a.scale,rb=Math.max(.05,b.radius-.28)*b.scale;
  return {start:[a.position[0]+dx/d*ra,a.position[1]+(a.height+.28)*a.scale,a.position[2]+dz/d*ra],end:[b.position[0]-dx/d*rb,b.position[1]+(b.height+.28)*b.scale,b.position[2]-dz/d*rb]};
}
/** Rotate the complete span about its centre while retaining roof-local attachments. */
export function rotateTankBridge(o:Entity,entities:Entity[],deltaDegrees:number):boolean{
  if(o.preset!=='TANK_BRIDGE'||!Number.isFinite(deltaDegrees))return false;
  const span=bridgeSpan(o,entities);
  if(!span){o.heading+=deltaDegrees;return true;}
  const f=o.facility||{},angle=deltaDegrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),cx=(span.start[0]+span.end[0])/2,cz=(span.start[2]+span.end[2])/2;
  const anchor=(point:[number,number,number],parentId?:string):BridgeAnchor|undefined=>{
    const x=point[0]-cx,z=point[2]-cz,world:[number,number,number]=[cx+c*x-s*z,point[1],cz+s*x+c*z];
    if(!parentId)return {point:world};const parent=entities.find(e=>e.id===parentId);if(!parent)return;
    const local=worldToLocal(parent,world);if(parent.kind==='tank'&&Math.hypot(local[0],local[2])>Math.max(.05,parent.radius-.04)+1e-8)return;
    return {parentId,point:local};
  };
  const start=anchor(span.start,f.bridgeStart?f.bridgeStart.parentId:f.tankA),end=anchor(span.end,f.bridgeEnd?f.bridgeEnd.parentId:f.tankB);
  if(!start||!end)return false;
  o.facility={...f,bridgeStart:start,bridgeEnd:end};updateFacilityAttachments(entities);return true;
}
export function bridgeRailingOpenings(tank:Entity,entities:Entity[]):TankOpening[]{
  const openings:TankOpening[]=[],r=Math.max(.05,tank.radius-.1);
  for(const bridge of entities){const f=bridge.facility;if(!f||![f.tankA,f.tankB,f.bridgeStart?.parentId,f.bridgeEnd?.parentId].includes(tank.id))continue;
    const span=bridgeSpan(bridge,entities);if(!span)continue;
    const a=worldToLocal(tank,span.start),b=worldToLocal(tank,span.end),dx=b[0]-a[0],dz=b[2]-a[2],aa=dx*dx+dz*dz,bb=2*(a[0]*dx+a[2]*dz),cc=a[0]*a[0]+a[2]*a[2]-r*r,disc=bb*bb-4*aa*cc;
    if(aa<.001||disc<0)continue;
    for(const t of [(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)])if(t>=0&&t<=1){const x=a[0]+t*dx,z=a[2]+t*dz,normal=Math.max(.15,Math.abs((x*dx+z*dz)/(r*Math.sqrt(aa)))),half=(bridge.width*.5+.12)/tank.scale;openings.push({angle:Math.atan2(x,z),halfAngle:Math.asin(Math.min(.95,half/(r*normal))),corridor:{start:a,end:b,width:bridge.width/tank.scale}});}
  }
  for(const access of entities)if(access.preset==='FOAM_INSPECTION_ACCESS'&&access.facility?.tankA===tank.id&&access.facility.tag==='PHOTO-STAIR-31'){const layout=inspectionLayout(access),p=worldToLocal(tank,localToWorld(access,layout.roofEntry));openings.push({angle:Math.atan2(p[0],p[2]),halfAngle:(layout.landing/2+.06)/(layout.R)});}
  return openings;
}
/** Reciprocal openings on the bridge itself, derived from the current linked tank stairs. */
export function bridgeAccessOpenings(bridge:Entity,entities:Entity[]):TankOpening[]{
  const f=bridge.facility;if(bridge.preset!=='TANK_BRIDGE'||!f)return [];
  const ids=new Set([f.tankA,f.tankB,f.bridgeStart?.parentId,f.bridgeEnd?.parentId]),openings:TankOpening[]=[];
  for(const tank of entities){if(tank.kind!=='tank'||!ids.has(tank.id))continue;
    const layout=tankStairLayout(tank),landing=layout.roofLanding;
    const inBridge=(p:[number,number,number])=>worldToLocal(bridge,localToWorld(tank,p));
    openings.push({angle:0,halfAngle:0,circle:{center:inBridge([0,layout.height,0]),radius:(tank.radius-.1)*tank.scale/bridge.scale}});
    if(tank.facility?.stairs===false)continue;
    const a=landing.angle,s=Math.sin(a),c=Math.cos(a),rad=(landing.inner+landing.outer)/2;
    const point=(t:number):[number,number,number]=>[s*rad+c*t,layout.height,c*rad-s*t];
    openings.push({angle:0,halfAngle:0,corridor:{start:inBridge(point(-layout.sign*(landing.depth/2+.45))),end:inBridge(point(0)),width:(landing.outer-landing.inner-.05)*tank.scale/bridge.scale}});
  }
  return openings;
}
export function portPosition(o:Entity,port:'in'|'out'|'foam'='out'):[number,number,number]{
  if(o.facility?.connectionHeads)return localToWorld(o,port==='in'?[0,0,0]:[0,0,.42]);
  if(o.preset==='FIRE_HOSE_OUTLET')return localToWorld(o,port==='in'?[0,.3,-.4]:[0,1.05,.35]);
  if(port==='foam'&&o.facility?.inlineMixer)return localToWorld(o,[0,.82,0]);
  if(port==='in'&&o.preset==='FIRE_MONITOR'&&o.facility?.monitorBottomInlet)return localToWorld(o,[0,.9,0]);
  if(port==='foam'&&o.preset==='FIRE_MONITOR')return localToWorld(o,o.facility?.monitorBottomInlet?[.04,1.63,.35]:[.08,1.15,.43]);
  if(o.facility?.pipePath?.length){const path=o.facility.pipePath;return localToWorld(o,path[port==='in'?0:path.length-1]);}
  if(o.preset==='SAFETY_SHOWER')return localToWorld(o,[0,.22,-.12]);
  if(o.points?.length){const p=o.points[port==='in'?0:o.points.length-1];return localToWorld(o,[p[0],o.height,p[1]]);}
  const y=isFoamStore(o)?.2:.65;return localToWorld(o,port==='foam'?[.36,.72,0]:[0,y,(port==='in'?-1:1)*o.length/2]);
}
/** Only explicit parent/bridge references move linked objects. Existing scene transforms stay intact. */
export function updateFacilityAttachments(entities:Entity[]){
  const map=new Map(entities.map(o=>[o.id,o]));const done=new Set<string>(),visiting=new Set<string>();
  const update=(o:Entity)=>{if(done.has(o.id)||visiting.has(o.id))return;visiting.add(o.id);const f=o.facility,m=f?.mount,parent=m&&map.get(m.parentId);
    if(m&&parent&&parent!==o&&!visiting.has(parent.id)){update(parent);o.position=localToWorld(parent,m.point);o.heading=parent.heading-Math.atan2(m.normal[0],m.normal[2])*180/Math.PI;}
    if(o.preset==='TANK_BRIDGE'&&f){const span=bridgeSpan(o,entities);if(span){const a=span.start,b=span.end,dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);if(length>.05){o.position=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];o.heading=-Math.atan2(dx,dz)*180/Math.PI;o.length=length;o.scale=1;f.bridgeRise=b[1]-a[1];}}}
    visiting.delete(o.id);done.add(o.id);
  };entities.forEach(update);
}
export function remapFacilityReferences(copies:Entity[],mapping:Map<string,string> ){const pairs=new Map<string,string>();for(const o of copies){const f=o.facility;if(!f)continue;if(f.fillBoundaryId){const parent=mapping.get(f.fillBoundaryId);if(parent)f.fillBoundaryId=parent;else delete f.fillBoundaryId;}if(f.fillPairId){const old=f.fillPairId;let next=mapping.get(old)||pairs.get(old);if(!next){next=crypto.randomUUID();pairs.set(old,next);}f.fillPairId=next;}for(const k of ['supplyId','concentrateId','tankA','tankB'] as const)if(f[k]&&mapping.has(f[k]!))f[k]=mapping.get(f[k]!);for(const a of [f.bridgeStart,f.bridgeEnd])if(a?.parentId&&mapping.has(a.parentId))a.parentId=mapping.get(a.parentId);if(f.mount){if(mapping.has(f.mount.parentId))f.mount.parentId=mapping.get(f.mount.parentId)!;else delete f.mount;}if(f.stopTargets)f.stopTargets=f.stopTargets.map(id=>mapping.get(id)||id);}}







