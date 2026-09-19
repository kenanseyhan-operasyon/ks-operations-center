import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-110m.json';
import './style.css';

type Lang = 'tr' | 'en';
type Airport = { code:string; city:string; cityEn:string; lat:number; lon:number; ready:'ready'|'design'|'info'; desc:string; descEn:string };

const airports: Airport[] = [
  {code:'ADB',city:'İzmir Adnan Menderes',cityEn:'İzmir Adnan Menderes',lat:38.2924,lon:27.1570,ready:'ready',desc:'Yakıt tesisi ve R14–38K çalışma alanı',descEn:'Fuel facility and R14–38K workspace'},
  {code:'BJV',city:'Milas–Bodrum',cityEn:'Milas–Bodrum',lat:37.2506,lon:27.6643,ready:'design',desc:'Tesis modeli hazırlanıyor',descEn:'Facility model in design'},
  {code:'DLM',city:'Dalaman',cityEn:'Dalaman',lat:36.7131,lon:28.7925,ready:'info',desc:'Meydan bilgi noktası',descEn:'Airport information point'},
  {code:'AYT',city:'Antalya',cityEn:'Antalya',lat:36.8987,lon:30.8005,ready:'info',desc:'Meydan bilgi noktası',descEn:'Airport information point'},
  {code:'GZP',city:'Gazipaşa',cityEn:'Gazipaşa',lat:36.2992,lon:32.3014,ready:'info',desc:'Meydan bilgi noktası',descEn:'Airport information point'},
  {code:'SAW',city:'Sabiha Gökçen',cityEn:'Sabiha Gökçen',lat:40.8986,lon:29.3092,ready:'info',desc:'Meydan bilgi noktası',descEn:'Airport information point'}
];

const copy = {
 tr:{nav:['Ana Sayfa','Hakkımda','Yetkinlikler','Projeler','Araştırma'],heroKicker:'HAVACILIK • DİJİTAL DÖNÜŞÜM • SİMÜLASYON',heroTitle:'Gerçek operasyon bilgisini etkileşimli 3D eğitime dönüştürüyorum.',heroText:'Havacılık yakıt tesisleri, ikmal araçları ve operasyon süreçleri için tarayıcı tabanlı tasarım, eğitim, tatbikat ve simülasyon platformu.',explore:'3D Dünyayı Keşfet',quick:'ADB Tesise Hızlı Gir',worldTitle:'Operasyon dünyası',worldText:'Küreyi döndürün, Türkiye üzerindeki bir meydanı seçin veya ADB çalışma alanına doğrudan geçin.',aboutTitle:'Saha deneyimi, akademik araştırma ve dijital üretim.',aboutText:'Kenan Seyhan; havacılık yakıt operasyonları, tesis süreçleri, stok yönetimi, kalite kontrol, uçak ikmali ve operasyonel emniyet alanlarında saha deneyimine sahip bir havacılık profesyonelidir. Ege Üniversitesi Üretim Teknolojisinde Dijitalleşme yüksek lisans programında çalışmalarını sürdürmektedir.',facility:'ADB ÇALIŞMA MERKEZİ',back:'Dünyaya Dön',continue:'Çalışmaya Devam Et',rightClick:'Sağ tık: hızlı menü • Çift tık: doğrudan ADB tesisi',modes:['İncele','Tasarla','3D Studio','Senaryo','Tatbikat','Operasyon'],modeDesc:['Nesneleri, sistemleri ve kontrol noktalarını etkileşimli inceleyin.','Tesisi ve ekipmanı ekleyin, taşıyın, döndürün ve sürümleyin.','Fotoğraf, video ve GLB varlıklarını üretim hattına alın.','Adımları, kuralları, arızaları ve başarı ölçütlerini oluşturun.','Yardım azaltılmış emniyet ve acil durum çalışmaları yürütün.','Dolumdan uçak ikmaline kadar gerçekçi akışı uygulayın.']},
 en:{nav:['Home','About','Expertise','Projects','Research'],heroKicker:'AVIATION • DIGITAL TRANSFORMATION • SIMULATION',heroTitle:'Transforming real operational expertise into interactive 3D training.',heroText:'A browser-based design, training, drill and simulation platform for aviation fuel facilities, refuelling vehicles and operational processes.',explore:'Explore 3D World',quick:'Quick Entry to ADB',worldTitle:'Operations world',worldText:'Rotate the globe, select an airport over Türkiye or jump directly to the ADB workspace.',aboutTitle:'Field experience, academic research and digital production.',aboutText:'Kenan Seyhan is an aviation professional with field experience in aviation fuel operations, facility processes, inventory control, quality control, aircraft refuelling and operational safety. He is pursuing a master’s degree in Digitalization in Production Technology at Ege University.',facility:'ADB WORKSPACE',back:'Back to World',continue:'Continue Working',rightClick:'Right click: quick menu • Double click: direct ADB entry',modes:['Inspect','Design','3D Studio','Scenario','Drill','Operation'],modeDesc:['Inspect objects, systems and control points interactively.','Add, move, rotate and version facilities and equipment.','Process photo, video and GLB assets through the production pipeline.','Create steps, rules, failures and success criteria.','Run safety and emergency exercises with reduced assistance.','Perform a realistic flow from loading to aircraft refuelling.']}
};

