import type { Entity } from './scene-data';
import { VehicleMotion, buildDrivePath, clamp, type DriveRoute, type Point, type Signal } from './vehicle-motion';
import { captureDriveCheckpoint, restoreDriveCheckpoint, type DriveCheckpoint } from './drive-checkpoint';
type Hooks={entities:()=>Entity[];routes:()=>DriveRoute[];driveStates:()=>DriveCheckpoint[];retainDrive:(id:string,state?:DriveCheckpoint)=>void;save:()=>void;saveRoute:(r:DriveRoute)=>void;checkpoint:()=>void;changed:()=>void;running:(id:string)=>boolean;engine:(id:string,on:boolean)=>void;blocked:(id:string)=>boolean;wheelbase:(id:string)=>number;move:(id:string,m:VehicleMotion,follow:boolean)=>void;path:(points:Point[])=>void;notify:(s:string)=>void;focus:()=>void};
export class DrivingPanel{
  element:HTMLElement;motion?:VehicleMotion;vehicleId?:string;drawing=false;points:Point[]=[];private keys=new Set<string>();private checkpointed=false;private routeId='';private start?:{position:Entity['position'];heading:number};private lang:'tr'|'en'='tr';private follow=true;private status?:HTMLElement;
  constructor(host:HTMLElement,private hooks:Hooks){this.element=document.createElement('section');this.element.className='ws-driving';this.element.hidden=true;host.append(this.element);window.addEventListener('blur',()=>this.pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});}
  get active(){return !this.element.hidden;}
  private say(tr:string,en:string){return this.lang==='tr'?tr:en;}
  private get entity(){return this.hooks.entities().find(e=>e.id===this.vehicleId);}
  setLanguage(lang:'tr'|'en'){this.lang=lang;if(this.active)this.render();}
  open(entity:Entity){
    this.close();this.vehicleId=entity.id;this.start={position:[...entity.position],heading:entity.heading};
    this.motion=new VehicleMotion({x:entity.position[0],z:entity.position[2],heading:entity.heading*Math.PI/180});
    this.motion.wheelbase=this.hooks.wheelbase(entity.id);this.routeId=this.hooks.routes().find(r=>r.vehicleId===entity.id)?.id||'';
    const saved=this.hooks.driveStates().find(s=>s.vehicleId===entity.id),route=saved&&this.hooks.routes().find(r=>r.id===saved.routeId);
    if(saved&&route&&saved.scale===entity.scale&&restoreDriveCheckpoint(this.motion,saved,route)){
      this.routeId=route.id;this.start={position:[saved.start.x,entity.position[1],saved.start.z],heading:saved.start.heading*180/Math.PI};
      this.hooks.notify(this.say('Kayıtlı sürüş açıldı. Devam etmek için aracı çalıştırıp Devam’a basın.','Saved drive loaded. Start the engine and press Resume to continue.'));
    }else if(saved){this.hooks.retainDrive(entity.id);this.hooks.notify(this.say('Sahne veya güzergâh değişmiş; araç kayıtlı konumunda kaldı.','Scene or route changed; the vehicle remains at its saved position.'));}
    this.element.hidden=false;this.render();this.showRoute();this.hooks.focus();
  }
  close(){this.pause();this.element.hidden=true;this.drawing=false;this.points=[];this.hooks.path([]);this.motion=undefined;this.vehicleId=undefined;this.start=undefined;this.routeId='';}
  private remember(){if(this.vehicleId&&this.motion)this.hooks.retainDrive(this.vehicleId,captureDriveCheckpoint(this.vehicleId,this.motion,this.entity?.scale));}
  pause(){this.keys.clear();this.motion?.stop();this.remember();if(this.checkpointed){this.hooks.changed();this.checkpointed=false;}this.updateStatus();}
  private begin(){if(!this.checkpointed){this.hooks.checkpoint();this.checkpointed=true;}}
  key(key:string,down:boolean){if(!this.active||!this.motion)return false;key=key.toLowerCase();if(!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','q','e','h','escape'].includes(key))return false;
    if(down){if(!this.keys.has(key)){if(key==='q'||key==='e'||key==='h')this.signal(({q:'left',e:'right',h:'hazard'} as const)[key]);if(key==='escape')this.pause();}this.keys.add(key);}else this.keys.delete(key);
    if(down&&['w','s','arrowup','arrowdown'].includes(key)&&this.motion.mode!=='manual'){this.motion.stop();this.motion.mode='manual';this.remember();}
    return true;
  }
  private signal(value:Signal){if(this.motion)this.motion.signal=this.motion.signal===value?'off':value;this.updateStatus();}
  private route(){return this.hooks.routes().find(r=>r.id===this.routeId&&r.vehicleId===this.vehicleId);}
  private readSettings():Pick<DriveRoute,'speedKmh'|'approachKmh'|'approachDistance'|'aircraftId'>{
    const value=(id:string,fallback:number)=>Number((this.element.querySelector(`[data-value="${id}"]`) as HTMLInputElement)?.value)||fallback;
    return {speedKmh:clamp(value('speed',8),1,25),approachKmh:clamp(value('approach',2),1,5),approachDistance:clamp(value('distance',20),5,100),aircraftId:(this.element.querySelector('[data-value="aircraft"]') as HTMLSelectElement)?.value||undefined};
  }
  private showRoute(){const r=this.route();if(!r){this.hooks.path([]);return;}if(this.motion?.route?.id===r.id&&this.motion.path.length){this.hooks.path(this.motion.path.map(p=>[p.x,p.z]));return;}try{const heading=this.entity!.heading*Math.PI/180;this.hooks.path(buildDrivePath(r.points,heading,this.motion?.wheelbase).map(p=>[p.x,p.z]));}catch{this.hooks.path(r.points);}}
  click(x:number,z:number){if(!this.drawing)return false;const last=this.points.at(-1)!;if(Math.hypot(x-last[0],z-last[1])<1)return true;if(this.points.length>=500)return true;this.points.push([x,z]);this.hooks.path(this.points);this.updateStatus();return true;}
  tick(dt:number){
    const m=this.motion,e=this.entity;if(!this.active||!m||!e)return;
    const k=(...keys:string[])=>keys.some(key=>this.keys.has(key));m.throttle=Number(k('w','arrowup'))-Number(k('s','arrowdown'));m.turn=Number(k('d','arrowright'))-Number(k('a','arrowleft'));m.brake=k(' ');m.maxKmh=this.readSettings().speedKmh;
    const wantsMove=!!m.throttle||m.mode==='route'||Math.abs(m.speed)>.001;
    if(wantsMove&&!this.hooks.running(e.id)){this.keys.clear();m.stop();this.hooks.notify(this.say('Önce aracı çalıştırın.','Start the engine first.'));}
    else if(wantsMove&&this.hooks.blocked(e.id)){this.keys.clear();m.stop();this.hooks.notify(this.say('Sürüş için platformu, korkuluğu ve platform kapısını kapatın.','Close platform, railing and platform gate before driving.'));}
    else if(wantsMove)this.begin();
    const oldMode=m.mode,travel=m.step(dt,this.hooks.running(e.id),this.hooks.blocked(e.id));
    if(travel){this.hooks.move(e.id,m,this.follow);}
    if(oldMode==='route'&&m.mode==='complete'){this.remember();this.hooks.changed();this.checkpointed=false;this.hooks.notify(this.say('Güzergâh tamamlandı. Araç durdu; ikmal adımları henüz bağlı değil.','Route complete. Vehicle stopped; refuelling steps are not connected yet.'));}
    if(!m.speed&&this.checkpointed&&m.mode!=='route'){this.remember();this.hooks.changed();this.checkpointed=false;}
    this.updateStatus();
  }
  private render(){
    const m=this.motion!,r=this.route(),settings=r||{speedKmh:8,approachKmh:2,approachDistance:20};
    this.element.innerHTML=`<header><b>R14 · 38.000 L</b><button data-drive="close" aria-label="${this.say('Sürüş panelini kapat','Close driving panel')}">×</button></header><output aria-live="off"></output><div class="drive-row"><button data-drive="engine"></button><button data-drive="pause">${this.say('Durdur','Stop')}</button><button data-drive="follow">${this.say('Kamera takip','Follow camera')}</button></div><div class="drive-row"><button data-signal="left">◀ ${this.say('Sol','Left')}</button><button data-signal="hazard">△</button><button data-signal="right">${this.say('Sağ','Right')} ▶</button></div><div class="drive-pad"><button data-key="w" aria-label="${this.say('İleri gaz','Forward throttle')}">↑</button><button data-key="a" aria-label="${this.say('Sola direksiyon','Steer left')}">←</button><button data-key=" " aria-label="${this.say('Fren','Brake')}">${this.say('FREN','BRAKE')}</button><button data-key="d" aria-label="${this.say('Sağa direksiyon','Steer right')}">→</button><button data-key="s" aria-label="${this.say('Geri gaz','Reverse throttle')}">↓</button></div><small>W/A/S/D · ${this.say('Boşluk: fren · Q/E: sinyal','Space: brake · Q/E: signal')}</small><details><summary>${this.say('Güzergâh ve yaklaşma','Route and approach')}</summary><label>${this.say('Kayıtlı güzergâh','Saved route')}<select data-value="route"><option value="">${this.say('Yeni güzergâh','New route')}</option></select></label><label>${this.say('Hedef uçak','Target aircraft')}<select data-value="aircraft"><option value="">${this.say('Seçilmedi','Not selected')}</option></select></label><div class="drive-row"><label>${this.say('Hız (km/sa)','Speed (km/h)')}<input data-value="speed" type="number" min="1" max="25" value="${settings.speedKmh}"></label><label>${this.say('Yaklaşma (km/sa)','Approach (km/h)')}<input data-value="approach" type="number" min="1" max="5" value="${settings.approachKmh}"></label></div><label>${this.say('Yavaşlama bölgesi (m)','Approach zone (m)')}<input data-value="distance" type="number" min="5" max="100" value="${settings.approachDistance}"></label><div class="drive-row"><button data-drive="draw">${this.say('Güzergâh çiz','Draw route')}</button><button data-drive="finish">${this.say('Çizimi bitir','Finish route')}</button><button data-drive="cancel">${this.say('Vazgeç','Cancel')}</button></div><div class="drive-row"><button data-drive="play">${this.say('Güzergâhı başlat','Start route')}</button><button data-drive="resume">${this.say('Devam','Resume')}</button><button data-drive="reset">${this.say('Başlangıca geri al','Reset to start')}</button></div><small>${this.say('İlk nokta araç konumu. Aracın önünden başlayarak yolu tıklayın; son nokta park yeridir. Hızlar prova ayarıdır. Otomatik çarpışma / kanat açıklığı kontrolü henüz yok.','First point is the vehicle position. Tap a path ahead; last point is parking. Speeds are rehearsal settings. Automatic collision / wing-clearance checking is not yet available.')}</small></details>`;
    this.status=this.element.querySelector('output')!;
    const save=document.createElement('button');save.type='button';save.dataset.drive='save';save.textContent=this.say('Sürüşü kaydet','Save drive');save.style.width='100%';this.status.after(save);
    if(m.mode==='paused'&&m.path.length)this.element.querySelector('details')!.open=true;
    const select=this.element.querySelector('[data-value="route"]') as HTMLSelectElement;for(const route of this.hooks.routes().filter(r=>r.vehicleId===this.vehicleId))select.add(new Option(route.name,route.id));select.value=this.routeId;select.onchange=()=>{this.pause();this.routeId=select.value;m.mode='manual';m.path=[];m.route=undefined;this.remember();this.hooks.changed();this.render();this.showRoute();};
    const aircraft=this.element.querySelector('[data-value="aircraft"]') as HTMLSelectElement;for(const e of this.hooks.entities().filter(e=>e.kind==='aircraft'))aircraft.add(new Option(e.name,e.id));aircraft.value=r?.aircraftId||'';
    this.element.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.key(b.dataset.key!,true);};const release=()=>this.key(b.dataset.key!,false);b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;});
    this.element.querySelectorAll<HTMLButtonElement>('[data-signal]').forEach(b=>b.onclick=()=>this.signal(b.dataset.signal as Signal));
    this.element.querySelectorAll<HTMLButtonElement>('[data-drive]').forEach(b=>b.onclick=()=>{try{this.action(b.dataset.drive!);}catch(e){this.hooks.notify((e as Error).message);}});this.updateStatus();
  }
  private action(action:string){
    const e=this.entity,m=this.motion;if(!e||!m)return;
    if(action==='close'){this.close();return;}if(action==='pause'){this.pause();return;}
    if(action==='save'){this.pause();this.hooks.save();return;}
    if(action==='engine'){const on=!this.hooks.running(e.id);this.hooks.engine(e.id,on);if(!on)this.pause();}
    if(action==='follow')this.follow=!this.follow;
    if(action==='draw'){this.pause();this.drawing=true;this.points=[[e.position[0],e.position[2]]];this.hooks.path(this.points);this.hooks.notify(this.say('Yolu haritaya tıklayarak çizin. Son nokta araç merkezinin park konumu olacak.','Tap the route on the map. The last point is the parking position of the vehicle centre.'));}
    if(action==='cancel'){this.drawing=false;this.points=[];this.showRoute();}
    if(action==='finish'){
      if(!this.drawing)return;const settings=this.readSettings();m.wheelbase=this.hooks.wheelbase(e.id);const path=buildDrivePath(this.points,m.pose.heading,m.wheelbase);
      const target=this.hooks.entities().find(e=>e.id===settings.aircraftId),route:DriveRoute={id:crypto.randomUUID(),name:`R14 → ${target?.name||this.say('Park','Parking')}`,vehicleId:e.id,points:this.points.map(p=>[...p]),...settings};this.hooks.saveRoute(route);this.routeId=route.id;this.drawing=false;m.mode='manual';m.path=[];m.route=undefined;this.remember();this.hooks.path(path.map(p=>[p.x,p.z]));this.render();this.hooks.notify(this.say('Güzergâh hazır. Kalıcı tutmak için Kaydet’e basın.','Route ready. Press Save to keep it.'));
    }
    if(action==='play'){
      if(!this.hooks.running(e.id))throw new Error(this.say('Önce aracı çalıştırın.','Start the engine first.'));
      if(this.hooks.blocked(e.id))throw new Error(this.say('Platform, korkuluk ve kapı kapalı olmalı.','Platform, railing and gate must be closed.'));
      const r=this.route();if(!r)throw new Error(this.say('Önce güzergâh çizin.','Draw a route first.'));
      const updated={...r,...this.readSettings()};m.wheelbase=this.hooks.wheelbase(e.id);m.startRoute(updated);this.start={position:[...e.position],heading:e.heading};this.hooks.saveRoute(updated);this.remember();this.hooks.path(m.path.map(p=>[p.x,p.z]));this.begin();
    }
    if(action==='resume'&&m.mode==='paused'&&m.path.length){
      if(!this.hooks.running(e.id))throw new Error(this.say('Önce aracı çalıştırın.','Start the engine first.'));
      if(this.hooks.blocked(e.id))throw new Error(this.say('Platform, korkuluk ve kapı kapalı olmalı.','Platform, railing and gate must be closed.'));
      m.mode='route';this.begin();
    }
    if(action==='reset'&&this.start){this.pause();this.begin();m.pose={x:this.start.position[0],z:this.start.position[2],heading:this.start.heading*Math.PI/180};m.distance=0;m.mode='manual';m.progress=0;m.path=[];m.route=undefined;this.remember();this.hooks.move(e.id,m,this.follow);this.hooks.changed();this.checkpointed=false;}
    this.updateStatus();
  }
  private updateStatus(){
    if(!this.active||!this.status||!this.motion)return;const m=this.motion;
    const state=this.drawing?this.say(`Çizim · ${this.points.length} nokta`,`Drawing · ${this.points.length} points`):m.mode==='complete'?this.say('Park edildi','Parked'):m.mode==='paused'?this.say(`Duraklatıldı · ${m.remaining.toFixed(1)} m`,`Paused · ${m.remaining.toFixed(1)} m`):m.mode==='route'?this.say(`Güzergâh · ${m.remaining.toFixed(1)} m`,`Route · ${m.remaining.toFixed(1)} m`):this.say('Elle sürüş','Manual driving');
    const text=`${Math.abs(m.speed*3.6).toFixed(1)} km/sa · ${m.speed<-.01?'R':'D'} · ${state}`;if(this.status.textContent!==text)this.status.textContent=text;
    this.element.querySelectorAll<HTMLButtonElement>('[data-signal]').forEach(b=>b.classList.toggle('active',b.dataset.signal===m.signal));
    const resume=this.element.querySelector<HTMLButtonElement>('[data-drive="resume"]');if(resume)resume.disabled=m.mode!=='paused'||!m.path.length;
    const engine=this.element.querySelector('[data-drive="engine"]')!;engine.textContent=this.hooks.running(this.vehicleId!)?this.say('Motoru durdur','Stop engine'):this.say('Aracı çalıştır','Start engine');this.element.querySelector('[data-drive="follow"]')?.classList.toggle('active',this.follow);
  }
}
