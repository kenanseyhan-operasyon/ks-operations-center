import * as T from 'three';
import type { Entity } from './scene-data';
import { NATHAN_PRESET, validateNathan } from './nathan-data';
import type { NathanActors } from './nathan-model';
import { applyTransform } from './objects';
import { NathanNavigation } from './nathan-navigation';
import { makeNathanAccess, sampleAccess, type NathanAccess, type NathanAccessKind } from './nathan-access';
import type { V3 } from './personnel-navigation';
import { localToWorld, worldToLocal } from './facility-data';

type Hooks = {
  entities: () => Entity[]; object: (id: string) => T.Group | undefined;
  gateAmount: (id: string) => number; speed: (id: string) => number;
  prepare: (id: string, kind: NathanAccessKind) => boolean;
  checkpoint: () => void; changed: () => void; ui: () => void;
  input: (person: boolean) => void; notify: (text: string) => void;
};
export type NathanPhase = 'idle' | 'walking' | 'aligning' | 'preparing' | 'climbing' | 'standing' | 'descending' | 'paused';
const distance = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const angle = (a: number, b: number) => ((b - a + 540) % 360 + 360) % 360 - 180;

/** One owner for position, heading, animation and input. Preview/editor never move it. */
export class NathanController {
  id?: string;
  mode: 'person' | 'camera' | 'closed' = 'closed';
  phase: NathanPhase = 'idle';
  message = 'Zemine veya merdivene tıklayın / dokunun.';
  private route: V3[] = [];
  private goal?: V3;
  private access?: NathanAccess;
  private velocity = 0;
  private nav?: NathanNavigation;
  private navAge = 0;
  private marked = false;
  private preparingTime = 0;
  private afterPrepare: 'climbing' | 'descending' = 'climbing';
  private entityRef?: Entity;
  constructor(private actors: NathanActors, private hooks: Hooks) {}
  get active() { return this.mode !== 'closed'; }
  get capturing() { return this.mode === 'person'; }
  get entity() { return this.hooks.entities().find(e => e.id === this.id && e.preset === NATHAN_PRESET); }
  private get actor() { return this.id ? this.actors.states.get(this.id)?.actor : undefined; }
  private navigation() { const e = this.entity; return new NathanNavigation(this.hooks.entities(), .34 * (e?.scale || 1), this.hooks.gateAmount, this.hooks.object, this.id); }
  private status(message: string, phase = this.phase) { this.message = message; this.phase = phase; this.hooks.ui(); }
  private begin() { if (!this.marked) { this.hooks.checkpoint(); this.marked = true; } }
  private commit() { if (this.marked) { this.marked = false; this.hooks.changed(); } }
  private transform() { const e = this.entity, root = e && this.hooks.object(e.id); if (e && root) applyTransform(root, e); }
  private idle() { this.velocity = 0; this.actor?.motion('Idle'); }
  open(e: Entity) {
    if (this.id !== e.id) this.close();
    this.id = e.id; this.entityRef = e; this.mode = 'person'; this.hooks.input(true);
    if (e.nathan?.support) {
      this.restoreSupport();
      this.status(e.nathan.support?.progress === 1 ? 'Platformda bekliyor. İn düğmesini veya merdiveni seçin.' : 'Merdivende duraklatıldı. Devam et veya İn seçin.', e.nathan.support?.progress === 1 ? 'standing' : 'paused');
    } else this.status('Zemine veya merdivene tıklayın / dokunun.', 'idle');
    this.idle();
  }
  setMode(mode: 'person' | 'camera') {
    if (!this.active) return;
    this.mode = mode; this.hooks.input(mode === 'person'); this.hooks.ui();
  }
  close() {
    this.pause(); this.actor?.release(); this.mode = 'closed'; this.id = undefined; this.entityRef = undefined;
    this.hooks.input(false); this.hooks.ui();
  }
  pause() {
    this.route = []; this.goal = undefined; this.velocity = 0;
    const support = this.entity?.nathan?.support;
    if(support && support.progress < 1) this.actor?.pause(); else this.idle(); this.status(support ? (support.progress === 1 ? 'Platformda bekliyor.' : 'Merdivende duraklatıldı. Devam et veya İn seçin.') : 'Durdu. Yeni bir hedef seçin.', support ? (support.progress === 1 ? 'standing' : 'paused') : 'idle');
    this.commit();
  }
  preview() { this.route=[];this.goal=undefined;this.velocity=0;const support=this.entity?.nathan?.support;this.phase=support?(support.progress===1?'standing':'paused'):'idle';this.actor?.release();this.commit();this.setMode('camera');this.status('Animasyon önizlemesi. Yürümek için Personeli Yönet seçin.'); }
  blocksVehicle(id: string) {
    return this.access?.targetId === id && ['walking', 'aligning', 'preparing', 'climbing', 'descending'].includes(this.phase) ||
      this.hooks.entities().some(e => e.preset === NATHAN_PRESET && e.nathan?.support?.targetId === id);
  }
  private fail(message: string) { this.pause(); this.status(message); this.hooks.notify(message); return false; }
  walkTo(point: V3) {
    if (!this.entity || !this.actor) return this.fail('Nathan modelinin yüklenmesini bekleyin.');
    if (this.entity.nathan?.support) return this.fail('Önce merdivenden inin; platformdan zemine atlama kapalı.');
    if (Math.abs(this.entity.position[1]) > .15) return this.fail('Yürümek için Nathan’ı nesne düzenleme ile zemine yerleştirin.');
    this.nav = this.navigation(); this.navAge = 0;
    const target: V3 = [point[0], 0, point[2]], path = this.nav.path(this.entity.position, target);
    if (!path) return this.fail('Güvenli yol bulunamadı. Boş bir zemin noktası seçin (en fazla 120 m).');
    this.begin(); this.route = path; this.goal = target; this.access = undefined;
    this.setMode('person'); this.status('Hedefe yürüyor… Yeni bir hedef seçebilirsiniz.', 'walking'); return true;
  }
  climb(targetId: string, kind: NathanAccessKind) {
    const e = this.entity, target = this.hooks.entities().find(o => o.id === targetId);
    if (!e || !this.actor || !target) return this.fail('Önce Nathan ve araç modelinin yüklenmesini bekleyin.');
    const support = e.nathan?.support;
    if (support) {
      if (support.targetId === targetId && support.kind === kind) return this.descend();
      return this.fail('Başka bir merdivene gitmeden önce zemine inin.');
    }
    if (Math.abs(this.hooks.speed(targetId)) > .01) return this.fail('Önce aracı durdurun.');
    if (e.position[1] > .15) return this.fail('Merdivene yaklaşmak için Nathan zeminde olmalı.');
    this.nav = this.navigation(); this.navAge = 0;
    const access = makeNathanAccess(target, this.hooks.object(targetId), kind, this.nav);
    if (!access) return this.fail('Merdiven yolu uygun değil. Aracı durdurun, platformu alçaltın ve girişini boşaltın.');
    const path = this.nav.path(e.position, access.points[0]);
    if (!path) return this.fail('Merdivenin girişine güvenli yol bulunamadı.');
    this.begin(); this.access = access; this.route = path; this.goal = access.points[0];
    this.setMode('person'); this.status('Merdivenin girişine yürüyor…', 'walking'); return true;
  }
  descend() {
    const e = this.entity, support = e?.nathan?.support;
    if (!e || !support || !this.restoreSupport()) return this.fail('İnilecek kayıtlı bir merdiven bulunamadı.');
    if (Math.abs(this.hooks.speed(support.targetId)) > .01) return this.fail('Önce aracı durdurun.');
    this.begin(); this.setMode('person'); this.afterPrepare = 'descending'; this.preparingTime = 0;
    this.status('İniş için merdiven ve korkuluk hazırlanıyor…', 'preparing'); return true;
  }
  resume() {
    if (!this.entity?.nathan?.support || !this.restoreSupport()) return;
    this.begin(); this.setMode('person'); this.afterPrepare = 'climbing'; this.preparingTime = 0;
    this.status('Çıkış için merdiven ve korkuluk hazırlanıyor…', 'preparing');
  }
  nearby() {
    const e = this.entity; if (!e) return [];
    return this.hooks.entities().filter(o => o.id !== e.id && distance(o.position, e.position) < 35 &&
      (o.kind === 'vehicle' || ['MOBILE_STAIR', 'CROSSOVER_STAIR'].includes(o.preset)))
      .sort((a, b) => distance(a.position, e.position) - distance(b.position, e.position)).slice(0, 6)
      .flatMap(o => (['MOBILE_STAIR', 'CROSSOVER_STAIR'].includes(o.preset) ? ['steps'] : ['rear', 'platform']).map(kind => ({ id: o.id, name: o.name, kind: kind as NathanAccessKind })))
      .filter(item => makeNathanAccess(this.hooks.entities().find(o => o.id === item.id)!, this.hooks.object(item.id), item.kind, this.navigation()));
  }
  private restoreSupport() {
    const e = this.entity, support = e?.nathan?.support;
    if (!e || !support) return false;
    const target = this.hooks.entities().find(o => o.id === support.targetId);
    if (!target) {
      delete e.nathan!.support; this.access = undefined; e.position[1] = 0; this.transform();
      this.status('Destek nesnesi silindi. Nathan zemine alındı.', 'idle'); return false;
    }
    // Keep the saved world position while asynchronous vehicle geometry loads.
    const access = makeNathanAccess(target, this.hooks.object(target.id), support.kind, this.navigation());
    if (!access) return false;
    if(new T.Vector3(...sampleAccess(access,support.progress)).distanceTo(new T.Vector3(...e.position))>.4)return false;
    this.access = access; return true;
  }
  sync() {
    for (const e of this.hooks.entities()) {
      const support = e.nathan?.support; if (!support) continue;
      const target = this.hooks.entities().find(t => t.id === support.targetId);
      if (!target) { delete e.nathan!.support; e.position[1] = 0; }
      else if (support.local) { e.position = localToWorld(target, support.local); e.heading = target.heading + (support.heading || 0); }
      const root = this.hooks.object(e.id); if (root) applyTransform(root, e);
    }
    if (!this.id) return;
    const e = this.entity;
    if (!e) { this.close(); return; }
    if (e !== this.entityRef) { this.entityRef = e; this.pause(); this.restoreSupport(); }
  }
  private turn(target: number, dt: number) {
    const e = this.entity!; const error = angle(e.heading, target);
    e.heading = ((e.heading + T.MathUtils.clamp(error, -150 * dt, 150 * dt)) % 360 + 360) % 360;
    return Math.abs(angle(e.heading, target));
  }
  tick(dt: number) {
    const e = this.entity;
    if (!this.active || !e || !this.actor || !Number.isFinite(dt)) return;
    dt = T.MathUtils.clamp(dt, 0, .1);
    if (this.phase === 'idle' || this.phase === 'paused' || this.phase === 'standing') return;
    const target = this.access && this.hooks.entities().find(o => o.id === this.access!.targetId);
    if (this.access && (!target || Math.abs(this.hooks.speed(target.id)) > .01)) { this.fail('Merdiven desteği değişti; hareket durduruldu.'); return; }
    if (this.phase === 'walking') {
      this.navAge += dt;
      if (!this.nav || this.navAge > .25) { this.nav = this.navigation(); this.navAge = 0; }
      const next = this.route[0];
      if (!next) {
        this.idle();
        if (this.access) this.status('Merdivene hizalanıyor…', 'aligning');
        else { this.status('Hedefe ulaştı · Idle', 'idle'); this.commit(); }
        return;
      }
      const d = distance(e.position, next), heading = Math.atan2(next[0] - e.position[0], -(next[2] - e.position[2])) * 180 / Math.PI;
      if (d < .015) { e.position = [...next]; this.route.shift(); this.transform(); return; }
      const error = this.turn(heading, dt);
      const desired = Math.min(1.15 * e.scale, Math.sqrt(2 * 2.2 * d)) * Math.max(0, Math.cos(error * Math.PI / 180));
      this.velocity = T.MathUtils.clamp(desired, this.velocity - 3 * dt, this.velocity + 1.8 * dt);
      // Turn on the spot for large heading changes, then accelerate along the clear segment.
      const step = error > 35 ? 0 : Math.min(d, this.velocity * dt);
      const p: V3 = [e.position[0] + (next[0] - e.position[0]) * step / d, 0, e.position[2] + (next[2] - e.position[2]) * step / d];
      if (!this.nav.clear(e.position, p)) {
        const replan = this.goal && this.nav.path(e.position, this.goal);
        if (!replan) { this.fail('Yol kapandı. Nathan durdu; yeni bir hedef seçin.'); return; }
        this.route = replan; this.velocity = 0; return;
      }
      e.position = p;
      if (step > .0001) this.actor.motion('Nathan_Original_Walk', step / Math.max(dt, .001) / (1.15 * e.scale));
      else this.actor.motion('Idle');
    } else if (this.phase === 'aligning' && this.access) {
      this.idle();
      if (this.turn(this.access.heading, dt) < 1) { this.afterPrepare = 'climbing'; this.preparingTime = 0; this.status('Merdiven ve korkuluk hazırlanıyor…', 'preparing'); }
    } else if (this.phase === 'preparing' && this.access) {
      this.preparingTime += dt;
      if (this.hooks.prepare(this.access.targetId, this.access.kind)) {
        const fresh = target && makeNathanAccess(target, this.hooks.object(target.id), this.access.kind, this.navigation());
        if (!fresh) { this.fail('Merdiven geometrisi değişti. Platformu alçaltıp tekrar deneyin.'); return; }
        this.access = fresh;
        if (!e.nathan?.support) e.nathan = { ...validateNathan(e.nathan), support: { targetId: fresh.targetId, kind: fresh.kind, progress: 0 } };
        this.status(this.afterPrepare === 'descending' ? 'Merdivenden iniyor…' : 'Merdivenden çıkıyor…', this.afterPrepare);
      } else if (this.preparingTime > 12) this.fail('Merdiven erişimi açılamadı; hareket durduruldu.');
    } else if ((this.phase === 'climbing' || this.phase === 'descending') && this.access && e.nathan?.support) {
      const support = e.nathan.support, down = this.phase === 'descending';
      // Recheck the full access corridor for a newly inserted obstacle.
      this.navAge += dt;
      if (this.navAge > .5) {
        this.navAge = 0; const nav = this.navigation();
        if (this.access.points.slice(1).some((p, i) => !nav.clear(this.access!.points[i], p, this.access!.targetId))) { this.fail('Merdiven yolu kapandı; hareket duraklatıldı.'); return; }
      }
      const atCrest=support.progress>this.access.crest,crestLength=this.access.length*(1-this.access.crest);
      const crestDuration=this.actor.clips.find(c=>c.name==='Climbing_To_Top')!.duration;
      const speed = atCrest?Math.min(.34*e.scale,crestLength/crestDuration):(this.access.kind === 'steps' ? .48 : .34) * e.scale;
      support.progress = T.MathUtils.clamp(support.progress + (down ? -1 : 1) * speed * dt / this.access.length, 0, 1);
      e.position = sampleAccess(this.access, support.progress); this.turn(this.access.heading, dt);
      const crest = support.progress > this.access.crest;
      this.actor.motion(crest ? 'Climbing_To_Top' : this.access.kind === 'rear' ? 'Climbing_Ladder' : 'Climbing', crest ? speed*crestDuration/crestLength : .85, down);
      if (!down && support.progress >= 1) { if(target){support.local=worldToLocal(target,e.position);support.heading=e.heading-target.heading;}this.idle(); this.status('Platformda bekliyor. İn düğmesini veya merdiveni seçin.', 'standing'); this.commit(); }
      if (down && support.progress <= 0) {
        delete e.nathan.support; this.access = undefined; e.position[1] = 0;
        this.idle(); this.status('Zemine indi · Idle', 'idle'); this.commit();
      }
    }
    if (e.nathan?.support && target) {
      e.nathan.support.local = worldToLocal(target, e.position);
      e.nathan.support.heading = e.heading - target.heading;
    }
    this.transform();
  }
}
