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
export const NETWORK_ROUTES=[
 ['SEA_DERINCE','sea','STAD','SHELL_DERINCE'],['SEA_AKDENIZ','sea','STAD','CEKISAN'],['SEA_SHELL_ANTALYA','sea','STAD','SHELL_ANTALYA'],
 ['ROAD_ADB','road','STAD','ADB'],['ROAD_BJV','road','STAD','BJV'],['ROAD_DLM','road','STAD','DLM'],['ROAD_ESB','road','KIRIKKALE','ESB'],['ROAD_SAW','road','SHELL_DERINCE','SAW'],['ROAD_IST','road','SHELL_DERINCE','IST'],['ROAD_AYT_AKDENIZ','road','CEKISAN','AYT'],['ROAD_GZP_AKDENIZ','road','CEKISAN','GZP'],['ROAD_AYT_SHELL','road','SHELL_ANTALYA','AYT'],['ROAD_GZP_SHELL','road','SHELL_ANTALYA','GZP']
] as const;
type Point={code:string;city:string;lat:number;lon:number;category?:string};
type Mode='browse'|'operations'|'logistics';
export class NetworkPanel{
 private lang:'tr'|'en'='tr';private mode:Mode='browse';private running=new Set<string>();private layers=new Set(['airports']);private sea=true;private road=true;private panelOpen=false;private dockOpen=false;
 readonly element=document.createElement('aside');readonly dock=document.createElement('div');readonly panelToggle=document.createElement('button');private modeButtons=document.createElement('div');private status=document.createElement('div');
 constructor(host:HTMLElement,private globe:Globe,private points:Point[],private select:(p:Point)=>void,private navigate:()=>void){
  this.element.className='network-panel';this.element.id='networkPanel';this.element.setAttribute('aria-label','Harita katmanları ve lojistik');
  this.dock.className='network-dock';this.dock.id='networkDock';this.panelToggle.className='network-panel-toggle';this.modeButtons.className='network-mode-buttons';this.status.className='network-status';this.status.setAttribute('role','status');
  host.querySelector('.globe-controls')!.appendChild(this.modeButtons);host.append(this.element,this.dock,this.panelToggle,this.status);this.render();this.apply();
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){this.panelOpen=false;this.dockOpen=false;this.render();}});
 }
 private t(tr:string,en:string){return this.lang==='tr'?tr:en;}
 setLanguage(lang:'tr'|'en'){this.lang=lang;this.render();}
 browse(){this.mode='browse';this.panelOpen=false;this.dockOpen=false;this.apply();this.render();}
 private short(code:string){return code==='SHELL_DERINCE'?'DERİNCE':code==='SHELL_ANTALYA'?'SHELL AYT':code==='CEKISAN'?'AKDENİZ':code;}
 private activeRoutes(){return this.mode==='logistics'?NETWORK_ROUTES.filter(([id,type])=>this.running.has(id)&&(type==='sea'?this.sea:this.road)).map(([id,type,from,to])=>({id,type,from:this.points.find(p=>p.code===from)!,to:this.points.find(p=>p.code===to)!})):[];}
 private apply(){
  const routes=this.activeRoutes(),endpoints=new Set(routes.flatMap(r=>[r.from.code,r.to.code]));
  const visible=new Set(this.points.filter(p=>this.mode==='logistics'?(routes.length?endpoints.has(p.code):['airports','storage'].includes(p.category||'airports')):this.layers.has(p.category||'airports')).map(p=>p.code));
  this.globe.setLayers(visible);this.globe.setRoutes(routes);
  this.status.textContent=this.mode==='logistics'?(routes.length?routes.map(r=>`${this.short(r.from.code)} → ${this.short(r.to.code)}`).join(' · '):this.t('Bağlantılar menüsünden bir rota seçin','Choose a route from Connections')):'';
  this.status.hidden=this.mode!=='logistics';
 }
 private chooseRoute(id:string){if(this.running.has(id))this.running.clear();else this.running=new Set([id]);this.apply();this.render();}
 private renderDock(){
  const places=this.points.filter(p=>this.layers.has(p.category||'airports'));
  const routes=NETWORK_ROUTES.filter(([,type])=>type==='sea'?this.sea:this.road);
  const count=this.mode==='logistics'?routes.length:places.length;
  const title=this.mode==='logistics'?this.t('Bağlantılar','Connections'):this.t('Meydanlar / tesisler','Airports / facilities');
  this.dock.className=`network-dock ${this.dockOpen?'expanded':'collapsed'}`;
  this.dock.innerHTML=`<button class="network-dock-toggle" aria-expanded="${this.dockOpen}" aria-controls="networkDockItems">${title} <span>${count}</span> ${this.dockOpen?'⌄':'⌃'}</button><div id="networkDockItems" class="network-dock-scroll" ${this.dockOpen?'':'hidden'}>${this.mode==='logistics'?routes.map(([id,type,from,to])=>`<button data-route="${id}" aria-pressed="${this.running.has(id)}" class="${this.running.has(id)?'active':''}"><b>${this.short(from)} → ${this.short(to)}</b><small>${type==='sea'?this.t('Deniz','Sea'):this.t('Kara','Road')}</small></button>`).join(''):places.map(p=>`<button data-place="${p.code}" class="${p.code==='ADB'?'primary':''}"><b>${this.short(p.code)}</b><small>${p.city}</small></button>`).join('')}</div>`;
  this.dock.querySelector<HTMLButtonElement>('.network-dock-toggle')!.onclick=()=>{this.dockOpen=!this.dockOpen;if(this.dockOpen&&innerWidth<700)this.panelOpen=false;this.render();};
  this.dock.querySelectorAll<HTMLButtonElement>('[data-place]').forEach(b=>b.onclick=()=>{const p=this.points.find(p=>p.code===b.dataset.place);if(p){this.panelOpen=false;this.dockOpen=false;this.render();this.select(p);}});
  this.dock.querySelectorAll<HTMLButtonElement>('[data-route]').forEach(b=>b.onclick=()=>this.chooseRoute(b.dataset.route!));
 }
 private render(){
  this.modeButtons.innerHTML=`<button data-mode="operations" aria-pressed="${this.mode==='operations'}" class="${this.mode==='operations'?'active':''}">${this.t('Operasyon','Operations')}</button><button data-mode="logistics" aria-pressed="${this.mode==='logistics'}" class="${this.mode==='logistics'?'active':''}">${this.t('Lojistik','Logistics')}</button>`;
  this.modeButtons.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.onclick=()=>{this.mode=b.dataset.mode as Mode;this.panelOpen=false;this.dockOpen=false;this.apply();this.render();this.navigate();});
  const label=this.mode==='logistics'?this.t('Rota ayarları','Route options'):this.t('Katmanlar','Layers');
  this.panelToggle.textContent=`${this.panelOpen?'×':'☷'} ${label}`;this.panelToggle.setAttribute('aria-expanded',String(this.panelOpen));this.panelToggle.setAttribute('aria-controls','networkPanel');this.panelToggle.onclick=()=>{this.panelOpen=!this.panelOpen;if(this.panelOpen&&innerWidth<700)this.dockOpen=false;this.render();};
  this.element.hidden=!this.panelOpen;
  this.element.innerHTML=`<div class="network-panel-head"><strong>${label}</strong><button data-close aria-label="${this.t('Paneli kapat','Close panel')}">×</button></div>${this.mode!=='logistics'?`<div class="network-layers">${[['airports',this.t('Meydanlar','Airports')],['storage',this.t('Depolama / çıkış','Storage / dispatch')],['aliaga',this.t('Aliağa tesisleri','Aliağa facilities')],['world',this.t('Dünya havalimanları','World airports')]].map(([id,name])=>`<label><input type="checkbox" data-layer="${id}" ${this.layers.has(id)?'checked':''}>${name}</label>`).join('')}</div>`:`<div class="network-layers"><label><input type="checkbox" data-transport="sea" ${this.sea?'checked':''}>${this.t('Deniz taşıması','Sea transport')}</label><label><input type="checkbox" data-transport="road" ${this.road?'checked':''}>${this.t('Kara taşıması','Road transport')}</label></div><div class="network-tabs"><button data-run="all">${this.t('Tüm bağlantılar','All connections')}</button><button data-run="stop">${this.t('Durdur / temizle','Stop / clear')}</button></div><output>${this.activeRoutes().length} ${this.t('etkin bağlantı','active connections')}</output><small>${this.t('Şematik eğitim bağlantıları; gerçek yol veya sefer takibi değildir.','Schematic training links; not actual roads or live journeys.')}</small>`}<label class="network-search">${this.t('Yer seç / haritada git','Select location / focus')}<select aria-label="${this.t('Ağ konumu','Network location')}"><option value="">${this.t('Bir yer seçin…','Select a location…')}</option>${this.points.map(p=>`<option value="${p.code}">${p.city}</option>`).join('')}</select></label>`;
  this.element.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>{this.panelOpen=false;this.render();};
  this.element.querySelectorAll<HTMLInputElement>('[data-layer]').forEach(i=>i.onchange=()=>{if(this.mode==='browse')this.mode='operations';i.checked?this.layers.add(i.dataset.layer!):this.layers.delete(i.dataset.layer!);this.apply();this.render();});
  this.element.querySelectorAll<HTMLInputElement>('[data-transport]').forEach(i=>i.onchange=()=>{if(i.dataset.transport==='sea')this.sea=i.checked;else this.road=i.checked;this.apply();this.render();});
  this.element.querySelectorAll<HTMLButtonElement>('[data-run]').forEach(b=>b.onclick=()=>{this.running=b.dataset.run==='stop'?new Set():new Set(NETWORK_ROUTES.filter(([,type])=>type==='sea'?this.sea:this.road).map(([id])=>id));this.apply();this.render();});
  this.element.querySelector('select')!.onchange=e=>{const p=this.points.find(p=>p.code===(e.target as HTMLSelectElement).value);if(p){this.panelOpen=false;this.dockOpen=false;this.render();this.select(p);}};
  this.renderDock();
 }
}
