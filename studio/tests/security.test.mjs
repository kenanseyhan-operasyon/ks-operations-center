import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp,validImage,passwordAuthenticator} from '../server.mjs';
import {validateGLB,safeModelURL,generateTrellis2} from '../inference.mjs';
import {fixtureGLB} from './fixture.mjs';
test('GLB validation rejects corruption and unsafe downloads',()=>{
  const good=fixtureGLB();assert.equal(validateGLB(good).meshes.length,1);
  assert.throws(()=>validateGLB(Buffer.from('not a model')));
  const bad=Buffer.from(good);bad.writeUInt32LE(123,8);assert.throws(()=>validateGLB(bad));
  for(const url of ['http://localhost/model.glb','https://hf.space.evil.test/a','https://127.0.0.1/x','https://foo.hf.space:8443/a','file:///etc/passwd'])assert.throws(()=>safeModelURL(url));
  assert.equal(safeModelURL('https://stabilityai-triposr.hf.space/file=test.glb').protocol,'https:');
  assert.equal(validImage(Buffer.from('<svg></svg>'),'image/png'),false);
});
test('all private assets and model APIs require owner session; CSRF and logout',async()=>{
  const app=createApp({authenticate:async(email,password)=>{
    if(email!=='owner@example.test'||password!=='test-only-password')throw Object.assign(new Error('Access denied'),{status:401});
    return{id:'owner',ttl:60000};
  },generate:async()=>fixtureGLB()});
  app.listen(0,'127.0.0.1');await once(app,'listening');const base='http://127.0.0.1:'+app.address().port;
  try{
    for(const resource of ['/api/session','/app.mjs','/geometry.mjs','/vendor/build/three.module.js','/api/jobs/abc/model'])assert.equal((await fetch(base+resource)).status,401,resource);
    assert.equal((await fetch(base+'/',{redirect:'manual'})).status,303);
    assert.equal((await fetch(base+'/login')).status,200);
    assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'})).status,403);
    const login=async(email,password)=>fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    assert.equal((await login('other@example.test','test-only-password')).status,401);
    const response=await login('owner@example.test','test-only-password');assert.equal(response.status,200);
    const raw=response.headers.get('set-cookie');assert.match(raw,/HttpOnly/);assert.match(raw,/Secure/);assert.match(raw,/SameSite=Strict/);
    const cookie=raw.split(';')[0],headers={Cookie:cookie,Origin:base};
    assert.equal((await fetch(base+'/',{headers})).status,200);
    assert.equal((await fetch(base+'/vendor/build/three.module.js',{headers})).status,200);
    assert.equal((await fetch(base+'/api/generate',{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:'wrong'})).status,400);
    const png=Buffer.alloc(32);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(1,16);png.writeUInt32BE(1,20);
    const job=await(await fetch(base+'/api/generate',{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:png})).json();
    assert.ok(job.id);
    await new Promise(r=>setTimeout(r,20));
    const ready=await(await fetch(base+'/api/jobs/'+job.id,{headers})).json();assert.equal(ready.state,'complete');
    const download=await fetch(base+'/api/jobs/'+job.id+'/model',{headers});assert.equal(download.status,200);validateGLB(await download.arrayBuffer());
    assert.equal((await fetch(base+'/api/jobs/'+job.id+'/model')).status,401);
    assert.equal((await fetch(base+'/api/logout',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.test'}})).status,403);
    assert.equal((await fetch(base+'/api/logout',{method:'POST',headers})).status,200);
    assert.equal((await fetch(base+'/api/session',{headers})).status,401);
  }finally{app.closeAllConnections();await new Promise(r=>app.close(r));}
});

test('production password verifier enforces owner and fails closed',async()=>{
 const auth=passwordAuthenticator({owner:'owner@example.test',password:'test-only-long-password!'});
 assert.equal((await auth('OWNER@example.test','test-only-long-password!')).id,'owner@example.test');
 await assert.rejects(auth('other@example.test','test-only-long-password!'),e=>e.status===401);
 await assert.rejects(auth('owner@example.test','wrong-password'),e=>e.status===401);
 await assert.rejects(passwordAuthenticator({owner:'owner@example.test',password:''})('owner@example.test',''),e=>e.status===503);
});

test('Hugging Face credentials stay inside the owning session and are removed on disconnect',async()=>{
 const token='test-only-engine-credential';let received;
 const app=createApp({authenticate:async()=>({id:'owner',ttl:60000}),verifyEngineToken:async value=>{if(value!==token)throw Object.assign(new Error('Invalid token'),{status:400});},generate:async(bytes,type,options)=>{received=options.token;return fixtureGLB();}});
 app.listen(0,'127.0.0.1');await once(app,'listening');const base='http://127.0.0.1:'+app.address().port;
 const login=async()=>{const r=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.test',password:'test'})});return {Cookie:r.headers.get('set-cookie').split(';')[0],Origin:base,'Content-Type':'application/json'};};
 try{
  assert.equal((await fetch(base+'/api/engine')).status,401);
  const headers=await login(),other=await login();
  const connect=()=>fetch(base+'/api/engine',{method:'POST',headers,body:JSON.stringify({token})});
  const r=await connect();assert.equal(r.status,200);assert.equal((await r.text()).includes(token),false);
  assert.equal((await(await fetch(base+'/api/engine',{headers})).json()).connected,true);
  assert.equal((await(await fetch(base+'/api/engine',{headers:other})).json()).connected,false);
  assert.equal((await fetch(base+'/api/engine',{method:'POST',headers:{...headers,Origin:'https://evil.test'},body:JSON.stringify({token})})).status,403);
  const png=Buffer.alloc(32);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
  const job=await fetch(base+'/api/generate',{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:png});assert.equal(job.status,202);assert.equal(received,token);
  assert.equal((await fetch(base+'/api/engine',{method:'DELETE',headers})).status,200);
  assert.equal((await(await fetch(base+'/api/engine',{headers})).json()).connected,false);
  await connect();await fetch(base+'/api/logout',{method:'POST',headers});
  assert.equal((await fetch(base+'/api/engine',{headers})).status,401);
  assert.equal((await(await fetch(base+'/api/engine',{headers:await login()})).json()).connected,false);
 }finally{app.closeAllConnections();await new Promise(r=>app.close(r));}
});
test('TRELLIS requires authentication and stops on GPU quota errors before extraction',async()=>{
 let calls=[];
 await assert.rejects(generateTrellis2(Buffer.alloc(0),'image/png',{token:'',connect:async()=>{throw new Error('Should not connect');}}),/token required/);
 const connect=async(space,options)=>{assert.equal(space,'microsoft/TRELLIS.2');assert.equal(options.hf_token,'test-only');assert.equal('token' in options,false);return {view_api:async()=>({named_endpoints:Object.fromEntries(['/start_session','/preprocess_image','/image_to_3d','/extract_glb'].map(n=>[n,{}]))}),submit:async function*(name){calls.push(name);if(name==='/image_to_3d')yield {type:'status',stage:'error',title:'ZeroGPU quota exceeded',message:'Authenticate with a Hugging Face token'};else yield {type:'data',data:name==='/preprocess_image'?[{url:'https://microsoft-trellis-2.hf.space/test.png'}]:[]};},close(){}};};
 await assert.rejects(generateTrellis2(Buffer.alloc(0),'image/png',{token:'test-only',connect}),/ZeroGPU quota exceeded/);
 assert.equal(calls.includes('/extract_glb'),false);
});
