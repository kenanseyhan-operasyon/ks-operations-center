import type {DeadmanSession} from './deadman-session';

/** A normally-open input: releasing, losing capture/focus or hiding always removes permission. */
export function bindDeadmanHold(button:HTMLButtonElement,press:(on:boolean)=>void){
  let pointer:number|undefined,key:string|undefined;
  const release=()=>{pointer=undefined;key=undefined;press(false);};
  button.addEventListener('pointerdown',e=>{if(e.button!==0||button.disabled)return;e.preventDefault();pointer=e.pointerId;button.setPointerCapture?.(e.pointerId);press(true);});
  window.addEventListener('pointerup',e=>{if(e.pointerId===pointer)release();});
  button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  button.addEventListener('keydown',e=>{if(![' ','Enter'].includes(e.key)||e.repeat||button.disabled)return;e.preventDefault();key=e.key;press(true);});
  window.addEventListener('keyup',e=>{if(e.key===key){e.preventDefault();release();}});
  button.addEventListener('blur',release);window.addEventListener('blur',release);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  window.addEventListener('pagehide',release);return release;
}
export class DeadmanPanel {
  readonly element=document.createElement('section');private hold:HTMLButtonElement;private release:()=>void;
  constructor(parent:HTMLElement,private session:DeadmanSession,private visibility?:(open:boolean)=>void){
    this.element.className='deadman-panel';this.element.hidden=true;this.element.setAttribute('aria-label','Deadman kontrolü');
    this.element.innerHTML='<header><strong>DEADMAN <small>40 m</small></strong><button data-dm="close" aria-label="Deadman panelini kapat">×</button></header><p data-dm="status" role="status"></p><div><button data-dm="door">Kapağı aç</button><button data-dm="take">Nathan alsın</button><button data-dm="return">Kutusuna bırak</button></div><button class="deadman-hold" data-dm="hold" aria-pressed="false">İkmal izni için basılı tut</button><small data-dm="length"></small>';
    const get=(key:string)=>this.element.querySelector<HTMLButtonElement>(`[data-dm="${key}"]`)!;
    this.hold=get('hold');this.release=bindDeadmanHold(this.hold,on=>{session.press(on);this.sync();});
    get('close').onclick=()=>{this.release();this.element.hidden=true;this.visibility?.(false);};get('door').onclick=()=>{session.toggle();this.sync();};
    get('take').onclick=()=>{session.take();this.sync();};get('return').onclick=()=>{session.returnToBox();this.sync();};parent.append(this.element);
  }
  open(id:string){if(!this.session.select(id))return;this.element.hidden=false;this.visibility?.(true);this.sync();}
  sync(){
    const d=this.session.device;if(!d){this.element.hidden=true;this.visibility?.(false);return;}
    const get=(key:string)=>this.element.querySelector<HTMLButtonElement>(`[data-dm="${key}"]`)!;
    get('door').textContent=d.open?'Kapağı kapat':'Kapağı aç';get('door').disabled=d.deployed;
    get('take').disabled=this.session.occupied;get('return').disabled=!this.session.occupied;
    this.hold.disabled=!this.session.canPress;this.hold.setAttribute('aria-pressed',String(d.pressed));
    this.hold.textContent=d.pressed?'Basılı · ikmal izni açık':'İkmal izni için basılı tut';
    const messages={stowed:'Tutamak kutusunda.',approaching:'Nathan kutuya yaklaşıyor…',reaching:'Tutamağı kavrıyor…',lifting:'Tutamağı alıyor…',held:'Tutamak elde. Zemini seçerek yürüyebilirsiniz.',returning:'Nathan kutuya dönüyor…',lowering:'Tutamağı yuvasına yerleştiriyor…',releasing:'Elini bırakıyor…'};
    get('status').textContent=messages[this.session.phase];get('length').textContent=`Kablo: ${d.cableLength.toFixed(1)} / 40 m · Bırakınca ikmal izni kapanır.`;
  }
}
