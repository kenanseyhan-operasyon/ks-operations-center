import type { Entity } from './scene-data';
import { NATHAN_PRESET, type NathanSettings } from './nathan-data';
import { NathanActors } from './nathan-model';
import './nathan.css';

type Hooks = {
  entity: (id: string) => Entity | undefined;
  configure: (e: Entity, settings: NathanSettings) => void;
  edit: () => void;
  ready: () => boolean;
};
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export class NathanPanel {
  readonly element = document.createElement('aside');
  private id?: string;
  private lang: 'tr' | 'en' = 'tr';
  private signature = '';
  constructor(host: HTMLElement, private actors: NathanActors, private hooks: Hooks) {
    this.element.className = 'ws-nathan'; this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Nathan animasyonları');
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
    const signature = JSON.stringify([this.id, entity.name, this.lang, state?.status, Math.floor((state?.progress || 0) * 100),
      actor?.index, actor?.playing, actor?.settings, this.hooks.ready()]);
    if (signature === this.signature) return;
    this.signature = signature;
    const status = !this.hooks.ready() ? this.t('Animasyon için 3D görünümünü açın.', 'Switch to 3D to preview animations.') :
      state?.status === 'error' ? this.t('Nathan modeli yüklenemedi. Bağlantıyı kontrol edip tekrar deneyin.', 'Nathan could not load. Check the connection and retry.') :
      !actor ? this.t(`Model yükleniyor… ${Math.floor((state?.progress || 0) * 100)}%`, `Loading model… ${Math.floor((state?.progress || 0) * 100)}%`) :
      this.t(`${actor.clips.length} hareket · ${actor.playing ? 'Oynatılıyor' : 'Durduruldu'}`, `${actor.clips.length} clips · ${actor.playing ? 'Playing' : 'Stopped'}`);
    this.element.innerHTML = `<header><div><small>${this.t('PERSONEL · AŞAMA 1', 'PERSONNEL · STAGE 1')}</small><strong>${esc(entity.name)}</strong></div><button data-nathan="close" aria-label="${this.t('Paneli kapat', 'Close panel')}">×</button></header>
      <p class="nathan-status" role="status">${status}</p>
      ${state?.status === 'error' ? `<button data-nathan="retry">${this.t('Yeniden yükle', 'Retry loading')}</button>` : ''}
      <fieldset ${!actor || !this.hooks.ready() ? 'disabled' : ''}>
        <label>${this.t('Hareket seç', 'Choose animation')}<select data-nathan-clips size="6" aria-label="${this.t('Nathan hareketleri', 'Nathan animations')}">${actor?.clips.map((clip, i) => `<option value="${i}" ${i === actor.index ? 'selected' : ''}>${i + 1}. ${esc(clip.name || `Animation ${i + 1}`)} · ${clip.duration.toFixed(2)} s</option>`).join('') || ''}</select></label>
        <div class="nathan-playback"><button data-nathan="play" ${actor?.playing ? 'disabled' : ''}>▶ ${this.t('Oynat', 'Play')}</button><button data-nathan="pause" ${!actor?.playing ? 'disabled' : ''}>Ⅱ ${this.t('Duraklat', 'Pause')}</button><button data-nathan="stop">■ ${this.t('Durdur', 'Stop')}</button></div>
        <div class="nathan-options"><label><input data-nathan-loop type="checkbox" ${actor?.settings.loop ? 'checked' : ''}> ${this.t('Tekrarla', 'Loop')}</label><label>${this.t('Hız', 'Speed')} <select data-nathan-speed aria-label="${this.t('Oynatma hızı', 'Playback speed')}">${[.25, .5, 1, 1.5, 2].map(speed => `<option value="${speed}" ${actor?.settings.speed === speed ? 'selected' : ''}>${speed}×</option>`).join('')}</select></label></div>
      </fieldset>
      <p class="nathan-scope">${this.t('Yerinde animasyon önizlemesi. Sürüş, hortum fiziği ve uçak bağlantısı sonraki aşamalarda eklenecek.', 'In-place animation preview. Driving, hose physics and aircraft connections are planned for later stages.')}</p>
      <button data-nathan="edit">${this.t('Nesneyi düzenle · taşı / döndür / sil', 'Edit object · move / rotate / delete')}</button>`;
    const save = () => { if (actor) this.hooks.configure(entity, { ...actor.settings }); };
    this.element.querySelector<HTMLSelectElement>('[data-nathan-clips]')!.onchange = event => {
      actor?.select(Number((event.target as HTMLSelectElement).value)); save(); this.sync();
    };
    this.element.querySelector<HTMLInputElement>('[data-nathan-loop]')!.onchange = event => {
      if (actor) actor.configure({ ...actor.settings, loop: (event.target as HTMLInputElement).checked }); save(); this.sync();
    };
    this.element.querySelector<HTMLSelectElement>('[data-nathan-speed]')!.onchange = event => {
      if (actor) actor.configure({ ...actor.settings, speed: Number((event.target as HTMLSelectElement).value) }); save(); this.sync();
    };
    this.element.querySelectorAll<HTMLButtonElement>('[data-nathan]').forEach(button => button.onclick = () => {
      switch (button.dataset.nathan) {
        case 'close': this.close(); break;
        case 'retry': this.actors.retry(entity); break;
        case 'play': actor?.play(); break;
        case 'pause': actor?.pause(); break;
        case 'stop': actor?.stop(); break;
        case 'edit': this.close(); this.hooks.edit(); break;
      }
      this.sync();
    });
  }
}
