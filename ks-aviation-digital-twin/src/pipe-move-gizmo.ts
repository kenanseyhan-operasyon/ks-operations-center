import * as T from 'three';
import {TransformControls} from 'three/examples/jsm/controls/TransformControls.js';
import type {PipePiece,PipeRoute} from './pipe-editing';
import type {Point3} from './socar-fire-layout';
type Frame={world:(p:Point3)=>Point3;local:(p:Point3)=>Point3};
type Hooks={begin:()=>boolean;preview:(delta:Point3)=>boolean;commit:(delta:Point3)=>void;cancel:(discard?:boolean)=>void;lock:(on:boolean)=>void};
/** Dedicated translation control; preview never mutates the saved scene. */
export class PipeMoveGizmo{
 readonly control:TransformControls;readonly pivot=new T.Object3D();readonly indicator=document.createElement('div');
 private lines=new T.Group();private axes:Point3[]=[[1,0,0],[0,1,0],[0,0,1]];private frame?:Frame;private start?:Point3;private before?:Point3;private valid=true;private ended=0;private active=false;private signature='';private indicatorKey='';
 get dragging(){return !!this.start;}
 get consuming(){return this.dragging||performance.now()-this.ended<150;}
 constructor(private host:HTMLElement,private scene:T.Scene,private camera:T.Camera,input:HTMLElement,private hooks:Hooks){
  this.control=new TransformControls(camera,input);this.control.setMode('translate');this.control.setSpace('local');this.control.setTranslationSnap(.01);this.control.setSize(.85);this.control.enabled=false;
  scene.add(this.pivot,this.control.getHelper(),this.lines);this.indicator.className='pipe-axis-indicator';this.indicator.hidden=true;this.indicator.setAttribute('aria-label','Tesis eksenleri: X kırmızı, Y yükseklik yeşil, Z mavi');host.append(this.indicator);
  this.control.addEventListener('mouseDown',()=>{if(!this.hooks.begin()||!this.frame){this.control.dragging=false;return;}this.start=this.pivot.position.toArray() as Point3;this.before=this.frame.local(this.start);this.valid=true;this.hooks.lock(true);});
  this.control.addEventListener('objectChange',()=>{if(this.start){this.valid=this.hooks.preview(this.delta());this.update();}});
  this.control.addEventListener('mouseUp',()=>this.finish(false));
  input.addEventListener('pointercancel',()=>this.finish(true));
  window.addEventListener('blur',()=>this.finish(true));
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.dragging){e.preventDefault();e.stopImmediatePropagation();this.finish(true);}},true);
 }
 private delta():Point3{if(!this.frame||!this.before)return [0,0,0];return this.frame.local(this.pivot.position.toArray() as Point3).map((v,j)=>Math.round((v-this.before![j])*100)/100) as Point3;}
 private finish(cancel:boolean){if(!this.start)return;const delta=this.delta(),start=this.start;this.start=undefined;this.before=undefined;this.control.dragging=false;this.ended=performance.now();this.pivot.position.fromArray(start);this.hooks.cancel(cancel||!this.valid||!delta.some(v=>v!==0));this.hooks.lock(false);if(!cancel&&this.valid&&delta.some(v=>v!==0))this.hooks.commit(delta);this.update();}
 set(pieces:PipePiece[],routes:PipeRoute[],frame:Frame){
  if(this.dragging)return;this.frame=frame;const zero=frame.world([0,0,0]);this.axes=([0,1,2] as const).map(i=>{const p:Point3=[0,0,0];p[i]=1;return frame.world(p).map((v,j)=>v-zero[j]) as Point3;});
  const selected=pieces.flatMap(p=>{const r=routes.find(r=>r.id===p.routeId);return r?.points[p.index+1]?[{a:r.points[p.index],b:r.points[p.index+1]}]:[];});
  const signature=JSON.stringify(selected);if(signature===this.signature)return;this.signature=signature;
  for(const child of [...this.lines.children]){this.lines.remove(child);const line=child as T.Line;line.geometry.dispose();(line.material as T.Material).dispose();}
  this.active=selected.length>0;this.indicator.hidden=!this.active;
  if(!this.active){this.control.detach();this.control.enabled=false;return;}
  const center=new T.Vector3();for(const {a,b} of selected){center.add(new T.Vector3(...a)).add(new T.Vector3(...b));const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(...a),new T.Vector3(...b)]),new T.LineBasicMaterial({color:'#ff9c22',depthTest:false,transparent:true,opacity:.95}));line.renderOrder=99;this.lines.add(line);}center.divideScalar(selected.length*2);this.pivot.position.copy(center);
  const basis=new T.Matrix4().makeBasis(...this.axes.map(a=>new T.Vector3(...a)) as [T.Vector3,T.Vector3,T.Vector3]);this.pivot.quaternion.setFromRotationMatrix(basis);this.pivot.updateMatrixWorld(true);this.control.attach(this.pivot);this.control.enabled=true;this.update();
 }
 setVisible(visible:boolean){this.control.getHelper().visible=visible&&this.active;this.lines.visible=visible&&this.active;this.indicator.hidden=!visible||!this.active;this.control.enabled=visible&&this.active;}
 update(){if(!this.active)return;const key=JSON.stringify([this.camera.quaternion.toArray(),this.axes,this.dragging?this.delta():null]);if(key===this.indicatorKey)return;this.indicatorKey=key;const inverse=this.camera.quaternion.clone().invert(),colors=['#ef5555','#59ce77','#58a4ff'];let svg='<svg viewBox="0 0 140 120" aria-hidden="true">';
  this.axes.forEach((a,i)=>{const v=new T.Vector3(...a).applyQuaternion(inverse);for(const sign of [-1,1]){const x=70+v.x*40*sign,y=57-v.y*40*sign;svg+=`<line x1="70" y1="57" x2="${x}" y2="${y}" stroke="${colors[i]}" stroke-width="${sign>0?3:1}" ${sign<0?'stroke-dasharray="3 3"':''}/><text x="${x}" y="${y-5}" fill="${colors[i]}" text-anchor="middle">${sign>0?'+':'−'}${['X','Y','Z'][i]}</text>`;}});svg+='</svg>';const d=this.dragging?this.delta():undefined;this.indicator.innerHTML=svg+`<span>${d?d.map((v,i)=>`${['X','Y','Z'][i]} ${Math.round(v*100)} cm`).join(' · '):'Y ↑ yükseklik · XZ yatay'}</span>`;
 }
}
