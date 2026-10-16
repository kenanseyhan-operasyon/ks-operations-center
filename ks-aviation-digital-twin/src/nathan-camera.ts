import * as T from 'three';
import type {Entity} from './scene-data';
import type {NathanActor} from './nathan-model';
export type NathanView='free'|'eyes'|'rear'|'front'|'top';
/** V owns the operator view. C remains owned by the existing vehicle cabin. */
export class NathanCamera{
  mode:NathanView='free';private pointers=new Set<number>();private yaw=0;private pitch=-.04;private pointer?:{id:number;x:number;y:number;travel:number;target:boolean};
  private saved?:{near:number;fov:number;up:T.Vector3};private actor?:NathanActor;
  constructor(private camera:T.PerspectiveCamera,canvas:HTMLElement,private read:()=>{entity?:Entity;actor?:NathanActor},private lock:(on:boolean)=>void,private tap?:(event:PointerEvent)=>void){
    const stop=(e:Event)=>{e.preventDefault();e.stopImmediatePropagation();};
    canvas.addEventListener('pointerdown',e=>{if(this.mode!=='eyes')return;stop(e);this.pointers.add(e.pointerId);if(this.pointers.size>1){this.pointer=undefined;return;}this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY,travel:0,target:(e.pointerType==='touch'||e.button===0)&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey};canvas.setPointerCapture?.(e.pointerId);},true);
    canvas.addEventListener('pointermove',e=>{if(this.mode!=='eyes')return;stop(e);const p=this.pointer;if(!p||p.id!==e.pointerId)return;p.travel+=Math.hypot(e.clientX-p.x,e.clientY-p.y);this.yaw-=(e.clientX-p.x)*.004;this.pitch=T.MathUtils.clamp(this.pitch-(e.clientY-p.y)*.003,-1.25,1.25);p.x=e.clientX;p.y=e.clientY;},true);
    const release=(e:PointerEvent)=>{if(this.mode!=='eyes')return;stop(e);const tap=e.type==='pointerup'&&this.pointer?.id===e.pointerId&&this.pointer.target&&this.pointer.travel+Math.hypot(e.clientX-this.pointer.x,e.clientY-this.pointer.y)<6&&this.pointers.size===1;this.pointers.delete(e.pointerId);this.pointer=undefined;if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(tap)this.tap?.(e);};
    canvas.addEventListener('pointerup',release,true);canvas.addEventListener('pointercancel',release,true);canvas.addEventListener('lostpointercapture',()=>{this.pointer=undefined;});
    window.addEventListener('blur',()=>{this.pointer=undefined;this.pointers.clear();});
    canvas.addEventListener('wheel',e=>{if(this.mode!=='eyes')return;stop(e);this.camera.fov=T.MathUtils.clamp(this.camera.fov+e.deltaY*.025,38,85);this.camera.updateProjectionMatrix();},{capture:true,passive:false});
  }
  set(mode:NathanView){
    this.actor?.firstPerson(false);this.actor=undefined;this.pointer=undefined;this.pointers.clear();
    if(mode!=='free'&&!this.saved){this.saved={near:this.camera.near,fov:this.camera.fov,up:this.camera.up.clone()};this.lock(true);}
    if(mode==='free'&&this.saved){this.camera.near=this.saved.near;this.camera.fov=this.saved.fov;this.camera.up.copy(this.saved.up);this.saved=undefined;this.lock(false);}
    this.mode=mode;this.yaw=0;this.pitch=-.04;
    if(mode==='eyes'){this.camera.near=.025;this.camera.fov=70;}this.camera.updateProjectionMatrix();this.update();
  }
  update(){
    if(this.mode==='free')return false;const {entity:e,actor}=this.read();if(!e||!actor){this.set('free');return false;}
    if(this.actor!==actor){this.actor?.firstPerson(false);this.actor=actor;}
    actor.firstPerson(this.mode==='eyes');
    const eye=actor.eyePoint(),yaw=e.heading*Math.PI/180,forward=new T.Vector3(Math.sin(yaw),0,-Math.cos(yaw));
    if(this.mode==='eyes'){
      const h=yaw+this.yaw,dir=new T.Vector3(Math.sin(h)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(h)*Math.cos(this.pitch));
      this.camera.up.set(0,1,0);this.camera.position.copy(eye);this.camera.lookAt(eye.clone().add(dir));
    }else{
      const target=new T.Vector3(...e.position).add(new T.Vector3(0,.9*e.scale,0));
      this.camera.up.copy(this.mode==='top'?forward:new T.Vector3(0,1,0));
      this.camera.position.copy(this.mode==='top'?target.clone().add(new T.Vector3(0,7*e.scale,0)):target.clone().addScaledVector(forward,(this.mode==='rear'?-1:1)*4*e.scale).add(new T.Vector3(0,1.3*e.scale,0)));this.camera.lookAt(target);
    }
    this.camera.updateMatrixWorld(true);return true;
  }
}
