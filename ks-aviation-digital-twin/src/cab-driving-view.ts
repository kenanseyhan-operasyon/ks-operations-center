import * as T from 'three';
import {VehicleCab,type CabInstruments} from './vehicle-cab';

type ViewState=CabInstruments&{signal:string;rate:number};
/** A vehicle-mounted view. Looking around never moves the vehicle or exits its seat. */
export class CabDrivingView{
  readonly hud:HTMLElement;private cab?:VehicleCab;private yaw=0;private pitch=-.045;private fov=66;
  private pointer?:{id:number;x:number;y:number};private touches=new Set<number>();private lastMirror=-Infinity;
  // Offscreen passes hold linear HDR; tone-map once when showing a mirror in the main view.
  private targets=[new T.WebGLRenderTarget(192,288,{type:T.HalfFloatType}),new T.WebGLRenderTarget(192,288,{type:T.HalfFloatType})];
  private rearCamera=new T.PerspectiveCamera(66,2/3,.04,12000);
  private overlay=new T.Scene();private overlayCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  private quad=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({depthTest:false,depthWrite:false,toneMapped:true}));
  private savedProjection?:{fov:number;near:number};private lang:'tr'|'en'='tr';
  get active(){return !!this.cab;}
  get vehicleCab(){return this.cab;}
  constructor(private camera:T.PerspectiveCamera,private canvas:HTMLElement,host:HTMLElement,private mobile:boolean,private hooks:{key:(key:string,down:boolean)=>void;exit:()=>void}){
    if(!mobile)this.targets.forEach(t=>t.setSize(256,384));this.quad.material.map=this.targets[0].texture;this.quad.position.z=-.5;this.overlay.add(this.quad);
    this.hud=document.createElement('div');this.hud.className='cab-hud';this.hud.hidden=true;host.append(this.hud);this.renderHud();
    const stop=(e:Event)=>{e.preventDefault();e.stopImmediatePropagation();};
    canvas.addEventListener('pointerdown',e=>{
      if(!this.active)return;stop(e);const p=e as PointerEvent;this.touches.add(p.pointerId);
      this.pointer=this.touches.size===1?{id:p.pointerId,x:p.clientX,y:p.clientY}:undefined;canvas.setPointerCapture?.(p.pointerId);
    },true);
    canvas.addEventListener('pointermove',e=>{
      if(!this.active)return;stop(e);const p=e as PointerEvent,start=this.pointer;if(!start||start.id!==p.pointerId)return;
      this.look(this.yaw-(p.clientX-start.x)*.004,this.pitch+(p.clientY-start.y)*.003);start.x=p.clientX;start.y=p.clientY;
    },true);
    const release=(e:Event)=>{if(!this.active)return;stop(e);const p=e as PointerEvent;this.touches.delete(p.pointerId);this.pointer=undefined;if(canvas.hasPointerCapture?.(p.pointerId))canvas.releasePointerCapture(p.pointerId);};
    canvas.addEventListener('pointerup',release,true);canvas.addEventListener('pointercancel',release,true);canvas.addEventListener('lostpointercapture',()=>{this.pointer=undefined;});
    canvas.addEventListener('wheel',e=>{if(!this.active)return;stop(e);this.zoom((e as WheelEvent).deltaY);},{capture:true,passive:false});
    canvas.addEventListener('dblclick',e=>{if(this.active){stop(e);this.look(0,-.045);}},true);
    window.addEventListener('blur',()=>this.clearInput());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clearInput();});
  }
  setLanguage(lang:'tr'|'en'){this.clearInput();this.lang=lang;this.renderHud();}
  private say(tr:string,en:string){return this.lang==='tr'?tr:en;}
  private renderHud(){
    this.hud.innerHTML=`<div class="cab-mirror cab-mirror-left" data-mirror="left"><span>${this.say('SOL AYNA','LEFT MIRROR')}</span></div><div class="cab-mirror cab-mirror-right" data-mirror="right"><span>${this.say('SAĞ AYNA','RIGHT MIRROR')}</span></div><div class="cab-instruments"><span class="cab-signal" data-left>◀</span><div><b data-speed>0</b><small>${this.say('km/sa','km/h')}</small></div><strong data-gear>N</strong><div><b data-rpm>0</b><small>rpm</small></div><span class="cab-signal" data-right>▶</span><small data-state></small></div><div class="cab-look"><button data-look="left" aria-label="${this.say('Sola bak','Look left')}">◀</button><button data-look="centre">${this.say('Öne bak','Look ahead')}</button><button data-look="right" aria-label="${this.say('Sağa bak','Look right')}">▶</button><button data-cab-exit>${this.say('Dış görünüm','Exterior view')}</button></div><small class="cab-hint">${this.say('Sürükle: etrafa bak · C: iç/dış · I: motor · B: korna','Drag: look around · C: inside/outside · I: engine · B: horn')}</small><div class="cab-touch cab-steer"><button data-cab-key="a" aria-label="${this.say('Sola direksiyon','Steer left')}">◀</button><button data-cab-key="d" aria-label="${this.say('Sağa direksiyon','Steer right')}">▶</button></div><div class="cab-touch cab-pedals"><button data-cab-key="w">${this.say('GAZ','GO')}</button><button data-cab-key=" " class="cab-brake">${this.say('FREN','BRAKE')}</button><button data-cab-key="s">R</button><button data-cab-key="b" aria-label="${this.say('Korna','Horn')}">♪</button></div>`;
    this.hud.querySelectorAll<HTMLButtonElement>('[data-look]').forEach(b=>b.onclick=()=>this.look(b.dataset.look==='left'?-Math.PI*.42:b.dataset.look==='right'?Math.PI*.42:0,-.045));
    this.hud.querySelector<HTMLButtonElement>('[data-cab-exit]')!.onclick=()=>this.hooks.exit();
    this.hud.querySelectorAll<HTMLButtonElement>('[data-cab-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.hooks.key(b.dataset.cabKey!,true);});const release=()=>this.hooks.key(b.dataset.cabKey!,false);b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);});
  }
  clearInput(){this.pointer=undefined;this.touches.clear();for(const key of ['w','a','s','d',' ','b'])this.hooks.key(key,false);}
  enter(cab:VehicleCab){
    if(this.cab===cab)return;this.exit();this.savedProjection={fov:this.camera.fov,near:this.camera.near};this.cab=cab;cab.setInside(true);this.hud.hidden=false;this.fov=66;this.look(0,-.045);this.lastMirror=-Infinity;
    cab.mirrors.forEach((m,i)=>{const mat=m.surface.material as T.MeshBasicMaterial;mat.map=this.targets[i].texture;mat.color.set('#ffffff');mat.toneMapped=true;mat.needsUpdate=true;});
  }
  exit(){
    if(!this.cab)return;this.clearInput();this.cab.setInside(false);this.cab.mirrors.forEach(m=>{const mat=m.surface.material as T.MeshBasicMaterial;mat.map=null;mat.color.set('#68818c');mat.needsUpdate=true;});this.cab=undefined;this.hud.hidden=true;
    if(this.savedProjection){this.camera.fov=this.savedProjection.fov;this.camera.near=this.savedProjection.near;this.camera.updateProjectionMatrix();this.savedProjection=undefined;}
  }
  look(yaw:number,pitch:number){this.yaw=T.MathUtils.clamp(yaw,-Math.PI*.56,Math.PI*.56);this.pitch=T.MathUtils.clamp(pitch,-.40,.26);}
  zoom(delta:number){if(Number.isFinite(delta))this.fov=T.MathUtils.clamp(this.fov+delta*.025,48,82);}
  update(state:ViewState,now:number){
    const cab=this.cab;if(!cab)return;cab.update(state);cab.model.updateWorldMatrix(true,true);
    cab.eye.getWorldPosition(this.camera.position);
    const direction=new T.Vector3(-Math.cos(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.sin(this.yaw)*Math.cos(this.pitch));
    direction.transformDirection(cab.model.matrixWorld);this.camera.up.set(0,1,0);this.camera.lookAt(this.camera.position.clone().add(direction));
    const fov=this.camera.aspect<1?Math.min(90,this.fov+14):this.fov;
    if(this.camera.fov!==fov||this.camera.near!==.018){this.camera.fov=fov;this.camera.near=.018;this.camera.updateProjectionMatrix();}this.camera.updateMatrixWorld(true);
    const set=(selector:string,value:string)=>{const el=this.hud.querySelector(selector)!;if(el.textContent!==value)el.textContent=value;};
    set('[data-speed]',Math.abs(state.speed*3.6).toFixed(1));set('[data-rpm]',String(Math.round(state.rpm/10)*10));set('[data-gear]',state.gear<0?'R':state.gear>0?`D${state.gear}`:'N');
    set('[data-state]',`${state.rate>1?`${state.rate}× · `:''}${state.running?this.say('MOTOR AÇIK','ENGINE ON'):this.say('I / MOTORU ÇALIŞTIR','I / START ENGINE')}`);
    const blink=Math.floor(now/450)%2===0;this.hud.querySelector('[data-left]')!.classList.toggle('lit',blink&&['left','hazard'].includes(state.signal));this.hud.querySelector('[data-right]')!.classList.toggle('lit',blink&&['right','hazard'].includes(state.signal));
  }
  renderMirrors(renderer:T.WebGLRenderer,ground:T.Scene,scene:T.Scene,now:number){
    const cab=this.cab;if(!cab||now-this.lastMirror<(this.mobile?100:50))return;this.lastMirror=now;
    if(this.targets[0].texture.type===T.HalfFloatType&&!renderer.extensions.has('EXT_color_buffer_float')&&!renderer.extensions.has('EXT_color_buffer_half_float')){
      for(const target of this.targets){target.dispose();target.texture.type=T.UnsignedByteType;}
    }
    const target=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest();
    const visible=cab.mirrors.map(m=>m.surface.visible);cab.mirrors.forEach(m=>m.surface.visible=false);
    try{renderer.setScissorTest(false);cab.mirrors.forEach((mirror,i)=>{
      mirror.eye.getWorldPosition(this.rearCamera.position);this.rearCamera.lookAt(mirror.target.getWorldPosition(new T.Vector3()));this.rearCamera.updateMatrixWorld(true);
      renderer.setRenderTarget(this.targets[i]);renderer.clear();renderer.render(ground,this.rearCamera);renderer.clearDepth();renderer.render(scene,this.rearCamera);
    });}finally{cab.mirrors.forEach((m,i)=>m.surface.visible=visible[i]);renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);}
  }
  renderOverlay(renderer:T.WebGLRenderer){
    if(!this.cab)return;const viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest();
    const height=this.hud.clientHeight;
    try{renderer.setScissorTest(true);this.cab.mirrors.forEach((mirror,i)=>{
      const frame=this.hud.querySelector<HTMLElement>(`[data-mirror="${mirror.side>0?'left':'right'}"]`)!;
      // Layout coordinates also work when the airport UI is CSS-rotated on a phone.
      const x=frame.offsetLeft+5,y=height-frame.offsetTop-frame.offsetHeight+5,w=frame.offsetWidth-10,h=frame.offsetHeight-10;if(w<1||h<1)return;
      renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.clearDepth();this.quad.material.map=this.targets[i].texture;
      // A mirror reverses the horizontal view, unlike a rear-facing video camera.
      this.quad.scale.x=-1;this.quad.material.side=T.DoubleSide;renderer.render(this.overlay,this.overlayCamera);
    });}finally{renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);}
  }
  dispose(){this.exit();this.hud.remove();this.targets.forEach(t=>t.dispose());this.quad.geometry.dispose();this.quad.material.dispose();}
}
