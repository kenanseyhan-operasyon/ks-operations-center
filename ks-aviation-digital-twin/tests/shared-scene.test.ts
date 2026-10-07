import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {CloudStore,sceneContent} from '../src/cloud-store';
import {CloudPanel} from '../src/cloud-panel';
import {newEntity,validateScene,type SceneData} from '../src/scene-data';
import {restoreDriveCheckpoint,captureDriveCheckpoint} from '../src/drive-checkpoint';
import {VehicleMotion,type DriveRoute} from '../src/vehicle-motion';
import {r14Dimensions} from '../src/r14-spec';
import {readFileSync} from 'node:fs';

const dom=new JSDOM('<!doctype html><body></body>',{url:'https://site.example.test/',pretendToBeVisual:true});
for(const k of ['window','document','HTMLElement','HTMLButtonElement','HTMLInputElement','Option','location','localStorage'])Object.defineProperty(globalThis,k,{value:(dom.window as any)[k],configurable:true});
Object.defineProperties(dom.window.HTMLDialogElement.prototype,{showModal:{value:function(){this.open=true;}},close:{value:function(){this.open=false;}}});
const OWNER='owner-a',OTHER='owner-b',VIEWER='viewer',SESSION='KS_ADT_CLOUD_AUTH_V1',STORE='KS_DIGITAL_TWIN_ADB_V1',BASE='KS_ADT_CLOUD_BASE_V1';
const memory=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)||null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)} as Storage;};
const truck=newEntity('R14',0,0);truck.id='truck';const g=r14Dimensions(),route:DriveRoute={id:'route',name:'Shared route',vehicleId:truck.id,points:[[0,-g.frontAxleOffset],[0,-60],[30,-110]],reference:'front-axle',startHeading:0,speedKmh:8,approachKmh:2,approachDistance:20};
const motion=new VehicleMotion({x:0,z:0,heading:0});Object.assign(motion,g);motion.startRoute(route);while(motion.progress<75)motion.step(.05);
truck.position=[motion.pose.x,0,motion.pose.z];truck.heading=motion.pose.heading*180/Math.PI;truck.trailerAngle=motion.trailerAngle;
const seed=validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',entities:[truck],groups:[],source:'shared-fixture',routes:[route],driving:[captureDriveCheckpoint(truck.id,motion)]});
const empty=validateScene({...seed,entities:[],routes:[],driving:[]}),personal=new Map<string,{revision:number,payload:SceneData,updated_at:string}>();
let shared={revision:1,payload:structuredClone(seed),updated_at:new Date().toISOString()},writes=0,offline=false,denyRoleRead=false;
personal.set(OWNER,{revision:5,payload:structuredClone(empty),updated_at:shared.updated_at});
const roles=new Set([OWNER,OTHER]),requests:{path:string,owner:string|undefined}[]=[];
const transport=(async(input:string,init?:RequestInit)=>{
  if(input==='/cloud-config.json')return Response.json({url:'https://test.supabase.co',anonKey:'sb_publishable_test'});
  const u=new URL(input),path=u.pathname,headers=init?.headers as Record<string,string>,owner=headers.Authorization?.replace('Bearer token-',''),body=init?.body?JSON.parse(String(init.body)):undefined;requests.push({path,owner});
  if(path==='/auth/v1/token')return Response.json({access_token:'token-'+body.email,refresh_token:'refresh-'+body.email,expires_at:Date.now()/1000+3600,user:{id:body.email,email:body.email}});
  if(offline)throw new TypeError('offline');
  if(path.endsWith('ks_adt_editors'))return denyRoleRead?Response.json({code:'42501'},{status:403}):Response.json(roles.has(owner!)?[{user_id:owner}]:[]);
  if(path.endsWith('ks_adt_published_scenes')){assert.equal(headers.Authorization,undefined,'Public read does not require a session');assert.equal(init?.cache,'no-store');return Response.json([shared]);}
  if(path.endsWith('ks_adt_scenes'))return Response.json(personal.has(owner!)?[personal.get(owner!)]:[]);
  if(path.endsWith('ks_adt_save_published_scene')){
    if(!roles.has(owner!))return Response.json({code:'42501'},{status:403});
    const previous=personal.get(owner!),revision=previous?.revision||0;
    if(body.p_expected_revision!==revision||body.p_expected_published_revision!==shared.revision)return Response.json({code:'40001'},{status:409});
    writes++;const row={revision:revision+1,payload:body.p_payload,updated_at:new Date().toISOString()};personal.set(owner!,row);shared={...row,revision:shared.revision+1};return Response.json({...row,published_revision:shared.revision});
  }
  throw new Error('Unexpected endpoint: '+path);
}) as typeof fetch;
async function fixture(owner?:string,storage=memory()){
  const store=new CloudStore(transport,storage);await store.init();if(owner)await store.signIn(owner,'test-only-password');
  const host=document.createElement('div');document.body.append(host);let scene=structuredClone(empty);const notices:string[]=[];
  const panel=new CloudPanel(host,()=>scene,s=>{scene=structuredClone(s);},s=>notices.push(s),()=>{},store,storage);await panel.init();
  return {panel,store,storage,host,notices,get scene(){return scene;}};
}
// A visitor with stale local data always opens the owner's latest published scene.
const stale=memory();stale.setItem(STORE,JSON.stringify(empty));stale.setItem(BASE,'old-device-metadata');const visitor=await fixture(undefined,stale);
assert.deepEqual(visitor.scene,seed);assert.equal(visitor.panel.canEdit,false);assert.equal(await visitor.panel.save(seed),false);assert.equal(writes,0);assert.equal(stale.getItem(STORE),JSON.stringify(empty),'Visitor cannot persist a changed scene');
visitor.scene.entities[0].name='Temporary demo';const secondVisitor=await fixture();assert.equal(secondVisitor.scene.entities[0].name,seed.entities[0].name);
const restored=new VehicleMotion({x:secondVisitor.scene.entities[0].position[0],z:secondVisitor.scene.entities[0].position[2],heading:secondVisitor.scene.entities[0].heading*Math.PI/180});assert.ok(restoreDriveCheckpoint(restored,secondVisitor.scene.driving![0],secondVisitor.scene.routes![0]));assert.equal(restored.mode,'paused');assert.equal(restored.progress,motion.progress);
// Both known owner accounts load the same public scene, even if their private backup is old or absent.
const pc=await fixture(OWNER),phone=await fixture(OTHER);assert.equal(pc.panel.canEdit,true);assert.equal(phone.panel.canEdit,true);assert.deepEqual(pc.scene,seed);assert.deepEqual(phone.scene,seed);assert.equal(pc.store.revision,5);assert.equal(phone.store.revision,0);
pc.panel.open();assert.ok([...pc.host.querySelectorAll('button')].some(b=>b.textContent==='Kaydet ve herkes için yayınla'));
phone.scene.entities[0].name='Latest phone save';assert.equal(await phone.panel.save(phone.scene),true);assert.equal(shared.revision,2);assert.equal(personal.get(OTHER)!.revision,1);assert.equal(personal.get(OWNER)!.revision,5,'Other owner backup preserved');
pc.scene.entities[0].name='Older PC draft';assert.equal(await pc.panel.save(pc.scene),false);assert.equal(pc.panel.pending,true);assert.equal(shared.payload.entities[0].name,'Latest phone save');assert.equal(writes,1);assert.ok(pc.notices.some(s=>s.includes('Başka cihaz')));
const pcReopened=await fixture(undefined,pc.storage);assert.equal(pcReopened.panel.canEdit,true);assert.equal(pcReopened.scene.entities[0].name,'Older PC draft','Failed save survives reopening');assert.equal(pcReopened.store.publishedRevision,1);assert.equal(pcReopened.panel.pending,true);
const fresh=await fixture();assert.equal(fresh.scene.entities[0].name,'Latest phone save');await pcReopened.panel.reloadPublished();assert.equal(pcReopened.scene.entities[0].name,'Latest phone save');assert.ok(pcReopened.storage.getItem('KS_ADT_BEFORE_CLOUD')!.includes('Older PC draft'));
pcReopened.scene.entities[0].name='PC after refresh';assert.equal(await pcReopened.panel.save(pcReopened.scene),true);assert.equal(shared.revision,3);
// A newly registered/non-owner account and forged client-side metadata grant no editor access.
const outsider=await fixture(VIEWER);assert.equal(outsider.panel.canEdit,false);assert.equal(await outsider.panel.save(seed),false);outsider.store.editor=true;await assert.rejects(()=>outsider.store.savePublished(seed),{code:'read_only'});outsider.store.editor=false;
const forged=JSON.parse(outsider.storage.getItem(SESSION)!);forged.user.user_metadata={editor:true};outsider.storage.setItem(SESSION,JSON.stringify(forged));const forgedPanel=await fixture(undefined,outsider.storage);assert.equal(forgedPanel.panel.canEdit,false);
outsider.panel.open();assert.ok(![...outsider.host.querySelectorAll('button')].some(b=>b.textContent==='Kaydet ve herkes için yayınla'));
// Loss of network preserves an authorized draft; refresh/sign-out must not expose it to viewers.
offline=true;pcReopened.scene.entities[0].name='Offline unsaved work';assert.equal(await pcReopened.panel.save(pcReopened.scene),false);offline=false;
const offlineReload=await fixture(undefined,pcReopened.storage);assert.equal(offlineReload.scene.entities[0].name,'Offline unsaved work');assert.equal(offlineReload.panel.pending,true);
await offlineReload.panel.signOut();assert.equal(offlineReload.panel.canEdit,false);assert.equal(offlineReload.scene.entities[0].name,'PC after refresh');assert.ok(offlineReload.storage.getItem(STORE)!.includes('Offline unsaved work'),'Sign-out preserves the owner’s device draft');
const signedOutReopen=await fixture(undefined,offlineReload.storage);assert.equal(signedOutReopen.scene.entities[0].name,'PC after refresh');assert.equal(signedOutReopen.panel.canEdit,false);
denyRoleRead=true;const denied=await fixture(OWNER);assert.equal(denied.panel.canEdit,false);assert.equal(await denied.panel.save(seed),false);denyRoleRead=false;
// Repeated account recovery/access refresh never changes private cloud data or publishes by itself.
assert.equal(writes,2);assert.equal(personal.get(OWNER)!.revision,6);assert.equal(personal.get(OTHER)!.revision,1);
const workspace=readFileSync('src/workspace.ts','utf8');assert.ok(!workspace.includes('const password=prompt('),'Remove the public hardcoded design password');assert.ok(workspace.includes('await this.cloud.init(authCallback)'));
assert.ok(sceneContent(shared.payload).includes('PC after refresh'));
console.log('PASS: public first-open scene, both owner accounts, read-only visitors, denied role escalation, stale cross-account conflict, offline draft recovery, sign-out isolation and shared halfway route restoration.');
dom.window.close();
