import type {Point3} from './socar-fire-layout';
export type GuideMode='xz'|'x'|'y'|'z'|'parallel'|'perpendicular';
export type PipeGuide={mode:GuideMode;reference?:[Point3,Point3];local:(p:Point3)=>Point3;world:(p:Point3)=>Point3};
export const guideNames:Record<GuideMode,string>={xz:'Yatay XZ · yükseklik sabit',x:'Yatay X · Z ve yükseklik sabit',y:'Dikey Y · XZ sabit',z:'Yatay Z · X ve yükseklik sabit',parallel:'Referansa paralel ∥ · yatay',perpendicular:'Referansa dik ⊥ · yatay'};
export function constrainPipePoint(origin:Point3,candidate:Point3,guide:PipeGuide):Point3{
 const a=guide.local(origin),b=guide.local(candidate),d=b.map((v,i)=>v-a[i]) as Point3;
 if(guide.mode==='y'){d[0]=0;d[2]=0;}else{d[1]=0;if(guide.mode==='x')d[2]=0;if(guide.mode==='z')d[0]=0;
 if(guide.mode==='parallel'||guide.mode==='perpendicular'){if(!guide.reference)throw Error('Önce referans çizgisini seçin.');const [p,q]=guide.reference.map(guide.local),dx=q[0]-p[0],dz=q[2]-p[2],l=Math.hypot(dx,dz);if(l<.001)throw Error('Yatay uzunluğu olan bir referans seçin.');const u=guide.mode==='parallel'?[dx/l,dz/l]:[-dz/l,dx/l],t=d[0]*u[0]+d[2]*u[1];d[0]=u[0]*t;d[2]=u[1]*t;}}
 return guide.world(a.map((v,i)=>v+d[i]) as Point3);
}
export function pipeGuideLabel(a:Point3,b:Point3,guide:PipeGuide){const d=guide.local(b).map((v,i)=>v-guide.local(a)[i]),length=Math.hypot(...d)*100;let angle='';if(guide.reference&&guide.mode!=='y'){const [p,q]=guide.reference.map(guide.local),dx=q[0]-p[0],dz=q[2]-p[2],size=Math.hypot(dx,dz)*Math.hypot(d[0],d[2]);if(size>.000001){const degrees=Math.acos(Math.min(1,Math.abs(d[0]*dx+d[2]*dz)/size))*180/Math.PI;angle=` · Ref. açı ${degrees.toFixed(1)}°${degrees<.5?' ∥':degrees>89.5?' ⊥':''}`;}}return `${guideNames[guide.mode]} · ${length.toFixed(1)} cm · ΔX ${(d[0]*100).toFixed(1)} / ΔY ${(d[1]*100).toFixed(1)} / ΔZ ${(d[2]*100).toFixed(1)} cm${angle}`;}
