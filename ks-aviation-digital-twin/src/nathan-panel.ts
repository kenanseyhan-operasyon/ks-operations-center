import type { Entity } from './scene-data';
import { NATHAN_PRESET, type NathanSettings } from './nathan-data';
import { NathanActors } from './nathan-model';
import type { NathanController } from './nathan-controller';
import './nathan.css';

type Hooks = {
  entity: (id: string) => Entity | undefined;
  configure: (e: Entity, settings: NathanSettings) => void;
  edit: () => void;
  ready: () => boolean;
  close?: () => void;
};
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export class NathanPanel {
  readonly element = document.createElement('aside');
  private id?: string;
  private lang: 'tr' | 'en' = 'tr';
  private signature = '';
  constructor(host: HTMLElement, private actors: NathanActors, private hooks: Hooks, private control?: NathanController) {
    this.element.className = 'ws-nathan'; this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Personeli Yönet — Nathan');
    host.append(this.element);
  }
  private t(tr: string, en: string) { return this.lang === 'tr' ? tr : en; }
  setLanguage(lang: 'tr' | 'en') { this.lang = lang; this.signature = ''; this.sync(); }
  open(e: Entity) {
    if (e.preset !== NATHAN_PRESET) return;
    this.id = e.id; this.signature = ''; this.element.hidden = false; this.sync();
  }
  close() { this.element.hidden = true; }
  selection(e?: Entity) {
    if (!e || e.preset !== NATHAN_PRESET) { this.close(); this.id = undefined; }
    else { this.id = e.id; this.sync(); }
  }
  sync() {
    if (this.element.hidden || !this.id) return;
    const entity = this.hooks.entity(this.id);
    if (!entity) { this.close(); return; }
    const state = this.actors.states.get(this.id), actor = state?.actor;
    const control = this.control, support = entity.nathan?.support;
    const access = control?.nearby() || [];
    const roofs = control?.roofOptions() || [];
    const expanded = this.element.querySelector<HTMLDetailsElement>('details')?.open || false;
    const signature = JSON.stringify([this.id, entity.name, this.lang, state?.status, Math.floor((state?.progress || 0) * 100),
      actor?.index, actor?.playing, actor?.settings.clip, actor?.settings.speed, actor?.settings.loop, this.hooks.ready(), control?.mode, control?.view, control?.phase, control?.message, support?.kind, support?.targetId, !!support, access, roofs]);
    if (signature === this.signature) return;
    this.signature = signature;
    const status = !this.hooks.ready() ? this.t('Animasyon için 3D görünümünü açın.', 'Switch to 3D to preview animations.') :
      state?.status === 'error' ? this.t('Nathan modeli yüklenemedi. Bağlantıyı kontrol edip tekrar deneyin.', 'Nathan could not load. Check the connection and retry.') :
      !actor ? this.t(`Model yükleniyor… ${Math.floor((state?.progress || 0) * 100)}%`, `Loading model… ${Math.floor((state?.progress || 0) * 100)}%`) :
      this.t(`${actor.clips.length} hareket · ${actor.playing ? 'Oynatılıyor' : 'Durduruldu'}`, `${actor.clips.length} clips · ${actor.playing ? 'Playing' : 'Stopped'}`);
    this.element.innerHTML = `<header><div><small>${this.t(control ? 'PERSONELİ YÖNET' : 'PERSONEL · ANİMASYON', control ? 'MANAGE OPERATOR' : 'PERSONNEL · ANIMATION')}</small><strong>${esc(entity.name)}</strong></div><button data-nathan="close" aria-label="${this.t('Paneli kapat', 'Close panel')}">×</button></header>
      ${control ? `<div class="nathan-modes" role="group" aria-label="Kontrol modu"><button data-nathan="person" aria-pressed="${control.capturing}">🚶 ${this.t('Personeli Yönet', 'Manage operator')}</button><button data-nathan="camera" aria-pressed="${control.mode === 'camera'}">${this.t('Kamera', 'Camera')}</button></div>
      <p class="nathan-help">${control.view==='eyes'?this.t('V: serbest görünüme dön. Sürükle: etrafa bak. Kısa tıkla / dokun: hedef ver.','V: return to free view. Drag to look; tap to set a target.'):control.capturing ? this.t('Tıkla / dokun: yürü. Sol sürükle / tek parmak: haritayı kaydır. Sağ sürükle: döndür. Tekerlek / iki parmak: yakınlaş. Geçiş merdiveni: karşı tarafa geç.', 'Click / tap to walk. Left drag / one finger to pan. Right drag to orbit. Wheel / two fingers to zoom. Crossover stairs lead to the other side.') : this.t('Kamera kontrolleri açık. Hedef vermek için Personeli Yönet seçin.', 'Camera controls are active. Choose Manage operator to set a target.')}</p>
      <div class="nathan-views">${(['eyes','rear','front','top','free'] as const).map((v,i)=>`<button data-nathan-view="${v}" aria-pressed="${control.view===v}">${[this.t('Gözünden · V','Eyes · V'),this.t('Arkadan','Rear'),this.t('Önden','Front'),this.t('Üstten','Top'),this.t('Serbest','Free')][i]}</button>`).join('')}</div>
      <p class="nathan-motion" role="status">${esc(control.message)}</p>
      <div class="nathan-playback"><button data-nathan="halt">${this.t('Hareketi durdur', 'Stop movement')}</button>${support ? `<button data-nathan="descend">${support.kind==='driver'?this.t('Araçtan in','Exit vehicle'):this.t('Merdivenden in', 'Descend')}</button>` : ''}${control.phase === 'paused' ? `<button data-nathan="resume">${this.t('Harekete devam', 'Resume movement')}</button>` : ''}</div>
      ${!support && access.length ? `<label class="nathan-access-label">${this.t('Yakındaki merdivenler', 'Nearby access')}<select data-nathan-access aria-label="Merdiven seç"><option value="">${this.t('Merdiven seç…', 'Choose access…')}</option>${access.map((a, i) => `<option value="${i}">${esc(a.name)} · ${a.kind==='driver'?this.t('Sürücü kapısı · araca bin','Driver door · board'):a.kind === 'rear' ? this.t('Arka merdiven', 'Rear ladder') : a.kind === 'platform' ? this.t('İkmal platformu', 'Refuelling platform') : a.kind === 'tank' ? this.t('Tank merdiveni', 'Tank stairs') : this.t('Basamaklı merdiven', 'Stairs')}</option>`).join('')}</select></label>` : ''}
      ${control.seated?`<div class="nathan-drive-pad">${[['w','↑'],['a','←'],[' ','Fren'],['d','→'],['s','↓'],['q','Sol sinyal'],['e','Sağ sinyal'],['h','Dörtlü'],['i','Motor'],['c','Kabin · C']].map(([key,label])=>`<button data-nathan-drive="${key}">${label}</button>`).join('')}</div>`:''}
      ${support?.kind==='platform'&&support.progress===1?`<button data-nathan="lift">${this.t('Platformu yükselt / indir','Raise / lower platform')}</button>`:''}
      ${support?.kind==='tank' ? `<p class="nathan-help">${this.t('Çatıdaki boş noktaya tıkla: yürü. Bağlı köprüye veya diğer tanka tıkla: köprüden geç. Zemine tıkla: merdivenden in ve yürü.', 'Click clear roof to walk, a connected bridge / tank to cross, or ground to descend and walk.')}</p>` : ''}
      ${roofs.length ? `<label class="nathan-access-label">${this.t('Köprüden diğer tanka geç', 'Cross to another tank')}<select data-nathan-roof aria-label="Tank üstü hedefi"><option value="">${this.t('Tank seç…','Choose tank…')}</option>${roofs.map((r,i)=>`<option value="${i}">${esc(r.name)} · ${esc(r.bridge)}</option>`).join('')}</select></label>` : ''}
      <details ${expanded ? 'open' : ''}><summary>${this.t('16 hareket · animasyon önizlemesi', '16 clips · animation preview')}</summary>` : ''}
      <p class="nathan-status" role="status">${status}</p>
      ${state?.status === 'error' ? `<button data-nathan="retry">${this.t('Yeniden yükle', 'Retry loading')}</button>` : ''}
      <fieldset ${!actor || !this.hooks.ready() ? 'disabled' : ''}>
        <label>${this.t('Hareket seç', 'Choose animation')}<select data-nathan-clips size="6" aria-label="${this.t('Nathan hareketleri', 'Nathan animations')}">${actor?.clips.map((clip, i) => `<option value="${i}" ${i === actor.index ? 'selected' : ''}>${i + 1}. ${esc(clip.name || `Animation ${i + 1}`)} · ${clip.duration.toFixed(2)} s</option>`).join('') || ''}</select></label>
        <div class="nathan-playback"><button data-nathan="play" ${actor?.playing ? 'disabled' : ''}>▶ ${this.t('Oynat', 'Play')}</button><button data-nathan="pause" ${!actor?.playing ? 'disabled' : ''}>Ⅱ ${this.t('Duraklat', 'Pause')}</button><button data-nathan="stop">■ ${this.t('Durdur', 'Stop')}</button></div>
        <div class="nathan-options"><label><input data-nathan-loop type="checkbox" ${actor?.settings.loop ? 'checked' : ''}> ${this.t('Tekrarla', 'Loop')}</label><label>${this.t('Hız', 'Speed')} <select data-nathan-speed aria-label="${this.t('Oynatma hızı', 'Playback speed')}">${[.25, .5, 1, 1.5, 2].map(speed => `<option value="${speed}" ${actor?.settings.speed === speed ? 'selected' : ''}>${speed}×</option>`).join('')}</select></label></div>
      </fieldset>
      ${control ? '</details>' : ''}
      <p class="nathan-scope">${this.t('Önizleme zeminde kullanılır; hareketi durdurur. Hortum fiziği ve uçak bağlantısı sonraki aşamalarda eklenecek.', 'Preview stops movement. Hose physics and aircraft connections are planned for later stages.')}</p>
      <button data-nathan="edit">${this.t('Nesneyi düzenle · taşı / döndür / sil', 'Edit object · move / rotate / delete')}</button>`;
    this.element.querySelectorAll<HTMLButtonElement>('[data-nathan-view]').forEach(b=>b.onclick=()=>control?.setView(b.dataset.nathanView as 'eyes'|'rear'|'front'|'top'|'free'));
    this.element.querySelectorAll<HTMLButtonElement>('[data-nathan-drive]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);control?.driveKey(b.dataset.nathanDrive!,true);};const release=()=>control?.driveKey(b.dataset.nathanDrive!,false);b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;});
    const save = () => { if (actor) this.hooks.configure(entity, { ...actor.settings }); };
    this.element.querySelector<HTMLSelectElement>('[data-nathan-clips]')!.onchange = event => {
      if(control?.preview()===false)return; actor?.select(Number((event.target as HTMLSelectElement).value)); save(); this.sync();
    };
    this.element.querySelector<HTMLInputElement>('[data-nathan-loop]')!.onchange = event => {
      if(control?.preview()===false)return; if (actor) actor.configure({ ...actor.settings, loop: (event.target as HTMLInputElement).checked }); save(); this.sync();
    };
    this.element.querySelector<HTMLSelectElement>('[data-nathan-speed]')!.onchange = event => {
      if(control?.preview()===false)return; if (actor) actor.configure({ ...actor.settings, speed: Number((event.target as HTMLSelectElement).value) }); save(); this.sync();
    };
    const chooseAccess = this.element.querySelector<HTMLSelectElement>('[data-nathan-access]');
    if (chooseAccess) chooseAccess.onchange = () => { const item = access[Number(chooseAccess.value)]; if (chooseAccess.value && item) control?.climb(item.id, item.kind); };
    const chooseRoof=this.element.querySelector<HTMLSelectElement>('[data-nathan-roof]');
    if(chooseRoof)chooseRoof.onchange=()=>{const item=roofs[Number(chooseRoof.value)];if(chooseRoof.value&&item)control?.tankTo(item.id);};
    this.element.querySelectorAll<HTMLButtonElement>('[data-nathan]').forEach(button => button.onclick = () => {
      switch (button.dataset.nathan) {
        case 'lift': control?.togglePlatform(); break;
        case 'close': control?.close(); this.close(); this.hooks.close?.(); break;
        case 'person': control?.setMode('person'); break;
        case 'camera': control?.setMode('camera'); break;
        case 'halt': control?.pause(); break;
        case 'descend': control?.descend(); break;
        case 'resume': control?.resume(); break;
        case 'retry': this.actors.retry(entity); break;
        case 'play': if(control?.preview()===false)return; actor?.play(); break;
        case 'pause': if(control?.preview()===false)return; actor?.pause(); break;
        case 'stop': if(control?.preview()===false)return; actor?.stop(); break;
        case 'edit': control?.close(); this.close(); this.hooks.edit(); break;
      }
      this.sync();
    });
  }
}
