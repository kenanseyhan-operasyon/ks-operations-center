import {cleanRouteName,nextRouteName,routeNameTaken,routeOptionLabel} from './route-management';
import {TEST_RATES} from './simulation-clock';
import type {VehicleAudio} from './vehicle-audio';
import {analyzeRoute,improveRoutePoint,pathPoints,routeStart,type RouteDisplay,type RouteAnalysis} from './route-planning';
import type { r14Dimensions } from './r14-spec';
import type { Entity } from './scene-data';
import { VehicleMotion, clamp, type DriveRoute, type Point, type Signal } from './vehicle-motion';
import { captureDriveCheckpoint, restoreDriveCheckpoint, type DriveCheckpoint } from './drive-checkpoint';
type Hooks={cabin?:(inside:boolean)=>boolean;entities:()=>Entity[];routes:()=>DriveRoute[];driveStates:()=>DriveCheckpoint[];retainDrive:(id:string,state?:DriveCheckpoint)=>void;save:()=>void;canSave?:()=>boolean;canDesign?:()=>boolean;enterDesign?:()=>boolean;removeRoute?:(id:string)=>void;audio?:VehicleAudio;saveRoute:(r:DriveRoute)=>void;checkpoint:()=>void;changed:()=>void;running:(id:string)=>boolean;engine:(id:string,on:boolean)=>void;blocked:(id:string)=>boolean;wheelbase:(id:string)=>number;articulation:(id:string)=>ReturnType<typeof r14Dimensions>;move:(id:string,m:VehicleMotion,follow:boolean)=>void;path:(display:RouteDisplay)=>void;gateWaiting:(e:Entity,m:VehicleMotion)=>string|undefined;openGate:(id:string)=>void;notify:(s:string)=>void;focus:()=>void};
export class DrivingPanel{
  element:HTMLElement;motion?:VehicleMotion;vehicleId?:string;drawing=false;points:Point[]=[];private keys=new Set<string>();private checkpointed=false;private routeId='';private start?:{position:Entity['position'];heading:number;trailerAngle:number};private lang:'tr'|'en'='tr';private follow=true;private cabin=false;private cabCompact=true;private status?:HTMLElement;
  private draftReference?:'front-axle';private draftHeading=0;private draftTrailerAngle=0;private editingRouteId='';private selectedPoint=1;private draftUndo:Point[][]=[];private analysis?:RouteAnalysis;private waitingGate='';private testRate=1;private deletePending=false;
  get horn(){return this.active&&this.keys.has('b');}
  get inside(){return this.cabin;}
  setCabin(inside:boolean){if(inside===this.cabin)return true;if(inside&&(!this.active||this.drawing))return false;if(this.hooks.cabin?.(inside)===false||inside&&!this.hooks.cabin)return false;this.cabin=inside;this.cabCompact=true;this.element.classList.toggle('cab-compact',inside);this.updateStatus();return true;}
  get rate(){return this.active&&!this.drawing?this.testRate:1;}
  private get canDesign(){return this.hooks.canDesign?.()??true;}
  refreshMode(){const open=this.element.querySelector('details')?.open;if(!this.canDesign&&this.drawing){this.drawing=false;this.points=[];}if(this.active){this.render();if(open)this.element.querySelector('details')!.open=true;if(this.drawing)this.previewDraft();else this.showRoute();}}
  constructor(host:HTMLElement,private hooks:Hooks){this.element=document.createElement('section');this.element.className='ws-driving';this.element.hidden=true;host.append(this.element);this.element.addEventListener('pointerdown',e=>{if(!(e.target as HTMLElement).closest('[data-drive="sound"]'))this.hooks.audio?.unlock();});window.addEventListener('blur',()=>this.pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});}
  get active(){return !this.element.hidden;}
  private say(tr:string,en:string){return this.lang==='tr'?tr:en;}
  private get entity(){return this.hooks.entities().find(e=>e.id===this.vehicleId);}
  setLanguage(lang:'tr'|'en'){this.lang=lang;if(this.active)this.render();}
  open(entity:Entity){
    this.close();this.vehicleId=entity.id;this.start={position:[...entity.position],heading:entity.heading,trailerAngle:entity.trailerAngle||0};
    this.motion=new VehicleMotion({x:entity.position[0],z:entity.position[2],heading:entity.heading*Math.PI/180});
    Object.assign(this.motion,this.hooks.articulation(entity.id));this.motion.trailerAngle=entity.trailerAngle||0;this.routeId=this.hooks.routes().find(r=>r.vehicleId===entity.id)?.id||'';
    const saved=this.hooks.driveStates().find(s=>s.vehicleId===entity.id),route=saved&&this.hooks.routes().find(r=>r.id===saved.routeId);
    if(saved&&route&&saved.scale===entity.scale&&restoreDriveCheckpoint(this.motion,saved,route)){
      this.routeId=route.id;this.start={position:[saved.start.x,entity.position[1],saved.start.z],heading:saved.start.heading*180/Math.PI,trailerAngle:saved.trailer?.startAngle||0};
      this.hooks.notify(this.say('Kayıtlı sürüş açıldı. Devam etmek için aracı çalıştırıp Devam’a basın.','Saved drive loaded. Start the engine and press Resume to continue.'));
    }else if(saved){this.hooks.retainDrive(entity.id);this.hooks.notify(this.say('Sahne veya güzergâh değişmiş; araç kayıtlı konumunda kaldı.','Scene or route changed; the vehicle remains at its saved position.'));}
    this.element.hidden=false;this.render();this.showRoute();this.hooks.focus();
  }
  close(){this.setCabin(false);this.testRate=1;this.deletePending=false;this.waitingGate='';this.pause();this.element.hidden=true;this.drawing=false;this.points=[];this.hooks.path({points:[]});this.motion=undefined;this.vehicleId=undefined;this.start=undefined;this.routeId='';}
  private remember(){if(this.vehicleId&&this.motion)this.hooks.retainDrive(this.vehicleId,captureDriveCheckpoint(this.vehicleId,this.motion,this.entity?.scale));}
  pause(){this.keys.clear();this.motion?.stop();this.remember();if(this.checkpointed){this.hooks.changed();this.checkpointed=false;}this.updateStatus();}
  private begin(){if(!this.checkpointed){this.hooks.checkpoint();this.checkpointed=true;}}
  key(key:string,down:boolean){if(!this.active||!this.motion)return false;key=key.toLowerCase().replace(/\u0307/g,'').replace('ı','i');if(this.drawing){if(down&&key==='escape')this.action('cancel');if(down&&(key==='delete'||key==='backspace'))this.action('delete-point');return ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','escape','delete','backspace'].includes(key);}if(!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','q','e','h','b','c','i','escape'].includes(key))return false;
    if(down){this.hooks.audio?.unlock();if(!this.keys.has(key)){if(key==='q'||key==='e'||key==='h')this.signal(({q:'left',e:'right',h:'hazard'} as const)[key]);if(key==='escape')this.pause();if(key==='c')this.setCabin(!this.cabin);if(key==='i')this.action('engine');}this.keys.add(key);}else this.keys.delete(key);
    if(down&&['w','s','arrowup','arrowdown'].includes(key)&&this.motion.mode!=='manual'){this.motion.stop();this.motion.mode='manual';this.remember();}
    return true;
  }
  releaseFollow(){if(this.active&&this.follow){this.follow=false;this.updateStatus();}}
  private signal(value:Signal){if(this.motion)this.motion.signal=this.motion.signal===value?'off':value;this.updateStatus();}
  private route(){return this.hooks.routes().find(r=>r.id===this.routeId&&r.vehicleId===this.vehicleId);}
  private readSettings():Pick<DriveRoute,'speedKmh'|'approachKmh'|'approachDistance'|'aircraftId'>{
    const value=(id:string,fallback:number)=>Number((this.element.querySelector(`[data-value="${id}"]`) as HTMLInputElement)?.value)||fallback;
    return {speedKmh:clamp(value('speed',8),1,25),approachKmh:clamp(value('approach',2),1,5),approachDistance:clamp(value('distance',20),5,100),aircraftId:(this.element.querySelector('[data-value="aircraft"]') as HTMLSelectElement)?.value||undefined};
  }
  private routeHeading(r:DriveRoute){return r.startHeading??this.hooks.driveStates().find(s=>s.routeId===r.id)?.start.heading??this.entity!.heading*Math.PI/180;}
  private showRoute(){
    const r=this.route();if(!r){this.hooks.path({points:[]});return;}
    if(this.motion?.route?.id===r.id&&this.motion.path.length){this.hooks.path({points:pathPoints(this.motion.path)});return;}
    const result=analyzeRoute(r.points,this.routeHeading(r),this.motion!,r.reference);
    this.hooks.path({points:result.path.length?pathPoints(result.path):r.points,danger:result.danger});
  }
  private editRoute(r?:DriveRoute){
    if(!this.canDesign){this.hooks.notify(this.say('Rotayı değiştirmek için Çizim / Tasarım moduna geçin.','Enter Drawing / Design mode to edit the route.'));return;}
    this.setCabin(false);this.pause();const e=this.entity!,m=this.motion!;this.drawing=true;this.editingRouteId=r?.id||'';
    this.draftReference=r?r.reference:'front-axle';this.draftHeading=r?this.routeHeading(r):m.pose.heading;
    this.draftTrailerAngle=r?this.hooks.driveStates().find(s=>s.routeId===r.id)?.trailer?.startAngle??(m.route?.id===r.id?m.routeStartTrailerAngle:m.trailerAngle):m.trailerAngle;
    const offset=this.draftReference==='front-axle'?m.frontAxleOffset:0;
    this.points=r?r.points.map(p=>[...p]):[[e.position[0]+Math.sin(m.pose.heading)*offset,e.position[2]-Math.cos(m.pose.heading)*offset]];
    this.draftUndo=[];this.selectedPoint=this.points.length>1?1:0;this.render();this.previewDraft();
  }
  private keepDraft(){this.draftUndo.push(this.points.map(p=>[...p]));if(this.draftUndo.length>30)this.draftUndo.shift();}
  private draftGeometry(){return {...this.hooks.articulation(this.vehicleId!),trailerAngle:this.draftTrailerAngle};}
  private previewDraft(){
    if(!this.drawing)return;this.analysis=analyzeRoute(this.points,this.draftHeading,this.draftGeometry(),this.draftReference);
    this.hooks.path({points:this.analysis.path.length?pathPoints(this.analysis.path):this.points,danger:this.analysis.danger,handles:this.points,nodes:this.analysis.nodes,selected:this.selectedPoint});
    this.updateDraftStatus();this.updateStatus();
  }
  private updateDraftStatus(){
    const el=this.element.querySelector<HTMLElement>('[data-route-feedback]');if(!el)return;
    const bad=this.analysis?.issues||[],numbers=(this.analysis?.nodes||[]).map(i=>i+1).join(', ');
    el.dataset.invalid=String(this.drawing&&bad.length>0);
    el.textContent=!this.drawing?this.say('Yeni çizgi ön tekerleklerin orta noktasını izler.','New routes follow the midpoint of the front wheels.'):this.points.length<2?this.say('Aracın önüne tıklayarak noktalar ekleyin.','Tap ahead of the vehicle to add points.'):bad.length?this.say(`Kırmızı bölüm: ${numbers} numaralı noktaları kontrol edin. Noktayı tutup sürükleyin veya seçili virajı düzeltin.`,`Red section: check points ${numbers}. Drag a point or adjust the selected bend.`):this.say('Güzergâh uygun. Noktaları sürükleyebilir, ardından çizimi bitirebilirsiniz.','Route is feasible. Drag points if needed, then finish.');
    const legacy=this.drawing?!!this.editingRouteId&&!this.draftReference:!!this.route()&&!this.route()!.reference;
    if(legacy)el.textContent=this.say('Bu eski rota araç merkezini izler. Ön aks için “Yeni çiz” kullanın. ','This legacy route follows the vehicle centre. Use Draw new for a front-axle route. ')+(this.drawing?el.textContent:'');
    const selected=this.element.querySelector('[data-selected-point]');if(selected)selected.textContent=this.drawing?this.say(`Seçili nokta: ${this.selectedPoint+1}${this.selectedPoint===0?' (başlangıç sabit)':''}`,`Selected point: ${this.selectedPoint+1}${this.selectedPoint===0?' (start locked)':''}`):'';
    for(const name of ['fix-point','delete-point','undo-point']){const button=this.element.querySelector<HTMLButtonElement>(`[data-drive="${name}"]`);if(button)button.disabled=!this.drawing||(name==='undo-point'?!this.draftUndo.length:this.selectedPoint<=0)||(name==='fix-point'&&this.selectedPoint>=this.points.length-1);}
  }
  beginPointDrag(index:number){if(!this.drawing||index<0||index>=this.points.length)return false;this.selectedPoint=index;this.keepDraft();this.previewDraft();return true;}
  movePoint(index:number,x:number,z:number){if(!this.drawing||index<=0||index>=this.points.length||![x,z].every(n=>Number.isFinite(n)&&Math.abs(n)<=50000))return;this.points[index]=[x,z];this.previewDraft();}
  endPointDrag(cancel=false){if(cancel){const old=this.draftUndo.pop();if(old)this.points=old;}this.previewDraft();}
  click(x:number,z:number){
    if(!this.drawing)return false;if(this.points.length>=500)return true;this.keepDraft();
    if(this.editingRouteId&&this.points.length>1){
      let index=1,best=Infinity;
      for(let i=1;i<this.points.length;i++){const a=this.points[i-1],b=this.points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1),d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);if(d<best){best=d;index=i;}}
      this.points.splice(index,0,[x,z]);this.selectedPoint=index;
    }else{const last=this.points.at(-1)!;if(Math.hypot(x-last[0],z-last[1])<.6){this.draftUndo.pop();return true;}this.points.push([x,z]);this.selectedPoint=this.points.length-1;}
    this.previewDraft();return true;
  }
  tick(dt:number,refresh=true){
    const m=this.motion,e=this.entity;if(!this.active||!m||!e||this.drawing)return;
    const k=(...keys:string[])=>keys.some(key=>this.keys.has(key));m.throttle=Number(k('w','arrowup'))-Number(k('s','arrowdown'));m.turn=Number(k('d','arrowright'))-Number(k('a','arrowleft'));m.brake=k(' ');m.maxKmh=this.readSettings().speedKmh;
    const wantsMove=!!m.throttle||m.mode==='route'||Math.abs(m.speed)>.001;
    if(wantsMove&&!this.hooks.running(e.id)){this.keys.clear();m.stop();this.hooks.notify(this.say('Önce aracı çalıştırın.','Start the engine first.'));}
    else if(wantsMove&&this.hooks.blocked(e.id)){this.keys.clear();m.stop();this.hooks.notify(this.say('Sürüş için platformu, korkuluğu ve platform kapısını kapatın.','Close platform, railing and platform gate before driving.'));}
    else if(wantsMove){
      const gate=this.hooks.gateWaiting(e,m);if(gate){m.speed=0;m.braking=true;if(this.waitingGate!==gate)this.hooks.notify(this.say('Kapı açılıyor. Araç geçiş için bekliyor.','Gate opening. Vehicle is waiting for passage.'));this.waitingGate=gate;if(refresh)this.updateStatus();return;}
      this.waitingGate='';this.begin();
    }else this.waitingGate='';
    const wasBlocked=m.articulationBlocked,oldMode=m.mode,travel=m.step(dt,this.hooks.running(e.id),this.hooks.blocked(e.id));
    if(m.articulationBlocked&&!wasBlocked){this.hooks.notify(this.say('Tank fazla katlandığı için hareket durdu. İleri giderek açıyı azaltın; geri manevrada direksiyonu tankın arkasının kaydığı tarafa çevirin.','Movement stopped to prevent the trailer folding further. Pull forward; when reversing, steer toward the side the trailer rear has swung.'));}
    if(travel){this.hooks.move(e.id,m,this.follow);}
    if(oldMode==='route'&&m.mode==='complete'){this.remember();this.hooks.changed();this.checkpointed=false;this.hooks.notify(this.say('Güzergâh tamamlandı. Araç durdu; ikmal adımları henüz bağlı değil.','Route complete. Vehicle stopped; refuelling steps are not connected yet.'));}
    if(!m.speed&&this.checkpointed&&m.mode!=='route'){this.remember();this.hooks.changed();this.checkpointed=false;}
    if(refresh)this.updateStatus();
  }
  private render(){
    const m=this.motion!,r=this.route(),settings=r||{speedKmh:8,approachKmh:2,approachDistance:20};
    this.element.innerHTML=`<header><b data-vehicle-name></b><button data-drive="cab-controls" hidden></button><button data-drive="close" aria-label="${this.say('Sürüş panelini kapat','Close driving panel')}">×</button></header><output aria-live="off"></output><div class="drive-row drive-view-controls"><button data-drive="cabin"></button><button data-drive="horn">${this.say('Korna · B','Horn · B')}</button></div><div class="drive-row"><label>${this.say('Deneme hızı','Test speed')}<select data-value="test-rate">${TEST_RATES.map(n=>`<option value="${n}">${n}×${n===1?this.say(' · Normal',' · Normal'):''}</option>`).join('')}</select></label><button data-drive="sound"></button></div><label data-sound-volume>${this.say('Ses düzeyi','Volume')}<input data-value="volume" type="range" min="0" max="100" step="5" aria-label="${this.say('Ses düzeyi','Volume')}"></label><small>${this.say('2×–8× denemeyi hızlandırır. Km/sa ayarı ve kayıtlı rota aynı kalır.','2×–8× speeds up the demonstration. The km/h setting and saved route stay unchanged.')}</small><div class="drive-row"><button data-drive="engine"></button><button data-drive="pause">${this.say('Durdur','Stop')}</button><button data-drive="follow">${this.say('Kamera takip','Follow camera')}</button></div><div class="drive-row"><button data-signal="left">◀ ${this.say('Sol','Left')}</button><button data-signal="hazard">△</button><button data-signal="right">${this.say('Sağ','Right')} ▶</button></div><div class="drive-pad"><button data-key="w" aria-label="${this.say('İleri gaz','Forward throttle')}">↑</button><button data-key="a" aria-label="${this.say('Sola direksiyon','Steer left')}">←</button><button data-key=" " aria-label="${this.say('Fren','Brake')}">${this.say('FREN','BRAKE')}</button><button data-key="d" aria-label="${this.say('Sağa direksiyon','Steer right')}">→</button><button data-key="s" aria-label="${this.say('Geri gaz','Reverse throttle')}">↓</button></div><small>W/A/S/D · ${this.say('Boşluk: fren · Q/E: sinyal','Space: brake · Q/E: signal')}</small><div class="drive-row"><button data-drive="gate">${this.say('Yakın tesis kapısını aç','Open nearby facility gate')}</button></div><details><summary>${this.say('Güzergâh ve yaklaşma','Route and approach')}</summary><label>${this.say('Kayıtlı güzergâh','Saved route')}<select data-value="route"><option value="">${this.say('Yeni güzergâh','New route')}</option></select></label><div data-route-admin><label>${this.say('Güzergâh adı','Route name')}<input data-value="route-name" maxlength="100" autocomplete="off"></label><div class="drive-row"><button data-drive="rename-route">${this.say('Adı değiştir','Rename')}</button><button data-drive="delete-route">${this.say('Rotayı sil','Delete route')}</button></div><div data-delete-confirm role="alert" hidden><p data-delete-label></p><div class="drive-row"><button data-drive="confirm-delete">${this.say('Evet, rotayı sil','Yes, delete route')}</button><button data-drive="cancel-delete">${this.say('Vazgeç','Cancel')}</button></div></div></div><button data-drive="enter-design">${this.say('Rota tasarımına geç','Open route design')}</button><label>${this.say('Hedef uçak','Target aircraft')}<select data-value="aircraft"><option value="">${this.say('Seçilmedi','Not selected')}</option></select></label><div class="drive-row"><label>${this.say('Hız (km/sa)','Speed (km/h)')}<input data-value="speed" type="number" min="1" max="25" value="${settings.speedKmh}"></label><label>${this.say('Yaklaşma (km/sa)','Approach (km/h)')}<input data-value="approach" type="number" min="1" max="5" value="${settings.approachKmh}"></label></div><label>${this.say('Yavaşlama bölgesi (m)','Approach zone (m)')}<input data-value="distance" type="number" min="5" max="100" value="${settings.approachDistance}"></label><div class="drive-row"><button data-drive="draw">${this.say('Yeni çiz','Draw new')}</button><button data-drive="edit-route">${this.say('Düzenle','Edit route')}</button><button data-drive="finish">${this.say('Çizimi bitir','Finish route')}</button><button data-drive="cancel">${this.say('Vazgeç','Cancel')}</button></div><p data-route-feedback role="status"></p><span data-selected-point></span><div class="drive-row"><button data-drive="fix-point">${this.say('Seçili virajı düzelt','Adjust selected bend')}</button><button data-drive="delete-point">${this.say('Noktayı sil','Delete point')}</button><button data-drive="undo-point">${this.say('Geri al','Undo edit')}</button></div><div class="drive-row"><button data-drive="play">${this.say('Güzergâhı başlat','Start route')}</button><button data-drive="resume">${this.say('Devam','Resume')}</button><button data-drive="reset">${this.say('Başlangıca geri al','Reset to start')}</button></div><small>${this.say('Yeni çizginin son noktası ön aksın park yeridir. Düzenlerken çizgiye tıklayın: araya nokta eklenir. Noktayı tutup sürükleyin; yalnız seçtiğiniz nokta değişir. Kırmızı: direksiyon veya tank dönüş sınırı. Çevredeki engeller ve uçak kanadı ayrıca kontrol edilmelidir.','The endpoint is the front axle parking position. In Edit, tap near a section to insert a point; drag a point to move only that control point. Red means steering or trailer limit. Check surrounding obstacles and aircraft clearance separately.')}</small></details>`;
    this.element.querySelector('[data-vehicle-name]')!.textContent=`${this.entity!.name} · ${this.say('38.000 L','38,000 L')}`;
    this.status=this.element.querySelector('output')!;
    const save=document.createElement('button');save.type='button';save.dataset.drive='save';save.textContent=this.say('Sürüşü kaydet','Save drive');save.style.width='100%';if(this.hooks.canSave&&!this.hooks.canSave()){save.disabled=true;save.textContent=this.say('Gösterim modu · kayıt kapalı','Viewing mode · saving disabled');}this.status.after(save);
    if(this.drawing||(m.mode==='paused'&&m.path.length))this.element.querySelector('details')!.open=true;
    const testRate=this.element.querySelector<HTMLSelectElement>('[data-value="test-rate"]')!;testRate.value=String(this.testRate);testRate.onchange=()=>{const n=Number(testRate.value);this.testRate=TEST_RATES.includes(n as 1)?n:1;this.updateStatus();};
    const audio=this.hooks.audio,sound=this.element.querySelector<HTMLButtonElement>('[data-drive="sound"]')!,volume=this.element.querySelector<HTMLInputElement>('[data-value="volume"]')!;
    sound.hidden=!audio;this.element.querySelector<HTMLElement>('[data-sound-volume]')!.hidden=!audio;volume.value=String((audio?.volume??.2)*100);volume.oninput=()=>audio?.setVolume(Number(volume.value)/100);
    const admin=this.element.querySelector<HTMLElement>('[data-route-admin]')!;admin.hidden=!this.canDesign||!r||this.drawing;
    const name=this.element.querySelector<HTMLInputElement>('[data-value="route-name"]')!;name.value=r?.name||'';name.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();this.action('rename-route');}};
    this.element.querySelector<HTMLElement>('[data-delete-confirm]')!.hidden=!this.deletePending;
    this.element.querySelector('[data-delete-label]')!.textContent=this.say(`“${r?.name||''}” rotası ve bu rotanın sürüş ilerlemesi silinsin mi? Araç yerinde kalır.`,`Delete “${r?.name||''}” and its saved driving progress? The vehicle stays in place.`);
    this.element.querySelector<HTMLElement>('[data-drive="enter-design"]')!.hidden=this.canDesign||!(this.hooks.canSave?.()??true);
    for(const action of ['draw','edit-route','finish','cancel','fix-point','delete-point','undo-point'])this.element.querySelector<HTMLElement>(`[data-drive="${action}"]`)!.hidden=!this.canDesign;
    const select=this.element.querySelector('[data-value="route"]') as HTMLSelectElement;for(const [index,route] of this.hooks.routes().filter(r=>r.vehicleId===this.vehicleId).entries())select.add(new Option(routeOptionLabel(route,index),route.id));select.value=this.routeId;select.onchange=()=>{this.deletePending=false;this.drawing=false;this.points=[];this.pause();this.routeId=select.value;m.mode='manual';m.path=[];m.route=undefined;this.remember();this.hooks.changed();this.render();this.showRoute();};
    const aircraft=this.element.querySelector('[data-value="aircraft"]') as HTMLSelectElement;for(const e of this.hooks.entities().filter(e=>e.kind==='aircraft'))aircraft.add(new Option(e.name,e.id));aircraft.value=r?.aircraftId||'';
    this.element.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.key(b.dataset.key!,true);};const release=()=>this.key(b.dataset.key!,false);b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;});
    this.element.querySelectorAll<HTMLButtonElement>('[data-signal]').forEach(b=>b.onclick=()=>this.signal(b.dataset.signal as Signal));
    this.element.querySelectorAll<HTMLButtonElement>('[data-drive]').forEach(b=>b.onclick=()=>{try{this.action(b.dataset.drive!);}catch(e){this.hooks.notify((e as Error).message);}});this.updateStatus();this.updateDraftStatus();
  }
  private action(action:string){
    const e=this.entity,m=this.motion;if(!e||!m)return;
    if(['rename-route','delete-route','confirm-delete','draw','edit-route','finish'].includes(action)&&!this.canDesign)return;
    if(this.drawing&&['save','play','resume','reset','rename-route','delete-route','confirm-delete'].includes(action)){this.hooks.notify(this.say('Önce çizimi bitirin veya Vazgeç’e basın.','Finish editing or press Cancel first.'));return;}
    if(action==='cabin'){this.setCabin(!this.cabin);return;}
    if(action==='cab-controls'){this.cabCompact=!this.cabCompact;this.element.classList.toggle('cab-compact',this.cabin&&this.cabCompact);this.updateStatus();return;}
    if(action==='horn'){this.hooks.audio?.horn();return;}
    if(action==='enter-design'){if(this.hooks.enterDesign?.())this.refreshMode();return;}
    if(action==='sound'){const a=this.hooks.audio;if(a){if(a.failed&&a.enabled)a.unlock();else a.setEnabled(!a.enabled);this.updateStatus();}return;}
    if(action==='rename-route'){
      const r=this.route(),input=this.element.querySelector<HTMLInputElement>('[data-value="route-name"]')!,name=cleanRouteName(input.value);if(!r)return;
      if(!name||routeNameTaken(this.hooks.routes(),e.id,name,r.id)){this.hooks.notify(this.say('Boş olmayan, bu aracın diğer rotalarından farklı bir ad yazın.','Enter a non-empty name different from this vehicle’s other routes.'));input.focus();return;}
      const updated={...r,name};this.hooks.saveRoute(updated);if(m.route?.id===r.id)m.route=updated;this.remember();this.deletePending=false;this.render();this.element.querySelector('details')!.open=true;
      this.hooks.notify(this.say('Rota adı değişti. Kalıcı tutmak için Sürüşü kaydet’e basın.','Route renamed. Press Save drive to keep it.'));return;
    }
    if(action==='delete-route'||action==='cancel-delete'){this.deletePending=action==='delete-route';this.render();this.element.querySelector('details')!.open=true;return;}
    if(action==='confirm-delete'){
      const r=this.route();if(!r||!this.deletePending||!this.hooks.removeRoute)return;
      this.pause();if(m.route?.id===r.id){m.mode='manual';m.path=[];m.route=undefined;m.progress=0;this.remember();}
      this.hooks.removeRoute(r.id);this.routeId=this.hooks.routes().find(r=>r.vehicleId===e.id)?.id||'';this.deletePending=false;this.render();this.element.querySelector('details')!.open=true;this.showRoute();
      this.hooks.notify(this.say('Rota silindi. Kalıcı tutmak için Sürüşü kaydet’e basın.','Route deleted. Press Save drive to keep it.'));return;
    }
    if(action==='close'){this.close();return;}if(action==='pause'){this.pause();return;}
    if(action==='save'){if(this.hooks.canSave&&!this.hooks.canSave())return;this.pause();this.hooks.save();return;}
    if(action==='engine'){const on=!this.hooks.running(e.id);this.hooks.engine(e.id,on);if(!on)this.pause();}
    if(action==='follow'){this.setCabin(false);this.follow=!this.follow;}
    if(action==='gate'){this.hooks.openGate(e.id);return;}
    if(action==='draw'){this.editRoute();return;}
    if(action==='edit-route'){const r=this.route();if(r)this.editRoute(r);else this.hooks.notify(this.say('Önce güzergâh seçin veya yeni çizin.','Select a route or draw a new one.'));return;}
    if(action==='cancel'){this.drawing=false;this.points=[];this.render();this.showRoute();return;}
    if(action==='undo-point'){const old=this.draftUndo.pop();if(old){this.points=old;this.selectedPoint=Math.min(this.selectedPoint,this.points.length-1);this.previewDraft();}return;}
    if(action==='delete-point'){if(this.drawing&&this.selectedPoint>0){this.keepDraft();this.points.splice(this.selectedPoint,1);this.selectedPoint=Math.min(this.selectedPoint,this.points.length-1);this.previewDraft();}return;}
    if(action==='fix-point'){
      if(!this.drawing)return;const improved=improveRoutePoint(this.points,this.selectedPoint,this.draftHeading,this.draftGeometry(),this.draftReference);
      if(improved){this.keepDraft();this.points=improved;this.previewDraft();}else this.hooks.notify(this.say('Bu noktayı tek başına otomatik düzeltmek mümkün olmadı. Kırmızı bölümdeki noktayı sürükleyin; gerekirse yakınına nokta ekleyin.','This point alone could not be adjusted automatically. Drag a point in the red section or add a nearby point.'));return;
    }
    if(action==='finish'){
      if(!this.drawing)return;this.previewDraft();if(this.analysis?.issues.length){this.selectedPoint=this.analysis.nodes[0]??1;this.previewDraft();return;}
      const settings=this.readSettings(),target=this.hooks.entities().find(e=>e.id===settings.aircraftId),old=this.hooks.routes().find(r=>r.id===this.editingRouteId);
      const route:DriveRoute={id:old?.id||crypto.randomUUID(),name:old?.name||nextRouteName(this.hooks.routes(),e.id,`${e.name} → ${target?.name||this.say('Park','Parking')}`),vehicleId:e.id,points:this.points.map(p=>[...p]),...settings,...(this.draftReference?{reference:this.draftReference}:{}),startHeading:this.draftHeading};
      this.hooks.saveRoute(route);this.routeId=route.id;this.drawing=false;m.mode='manual';m.path=[];m.route=undefined;this.remember();
      const pose=routeStart(route.points,this.draftHeading,route.reference==='front-axle'?m.frontAxleOffset:0);this.start={position:[pose.x,e.position[1],pose.z],heading:pose.heading*180/Math.PI,trailerAngle:this.draftTrailerAngle};
      this.showRoute();this.render();this.hooks.notify(this.say('Güzergâh hazır. Kalıcı tutmak için Kaydet’e basın.','Route ready. Press Save to keep it.'));return;
    }
    if(action==='play'){
      if(this.drawing){this.hooks.notify(this.say('Önce çizimi bitirin.','Finish editing first.'));return;}
      if(!this.hooks.running(e.id))throw new Error(this.say('Önce aracı çalıştırın.','Start the engine first.'));
      if(this.hooks.blocked(e.id))throw new Error(this.say('Platform, korkuluk ve kapı kapalı olmalı.','Platform, railing and gate must be closed.'));
      const r=this.route();if(!r)throw new Error(this.say('Önce güzergâh çizin.','Draw a route first.'));
      const updated={...r,...this.readSettings()};m.wheelbase=this.hooks.wheelbase(e.id);
      const analysis=analyzeRoute(r.points,this.routeHeading(r),{...this.hooks.articulation(e.id),trailerAngle:m.trailerAngle},r.reference);
      if(analysis.issues.length){this.editRoute(r);this.selectedPoint=analysis.nodes[0]??1;this.previewDraft();return;}
      m.startRoute(updated);this.start={position:[...e.position],heading:e.heading,trailerAngle:m.trailerAngle};this.hooks.saveRoute(updated);this.remember();this.hooks.path({points:pathPoints(m.path)});this.begin();
    }
    if(action==='resume'&&m.mode==='paused'&&m.path.length){
      if(!this.hooks.running(e.id))throw new Error(this.say('Önce aracı çalıştırın.','Start the engine first.'));
      if(this.hooks.blocked(e.id))throw new Error(this.say('Platform, korkuluk ve kapı kapalı olmalı.','Platform, railing and gate must be closed.'));
      m.mode='route';this.begin();
    }
    if(action==='reset'&&this.start){this.pause();this.begin();m.pose={x:this.start.position[0],z:this.start.position[2],heading:this.start.heading*Math.PI/180};m.trailerAngle=this.start.trailerAngle;m.articulationBlocked=false;m.distance=0;m.mode='manual';m.progress=0;m.path=[];m.route=undefined;this.remember();this.hooks.move(e.id,m,this.follow);this.hooks.changed();this.checkpointed=false;}
    this.updateStatus();
  }
  private updateStatus(){
    if(!this.active||!this.status||!this.motion)return;const m=this.motion;
    const state=this.waitingGate?this.say('Kapı açılması bekleniyor','Waiting for gate'):this.drawing?this.say(`Çizim · ${this.points.length} nokta`,`Drawing · ${this.points.length} points`):m.mode==='complete'?this.say('Park edildi','Parked'):m.mode==='paused'?this.say(`Duraklatıldı · ${m.remaining.toFixed(1)} m`,`Paused · ${m.remaining.toFixed(1)} m`):m.mode==='route'?this.say(`Güzergâh · ${m.remaining.toFixed(1)} m`,`Route · ${m.remaining.toFixed(1)} m`):this.say('Elle sürüş','Manual driving');
    const gear=this.hooks.audio?.tone.gear;
    const assist=m.articulationBlocked?this.say(' · İleri giderek tankı düzeltin',' · Pull forward to straighten'):m.steeringAssisted?this.say(' · Dönüş desteği',' · Turn assist'):'';
    const text=`${this.testRate>1?`${this.testRate}× · `:''}${Math.abs(m.speed*3.6).toFixed(1)} ${this.say('km/sa','km/h')} · ${m.speed<-.01?'R':gear?`D${gear}`:'D'} · ${state}${assist}`;if(this.status.textContent!==text)this.status.textContent=text;
    this.element.querySelectorAll<HTMLButtonElement>('[data-signal]').forEach(b=>b.classList.toggle('active',b.dataset.signal===m.signal));
    const resume=this.element.querySelector<HTMLButtonElement>('[data-drive="resume"]');if(resume)resume.disabled=this.drawing||m.mode!=='paused'||!m.path.length;
    for(const action of ['play','reset']){const b=this.element.querySelector<HTMLButtonElement>(`[data-drive="${action}"]`);if(b)b.disabled=this.drawing;}
    const sound=this.element.querySelector<HTMLButtonElement>('[data-drive="sound"]'),audio=this.hooks.audio;if(sound&&audio){sound.textContent=audio.supported?(!audio.enabled?this.say('Ses kapalı','Sound off'):audio.failed?this.say('Sesi yeniden yükle','Retry audio'):audio.loading?this.say('Ses yükleniyor…','Loading audio…'):this.say('Ses açık','Sound on')):this.say('Ses desteklenmiyor','Audio unavailable');sound.disabled=!audio.supported;sound.setAttribute('aria-pressed',String(audio.enabled));}
    const view=this.element.querySelector<HTMLButtonElement>('[data-drive="cabin"]');if(view){view.textContent=this.cabin?this.say('Dış görünüm · C','Exterior view · C'):this.say('Kabine gir · C','Enter cab · C');view.disabled=this.drawing;view.setAttribute('aria-pressed',String(this.cabin));}
    const controls=this.element.querySelector<HTMLButtonElement>('[data-drive="cab-controls"]');if(controls){controls.hidden=!this.cabin;controls.textContent=this.cabCompact?this.say('Kontroller','Controls'):this.say('Küçült','Collapse');controls.setAttribute('aria-expanded',String(!this.cabCompact));}
    const engine=this.element.querySelector('[data-drive="engine"]')!;engine.textContent=this.hooks.running(this.vehicleId!)?this.say('Motoru durdur','Stop engine'):this.say('Aracı çalıştır','Start engine');this.element.querySelector('[data-drive="follow"]')?.classList.toggle('active',this.follow);
  }
}
