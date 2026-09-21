import { GSE_SPECS, type GSESpec } from './gse-specs';
/** Lightweight, native vector silhouettes keep the library fast on phones. */
function icon(s:GSESpec){
  const tires='<g fill="#20343c" stroke="#99b7c0" stroke-width="3"><circle cx="57" cy="56" r="9"/><circle cx="223" cy="56" r="9"/></g>';
  const shape=s.type==='bus'?'<rect x="19" y="9" width="242" height="45" rx="6" fill="#e4ebec"/><path d="M24 15h232v21H24z" fill="#335766"/><path d="M37 14v23m35-23v23m35-23v23m35-23v23m35-23v23m35-23v23m35-23v23" stroke="#e4ebec" stroke-width="4"/><path d="M22 40h235" stroke="#57bdad" stroke-width="5"/>':s.type==='tractor'?'<path d="M38 51V32h59V8h73v27h72v16" fill="#e6c845"/><path d="M105 13h57v26h-57z" fill="#335766"/>':s.type==='belt'?'<path d="M35 52h208V36H127V15H82v24H35z" fill="#b6cbd2"/><path d="M16 16L260 43" stroke="#273f49" stroke-width="9"/><path d="M18 11L262 38" stroke="#d0e1e5" stroke-width="3"/>':'<path d="M18 51h37m0 0h197V25H55z" fill="none" stroke="#a2bdc6" stroke-width="5"/>'+ (s.loaded?'<path d="M69 46V27h35v19m9 0V22h33v24m10 0V29h34v17m10 0V23h35v23" fill="#b59a67" stroke="#1d4555" stroke-width="3"/>':'');
  return `<svg viewBox="0 0 280 70" aria-hidden="true">${shape}${tires}</svg>`;
}
export class GSELibrary{
  readonly element=document.createElement('aside');private lang:'tr'|'en'='tr';
  constructor(host:HTMLElement,private place:(preset:string,center:boolean)=>void){this.element.className='ws-library';this.element.hidden=true;host.appendChild(this.element);}
  private t(tr:string,en:string){return this.lang==='tr'?tr:en;}
  setLanguage(lang:'tr'|'en'){this.lang=lang;if(!this.element.hidden)this.render();}
  toggle(){this.element.hidden=!this.element.hidden;if(!this.element.hidden)this.render();}
  private render(){
    this.element.innerHTML=`<header><strong>${this.t('Yer hizmetleri araç kütüphanesi','Ground service vehicle library')}</strong><button data-close aria-label="${this.t('Kütüphaneyi kapat','Close library')}">×</button></header><p>${this.t('Gerçek ölçekte 3D modeller. İstediğiniz aracı seçip haritaya yerleştirin.','Full-scale 3D models. Choose a vehicle and place it on the map.')}</p><small>${this.t('Boy × en × yükseklik · metre. Ana ölçüler üretici kaynağına dayanır; gövde ayrıntıları sadeleştirilmiştir.','Length × width × height · metres. Main dimensions follow manufacturer data; body details are simplified.')}</small>${Object.values(GSE_SPECS).map(s=>`<article>${icon(s)}<h3>${this.lang==='tr'?s.tr:s.en}</h3><small>${s.model}</small><strong class="gse-dimensions">${s.length} × ${s.width} × ${s.height} m</strong><small>${this.lang==='tr'?s.noteTr:s.noteEn}</small><a href="${s.source}" target="_blank" rel="noopener">${this.t('Üretici / ölçü kaynağı','Manufacturer / dimensional source')} ↗</a>${s.drawingSource?` · <a href="${s.drawingSource}" target="_blank" rel="noopener">${this.t('Teknik çizim','Technical drawing')}</a>`:''}<div class="ws-row"><button data-place="${s.id}">${this.t('Haritada yerleştir','Place on map')}</button><button data-center="${s.id}">${this.t('Merkeze ekle ve git','Add at center & focus')}</button></div></article>`).join('')}`;
    this.element.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>this.toggle();
    this.element.querySelectorAll<HTMLButtonElement>('[data-place],[data-center]').forEach(b=>b.onclick=()=>{this.element.hidden=true;this.place(b.dataset.place||b.dataset.center!,!!b.dataset.center);});
  }
}
