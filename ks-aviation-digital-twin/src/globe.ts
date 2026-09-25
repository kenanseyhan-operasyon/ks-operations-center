import * as THREE from 'three';
import { currentDevice } from './device';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import atlas from 'world-atlas/countries-110m.json';
type Route={id:string;type:string;from:{lat:number;lon:number};to:{lat:number;lon:number}};
type Point={code:string;lat:number;lon:number;city:string};
export class Globe {
  private visibleCodes?:Set<string>;private routes:Route[]=[];private routeSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  private renderer?:THREE.WebGLRenderer;private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(40,1,.01,100);private controls?:OrbitControls;
  private labels=new Map<string,HTMLButtonElement>();private markers=new Map<string,THREE.Mesh>();private canvas=document.createElement('canvas');private zoom:'world'|'turkey'|'airport'='world';private focusPoint={lat:39,lon:34};private flight=0;private visible=true;
  constructor(private host:HTMLElement,private airports:Point[],private select:(code:string)=>void){
    this.canvas.className='globe-fallback';this.host.appendChild(this.canvas);this.routeSvg.classList.add('network-routes-map');this.routeSvg.setAttribute('aria-label','Lojistik bağlantılar');this.host.appendChild(this.routeSvg);
    for(const a of airports){const b=document.createElement('button');b.className='globe-pin';b.textContent=a.code.length>7?a.city:a.code;b.title=a.city;b.setAttribute('aria-label',a.code+' '+a.city);b.onclick=e=>{e.stopPropagation();this.select(a.code);};host.appendChild(b);this.labels.set(a.code,b);}
    try{
      this.renderer=new THREE.WebGLRenderer({antialias:!currentDevice().mobile,alpha:true,powerPreference:currentDevice().mobile?'low-power':'high-performance'});this.renderer.setPixelRatio(currentDevice().pixelRatio);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.host.prepend(this.renderer.domElement);this.canvas.hidden=true;
      this.camera.position.copy(this.point(25,20,6.2));this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.minDistance=.3;this.controls.maxDistance=9;this.controls.autoRotate=true;this.controls.autoRotateSpeed=.2;this.controls.addEventListener('start',()=>{this.flight++;this.controls!.autoRotate=false;});
      const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;this.drawCountries(canvas,0,0,1);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
      const mat=new THREE.MeshStandardMaterial({
  map:tex,
  roughness:.92,
  metalness:0,
  emissive:new THREE.Color(0xffffff),
  emissiveIntensity:.20
});

this.scene.add(
  new THREE.Mesh(
    new THREE.SphereGeometry(2,96,64),
    mat
  )
);

new THREE.TextureLoader().load(
  '/textures/earth.jpg',
  texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;

    texture.anisotropy=this.renderer
      ? this.renderer.capabilities.getMaxAnisotropy()
      : 1;

    mat.map?.dispose();
    mat.map=texture;
    mat.emissiveMap=texture;
    mat.needsUpdate=true;
  },
  undefined,
  ()=>{}
);

// Yumuşak genel aydınlatma
this.scene.add(
  new THREE.HemisphereLight(
    0xf2ffff,
    0x416273,
    2.2
  )
);

// Güneş ışığı: kürenin 3D hacmini korur
const sun=new THREE.DirectionalLight(0xffffff,1.35);
sun.position.set(5,4,5);
this.scene.add(sun);
      const atmosphere=new THREE.Mesh(
  new THREE.SphereGeometry(2.06,96,64),
  new THREE.MeshBasicMaterial({
    color:0x76ddff,
    side:THREE.BackSide,
    transparent:true,
    opacity:.11
  })
);
this.scene.add(atmosphere);
      for(const a of airports){const m=new THREE.Mesh(new THREE.SphereGeometry(.008,12,8),new THREE.MeshBasicMaterial({color:a.code==='ADB'?0xb7ff3c:0x76dfff}));m.position.copy(this.point(a.lat,a.lon,2.015));this.scene.add(m);this.markers.set(a.code,m);}
      let down=[0,0];this.renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);this.renderer.domElement.addEventListener('pointerup',e=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const r=this.renderer!.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),this.camera);const hit=ray.intersectObjects([...this.markers.values()])[0];if(hit)for(const [code,m] of this.markers)if(m===hit.object)this.select(code);});
      this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.flight++;this.controls?.dispose();this.controls=undefined;this.renderer?.domElement.remove();this.renderer=undefined;this.canvas.hidden=false;this.resize();});
      let last=0;const loop=(now=0)=>{requestAnimationFrame(loop);if(!this.renderer||!this.visible||document.hidden||(currentDevice().mobile&&now-last<32))return;last=now;this.controls?.update();this.renderer!.render(this.scene,this.camera);this.placeLabels();};loop();
    }catch(e){console.warn('Globe 2D fallback',e);this.renderer=undefined;this.canvas.hidden=false;}
    new ResizeObserver(()=>this.resize()).observe(host);this.resize();let lastRoute=0;const routeFrame=(now:number)=>{requestAnimationFrame(routeFrame);if(!this.visible||document.hidden||now-lastRoute<80)return;lastRoute=now;this.drawRoutes(now);};requestAnimationFrame(routeFrame);
  }
  setLayers(codes:Set<string>){this.visibleCodes=codes;for(const [code,m] of this.markers)m.visible=codes.has(code);this.placeLabels();}
  setRoutes(routes:Route[]){this.routes=routes;this.drawRoutes(performance.now());}
  private project(lat:number,lon:number){const w=this.host.clientWidth,h=this.host.clientHeight;if(this.renderer){const p=this.point(lat,lon,2.022),v=p.clone().project(this.camera);return{x:(v.x+1)/2*w,y:(1-v.y)/2*h,visible:p.clone().normalize().dot(this.camera.position.clone().normalize())>.4&&v.z<1};}const z=this.zoom==='world'?1:8;return {x:w/2+(lon-(this.zoom==='world'?0:this.focusPoint.lon))/360*w*z,y:h/2+((this.zoom==='world'?0:this.focusPoint.lat)-lat)/180*h*z,visible:true};}
  private drawRoutes(now:number){this.routeSvg.setAttribute('viewBox',`0 0 ${this.host.clientWidth} ${this.host.clientHeight}`);this.routeSvg.innerHTML=this.routes.map((r,i)=>{const a=this.project(r.from.lat,r.from.lon),b=this.project(r.to.lat,r.to.lon);if(!a.visible||!b.visible)return '';const x=(a.x+b.x)/2,y=(a.y+b.y)/2-Math.min(55,Math.hypot(a.x-b.x,a.y-b.y)*.2),t=((now/10000)+i*.07)%1,c=r.type==='sea'?'#38c5f2':'#ff9e45';const px=(1-t)**2*a.x+2*(1-t)*t*x+t*t*b.x,py=(1-t)**2*a.y+2*(1-t)*t*y+t*t*b.y;return `<path d="M${a.x},${a.y}Q${x},${y} ${b.x},${b.y}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="5 4"/><circle cx="${px}" cy="${py}" r="4" fill="${c}"/>`;}).join('');}
  private point(lat:number,lon:number,r:number){const p=(90-lat)*Math.PI/180,t=(lon+180)*Math.PI/180;return new THREE.Vector3(-r*Math.sin(p)*Math.cos(t),r*Math.cos(p),r*Math.sin(p)*Math.sin(t));}
  show(visible:boolean){this.visible=visible;if(visible)this.resize();}
  focus(mode:'world'|'turkey'|'airport',point?:Point){this.zoom=mode;this.focusPoint=point||{lat:39,lon:34};if(!this.controls){this.resize();return;}this.controls.autoRotate=mode==='world';const n=this.point(this.focusPoint.lat,this.focusPoint.lon,1),end=n.clone().multiplyScalar(mode==='world'?6.2:mode==='turkey'?2.85:2.56),target=n.clone().multiplyScalar(mode==='world'?0:1.98),start=this.camera.position.clone(),startTarget=this.controls.target.clone(),token=++this.flight,t=performance.now();const step=(now:number)=>{if(token!==this.flight)return;const k=Math.min(1,(now-t)/1200),q=k*k*(3-2*k);this.camera.position.lerpVectors(start,end,q);this.controls!.target.lerpVectors(startTarget,target,q);this.controls!.update();if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);}
  private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;if(this.renderer){this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}else{this.canvas.width=w*1.5;this.canvas.height=h*1.5;const z=this.zoom==='world'?1:8;this.drawCountries(this.canvas,this.zoom==='world'?0:this.focusPoint.lon,this.zoom==='world'?0:this.focusPoint.lat,z);}this.placeLabels();}
  private drawCountries(canvas:HTMLCanvasElement,lon:number,lat:number,zoom:number){const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height;c.fillStyle='#0e3443';c.fillRect(0,0,w,h);c.fillStyle='#448278';c.strokeStyle='#8bbeb0';c.lineWidth=.65;const geo=feature(atlas as never,(atlas as any).objects.countries) as any;const ring=(r:number[][])=>{c.beginPath();r.forEach(([x,y],i)=>{const px=w/2+(x-lon)/360*w*zoom,py=h/2+(lat-y)/180*h*zoom;i?c.lineTo(px,py):c.moveTo(px,py);});c.closePath();c.fill();c.stroke();};for(const f of geo.features){if(f.geometry.type==='Polygon')f.geometry.coordinates.forEach(ring);else if(f.geometry.type==='MultiPolygon')f.geometry.coordinates.forEach((p:number[][][])=>p.forEach(ring));}}
  private placeLabels(){const w=this.host.clientWidth,h=this.host.clientHeight;for(const a of this.airports){const b=this.labels.get(a.code)!;let x:number,y:number,show=true;if(this.renderer){const p=this.point(a.lat,a.lon,2.018),v=p.clone().project(this.camera);x=(v.x+1)/2*w;y=(1-v.y)/2*h;show=p.clone().normalize().dot(this.camera.position.clone().normalize())>.4&&v.z<1&&x>0&&x<w&&y>0&&y<h;}else{const z=this.zoom==='world'?1:8,lon=this.zoom==='world'?0:this.focusPoint.lon,lat=this.zoom==='world'?0:this.focusPoint.lat;x=w/2+(a.lon-lon)/360*w*z;y=h/2+(lat-a.lat)/180*h*z;}
      if(this.zoom==='world'&&a.code!=='ADB'&& !['LHR','DXB','JFK'].includes(a.code))show=false;if(this.visibleCodes&&!this.visibleCodes.has(a.code))show=false;const offset:Record<string,[number,number]>={ADB:[-35,-10],BJV:[-25,15],DLM:[5,30],AYT:[20,8],GZP:[32,25],SAW:[12,-25],STAD:[-58,-13],STAR:[-40,-42],PETKIM:[32,-37],S_BINA:[52,0],SHELL_DERINCE:[38,9],CEKISAN:[-70,-20],SHELL_ANTALYA:[-62,8]};const [dx,dy]=this.zoom==='world'?[0,0]:offset[a.code]||[0,0];b.hidden=!show;b.style.left=`${x+dx}px`;b.style.top=`${y+dy}px`;}
  }
}
