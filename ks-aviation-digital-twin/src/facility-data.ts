import type {Entity, Kind} from './scene-data';

export type FacilityCategory='fire'|'pipes'|'access'|'site'|'markings';
export type FacilitySettings={
  label?:string;textColor?:string;lineWidth?:number;pattern?:'solid'|'dash'|'footprints';
  open?:boolean;enabled?:boolean;supplyId?:string;concentrateId?:string;ratio?:number;
  capacity?:number;volume?:number;flowLpm?:number;tag?:string;
  sweep?:number;stairStart?:number;stairWidth?:number;clockwise?:boolean;stairs?:boolean;
  tankA?:string;tankB?:string;bridgeRise?:number;
  mount?:{parentId:string;point:[number,number,number];normal:[number,number,number]};
  stopTargets?:string[];
};
type Spec={tr:string;en:string;kind:Kind;width:number;length:number;height:number;color:string;category:FacilityCategory;draw?:'line'|'area';network?:boolean;mountable?:boolean;settings?:FacilitySettings};
const spec=(tr:string,en:string,category:FacilityCategory,width:number,length:number,height:number,color='#e3e7e5',extra:Partial<Spec>={}):Spec=>({tr,en,category,width,length,height,color,kind:'structure',...extra});
export const FACILITY_CATALOG:Record<string,Spec>={
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
  PIPE_RED:spec('Kırmızı boru çiz','Draw red pipe','pipes',.12,3,.65,'#b72b29',{draw:'line',network:true}),
  PIPE_YELLOW:spec('Sarı boru çiz','Draw yellow pipe','pipes',.12,3,.65,'#e8c93d',{draw:'line',network:true}),
  PIPE_TEE:spec('T bağlantı / su kollektörü','T branch / water manifold','pipes',1.2,1.2,.65,'#b72b29',{network:true}),
  PIPE_ELBOW:spec('90° boru dirseği','90° pipe elbow','pipes',.6,.6,.65,'#b72b29',{network:true}),
  PIPE_VALVE:spec('Etiketli hat vanası','Tagged line valve','pipes',.45,.65,.95,'#b72b29',{network:true,settings:{open:true,tag:'FV'}}),
  FOAM_EDUCTOR:spec('Köpük emiş karıştırıcısı','Foam eductor','pipes',.55,1.2,.85,'#e6cb3d',{network:true,settings:{ratio:3}}),
  TANK_COOLING:spec('Tank soğutma çıkışı','Tank cooling outlet','pipes',1.2,1.2,.5,'#ba322d',{network:true,settings:{open:true}}),
  SPRINKLER:spec('Sprinkler / püskürtme çıkışı','Sprinkler / discharge outlet','pipes',.3,.3,.35,'#b72b29',{network:true,settings:{open:false}}),
  PRESSURE_GAUGE:spec('Manometreli boru','Pipe with pressure gauge','pipes',.35,.8,.9,'#b72b29',{network:true}),
  TANK_BRIDGE:spec('İki tank arası köprü','Bridge between tanks','access',1.05,4,.18,'#b9c5c6'),
  CROSSOVER_STAIR:spec('Havuz duvarı geçiş merdiveni','Containment wall crossover','access',1.05,5,1.8,'#dce142'),
  MOBILE_STAIR:spec('Tekerlekli platform merdiveni','Mobile platform stairs','access',1,2.5,1.5,'#b2bec3'),
  PEDESTRIAN_GATE:spec('Panik barlı yaya kapısı','Pedestrian gate with panic bar','access',1.1,.1,2.1,'#e4e5df',{settings:{open:false}}),
  GUARD_CABIN:spec('Bekçi mobosu','Guard cabin','site',2.4,3,2.6),
  DRIVER_WC:spec('Şoför WC','Driver WC','site',1.6,2,2.5,'#e3e7e5',{settings:{label:'ŞOFÖR WC'}}),
  WASTE_SHELTER:spec('Tehlikeli atık sahası','Hazardous waste shelter','site',3.5,4,2.5,'#e1e4db',{settings:{label:'TEHLİKELİ ATIK'}}),
  DIESEL_UNIT:spec('Motorin tankı ve dispenser','Diesel tank and dispenser','site',2.1,3.8,2.6,'#e6e8e3'),
  BOLLARD:spec('Sabit duba','Fixed bollard','site',.15,.15,1,'#e78334'),
  TRAFFIC_CONE:spec('Trafik konisi','Traffic cone','site',.5,.5,.75,'#ee8130'),
  CHAIN_POSTS:spec('Zincirli yaya ayrımı','Posts with pedestrian chain','site',.15,3,1,'#e78334'),
  IMPACT_BARRIER:spec('Sarı siyah koruma bariyeri','Yellow black impact barrier','site',.15,2.3,.85,'#e5de40'),
  CURB:spec('Sarı beyaz bordür çiz','Draw yellow white curb','site',.22,3,.2,'#ded13d',{draw:'line'}),
  DRAIN:spec('Izgaralı kanal çiz','Draw grated drain','site',.45,3,.06,'#555f60',{draw:'line'}),
  MANHOLE:spec('Yeşil rögar kapağı','Green manhole cover','site',.8,.8,.08,'#49854c'),
  SPILL_KIT:spec('Döküntü müdahale seti','Spill response bin','site',.6,.6,1,'#d04c43',{settings:{label:'SPILL KIT'}}),
  SAFETY_SHOWER:spec('Göz ve vücut duşu','Eyewash and safety shower','site',.75,.9,2.25,'#499754'),
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
export const isOutlet=(o:Entity)=>['FIRE_MONITOR','HYDRANT_POINT','TANK_COOLING','SPRINKLER'].includes(o.preset);
export const isFoamStore=(o:Entity)=>['FOAM_DRUM','FOAM_TANK'].includes(o.preset);
export function facilityDefaults(preset:string):FacilitySettings|undefined {const c=FACILITY_CATALOG[preset];return c?{...c.settings}:undefined;}
export function validateFacility(raw:unknown):FacilitySettings|undefined{
  if(!raw||typeof raw!=='object')return undefined;const v=raw as Record<string,any>,o:FacilitySettings={};
  for(const k of ['label','tag','supplyId','concentrateId','tankA','tankB'] as const)if(typeof v[k]==='string')o[k]=v[k].slice(0,k==='label'?300:180);
  if(/^#[a-f\d]{6}$/i.test(v.textColor||''))o.textColor=v.textColor;
  for(const k of ['open','enabled','clockwise','stairs'] as const)if(typeof v[k]==='boolean')o[k]=v[k];
  for(const [k,min,max] of [['lineWidth',.02,2],['ratio',0,6],['capacity',0,100000],['volume',0,100000],['flowLpm',0,5000],['sweep',30,330],['stairStart',-360,360],['stairWidth',.6,2],['bridgeRise',-100,100]] as const)if(typeof v[k]==='number'&&Number.isFinite(v[k]))o[k]=Math.max(min,Math.min(max,v[k]));
  if(['solid','dash','footprints'].includes(v.pattern))o.pattern=v.pattern;
  if(Array.isArray(v.stopTargets))o.stopTargets=v.stopTargets.filter((s:unknown)=>typeof s==='string').slice(0,30).map((s:string)=>s.slice(0,180));
  const m=v.mount;if(m&&typeof m.parentId==='string'&&[m.point,m.normal].every(a=>Array.isArray(a)&&a.length===3&&a.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<50000)))o.mount={parentId:m.parentId.slice(0,180),point:[m.point[0],m.point[1],m.point[2]],normal:[m.normal[0],m.normal[1],m.normal[2]]};
  if(o.capacity!==undefined&&o.volume!==undefined)o.volume=Math.min(o.capacity,o.volume);
  return o;
}
export function localToWorld(o:Entity,p:[number,number,number]):[number,number,number]{const a=-o.heading*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [o.position[0]+(c*p[0]+s*p[2])*o.scale,o.position[1]+p[1]*o.scale,o.position[2]+(-s*p[0]+c*p[2])*o.scale];}
export function worldToLocal(o:Entity,p:[number,number,number]):[number,number,number]{const a=o.heading*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=(p[0]-o.position[0])/o.scale,z=(p[2]-o.position[2])/o.scale;return [c*x+s*z,(p[1]-o.position[1])/o.scale,-s*x+c*z];}
export function portPosition(o:Entity,port:'in'|'out'|'foam'='out'):[number,number,number]{
  if(o.points?.length){const p=o.points[port==='in'?0:o.points.length-1];return localToWorld(o,[p[0],o.height,p[1]]);}
  const y=isFoamStore(o)?.2:.65;return localToWorld(o,port==='foam'?[.36,.72,0]:[0,y,(port==='in'?-1:1)*o.length/2]);
}
/** Only explicit parent/bridge references move linked objects. Existing scene transforms stay intact. */
export function updateFacilityAttachments(entities:Entity[]){
  const map=new Map(entities.map(o=>[o.id,o]));const done=new Set<string>(),visiting=new Set<string>();
  const update=(o:Entity)=>{if(done.has(o.id)||visiting.has(o.id))return;visiting.add(o.id);const f=o.facility,m=f?.mount,parent=m&&map.get(m.parentId);
    if(m&&parent&&parent!==o&&!visiting.has(parent.id)){update(parent);o.position=localToWorld(parent,m.point);o.heading=parent.heading-Math.atan2(m.normal[0],m.normal[2])*180/Math.PI;}
    if(o.preset==='TANK_BRIDGE'&&f?.tankA&&f.tankB){const a=map.get(f.tankA),b=map.get(f.tankB);if(a?.kind==='tank'&&b?.kind==='tank'&&a!==b){const dx=b.position[0]-a.position[0],dz=b.position[2]-a.position[2],d=Math.hypot(dx,dz),ra=(a.radius+.32)*a.scale,rb=(b.radius+.32)*b.scale;if(d>ra+rb+.4){const ax=a.position[0]+dx/d*ra,az=a.position[2]+dz/d*ra,bx=b.position[0]-dx/d*rb,bz=b.position[2]-dz/d*rb,ay=a.position[1]+(a.height+.28)*a.scale,by=b.position[1]+(b.height+.28)*b.scale;o.position=[(ax+bx)/2,(ay+by)/2,(az+bz)/2];o.heading=-Math.atan2(dx,dz)*180/Math.PI;o.length=d-ra-rb;o.scale=1;f.bridgeRise=by-ay;}}}
    visiting.delete(o.id);done.add(o.id);
  };entities.forEach(update);
}
export function remapFacilityReferences(copies:Entity[],mapping:Map<string,string>){for(const o of copies){const f=o.facility;if(!f)continue;for(const k of ['supplyId','concentrateId','tankA','tankB'] as const)if(f[k]&&mapping.has(f[k]!))f[k]=mapping.get(f[k]!);if(f.mount){if(mapping.has(f.mount.parentId))f.mount.parentId=mapping.get(f.mount.parentId)!;else delete f.mount;}if(f.stopTargets)f.stopTargets=f.stopTargets.map(id=>mapping.get(id)||id);}}
