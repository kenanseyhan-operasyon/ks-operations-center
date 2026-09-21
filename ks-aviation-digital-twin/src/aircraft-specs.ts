// Metres. Aircraft local axes: +X starboard, +Y up, -Z nose.
// Datum is the midpoint of the published overall length, at apron elevation.
export type PointQuality = 'table' | 'diagram' | 'pending';
export type ServiceKind = 'fuel' | 'power' | 'air' | 'cargo' | 'passenger' | 'catering' | 'water' | 'waste' | 'grounding';
export type ServicePoint = {
  id:string; tr:string; en:string; kind:ServiceKind; aft:number; lateral:number; height:number;
  quality:PointQuality; page:number; section:string; optional?:boolean; noteTr?:string; noteEn?:string;
  door?:{width:number;height:number}; approach:[number,number,number];
};
export type AircraftSpec = {
  id:string; title:string; length:number; span:number; height:number; fuselageWidth:number; fuselageHeight:number; bodyY:number;
  noseGear:number; mainGear:number; gearTrack:number; engineX:number; engineAft:number; engineLength:number; engineRadius:number; engineY:number;
  tailSpan:number; wingRootLE:number; wingRootTE:number; wingTipLE:number; wingTipTE:number; wingRootY:number; wingTipY:number;
  source:string; revision:string; dimensionPage:number; points:ServicePoint[]; clearanceNoteTr:string; clearanceNoteEn:string;
};
export const AIRBUS_SOURCE='https://mediaassets.airbus.com/pm_38_916_916266-iujedqawwy.pdf?fileName=aca32001-jul-2026-2.pdf';
export const BOEING_SOURCE='https://www.boeing.com/content/dam/boeing/v2/airports/acaps/737NG_REV_C.pdf';
const a=(id:string,tr:string,en:string,kind:ServiceKind,aft:number,lateral:number,height:number,page:number,section:string,extra:Partial<ServicePoint>={}):ServicePoint=>({id,tr,en,kind,aft,lateral,height,page,section,quality:'table',approach:[lateral<0?-5:5,1,2],...extra});
const b=(id:string,tr:string,en:string,kind:ServiceKind,aft:number,lateral:number,height:number,extra:Partial<ServicePoint>={}):ServicePoint=>a(id,tr,en,kind,aft,lateral,height,153,'5.4.5 / 5-23',{quality:'diagram',noteTr:'Konum ölçekli Boeing çiziminden yaklaşık okunmuştur; hassas bağlantı/clearance onayı için AMM veya saha ölçümü gerekir.',noteEn:'Approximate position digitized from the Boeing scale drawing; precise connection/clearance approval needs AMM or field measurement.',...extra});
export const AIRCRAFT_SPECS:Record<string,AircraftSpec>={
  A320:{id:'A320-200-CFM56-SHARKLETS',title:'A320-200 · CFM56 · Sharklets',length:37.57,span:35.80,height:12.00,fuselageWidth:3.95,fuselageHeight:4.14,bodyY:3.91,
    noseGear:5.07,mainGear:17.71,gearTrack:7.59,engineX:5.75,engineAft:11.19,engineLength:3.65,engineRadius:1.02,engineY:1.60,tailSpan:12.45,
    wingRootLE:12.8,wingRootTE:18.9,wingTipLE:21.8,wingTipTE:23.45,wingRootY:2.85,wingTipY:4.1,
    source:AIRBUS_SOURCE,revision:'Airbus AC · 01 Jul 2026',dimensionPage:46,
    clearanceNoteTr:'Nominal yerde duruş: kuyruk 12,00 m. Airbus yük/CG tablolarında kuyruk 11,81–12,08 m; CFM56 altı 0,57–0,67 m. Servis yükseklikleri ortalamadır. Gerçek araç geçişi, uçak yükü ve araç zarfıyla ayrıca doğrulanır.',
    clearanceNoteEn:'Nominal ground attitude: tail 12.00 m. Airbus load/CG tables give tail 11.81–12.08 m and CFM56 underside 0.57–0.67 m. Service heights are means. Vehicle access needs the actual aircraft load and vehicle envelope.',
    points:[
      a('REFUEL_COUPLING_R','Sağ kanat ikmal bağlantısı · 622HB','RH refuel coupling · 622HB','fuel',17.59,9.83,3.65,254,'5-4-6 p1',{approach:[3,-1,-4]}),
      a('REFUEL_PANEL','İkmal kontrol paneli · 192MB','Refuel control panel · 192MB','fuel',16.4,1.8,1.8,254,'5-4-6 p1',{door:{width:.52,height:.32},approach:[4,.1,-2]}),
      a('GROUND_NLG','Burun dikmesi topraklama saplaması','Nose gear grounding stud','grounding',5.07,0,.94,238,'5-4-2 p1',{approach:[3,.2,-2],noteTr:'Kaynak bu noktayı grounding/earthing olarak tanımlar. Yakıt aracı bonding bağlantısı için işletme/AMM onayı ayrıca gerekir.',noteEn:'The source identifies a grounding/earthing stud. Fuel-vehicle bonding attachment requires separate operator/AMM confirmation.'}),
      a('GPU','GPU elektrik bağlantısı · 121AL','GPU electrical connector · 121AL','power',2.55,0,2.0,250,'5-4-4 p1',{approach:[3,-.2,-3],noteTr:'90 kVA, üç faz 115/200 V, 400 Hz; motor çalıştırma havasından ayrı bağlantı.',noteEn:'90 kVA, three-phase 115/200 V, 400 Hz; separate from the engine air-start connection.'}),
      a('FWD_CARGO','Ön kargo kapısı','Forward cargo door','cargo',8.16,1.82,1.88,84,'2-7-0 p7 / 2-3-0 p6',{quality:'diagram',door:{width:1.82,height:1.24},noteTr:'Boyuna referans ve eşik yüksekliği Airbus verisidir; yanal yüzey konumu yaklaşık. Eşik yük/CG’ye göre değişir.',noteEn:'Longitudinal reference and sill height use Airbus data; lateral surface position is approximate. Sill height varies with load/CG.'}),
      a('AFT_CARGO','Arka kargo kapısı','Aft cargo door','cargo',22.69,1.82,1.89,86,'2-7-0 p9 / 2-3-0 p6',{quality:'diagram',door:{width:1.82,height:1.23},noteTr:'Boyuna referans ve eşik yüksekliği Airbus verisidir; yanal yüzey konumu yaklaşık.',noteEn:'Longitudinal reference and sill height use Airbus data; lateral surface position is approximate.'}),
      a('BULK_CARGO','Bulk bagaj kapısı','Bulk cargo door','cargo',26.29,1.85,2.11,80,'2-7-0 p3 / 2-3-0 p6',{quality:'diagram',door:{width:.95,height:.77},noteTr:'Boyuna referans ve eşik yüksekliği Airbus verisidir; yanal yüzey konumu yaklaşık.',noteEn:'Longitudinal reference and sill height use Airbus data; lateral surface position is approximate.'}),
      a('DOOR_1L','Ön sol yolcu kapısı · 1L','Forward LH passenger door · 1L','passenger',5.04,-1.93,3.48,80,'2-7-0 p3 / 2-3-0 p6',{quality:'diagram',door:{width:.81,height:1.85},noteTr:'Boyuna referans ve eşik yüksekliği Airbus verisidir; yanal yüzey konumu yaklaşık.',noteEn:'Longitudinal reference and sill height use Airbus data; lateral surface position is approximate.'}),
      a('DOOR_4L','Arka sol yolcu kapısı · 4L','Aft LH passenger door · 4L','passenger',29.53,-1.93,3.49,80,'2-7-0 p3 / 2-3-0 p6',{quality:'diagram',door:{width:.81,height:1.85},noteTr:'Boyuna referans ve eşik yüksekliği Airbus verisidir; yanal yüzey konumu yaklaşık.',noteEn:'Longitudinal reference and sill height use Airbus data; lateral surface position is approximate.'}),
      a('DOOR_1R','Ön sağ ikram kapısı · 1R','Forward RH catering door · 1R','catering',5.04,1.93,3.48,80,'2-7-0 p3 / 2-3-0 p6',{quality:'diagram',door:{width:.81,height:1.85},noteTr:'Boyuna referans ve eşik yüksekliği Airbus verisidir; yanal yüzey konumu yaklaşık.',noteEn:'Longitudinal reference and sill height use Airbus data; lateral surface position is approximate.'}),
      a('DOOR_4R','Arka sağ ikram kapısı · 4R','Aft RH catering door · 4R','catering',29.53,1.93,3.49,80,'2-7-0 p3 / 2-3-0 p6',{quality:'diagram',door:{width:.81,height:1.85},noteTr:'Boyuna referans ve eşik yüksekliği Airbus verisidir; yanal yüzey konumu yaklaşık.',noteEn:'Longitudinal reference and sill height use Airbus data; lateral surface position is approximate.'}),
      a('POTABLE_WATER','İçme suyu servisi · 171AL','Potable water service · 171AL','water',31.3,-.3,2.6,282,'5-4-9 p1',{approach:[-4,0,2]}),
      a('WASTE_SERVICE','Atık servisi · 172AR','Waste service · 172AR','waste',31.3,.8,2.8,286,'5-4-10 p1'),
      a('ASU','ASU yüksek basınç hava · 191DB','ASU high-pressure air · 191DB','air',12.98,-.84,1.76,260,'5-4-7 p1',{approach:[-4,-.1,-2]}),
      a('ACU','ACU düşük basınç hava · 191CB','ACU low-pressure air · 191CB','air',12.45,-1.11,1.73,260,'5-4-7 p1',{approach:[-4,-.1,-2]}),
      a('REFUEL_COUPLING_L','Sol ikmal bağlantısı · opsiyonel 522HB','LH refuel coupling · optional 522HB','fuel',17.59,-9.83,3.65,254,'5-4-6 p1',{optional:true,approach:[-3,-1,-4],noteTr:'Yalnız bu opsiyonun bulunduğu uçak konfigürasyonunda kullanılır.',noteEn:'Only applicable to aircraft fitted with this option.'})
    ]},
  B737:{id:'B737-800W-CFM56-7B',title:'B737-800 · Winglets · CFM56-7B',length:39.47,span:35.79,height:12.55,fuselageWidth:3.76,fuselageHeight:4.01,bodyY:3.50,
    noseGear:4.09,mainGear:19.69,gearTrack:5.72,engineX:4.83,engineAft:13.36,engineLength:3.75,engineRadius:1.05,engineY:1.61,tailSpan:14.35,
    wingRootLE:15.0,wingRootTE:21.5,wingTipLE:23.88,wingTipTE:26.01,wingRootY:2.20,wingTipY:4.20,
    source:BOEING_SOURCE,revision:'Boeing D6-58325-7 Rev C · Oct 2025',dimensionPage:35,
    clearanceNoteTr:'Kuyruk nominal 12,55 m. Boeing: kuyruk 12,37–12,62 m; motor altı 0,48–0,64 m. Konuma/yüklemeye bağlı ek ±0,076 m değişim belirtilir. Servis konumları ölçekli çizimden yaklaşık okunmuştur.',
    clearanceNoteEn:'Nominal tail 12.55 m. Boeing: tail 12.37–12.62 m, engine underside 0.48–0.64 m, with an additional ±0.076 m variation. Service positions are approximate readings of the scaled drawing.',
    points:[
      b('REFUEL_COUPLING_R','Sağ kanat ikmal bölgesi','RH pressure-refuel location','fuel',19.85,8.0,2.9,{approach:[3,-.7,-4]}),
      b('REFUEL_PANEL','İkmal paneli · ayrı konum doğrulanacak','Refuel panel · separate location pending','fuel',19.85,8,2.9,{quality:'pending',noteTr:'Bu kaynak paneli coupling’den ayrı hassas koordinatla tanımlamıyor.',noteEn:'This source does not locate the panel separately from the coupling with precise coordinates.'}),
      b('GPU','GPU elektrik bağlantısı','GPU electrical connection','power',2.7,1.0,2.0,{approach:[4,0,-3]}),
      b('ASU','ASU hava bağlantısı','ASU pneumatic connection','air',16.2,1,1.55,{approach:[4,0,-3]}),
      b('ACU','ACU klima bağlantısı','ACU conditioned-air connection','air',17.8,0,1.5),
      b('FWD_CARGO','Ön kargo kapısı','Forward cargo door','cargo',8.6,1.78,1.37,{page:40,section:'2.3.3 / 2-19; drawing 5-23',door:{width:1.22,height:.9}}),
      b('AFT_CARGO','Arka kargo kapısı','Aft cargo door','cargo',28.4,1.78,1.72,{page:40,section:'2.3.3 / 2-19; drawing 5-23',door:{width:1.22,height:.84}}),
      b('DOOR_1L','Ön sol yolcu kapısı','Forward LH passenger door','passenger',5.1,-1.85,2.67,{page:40,section:'2.3.3 / 2-19; drawing 2-14',door:{width:.86,height:1.83}}),
      b('DOOR_2L','Arka sol yolcu kapısı','Aft LH passenger door','passenger',32.3,-1.85,3.05,{page:40,section:'2.3.3 / 2-19; drawing 2-14',door:{width:.86,height:1.83}}),
      b('DOOR_1R','Ön sağ ikram kapısı','Forward RH catering door','catering',5.1,1.85,2.67,{door:{width:.76,height:1.65}}),
      b('DOOR_2R','Arka sağ ikram kapısı','Aft RH catering door','catering',32.3,1.85,3.05,{door:{width:.76,height:1.65}}),
      b('POTABLE_WATER','İçme suyu servisi','Potable water service','water',31.5,-.35,2.15,{approach:[-4,0,3]}),
      b('WASTE_SERVICE','Atık servisi','Lavatory service','waste',29.8,.75,2.05),
      b('GROUND_NLG','Bonding noktası · doğrulama bekliyor','Bonding attachment · pending validation','grounding',4.09,0,.8,{quality:'pending',noteTr:'Bu airport-planning çizimi bonding saplamasını tanımlamıyor. İşaretçi onaylı bir bağlantı noktası değildir.',noteEn:'The airport-planning drawing does not identify a bonding stud. This marker is not an approved attachment point.'})
    ]}
};
export function pointLocal(spec:AircraftSpec,p:ServicePoint):[number,number,number]{return [p.lateral,p.height,p.aft-spec.length/2];}
export function aircraftLocalToWorld(entity:{position:number[];heading:number;scale:number},p:number[]):[number,number,number]{const a=-entity.heading*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [entity.position[0]+entity.scale*(c*p[0]+s*p[2]),entity.position[1]+entity.scale*p[1],entity.position[2]+entity.scale*(-s*p[0]+c*p[2])];}
export const SERVICE_COLORS:Record<ServiceKind,string>={fuel:'#ffb648',power:'#91c6ff',air:'#b3bfff',cargo:'#cb93ff',passenger:'#8af0cc',catering:'#e9d99b',water:'#50ccff',waste:'#ca9b70',grounding:'#b7ff3c'};
