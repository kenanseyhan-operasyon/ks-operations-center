import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {CloudPanel} from '../src/cloud-panel';
import {CloudStore} from '../src/cloud-store';
import {TEST_CLOUD,TEST_SCENE_KEY} from '../src/site-mode';
import {newEntity,validateScene} from '../src/scene-data';
assert.equal(TEST_CLOUD,true);
const dom=new JSDOM('<body></body>',{url:'https://ks-gemini-nathan-test.onrender.com/'});
for(const name of ['window','document','HTMLElement'])Object.defineProperty(globalThis,name,{value:(dom.window as any)[name],configurable:true});
const seed=validateScene(JSON.parse(readFileSync('public/data/adb-test-seed.json','utf8')));
let published={revision:1,payload:seed,updated_at:'2026-10-22'},personal:any,claims=0;
const memory=()=>{const data=new Map<string,string>();return{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)} as Storage;};
const request=(async(input:string,init?:RequestInit)=>{
 if(input==='/data/adb-test-seed.json')return Response.json(seed);
 if(input==='/cloud-config.json')return Response.json({url:'https://test.supabase.co',anonKey:'sb_publishable_test',claimEditor:true});
 const url=new URL(input),path=url.pathname;
 if(path==='/rest/v1/rpc/ks_adt_claim_editor'){claims++;return Response.json(true);}
 if(path==='/rest/v1/ks_adt_published_scenes')return Response.json([published]);
 if(path==='/rest/v1/ks_adt_scenes')return Response.json(personal?[personal]:[]);
 if(path==='/rest/v1/rpc/ks_adt_save_published_scene'){
  const body=JSON.parse(String(init!.body));assert.equal(body.p_scene_id,'ADB');
  assert.equal((init!.headers as any).Authorization,'Bearer test-token');
  if(body.p_expected_revision!==(personal?.revision||0)||body.p_expected_published_revision!==published.revision)return Response.json({code:'40001'},{status:409});
  personal={revision:(personal?.revision||0)+1,payload:body.p_payload,updated_at:'2026-10-22'};published={revision:published.revision+1,payload:body.p_payload,updated_at:'2026-10-22'};
  return Response.json({...personal,published_revision:published.revision});
 }
 throw Error('Unexpected request '+path);
}) as typeof fetch;
Object.defineProperty(globalThis,'fetch',{value:request,configurable:true});
async function device(storage:Storage,signedIn=true){
 if(signedIn)storage.setItem('KS_ADT_CLOUD_AUTH_V1',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,user:{id:'owner',email:'ks.aviation.gemini@gmail.com'}}));
 let scene=structuredClone(seed);const notices:string[]=[];
 const panel=new CloudPanel(document.body,()=>scene,next=>scene=next,text=>notices.push(text),()=>{},new CloudStore(request,storage),storage);
 await panel.init();return {panel,notices,get scene(){return scene;}};
}
const old=memory(),draft=structuredClone(seed),tank=newEntity('TANK',3,4);draft.entities.push(tank);old.setItem(TEST_SCENE_KEY,JSON.stringify(draft));old.setItem('KS_DIGITAL_TWIN_ADB_V1','old production data');
const first=await device(old);assert.ok(first.panel.canEdit);assert.ok(first.panel.pending);assert.ok(first.scene.entities.some(e=>e.id===tank.id),'The previous browser-only test draft survives the first cloud login');
assert.equal(await first.panel.save(first.scene),true);assert.equal(first.panel.pending,false);assert.equal(published.revision,2);assert.equal(old.getItem('KS_DIGITAL_TWIN_ADB_V1'),'old production data');
const second=await device(memory());assert.ok(second.scene.entities.some(e=>e.id===tank.id),'An independent device loads the newly published scene');
const visitor=await device(memory(),false);assert.equal(visitor.panel.canEdit,false);assert.ok(visitor.scene.entities.some(e=>e.id===tank.id),'Visitors load the same published ADB scene');assert.equal(await visitor.panel.save(visitor.scene),false);
const late=await device(memory());assert.equal(await second.panel.save(second.scene),true);assert.equal(await late.panel.save(late.scene),false);assert.equal(late.panel.pending,true,'A stale device cannot overwrite a newer publication');
assert.ok(claims>=3);console.log('PASS shared 3D save: confirmed editor claim, old local draft preserved, new-device/visitor reload, anonymous writes rejected and conflict keeps draft.');
