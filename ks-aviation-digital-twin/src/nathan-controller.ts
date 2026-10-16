import * as T from 'three';
import type { Entity } from './scene-data';
import { NATHAN_PRESET, validateNathan } from './nathan-data';
import type { NathanActors } from './nathan-model';
import { applyTransform } from './objects';
import { NathanNavigation } from './nathan-navigation';
import { makeNathanAccess, sampleAccess, type NathanAccess, type NathanAccessKind } from './nathan-access';
import type { V3 } from './personnel-navigation';
import { localToWorld, worldToLocal } from './facility-data';
import { planNathanRoute, type NathanRouteLeg, type NathanGatePass } from './nathan-route';
import { bridgeTanks, makeRoofBridge, onTankRoof, planRoofRoute, remainingRoofBridge, roofBridgeIds, roofHeight, tankRoofPoint, type RoofLeg } from './nathan-roof';
import {stairPose} from './nathan-stair-gait';
import {standingContact} from './nathan-contact';
import {driverPose,driverLanding} from './nathan-driver';
import type {NathanView} from './nathan-camera';

type Hooks = {
  entities: () => Entity[]; object: (id: string) => T.Group | undefined;
  gateAmount: (id: string) => number; speed: (id: string) => number;
  prepare: (id: string, kind: NathanAccessKind) => boolean;
  checkpoint: () => void; changed: () => void; ui: () => void;
  input: (person: boolean) => void; notify: (text: string) => void;
  view?:(mode:NathanView)=>void;
  platform?:(id:string)=>void;
  driver?:(id:string,on:boolean)=>void;
  driveKey?:(key:string,down:boolean)=>boolean;
  door?:(id:string,open:boolean)=>void;
  doorHandle?:(id:string)=>V3|undefined;
  operate?:(id:string)=>void;
  accessGate?:(id:string,open:boolean)=>boolean;
};
export type NathanPhase = 'idle' | 'walking' | 'roofwalking' | 'aligning' | 'preparing' | 'climbing' | 'standing' | 'descending' | 'paused';
const distance = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const angle = (a: number, b: number) => ((b - a + 540) % 360 + 360) % 360 - 180;

