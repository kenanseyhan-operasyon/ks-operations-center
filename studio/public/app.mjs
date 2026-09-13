import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {bakeStaticScene,disposeModel,ModelHistory,splitFaces,buildWeldMap,sculpt,facesInBrush,selectionGeometry,checkGLB} from './geometry.mjs';
const $=id=>document.getElementById(id);
const canvas=$('canvas'),wrap=$('canvas-wrap');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});}
catch{status('Bu tarayıcıda WebGL başlatılamadı. Donanım hızlandırmasını etkinleştirip tekrar aç.',true);throw new Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.001,100000);
camera.position.set(4,3,5);
const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environmentTarget=pmrem.fromScene(environment,.04);
scene.environment=environmentTarget.texture;environment.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xe9faff,0x303d25,2));
const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,8,5);scene.add(light);
const orbit=new OrbitControls(camera,canvas);orbit.enableDamping=true;orbit.target.set(0,0,0);orbit.update();
const transform=new TransformControls(camera,canvas);transform.setSize(.8);scene.add(transform.getHelper());
let grid=new THREE.GridHelper(10,20,0x52644b,0x344044);grid.material.transparent=true;grid.material.opacity=.5;scene.add(grid);
let root=new THREE.Group();scene.add(root);
let selected=null,selection=new Set(),selectionOverlay=null,weldMap=null,tool='select',dirty=false,modelName='ks-ekipman',modelSize=2,photo=null,previewURL=null,jobId=null,stroke=false,strokeChanged=false,down=null,lastPaint=0;
const history=new ModelHistory(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let box=null;
const brush=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({color:0xbbf25a,wireframe:true,transparent:true,opacity:.45,depthTest:false}));brush.visible=false;scene.add(brush);
const loader=new GLTFLoader(),draco=new DRACOLoader().setDecoderPath('/vendor/examples/jsm/libs/draco/gltf/');loader.setDRACOLoader(draco);loader.setMeshoptDecoder(MeshoptDecoder);
const exporter=new GLTFExporter();
const resize=new ResizeObserver(()=>{const w=wrap.clientWidth,h=wrap.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(wrap);
function render(){requestAnimationFrame(render);orbit.update();if(box&&selected)box.update();if(selectionOverlay&&selected){selected.updateMatrixWorld(true);selectionOverlay.matrix.copy(selected.matrixWorld);}renderer.render(scene,camera);}render();
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function setBusy(message){$('busy').hidden=!message;$('busy-text').textContent=message||'';}
function markDirty(){dirty=true;$('dirty').textContent='Kaydedilmemiş değişiklikler var';updateHistory();}
function updateHistory(){$('undo').disabled=!history.undoStack.length;$('redo').disabled=!history.redoStack.length;$('download').disabled=!root.children.length;}
function checkpoint(){history.push(root);updateHistory();}
function clearPaint(){
  selection=new Set();
  if(selectionOverlay){scene.remove(selectionOverlay);selectionOverlay.geometry.dispose();selectionOverlay.material.dispose();selectionOverlay=null;}
  $('split').disabled=true;$('clear-paint').disabled=true;
}
function paintOverlay(){
  if(selectionOverlay){scene.remove(selectionOverlay);selectionOverlay.geometry.dispose();selectionOverlay.material.dispose();selectionOverlay=null;}
  if(selected&&selection.size){
    selectionOverlay=new THREE.Mesh(selectionGeometry(selected,selection),new THREE.MeshBasicMaterial({color:0xbbf25a,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    selectionOverlay.matrixAutoUpdate=false;selected.updateMatrixWorld(true);selectionOverlay.matrix.copy(selected.matrixWorld);scene.add(selectionOverlay);
  }
  $('split').disabled=!selection.size;$('clear-paint').disabled=!selection.size;
}
function select(mesh){
  clearPaint();weldMap=null;selected=mesh;
  transform.detach();if(box){scene.remove(box);box.geometry.dispose();box.material.dispose();box=null;}
  if(selected){box=new THREE.BoxHelper(selected,0xbbf25a);scene.add(box);if(['translate','rotate','scale'].includes(tool)){transform.setMode(tool);transform.attach(selected);}}
  $('part-name').disabled=!mesh;$('part-name').value=mesh?.name||'';
  ['duplicate','delete','part-color'].forEach(id=>$(id).disabled=!mesh);
  if(mesh){const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;if(material.color)$('part-color').value='#'+material.color.getHexString();}
  updateFields();updateParts();
}
function updateParts(){
  $('parts').replaceChildren();
  if(!root.children.length){const p=document.createElement('p');p.className='muted';p.textContent='Henüz model yok.';$('parts').append(p);}
  root.children.forEach(mesh=>{const b=document.createElement('button');b.textContent=mesh.name;b.setAttribute('role','option');b.setAttribute('aria-selected',String(mesh===selected));b.classList.toggle('selected',mesh===selected);b.onclick=()=>{select(mesh);status(mesh.name+' seçildi.');};$('parts').append(b);});
  $('part-count').textContent=root.children.length;
  let triangles=0;root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
  $('model-stats').textContent=root.children.length?root.children.length+' parça · '+Math.round(triangles).toLocaleString('tr-TR')+' yüzey':'Model bekleniyor';
  $('empty').hidden=!!root.children.length;$('download').disabled=!root.children.length;
}
for(const [key,title,step]of [['position','Konum (model birimi)',.01],['rotation','Açı (derece)',1],['scale','Ölçek',.01]]){
  const group=document.createElement('div');group.className='transform-group';const label=document.createElement('span');label.textContent=title;group.append(label);const row=document.createElement('div');row.className='transform-row';
  for(const axis of ['x','y','z']){
    const l=document.createElement('label');l.textContent=axis.toUpperCase();const input=document.createElement('input');input.type='number';input.step=step;input.id=key+'-'+axis;input.disabled=true;input.setAttribute('aria-label',title+' '+axis.toUpperCase());l.append(input);row.append(l);
    input.addEventListener('change',()=>{
      if(!selected)return;const n=Number(input.value);
      if(!Number.isFinite(n)||Math.abs(n)>1e6||(key==='scale'&&n<=.0001)){updateFields();status('Geçerli bir değer gir. Ölçek sıfırdan büyük olmalı.',true);return;}
      checkpoint();selected[key][axis]=key==='rotation'?THREE.MathUtils.degToRad(n):n;selected.updateMatrixWorld(true);markDirty();updateFields();
    });
  }
  group.append(row);$('transform-fields').append(group);
}
function updateFields(){for(const k of ['position','rotation','scale'])for(const a of ['x','y','z']){const input=$(k+'-'+a);input.disabled=!selected;input.value=selected?Number((k==='rotation'?THREE.MathUtils.radToDeg(selected[k][a]):selected[k][a]).toFixed(4)):'';}}
function setTool(next){
  tool=next;transform.detach();
  document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  $('brush-settings').hidden=!['grow','shrink','smooth','paint'].includes(tool);brush.visible=false;
  if(selected&&['translate','rotate','scale'].includes(tool)){transform.setMode(tool);transform.attach(selected);}
  status(({select:'Parçaya tıkla. Boş alanda sürükleyerek görünümü döndür.',translate:'Parçayı renkli oklarla taşı.',rotate:'Parçayı halkalardan döndür.',scale:'Parçayı tutamaçlardan ölçekle.',grow:'Yüzeyin üzerinde sürükleyerek dışarı doğru şekillendir.',shrink:'Yüzeyin üzerinde sürükleyerek içeri doğru düzelt.',smooth:'Yüzeyin üzerinde sürükleyerek yumuşat.',paint:'Ayıracağın bölümü boya. Shift ile boyamayı sil.'})[tool]);
}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
transform.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value;if(!e.value){markDirty();updateFields();}});
transform.addEventListener('mouseDown',()=>{if(selected){checkpoint();down=null;}});
transform.addEventListener('objectChange',()=>{updateFields();if(selected&&['x','y','z'].some(a=>selected.scale[a]<.0001)){selected.scale.max(new THREE.Vector3(.0001,.0001,.0001));}});
function fit(direction){
  if(!root.children.length)return;
  root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  modelSize=Math.max(size.length(),.01);
  let dir=direction||camera.position.clone().sub(orbit.target).normalize();
  if(!dir.lengthSq())dir=new THREE.Vector3(1,.6,1).normalize();
  const distance=modelSize/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*Math.max(1,1/camera.aspect)*1.2;
  camera.position.copy(center).addScaledVector(dir,distance);camera.near=Math.max(modelSize/10000,.00001);camera.far=Math.max(modelSize*1000,1000);camera.updateProjectionMatrix();
  orbit.target.copy(center);orbit.minDistance=modelSize/1000;orbit.maxDistance=modelSize*100;orbit.update();
  scene.remove(grid);grid.geometry.dispose();grid.material.dispose();grid=new THREE.GridHelper(modelSize*2,20,0x566a4a,0x354146);grid.position.set(center.x,bounds.min.y-modelSize*.005,center.z);grid.material.transparent=true;grid.material.opacity=.4;scene.add(grid);
}
$('fit').onclick=()=>fit();
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>fit(({front:new THREE.Vector3(0,0,1),side:new THREE.Vector3(1,0,0),top:new THREE.Vector3(0,1,.00001)})[b.dataset.view]));
function hit(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(root.children,false)[0];}
function brushRadius(){return Math.max(modelSize*.001,modelSize*Number($('radius').value)/200);}
function brushAt(e,apply=false){
  const h=hit(e);if(!h){brush.visible=false;return;}
  if(selected!==h.object&&apply)select(h.object);
  const radius=brushRadius();brush.visible=true;brush.position.copy(h.point);brush.scale.setScalar(radius);
  if(!apply||!selected||h.object!==selected)return;
  if(tool==='paint'){
    const faces=facesInBrush(selected,h.point,radius);if(!faces.length&&h.faceIndex!==undefined)faces.push(h.faceIndex);
    for(const face of faces)e.shiftKey?selection.delete(face):selection.add(face);paintOverlay();
  }else{
    weldMap=weldMap||buildWeldMap(selected.geometry);
    if(sculpt(selected,h.point,radius,Number($('strength').value)/100,tool,weldMap)){strokeChanged=true;markDirty();}
  }
}
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  if(['grow','shrink','smooth','paint'].includes(tool)&&hit(e)){
    e.preventDefault();e.stopImmediatePropagation();canvas.setPointerCapture(e.pointerId);stroke=true;strokeChanged=false;orbit.enabled=false;
    const h=hit(e);if(selected!==h.object)select(h.object);
    if(tool!=='paint')checkpoint();brushAt(e,true);return;
  }
  down={x:e.clientX,y:e.clientY,gizmo:!!transform.axis};
},true);
canvas.addEventListener('pointermove',e=>{
  if(!['grow','shrink','smooth','paint'].includes(tool))return;
  if(stroke){e.preventDefault();e.stopImmediatePropagation();if(performance.now()-lastPaint<30)return;lastPaint=performance.now();}
  brushAt(e,stroke);
},true);
canvas.addEventListener('pointerup',e=>{
  if(stroke){e.stopImmediatePropagation();stroke=false;orbit.enabled=true;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(strokeChanged){markDirty();updateParts();}return;}
  if(down&&!down.gizmo&&!transform.dragging&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5){const h=hit(e);select(h?.object||null);}
  down=null;
},true);
canvas.addEventListener('pointercancel',()=>{stroke=false;orbit.enabled=true;down=null;});
canvas.addEventListener('pointerleave',()=>{if(!stroke)brush.visible=false;});
$('radius').oninput=()=>{$('radius-value').value=$('radius').value+'%';};
$('strength').oninput=()=>{$('strength-value').value=$('strength').value+'%';};
$('clear-paint').onclick=clearPaint;
$('split').onclick=()=>{
  if(!selected||!selection.size)return;
  const total=selected.geometry.attributes.position.count/3;
  if(selection.size>=total){status('Parçanın yalnızca ayırmak istediğin bölümünü boya.',true);return;}
  try{checkpoint();const mesh=splitFaces(selected,selection);root.add(mesh);select(mesh);markDirty();setTool('translate');status('Boyalı yüzey ayrı bir parça oldu. Şimdi taşıyabilir veya döndürebilirsin.');}catch(e){status(e.message,true);}
};
$('part-name').onchange=()=>{if(selected&&$('part-name').value.trim()){checkpoint();selected.name=$('part-name').value.trim();updateParts();markDirty();}};
$('part-color').onchange=()=>{if(!selected)return;checkpoint();for(const m of Array.isArray(selected.material)?selected.material:[selected.material])if(m.color)m.color.set($('part-color').value);markDirty();};
$('delete').onclick=()=>{if(!selected)return;checkpoint();const old=selected;root.remove(old);select(null);disposeModel(old);markDirty();updateParts();};
$('duplicate').onclick=()=>{if(!selected)return;checkpoint();const mesh=selected.clone();mesh.geometry=selected.geometry.clone();mesh.material=Array.isArray(selected.material)?selected.material.map(m=>m.clone()):selected.material.clone();mesh.name=selected.name+' — kopya';mesh.position.x+=modelSize*.08;root.add(mesh);select(mesh);markDirty();};
function restore(next){if(!next)return;select(null);scene.remove(root);disposeModel(root);root=next;scene.add(root);updateParts();updateHistory();applyWireframe();markDirty();}
$('undo').onclick=()=>restore(history.undo(root));$('redo').onclick=()=>restore(history.redo(root));
function applyWireframe(){root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.wireframe=$('wireframe').checked;});}
$('wireframe').onchange=applyWireframe;
async function loadBuffer(buffer,name){
  checkGLB(buffer);
  setBusy('GLB açılıyor…');
  try{
    const gltf=await loader.parseAsync(buffer,'');const next=bakeStaticScene(gltf.scene);disposeModel(gltf.scene);
    select(null);history.clear();scene.remove(root);disposeModel(root,{textures:true});root=next;scene.add(root);modelName=(name||'ks-ekipman').replace(/\.glb$/i,'').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,80)||'ks-ekipman';
    dirty=false;$('dirty').textContent='Model açıldı';updateParts();updateHistory();fit();applyWireframe();status('Model hazır. Bir parça seçerek düzenlemeye başla.');
  }finally{setBusy(null);}
}
async function chooseGLB(file){
  if(!file)return;
  if(!/\.glb$/i.test(file.name)||file.size>50*1024*1024){status('En fazla 50 MB geçerli bir GLB dosyası seç.',true);return;}
  if(dirty&&!confirm('Kaydedilmemiş düzenlemeler kapanacak. Yeni modeli açmak istiyor musun?'))return;
  try{await loadBuffer(await file.arrayBuffer(),file.name);}catch(e){status(e.message,true);}
}
$('glb').onchange=async e=>{const file=e.target.files[0];e.target.value='';await chooseGLB(file);};
$('download').onclick=async()=>{
  if(!root.children.length)return;setBusy('GLB hazırlanıyor…');
  try{
    const buffer=await exporter.parseAsync(root,{binary:true,onlyVisible:true,trs:true,maxTextureSize:4096});checkGLB(buffer);
    const url=URL.createObjectURL(new Blob([buffer],{type:'model/gltf-binary'})),a=document.createElement('a');a.href=url;a.download=modelName+'-duzeltilmis.glb';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    dirty=false;$('dirty').textContent='GLB indirmesi başlatıldı';status('Düzeltilmiş model GLB olarak indiriliyor.');
  }catch(e){status('GLB dışa aktarılamadı: '+e.message,true);}finally{setBusy(null);}
};
let engineConnected=false;
function updateGenerate(){$('generate').disabled=!engineConnected||!photo||!$('photo-consent').checked||!!jobId;}
function choosePhoto(file){
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){status('En fazla 8 MB PNG, JPG veya WebP seç.',true);return;}
  if(previewURL)URL.revokeObjectURL(previewURL);photo=file;previewURL=URL.createObjectURL(file);$('photo-preview').src=previewURL;$('photo-preview').hidden=false;$('photo-name').textContent=file.name;updateGenerate();status('Fotoğraf hazır. Onay kutusunu işaretleyip üretimi başlatabilirsin.');
}
$('photo').onchange=e=>{const file=e.target.files[0];e.target.value='';choosePhoto(file);};
function enableDrop(id,accept){
  const target=$(id);
  for(const event of ['dragenter','dragover'])target.addEventListener(event,e=>{e.preventDefault();e.stopPropagation();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';target.classList.add('drag-over');});
  for(const event of ['dragleave','drop'])target.addEventListener(event,e=>{e.preventDefault();e.stopPropagation();target.classList.remove('drag-over');});
  target.addEventListener('drop',e=>{const files=[...(e.dataTransfer?.files||[])];if(files.length!==1){status('Lütfen tek bir dosya sürükle.',true);return;}accept(files[0]);});
}
enableDrop('photo-drop',choosePhoto);
enableDrop('glb-drop',chooseGLB);
$('photo-consent').onchange=updateGenerate;
async function api(url,options){
  const r=await fetch(url,options);
  if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||(r.status===401?'Oturum sona erdi. Önce GLB indir, ardından tekrar giriş yap.':'İşlem tamamlanamadı.'));}
  return r;
}
function showEngine(data){
  engineConnected=data.connected;
  $('engine-status').textContent=engineConnected?'Hesabın bağlı. Üretim motoru: TRELLIS.2.':'Fotoğraftan üretmek için Hugging Face hesabını bağla.';
  $('engine-form').hidden=engineConnected;$('engine-disconnect').hidden=!engineConnected;updateGenerate();
}
$('engine-form').onsubmit=async e=>{
  e.preventDefault();const token=$('engine-token').value.trim();$('engine-token').value='';
  $('engine-connect').disabled=true;$('engine-status').textContent='Anahtar doğrulanıyor…';
  try{showEngine(await(await api('/api/engine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})})).json());}
  catch(e){$('engine-status').textContent=e.message;}finally{$('engine-connect').disabled=false;}
};
$('engine-disconnect').onclick=async()=>{
  try{showEngine(await(await api('/api/engine',{method:'DELETE'})).json());}catch(e){$('engine-status').textContent=e.message;}
};
api('/api/engine').then(r=>r.json()).then(showEngine).catch(e=>{$('engine-status').textContent=e.message;});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
$('generate').onclick=async()=>{
  if(!engineConnected||!photo||jobId||!$('photo-consent').checked)return;
  if(dirty&&!confirm('Yeni model geldiğinde mevcut düzenlemeler kapanacak. Önce GLB indirdiğinden emin misin?'))return;
  const sourcePhoto=photo;
  $('generate').disabled=true;status('Fotoğraf gönderiliyor…');
  try{
    const result=await(await api('/api/generate',{method:'POST',headers:{'Content-Type':sourcePhoto.type},body:sourcePhoto})).json();
    jobId=result.id;const ownJob=jobId;$('cancel-job').hidden=false;
    while(jobId===ownJob){
      const job=await(await api('/api/jobs/'+ownJob)).json();status(job.message);
      if(job.state==='complete'){
        const buffer=await(await api('/api/jobs/'+ownJob+'/model')).arrayBuffer();
        if(dirty&&!confirm('Model hazır. Açarsan mevcut düzenlemeler kapanacak. Yeni modeli aç?')){status('Model hazır; açma işlemi iptal edildi.');break;}
        await loadBuffer(buffer,sourcePhoto.name.replace(/\.[^.]+$/,''));markDirty();status('Fotoğraftan üretilen gerçek 3D model açıldı. Düzeltip GLB indirebilirsin.');break;
      }
      if(job.state==='failed'||job.state==='cancelled')throw new Error(job.message);
      await wait(2500);
    }
  }catch(e){status(e.message,true);}finally{jobId=null;$('cancel-job').hidden=true;updateGenerate();}
};
$('cancel-job').onclick=async()=>{const id=jobId;jobId=null;try{if(id)await api('/api/jobs/'+id,{method:'DELETE'});status('Üretim iptal edildi.');}catch(e){status(e.message,true);}finally{$('cancel-job').hidden=true;updateGenerate();}};
$('logout').onclick=async()=>{if(dirty&&!confirm('Kaydedilmemiş değişiklikler var. Çıkmak istiyor musun?'))return;try{await api('/api/logout',{method:'POST'});dirty=false;location.replace('/login');}catch(e){status(e.message,true);}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();(e.shiftKey?$('redo'):$('undo')).click();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();$('redo').click();}
  if(e.key.toLowerCase()==='f')fit();if(e.key==='Escape'){setTool('select');select(null);}
});
updateParts();
