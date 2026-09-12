document.getElementById('login-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.currentTarget.querySelector('button'),error=document.getElementById('login-error');button.disabled=true;error.textContent='';
  try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value,password:document.getElementById('password').value})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Giriş yapılamadı.');location.replace('/');}
  catch(e){error.textContent=e.message;}finally{button.disabled=false;document.getElementById('password').value='';}
});