/** One owner for position, heading, animation and input. Preview/editor never move it. */
export class NathanController {
  id?: string;
  mode: 'person' | 'camera' | 'closed' = 'closed';
  view:NathanView='free';
  phase: NathanPhase = 'idle';
  message = 'Zemine veya merdivene tıklayın / dokunun.';
  private route: V3[] = [];
  private goal?: V3;
  private access?: NathanAccess;
  private journey: NathanRouteLeg[] = [];
  private queuedTarget?: V3;
  private roofLeg?: RoofLeg;
  private roofLegs: RoofLeg[] = [];
  private roofAfterDescent = false;
  private roofTravel = 0;
  private destination?: { tankId?: string; point: V3 };
  private operation?:string;
  private gatePass?:NathanGatePass;
  private operationTime=0;
  private velocity = 0;
  private nav?: NathanNavigation;
  private navAge = 0;
  private marked = false;
  private preparingTime = 0;
  private afterPrepare: 'climbing' | 'descending' = 'climbing';
  private entityRef?: Entity;
  constructor(private actors: NathanActors, private hooks: Hooks) {}
  get active() { return this.mode !== 'closed'; }
  get seated(){const s=this.entity?.nathan?.support;return s?.kind==='driver'&&s.progress===1;}
  driveKey(key:string,down:boolean){return this.seated?this.hooks.driveKey?.(key,down):false;}
  get capturing() { return this.mode === 'person'; }
  get entity() { return this.hooks.entities().find(e => e.id === this.id && e.preset === NATHAN_PRESET); }
  private get actor() { return this.id ? this.actors.states.get(this.id)?.actor : undefined; }
  private navigation() { const e = this.entity; return new NathanNavigation(this.hooks.entities(), .34 * (e?.scale || 1), this.hooks.gateAmount, this.hooks.object, this.id); }
  private status(message: string, phase = this.phase) { this.message = message; this.phase = phase; this.hooks.ui(); }
  private begin() { if (!this.marked) { this.hooks.checkpoint(); this.marked = true; } }
  private commit() { if (this.marked) { this.marked = false; this.hooks.changed(); } }
  private transform() { const e = this.entity, root = e && this.hooks.object(e.id); if (e && root) applyTransform(root, e); }
  private idle() { this.velocity = 0; this.actor?.contact();this.actor?.motion('Idle'); }
  private nextLeg() {
    const leg = this.journey.shift(); if (!leg) return false;
    this.route = leg.route; this.access = leg.access; this.gatePass=leg.gate;this.goal = leg.route.at(-1) || leg.access?.points[0];
    this.nav = this.navigation(); this.navAge = 0; this.velocity = 0;
    return true;
  }
  open(e: Entity) {
    if (this.id !== e.id) this.close();
    this.id = e.id; this.entityRef = e; this.mode = 'person'; this.hooks.input(true);
    if (e.nathan?.support) {
      this.restoreSupport();
      const standing = e.nathan.support?.progress === 1 && !e.nathan.support.crossingSide;
      this.status(standing ? 'Platformda bekliyor. İn düğmesini veya merdiveni seçin.' : 'Merdivende duraklatıldı. Devam et veya İn seçin.', standing ? 'standing' : 'paused');
    } else this.status('Zemine veya merdivene tıklayın / dokunun.', 'idle');
    this.idle();this.restoreContact();if(this.seated)this.hooks.driver?.(e.nathan!.support!.targetId,true);
  }
  setMode(mode: 'person' | 'camera') {
    if (!this.active) return;
    if(mode==='camera')this.setView('free');this.mode = mode; this.hooks.input(mode === 'person'); this.hooks.ui();
  }
  setView(mode:NathanView){this.view=mode;this.hooks.view?.(mode);this.hooks.ui();}
  close() {
    if(this.seated)this.hooks.driver?.(this.entity!.nathan!.support!.targetId,false);
    this.setView('free');
    this.pause(); this.actor?.release(); this.mode = 'closed'; this.id = undefined; this.entityRef = undefined;
    this.hooks.input(false); this.hooks.ui();
  }
  pause() {
    this.operation=undefined;this.operationTime=0;this.gatePass=undefined;
    this.route = []; this.goal = undefined; this.journey = []; this.queuedTarget = undefined; this.velocity = 0;
    this.roofLeg = undefined; this.roofLegs = []; this.roofAfterDescent = false; this.destination = undefined;
    const support = this.entity?.nathan?.support;
    if(support && support.progress < 1) this.actor?.pause(); else this.idle(); this.status(support ? (support.progress === 1 ? 'Platformda bekliyor.' : 'Merdivende duraklatıldı. Devam et veya İn seçin.') : 'Durdu. Yeni bir hedef seçin.', support ? (support.progress === 1 ? 'standing' : 'paused') : 'idle');
    if(this.seated)this.hooks.driveKey?.('escape',true);this.restoreContact();this.commit();
  }
  preview() { if(this.entity?.nathan?.support){this.hooks.notify('Animasyon önizlemesi için önce zemine inin.');return false;}this.route=[];this.goal=undefined;this.journey=[];this.queuedTarget=undefined;this.roofLeg=undefined;this.roofLegs=[];this.roofAfterDescent=false;this.destination=undefined;this.velocity=0;const support=this.entity?.nathan?.support;this.phase=support?(support.progress===1&&!support.crossingSide?'standing':'paused'):'idle';this.actor?.release();this.commit();this.setMode('camera');this.status('Animasyon önizlemesi. Yürümek için Personeli Yönet seçin.');return true; }
  blocksVehicle(id: string) {
    return this.access?.targetId === id && ['walking', 'aligning', 'preparing', 'climbing', 'descending'].includes(this.phase) ||
      this.hooks.entities().some(e => e.preset === NATHAN_PRESET && e.nathan?.support?.targetId === id && !(e.nathan.support.kind==='driver'&&e.nathan.support.progress===1));
  }
  blocksAnimation(id:string,clip:string){
    if(!this.blocksVehicle(id))return false;
    const people=this.hooks.entities().filter(e=>e.nathan?.support?.targetId===id&&!(e.nathan.support.kind==='driver'&&e.nathan.support.progress===1));
    return !people.length||people.some(e=>e.nathan!.support!.kind!=='platform'||e.nathan!.support!.progress<1)||!['Platform_Raise_4s','Platform_Gate_Open'].includes(clip);
  }
  togglePlatform(){const s=this.entity?.nathan?.support;if(s?.kind==='platform'&&s.progress===1)this.hooks.platform?.(s.targetId);else this.fail('Önce platformun üzerinde durun.');}
  private fail(message: string) { this.pause(); this.status(message); this.hooks.notify(message); return false; }
  walkTo(point: V3) {
    if (!this.entity || !this.actor) return this.fail('Nathan modelinin yüklenmesini bekleyin.');
    const target: V3 = [point[0], 0, point[2]];
    if (this.entity.nathan?.support?.crossingSide) {
      if (distance(this.entity.position, target) > 120 || this.navigation().blocked(target)) {
        this.hooks.notify('Hedef engelin içinde veya 120 m sınırının dışında. Boş zemin seçin.'); return false;
      }
      this.queuedTarget = target;
      if (this.phase === 'paused') this.resume();
      this.status('Yeni hedef alındı. Merdivenden zemine indikten sonra bu hedefe yürüyecek.'); return true;
    }
    if (this.entity.nathan?.support) {
      if (!this.descend()) return false;
      this.destination = {point: target};this.status('Önce merdivenden inecek, sonra seçtiğiniz hedefe yürüyecek.');return true;
    }
    if (Math.abs(this.entity.position[1]) > .23) return this.fail('Yürümek için Nathan’ı nesne düzenleme ile zemine yerleştirin.');
    this.nav = this.navigation(); this.navAge = 0;
    const legs = planNathanRoute(this.entity.position, target, this.nav, this.hooks.entities(), this.hooks.object);
    if (!legs) return this.fail('Güvenli yol bulunamadı. Merdiven girişlerini ve hedefin boş olduğunu kontrol edin (en fazla 120 m).');
    this.operation=undefined;this.begin(); this.journey = legs; this.queuedTarget = undefined; this.nextLeg();this.actor.terrain=p=>this.nav?.surface(p,.035)||0;
    this.setMode('person'); this.status(this.access?.crossingSide ? 'Hedefe geçiş merdiveni üzerinden yürüyor…' : 'Hedefe yürüyor… Yeni bir hedef seçebilirsiniz.', 'walking'); return true;
  }
  climb(targetId: string, kind: NathanAccessKind) {
    const e = this.entity, target = this.hooks.entities().find(o => o.id === targetId);
    if (!e || !this.actor || !target) return this.fail('Önce Nathan ve araç modelinin yüklenmesini bekleyin.');
    if(kind==='driver'&&this.hooks.entities().some(o=>o.id!==e.id&&o.nathan?.support?.targetId===targetId&&o.nathan.support.kind==='driver'))return this.fail('Sürücü koltuğu dolu.');
    const support = e.nathan?.support;
    if (support) {
      if (support.targetId === targetId && support.kind === kind) return this.descend();
      return this.fail('Başka bir merdivene gitmeden önce zemine inin.');
    }
    if (Math.abs(this.hooks.speed(targetId)) > .01) return this.fail('Önce aracı durdurun.');
    if (e.position[1] > .23) return this.fail('Merdivene yaklaşmak için Nathan zeminde olmalı.');
    this.nav = this.navigation(); this.navAge = 0;
    const sides = target.preset === 'CROSSOVER_STAIR' ? [-1, 1] as const : [undefined];
    const candidates = sides.map(side => makeNathanAccess(target, this.hooks.object(targetId), kind, this.nav!, side))
      .filter((a): a is NathanAccess => !!a);
    if (!candidates.length) return this.fail('Merdiven yolu uygun değil. Platformu alçaltın ve merdivenin iki girişini boşaltın.');
    const reachable = candidates.map(access => ({ access, legs: planNathanRoute(e.position, access.points[0], this.nav!, this.hooks.entities(), this.hooks.object) }))
      .filter(item => !!item.legs).sort((a, b) => distance(e.position, a.access.points[0]) - distance(e.position, b.access.points[0]))[0];
    if (!reachable) return this.fail('Merdivenin girişine güvenli yol bulunamadı.');
    const {access, legs} = reachable;
    this.begin(); this.journey = legs!; this.journey.at(-1)!.access = access; this.queuedTarget = undefined; this.destination = undefined; this.nextLeg();
    this.setMode('person'); this.status('Merdivenin girişine yürüyor…', 'walking'); return true;
  }
  descend() {
    const e = this.entity, support = e?.nathan?.support;
    if (e && support?.kind === 'bridge') return this.resumeBridge(true, true);
    if (e && support?.kind === 'tank' && support.progress === 1) {
      const tank=this.hooks.entities().find(t=>t.id===support.targetId),nav=this.navigation();
      const access=tank&&makeNathanAccess(tank,this.hooks.object(tank.id),'tank',nav);
      if(!tank||!access)return this.fail('Tank merdiveni kapalı veya girişinde engel var.');
      const path=planRoofRoute(e.position,tank.id,access.points.at(-1)!,tank.id,this.hooks.entities(),nav,.34*e.scale);
      if(!path)return this.fail('Tank merdivenine çatıda güvenli yol bulunamadı.');
      if(distance(e.position,access.points.at(-1)!)>.03)return this.startRoof(path,true);
      this.access=access;
    }
    if(e&&support?.kind==='platform'&&support.progress===1){
      this.access=makeNathanAccess(this.hooks.entities().find(t=>t.id===support.targetId)!,this.hooks.object(support.targetId),'platform',this.navigation())||{targetId:support.targetId,kind:'platform',points:[[...e.position]],heading:e.heading,length:1,crest:0};
    }else if (!e || !support || !this.restoreSupport()) return this.fail('İnilecek kayıtlı bir merdiven bulunamadı.');
    if (Math.abs(this.hooks.speed(support.targetId)) > .01) {this.hooks.notify('İnmeden önce aracı durdurun.');return false;}
    if(support.kind==='driver'){this.hooks.driver?.(support.targetId,false);this.setView('free');}
    this.begin(); this.setMode('person'); this.afterPrepare = 'descending'; this.preparingTime = 0;
    this.status('İniş için merdiven ve korkuluk hazırlanıyor…', 'preparing'); return true;
  }
  resume() {
    if(this.entity?.nathan?.support?.kind==='bridge'){this.resumeBridge();return;}
    if (!this.entity?.nathan?.support || !this.restoreSupport()) return;
    this.begin(); this.setMode('person'); this.afterPrepare = 'climbing'; this.preparingTime = 0;
    this.status('Çıkış için merdiven ve korkuluk hazırlanıyor…', 'preparing');
  }
  nearby() {
    const e = this.entity; if (!e) return [];
    return this.hooks.entities().filter(o => o.id !== e.id && distance(o.position, e.position) < 35 &&
      (o.kind === 'vehicle' || o.kind === 'tank' || ['MOBILE_STAIR', 'CROSSOVER_STAIR'].includes(o.preset)))
      .sort((a, b) => distance(a.position, e.position) - distance(b.position, e.position)).slice(0, 6)
      .flatMap(o => (o.kind === 'tank' ? ['tank'] : ['MOBILE_STAIR', 'CROSSOVER_STAIR'].includes(o.preset) ? ['steps'] : ['rear', 'platform','driver']).map(kind => ({ id: o.id, name: o.name, kind: kind as NathanAccessKind })))
      .filter(item => {
        const target = this.hooks.entities().find(o => o.id === item.id)!;
        return makeNathanAccess(target, this.hooks.object(item.id), item.kind, this.navigation(), target.preset === 'CROSSOVER_STAIR' ? -1 : undefined);
      });
  }
  private restoreSupport() {
    const e = this.entity, support = e?.nathan?.support;
    if (!e || !support) return false;
    const target = this.hooks.entities().find(o => o.id === support.targetId);
    if (!target) {
      delete e.nathan!.support; this.access = undefined; e.position[1] = 0; this.transform();
      this.status('Destek nesnesi silindi. Nathan zemine alındı.', 'idle'); return false;
    }
    if(support.kind==='bridge')return !!(support.fromTankId&&makeRoofBridge(target,support.fromTankId,this.hooks.entities(),this.navigation(),.34*e.scale));
    if(support.kind==='tank'&&support.progress===1){
      this.access=makeNathanAccess(target,this.hooks.object(target.id),'tank',this.navigation());
      return onTankRoof(target,e.position,.34*e.scale);
    }
    // Keep the saved world position while asynchronous vehicle geometry loads.
    const access = makeNathanAccess(target, this.hooks.object(target.id), support.kind, this.navigation(), support.crossingSide);
    if (!access) return false;
    if(new T.Vector3(...sampleAccess(access,support.progress)).distanceTo(new T.Vector3(...e.position))>.4)return false;
    this.access = access;this.restoreContact(); return true;
  }
  sync() {
    for (const e of this.hooks.entities()) {
      const support = e.nathan?.support; if (!support) continue;
      const target = this.hooks.entities().find(t => t.id === support.targetId);
      if (!target) { delete e.nathan!.support; e.position[1] = 0; }
      else if (support.local) { const node=support.anchor&&this.hooks.object(target.id)?.getObjectByName(support.anchor);if(support.anchor&&!node)continue;e.position = node?node.localToWorld(new T.Vector3(...support.local)).toArray() as V3:localToWorld(target, support.local); e.heading = target.heading + (support.heading || 0); }
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
    this.followSupports();
    const e = this.entity;
    if (!this.active || !e || !this.actor || !Number.isFinite(dt)) return;
    dt = T.MathUtils.clamp(dt, 0, .1);
    if(this.operation&&this.phase==='idle'){
      const gate=this.hooks.entities().find(o=>o.id===this.operation);if(!gate){this.operation=undefined;return;}
      const h=Math.atan2(gate.position[0]-e.position[0],-(gate.position[2]-e.position[2]))*180/Math.PI;
      if(this.turn(h,dt)>3){this.transform();return;}this.transform();this.operationTime+=dt;this.actor.motion('Opening');
      const root=this.hooks.object(e.id)!;this.actor.contact({...standingContact(root),lean:.18,grips:[[localToWorld(gate,[-gate.width*.42,1,.07]),localToWorld(gate,[gate.width*.42,1,.07])]]});
      if(this.operationTime>1.1){
        if(!this.gatePass||this.hooks.gateAmount(this.operation)<.98)this.hooks.operate?.(this.operation);
        this.operation=undefined;this.idle();
        if(this.gatePass){this.route=this.gatePass.crossing;this.goal=this.route.at(-1);this.gatePass=undefined;this.nav=this.navigation();this.navAge=0;this.status('Acil çıkış kapısından geçiyor…','walking');}
        else{this.status('Kapı konumu değiştirildi. Yeni hedef seçebilirsiniz.');this.commit();}
      }return;
    }
    if (this.phase === 'idle' || this.phase === 'paused' || this.phase === 'standing') return;
    if (this.phase === 'roofwalking') { this.tickRoof(dt); return; }
    const target = this.access && this.hooks.entities().find(o => o.id === this.access!.targetId);
    if (this.access && (!target || Math.abs(this.hooks.speed(target.id)) > .01)) { this.fail('Merdiven desteği değişti; hareket durduruldu.'); return; }
    if (this.phase === 'walking') {
      this.navAge += dt;
      if (!this.nav || this.navAge > .25) { this.nav = this.navigation(); this.navAge = 0; }
      const next = this.route[0];
      if (!next) {
        this.idle();
        if (this.access) this.status('Merdivene hizalanıyor…', 'aligning');
        else if(this.gatePass){this.operation=this.gatePass.id;this.operationTime=0;this.status('Acil çıkış kapısını açıyor…','idle');}
        else if(this.nextLeg())this.status('Hedefe yürüyor…','walking');
        else { this.status('Hedefe ulaştı · Idle', 'idle'); if(!this.operation)this.commit(); }
        return;
      }
      const d = distance(e.position, next), heading = Math.atan2(next[0] - e.position[0], -(next[2] - e.position[2])) * 180 / Math.PI;
      if (d < .015) { e.position = [next[0],this.nav.surface(next),next[2]]; this.route.shift(); this.transform(); return; }
      const error = this.turn(heading, dt);
      const desired = Math.min(1.15 * e.scale, Math.sqrt(2 * 2.2 * d)) * Math.max(0, Math.cos(error * Math.PI / 180));
      this.velocity = T.MathUtils.clamp(desired, this.velocity - 3 * dt, this.velocity + 1.8 * dt);
      // Turn on the spot for large heading changes, then accelerate along the clear segment.
      const step = error > 35 ? 0 : Math.min(d, this.velocity * dt);
      const p: V3 = [e.position[0] + (next[0] - e.position[0]) * step / d, 0, e.position[2] + (next[2] - e.position[2]) * step / d];
      p[1]=T.MathUtils.clamp(this.nav.surface(p,.06),e.position[1]-.9*dt,e.position[1]+.9*dt);
      if (!this.nav.clear(e.position, p)) {
        const replan = this.goal && this.nav.path(e.position, this.goal);
        if (!replan) { this.fail('Yol kapandı. Nathan durdu; yeni bir hedef seçin.'); return; }
        this.route = replan; this.velocity = 0; return;
      }
      e.position = p;
      if (step > .0001) this.actor.motion('Nathan_Original_Walk', step / Math.max(dt, .001) / (1.15 * e.scale));
      else this.actor.motion('Idle');
    } else if (this.phase === 'aligning' && this.access) {
      this.idle();this.actor.terrain=undefined;
      if (this.turn(this.access.heading, dt) < 1) { this.afterPrepare = 'climbing'; this.preparingTime = 0; this.status('Merdiven ve korkuluk hazırlanıyor…', 'preparing'); }
    } else if (this.phase === 'preparing' && this.access) {
      this.preparingTime += dt;
      if(this.access.kind==='driver'&&this.access.contacts){
        // Wait outside the entire door sweep. Begin the approach to the first
        // tread only after the leaf is fully open, on both entry and exit.
        this.actor.motion('Opening');
        if(this.afterPrepare==='climbing'){const handle=this.hooks.doorHandle?.(this.access.targetId),root=this.hooks.object(e.id)!;
          this.actor.contact({...standingContact(root),lean:.18,...(handle?{grips:[[handle,handle]] as [V3,V3][]}:{})});}
      }
      if (this.hooks.prepare(this.access.targetId, this.access.kind)) {
        const fresh = target && makeNathanAccess(target, this.hooks.object(target.id), this.access.kind, this.navigation(), this.access.crossingSide);
        if (!fresh) { this.fail('Merdiven geometrisi değişti. Platformu alçaltıp tekrar deneyin.'); return; }
        this.access = fresh;
        if(e.nathan?.support?.anchor){delete e.nathan.support.anchor;e.nathan.support.local=worldToLocal(target!,e.position);}
        if (!e.nathan?.support) e.nathan = { ...validateNathan(e.nathan), support: { targetId: fresh.targetId, kind: fresh.kind, progress: 0, ...(fresh.crossingSide ? {crossingSide: fresh.crossingSide} : {}) } };
        this.status(fresh.crossingSide ? 'Geçiş merdivenini kullanıyor…' : this.afterPrepare === 'descending' ? 'Merdivenden iniyor…' : 'Merdivenden çıkıyor…', this.afterPrepare);
      } else if (this.preparingTime > 12) this.fail('Merdiven erişimi açılamadı; hareket durduruldu.');
    } else if ((this.phase === 'climbing' || this.phase === 'descending') && this.access && e.nathan?.support) {
      const support = e.nathan.support, down = this.phase === 'descending';
      // Recheck the full access corridor for a newly inserted obstacle.
      this.navAge += dt;
      if (this.navAge > .5) {
        this.navAge = 0; const nav = this.navigation();
        if (this.access.points.slice(1).some((p, i) => !nav.clear(this.access!.points[i], p, this.access!.targetId))) { this.fail('Merdiven yolu kapandı; hareket duraklatıldı.'); return; }
      }
      if (this.access.crossingSide) {
        this.crossing(dt, down);
        if (e.nathan?.support && target) { e.nathan.support.local = worldToLocal(target, e.position); e.nathan.support.heading = e.heading - target.heading; }
        this.transform(); return;
      }
      if(this.access.kind==='tank'){
        this.tankStairs(dt,down);
        this.rememberSupport();
        this.transform();return;
      }
      if(this.access.contacts){
        if(this.access.kind==='platform'){
          const opening=down?support.progress>.72:support.progress>.74&&support.progress<1;
          if(this.hooks.accessGate?.(support.targetId,opening)===false&&opening){this.actor.pause();return;}
        }
        const speed=.32*e.scale,progress=T.MathUtils.clamp(support.progress+(down?-1:1)*speed*dt/this.access.length,0,1);
        const pose=this.access.driver?driverPose(this.access,progress,down):stairPose(this.access.contacts,progress);
        const heading='heading' in pose&&typeof pose.heading==='number'?pose.heading:this.access.heading;
        if(this.access.driver&&pose.root[1]<.01&&this.turn(heading,dt)>5){this.actor.pause();this.transform();return;}
        support.progress=progress;e.position=pose.root;this.turn(heading,dt);this.transform();
        this.accessMotion(this.access.kind,down,support.progress);this.actor.contact(pose.contact);
        if(!down&&support.progress===1){support.anchor=this.access.kind==='driver'?'DRIVER_SEAT':this.access.kind==='platform'?'Platform_Grey_Floor':'Tank_Top_Walkway';this.idle();if(this.access.kind==='driver'){this.hooks.door?.(support.targetId,false);this.hooks.driver?.(support.targetId,true);}if(support.kind==='platform')this.hooks.accessGate?.(support.targetId,false);this.status(this.access.kind==='driver'?'Sürücü koltuğunda. W/A/S/D: sür · C: kabin · V: gözünden.':'Platformda bekliyor. İnmek için zeminde bir hedef seçebilirsiniz.','standing');this.rememberSupport();this.commit();}
        if(down&&support.progress===0){if(support.kind==='driver')this.hooks.door?.(support.targetId,false);delete e.nathan!.support;this.access=undefined;e.position[1]=0;this.idle();this.status('Zemine indi · Idle','idle');if(!this.continueDestination())this.commit();}
        this.rememberSupport();this.transform();return;
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
        this.idle(); this.status('Zemine indi · Idle', 'idle');if(!this.continueDestination())this.commit();
      }
    }
    // A moving-floor anchor has its own coordinate frame; never overwrite it
    // with vehicle coordinates while waiting for a gate or lift animation.
    if (e.nathan?.support && target && !e.nathan.support.anchor) this.rememberSupport();
    this.transform();
  }

  private accessMotion(kind:NathanAccessKind,down:boolean,progress:number){
    const actor=this.actor!;
    if(kind==='driver'&&this.entity!.position[1]<.01){actor.motion('Nathan_Original_Walk',.4);return;}
    if(kind==='driver'&&progress>.8){actor.motion('Driving',.7);return;}
    const clip=down?'Climbing_Down_Wall':'Climbing_Up_Ladder';
    if(!actor.motion(clip,.7))actor.motion(kind==='rear'?'Climbing_Ladder':'Climbing',.7,down);
  }

  private crossing(dt: number, returning: boolean) {
    const e = this.entity!, access = this.access!, support = e.nathan!.support!;
    const error = this.turn(access.heading + (returning ? 180 : 0), dt);
    if (error > 20) { this.actor!.motion('Idle'); return; }
    const old = e.position, speed = .55 * e.scale;
    support.progress = T.MathUtils.clamp(support.progress + (returning ? -1 : 1) * speed * dt / access.length, 0, 1);
    e.position = sampleAccess(access, support.progress);
    const slope = e.position[1] - old[1];
    if(Math.abs(slope)<.0001)this.actor!.motion('Nathan_Original_Walk',speed/(1.15*e.scale));else this.stairsMotion(slope<0);
    if ((!returning && support.progress >= 1) || (returning && support.progress <= 0)) {
      delete e.nathan!.support; this.access = undefined; e.position[1] = 0;
      if (this.queuedTarget) {
        const point = this.queuedTarget; this.queuedTarget = undefined; this.journey = []; this.walkTo(point);
      } else if (!returning && this.nextLeg()) this.status('Merdivenden geçti. Hedefe yürüyor…', 'walking');
      else { this.journey = []; this.idle(); this.status(returning ? 'Giriş tarafına indi · Idle' : 'Karşı tarafa geçti · Idle', 'idle'); this.commit(); }
    }
  }

  tankTo(tankId: string, point?: V3) {
    const e=this.entity,tank=this.hooks.entities().find(t=>t.id===tankId&&t.kind==='tank');
    if(!e||!tank)return false;
    const target=point?[point[0],roofHeight(tank),point[2]] as V3:tankRoofPoint(tank),support=e.nathan?.support;
    if(support?.kind==='bridge'||support?.kind==='tank'&&support.progress<1){
      this.destination={tankId,point:target};if(this.phase==='paused')this.resume();
      this.status('Tank hedefi alındı. Mevcut merdiven / köprü geçişini tamamlayacak.');return true;
    }
    if(support?.kind==='tank'){
      const plan=planRoofRoute(e.position,support.targetId,target,tankId,this.hooks.entities(),this.navigation(),.34*e.scale);
      if(!plan)return this.fail('Tank çatısında güvenli yol / bağlı köprü bulunamadı. Korkuluktan ve kapaktan uzak bir nokta seçin.');
      this.destination=undefined;return this.startRoof(plan);
    }
    if(support)return this.fail('Tank merdivenine gitmeden önce mevcut merdivenden inin.');
    const started=this.climb(tankId,'tank');if(started)this.destination={tankId,point:target};return started;
  }
  crossBridge(bridgeId: string) {
    const e=this.entity,bridge=this.hooks.entities().find(o=>o.id===bridgeId),tanks=bridge&&bridgeTanks(bridge,this.hooks.entities());
    if(!e||!bridge||!tanks)return this.fail('Bu köprünün iki ucu da bir tank çatısına bağlı olmalı.');
    const support=e.nathan?.support;
    if(support?.kind==='bridge'&&support.targetId===bridgeId){if(this.phase==='paused')return this.resumeBridge();return true;}
    if(support?.kind==='tank'){
      const target=tanks.find(t=>t.id!==support.targetId);
      if(!tanks.some(t=>t.id===support.targetId)||!target)return this.fail('Önce bu köprüye bağlı tanklardan birine gidin.');
      return this.tankTo(target.id);
    }
    if(support)return this.fail('Köprüye gitmeden önce mevcut merdiven geçişini tamamlayın.');
    const nav=this.navigation(),from=[...tanks].sort((a,b)=>distance(a.position,e.position)-distance(b.position,e.position)).find(t=>{
      const access=makeNathanAccess(t,this.hooks.object(t.id),'tank',nav);
      return access&&makeRoofBridge(bridge,t.id,this.hooks.entities(),nav,.34*e.scale)&&planNathanRoute(e.position,access.points[0],nav,this.hooks.entities(),this.hooks.object);
    });
    if(!from)return this.fail('Köprüye çıkan tank merdivenine güvenli yol bulunamadı.');
    const to=tanks.find(t=>t.id!==from.id)!;
    if(!this.climb(from.id,'tank'))return false;
    this.destination={tankId:to.id,point:tankRoofPoint(to)};return true;
  }
  roofOptions() {
    const e=this.entity,support=e?.nathan?.support;if(!e||support?.kind!=='tank'||support.progress<1)return [];
    return this.hooks.entities().flatMap(bridge=>{
      const tanks=bridgeTanks(bridge,this.hooks.entities());if(!tanks?.some(t=>t.id===support.targetId))return [];
      const target=tanks.find(t=>t.id!==support.targetId)!;
      return makeRoofBridge(bridge,support.targetId,this.hooks.entities(),this.navigation(),.34*e.scale)?[{id:target.id,name:target.name,bridge:bridge.name}]:[];
    });
  }
  private rememberSupport() {
    const e=this.entity,support=e?.nathan?.support,target=support&&this.hooks.entities().find(t=>t.id===support.targetId);
    if(e&&support&&target){const node=support.anchor&&this.hooks.object(target.id)?.getObjectByName(support.anchor);support.local=node?node.worldToLocal(new T.Vector3(...e.position)).toArray() as V3:worldToLocal(target,e.position);support.heading=e.heading-target.heading;}
  }
  private restoreContact(){
    const e=this.entity,s=e?.nathan?.support;if(!e||!s||!this.actor)return;
    if(s.progress<1&&this.access?.contacts){const pose=this.access.driver?driverPose(this.access,s.progress):stairPose(this.access.contacts,s.progress);this.actor.motion(s.kind==='rear'?'Climbing_Ladder':'Climbing');this.actor.contact(pose.contact);this.actor.pause();}
  }
  operateGate(id:string){
    const e=this.entity,gate=this.hooks.entities().find(o=>o.id===id&&o.preset==='PEDESTRIAN_GATE');if(!e||!gate||e.nathan?.support)return false;
    const nav=this.navigation(),points=[-.55,.55].map(z=>localToWorld(gate,[.18,0,z]));
    const point=points.sort((a,b)=>distance(a,e.position)-distance(b,e.position)).find(p=>nav.path(e.position,p));
    if(!point||!this.walkTo(point))return this.fail('Acil çıkış kapısına güvenli erişim bulunamadı.');
    this.operation=id;this.operationTime=0;return true;
  }
  private followSupports(){
    for(const e of this.hooks.entities()){
      const s=e.nathan?.support;if(!s)continue;const target=this.hooks.entities().find(t=>t.id===s.targetId),root=this.hooks.object(e.id),actor=this.actors.states.get(e.id)?.actor;
      if(!target||!root)continue;
      const node=s.anchor&&this.hooks.object(target.id)?.getObjectByName(s.anchor);
      if(node&&s.local){e.position=node.localToWorld(new T.Vector3(...s.local)).toArray() as V3;e.heading=target.heading+(s.heading||0);applyTransform(root,e);}
      if(s.kind==='driver'&&s.progress===1){const vehicle=this.hooks.object(target.id),d=vehicle&&driverLanding(vehicle,target.heading);if(d){actor?.motion('Driving');actor?.contact({feet:d.feet,seated:d.seat,hands:d.hands,lean:.12});}}
      if(s.progress<1&&['rear','platform','driver'].includes(s.kind)&&!(this.id===e.id&&['climbing','descending'].includes(this.phase))){const a=makeNathanAccess(target,this.hooks.object(target.id),s.kind as NathanAccessKind,this.navigation());if(a?.contacts){const pose=a.driver?driverPose(a,s.progress):stairPose(a.contacts,s.progress);actor?.motion(s.kind==='rear'?'Climbing_Ladder':'Climbing');actor?.contact(pose.contact);actor?.pause();}}
      if(s.progress===1&&['rear','platform'].includes(s.kind)){
        if(!s.anchor){s.anchor=s.kind==='platform'?'Platform_Grey_Floor':'Tank_Top_Walkway';const floor=this.hooks.object(target.id)?.getObjectByName(s.anchor);if(floor)s.local=floor.worldToLocal(new T.Vector3(...e.position)).toArray() as V3;}
        root.updateWorldMatrix(true,true);actor?.contact(standingContact(root));
      }
    }
  }
  private continueDestination() {
    const goal=this.destination;if(!goal)return false;this.destination=undefined;
    if(goal.tankId)this.tankTo(goal.tankId,goal.point);else this.walkTo(goal.point);return true;
  }
  private startRoof(legs: RoofLeg[], descend=false) {
    if(!legs.length)return false;
    this.begin();this.journey=[];this.access=undefined;this.roofLegs=legs;this.roofAfterDescent=descend;
    this.nextRoofLeg();this.setMode('person');this.status(descend?'Tank merdivenine yürüyor…':'Tank çatısı / köprü üzerinde yürüyor…','roofwalking');return true;
  }
  private nextRoofLeg() {
    const e=this.entity!,leg=this.roofLegs.shift();if(!leg)return false;
    this.roofLeg=leg;this.route=leg.points.map(p=>[...p]);this.roofTravel=0;this.velocity=0;this.nav=this.navigation();this.navAge=0;
    e.nathan={...validateNathan(e.nathan),support:{targetId:leg.surfaceId,kind:leg.kind,progress:leg.kind==='tank'?1:0,
      ...(leg.kind==='bridge'?{fromTankId:leg.fromTankId,toTankId:leg.toTankId}:{})}};
    this.rememberSupport();return true;
  }
  private resumeBridge(returning=false,descend=false) {
    const e=this.entity,support=e?.nathan?.support,bridge=support&&this.hooks.entities().find(b=>b.id===support.targetId);
    if(!e||support?.kind!=='bridge'||!bridge||!support.fromTankId||!support.toTankId)return this.fail('Kayıtlı köprü bağlantısı bulunamadı.');
    const full=makeRoofBridge(bridge,returning?support.toTankId:support.fromTankId,this.hooks.entities(),this.navigation(),.34*e.scale);
    const rest=full&&remainingRoofBridge(full,e.position);
    if(!rest)return this.fail('Köprü değişmiş veya yol kapanmış; geçiş durduruldu.');
    return this.startRoof([rest],descend);
  }
  private tickRoof(dt: number) {
    const e=this.entity!,leg=this.roofLeg,support=e.nathan?.support;
    const surface=leg&&this.hooks.entities().find(o=>o.id===leg.surfaceId);
    if(!leg||!surface||!support){this.fail('Yürünülen tank / köprü desteği bulunamadı.');return;}
    this.navAge+=dt;
    if(!this.nav||this.navAge>.25){
      this.nav=this.navigation();this.navAge=0;
      if(leg.kind==='bridge'&&!makeRoofBridge(surface,leg.fromTankId!,this.hooks.entities(),this.nav,.34*e.scale)){this.fail('Köprü yolu kapandı. Nathan durdu.');return;}
    }
    const next=this.route[0];
    if(!next){
      if(leg.kind==='bridge')e.nathan!.support={targetId:leg.toTankId!,kind:'tank',progress:1};
      this.rememberSupport();
      if(this.nextRoofLeg())return;
      this.roofLeg=undefined;this.idle();this.status('Tank çatısında bekliyor · Idle','standing');
      if(this.roofAfterDescent){this.roofAfterDescent=false;this.descend();}
      else if(!this.continueDestination())this.commit();return;
    }
    const d=new T.Vector3(...e.position).distanceTo(new T.Vector3(...next));
    if(d<.012){e.position=[...next];this.route.shift();this.rememberSupport();this.transform();return;}
    const heading=Math.atan2(next[0]-e.position[0],-(next[2]-e.position[2]))*180/Math.PI,error=this.turn(heading,dt);
    const desired=Math.min(.85*e.scale,Math.sqrt(2*2*d));this.velocity=T.MathUtils.clamp(desired,this.velocity-3*dt,this.velocity+1.8*dt);
    const step=error>30?0:Math.min(d,this.velocity*dt),p=new T.Vector3(...e.position).lerp(new T.Vector3(...next),step/d).toArray() as V3;
    const except=leg.kind==='bridge'?surface.id:roofBridgeIds(surface.id,this.hooks.entities());
    if(!this.nav.clear(e.position,p,except)||(leg.kind==='tank'&&!onTankRoof(surface,p,.34*e.scale))){this.fail('Çatı yolu kapandı. Nathan durdu; boş bir nokta seçin.');return;}
    e.position=p;this.roofTravel+=step;
    if(leg.kind==='bridge')support.progress=Math.min(.999,this.roofTravel/leg.points.slice(1).reduce((n,p,i)=>n+new T.Vector3(...p).distanceTo(new T.Vector3(...leg.points[i])),0));
    this.actor!.motion(step>.0001?'Nathan_Original_Walk':'Idle',step>.0001?step/Math.max(dt,.001)/(1.15*e.scale):1);
    this.rememberSupport();this.transform();
  }
  private tankStairs(dt: number,down: boolean) {
    const e=this.entity!,access=this.access!,support=e.nathan!.support!,speed=.55*e.scale;
    const progress=T.MathUtils.clamp(support.progress+(down?-1:1)*speed*dt/access.length,0,1),point=sampleAccess(access,progress);
    const heading=Math.atan2(point[0]-e.position[0],-(point[2]-e.position[2]))*180/Math.PI;
    if(distance(e.position,point)>.0001&&this.turn(heading,dt)>20){this.actor!.motion('Idle');return;}
    const slope=point[1]-e.position[1];support.progress=progress;e.position=point;
    if(Math.abs(slope)<.0001)this.actor!.motion('Nathan_Original_Walk',speed/(1.15*e.scale));else this.stairsMotion(slope<0);
    this.rememberSupport();
    if(!down&&progress===1){this.access=undefined;this.idle();this.status('Tank çatısında bekliyor. Çatıya, bağlı köprüye veya diğer tanka tıklayın.','standing');if(!this.continueDestination())this.commit();}
    if(down&&progress===0){delete e.nathan!.support;this.access=undefined;e.position[1]=0;this.idle();this.status('Tank merdiveninden zemine indi · Idle','idle');if(!this.continueDestination())this.commit();}
  }
  private stairsMotion(down:boolean){if(!down||!this.actor!.motion('Descending_Stairs',.65))this.actor!.motion('Running_Up_Stairs',.65,down);}
}
