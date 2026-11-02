import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {NathanActor,makeNathanPlaceholder,parseNathanAccessClips} from '../nathan-model';
import {NATHAN_MODEL_URL,NATHAN_PRESET} from '../nathan-data';
import {newEntity} from '../scene-data';
import {localToWorld} from '../facility-data';
import {Nathan2Motor,type V3,type LabSpeed,type MotorPose} from './engine';
import './style.css';

const el=(id:string)=>document.getElementById(id)!;
const canvas=el('scene') as HTMLCanvasElement;
const scene=new T.Scene();scene.background=new T.Color('#091922');scene.fog=new T.Fog('#091922',36,100);
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.55;
const camera=new T.PerspectiveCamera(53,1,.12,180);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.06;controls.maxDistance=95;controls.minDistance=3;
controls.maxPolarAngle=Math.PI*.49;
const hemi=new T.HemisphereLight(0xd7edff,0x1a3540,2.2);scene.add(hemi);
const sun=new T.DirectionalLight(0xffffff,2.25);sun.position.set(-15,22,9);scene.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(150,150),new T.MeshStandardMaterial({color:'#253e45',roughness:1}));
ground.rotation.x=-Math.PI/2;scene.add(ground);
const grid=new T.GridHelper(120,120,0x55818a,0x3a5961);grid.position.y=.004;scene.add(grid);

const tank=newEntity('TANK',0,0);
tank.facility={...tank.facility,stairs:true,stairStart:-105,stairSweep:535,clockwise:true,stairWidth:1.02,stairLandings:true,stairLandingLength:1.35};
const motor=new Nathan2Motor(tank);
const {layout}=motor.stairs;
const tankWall=new T.Mesh(new T.CylinderGeometry(tank.radius,tank.radius,tank.height,72),
  new T.MeshStandardMaterial({color:'#c6d0d0',metalness:.45,roughness:.55}));
tankWall.position.y=tank.height/2;scene.add(tankWall);
const rim=new T.Mesh(new T.TorusGeometry(tank.radius,.09,8,72),new T.MeshStandardMaterial({color:'#e8f2f3',metalness:.65,roughness:.3}));
rim.rotation.x=Math.PI/2;rim.position.y=tank.height+.15;scene.add(rim);
const roof=new T.Mesh(new T.CylinderGeometry(tank.radius-.08,tank.radius-.08,.10,72),new T.MeshStandardMaterial({color:'#93aeb7',roughness:.83}));
roof.position.y=tank.height+.27;scene.add(roof);
const stairMaterial=new T.MeshStandardMaterial({color:'#b8cad1',metalness:.48,roughness:.55});
const landingMat=new T.MeshStandardMaterial({color:'#e7c76c',metalness:.45,roughness:.56});
const railMaterial=new T.MeshStandardMaterial({color:'#f1d65d',metalness:.32,roughness:.55});
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
  scene.add(tread);
  if(i%5===0||p.landing){
   const y=p.y1+.55;
   const post=new T.Mesh(new T.CylinderGeometry(.025,.025,1.1,10),railMaterial);
   post.position.set(Math.sin(a)*outer,y,Math.cos(a)*outer);
   scene.add(post);
  }
 }
}
const railCurve=new T.CatmullRomCurve3(railPoints,false,'centripetal');
const handrail=new T.Mesh(new T.TubeGeometry(railCurve,railPoints.length*2,.031,8,false),railMaterial);
scene.add(handrail);
const entryLocal=layout.entry,firstLocal=layout.path[1];
const entryMid=[(entryLocal[0]+firstLocal[0])/2,entryLocal[1]-.04,(entryLocal[2]+firstLocal[2])/2] as V3;
const entry=v(entryLocal),first=v(firstLocal);const entryLen=entry.distanceTo(first);
const plate=new T.Mesh(new T.BoxGeometry(layout.width,.08,entryLen+.08),landingMat);
plate.position.fromArray(entryMid);
plate.rotation.y=Math.atan2(first.x-entry.x,first.z-entry.z);
scene.add(plate);
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
  if(placeholder)placeholder.visible=false;
  actor.motion('Idle');
  el('load-status').textContent=`Gerçek Nathan GLB yüklendi · ${actor.clips.length} animasyon`;
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-command]'))button.disabled=false;
 }catch(error){
  console.error('Nathan 2.0 laboratory model load',error);
  loadLabel.textContent='Model yüklenemedi; önce GitHub derlemesini kontrol edin.';
 }
}
void loadNathan();

function showPose(p:MotorPose){
 const names={ready:'Hazır',approach:'Yaklaşma',align:'Dönüş / hizalanma',
  'spiral-up':'Spiral çıkış — YÜRÜYÜŞ','spiral-down':'Spiral iniş — YÜRÜYÜŞ',roof:'Tank çatısında',ground:'Zeminde'};
 el('state').textContent=names[p.activity];
 el('status').textContent=p.message;
 el('progress').textContent=`%${Math.round(p.progress*100)}`;
 el('hand').textContent=p.outsideHand===undefined?'Geçiş':p.outsideHand===0?'SOL EL → dış korkuluk':'SAĞ EL → dış korkuluk';
 el('foot').textContent=p.plantedFoot===undefined?'Geçiş':p.plantedFoot===0?'SOL ayak basıyor':'SAĞ ayak basıyor';
 el('position').textContent=p.position.map(x=>x.toFixed(2)).join(' / ');
 el('speed-label').textContent=`${p.speed}× test hızı`;
}
function cameraPreset(which:'wide'|'side'){
 const point=which==='side'?new T.Vector3(-11,4,-13):new T.Vector3(16,14,19);
 controls.target.set(0,4.7,0);camera.position.copy(point);controls.update();
}
cameraPreset('wide');
document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(b=>{
 b.addEventListener('click',()=>{
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
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.speed)===speed)));
 });
});
el('debug-toggle').addEventListener('change',e=>{debug.visible=(e.target as HTMLInputElement).checked;});
el('view-wide').addEventListener('click',()=>cameraPreset('wide'));
el('view-side').addEventListener('click',()=>cameraPreset('side'));
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
let last=performance.now(),frames=0;
function frame(now:number){
 requestAnimationFrame(frame);
 const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
 const pose=motor.tick(dt);
 root.position.fromArray(pose.position);
 root.rotation.y=-T.MathUtils.degToRad(pose.heading);
 if(actor){
  actor.motion(pose.motion,pose.motionRate);
  actor.contact(pose.contact);
  actor.update(dt*pose.speed);
 }
 debug.visible=(el('debug-toggle') as HTMLInputElement).checked;
 for(let i=0;i<2;i++){
  const target=pose.contact?.feet[i];
  footTargets[i].visible=!!target;if(target)footTargets[i].position.fromArray(target);
 }
 const grip=pose.contact?.gripAim?.[0];handTarget.visible=!!grip;if(grip)handTarget.position.fromArray(grip);
 controls.update();renderer.render(scene,camera);
 if(++frames%12===0){
  showPose(pose);
  const errors=actor?.contactRig?.errors||[];
  const maximum=errors.length?Math.max(...errors):0;
  el('ik-error').textContent=actor?`${Math.round(maximum*1000)} mm`:'Model bekleniyor';
 }
}
requestAnimationFrame(frame);
