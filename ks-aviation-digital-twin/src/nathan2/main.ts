import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {NathanActor,makeNathanPlaceholder,parseNathanAccessClips} from '../nathan-model';
import {NATHAN_MODEL_URL,NATHAN_PRESET} from '../nathan-data';
import {newEntity} from '../scene-data';
import {localToWorld} from '../facility-data';
import {Nathan2Motor,type V3,type LabSpeed,type MotorPose} from './engine';
import {retargetCmu11319,retargetCmu8334Ascent,CMU_113_19_URL,CMU_83_34_URL,CMU_UP_NAME,CMU_DOWN_NAME,CMU_83_UP_NAME,NATHAN_RIG_PREFIX,type CmuStairCapture,type CmuStairAscent} from './cmu-mocap';
import {approvedExternalStairCapture} from './mocap-quality-gate';
import {applyLabAnimation,labMotionForPose} from './playback';
import {MIXAMO_MOTION_URL,parseMixamoMotions,type MixamoMotion} from './mixamo-mocap';
import {MixamoPreview} from './mixamo-preview';
import './style.css';

const el=(id:string)=>document.getElementById(id)!;
const canvas=el('scene') as HTMLCanvasElement;
const scene=new T.Scene();scene.background=new T.Color('#091922');scene.fog=new T.Fog('#091922',36,100);
const renderer=(()=>{
 try{return new T.WebGLRenderer({canvas,antialias:true,alpha:false});}
 catch(error){
  el('load-status').textContent='3D görüntüleme bu tarayıcıda açılamadı. Donanım hızlandırmasını etkinleştirip sayfayı yenileyin.';
  el('scene-telemetry').textContent='3D görüntüleme kullanılamıyor';
  el('status').textContent='WebGL desteği gerekli.';
  throw error;
 }
})();
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.55;
const camera=new T.PerspectiveCamera(53,1,.12,180);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.06;controls.maxDistance=95;controls.minDistance=1.8;
controls.maxPolarAngle=Math.PI*.49;
const hemi=new T.HemisphereLight(0xd7edff,0x1a3540,2.2);scene.add(hemi);
const sun=new T.DirectionalLight(0xffffff,2.25);sun.position.set(-15,22,9);scene.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(150,150),new T.MeshStandardMaterial({color:'#253e45',roughness:1}));
ground.rotation.x=-Math.PI/2;scene.add(ground);
const grid=new T.GridHelper(120,120,0x55818a,0x3a5961);grid.position.y=.004;scene.add(grid);
const spiralScene=new T.Group();scene.add(spiralScene);

const tank=newEntity('TANK',0,0);
tank.facility={...tank.facility,stairs:true,stairStart:-105,stairSweep:535,clockwise:true,stairWidth:1.02,stairLandings:true,stairLandingLength:1.35};
const motor=new Nathan2Motor(tank);
const {layout}=motor.stairs;
const tankWall=new T.Mesh(new T.CylinderGeometry(tank.radius,tank.radius,tank.height,72),
  new T.MeshStandardMaterial({color:'#c6d0d0',metalness:.45,roughness:.55}));
