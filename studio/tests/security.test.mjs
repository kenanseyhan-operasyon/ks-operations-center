import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp,validImage,passwordAuthenticator} from '../server.mjs';
import {validateGLB,safeModelURL} from '../inference.mjs';
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
