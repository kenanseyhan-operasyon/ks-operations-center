import {writeFile} from 'node:fs/promises';
import {generateModel,validateGLB} from '../inference.mjs';
const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),150000);
const probe={checkedAt:new Date().toISOString(),engine:'stabilityai/TripoSR',ok:false};
try{
  const r=await fetch('https://raw.githubusercontent.com/VAST-AI-Research/TripoSR/main/examples/chair.png',{signal:controller.signal});
  if(!r.ok)throw new Error('Sample image unavailable');
  const bytes=Buffer.from(await r.arrayBuffer());
  const abort=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('Generation probe timed out')),{once:true}));
  const glb=await Promise.race([generateModel(bytes,'image/png',{signal:controller.signal,onProgress:message=>console.log('ENGINE_PROBE_PROGRESS: '+message)}),abort]);
  const doc=validateGLB(glb);probe.ok=true;probe.bytes=glb.length;probe.meshes=doc.meshes.length;
  console.log('ENGINE_PROBE_PASS: '+JSON.stringify(probe));
}catch(e){probe.error=String(e.message||e).replace(/hf_[A-Za-z0-9]+/g,'[redacted]').slice(0,500);console.log('ENGINE_PROBE_BLOCKED: '+JSON.stringify(probe));}
finally{clearTimeout(timer);await writeFile(new URL('../engine-probe.json',import.meta.url),JSON.stringify(probe,null,2));}
process.exit(0);