tankWall.position.y=tank.height/2;spiralScene.add(tankWall);
const rim=new T.Mesh(new T.TorusGeometry(tank.radius,.09,8,72),new T.MeshStandardMaterial({color:'#e8f2f3',metalness:.65,roughness:.3}));
rim.rotation.x=Math.PI/2;rim.position.y=tank.height+.15;spiralScene.add(rim);
const roof=new T.Mesh(new T.CylinderGeometry(tank.radius-.08,tank.radius-.08,.10,72),new T.MeshStandardMaterial({color:'#93aeb7',roughness:.83}));
roof.position.y=layout.height-.05;spiralScene.add(roof);
const stairMaterial=new T.MeshStandardMaterial({color:'#b8cad1',metalness:.48,roughness:.55});
const landingMat=new T.MeshStandardMaterial({color:'#e7c76c',metalness:.45,roughness:.56});
const railMaterial=new T.MeshStandardMaterial({color:'#f1d65d',metalness:.32,roughness:.55});
// Physical roof landing: the route crosses the gap between the outer stairs
// and roof. Its top must match the motor's exact support height.
const landing=layout.roofLanding;
const roofLanding=new T.Mesh(new T.BoxGeometry(landing.outer-landing.inner,.09,landing.depth),landingMat);
const landingRadius=(landing.outer+landing.inner)/2;
roofLanding.position.set(Math.sin(landing.angle)*landingRadius,landing.height-.045,Math.cos(landing.angle)*landingRadius);
roofLanding.rotation.y=landing.angle+Math.PI/2;spiralScene.add(roofLanding);
const rad=layout.radius,outer=rad+layout.width/2+.025;
const railPoints:T.Vector3[]=[];
for(let i=0;i<layout.pieces.length;i++){
 const p=layout.pieces[i];
 const n=Math.max(2,Math.ceil(Math.abs(p.b-p.a)*rad/.22));
 for(let j=0;j<=n;j++){
  const t=j/n,a=T.MathUtils.lerp(p.a,p.b,t);
  const y=T.MathUtils.lerp(p.y0,p.y1,t)+1.08;
  railPoints.push(new T.Vector3(Math.sin(a)*outer,y,Math.cos(a)*outer));
 }
 if(!p.roofLanding){
  const a=(p.a+p.b)/2;
  const tread=new T.Mesh(new T.BoxGeometry(layout.width,.09,Math.max(.13,Math.abs(p.b-p.a)*rad+.04)),p.landing?landingMat:stairMaterial);
  tread.position.set(Math.sin(a)*rad,p.y1-.045,Math.cos(a)*rad);
  tread.rotation.y=a+Math.PI/2;
  spiralScene.add(tread);
  if(i%5===0||p.landing){
   const y=p.y1+.55;
   const post=new T.Mesh(new T.CylinderGeometry(.025,.025,1.1,10),railMaterial);
   post.position.set(Math.sin(a)*outer,y,Math.cos(a)*outer);
   spiralScene.add(post);
  }
 }
}
// Adjacent pieces share an endpoint. Duplicate Catmull-Rom controls create
// tiny backtracking loops at landings and can reverse the grip tangent.
const cleanRailPoints=railPoints.filter((p,i)=>i===0||p.distanceToSquared(railPoints[i-1])>=1e-12);
const railCurve=new T.CatmullRomCurve3(cleanRailPoints,false,'centripetal');
railCurve.arcLengthDivisions=Math.max(200,cleanRailPoints.length*8);
const handrail=new T.Mesh(new T.TubeGeometry(railCurve,cleanRailPoints.length*2,.031,8,false),railMaterial);
spiralScene.add(handrail);
const entryLocal=layout.entry,firstLocal=layout.path[1];
const entryMid=[(entryLocal[0]+firstLocal[0])/2,entryLocal[1]-.04,(entryLocal[2]+firstLocal[2])/2] as V3;
const entry=v(entryLocal),first=v(firstLocal);const entryLen=entry.distanceTo(first);
const plate=new T.Mesh(new T.BoxGeometry(layout.width,.08,entryLen+.08),landingMat);
plate.position.fromArray(entryMid);
plate.rotation.y=Math.atan2(first.x-entry.x,first.z-entry.z);
spiralScene.add(plate);
function v(q:V3){return new T.Vector3(...q);}
// Test-only visual guides. They are not part of the actual facility scene.
const debug=new T.Group();scene.add(debug);
const footTargets=[0,1].map(i=>{
 const mesh=new T.Mesh(new T.SphereGeometry(.058,10,8),new T.MeshBasicMaterial({color:i===0?0x6dfce9:0xffaa6a,depthTest:false}));
 mesh.renderOrder=30;debug.add(mesh);return mesh;
});
const handTarget=new T.Mesh(new T.SphereGeometry(.073,12,10),new T.MeshBasicMaterial({color:0xedff65,depthTest:false}));
handTarget.renderOrder=30;debug.add(handTarget);
const trace=new T.Line(new T.BufferGeometry().setFromPoints(motor.stairs.points.map(p=>v(p))),new T.LineBasicMaterial({color:0x71dff4,transparent:true,opacity:.7}));
debug.add(trace);
let actor:NathanActor|undefined;
let preview:MixamoPreview|undefined;
let mixamoMotions:MixamoMotion[]=[];
let legacyLoading:Promise<void>|undefined;
let mocap:CmuStairCapture|undefined;
let normalAscent:CmuStairAscent|undefined;
let selectedMotion:'original'|'cmu'|'cmu83'='original';
let originalCycle=.9;
const motionLabel=()=>selectedMotion==='cmu83'?'CMU 83 çıkış / Nathan iniş':selectedMotion==='cmu'?'CMU 113 · Karşılaştırma':'Nathan · Önceki';
function selectMotion(which:'original'|'cmu'|'cmu83'){
 if(which==='cmu'&&!mocap)return;
 if(which==='cmu83'&&!normalAscent)return;
 selectedMotion=which;
 document.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.motion===which)));
 el('motion-source').textContent=motionLabel();
}
const person=newEntity(NATHAN_PRESET,motor.position[0],motor.position[2]);
const root=makeNathanPlaceholder(person);scene.add(root);
root.position.fromArray(motor.position);
root.rotation.y=-T.MathUtils.degToRad(motor.heading);
const placeholder=root.getObjectByName('NATHAN_LOADING_MARKER');
const loadLabel=el('load-status');
async function loadNathan(){
 try{
  loadLabel.textContent='Nathan GLB modeli yükleniyor…';
  const gltf=await new GLTFLoader().loadAsync(NATHAN_MODEL_URL);
  try{
   const response=await fetch('/models/personnel/nathan-access-animations.json');
   if(response.ok)gltf.animations.push(...parseNathanAccessClips(await response.json()));
  }catch{/* Spiral uses the original Walk; extra clips are optional in this isolated lab. */}
  actor=new NathanActor(root,gltf,person.height);
  // Calibrate animation cadence from the real rig's trimmed walking cycle;
  // the route always moves at normal stair speed unless test speed is selected.
  const walk=actor.clips.find(clip=>clip.name==='Nathan_Original_Walk');
  if(walk){originalCycle=walk.duration;motor.setWalkCycleSeconds(walk.duration);}
  if(placeholder)placeholder.visible=false;
  actor.motion('Idle');
  el('load-status').textContent=`Gerçek Nathan GLB yüklendi · ${actor.clips.length} animasyon`;
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-command]'))button.disabled=false;
  try{
   const response=await fetch(MIXAMO_MOTION_URL);
   if(!response.ok)throw Error('Mixamo HTTP '+response.status);
   mixamoMotions=parseMixamoMotions(await response.json());
   preview=new MixamoPreview(actor,scene);
   for(const button of document.querySelectorAll<HTMLButtonElement>('[data-mixamo]'))button.disabled=false;
   selectMixamo('walking');
   preview.pause();
   loadLabel.textContent=`Nathan ve gönderdiğin ${mixamoMotions.length} Mixamo hareketi hazır.`;
   el('mixamo-heading').textContent=`Gönderdiğin ${mixamoMotions.length} hareket`;
  }catch(error){
   console.error('Mixamo recordings could not be loaded',error);
   el('mixamo-info').textContent='Mixamo kayıtları yüklenemedi. Sayfayı yenileyerek tekrar deneyin.';
   loadLabel.textContent='Nathan hazır; Mixamo yüklemesi tamamlanamadı.';
  }
 }catch(error){
  console.error('Nathan 2.0 laboratory model load',error);
  loadLabel.textContent='Nathan modeli yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin.';
 }
}

