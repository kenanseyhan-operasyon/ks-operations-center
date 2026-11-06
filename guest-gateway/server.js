import http from 'node:http';
import { randomUUID, randomInt } from 'node:crypto';
import { URL } from 'node:url';

const PORT = process.env.PORT || 10000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ALLOW_ORIGIN = 'https://ks-misafirleri.onrender.com';
const requests = new Map();

function send(res, status, body, type='application/json; charset=utf-8', extra={}) {
  res.writeHead(status, {
    'content-type': type,
    'cache-control':'no-store',
    'access-control-allow-origin': ALLOW_ORIGIN,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'content-type',
    ...extra
  });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
function bodyJson(req){
  return new Promise((resolve,reject)=>{
    let s=''; req.on('data',c=>{s+=c;if(s.length>10000)req.destroy();});
    req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(e);}});
  });
}
function cookies(req){
  const out={};
  const raw=req.headers.cookie||'';
  raw.split(';').forEach(part=>{
    const i=part.indexOf('=');
    if(i>0) out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
  });
  return out;
}
function isAdmin(req,u){
  return ADMIN_TOKEN && (u.searchParams.get('token')===ADMIN_TOKEN || cookies(req).ks_admin===ADMIN_TOKEN);
}

const adminHtml = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KS Misafir Yönetici</title>
<style>
body{margin:0;background:#07111d;color:#fff;font-family:Segoe UI,Arial;padding:18px}.wrap{max-width:640px;margin:auto}
.badge{display:inline-block;padding:7px 10px;border-radius:999px;background:#17304a;font-size:12px}
h1{font-size:26px}.muted{color:#9eb0c5}.status{padding:10px 12px;border-radius:12px;background:#0f2538;margin:10px 0}
.good{color:#86efac}.bad{color:#fca5a5}.card{background:#102033;border:1px solid #29415d;border-radius:18px;padding:16px;margin:12px 0}
button{border:0;border-radius:12px;padding:12px 14px;font-weight:700;margin:6px 6px 0 0}.ok{background:#22c55e}.no{background:#ef4444;color:#fff}.test{background:#f59e0b}
#alarm{display:none;background:#7f1d1d;border:2px solid #ef4444;border-radius:18px;padding:16px;margin:14px 0}
#alarm.on{display:block}.big{font-size:22px;font-weight:800}.empty{padding:24px;text-align:center;color:#9eb0c5;border:1px dashed #29415d;border-radius:16px}
</style>
</head>
<body>
<div class="wrap">
<span class="badge">Yönetici cihazı</span>
<h1>KS Misafir Talepleri</h1>
<div id="conn" class="status">Sayfa açıldı. Bağlantı kontrol ediliyor...</div>
<button id="arm" class="ok">Alarmı Hazırla</button>
<button id="test" class="test">Test Alarmı</button>
<div id="alarm"><div class="big">🔔 Yeni giriş talebi</div><div id="alarmName"></div></div>
<div id="list"></div>
</div>
<script src="/admin.js"></script>
</body>
</html>`;

const adminJs = `
let seen = {};
let audioCtx = null;
let alarmTimer = null;
let armed = false;

function esc(v){
  return String(v).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
  });
}
function beep(){
  if(!audioCtx) return;
  const o=audioCtx.createOscillator();
  const g=audioCtx.createGain();
  o.frequency.value=880;
  g.gain.value=.2;
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime+.25);
}
function stopAlarm(){
  clearInterval(alarmTimer);
  document.getElementById('alarm').className='';
}
function startAlarm(name){
  document.getElementById('alarmName').textContent=name+' giriş izni istiyor';
  document.getElementById('alarm').className='on';
  beep();
  clearInterval(alarmTimer);
  alarmTimer=setInterval(beep,1200);
  if(navigator.vibrate) navigator.vibrate([300,200,300,200,500]);
}
document.getElementById('arm').onclick=async function(){
  try{
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    await audioCtx.resume();
    armed=true;
    beep();
    this.textContent='Alarm Hazır ✓';
    this.disabled=true;
  }catch(e){
    this.textContent='Ses açılamadı';
  }
};
document.getElementById('test').onclick=function(){
  if(!armed){alert('Önce Alarmı Hazırla butonuna basın.');return;}
  startAlarm('TEST');
  setTimeout(stopAlarm,4000);
};
async function act(id,action){
  stopAlarm();
  await fetch('/api/admin/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,action}),cache:'no-store'});
  load();
}
async function load(){
  const conn=document.getElementById('conn');
  try{
    const r=await fetch('/api/admin/requests',{cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const data=await r.json();
    conn.innerHTML='<span class="good">● BAĞLANDI</span> • '+new Date().toLocaleTimeString('tr-TR');
    const list=document.getElementById('list');
    if(!data.requests.length){
      list.innerHTML='<div class="empty">Bekleyen talep yok.</div>';
      return;
    }
    list.innerHTML=data.requests.map(function(x){
      const b=x.status==='pending'
        ? '<button class="ok" onclick="act(\''+x.id+'\',\'approve\')">Onayla</button><button class="no" onclick="act(\''+x.id+'\',\'reject\')">Reddet</button>'
        : '';
      return '<div class="card"><b>'+esc(x.name)+'</b><div class="muted">'+esc(x.company||'Firma belirtilmedi')+'</div><div class="muted">'+new Date(x.createdAt).toLocaleString('tr-TR')+'</div><div>Durum: <b>'+esc(x.status)+'</b></div>'+b+'</div>';
    }).join('');
    data.requests.forEach(function(x){
      if(x.status==='pending'&&!seen[x.id]){
        seen[x.id]=true;
        if(armed) startAlarm(x.name);
      }
    });
  }catch(e){
    conn.innerHTML='<span class="bad">● BAĞLANTI HATASI</span>';
  }
}
load();
setInterval(load,1500);
`;

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');
  console.log(new Date().toISOString(), req.method, u.pathname);

  if(req.method==='OPTIONS') return send(res,204,{});
  if(req.method==='GET' && u.pathname==='/health') return send(res,200,{ok:true,count:requests.size});

  if(req.method==='POST' && u.pathname==='/api/request'){
    try{
      const b=await bodyJson(req);
      const name=String(b.name||'').trim().slice(0,80);
      const company=String(b.company||'').trim().slice(0,100);
      if(!name) return send(res,400,{error:'name_required'});
      const id=randomUUID();
      const code=String(randomInt(100000,1000000));
      requests.set(id,{id,name,company,status:'pending',code,createdAt:Date.now(),approvedAt:null});
      console.log('NEW_REQUEST',id,name,company);
      return send(res,201,{id,status:'pending'});
    }catch{return send(res,400,{error:'bad_request'});}
  }

  if(req.method==='GET' && u.pathname.startsWith('/api/request/')){
    const id=u.pathname.split('/').pop();
    const r=requests.get(id);
    if(!r) return send(res,404,{error:'not_found'});
    return send(res,200,{id:r.id,status:r.status,expiresAt:r.approvedAt?r.approvedAt+60*60*1000:null});
  }

  if(req.method==='GET' && u.pathname==='/admin'){
    if(u.searchParams.get('token')===ADMIN_TOKEN && ADMIN_TOKEN){
      return send(res,302,'','text/plain; charset=utf-8',{
        'set-cookie':'ks_admin='+encodeURIComponent(ADMIN_TOKEN)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400',
        'location':'/admin'
      });
    }
    if(!isAdmin(req,u)) return send(res,403,'Yetkisiz erişim','text/plain; charset=utf-8',{'access-control-allow-origin':'*'});
    return send(res,200,adminHtml,'text/html; charset=utf-8',{'access-control-allow-origin':'*'});
  }

  if(req.method==='GET' && u.pathname==='/admin.js'){
    if(!isAdmin(req,u)) return send(res,403,'forbidden','text/plain; charset=utf-8',{'access-control-allow-origin':'*'});
    return send(res,200,adminJs,'application/javascript; charset=utf-8',{'access-control-allow-origin':'*'});
  }

  if(req.method==='GET' && u.pathname==='/api/admin/requests'){
    if(!isAdmin(req,u)) return send(res,403,{error:'forbidden'});
    const list=[...requests.values()].sort((a,b)=>b.createdAt-a.createdAt).slice(0,50).map(({code,...x})=>x);
    return send(res,200,{requests:list});
  }

  if(req.method==='POST' && u.pathname==='/api/admin/action'){
    if(!isAdmin(req,u)) return send(res,403,{error:'forbidden'});
    try{
      const b=await bodyJson(req);
      const r=requests.get(String(b.id||''));
      if(!r) return send(res,404,{error:'not_found'});
      if(b.action==='approve'){r.status='approved';r.approvedAt=Date.now();}
      else if(b.action==='reject'){r.status='rejected';}
      else return send(res,400,{error:'bad_action'});
      console.log('ADMIN_ACTION',r.id,r.status);
      return send(res,200,{ok:true,status:r.status});
    }catch{return send(res,400,{error:'bad_request'});}
  }

  return send(res,404,{error:'not_found'});
});

server.listen(PORT,()=>console.log('KS guest gateway listening on',PORT));