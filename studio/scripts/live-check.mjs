import assert from 'node:assert/strict';
const base='https://ks-3d-studio.onrender.com';
for(const [route,status]of [['/',303],['/login',200],['/app.mjs',401],['/api/session',401],['/api/jobs/unauthenticated/model',401]]){
 const r=await fetch(base+route,{redirect:'manual',signal:AbortSignal.timeout(90000)});
 assert.equal(r.status,status,route);console.log('LIVE_ACCESS_PASS: '+route+' -> '+r.status);
}
