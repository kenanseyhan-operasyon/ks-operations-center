import assert from 'node:assert/strict';
const base='https://ks-3d-studio.onrender.com';
for(const [route,status]of [['/',303],['/login',200],['/app.mjs',401],['/api/session',401],['/api/jobs/unauthenticated/model',401]]){
 const r=await fetch(base+route,{redirect:'manual',signal:AbortSignal.timeout(90000)});
 assert.equal(r.status,status,route);console.log('LIVE_ACCESS_PASS: '+route+' -> '+r.status);
}
const configText=await(await import('node:fs/promises')).readFile(new URL('../../index.html',import.meta.url),'utf8');
const match=configText.match(/const KS_CLOUD=\{\s*url:"([^"]+)",\s*key:"([^"]+)"/);
if(match){
 const r=await fetch(match[1]+'/auth/v1/settings',{headers:{apikey:match[2]},signal:AbortSignal.timeout(15000)});
 console.log('AUTH_PROVIDER_HTTP_STATUS: '+r.status);
 if(r.ok){const s=await r.json();console.log('AUTH_PROVIDER_EMAIL_ENABLED: '+Boolean(s.external?.email));}
}
