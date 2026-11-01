import {behindMonitor,canGripMonitor,aimMonitorByDrag,adjustMonitorOpening,monitorTrajectory} from './monitor-training';
import type {Entity} from './scene-data';
import type {FacilityNetwork} from './facility-network';
export class MonitorPanel{
 readonly element=document.createElement('section');private id='';private last=0;
 private aimMode=false;private stage?:HTMLElement;private lastCursor='';private pointer?:{id:number;x:number;y:number};
 private readonly aimHud=document.createElement('aside');
 get aimingMonitorId(){return this.aimMode&&!this.element.hidden&&this.valid()?this.id:undefined;}
 constructor(host:HTMLElement,private network:FacilityNetwork,private entities:()=>Entity[],private operator:()=>Entity|undefined){
  this.element.hidden=true;this.element.style.cssText='position:absolute;right:16px;bottom:20px;z-index:35;width:290px;max-height:70vh;overflow:auto;background:#102a32;color:white;padding:16px;border:1px solid #64828a;border-radius:10px;box-shadow:0 6px 20px #0008';host.append(this.element);
  this.element.addEventListener('pointerdown',e=>e.stopPropagation());this.element.addEventListener('keydown',e=>e.stopPropagation());this.wireDirectAim(host);
 }
 open(o:Entity){this.setAim(false);const person=this.operator();if(!person||!behindMonitor(o,person.position))return false;this.id=o.id;this.element.hidden=false;
 const s=this.network.monitor(o.id);this.element.innerHTML=`<strong>Monitör kumandası</strong><button type="button" data-close style="float:right" aria-label="Kumandadan ayrıl">×</button><p>Besleme: 10 bar · Eğitim modeli</p>${[['yaw','Sağ / sol (°)',-150,150,1],['elevation','Yukarı / aşağı (°)',0,75,1],['opening','Debi kumandası',0,1,.05],['lossBar','Varsayılan hat kaybı (bar)',0,10,.5]].map(([key,label,min,max,step])=>`<label style="display:block;margin:12px 0">${label} <output data-value="${key}">${s[key as keyof typeof s]}</output><input aria-label="${label}" data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${s[key as keyof typeof s]}" style="width:100%"></label>`).join('')}<button type="button" data-aim aria-pressed="false">🎯 Fareyle hedefle</button><p data-aim-help>Elle yönlendirme: Nathan tutamağı kavrar, 3D sahnede sürükleyerek hedeflersiniz.</p><button type="button" data-water>Monitör çıkışını aç / kapat</button><p data-status aria-live="polite"></p><small>Menzil yaklaşık balistik modeldir. Kayıp değeri saha ölçümü değildir; gerçek nozul eğrisiyle kalibre edilmemiştir. Debi kumandası yüzde açıklıktır, L/dk ölçümü değildir.</small>`;
 this.element.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>this.close();
 this.element.querySelector<HTMLButtonElement>('[data-aim]')!.onclick=()=>this.setAim(!this.aimMode);
 this.element.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input=>input.oninput=()=>{if(!this.valid()){this.close();return;}s[input.dataset.setting as keyof typeof s]=Number(input.value);this.element.querySelector(`[data-value="${input.dataset.setting}"]`)!.textContent=input.value;this.network.evaluate(this.entities());this.last=0;});
 this.element.querySelector<HTMLButtonElement>('[data-water]')!.onclick=()=>{if(this.valid())this.network.operate(o,this.entities());else this.close();};this.setAim(true);return true;
 }
 close(){this.setAim(false);this.element.hidden=true;this.id='';}
 private wireDirectAim(host:HTMLElement){
  this.stage=host.querySelector<HTMLElement>('#wsStage')||undefined;
  this.aimHud.setAttribute('aria-live','polite');
  this.aimHud.style.cssText='position:absolute;top:74px;left:50%;transform:translateX(-50%);z-index:34;pointer-events:none;background:#102a32ee;color:white;border:1px solid #7aa3ad;border-radius:9px;padding:10px 15px;font:600 13px system-ui,sans-serif;text-align:center;white-space:nowrap;display:none;box-shadow:0 4px 14px #0008';
  host.append(this.aimHud);
  const stage=this.stage;
  if(!stage)return;
  stage.addEventListener('pointerdown',event=>{
   if(!this.aimMode||event.button!==0)return;
   if(!this.valid()){this.close();return;}
   event.preventDefault();event.stopImmediatePropagation();
   this.pointer={id:event.pointerId,x:event.clientX,y:event.clientY};
   stage.setPointerCapture?.(event.pointerId);
  },true);
  stage.addEventListener('pointermove',event=>{
   if(!this.aimMode||!this.pointer||this.pointer.id!==event.pointerId)return;
   event.preventDefault();event.stopImmediatePropagation();
   const dx=event.clientX-this.pointer.x,dy=event.clientY-this.pointer.y;
   this.pointer.x=event.clientX;this.pointer.y=event.clientY;
   if(!this.valid()){this.close();return;}
   const setting=this.network.monitor(this.id);
   aimMonitorByDrag(setting,dx,dy);
   this.network.evaluate(this.entities());
   this.syncAimControls();this.last=0;
  },true);
  const release=(event:PointerEvent)=>{
   if(!this.aimMode||!this.pointer||this.pointer.id!==event.pointerId)return;
   event.preventDefault();event.stopImmediatePropagation();
   this.pointer=undefined;
   if(stage.hasPointerCapture?.(event.pointerId))stage.releasePointerCapture(event.pointerId);
  };
  stage.addEventListener('pointerup',release,true);
  stage.addEventListener('pointercancel',release,true);
  stage.addEventListener('lostpointercapture',()=>{this.pointer=undefined;});
  stage.addEventListener('wheel',event=>{
   if(!this.aimMode)return;
   event.preventDefault();event.stopImmediatePropagation();
   if(!this.valid()){this.close();return;}
   const setting=this.network.monitor(this.id);
   adjustMonitorOpening(setting,event.deltaY);
   this.network.evaluate(this.entities());
   this.syncAimControls();this.last=0;
  },{capture:true,passive:false});
  window.addEventListener('keydown',event=>{
   if(!this.aimMode||this.element.hidden)return;
   if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.setAim(false);}
   if(event.code==='Space'){
    event.preventDefault();event.stopImmediatePropagation();
    const monitor=this.entities().find(o=>o.id===this.id);
    if(monitor&&this.valid())this.network.operate(monitor,this.entities());else this.close();
    this.last=0;
   }
  },true);
  window.addEventListener('blur',()=>this.setAim(false));
 }
 private setAim(on:boolean){
  if(on&&!this.valid())return;
  if(on){
   const monitor=this.entities().find(o=>o.id===this.id),person=this.operator();
   if(!monitor||!person||!canGripMonitor(monitor,person.position)){
    const status=this.element.querySelector<HTMLElement>('[data-status]');
    if(status)status.textContent='Nathan monitöre arkadan yaklaşık 0,4–1,3 m mesafeye yaklaşmalı.';
    return;
   }
  }
  if(this.aimMode===on)return;
  this.aimMode=on;
  if(!on&&this.pointer&&this.stage?.hasPointerCapture?.(this.pointer.id)){
   const id=this.pointer.id;this.pointer=undefined;this.stage.releasePointerCapture(id);
  }
  this.pointer=undefined;
  if(this.stage){
   if(on)this.lastCursor=this.stage.style.cursor;
   this.stage.style.cursor=on?'crosshair':this.lastCursor;
   if(on)this.stage.focus({preventScroll:true});
  }
  this.aimHud.style.display=on?'block':'none';
  this.syncAimControls();
 }
 private syncAimControls(){
  if(!this.id||this.element.hidden)return;
  const setting=this.network.monitor(this.id);
  this.element.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input=>{
   const key=input.dataset.setting as keyof typeof setting;
   input.value=String(setting[key]);
   const output=this.element.querySelector<HTMLOutputElement>('[data-value="'+key+'"]');
   if(output)output.textContent=String(setting[key]);
  });
  const button=this.element.querySelector<HTMLButtonElement>('[data-aim]');
  if(button){button.textContent=this.aimMode?'✓ Hedefleme aktif · ESC: çık':'🎯 Fareyle hedefle';button.setAttribute('aria-pressed',String(this.aimMode));}
  const help=this.element.querySelector<HTMLElement>('[data-aim-help]');
  if(help)help.textContent=this.aimMode?'Sahnede sol fareyle sürükle: yön ve yükseliş · Fare tekerleği: açıklık · Boşluk: su aç/kapat · ESC: çık':'Nathan tutamağı kavrar; 3D sahnede fareyle monitörü yönlendirebilirsiniz. Kaydırma ayarları da kullanılabilir.';
 }
 private valid(){const o=this.entities().find(e=>e.id===this.id),p=this.operator();return !!o&&!!p&&this.network.active&&behindMonitor(o,p.position);}
 tick(now:number){if(this.element.hidden||now-this.last<200)return;this.last=now;if(!this.valid()){this.close();return;}const o=this.entities().find(e=>e.id===this.id)!,flow=this.network.states.get(o.id),r=monitorTrajectory(o,this.network.monitor(o.id),this.entities());if(this.aimMode){this.aimHud.textContent='🎯 MONİTÖR · '+(r.hit||'Hedef yok')+' · '+r.range.toFixed(1)+' m · '+Math.round(this.network.monitor(o.id).opening*100)+'% açıklık';}this.element.querySelector('[data-status]')!.textContent=flow?.flowing?`${flow.fluid==='solution'?'Köpüklü su':'Su'} · Tahmini uç basıncı ${r.pressure.toFixed(1)} bar · ${r.range.toFixed(1)} m · ${r.hit||'Menzil sınırı'}`:'Akış yok: çıkış ve besleme vanalarını kontrol edin.';}
}
