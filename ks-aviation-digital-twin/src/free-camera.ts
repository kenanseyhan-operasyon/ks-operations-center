import * as THREE from 'three';
import { GROUND_BOUNDS } from './static-ground';
export class FreeCamera{
  enabled=false;paused=false;private yaw=0;private pitch=0;private keys=new Set<string>();private pointers=new Map<number,[number,number]>();private drag=false;
  constructor(private camera:THREE.PerspectiveCamera,private canvas:HTMLElement,private onMove:()=>void){
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{if(!this.enabled||this.paused)return;this.sync();this.pointers.set(e.pointerId,[e.clientX,e.clientY]);this.drag=true;canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!this.enabled||this.paused||!this.drag)return;const p=this.pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];this.pointers.set(e.pointerId,[e.clientX,e.clientY]);if(this.pointers.size>1){this.move(-dx*.06,0,dy*.06);}else{this.yaw-=dx*.004;this.pitch=Math.max(-Math.PI/2+.02,Math.min(Math.PI/2-.02,this.pitch-dy*.004));this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch,this.yaw,0,'YXZ'));}this.onMove();});
    const stop=(e:PointerEvent)=>{this.pointers.delete(e.pointerId);if(!this.pointers.size)this.drag=false;};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
    canvas.addEventListener('wheel',e=>{if(!this.enabled||this.paused)return;e.preventDefault();this.move(0,Math.sign(e.deltaY)*this.speed()*.12,0);this.onMove();},{passive:false});
    window.addEventListener('blur',()=>this.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
  }
  sync(){const e=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');this.pitch=e.x;this.yaw=e.y;}
  clear(){this.keys.clear();this.pointers.clear();this.drag=false;}
  key(key:string,down:boolean){down?this.keys.add(key):this.keys.delete(key);}
  speed(){return Math.max(3,Math.min(200,this.camera.position.y*.6));}
  move(right:number,forward:number,up:number){const angle=this.yaw;this.camera.position.x+=Math.cos(angle)*right+Math.sin(angle)*forward;this.camera.position.z+=-Math.sin(angle)*right+Math.cos(angle)*forward;this.camera.position.y+=up;this.constrain();}
  constrain(){const p=this.camera.position;p.x=THREE.MathUtils.clamp(p.x,GROUND_BOUNDS.minX-2500,GROUND_BOUNDS.maxX+2500);p.z=THREE.MathUtils.clamp(p.z,GROUND_BOUNDS.minZ-2500,GROUND_BOUNDS.maxZ+2500);p.y=THREE.MathUtils.clamp(p.y,.25,8500);}
  update(dt:number){if(!this.enabled||this.paused)return;const k=this.keys,s=this.speed()*dt*(k.has('shift')?3:1),x=Number(k.has('d'))-Number(k.has('a')),z=Number(k.has('s'))-Number(k.has('w')),y=Number(k.has('e'))-Number(k.has('q'));if(x||y||z){this.move(x*s,z*s,y*s);this.onMove();}}
}
