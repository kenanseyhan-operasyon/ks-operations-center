import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import atlas from 'world-atlas/countries-110m.json';
import { currentDevice } from './device';
import { CAMERA_FLOOR, DETAIL_BOUNDS, EARTH_RADIUS, TURKEY_BOUNDS, earthPoint, flightPosition, onVisibleHemisphere, regionDistance, worldDistance } from './globe-geometry';
type Route={id:string;type:string;from:Point;to:Point};
type Point={code:string;lat:number;lon:number;city?:string;category?:string};
type Pixels={width:number;height:number;data:Uint8ClampedArray};
const OCEAN_SHADER=`
 float ksOcean=smoothstep(1.10,1.7,diffuseColor.b/max(diffuseColor.r,0.0003))
  *smoothstep(1.04,1.5,diffuseColor.b/max(diffuseColor.g,0.0003))
  *(1.0-smoothstep(0.10,0.30,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.014,0.15,0.34),ksOcean*0.86);
`;
export class Globe{
 private renderer?:THREE.WebGLRenderer;
 private scene=new THREE.Scene();
 private camera=new THREE.PerspectiveCamera(40,1,.004,100);
 private controls?:OrbitControls;
 private material?:THREE.MeshBasicMaterial;
 private canvas=document.createElement('canvas');
 private routeSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 private labels=new Map<string,HTMLButtonElement>();
 private visibleCodes?:Set<string>;
 private routes:Route[]=[];
 private mode:'world'|'turkey'|'airport'='world';
 private focusPoint={lat:39,lon:34.55};
 private visible=true;
 private flight?:{start:THREE.Vector3;end:THREE.Vector3;time:number};
 private autoRotate=true;
 private dirty=true;
 private userMoved=false;
 private width=0;private height=0;
 private texture?:Pixels;private detailPixels?:Pixels;private loadingDetail=false;
 private uniforms={ksDetail:{value:new THREE.Texture()},ksDetailReady:{value:0}};
 private drag?:{id:number;x:number;y:number};
 private pointers=new Map<number,{x:number;y:number}>();private pinch=0;
 constructor(private host:HTMLElement,private points:Point[],private select:(code:string)=>void){
  this.canvas.className='globe-fallback';this.canvas.setAttribute('aria-label','Dünya ve Türkiye haritası');
  this.host.appendChild(this.canvas);this.routeSvg.classList.add('network-routes-map');this.routeSvg.setAttribute('aria-hidden','true');this.host.appendChild(this.routeSvg);
  for(const p of points){
   const b=document.createElement('button');b.className='globe-pin';b.dataset.kind=p.code==='ADB'?'primary':p.category||'airports';
   b.textContent=this.short(p.code);b.title=p.city||p.code;b.setAttribute('aria-label',`${p.code} ${p.city||''}`.trim());b.onclick=e=>{e.stopPropagation();this.select(p.code)};
   this.host.appendChild(b);this.labels.set(p.code,b);
  }
  this.camera.position.copy(earthPoint(26,22,7));this.camera.lookAt(0,0,0);
  try{this.initWebGL()}catch(e){this.renderer?.domElement.remove();this.renderer=undefined;this.canvas.hidden=false;this.host.dataset.render='2d';console.info('WebGL unavailable; interactive canvas globe is active.');}
  this.loadTexture();this.bindFallback();
  new ResizeObserver(()=>this.resize()).observe(host);this.resize();
  let last=0,lastMap=0;
  const frame=(now:number)=>{
   requestAnimationFrame(frame);if(!this.visible||document.hidden||now-last<(currentDevice().mobile?32:16))return;
   const dt=Math.min(.05,(now-last)/1000);last=now;
   if(this.flight){const k=Math.min(1,(now-this.flight.time)/1450),q=k*k*(3-2*k);this.camera.position.copy(flightPosition(this.flight.start,this.flight.end,q));this.camera.lookAt(0,0,0);this.dirty=true;if(k===1){this.flight=undefined;if(this.controls)this.controls.enabled=true;}}
   else if(this.controls){this.controls.autoRotate=this.autoRotate&&this.mode==='world';this.controls.update();}
   else if(this.autoRotate&&this.mode==='world'){this.camera.position.applyAxisAngle(new THREE.Vector3(0,1,0),dt*.009);this.camera.lookAt(0,0,0);this.dirty=true;}
   if(this.camera.position.length()<CAMERA_FLOOR)this.camera.position.setLength(CAMERA_FLOOR);
   this.camera.updateMatrixWorld();
   if(this.renderer)this.renderer.render(this.scene,this.camera);
   else if(this.dirty&&now-lastMap>85){this.drawFallback();this.dirty=false;lastMap=now;}
   if(this.renderer||now-lastMap<35)this.placeLabels();
   this.drawRoutes(now);
  };requestAnimationFrame(frame);
 }
 private short(code:string){return code==='SHELL_DERINCE'?'DERİNCE':code==='SHELL_ANTALYA'?'SHELL AYT':code==='CEKISAN'?'AKDENİZ':code;}
 private initWebGL(){
  this.renderer=new THREE.WebGLRenderer({antialias:!currentDevice().mobile,alpha:true,powerPreference:currentDevice().mobile?'low-power':'high-performance'});
  this.renderer.setPixelRatio(currentDevice().pixelRatio);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.host.prepend(this.renderer.domElement);this.canvas.hidden=true;this.host.dataset.render='3d';
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.065;this.controls.enablePan=false;this.controls.minDistance=CAMERA_FLOOR;this.controls.maxDistance=25;this.controls.autoRotateSpeed=.12;
  this.controls.addEventListener('start',()=>this.cancelFlight());
  this.renderer.domElement.addEventListener('pointerdown',()=>this.cancelFlight());
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.cancelFlight();this.controls?.dispose();this.controls=undefined;this.renderer?.domElement.remove();this.renderer=undefined;this.canvas.hidden=false;this.host.dataset.render='2d';this.dirty=true;this.resize();});
  const preview=document.createElement('canvas');preview.width=1024;preview.height=512;this.drawCountries(preview);const tex=new THREE.CanvasTexture(preview);tex.colorSpace=THREE.SRGBColorSpace;
  this.material=new THREE.MeshBasicMaterial({map:tex,toneMapped:false});
  this.material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.uniforms);
   shader.fragmentShader='uniform sampler2D ksDetail;\nuniform float ksDetailReady;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    vec2 ksUV=vec2((vMapUv.x-${(DETAIL_BOUNDS.west+180)/360})/${(DETAIL_BOUNDS.east-DETAIL_BOUNDS.west)/360},(vMapUv.y-${(DETAIL_BOUNDS.south+90)/180})/${(DETAIL_BOUNDS.north-DETAIL_BOUNDS.south)/180});
    if(ksDetailReady>0.5 && ksUV.x>0.0 && ksUV.x<1.0 && ksUV.y>0.0 && ksUV.y<1.0){
     float edge=smoothstep(0.0,0.02,min(min(ksUV.x,1.0-ksUV.x),min(ksUV.y,1.0-ksUV.y)));
     diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(ksDetail,ksUV).rgb,edge);
    }\n${OCEAN_SHADER}`);
  };
  this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS,128,80),this.material));
  const atmosphere=new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{color:{value:new THREE.Color(0xa8e6ff)}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=-p.xyz;gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 color;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),2.7);gl_FragColor=vec4(color,rim*0.58);}'});
  this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(2.085,96,64),atmosphere));
 }
 private loadTexture(){
  const image=new Image();image.onload=()=>{this.texture=this.pixels(image);if(this.material){const t=new THREE.Texture(image);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,this.renderer?.capabilities.getMaxAnisotropy()||1);t.needsUpdate=true;this.material.map?.dispose();this.material.map=t;this.material.needsUpdate=true;}this.dirty=true;};
  image.onerror=()=>{const c=document.createElement('canvas');c.width=1024;c.height=512;this.drawCountries(c);this.texture=this.pixels(c);this.dirty=true;};
  image.src=`/textures/earth-${currentDevice().mobile?2048:4096}.webp`;
 }
 private loadDetail(){
  if(this.loadingDetail)return;this.loadingDetail=true;const image=new Image();
  image.onload=()=>{this.detailPixels=this.pixels(image);const t=new THREE.Texture(image);t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;t.anisotropy=Math.min(8,this.renderer?.capabilities.getMaxAnisotropy()||1);this.uniforms.ksDetail.value.dispose();this.uniforms.ksDetail.value=t;this.uniforms.ksDetailReady.value=1;this.dirty=true;};
  image.onerror=()=>{this.loadingDetail=false;};image.src='/textures/earth-turkey-detail.webp';
 }
 private pixels(source:HTMLImageElement|HTMLCanvasElement):Pixels{
  const c=document.createElement('canvas');c.width=source instanceof HTMLImageElement?source.naturalWidth:source.width;c.height=source instanceof HTMLImageElement?source.naturalHeight:source.height;
  const g=c.getContext('2d',{willReadFrequently:true})!;g.drawImage(source,0,0);const p=g.getImageData(0,0,c.width,c.height);
  const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  // Same blue-ocean treatment as the 3D material; geographic pixels stay in place.
  const linear=Array.from({length:256},(_,v)=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});
  const srgb=(x:number)=>Math.round(255*(x<=.0031308?x*12.92:1.055*x**(1/2.4)-.055));
  for(let i=0;i<p.data.length;i+=4){const r=linear[p.data[i]],g=linear[p.data[i+1]],b=linear[p.data[i+2]],w=smooth(1.1,1.7,b/Math.max(r,.0003))*smooth(1.04,1.5,b/Math.max(g,.0003))*(1-smooth(.1,.3,Math.max(r,g,b)))*.86;if(w>.01){p.data[i]=srgb(r*(1-w)+.014*w);p.data[i+1]=srgb(g*(1-w)+.15*w);p.data[i+2]=srgb(b*(1-w)+.34*w);}}
  return {width:c.width,height:c.height,data:p.data};
 }
 private drawCountries(c:HTMLCanvasElement){
  const g=c.getContext('2d')!;g.fillStyle='#2479aa';g.fillRect(0,0,c.width,c.height);g.fillStyle='#61856b';g.strokeStyle='#b9c7a2';g.lineWidth=.5;
  const geo=feature(atlas as never,(atlas as any).objects.countries) as any;
  const ring=(r:number[][])=>{g.beginPath();r.forEach(([x,y],i)=>{const a=(x+180)/360*c.width,b=(90-y)/180*c.height;i?g.lineTo(a,b):g.moveTo(a,b)});g.closePath();g.fill();g.stroke();};
  for(const f of geo.features){if(f.geometry.type==='Polygon')f.geometry.coordinates.forEach(ring);else if(f.geometry.type==='MultiPolygon')f.geometry.coordinates.forEach((p:number[][][])=>p.forEach(ring));}
  if(!this.texture)this.texture={width:c.width,height:c.height,data:g.getImageData(0,0,c.width,c.height).data};
 }
 private drawFallback(){
  const g=this.canvas.getContext('2d')!;const w=this.canvas.width,h=this.canvas.height;
  if(!this.texture){const c=document.createElement('canvas');c.width=1024;c.height=512;this.drawCountries(c);}
  const p=g.createImageData(w,h),d=this.camera.position.length(),n=this.camera.position.clone().normalize(),right=new THREE.Vector3(0,1,0).cross(n).normalize(),up=n.clone().cross(right),tan=Math.tan(THREE.MathUtils.degToRad(20)),aspect=w/h,base=this.texture!;
  for(let y=0;y<h;y++){const Y=(1-2*(y+.5)/h)*tan;for(let x=0;x<w;x++){
   const X=(2*(x+.5)/w-1)*tan*aspect,a=1+X*X+Y*Y,disc=d*d-a*(d*d-4);if(disc<0)continue;
   const t=(d-Math.sqrt(disc))/a,q=d-t,px=q*n.x+t*(X*right.x+Y*up.x),py=q*n.y+t*(X*right.y+Y*up.y),pz=q*n.z+t*(X*right.z+Y*up.z);
   const lon=Math.atan2(-pz,px)*180/Math.PI,lat=Math.asin(Math.max(-1,Math.min(1,py/2)))*180/Math.PI;
   let tex=base,u=(lon+180)/360,v=(90-lat)/180;
   if(this.detailPixels&&lon>DETAIL_BOUNDS.west&&lon<DETAIL_BOUNDS.east&&lat>DETAIL_BOUNDS.south&&lat<DETAIL_BOUNDS.north){tex=this.detailPixels;u=(lon-DETAIL_BOUNDS.west)/(DETAIL_BOUNDS.east-DETAIL_BOUNDS.west);v=(DETAIL_BOUNDS.north-lat)/(DETAIL_BOUNDS.north-DETAIL_BOUNDS.south);}
   const i=(y*w+x)*4,sx=Math.max(0,Math.min(tex.width-1,u*tex.width-.5)),sy=Math.max(0,Math.min(tex.height-1,v*tex.height-.5)),ix=Math.floor(sx),iy=Math.floor(sy),s=(iy*tex.width+ix)*4;
   if(!this.flight&&!(this.autoRotate&&this.mode==='world')){const xx=Math.min(tex.width-1,ix+1),yy=Math.min(tex.height-1,iy+1),fx=sx-ix,fy=sy-iy,b=(iy*tex.width+xx)*4,c=(yy*tex.width+ix)*4,d=(yy*tex.width+xx)*4;for(let k=0;k<3;k++)p.data[i+k]=(tex.data[s+k]*(1-fx)+tex.data[b+k]*fx)*(1-fy)+(tex.data[c+k]*(1-fx)+tex.data[d+k]*fx)*fy;}
   else{p.data[i]=tex.data[s];p.data[i+1]=tex.data[s+1];p.data[i+2]=tex.data[s+2];}p.data[i+3]=255;
  }}
  g.putImageData(p,0,0);const radius=h/2/tan*2/Math.sqrt(d*d-4);
  g.globalCompositeOperation='destination-over';const halo=g.createRadialGradient(w/2,h/2,radius*.94,w/2,h/2,radius*1.065);halo.addColorStop(0,'rgba(140,216,255,0)');halo.addColorStop(.45,'rgba(166,228,255,.52)');halo.addColorStop(1,'rgba(144,209,255,0)');g.fillStyle=halo;g.fillRect(0,0,w,h);g.globalCompositeOperation='source-over';
 }
 private bindFallback(){
  const c=this.canvas;
  c.addEventListener('pointerdown',e=>{this.cancelFlight();c.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};if(this.pointers.size===2){const [a,b]=[...this.pointers.values()];this.pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
  c.addEventListener('pointermove',e=>{if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointers.size===2){const[a,b]=[...this.pointers.values()],v=Math.hypot(a.x-b.x,a.y-b.y);if(this.pinch>0)this.zoomBy(this.pinch/v);this.pinch=v;}else if(this.drag){const n=this.camera.position.clone().normalize(),lat=Math.asin(n.y)*180/Math.PI,lon=Math.atan2(-n.z,n.x)*180/Math.PI,s=Math.min(.18,(this.camera.position.length()-2)*.10);this.camera.position.copy(earthPoint(Math.max(-84,Math.min(84,lat+(e.clientY-this.drag.y)*s)),lon-(e.clientX-this.drag.x)*s,this.camera.position.length()));this.camera.lookAt(0,0,0);this.dirty=true;}this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};});
  const end=(e:PointerEvent)=>{this.pointers.delete(e.pointerId);this.drag=undefined;this.pinch=0;};c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);
  c.addEventListener('wheel',e=>{e.preventDefault();this.cancelFlight();this.zoomBy(Math.exp(e.deltaY*.001));},{passive:false});
 }
 private zoomBy(factor:number){this.camera.position.setLength(Math.max(CAMERA_FLOOR,Math.min(25,2+(this.camera.position.length()-2)*factor)));this.dirty=true;if(this.camera.position.length()<4)this.loadDetail();}
 private cancelFlight(){this.flight=undefined;this.autoRotate=false;this.userMoved=true;if(this.controls){this.controls.enabled=true;this.controls.autoRotate=false;}}
 setLayers(c:Set<string>){this.visibleCodes=c;this.placeLabels();}
 setRoutes(routes:Route[]){this.routes=routes;this.placeLabels();this.drawRoutes(performance.now());}
 show(v:boolean){this.visible=v;if(!v){this.flight=undefined;if(this.controls)this.controls.enabled=true;}else this.resize();}
 focus(mode:'world'|'turkey'|'airport',point?:Point){
  this.mode=mode;this.focusPoint=point||{lat:39,lon:34.55};this.userMoved=false;this.autoRotate=mode==='world';
  this.host.dataset.view=mode;const aspect=Math.max(.2,this.host.clientWidth/Math.max(1,this.host.clientHeight));
  const center=mode==='world'?{lat:26,lon:24}:this.focusPoint;
  const bounds=mode==='airport'?{west:center.lon-5,east:center.lon+5,north:center.lat+3,south:center.lat-3}:TURKEY_BOUNDS;
  const distance=mode==='world'?worldDistance(aspect):regionDistance(aspect,center,bounds);
  if(this.controls){this.controls.enabled=false;this.controls.autoRotate=false;this.controls.target.set(0,0,0);this.controls.enableDamping=false;this.controls.update();this.controls.enableDamping=true;}
  this.flight={start:this.camera.position.clone(),end:earthPoint(center.lat,center.lon,distance),time:performance.now()};
  if(mode!=='world')this.loadDetail();this.dirty=true;
 }
 private resize(){
  const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;const changed=w!==this.width||h!==this.height;this.width=w;this.height=h;
  this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  if(this.renderer)this.renderer.setSize(w,h,false);
  // The fallback shares the same camera and texture coordinates, with a bounded CPU canvas.
  const ratio=Math.min(1,1100/w,800/h);this.canvas.width=Math.round(w*ratio);this.canvas.height=Math.round(h*ratio);this.dirty=true;
  if(changed&&!this.userMoved){const center=this.mode==='world'?{lat:26,lon:24}:this.focusPoint,bounds=this.mode==='airport'?{west:center.lon-5,east:center.lon+5,north:center.lat+3,south:center.lat-3}:TURKEY_BOUNDS,d=this.mode==='world'?worldDistance(w/h):regionDistance(w/h,center,bounds);if(this.flight)this.flight.end=earthPoint(center.lat,center.lon,d);else{this.camera.position.copy(earthPoint(center.lat,center.lon,d));this.camera.lookAt(0,0,0);}}
  this.camera.updateMatrixWorld();this.placeLabels();
 }
 private project(p:Point){const v=earthPoint(p.lat,p.lon),ndc=v.clone().project(this.camera);return{x:(ndc.x+1)/2*this.width,y:(1-ndc.y)/2*this.height,visible:onVisibleHemisphere(v,this.camera.position)&&ndc.z<1&&Math.abs(ndc.x)<.98&&Math.abs(ndc.y)<.98};}
 private placeLabels(){
  if(!this.width)return;const boxes:{x:number;y:number;w:number;h:number}[]=[];const endCodes=new Set(this.routes.flatMap(r=>[r.from.code,r.to.code]));
  const ordered=[...this.points].sort((a,b)=>(b.code==='ADB'?10:endCodes.has(b.code)?8:!b.category||b.category==='airports'?5:0)-(a.code==='ADB'?10:endCodes.has(a.code)?8:!a.category||a.category==='airports'?5:0));
  for(const p of ordered){const b=this.labels.get(p.code)!,s=this.project(p);let show=s.visible&&(!this.visibleCodes||this.visibleCodes.has(p.code));if(this.mode==='world'&&this.camera.position.length()>4&&p.code!=='ADB'&&p.category!=='world')show=false;
   b.hidden=!show;if(!show)continue;const w=Math.max(32,this.short(p.code).length*(currentDevice().mobile?5.4:6)+18),h=currentDevice().mobile?30:25;
   const offsets=[[0,0],[0,-30],[0,30],[-w*.65,-22],[w*.65,22],[-w*.65,22],[w*.65,-22],[0,56],[0,-56]];
   const pos=offsets.map(([dx,dy])=>({x:s.x+dx-w/2,y:s.y+dy-h/2,w,h})).find(q=>q.x>4&&q.x+q.w<this.width-4&&q.y>55&&q.y+q.h<this.height-55&&!boxes.some(v=>q.x<v.x+v.w+4&&q.x+q.w+4>v.x&&q.y<v.y+v.h+3&&q.y+q.h+3>v.y));
   if(!pos){b.hidden=true;continue;}boxes.push(pos);b.style.left=`${pos.x+pos.w/2}px`;b.style.top=`${pos.y+pos.h/2}px`;b.style.setProperty('--pin-dx',`${s.x-(pos.x+pos.w/2)}px`);b.style.setProperty('--pin-dy',`${s.y-(pos.y+pos.h/2)}px`);b.dataset.offset=Math.hypot(s.x-pos.x-pos.w/2,s.y-pos.y-pos.h/2)>4?'true':'false';
  }
 }
 private drawRoutes(now:number){
  this.routeSvg.setAttribute('viewBox',`0 0 ${this.width} ${this.height}`);
  const routes=this.routes.map((r,i)=>{const a=this.project(r.from),b=this.project(r.to);if(!a.visible||!b.visible)return'';const x=(a.x+b.x)/2,y=(a.y+b.y)/2-Math.min(65,Math.max(45,Math.hypot(a.x-b.x,a.y-b.y)*.20)),t=((now/10000)+i*.07)%1,c=r.type==='sea'?'#76ddff':'#ffce79',px=(1-t)**2*a.x+2*(1-t)*t*x+t*t*b.x,py=(1-t)**2*a.y+2*(1-t)*t*y+t*t*b.y;return`<path d="M${a.x},${a.y}Q${x},${y} ${b.x},${b.y}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="${r.type==='sea'?'5 4':'0'}"/><circle cx="${px}" cy="${py}" r="3.5" fill="${c}"/>`;}).join('');
  const leaders=this.points.map(p=>{const b=this.labels.get(p.code)!;if(b.hidden||b.dataset.offset!=='true')return'';const s=this.project(p),x=parseFloat(b.style.left),y=parseFloat(b.style.top);return`<path d="M${s.x},${s.y}L${x},${y}" stroke="#dceffa" stroke-opacity=".6" stroke-width="1"/><circle cx="${s.x}" cy="${s.y}" r="2.2" fill="#dceffa"/>`;}).join('');
  this.routeSvg.innerHTML=leaders+routes;
 }
}
