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
    'access-control-allow-headers':'content-type,x-admin-token',
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
function authed(req,u){ return ADMIN_TOKEN && (req.headers['x-admin-token']===ADMIN_TOKEN || u.searchParams.get('token')===ADMIN_TOKEN); }
function cleanup(){
  const now=Date.now();
  for(const [id,r] of requests){ if(now-r.createdAt>6*60*60*1000) requests.delete(id); }
}
setInterval(cleanup, 10*60*1000).unref();

const adminHtml=(token)=>`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KS Misafir Yönetici</title><style>
body{margin:0;background:#07111d;color:#fff;font-family:Segoe UI,Arial;padding:18px}.wrap{max-width:640px;margin:auto}
h1{font-size:26px}.muted{color:#9eb0c5}.card{background:#102033;border:1px solid #29415d;border-radius:18px;padding:16px;margin:12px 0}
button{border:0;border-radius:12px;padding:11px 14px;font-weight:700;margin:5px 5px 0 0}.ok{background:#22c55e}.no{background:#ef4444;color:#fff}.warn{background:#f59e0b;color:#111}
.badge{font-size:12px;background:#17304a;border-radius:999px;padding:6px 9px;display:inline-block}.empty{padding:25px;text-align:center;color:#9eb0c5;border:1px dashed #29415d;border-radius:16px}
#alarm{display:none;position:sticky;top:8px;z-index:9;background:#7f1d1d;border:2px solid #ef4444;border-radius:18px;padding:16px;margin-bottom:14px;box-shadow:0 10px 35px #0008}
#alarm.on{display:block;animation:pulse 1s infinite}@keyframes pulse{50%{transform:scale(1.02)}}.big{font-size:22px;font-weight:800}.status{font-size:13px;margin:10px 0;color:#cbd5e1}
</style></head><body><div class="wrap"><span class="badge">Yönetici cihazı</span><h1>KS Misafir Talepleri</h1>
<div id="alarm"><div class="big">🔔 Yeni giriş talebi</div><div id="alarmName"></div></div>
<p class="muted">Bu sayfa açıkken yeni talep geldiğinde sesli alarm verir. "Alarmı Hazırla" düğmesine bir kez bas.</p>
<button id="n" class="ok">Alarmı Hazırla</button><span id="status" class="status">Hazır değil</span><div id="list"></div></div>
<script>
const token=${JSON.stringify(token)}; let seen=new Set(); let audioCtx=null; let alarmTimer=null; let armed=false;
function beep(){
  if(!audioCtx) return;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.frequency.value=880; g.gain.value=.18; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+.22);
}
function startAlarm(name){
  document.getElementById('alarmName').textContent=name+' giriş izni istiyor';
  document.getElementById('alarm').classList.add('on');
  beep(); clearInterval(alarmTimer); alarmTimer=setInterval(beep,1200);
  if(navigator.vibrate) navigator.vibrate([300,200,300,200,500]);
  if('Notification' in window && Notification.permission==='granted'){
    try{new Notification('KS Aviation - Giriş Talebi',{body:name+' giriş izni istiyor',requireInteraction:true});}catch(e){}
  }
}
function stopAlarm(){clearInterval(alarmTimer);document.getElementById('alarm').classList.remove('on');}
document.getElementById('n').onclick=async()=>{
  try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();await audioCtx.resume();beep();armed=true;}catch(e){}
  if('Notification' in window){try{await Notification.requestPermission();}catch(e){}}
  document.getElementById('status').textContent=armed?'Alarm hazır ✓':'Ses izni alınamadı';
};
async function action(id,a){stopAlarm();await fetch('/api/admin/action?token='+encodeURIComponent(token),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,action:a})});load();}
async function load(){
 const r=await fetch('/api/admin/requests?token='+encodeURIComponent(token),{cache:'no-store'}); if(!r.ok){document.getElementById('status').textContent='Sunucu bağlantı hatası';return;}
 const data=await r.json(); const el=document.getElementById('list');
 if(!data.requests.length){el.innerHTML='<div class="empty">Bekleyen talep yok.</div>';return;}
 el.innerHTML=data.requests.map(x=>'<div class="card"><b>'+esc(x.name)+'</b><div class="muted">'+esc(x.company||'Firma belirtilmedi')+'</div><div class="muted">'+new Date(x.createdAt).toLocaleString('tr-TR')+'</div><div>Durum: <b>'+esc(x.status)+'</b></div>'+(x.status==='pending'?'<button class="ok" onclick="action(\''+x.id+'\',\'approve\')">Onayla</button><button class="no" onclick="action(\''+x.id+'\',\'reject\')">Reddet</button>':'')+'</div>').join('');
 for(const x of data.requests){if(!seen.has(x.id)){seen.add(x.id);if(x.status==='pending')startAlarm(x.name);}}
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
load();setInterval(load,1500);
</script></body></html>`;

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');
  console.log(new Date().toISOString(), req.method, u.pathname);
  if(req.method==='OPTIONS') return send(res,204,{});
  if(req.method==='GET' && u.pathname==='/health') return send(res,200,{ok:true,count:requests.size});
  if(req.method==='POST' && u.pathname==='/api/request'){
    try{
      const b=await bodyJson(req); const name=String(b.name||'').trim().slice(0,80); const company=String(b.company||'').trim().slice(0,100);
      if(!name) return send(res,400,{error:'name_required'});
      const id=randomUUID(); const code=String(randomInt(100000,1000000));
      const item={id,name,company,status:'pending',code,createdAt:Date.now(),approvedAt:null};
      requests.set(id,item); console.log('NEW_REQUEST', id, name, company); return send(res,201,{id,status:'pending'});
    }catch{return send(res,400,{error:'bad_request'});}
  }
  if(req.method==='GET' && u.pathname.startsWith('/api/request/')){
    const id=u.pathname.split('/').pop(); const r=requests.get(id); if(!r)return send(res,404,{error:'not_found'});
    return send(res,200,{id:r.id,status:r.status,expiresAt:r.approvedAt?r.approvedAt+60*60*1000:null});
  }
  if(req.method==='GET' && u.pathname==='/admin'){
    if(!authed(req,u)) return send(res,403,'Yetkisiz erişim','text/plain; charset=utf-8',{'access-control-allow-origin':'*'});
    return send(res,200,adminHtml(ADMIN_TOKEN),'text/html; charset=utf-8',{'access-control-allow-origin':'*'});
  }
  if(req.method==='GET' && u.pathname==='/api/admin/requests'){
    if(!authed(req,u)) return send(res,403,{error:'forbidden'});
    const list=[...requests.values()].sort((a,b)=>b.createdAt-a.createdAt).slice(0,50).map(({code,...x})=>x);
    return send(res,200,{requests:list});
  }
  if(req.method==='POST' && u.pathname==='/api/admin/action'){
    if(!authed(req,u)) return send(res,403,{error:'forbidden'});
    try{
      const b=await bodyJson(req); const r=requests.get(String(b.id||'')); if(!r)return send(res,404,{error:'not_found'});
      if(b.action==='approve'){r.status='approved';r.approvedAt=Date.now();}
      else if(b.action==='reject'){r.status='rejected';}
      else return send(res,400,{error:'bad_action'});
      console.log('ADMIN_ACTION', r.id, r.status);
      return send(res,200,{ok:true,status:r.status});
    }catch{return send(res,400,{error:'bad_request'});}
  }
  return send(res,404,{error:'not_found'});
});
server.listen(PORT,()=>console.log('KS guest gateway listening on',PORT));