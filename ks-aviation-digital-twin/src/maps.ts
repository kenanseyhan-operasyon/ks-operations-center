import * as THREE from 'three';
import { geographic, tileOf, tileCorner, TILE_URL } from './geo';
import { AIRCRAFT_SPECS, aircraftOutline } from './aircraft-specs';
import type { ServiceMarker } from './aircraft-services';
import type { PhotoGround } from './photo-ground';
import type { Entity } from './scene-data';
type Tile = { key:string; x:number; z:number; size:number; image:HTMLImageElement; ready:boolean; failed:boolean };
export class Imagery {
  tiles=new Map<string,Tile>(); active:Tile[]=[]; enabled=true;
  onChange=()=>{};
  update(x:number,z:number,span:number){
    if(!this.enabled){this.active=[];this.onChange();return;}
    // ADB imagery is available through level 19; level 20 returns a gray
    // "Map data not yet available" tile with HTTP 200. Reuse level 19 up close.
    const p=geographic(x,z), zoom=Math.max(12,Math.min(19,Math.ceil(Math.log2(31400000/Math.max(80,span)*4))));
    const c=tileOf(p.lat,p.lon,zoom), centerX=Math.floor(c.x),centerY=Math.floor(c.y);
    const count=3; const next:Tile[]=[];
    for(let dy=-count;dy<=count;dy++)for(let dx=-count;dx<=count;dx++){
      const tx=centerX+dx,ty=centerY+dy,key=`${zoom}/${ty}/${tx}`;
      let tile=this.tiles.get(key);
      if(!tile){
        const a=tileCorner(tx,ty,zoom),b=tileCorner(tx+1,ty+1,zoom),img=new Image();img.crossOrigin='anonymous';
        tile={key,x:a[0],z:a[1],size:b[0]-a[0],image:img,ready:false,failed:false};this.tiles.set(key,tile);
        const t=tile;img.onload=()=>{t.ready=true;this.onChange();};img.onerror=()=>{t.failed=true;this.onChange();};img.src=`${TILE_URL}/${key}`;
      }next.push(tile);
    }
    this.active=next;
    if(this.tiles.size>180){const keep=new Set(next.map(t=>t.key));for(const [k] of this.tiles){if(!keep.has(k)){this.tiles.delete(k);if(this.tiles.size<=120)break;}}}
    this.onChange();
  }
}
export class MapPlane {
  group=new THREE.Group();meshes=new Map<string,THREE.Mesh>();
  constructor(public imagery:Imagery){}
  sync(){
    const keep=new Set(this.imagery.active.map(t=>t.key));
    for(const [key,m] of this.meshes)if(!keep.has(key)){this.group.remove(m);m.geometry.dispose();(m.material as THREE.MeshBasicMaterial).map?.dispose();(m.material as THREE.Material).dispose();this.meshes.delete(key);}
    for(const t of this.imagery.active)if(t.ready&&!this.meshes.has(t.key)){
      const tex=new THREE.Texture(t.image);tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;
      const m=new THREE.Mesh(new THREE.PlaneGeometry(t.size,t.size),new THREE.MeshBasicMaterial({map:tex}));m.rotation.x=-Math.PI/2;m.position.set(t.x+t.size/2,-.035,t.z+t.size/2);this.meshes.set(t.key,m);this.group.add(m);
    }
  }
}
export type MapHooks={ photo:()=>PhotoGround|undefined;markers:()=>ServiceMarker[];serviceClick:(x:number,z:number,tolerance:number)=>boolean; entities:()=>Entity[]; selection:()=>Set<string>; editable:()=>boolean; drawing:()=>boolean; click:(x:number,z:number,id:string|undefined,extend:boolean)=>void; dragStart:()=>void; drag:(dx:number,dz:number)=>void; dragEnd:()=>void; change:()=>void };
export class PlanMap {
  canvas=document.createElement('canvas');center:[number,number]=[0,0];span=180;enabled=false;private ctx:CanvasRenderingContext2D;
  private pointer?:{x:number;y:number;cx:number;cz:number;world:[number,number];hit?:string;drag:boolean;move:boolean;pan:boolean};
  draft:[number,number][]=[];
  constructor(public host:HTMLElement,public imagery:Imagery,private hooks:MapHooks){
    this.canvas.className='plan-map';this.canvas.setAttribute('aria-label','ADB 2D harita ve çizim alanı');this.ctx=this.canvas.getContext('2d')!;host.appendChild(this.canvas);
    new ResizeObserver(()=>this.draw()).observe(host);
    this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
    this.canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0&&e.button!==2)return;const r=this.canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,w=this.toWorld(x,y),hit=this.pick(w[0],w[1]);
      this.pointer={x,y,cx:e.clientX,cz:e.clientY,world:w,hit,drag:false,move:false,pan:e.button===2||!hit||!this.hooks.editable()};this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove',e=>{
      const p=this.pointer;if(!p)return;const dx=e.clientX-p.cx,dy=e.clientY-p.cz;if(!p.move&&Math.hypot(e.clientX-(p.x+this.canvas.getBoundingClientRect().left),e.clientY-(p.y+this.canvas.getBoundingClientRect().top))<4)return;
      if(this.hooks.drawing())return;
      p.move=true;
      if(!p.pan){if(!p.drag){if(!this.hooks.selection().has(p.hit!))this.hooks.click(p.world[0],p.world[1],p.hit,e.shiftKey);this.hooks.dragStart();p.drag=true;}this.hooks.drag(dx/this.pixels,dy/this.pixels);}
      else{this.center[0]-=dx/this.pixels;this.center[1]-=dy/this.pixels;this.draw();}
      p.cx=e.clientX;p.cz=e.clientY;
    });
    const up=(e:PointerEvent)=>{const p=this.pointer;if(!p)return;this.pointer=undefined;if(p.drag)this.hooks.dragEnd();else if(!p.move&&e.button===0&&(this.hooks.drawing()||!this.hooks.serviceClick(p.world[0],p.world[1],9/this.pixels)))this.hooks.click(p.world[0],p.world[1],p.hit,e.shiftKey);this.refresh();};
    this.canvas.addEventListener('pointerup',up);this.canvas.addEventListener('pointercancel',()=>{if(this.pointer?.drag)this.hooks.dragEnd();this.pointer=undefined;});
    this.canvas.addEventListener('wheel',e=>{e.preventDefault();const r=this.canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,a=this.toWorld(x,y);this.span=Math.max(15,Math.min(20000,this.span*Math.exp(e.deltaY*.001)));const b=this.toWorld(x,y);this.center[0]+=a[0]-b[0];this.center[1]+=a[1]-b[1];this.refresh();},{passive:false});
  }
  get pixels(){return (this.host.clientWidth||800)/this.span;}
  toWorld(x:number,y:number):[number,number]{return [this.center[0]+(x-this.host.clientWidth/2)/this.pixels,this.center[1]+(y-this.host.clientHeight/2)/this.pixels];}
  view(center:[number,number],span:number){this.center=[...center];this.span=span;this.refresh();}
  refresh(){if(this.enabled)this.imagery.update(this.center[0],this.center[1],this.span);this.draw();this.hooks.change();}
  pick(x:number,z:number){
    for(const o of [...this.hooks.entities()].reverse()){
      const a=o.heading*Math.PI/180,dx=x-o.position[0],dz=z-o.position[2],px=(Math.cos(a)*dx+Math.sin(a)*dz)/o.scale,pz=(-Math.sin(a)*dx+Math.cos(a)*dz)/o.scale;
      if(o.kind==='ground')continue;
      if(o.points?.length){for(let i=1;i<o.points.length;i++){const A=o.points[i-1],B=o.points[i],vx=B[0]-A[0],vz=B[1]-A[1],k=Math.max(0,Math.min(1,((px-A[0])*vx+(pz-A[1])*vz)/(vx*vx+vz*vz)));if(Math.hypot(px-A[0]-k*vx,pz-A[1]-k*vz)<Math.max(.4,6/this.pixels))return o.id;}}
      else{const w=o.kind==='tank'?o.radius*2:o.width,l=o.kind==='tank'?o.radius*2:o.length;if(Math.abs(px)<Math.max(w/2,6/this.pixels)&&Math.abs(pz)<Math.max(l/2,6/this.pixels))return o.id;}
    }
  }
  draw(){
    if(!this.enabled)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;const d=Math.min(devicePixelRatio,2);this.canvas.width=w*d;this.canvas.height=h*d;const c=this.ctx;c.setTransform(d,0,0,d,0,0);c.fillStyle='#223a3a';c.fillRect(0,0,w,h);
    const p=this.pixels;c.save();c.translate(w/2,h/2);c.scale(p,p);c.translate(-this.center[0],-this.center[1]);
    if(this.imagery.enabled)for(const t of this.imagery.active)if(t.ready)c.drawImage(t.image,t.x,t.z,t.size+.02,t.size+.02);
    if(!this.imagery.enabled||!this.imagery.active.some(t=>t.ready)){c.lineWidth=1/p;c.strokeStyle='#496366';const step=this.span>500?100:10;for(let x=Math.floor((this.center[0]-this.span)/step)*step;x<this.center[0]+this.span;x+=step){c.beginPath();c.moveTo(x,this.center[1]-this.span);c.lineTo(x,this.center[1]+this.span);c.stroke();}for(let z=Math.floor((this.center[1]-this.span)/step)*step;z<this.center[1]+this.span;z+=step){c.beginPath();c.moveTo(this.center[0]-this.span,z);c.lineTo(this.center[0]+this.span,z);c.stroke();}}
    this.hooks.photo()?.draw(c);
    for(const o of [...this.hooks.entities()].sort((a,b)=>Number(b.kind==='ground')-Number(a.kind==='ground'))){
      const selected=this.hooks.selection().has(o.id);c.save();c.translate(o.position[0],o.position[2]);c.rotate(o.heading*Math.PI/180);c.scale(o.scale,o.scale);c.fillStyle=o.color;c.strokeStyle=selected?'#b7ff3c':'#233b42';c.lineWidth=(selected?3:1)/p/o.scale;c.beginPath();
      if(o.points?.length){o.points.forEach(([x,z],i)=>i?c.lineTo(x,z):c.moveTo(x,z));if(o.kind==='ground'){c.closePath();c.globalAlpha=.72;c.fill();c.globalAlpha=1;}else{c.lineWidth=Math.max(o.thickness,2/p/o.scale);c.strokeStyle=selected?'#b7ff3c':o.color;}}
      else if(o.kind==='tank'||o.kind==='tree'){c.arc(0,0,o.kind==='tank'?o.radius:o.width/2,0,Math.PI*2);c.fill();}
      else if(o.kind==='aircraft'){const W=o.width,L=o.length,spec=AIRCRAFT_SPECS[o.preset],outline=spec?aircraftOutline(spec):[[0,-L/2],[W*.05,-L*.39],[W*.07,-L*.12],[W/2,L*.1],[W/2,L*.17],[W*.065,L*.1],[W*.05,L*.36],[W*.2,L*.43],[W*.2,L*.49],[-W*.2,L*.49],[-W*.2,L*.43],[-W*.05,L*.36],[-W*.065,L*.1],[-W/2,L*.17],[-W/2,L*.1],[-W*.07,-L*.12],[-W*.05,-L*.39]];outline.forEach(([x,z],i)=>i?c.lineTo(x,z):c.moveTo(x,z));c.closePath();c.fill();}
      else{c.rect(-o.width/2,-o.length/2,o.width,o.length);c.fill();if(o.kind==='vehicle'){c.fillStyle='#4d8498';c.fillRect(-o.width*.43,-o.length*.46,o.width*.86,o.length*.16);}}
      c.stroke();if(selected){const W=o.kind==='tank'?o.radius*2:o.width,L=o.kind==='tank'?o.radius*2:o.length;c.strokeStyle='#b7ff3c';c.lineWidth=2/p/o.scale;c.strokeRect(-W/2-1/p,-L/2-1/p,W+2/p,L+2/p);}c.restore();
    }
    for(const marker of this.hooks.markers()){c.beginPath();c.arc(marker.x,marker.z,(marker.selected?7:5)/p,0,Math.PI*2);c.fillStyle=marker.selected?'#ffffff':marker.color;c.fill();c.strokeStyle='#10232b';c.lineWidth=2/p;c.stroke();if(marker.selected){c.font=`${12/p}px system-ui`;const textWidth=c.measureText(marker.label).width;c.fillStyle='#071c25ee';c.fillRect(marker.x+9/p,marker.z-17/p,textWidth+8/p,19/p);c.fillStyle='#fff';c.fillText(marker.label,marker.x+13/p,marker.z-3/p);}}
    if(this.draft.length){c.beginPath();this.draft.forEach(([x,z],i)=>i?c.lineTo(x,z):c.moveTo(x,z));c.strokeStyle='#b7ff3c';c.lineWidth=3/p;c.stroke();for(const [x,z] of this.draft){c.beginPath();c.arc(x,z,4/p,0,Math.PI*2);c.fillStyle='#b7ff3c';c.fill();}}
    c.restore();c.fillStyle='#071c25dd';c.fillRect(14,h-42,150,28);c.fillStyle='#e9f8ed';c.font='12px system-ui';const maxMetres=115/p,unit=10**Math.floor(Math.log10(maxMetres)),metres=([5,2,1].find(n=>n*unit<=maxMetres)??1)*unit;c.fillRect(23,h-24,metres*p,2);c.fillText(`${Number(metres.toPrecision(3))} m`,23,h-28);
  }
}