// The earlier comparison remains available on demand. Its BVH conversion
// does not delay the user's already-baked Mixamo recordings.
function loadLegacyMotions(){
 if(legacyLoading||!actor)return legacyLoading;
 const currentActor=actor;
 legacyLoading=(async()=>{
  if(approvedExternalStairCapture('cmu83'))try{
   const response=await fetch(CMU_83_34_URL);
   if(!response.ok)throw Error('CMU 83 HTTP '+response.status);
   normalAscent=retargetCmu8334Ascent(currentActor,await response.text());
   if(!currentActor.addExternalMotion(normalAscent.ascent))throw Error('CMU 83 not installed');
   const button=document.querySelector<HTMLButtonElement>('[data-motion="cmu83"]');
   if(button){button.disabled=false;button.textContent='CMU 83 · Çıkış';}
  }catch(error){console.error('CMU 83 loading failed',error);}
  if(approvedExternalStairCapture('cmu113'))try{
   const response=await fetch(CMU_113_19_URL);
   if(!response.ok)throw Error('CMU 113 HTTP '+response.status);
   mocap=retargetCmu11319(currentActor,await response.text());
   if(!currentActor.addExternalMotion(mocap.ascent)||!currentActor.addExternalMotion(mocap.descent))throw Error('CMU 113 not installed');
   const button=document.querySelector<HTMLButtonElement>('[data-motion="cmu"]');
   if(button){button.disabled=false;button.textContent='CMU 113 · Karşılaştır';}
   // This optional comparison never changes the user's current selection.
  }catch(error){console.error('CMU 113 loading failed',error);}
  el('mocap-status').textContent=normalAscent
   ?'CMU 83 çıkış kaydı hazır. Bu seçenekte iniş Nathan yürüyüşüyle yapılır. Tek elle korkuluk tutuşu merdivene göre uyarlanır.'
   :'Nathan yürüyüşü hazır. CMU karşılaştırmaları duruş ve temas incelemesi tamamlandığında açılır.';
 })();
 return legacyLoading;
}
void loadNathan();

