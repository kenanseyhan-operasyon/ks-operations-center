import http from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateModel,friendlyEngineError,validateGLB} from './inference.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const OWNER=process.env.OWNER_EMAIL?.trim().toLowerCase();
const AUTH_URL=process.env.SUPABASE_URL;
const AUTH_KEY=process.env.SUPABASE_ANON_KEY;
const COOKIE='__Host-ks_studio';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.svg':'image/svg+xml'};
function send(res,status,body,type='application/json; charset=utf-8',extra={}){
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store',...extra});
  res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body));
}
async function readBody(req,max){
  if(Number(req.headers['content-length'])>max)throw Object.assign(new Error('Dosya boyutu sınırı aşıldı.'),{status:413});
  const chunks=[];let size=0;
  for await(const c of req){size+=c.length;if(size>max)throw Object.assign(new Error('Dosya boyutu sınırı aşıldı.'),{status:413});chunks.push(c);}
  return Buffer.concat(chunks);
}
export function validImage(bytes,type){
  if(type==='image/png')return bytes.length>24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.readUInt32BE(16)<=8192&&bytes.readUInt32BE(20)<=8192;
  if(type==='image/jpeg')return bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(type==='image/webp')return bytes.length>12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  return false;
}
async function verifyOwner(email,password){
  if(!OWNER||!AUTH_URL||!AUTH_KEY)throw Object.assign(new Error('Giriş hizmeti yapılandırılmamış.'),{status:503});
  if(email.toLowerCase()!==OWNER)throw Object.assign(new Error('E-posta veya parola doğrulanamadı.'),{status:401});
  const r=await fetch(AUTH_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:AUTH_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Object.assign(new Error('E-posta veya parola doğrulanamadı.'),{status:401});
  const token=await r.json();
  const check=await fetch(AUTH_URL+'/auth/v1/user',{headers:{apikey:AUTH_KEY,Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});
  if(!check.ok)throw Object.assign(new Error('Oturum doğrulanamadı.'),{status:401});
  const user=await check.json();
  if(user.email?.toLowerCase()!==OWNER||!user.email_confirmed_at)throw Object.assign(new Error('Bu hesap için erişim tanımlı değil.'),{status:403});
  return {id:user.id,email:user.email,ttl:Math.min(Number(token.expires_in)||3600,3600)*1000};
}
export function createApp({authenticate=verifyOwner,generate=generateModel}={}){
  const sessions=new Map(),jobs=new Map(),attempts=new Map();
  const cookieValue=req=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  function getSession(req){
    const id=cookieValue(req),s=sessions.get(id);
    if(!s||s.until<Date.now()){sessions.delete(id);return null;}return s;
  }
  const timer=setInterval(()=>{
    const now=Date.now();
    for(const [k,v]of sessions)if(v.until<now)sessions.delete(k);
    for(const [k,v]of jobs)if(v.created<now-1800000){v.controller.abort();jobs.delete(k);}
    for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);
  },60000);timer.unref();
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try{
      const u=new URL(req.url,'http://localhost');
      if(!['GET','HEAD','POST','DELETE'].includes(req.method))return send(res,405,{error:'Yöntem desteklenmiyor.'});
      if(req.method==='POST'||req.method==='DELETE'){
        const origin=req.headers.origin;
        let good=false;try{good=!!origin&&new URL(origin).host===req.headers.host&&['https:','http:'].includes(new URL(origin).protocol);}catch{}
        if(!good)return send(res,403,{error:'İstek kaynağı doğrulanamadı.'});
      }
      if(u.pathname==='/healthz')return send(res,200,{ok:true,service:'ks-3d-studio'});
      if(req.method==='GET'&&u.pathname==='/login'){
        let page=await readFile(path.join(ROOT,'public/login.html'),'utf8');
        return send(res,200,page,'text/html; charset=utf-8');
      }
      if(req.method==='POST'&&u.pathname==='/api/login'){
        const ip=req.headers['x-render-client-ip']||req.socket.remoteAddress;
        const key=String(ip),now=Date.now(),rate=attempts.get(key);
        if(rate?.until>now&&rate.count>=6)return send(res,429,{error:'Çok fazla giriş denemesi. 15 dakika sonra tekrar dene.'});
        attempts.set(key,{count:rate?.until>now?rate.count+1:1,until:rate?.until>now?rate.until:now+900000});
        const data=JSON.parse((await readBody(req,8192)).toString());
        if(typeof data.email!=='string'||typeof data.password!=='string'||data.email.length>254||data.password.length>2048)return send(res,400,{error:'Giriş bilgileri geçersiz.'});
        const user=await authenticate(data.email.trim(),data.password);
        attempts.delete(key);const id=randomBytes(32).toString('base64url');
        if(sessions.size>=20)sessions.delete(sessions.keys().next().value);
        sessions.set(id,{user:user.id,until:now+user.ttl});
        return send(res,200,{ok:true},undefined,{'Set-Cookie':COOKIE+'='+id+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+Math.floor(user.ttl/1000)});
      }
      if(req.method==='GET'&&['/style.css','/login.js'].includes(u.pathname))return send(res,200,await readFile(path.join(ROOT,'public',u.pathname)),MIME[path.extname(u.pathname)]);
      const session=getSession(req);
      if(!session){
        if(u.pathname==='/'&&['GET','HEAD'].includes(req.method))return send(res,303,'',undefined,{Location:'/login'});
        return send(res,401,{error:'Devam etmek için giriş yap.'});
      }
      if(req.method==='POST'&&u.pathname==='/api/logout'){
        sessions.delete(cookieValue(req));return send(res,200,{ok:true},undefined,{'Set-Cookie':COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
      }
      if(req.method==='GET'&&u.pathname==='/api/session')return send(res,200,{ok:true});
      if(req.method==='POST'&&u.pathname==='/api/generate'){
        if([...jobs.values()].some(j=>j.state==='running'))return send(res,409,{error:'Bir üretim zaten sürüyor.'});
        const bytes=await readBody(req,8*1024*1024),type=(req.headers['content-type']||'').split(';')[0];
        if(!validImage(bytes,type))return send(res,400,{error:'En fazla 8 MB PNG, JPEG veya WebP fotoğraf seç.'});
        // Keep at most two recent results in this process. Nothing is written publicly.
        while(jobs.size>=2){const oldest=jobs.keys().next().value;jobs.get(oldest)?.controller.abort();jobs.delete(oldest);}
        const id=randomUUID(),controller=new AbortController(),job={id,user:session.user,created:Date.now(),state:'running',message:'Üretim hazırlanıyor…',controller};
        jobs.set(id,job);
        const deadline=setTimeout(()=>controller.abort(),10*60*1000);deadline.unref();
        const abortPromise=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
        Promise.race([generate(bytes,type,{signal:controller.signal,onProgress:m=>{job.message=m;}}),abortPromise]).then(buffer=>{
          if(job.state!=='running')return;validateGLB(buffer);job.buffer=buffer;job.state='complete';job.message='Model hazır.';
        }).catch(error=>{job.state=controller.signal.aborted?'cancelled':'failed';job.message=friendlyEngineError(error);console.warn('3D generation failed:',String(error?.message||error).replace(/hf_[A-Za-z0-9]+/g,'[redacted]').slice(0,300));}).finally(()=>clearTimeout(deadline));
        return send(res,202,{id});
      }
      const match=u.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)(\/model)?$/);
      if(match){
        const job=jobs.get(match[1]);
        if(!job||job.user!==session.user)return send(res,404,{error:'İş bulunamadı veya süresi doldu.'});
        if(req.method==='DELETE'){job.state='cancelled';job.controller.abort();jobs.delete(job.id);return send(res,200,{ok:true});}
        if(req.method!=='GET')return send(res,405,{error:'Yöntem desteklenmiyor.'});
        if(match[2]){
          if(job.state!=='complete')return send(res,409,{error:'Model henüz hazır değil.'});
          return send(res,200,job.buffer,'model/gltf-binary',{'Content-Disposition':'attachment; filename="ks-ekipman.glb"'});
        }
        return send(res,200,{id:job.id,state:job.state,message:job.message});
      }
      if(req.method!=='GET'&&req.method!=='HEAD')return send(res,404,{error:'Bulunamadı.'});
      let file,base;
      if(u.pathname.startsWith('/vendor/')){base=path.join(ROOT,'node_modules/three');file=path.resolve(base,decodeURIComponent(u.pathname.slice(8)));}
      else {base=path.join(ROOT,'public');file=path.resolve(base,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1)));}
      if(!file.startsWith(base+path.sep)||!MIME[path.extname(file)])return send(res,404,{error:'Bulunamadı.'});
      return send(res,200,req.method==='HEAD'?'':await readFile(file),MIME[path.extname(file)]);
    }catch(e){
      const status=e.code==='ENOENT'?404:e.status||((e instanceof SyntaxError)?400:500);
      send(res,status,{error:status===500?'İşlem tamamlanamadı. Tekrar deneyebilirsin.':e.message});
    }
  });
  server.on('close',()=>{clearInterval(timer);for(const j of jobs.values())j.controller.abort();});
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!OWNER||!AUTH_URL||!AUTH_KEY){console.error('Missing required owner authentication configuration');process.exit(1);}
  createApp().listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('KS 3D Studio ready; owner authentication required.'));
}
