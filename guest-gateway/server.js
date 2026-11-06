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
button{border:0;border-radius:12px;padding:11px 14px;font-weight:700;margin:5px 5px 0 0}.ok{background:#22c55e}.no{background:#ef4444;color:#fff}
.badge{font-size:12px;background:#17304a;border-radius:999px;padding:6px 9px;display:inline-block}.empty{padding:25px;text-align:center;color:#9eb0c5;border:1px dashed #29415d;border-radius:16px}
</style></head><body><div class="wrap"><span class="badge">Yönetici cihazı</span><h1>KS Misafir Talepleri</h1>
<p class="muted">Bu sayfa açıkken yeni talep geldiğinde telefon bildirimi göstermeyi dener.</p>
<button id="n" class="ok">Bildirimleri Aç</button><div id="list"></div></div>
<script>
const token=${JSON.stringify(token)}; let seen=new Set();
document.getElementById('n').onclick=async()=>{ if('Notification'in window){ await Notification.requestPermission(); }};
async function action(id,a){await fetch('/api/admin/action?token='+encodeURIComponent(token),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,action:a})});load();}
async function load(){
 const r=await fetch('/api/admin/requests?token='+encodeURIComponent(token),{cache:'no-store'}); if(!r.ok)return;
 const data=await r.json(); const el=document.getElementById('list');
 if(!data.requests.length){el.innerHTML='<div class="empty">Bekleyen talep yok.</div>';return;}
 el.innerHTML=data.requests.map(x=>'<div class="card"><b>'+esc(x.name)+'</b><div class="muted">'+esc(x.company||'Firma belirtilmedi')+'</div><div class="muted">'+new Date(x.createdAt).toLocaleString('tr-TR')+'</div><div>Durum: <b>'+esc(x.status)+'</b></div>'+(x.status==='pending'?'<button class="ok" onclick="action(\''+x.id+'\',\'approve\')">Onayla</button><button class="no" onclick="action(\''+x.id+'\',\'reject\')">Reddet</button>':'')+'</div>').join('');
 for(const x of data.requests){if(!seen.has(x.id)){seen.add(x.id);if(Notification.permission==='granted')new Notification('KS Misafir Giriş Talebi',{body:x.name+' giriş izni istiyor'});}}
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
load();setInterval(load,2000);
</script></body></html>`;

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(req.method==='OPTIONS') return send(res,204,{});
  if(req.method==='GET' && u.pathname==='/health') return send(res,200,{ok:true});
  if(req.method==='POST' && u.pathname==='/api/request'){
    try{
      const b=await bodyJson(req); const name=String(b.name||'').trim().slice(0,80); const company=String(b.company||'').trim().slice(0,100);
      if(!name) return send(res,400,{error:'name_required'});
      const id=randomUUID(); const code=String(randomInt(100000,1000000));
      const item={id,name,company,status:'pending',code,createdAt:Date.now(),approvedAt:null};
      requests.set(id,item); return send(res,201,{id,status:'pending'});
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
      return send(res,200,{ok:true,status:r.status});
    }catch{return send(res,400,{error:'bad_request'});}
  }
  return send(res,404,{error:'not_found'});
});
server.listen(PORT,()=>console.log('KS guest gateway listening on',PORT));