function selectMixamo(id:string){
 const recording=mixamoMotions.find(motion=>motion.id===id);
 if(!recording||!preview)return;
 motor.stop();
 spiralScene.visible=false;debug.visible=false;
 preview.select(recording);
 preview.setSpeed(motor.speed);
 const rail=el('rail-toggle') as HTMLInputElement;
 const onStairs=(recording.kind==='stairs'||recording.kind==='stairs-down')&&!recording.previewOnly;
 rail.disabled=!onStairs;
 preview.setRailGrip(onStairs&&rail.checked);
 document.querySelectorAll<HTMLButtonElement>('[data-mixamo]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mixamo===id)));
 document.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(button=>button.disabled=false);
 (el('mixamo-timeline') as HTMLInputElement).disabled=false;
 el('progress-title').textContent='Kayıt ilerlemesi';
 el('mixamo-info').textContent=`${recording.file} · ${recording.duration.toLocaleString('tr-TR',{maximumFractionDigits:2})} sn · ${recording.note||'Kayıt son karede durur.'}`;
 el('mixamo-info').classList.toggle('capture-warning',!!recording.previewOnly);
 el('rail-help').textContent=onStairs
  ?'Tutunmayı açıp kapatırken kayıt ve bacak pozu değişmez.'
  :recording.previewOnly?'Özgün kaydı incelemek için zaman çubuğunu kullan. Bu kayıtta korkuluk uyarlaması kapalı.'
  :recording.kind==='driving'?'Sürüş kaydı: koltukta oturuşu ve el-kol hareketlerini izle.'
  :'Korkuluk seçeneği iki merdiven çıkış kaydında kullanılabilir.';
 updateDescentTerrainControls();
 cameraPreset('follow');
}

function updateDescentTerrainControls(){
 const state=preview?.active?preview.snapshot():undefined;
 const visible=state?.motionId==='descending-stairs';
 el('descent-terrain-controls').hidden=!visible;
 if(!visible||!state)return;
 document.querySelectorAll<HTMLButtonElement>('[data-descent-terrain]').forEach(button=>
  button.setAttribute('aria-pressed',String(button.dataset.descentTerrain===state.descentTerrain)));
 el('descent-terrain-info').textContent=state.descentTerrain==='stairs'
  ?'Yüksek başlangıç platformu, aşağı basamaklar ve alt sahanlık. Zemin değişirken kaydın eklem hareketleri korunur.'
  :'Aynı kayıt düz zemin üzerinde. Bir karede DUR ile durdurup iki zemini karşılaştırabilirsin.';
}

function switchToSpiral(){
 if(preview?.active){
  preview.deactivate();motor.reset();
  root.position.fromArray(motor.position);root.rotation.y=-T.MathUtils.degToRad(motor.heading);
  document.querySelectorAll<HTMLButtonElement>('[data-mixamo]').forEach(button=>button.setAttribute('aria-pressed','false'));
  document.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(button=>button.disabled=true);
  (el('mixamo-timeline') as HTMLInputElement).disabled=true;
  (el('rail-toggle') as HTMLInputElement).disabled=true;
  cameraPreset('follow');
 }
 el('descent-terrain-controls').hidden=true;
 spiralScene.visible=true;
 el('progress-title').textContent='Merdiven ilerlemesi';
 void loadLegacyMotions();
}

function showPose(p:MotorPose){
 const names={ready:'Hazır',approach:'Yaklaşma',align:'Dönüş / hizalanma',
  'spiral-up':'Spiral çıkış — YÜRÜYÜŞ','spiral-down':'Spiral iniş — YÜRÜYÜŞ',roof:'Tank çatısında',ground:'Zeminde'};
 el('state').textContent=p.paused?'Duraklatıldı':names[p.activity];
 el('status').textContent=p.message;
 el('progress').textContent=`%${Math.round(p.progress*100)}`;
 el('hand').textContent=p.outsideHand===undefined?'Geçiş':p.outsideHand===0?'SOL EL → dış korkuluk':'SAĞ EL → dış korkuluk';
 el('foot').textContent=p.plantedFoot===undefined?'Geçiş':p.plantedFoot===0?'SOL ayak basıyor':'SAĞ ayak basıyor';
 el('position').textContent=p.position.map(x=>x.toFixed(2)).join(' / ');
 el('speed-label').textContent=`${p.speed}× test hızı`;
 el('motion-source').textContent=motionLabel();
 el('scene-telemetry').textContent=`${motionLabel()} · ${p.paused?'Duraklatıldı':names[p.activity]} · ${Math.round(p.progress*100)}% · ${p.position[1].toFixed(2)} m · ${p.speed}×`;
}

function showPreview(){
 if(!preview?.active)return;
 const p=preview.snapshot();
 const state=p.finished?'Kayıt tamamlandı':p.paused?'Duraklatıldı':'Oynatılıyor';
 el('state').textContent=state;
 el('status').textContent=p.finished?'Son kare korunuyor. Tekrar ile baştan izle.':p.paused?'Poza bakabilir veya zaman çubuğuyla başka bir kare seçebilirsin.':p.gripEnabled?'Tek el tutuşu açık; bacaklar kayıttaki hareketi oynatıyor.':'Gönderdiğin kaydın hareketi oynatılıyor.';
 el('motion-source').textContent=p.label;
 el('progress').textContent=`%${Math.round(p.progress*100)}`;
 el('hand').textContent=p.gripActive?'SAĞ EL → korkuluk':p.gripEnabled?'Tutuşa geçiyor':'Serbest';
 el('foot').textContent='Mixamo kaydı';
 el('ik-error').textContent=p.gripActive?`${Math.round(p.gripError*1000)} mm`:'–';
 el('position').textContent=p.position.map(x=>x.toFixed(2)).join(' / ');
 el('speed-label').textContent=`${p.speed}×`;
 const time=(seconds:number)=>seconds.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
 el('mixamo-time').textContent=`${time(p.elapsed)} / ${time(p.duration)} sn`;
 (el('mixamo-timeline') as HTMLInputElement).value=String(Math.round(p.progress*1000));
 el('scene-telemetry').textContent=`${p.label} · ${state} · ${Math.round(p.progress*100)}% · ${p.speed}×`;
 const resume=document.querySelector<HTMLButtonElement>('[data-preview="resume"]')!;
 resume.textContent=p.finished?'Baştan oynat':p.paused&&p.elapsed>0?'Devam':'Oynat';
}

let cameraMode:'wide'|'side'|'follow'|'custom'='follow';
function followCamera(immediate=false){
 if(preview?.active){
  const centre=v(preview.snapshot().cameraTarget);
  const point=centre.clone().add(new T.Vector3(2.8,1.0,-2.6));
  controls.target.lerp(centre,immediate?1:.18);camera.position.lerp(point,immediate?1:.18);
  return;
 }
 const centre=v(motor.position).add(new T.Vector3(0,.95,0));
 const outward=v(motor.position).setY(0).normalize();
 const tangent=new T.Vector3(outward.z,0,-outward.x);
 const point=centre.clone().addScaledVector(outward,3.2).addScaledVector(tangent,2.0).add(new T.Vector3(0,.65,0));
 controls.target.lerp(centre,immediate?1:.18);camera.position.lerp(point,immediate?1:.18);
}
function cameraPreset(which:'wide'|'side'|'follow'){
 cameraMode=which;
 if(which==='follow'){followCamera(true);controls.update();return;}
 if(preview?.active){
  const target=v(preview.snapshot().cameraTarget);
  camera.position.copy(target).add(which==='side'?new T.Vector3(4,.25,0):new T.Vector3(4,2.5,5));
  controls.target.copy(target);controls.update();return;
 }
 const point=which==='side'?new T.Vector3(-11,4,-13):new T.Vector3(16,14,19);
 controls.target.set(0,4.7,0);camera.position.copy(point);controls.update();
}
cameraPreset('follow');
controls.addEventListener('start',()=>{cameraMode='custom';});
document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(b=>{
 b.addEventListener('click',()=>{
  switchToSpiral();
  const command=b.dataset.command;
  if(command==='up')motor.up();
  if(command==='down')motor.down();
  if(command==='stop')motor.stop();
  if(command==='reset')motor.reset();
 });
});
document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b=>{
 b.addEventListener('click',()=>{
  const speed=Number(b.dataset.speed) as LabSpeed;
  motor.setSpeed(speed);
  preview?.setSpeed(speed);
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.speed)===speed)));
 });
});
document.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(btn=>{
 btn.addEventListener('click',()=>{switchToSpiral();selectMotion(btn.dataset.motion as 'original'|'cmu'|'cmu83');});
});
document.querySelectorAll<HTMLButtonElement>('[data-mixamo]').forEach(button=>{
 button.addEventListener('click',()=>selectMixamo(button.dataset.mixamo!));
});
document.querySelectorAll<HTMLButtonElement>('[data-descent-terrain]').forEach(button=>{
 button.addEventListener('click',()=>{
  if(!preview?.active)return;
  preview.setDescentTerrain(button.dataset.descentTerrain as 'stairs'|'level');
  updateDescentTerrainControls();cameraPreset('follow');showPreview();
 });
});
document.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(button=>{
 button.addEventListener('click',()=>{
  if(!preview?.active)return;
  if(button.dataset.preview==='pause')preview.pause();
  if(button.dataset.preview==='resume')preview.resume();
  if(button.dataset.preview==='replay'){preview.replay();cameraPreset('follow');}
  showPreview();
 });
});
el('rail-toggle').addEventListener('change',event=>{
 preview?.setRailGrip((event.target as HTMLInputElement).checked);showPreview();
});
el('mixamo-timeline').addEventListener('input',event=>{
 if(!preview?.active)return;
 preview.seek(Number((event.target as HTMLInputElement).value)/1000*preview.snapshot().duration);showPreview();
});
el('spiral-controls').addEventListener('toggle',()=>{
 if((el('spiral-controls') as HTMLDetailsElement).open)void loadLegacyMotions();
});
el('debug-toggle').addEventListener('change',e=>{debug.visible=(e.target as HTMLInputElement).checked;});
el('view-wide').addEventListener('click',()=>cameraPreset('wide'));
el('view-side').addEventListener('click',()=>cameraPreset('side'));
el('view-follow').addEventListener('click',()=>cameraPreset('follow'));
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
let last=performance.now(),frames=0;
function frame(now:number){
 requestAnimationFrame(frame);
 const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
 if(preview?.active){
  preview.tick(dt);
  debug.visible=false;
  if(cameraMode==='follow')followCamera();
  controls.update();renderer.render(scene,camera);
  if(++frames%6===0){showPreview();showPosture();}
  return;
 }
 // Small simulation steps keep 4x preview within NathanActor's update limit.
 // Clip rate also follows actual travelled distance through easing/turns.
 const steps=Math.max(1,Math.ceil(dt*motor.speed/.04)),subdt=dt/steps;
 let pose!:MotorPose;
 for(let i=0;i<steps;i++){
  const down=motor.activity==='spiral-down';
  const onStairs=motor.distance>=motor.stairs.lengths[2];
  const external=onStairs?(selectedMotion==='cmu'&&mocap?(down?mocap.descent:mocap.ascent):
   selectedMotion==='cmu83'&&normalAscent&&!down?normalAscent.ascent:undefined):undefined;
  motor.setWalkCycleSeconds(external?external.duration:originalCycle);
  pose=motor.tick(subdt);
  root.position.fromArray(pose.position);root.rotation.y=-T.MathUtils.degToRad(pose.heading);
  if(actor&&!pose.paused){
   const clip=labMotionForPose(pose,motor.distance,motor.stairs.lengths[2],selectedMotion,{cmu83:!!normalAscent,cmu:!!mocap});
   applyLabAnimation(actor,pose,clip,motor.distance,motor.stairs.total,tank.scale,subdt*pose.speed);
  }
 }
 debug.visible=(el('debug-toggle') as HTMLInputElement).checked;
 for(let i=0;i<2;i++){
  const target=pose.contact?.feet[i];
  footTargets[i].visible=!!target;if(target)footTargets[i].position.fromArray(target);
 }
 const grip=pose.contact?.gripAim?.[0];handTarget.visible=!!grip;if(grip)handTarget.position.fromArray(grip);
 if(cameraMode==='follow')followCamera();
 controls.update();renderer.render(scene,camera);
 if(++frames%12===0){
  showPose(pose);
  const errors=actor?.contactRig?.errors||[];
  const maximum=errors.length?Math.max(...errors):0;
  el('ik-error').textContent=actor?`${Math.round(maximum*1000)} mm`:'Model bekleniyor';
  showPosture();
 }
}
function showPosture(){
  const hip=actor?.model.getObjectByName(NATHAN_RIG_PREFIX+'hip');
  const neck=actor?.model.getObjectByName(NATHAN_RIG_PREFIX+'neck');
  if(hip&&neck){
   const axis=neck.getWorldPosition(new T.Vector3()).sub(hip.getWorldPosition(new T.Vector3())).normalize();
   el('posture').textContent=`${T.MathUtils.radToDeg(Math.acos(T.MathUtils.clamp(axis.y,-1,1))).toFixed(1)}°`;
  }
}
requestAnimationFrame(frame);