let lang:Lang = (localStorage.getItem('ks-lang') as Lang)||'tr';
let selected = airports[0];
let sceneMode:'home'|'world'|'facility' = 'home';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
 <header class="topbar"><a class="brand" href="#"><span>KS</span><b>AVIATION</b><small>DIGITAL TWIN</small></a><nav id="nav"></nav><div class="head-actions"><button id="langBtn" class="lang"></button><button class="login">PRIVATE ACCESS</button><button id="menuBtn" class="menu">☰</button></div></header>
 <main>
  <section id="home" class="home">
   <div class="hero-copy"><div class="eyebrow" id="heroKicker"></div><h1 id="heroTitle"></h1><p id="heroText"></p><div class="hero-actions"><button id="exploreBtn" class="primary"></button><button id="quickBtn" class="secondary"></button></div><div class="status-row"><span><i class="dot green"></i> ADB READY</span><span><i class="dot amber"></i> BJV IN DESIGN</span><span>38K R14 • V181 ASSET</span></div></div>
   <div class="globe-shell"><div id="globe"></div><div class="globe-hud"><span class="live">● LIVE SYSTEM</span><b>TÜRKİYE / 38.96°N</b><small id="rightClick"></small></div></div>
  </section>
  <section class="about"><div><span class="section-no">01 / PROFILE</span><h2 id="aboutTitle"></h2></div><p id="aboutText"></p><div class="skills"><span>AVIATION FUEL OPERATIONS</span><span>QUALITY CONTROL</span><span>3D SIMULATION</span><span>DIGITAL TRANSFORMATION</span><span>OPERATIONAL SAFETY</span><span>AI-ASSISTED TRAINING</span></div></section>
  <section id="worldPanel" class="world-panel"><div class="world-head"><div><span class="section-no">02 / 3D WORLD</span><h2 id="worldTitle"></h2><p id="worldText"></p></div><button id="worldQuick" class="primary"></button></div><div id="airportGrid" class="airport-grid"></div></section>
  <section id="facility" class="facility hidden"><div class="facility-top"><button id="backBtn" class="back">←</button><div><span>ADB • İZMİR</span><h2 id="facilityTitle"></h2></div><div class="facility-badge"><i></i> SYSTEM READY</div></div><div class="facility-stage"><div class="facility-grid"></div><div id="facility3d"></div><div id="modelStatus" class="model-status">R14 • 38K MODEL LOADING</div><div class="sim-controls"><button id="platformControl" disabled>PLATFORM ↑</button><button id="railControl" disabled>RAILING ↑</button></div><div class="stage-label">ADB FUEL FACILITY <b>01</b></div><div class="stage-help">DRAG TO ROTATE • WHEEL TO ZOOM</div></div><div id="modeGrid" class="mode-grid"></div></section>
 </main>
 <div id="airportCard" class="airport-card hidden"></div>
 <div id="contextMenu" class="context-menu hidden"></div>
