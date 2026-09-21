import { local } from './geo';
import { validatePhoto, type GroundPhoto } from './photo-ground';
import { AIRCRAFT_SPECS } from './aircraft-specs';
export type Kind = 'tank' | 'wall' | 'ground' | 'tree' | 'structure' | 'aircraft' | 'vehicle';
export type Entity = {
  id: string; name: string; kind: Kind; preset: string; color: string;
  position: [number, number, number]; heading: number; scale: number; groupId?: string;
  width: number; length: number; height: number; radius: number; thickness: number;
  points?: [number, number][]; wallStyle?: string; flag?: string; doorSide?: string;
};
export type SceneData = { schema: 'KS_DIGITAL_TWIN_V1'; airport: 'ADB'; entities: Entity[]; groups: { id: string; name: string }[]; source: string; updatedAt?: string; groundPhoto?:GroundPhoto };
export const id = () => crypto.randomUUID();
const finite = (n: unknown, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const str = (s: unknown, fallback = '') => typeof s === 'string' ? s.slice(0, 180) : fallback;
const kinds: Kind[] = ['tank','wall','ground','tree','structure','aircraft','vehicle'];
const color = (s: unknown) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s) ? s : '#d9e3e7';
export function validateScene(value: unknown): SceneData {
  const d = value as SceneData;
  if (!d || d.schema !== 'KS_DIGITAL_TWIN_V1' || d.airport !== 'ADB' || !Array.isArray(d.entities) || d.entities.length > 2000 || !Array.isArray(d.groups)) throw new Error('Geçerli bir ADB sahne dosyası gerekli.');
  const used = new Set<string>();
  const entities = d.entities.map((o): Entity => {
    if (!o || !kinds.includes(o.kind) || !Array.isArray(o.position) || o.position.length !== 3 || o.position.some(n => !Number.isFinite(n) || Math.abs(n) > 50000) || !o.id || used.has(o.id)) throw new Error('Nesne kimliği veya konumu geçersiz.');
    used.add(o.id);
    if (o.points && (!Array.isArray(o.points) || o.points.length > 1000 || o.points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n) || Math.abs(n)>50000)))) throw new Error('Çizim noktaları geçersiz.');
    return { id: str(o.id), name: str(o.name, o.kind), kind: o.kind, preset: str(o.preset), color: color(o.color), position: [...o.position], heading: finite(o.heading), scale: Math.max(.02, Math.min(100, finite(o.scale,1))), groupId: str(o.groupId) || undefined, width: Math.max(.05, finite(o.width, 2)), length: Math.max(.05, finite(o.length,2)), height: Math.max(.05, finite(o.height,2)), radius: Math.max(.05,finite(o.radius,2)), thickness: Math.max(.02,finite(o.thickness,.2)), points: o.points?.map(p=>[...p]), wallStyle: str(o.wallStyle), flag: str(o.flag), doorSide: str(o.doorSide) };
  });
  for(const o of entities){const spec=AIRCRAFT_SPECS[o.preset];if(o.kind==='aircraft'&&spec){o.width=spec.span;o.length=spec.length;o.height=spec.height;}}
  return { schema:'KS_DIGITAL_TWIN_V1', airport:'ADB', entities, groups:d.groups.filter(g=>g && typeof g.id==='string').map(g=>({id:str(g.id),name:str(g.name,'Grup')})), source:str(d.source), updatedAt:str(d.updatedAt), groundPhoto:validatePhoto(d.groundPhoto) };
}
export function importScene(input: any): SceneData {
  if (input?.schema === 'KS_DIGITAL_TWIN_V1') return validateScene(input);
  const old = input?.airport3d?.ADB?.scene ?? input?.adb3d ?? input?.scene_data ?? input;
  if (old?.schema !== 'KS_AIRPORT_3D_V2' || (old.airport && old.airport !== 'ADB') || !Array.isArray(old.objects)) throw new Error('ADB sahnesi bulunamadı.');
  const entities: Entity[] = old.objects.map((o: any) => {
    const pts = Array.isArray(o.points) ? o.points.map((p: any) => local(Number(p.lat),Number(p.lon))) : undefined;
    const p: [number,number] = pts?.length ? [pts.reduce((s: number,q: number[])=>s+q[0],0)/pts.length,pts.reduce((s: number,q: number[])=>s+q[1],0)/pts.length] : local(Number(o.lat),Number(o.lon));
    return { id:o.id, name:o.name || o.preset || o.type, kind:o.type, preset:o.preset || o.type.toUpperCase(), color:o.color, position:[p[0],0,p[1]], heading:finite(o.heading), scale:finite(o.scale,1), groupId:o.groupId, width:finite(o.width,2), length:finite(o.length,2), height:finite(o.height,2), radius:finite(o.radius,4.4), thickness:finite(o.thickness,.2), points:pts?.map((q:number[])=>[q[0]-p[0],q[1]-p[1]]), wallStyle:o.wallStyle, flag:o.flag, doorSide:o.doorSide };
  });
  return validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',entities,groups:old.groups || [],source:typeof old.source==='string'?old.source:`Eski ADB kaydı · ${old.source?.date || '2026-09-15'}`});
}
export const CATALOG: Record<string, { tr: string; en: string; kind: Kind; width:number; length:number; height:number; radius?:number; color?:string; wallStyle?:string }> = {
  R14:{tr:'R14 · 38.000 L',en:'R14 · 38,000 L',kind:'vehicle',width:2.55,length:13.5,height:3.6},
  REF20:{tr:'İkmal aracı · 20K',en:'Refueller · 20K',kind:'vehicle',width:2.5,length:9,height:3.2},
  REF45:{tr:'İkmal aracı · 45K',en:'Refueller · 45K',kind:'vehicle',width:2.55,length:13.5,height:3.6},
  HYDRANT:{tr:'Hidrant aracı',en:'Hydrant dispenser',kind:'vehicle',width:2.4,length:7,height:2.8},
  TANK:{tr:'Dikey tank',en:'Storage tank',kind:'tank',width:8.8,length:8.8,height:11,radius:4.4,color:'#ffffff'},
  BUILDING:{tr:'Tesis binası',en:'Facility building',kind:'structure',width:8,length:12,height:4.6,color:'#d0cbc0'},
  CANOPY:{tr:'Dolum sundurması',en:'Loading canopy',kind:'structure',width:6,length:10,height:4.5},
  PUMP:{tr:'Filtre / pompa',en:'Filter / pump',kind:'structure',width:1.2,length:3.4,height:1.8},
  FIRE_EXT:{tr:'Yangın söndürücü',en:'Fire extinguisher',kind:'structure',width:.6,length:.6,height:1.3,color:'#d52b1e'},
  LIGHT_CAM:{tr:'Aydınlatma direği',en:'Lighting pole',kind:'structure',width:.5,length:.5,height:8},
  FLAG_TR:{tr:'Türk bayrağı',en:'Turkish flag',kind:'structure',width:.3,length:.3,height:9},
  FLAG_AZ:{tr:'Azerbaycan bayrağı',en:'Azerbaijani flag',kind:'structure',width:.3,length:.3,height:9},
  FLAG_SOCAR:{tr:'SOCAR bayrağı',en:'SOCAR flag',kind:'structure',width:.3,length:.3,height:9},
  CYPRESS:{tr:'Selvi ağacı',en:'Cypress tree',kind:'tree',width:2.8,length:2.8,height:11,color:'#315f32'},
  PLANE:{tr:'Çınar ağacı',en:'Plane tree',kind:'tree',width:7,length:7,height:11,color:'#4a783d'},
  B737:{tr:'B737-800 · Winglets',en:'B737-800 · Winglets',kind:'aircraft',width:35.79,length:39.47,height:12.55},
  B777:{tr:'Boeing 777',en:'Boeing 777',kind:'aircraft',width:64.8,length:73.9,height:18.5},
  A320:{tr:'A320-200 · CFM56 · Sharklets',en:'A320-200 · CFM56 · Sharklets',kind:'aircraft',width:35.8,length:37.57,height:12.0},
  A330:{tr:'Airbus A330',en:'Airbus A330',kind:'aircraft',width:60.3,length:63.7,height:16.8},
  WALL:{tr:'Beton duvar çiz',en:'Draw concrete wall',kind:'wall',width:.25,length:10,height:2.2,color:'#ddd8ce',wallStyle:'solid'},
  FENCE_WALL:{tr:'Tel çit çiz',en:'Draw fence',kind:'wall',width:.08,length:10,height:2.2,color:'#60686a',wallStyle:'fence'},
  MAIN_GATE:{tr:'Kapı çiz',en:'Draw gate',kind:'wall',width:.1,length:8,height:2.6,color:'#60686a',wallStyle:'gate'},
  GROUND:{tr:'Zemin alanı çiz',en:'Draw ground area',kind:'ground',width:10,length:10,height:.05,color:'#9b8060'}
};
export function newEntity(preset: string, x: number, z: number, lang='tr'): Entity {
  const c = CATALOG[preset];
  if (!c) throw new Error('Bilinmeyen nesne.');
  return { id:id(), name:lang==='tr'?c.tr:c.en,kind:c.kind,preset,color:c.color||'#dce5e7',position:[x,0,z],heading:0,scale:1,width:c.width,length:c.length,height:c.height,radius:c.radius||2,thickness:c.width,wallStyle:c.wallStyle,flag:preset.startsWith('FLAG_')?preset.slice(5):undefined };
}
export function moveEntities(d: SceneData, ids: Set<string>, dx: number, dz: number, dy=0) { d.entities.filter(o=>ids.has(o.id)).forEach(o=>{o.position[0]+=dx;o.position[1]=Math.max(0,o.position[1]+dy);o.position[2]+=dz;}); }
export class SceneHistory {
  past: SceneData[]=[]; future: SceneData[]=[];
  constructor(public current:SceneData){}
  checkpoint(){this.past.push(structuredClone(this.current));if(this.past.length>60)this.past.shift();this.future=[];}
  change(fn:(d:SceneData)=>void){this.checkpoint();fn(this.current);this.current.updatedAt=new Date().toISOString();}
  undo(){const d=this.past.pop();if(!d)return false;this.future.push(structuredClone(this.current));this.current=d;return true;}
  redo(){const d=this.future.pop();if(!d)return false;this.past.push(structuredClone(this.current));this.current=d;return true;}
}
