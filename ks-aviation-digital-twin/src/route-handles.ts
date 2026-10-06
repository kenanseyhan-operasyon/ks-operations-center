import type {Point} from './vehicle-motion';
import type {RouteDisplay} from './route-planning';
import {portraitInput} from './portrait-lock';
type Hooks={world:(x:number,y:number)=>Point|undefined;project:(p:Point)=>Point|undefined;begin:(index:number)=>boolean;move:(index:number,x:number,z:number)=>void;end:(cancel:boolean)=>void;lock:(on:boolean)=>void};
/** Native, numbered touch targets stay the same size in 2D, 3D and portrait lock. */
export class RouteHandles{
  readonly layer=document.createElement('div');private display:RouteDisplay={points:[]};private buttons:HTMLButtonElement[]=[];
  private gesture?:{pointer:number;index:number};get dragging(){return !!this.gesture;}
  constructor(host:HTMLElement,private hooks:Hooks){
    this.layer.className='route-handles';host.append(this.layer);const input=portraitInput(this.layer);
    input.addEventListener('pointerdown',e=>{
      const index=Number((e.target as HTMLElement).closest<HTMLElement>('[data-route-node]')?.dataset.routeNode);
      if(e.button!==0||!Number.isInteger(index)||this.gesture)return;
      if(!this.hooks.begin(index))return;e.preventDefault();e.stopPropagation();this.gesture={pointer:e.pointerId,index};this.layer.setPointerCapture(e.pointerId);this.hooks.lock(true);
    });
    input.addEventListener('pointermove',e=>{const g=this.gesture;if(!g||g.pointer!==e.pointerId)return;e.preventDefault();e.stopPropagation();const p=this.hooks.world(e.clientX,e.clientY);if(p)this.hooks.move(g.index,p[0],p[1]);});
    const stop=(e:PointerEvent)=>{if(this.gesture?.pointer!==e.pointerId)return;e.preventDefault();e.stopPropagation();this.finish(e.type==='pointercancel');};
    input.addEventListener('pointerup',stop);input.addEventListener('pointercancel',stop);
    input.addEventListener('lostpointercapture',()=>{if(this.gesture)this.finish(true);});
    host.addEventListener('pointerdown',e=>{if(this.gesture&&e.pointerId!==this.gesture.pointer)this.finish(true);},true);
    window.addEventListener('blur',()=>this.finish(true));
    this.layer.addEventListener('keydown',e=>{
      const index=Number((e.target as HTMLElement).dataset.routeNode),p=this.display.handles?.[index],step=e.shiftKey?2:.5;
      if(!p||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();
      if(this.hooks.begin(index)){this.hooks.move(index,p[0]+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),p[1]+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));this.hooks.end(false);}
    });
  }
  private finish(cancel:boolean){if(!this.gesture)return;const id=this.gesture.pointer;this.gesture=undefined;if(this.layer.hasPointerCapture(id))this.layer.releasePointerCapture(id);this.hooks.end(cancel);this.hooks.lock(false);}
  set(display:RouteDisplay){
    this.display=display;const handles=display.handles||[];this.layer.hidden=!handles.length;
    while(this.buttons.length>handles.length)this.buttons.pop()!.remove();
    while(this.buttons.length<handles.length){const b=document.createElement('button');b.type='button';b.dataset.routeNode=String(this.buttons.length);b.textContent=String(this.buttons.length+1);b.setAttribute('aria-label',`Güzergâh noktası / Route point ${this.buttons.length+1}`);this.layer.append(b);this.buttons.push(b);}
    for(const [i,b] of this.buttons.entries()){b.classList.toggle('invalid',!!display.nodes?.includes(i));b.classList.toggle('selected',display.selected===i);b.classList.toggle('locked',i===0);}
    this.update();
  }
  update(){for(const [i,b] of this.buttons.entries()){const p=this.hooks.project(this.display.handles![i]);b.hidden=!p;if(p){b.style.left=`${p[0]}px`;b.style.top=`${p[1]}px`;}}}
}
