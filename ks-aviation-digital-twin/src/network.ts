import type { Globe } from './globe';
export const NETWORK_NODES=[
 {code:'ESB',city:'Ankara Esenboğa',lat:40.1281,lon:32.9951,category:'airports'},
 {code:'IST',city:'İstanbul Havalimanı',lat:41.2753,lon:28.7519,category:'airports'},
 {code:'STAD',city:'STAD',lat:38.77369014256039,lon:26.934985845352717,category:'storage'},
 {code:'SHELL_DERINCE',city:'Shell Derince',lat:40.75091382676806,lon:29.84143928846036,category:'storage'},
 {code:'CEKISAN',city:'Akdeniz Antalya',lat:36.833929561167764,lon:30.608310104733643,category:'storage'},
 {code:'SHELL_ANTALYA',city:'Shell Antalya',lat:36.84010154021184,lon:30.601020997984982,category:'storage'},
 {code:'KIRIKKALE',city:'Kırıkkale',lat:39.742613564257525,lon:33.45950705873421,category:'storage'},
 {code:'STAR',city:'STAR',lat:38.79846944238605,lon:26.928110595144215,category:'aliaga'},
 {code:'PETKIM',city:'Petkim',lat:38.78602081112696,lon:26.93490712857334,category:'aliaga'},
 {code:'S_BINA',city:'S Bina',lat:38.78906551429275,lon:26.94969317741288,category:'aliaga'},
 {code:'LHR',city:'London Heathrow',lat:51.47,lon:-.4543,category:'world'},
 {code:'DXB',city:'Dubai International',lat:25.2532,lon:55.3657,category:'world'},
 {code:'JFK',city:'New York JFK',lat:40.6413,lon:-73.7781,category:'world'}
];
// Existing KS network topology, retained as an illustrative training network.
export const NETWORK_ROUTES=[
 ['SEA_DERINCE','sea','STAD','SHELL_DERINCE'],['SEA_AKDENIZ','sea','STAD','CEKISAN'],['SEA_SHELL_ANTALYA','sea','STAD','SHELL_ANTALYA'],
 ['ROAD_ADB','road','STAD','ADB'],['ROAD_BJV','road','STAD','BJV'],['ROAD_DLM','road','STAD','DLM'],['ROAD_ESB','road','KIRIKKALE','ESB'],['ROAD_SAW','road','SHELL_DERINCE','SAW'],['ROAD_IST','road','SHELL_DERINCE','IST'],['ROAD_AYT_AKDENIZ','road','CEKISAN','AYT'],['ROAD_GZP_AKDENIZ','road','CEKISAN','GZP'],['ROAD_AYT_SHELL','road','SHELL_ANTALYA','AYT'],['ROAD_GZP_SHELL','road','SHELL_ANTALYA','GZP']
] as const;
type Point={code:string;city:string;lat:number;lon:number;category?:string};
export class NetworkPanel{
 private lang:'tr'|'en'='tr';private mode='operations';private running=new Set<string>();private layers=new Set(['airports','storage']);private sea=true;private road=true;readonly element=document.createElement('aside');
 constructor(host:HTMLElement,private globe:Globe,private points:Point[],private select:(p:Point)=>void){this.element.className='network-panel';host.appendChild(this.element);this.render();this.apply();}
 private t(tr:string,en:string){return this.lang==='tr'?tr:en;}
 setLanguage(lang:'tr'|'en'){this.lang=lang;this.render();}
 private name(code:string){return this.points.find(p=>p.code===code)?.city||code;}
 private apply(){const visible=new Set(this.points.filter(p=>this.mode==='logistics'?['airports','storage'].includes(p.category||'airports'):this.layers.has(p.category||'airports')).map(p=>p.code));this.globe.setLayers(visible);this.globe.setRoutes(this.mode==='logistics'?NETWORK_ROUTES.filter(([id,type])=>this.running.has(id)&&(type==='sea'?this.sea:this.road)).map(([id,type,from,to])=>({id,type,from:this.points.find(p=>p.code===from)!,to:this.points.find(p=>p.code===to)!})):[]);}
 private render(){
 this.element.innerHTML=`<details open><summary>${this.t('Operasyon ve lojistik','Operations & logistics')}</summary><div class="network-tabs"><button data-mode="operations" class="${this.mode==='operations'?'active':''}">${this.t('Operasyon','Operations')}</button><button data-mode="logistics" class="${this.mode==='logistics'?'active':''}">${this.t('Lojistik','Logistics')}</button></div>${this.mode==='operations'?`<div class="network-layers">${[['airports',this.t('Meydanlar','Airports')],['storage',this.t('Depolama / çıkış','Storage / dispatch')],['aliaga',this.t('Aliağa tesisleri','Aliağa facilities')],['world',this.t('Dünya havalimanları','World airports')]].map(([id,name])=>`<label><input type="checkbox" data-layer="${id}" ${this.layers.has(id)?'checked':''}>${name}</label>`).join('')}</div>`:`<p>JET A1 · ${this.t('Deniz + kara ağı','Sea + road network')}</p><div class="network-layers"><label><input type="checkbox" data-transport="sea" ${this.sea?'checked':''}>${this.t('Deniz taşıması','Sea transport')}</label><label><input type="checkbox" data-transport="road" ${this.road?'checked':''}>${this.t('Kara taşıması','Road transport')}</label></div><div class="network-tabs"><button data-run="all">▶ ${this.t('Tüm ağı başlat','Run network')}</button><button data-run="stop">■ ${this.t('Durdur / temizle','Stop / clear')}</button></div><small>${this.t('Şematik eğitim rotaları; gerçek yol/deniz güzergâhı ve canlı sevkiyat değildir.','Schematic training routes; not navigable road/sea paths or live dispatch.')}</small><output>${this.running.size} ${this.t('etkin bağlantı','active connections')}</output><div class="network-routes">${NETWORK_ROUTES.map(([id,type,from,to])=>`<button data-route="${id}" class="${this.running.has(id)?'active':''}">${type==='sea'?'⚓':'▰'} ${this.name(from)} → ${to}</button>`).join('')}</div>`}<label class="network-search">${this.t('Yer seç / haritada git','Select location / focus')}<select aria-label="${this.t('Ağ konumu','Network location')}"><option value="">${this.t('Bir yer seçin…','Select a location…')}</option>${this.points.map(p=>`<option value="${p.code}">${p.city}</option>`).join('')}</select></label></details>`;
 this.element.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.onclick=()=>{this.mode=b.dataset.mode!;this.globe.focus('turkey');this.apply();this.render();});
 this.element.querySelectorAll<HTMLInputElement>('[data-layer]').forEach(i=>i.onchange=()=>{i.checked?this.layers.add(i.dataset.layer!):this.layers.delete(i.dataset.layer!);this.apply();});
 this.element.querySelectorAll<HTMLInputElement>('[data-transport]').forEach(i=>i.onchange=()=>{if(i.dataset.transport==='sea')this.sea=i.checked;else this.road=i.checked;this.apply();});
 this.element.querySelectorAll<HTMLButtonElement>('[data-run],[data-route]').forEach(b=>b.onclick=()=>{if(b.dataset.run==='stop')this.running.clear();else if(b.dataset.run==='all')this.running=new Set(NETWORK_ROUTES.filter(([,type])=>type==='sea'?this.sea:this.road).map(([id])=>id));else{const id=b.dataset.route!;this.running.has(id)?this.running.delete(id):this.running.add(id);}this.apply();this.render();});
 this.element.querySelector('select')!.onchange=e=>{const p=this.points.find(p=>p.code===(e.target as HTMLSelectElement).value);if(p){this.globe.focus('airport',p);this.select(p);}};
 }
}
