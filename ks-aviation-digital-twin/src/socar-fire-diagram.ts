import type {Entity} from './scene-data';
import {localToWorld} from './facility-data';
import {FIRE_REFERENCE,fireFrame,referenceConnectionPoints,type Point3} from './socar-fire-layout';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function fireDiagram(entities:Entity[],selected='',showUnderground=false){
 const frame=fireFrame(entities);if(!frame)return '';
 const map=new Map(entities.map(e=>[e.id,e])),xy=(p:Point3)=>{const q=frame.local(p);return [q[0],-q[2]];},points=(p:Point3[])=>p.map(q=>xy(q).map(n=>n.toFixed(3)).join(',')).join(' ');
 let drawing='';
 for(const e of entities.filter(e=>['FENCE_WALL','WALL','CURB'].includes(e.preset)&&e.points?.length)){
  const path=e.points!.map(([x,z])=>localToWorld(e,[x,0,z]));if(e.facility?.closed)path.push(path[0]);
  drawing+=`<polyline points="${points(path)}" fill="none" stroke="#bac5c3" stroke-width="${e.preset==='WALL'?.28:.12}" ${e.preset==='FENCE_WALL'?'stroke-dasharray=".4 .2"':''}/>`;
 }

 for(const e of entities.filter(e=>e.preset==='BUILDING'||e.preset==='CANOPY')){
  const p=xy(e.position);if(p[0]<-12||p[0]>33||p[1]<-32||p[1]>43)continue;
  const corners=[[-e.width/2,0,-e.length/2],[e.width/2,0,-e.length/2],[e.width/2,0,e.length/2],[-e.width/2,0,e.length/2]] as Point3[];
  drawing+=`<polygon points="${points(corners.map(q=>localToWorld(e,q)))}" fill="${e.preset==='CANOPY'?'#e6eff1':'#edf0ee'}" stroke="#b5c6c8" stroke-width=".15"/><text x="${p[0]}" y="${p[1]}" text-anchor="middle" font-size=".85" fill="#537074">${e.preset==='CANOPY'?(e.facility?.circuit==='receiving'?'':'DOLUM ADASI'):'İDARİ BİNA'}</text>`;
 }
 for(const e of entities.filter(e=>e.preset==='CANOPY'&&e.facility?.circuit==='receiving')){const p=xy(e.position);drawing+=`<path d="M${p[0]},${p[1]} l2,-5 h3" fill="none" stroke="#537074" stroke-width=".1"/><text x="${p[0]+5.2}" y="${p[1]-5}" font-size=".85" fill="#537074">MAL KABUL</text>`;}
 for(const [i,tank] of frame.tanks.entries()){const p=xy(tank.position);drawing+=`<circle cx="${p[0]}" cy="${p[1]}" r="${tank.radius*tank.scale}" fill="#f4f7f6" stroke="#9bb3b4" stroke-width=".18"/><text x="${p[0]}" y="${p[1]}" text-anchor="middle" font-size="1.25" font-weight="700" fill="#193f43">TANK ${i+1}</text>`;}
 const line=(path:Point3[],e:Entity,color:string,dashed=false)=>{
  const active=!selected||e.facility?.circuit===selected;
  return path.slice(1).map((end,i)=>{let a=path[i],p=end;if(!showUnderground){if(a[1]<0&&p[1]<0)return '';if(a[1]*p[1]<0){const t=-a[1]/(p[1]-a[1]),cut=a.map((v,j)=>v+(p[j]-v)*t) as Point3;if(a[1]<0)a=cut;else p=cut;}}return `<polyline points="${points([a,p])}" fill="none" stroke="${color}" stroke-width="${selected&&active ? .23 : .14}" stroke-linejoin="round" stroke-linecap="round" opacity="${active?1:.28}" ${dashed||p[1]<-.05||path[i][1]<-.05?'stroke-dasharray=".35 .18"':''}/>`;}).join('');
 };
 for(const e of entities){const f=e.facility;if(f?.reference!==FIRE_REFERENCE)continue;
  let body='';if(f.pipePath&&e.preset!=='PIPE_RACK')body+=line(f.pipePath.map(p=>localToWorld(e,p)),e,e.color);
  for(const key of ['supplyId','concentrateId'] as const){const source=map.get(f[key]||'');if(source)body+=line(referenceConnectionPoints(source,e,key),e,key==='concentrateId'||f.circuit==='concentrate'?'#98701a':e.color,key==='concentrateId');}
  const p=xy(e.position);
  if(e.preset==='PIPE_VALVE')body+=`<path d="M${p[0]-.25},${p[1]-.28} l.5,.56 v-.56 l-.5,.56 Z" fill="#fff" stroke="#193f43" stroke-width=".10"/>`;
  if(e.preset==='FOAM_EDUCTOR')body+=`<rect x="${p[0]-.25}" y="${p[1]-.5}" width=".5" height="1" fill="#f5db68" stroke="#8b6c17" stroke-width=".1"/>`;
  if(e.preset==='FIRE_MONITOR')body+=`<circle cx="${p[0]}" cy="${p[1]}" r=".42" fill="#fff" stroke="#b63530" stroke-width=".22"/><text x="${p[0]-.7}" y="${p[1]-1.1}" text-anchor="end" font-size=".85" fill="#783b35">${escape(f.tag||'MON')}</text>`;
  if(e.preset==='WATER_SOURCE')body+=`<circle cx="${p[0]}" cy="${p[1]}" r=".4" fill="#17777b"/><text x="${p[0]-1}" y="${p[1]-.7}" text-anchor="end" font-size=".85" font-weight="700" fill="#17777b">${escape(f.tag||'SU')}</text>`;
  if(body)drawing+=`<g data-circuit="${escape(f.circuit||'')}" tabindex="0" role="button" aria-label="${escape(e.name)}"><title>${escape(e.name)}</title>${body}</g>`;
 }
 const stores=entities.filter(e=>e.preset==='FOAM_TANK'&&frame.local(e.position)[2]<-25);
 for(const [i,store] of stores.entries()){const p=xy(store.position);drawing+=`<rect x="${p[0]-.55}" y="${p[1]-.6}" width="1.1" height="1.2" rx=".15" fill="#f5db68" stroke="#98701a" stroke-width=".13"/>`;if(!i)drawing+=`<text x="${p[0]+3}" y="${p[1]+2}" font-size=".8" fill="#715d22">KÖPÜK DEPOSU</text>`;}
 const header=entities.find(e=>e.id==='adb-fire-water-header');if(header){const p=xy(header.position);drawing+=`<text x="${p[0]-9}" y="${p[1]+5.5}" font-size=".8" fill="#537074">VANA GRUBU · DEPO YANI</text>`;}
 drawing+='<text x="-14.5" y="-32" font-size="1.2" fill="#193f43" font-weight="700">SOCAR · ADB</text><text x="-14.5" y="-30.3" font-size=".72" fill="#537074">YANGIN SUYU / KÖPÜK HATLARI</text>';
 drawing+='<text x="-14.5" y="43" font-size=".62" fill="#537074">Kesikli çizgi: kanal / yer altı geçişi · Kesin kot ve gizli güzergâh teyit bekliyor</text><text x="-14.5" y="44.3" font-size=".62" fill="#537074">Eğitim modeli · Mevcut araç yolları ve nesne konumları korunmuştur</text>';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -34 51 80" role="img" aria-label="SOCAR ADB yangın suyu ve köpük güzergâhları" style="font-family:Arial,sans-serif;background:#fff"><rect x="-16" y="-34" width="51" height="80" fill="#fff"/>${drawing}</svg>`;
}