`;

function t(){return copy[lang]}
function renderCopy(){
 document.documentElement.lang=lang;
 (document.querySelector('#nav') as HTMLElement).innerHTML=t().nav.map((n,i)=>`<a href="${i===0?'#home':i===1?'#about':'#worldPanel'}">${n}</a>`).join('');
 const ids=['heroKicker','heroTitle','heroText','exploreBtn','quickBtn','rightClick','aboutTitle','aboutText','worldTitle','worldText'];
 const vals=[t().heroKicker,t().heroTitle,t().heroText,t().explore,t().quick,t().rightClick,t().aboutTitle,t().aboutText,t().worldTitle,t().worldText];
 ids.forEach((id,i)=>document.getElementById(id)!.textContent=vals[i]);
 document.getElementById('worldQuick')!.textContent=t().quick;
 document.getElementById('facilityTitle')!.textContent=t().facility;
 document.getElementById('langBtn')!.textContent=lang==='tr'?'EN':'TR';
 renderAirports(); renderModes();
}

function renderAirports(){
 document.getElementById('airportGrid')!.innerHTML=airports.map(a=>`<button class="airport-tile ${a.ready}" data-code="${a.code}"><span>${a.code}</span><div><b>${lang==='tr'?a.city:a.cityEn}</b><small>${lang==='tr'?a.desc:a.descEn}</small></div><i>↗</i></button>`).join('');
 document.querySelectorAll<HTMLElement>('.airport-tile').forEach(el=>{el.onclick=()=>{selected=airports.find(a=>a.code===el.dataset.code)!;showAirportCard(selected)};el.ondblclick=()=>{if(el.dataset.code==='ADB')enterFacility()};el.oncontextmenu=e=>{e.preventDefault();selected=airports.find(a=>a.code===el.dataset.code)!;showContext(e.clientX,e.clientY)}})
}
function renderModes(){document.getElementById('modeGrid')!.innerHTML=t().modes.map((m,i)=>`<button class="mode-card" data-mode="${i}"><span>0${i+1}</span><b>${m}</b><p>${t().modeDesc[i]}</p><i>→</i></button>`).join('')}

function showAirportCard(a:Airport){
 const c=document.getElementById('airportCard')!;c.classList.remove('hidden');c.innerHTML=`<button class="x">×</button><span>${a.code} • TÜRKİYE</span><h3>${lang==='tr'?a.city:a.cityEn}</h3><p>${lang==='tr'?a.desc:a.descEn}</p><div class="card-actions"><button class="secondary">${lang==='tr'?'Meydanı İncele':'Inspect Airport'}</button>${a.code==='ADB'?`<button class="primary">${t().quick}</button>`:''}</div>`;
 c.querySelector('.x')!.addEventListener('click',()=>c.classList.add('hidden'));c.querySelector('.primary')?.addEventListener('click',enterFacility);
 focusAirport(a);
}
function showContext(x:number,y:number){const m=document.getElementById('contextMenu')!;m.style.left=x+'px';m.style.top=y+'px';m.classList.remove('hidden');m.innerHTML=`<b>${selected.code}</b><button>${t().continue}</button><button>${lang==='tr'?'Tasarım modunda aç':'Open in design mode'}</button><button>${lang==='tr'?'Senaryo oluştur':'Create scenario'}</button>`;m.querySelector('button')!.addEventListener('click',()=>{if(selected.code==='ADB')enterFacility()})}
function enterWorld(){sceneMode='world';document.getElementById('worldPanel')!.scrollIntoView({behavior:'smooth'});focusTurkey()}
function enterFacility(){sceneMode='facility';document.getElementById('airportCard')!.classList.add('hidden');document.getElementById('contextMenu')!.classList.add('hidden');document.getElementById('home')!.classList.add('compressed');document.querySelector('.about')!.classList.add('hidden');document.getElementById('worldPanel')!.classList.add('hidden');document.getElementById('facility')!.classList.remove('hidden');document.getElementById('facility')!.scrollIntoView({behavior:'smooth'});focusAirport(airports[0]);ensureFacilityScene()}
function leaveFacility(){sceneMode='world';document.getElementById('home')!.classList.remove('compressed');document.querySelector('.about')!.classList.remove('hidden');document.getElementById('worldPanel')!.classList.remove('hidden');document.getElementById('facility')!.classList.add('hidden');enterWorld()}

document.getElementById('langBtn')!.onclick=()=>{lang=lang==='tr'?'en':'tr';localStorage.setItem('ks-lang',lang);renderCopy()};
document.getElementById('exploreBtn')!.onclick=enterWorld;document.getElementById('quickBtn')!.onclick=enterFacility;document.getElementById('worldQuick')!.onclick=enterFacility;document.getElementById('backBtn')!.onclick=leaveFacility;
document.addEventListener('click',e=>{if(!(e.target as HTMLElement).closest('.context-menu'))document.getElementById('contextMenu')!.classList.add('hidden')});

// Lightweight Three.js globe — no Cesium, terrain, imagery token or blocking GIS startup.
const host=document.getElementById('globe')!;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(0,.4,6.5);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
const globeGroup=new THREE.Group();scene.add(globeGroup);
function createWorldTexture(){
 const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const ctx=canvas.getContext('2d')!;
 const ocean=ctx.createLinearGradient(0,0,0,canvas.height);ocean.addColorStop(0,'#0c3440');ocean.addColorStop(1,'#061d26');ctx.fillStyle=ocean;ctx.fillRect(0,0,canvas.width,canvas.height);
 const countries=feature(worldAtlas as never,(worldAtlas as any).objects.countries) as any;
 const line=(ring:number[][])=>{ctx.beginPath();ring.forEach(([lon,lat],i)=>{const x=(lon+180)/360*canvas.width,y=(90-lat)/180*canvas.height;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fill();ctx.stroke()};
 ctx.fillStyle='#2c756f';ctx.strokeStyle='#75c8b4';ctx.lineWidth=1.15;ctx.globalAlpha=.92;
 countries.features.forEach((f:any)=>{const g=f.geometry;if(g.type==='Polygon')g.coordinates.forEach(line);else if(g.type==='MultiPolygon')g.coordinates.forEach((p:number[][][])=>p.forEach(line))});
 ctx.globalAlpha=.2;ctx.strokeStyle='#8bf5df';ctx.lineWidth=1;for(let lon=0;lon<=canvas.width;lon+=canvas.width/12){ctx.beginPath();ctx.moveTo(lon,0);ctx.lineTo(lon,canvas.height);ctx.stroke()}for(let lat=0;lat<=canvas.height;lat+=canvas.height/6){ctx.beginPath();ctx.moveTo(0,lat);ctx.lineTo(canvas.width,lat);ctx.stroke()}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return texture;
}
const globe=new THREE.Mesh(new THREE.SphereGeometry(2,96,64),new THREE.MeshStandardMaterial({map:createWorldTexture(),roughness:.72,metalness:.05,emissive:0x041a21,emissiveIntensity:.32}));globeGroup.add(globe);
const wire=new THREE.Mesh(new THREE.SphereGeometry(2.012,48,32),new THREE.MeshBasicMaterial({color:0x2f7180,wireframe:true,transparent:true,opacity:.12}));globeGroup.add(wire);
const atmos=new THREE.Mesh(new THREE.SphereGeometry(2.1,64,48),new THREE.MeshBasicMaterial({color:0x58e6d5,transparent:true,opacity:.055,side:THREE.BackSide}));globeGroup.add(atmos);
scene.add(new THREE.HemisphereLight(0xbfffee,0x031014,1.6));const sun=new THREE.DirectionalLight(0xffffff,3.2);sun.position.set(-4,3,5);scene.add(sun);

function latLon(lat:number,lon:number,r=2.04){const phi=(90-lat)*Math.PI/180,theta=(lon+180)*Math.PI/180;return new THREE.Vector3(-r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta))}
const markers=new Map<string,THREE.Mesh>();
airports.forEach(a=>{const mat=new THREE.MeshBasicMaterial({color:a.ready==='ready'?0xb7ff3c:a.ready==='design'?0xffc34d:0x69d7ff});const m=new THREE.Mesh(new THREE.SphereGeometry(.035,16,12),mat);m.position.copy(latLon(a.lat,a.lon));m.userData=a;globeGroup.add(m);markers.set(a.code,m);const ring=new THREE.Mesh(new THREE.RingGeometry(.05,.073,24),new THREE.MeshBasicMaterial({color:mat.color,transparent:true,opacity:.55,side:THREE.DoubleSide}));ring.position.copy(m.position);ring.lookAt(new THREE.Vector3());globeGroup.add(ring)});
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=4;controls.maxDistance=8;controls.autoRotate=true;controls.autoRotateSpeed=.38;
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();renderer.domElement.addEventListener('click',e=>{const rect=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-rect.left)/rect.width*2-1;mouse.y=-(e.clientY-rect.top)/rect.height*2+1;ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects([...markers.values()])[0];if(hit){selected=hit.object.userData as Airport;showAirportCard(selected)}});renderer.domElement.addEventListener('dblclick',()=>enterFacility());renderer.domElement.addEventListener('contextmenu',e=>{e.preventDefault();selected=airports[0];showContext(e.clientX,e.clientY)});
function focusTurkey(){controls.autoRotate=false;globeGroup.rotation.set(.42,-.5,-.08);animateCamera(4.9)}
function focusAirport(a:Airport){controls.autoRotate=false;const p=latLon(a.lat,a.lon);const targetRotation=new THREE.Euler(.45,-.55,-.08);globeGroup.rotation.copy(targetRotation);animateCamera(a.code==='ADB'?4.35:4.8);void p}
function animateCamera(z:number){const start=camera.position.z,t0=performance.now();const run=(n:number)=>{const k=Math.min(1,(n-t0)/900),q=1-Math.pow(1-k,3);camera.position.z=start+(z-start)*q;if(k<1)requestAnimationFrame(run)};requestAnimationFrame(run)}
function resize(){const r=host.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(host);resize();
function loop(){requestAnimationFrame(loop);controls.update();globeGroup.rotation.y+=sceneMode==='home'?.00025:0;renderer.render(scene,camera)}loop();

let facilityReady=false;
let facilityMixer:THREE.AnimationMixer|undefined;
const facilityActions=new Map<string,THREE.AnimationAction>();
function bindAnimationButton(buttonId:string,clipName:string){const button=document.getElementById(buttonId) as HTMLButtonElement;button.disabled=false;button.onclick=()=>{const action=facilityActions.get(clipName);if(!action)return;const opening=button.dataset.open!=='true';action.enabled=true;action.paused=false;action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.timeScale=opening?1:-1;if(opening&&action.time>=action.getClip().duration-.02)action.time=0;if(!opening&&action.time<=.02)action.time=action.getClip().duration;action.play();button.dataset.open=String(opening);button.classList.toggle('active',opening);button.textContent=`${buttonId==='platformControl'?'PLATFORM':'RAILING'} ${opening?'↓':'↑'}`}}
async function ensureFacilityScene(){
 if(facilityReady)return;facilityReady=true;
 const fhost=document.getElementById('facility3d')!;const fscene=new THREE.Scene();
 const fcamera=new THREE.PerspectiveCamera(35,1,.05,100);fcamera.position.set(7,4.2,8.5);
 const frenderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});frenderer.setPixelRatio(Math.min(devicePixelRatio,1.6));frenderer.outputColorSpace=THREE.SRGBColorSpace;frenderer.shadowMap.enabled=true;fhost.appendChild(frenderer.domElement);
 const fcontrols=new OrbitControls(fcamera,frenderer.domElement);fcontrols.enableDamping=true;fcontrols.target.set(0,1,0);fcontrols.maxDistance=16;fcontrols.minDistance=4;
 fscene.add(new THREE.HemisphereLight(0xd8fff7,0x0b1518,2.1));const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(-5,8,7);key.castShadow=true;fscene.add(key);const rim=new THREE.DirectionalLight(0x71f3df,2);rim.position.set(7,3,-5);fscene.add(rim);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,20),new THREE.MeshStandardMaterial({color:0x17353b,roughness:.9,metalness:.08}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;fscene.add(ground);
 const grid=new THREE.GridHelper(30,30,0x477a7c,0x23484d);grid.position.y=.006;fscene.add(grid);
 const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
 new GLTFLoader().load('/models/refueller-38k-r14.glb',gltf=>{const model=gltf.scene;model.traverse(o=>{if((o as THREE.Mesh).isMesh){const mesh=o as THREE.Mesh;mesh.castShadow=true;mesh.receiveShadow=true}});const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=8.8/Math.max(size.x,size.z);model.scale.setScalar(scale);model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);fscene.add(model);facilityMixer=new THREE.AnimationMixer(model);gltf.animations.forEach(clip=>facilityActions.set(clip.name,facilityMixer!.clipAction(clip)));bindAnimationButton('platformControl','Platform_Raise_4s');bindAnimationButton('railControl','Tank_Railing_Raise');document.getElementById('modelStatus')!.textContent='R14 • 38K REFUELLER • GLB';},xhr=>{if(xhr.total){const pct=Math.round(xhr.loaded/xhr.total*100);document.getElementById('modelStatus')!.textContent=`R14 • 38K MODEL • ${pct}%`}},()=>{const status=document.getElementById('modelStatus')!;status.textContent=lang==='tr'?'MODEL YÜKLENEMEDİ • TEKRAR DENE':'MODEL FAILED • RETRY';status.classList.add('error')});
 const fresize=()=>{const r=fhost.getBoundingClientRect();if(!r.width||!r.height)return;frenderer.setSize(r.width,r.height,false);fcamera.aspect=r.width/r.height;fcamera.updateProjectionMatrix()};new ResizeObserver(fresize).observe(fhost);fresize();
 const clock=new THREE.Clock();const flooop=()=>{requestAnimationFrame(flooop);const delta=Math.min(clock.getDelta(),.05);if(sceneMode==='facility'){facilityMixer?.update(delta);fcontrols.update();frenderer.render(fscene,fcamera)}};flooop();
}
renderCopy();
