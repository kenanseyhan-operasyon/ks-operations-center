import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {TestSitePanel} from '../src/test-site-panel';
import {TEST_SCENE_KEY, TEST_SITE, SCENE_STORAGE_KEY} from '../src/site-mode';
import {newEntity, validateScene} from '../src/scene-data';

const dom=new JSDOM('<!doctype html><body></body>',{url:'https://test.example/'});
for(const k of ['window','document','HTMLElement','HTMLButtonElement','localStorage'])Object.defineProperty(globalThis,k,{value:(dom.window as any)[k],configurable:true});
Object.defineProperties(dom.window.HTMLDialogElement.prototype,{showModal:{value:function(){this.open=true;}},close:{value:function(){this.open=false;}}});
const raw=readFileSync('public/data/adb-test-seed.json');
const meta=JSON.parse(readFileSync('docs/adb-test-seed.json','utf8'));
assert.equal(createHash('sha256').update(raw).digest('hex'),meta.sha256);
const seed=validateScene(JSON.parse(raw.toString()));
assert.equal(seed.entities.length,178);
assert.equal(meta.publishedRevision,17);
assert.equal(TEST_SITE,false,'Test editing must be disabled without the build flag');
assert.equal(SCENE_STORAGE_KEY,'KS_DIGITAL_TWIN_ADB_V1');

const memory=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)} as Storage;};
const requests:string[]=[];
const transport=(async(input:string,init?:RequestInit)=>{
  requests.push(input);assert.equal(input,'/data/adb-test-seed.json','Only the bundled snapshot may be requested');
  assert.ok(!init?.method||init.method==='GET','No remote write is allowed');
  return Response.json(seed);
}) as typeof fetch;
async function fixture(storage=memory(),request=transport){
  const host=document.createElement('div');document.body.append(host);let scene=validateScene({...seed,entities:[]});const notices:string[]=[];
  const panel=new TestSitePanel(host,()=>scene,next=>scene=next,m=>notices.push(m),()=>{},storage,request);
  assert.equal(panel.canEdit,false);
  // Even a callback intended for production must not invoke account or cloud requests.
  await panel.init({error:'access_denied'});
  return {host,panel,storage,notices,get scene(){return scene;}};
}
const storage=memory();storage.setItem('KS_DIGITAL_TWIN_ADB_V1','production marker');storage.setItem('KS_ADT_CLOUD_AUTH_V1','production session marker');
const first=await fixture(storage);assert.equal(first.panel.canEdit,true);assert.deepEqual(first.scene,seed);
const nathan=newEntity('NATHAN_OPERATOR',12,20);nathan.nathan={clip:'Climbing_Ladder',speed:1.25,loop:true};first.scene.entities.push(nathan);
assert.equal(await first.panel.save(first.scene),true);
assert.equal(storage.getItem('KS_DIGITAL_TWIN_ADB_V1'),'production marker');
assert.equal(storage.getItem('KS_ADT_CLOUD_AUTH_V1'),'production session marker');
assert.equal(requests.length,1,'Saving must not send a request');
const offline=(async()=>{throw new Error('A saved test scene must reopen without cloud access');}) as typeof fetch;
const reopened=await fixture(storage,offline);assert.deepEqual(reopened.scene.entities.find(e=>e.id===nathan.id),validateScene(first.scene).entities.find(e=>e.id===nathan.id));
assert.equal(reopened.scene.entities.length,179);
const phone=await fixture();assert.equal(phone.scene.entities.length,178,'A new browser gets its own test copy');
reopened.panel.open();assert.ok(reopened.host.textContent?.includes('yalnızca bu cihazdaki tarayıcıda'));
assert.ok(!reopened.host.querySelector('input[type="password"]'),'Test mode has no production login');
reopened.host.querySelector<HTMLButtonElement>('dialog button')!.click();
const bad=memory();bad.setItem(TEST_SCENE_KEY,'broken JSON');const recovered=await fixture(bad);assert.deepEqual(recovered.scene,seed);assert.ok(recovered.notices.length);
const failing=memory();const failed=await fixture(failing);failing.setItem=()=>{throw new Error('quota exceeded');};
assert.equal(await failed.panel.save(failed.scene),false);assert.equal(failed.panel.pending,true);assert.ok(failed.notices.some(n=>n.includes('JSON dışarı aktar')));assert.equal(failed.scene.entities.length,178);
const errorHost=document.createElement('div');const unavailable=new TestSitePanel(errorHost,()=>seed,()=>{throw new Error('Must not apply an empty substitute');},()=>{},()=>{},memory(),(async()=>new Response('',{status:503})) as typeof fetch);
await assert.rejects(()=>unavailable.init(),/başlangıç sahnesi yüklenemedi/);assert.equal(unavailable.canEdit,false);
console.log('PASS: test site seed matches published ADB revision 17; isolated local save, Nathan reload, separate browsers, no cloud writes or auth, storage failure and missing seed handled.');
dom.window.close();
