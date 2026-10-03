import { CloudStore, sceneContent, type CloudRecord } from './cloud-store';
import type { SceneData } from './scene-data';
const STORE='KS_DIGITAL_TWIN_ADB_V1',BASE='KS_ADT_CLOUD_BASE_V1';
export class CloudPanel{
  store=new CloudStore();pending=false;busy=false;private lang:'tr'|'en'='tr';
  constructor(private host:HTMLElement,private scene:()=>SceneData,private apply:(s:SceneData)=>void,private notify:(s:string)=>void,private changed:()=>void){}
  setLanguage(lang:'tr'|'en'){this.lang=lang;}
  private say(tr:string,en:string){return this.lang==='tr'?tr:en;}
  get status(){return this.busy?this.say('Bulut kaydediliyor…','Saving to cloud…'):this.pending?this.say('Yerel kayıt var · bulut bekliyor','Local copy saved · cloud pending'):this.store.session?`${this.say('Bulut','Cloud')} · v${this.store.revision}`:this.say('Bu cihazda kayıt','Saved on this device');}
  private meta(){try{return JSON.parse(localStorage.getItem(BASE)||'null');}catch{return null;}}
  private accepted(row:CloudRecord){this.store.revision=row.revision;localStorage.setItem(BASE,JSON.stringify({userId:this.store.userId,revision:row.revision,content:sceneContent(row.payload)}));this.pending=false;this.changed();}
  async init(){try{await this.store.init();if(this.store.session)await this.sync();}catch{this.notify(this.say('Buluta ulaşılamadı; bu cihazdaki sahne korunuyor.','Cloud unavailable; this device’s scene is preserved.'));}}
  private async sync(){
    const row=await this.store.read(),meta=this.meta(),local=localStorage.getItem(STORE);
    if(!row){this.store.revision=0;this.pending=true;this.changed();return;}
    if(!local||(meta?.userId===this.store.userId&&meta.content===sceneContent(this.scene()))){localStorage.setItem(STORE,JSON.stringify(row.payload));this.apply(row.payload);this.accepted(row);this.notify(this.say('Buluttaki güncel sahne açıldı.','Latest cloud scene loaded.'));}
    else if(meta?.userId===this.store.userId&&meta.revision===row.revision){this.store.revision=row.revision;this.pending=meta.content!==sceneContent(this.scene());this.changed();}
    else{this.store.revision=meta?.userId===this.store.userId?meta.revision:0;this.pending=true;this.changed();this.notify(this.say('Bulutta farklı bir sahne var. Bulut menüsünden açabilirsiniz; yerel çalışma korunuyor.','A different scene exists in the cloud. Open it from Cloud; local work is preserved.'));}
  }
  async save(snapshot:SceneData){
    localStorage.setItem(STORE,JSON.stringify(snapshot));
    if(!this.store.config||!this.store.session){this.pending=true;this.changed();this.notify(this.say('Bu cihaza kaydedildi. İnternete kaydetmek için Bulut menüsünden giriş yapın.','Saved on this device. Sign in through Cloud to save online.'));return true;}
    this.busy=true;this.changed();try{const row=await this.store.save(snapshot);this.accepted(row);this.notify(this.say(`İnternete kaydedildi · sürüm ${row.revision}.`,`Saved online · revision ${row.revision}.`));return true;}catch(e){this.pending=true;this.notify(`${String((e as Error).message)} ${this.say('Bu cihazdaki kopya korundu.','The local copy is safe.')}`);return false;}finally{this.busy=false;this.changed();}
  }
  open(){
    const dialog=document.createElement('dialog');dialog.className='ws-dialog cloud-dialog';
    const title=document.createElement('h2');title.textContent=this.say('İnternete kayıt','Cloud save');dialog.append(title);
    const info=document.createElement('p');info.textContent=this.store.config?(this.store.email||this.say('Telefon ve bilgisayarda aynı hesapla giriş yapın.','Use the same account on your phone and computer.')):this.say('Bulut hizmeti henüz yapılandırılmadı. Bu cihazdaki kayıtlar korunuyor.','Cloud service is not configured yet. Local saves are preserved.');dialog.append(info);
    const status=document.createElement('p');status.setAttribute('role','status');dialog.append(status);
    const run=async(fn:()=>Promise<void>)=>{buttons.forEach(b=>b.disabled=true);status.textContent=this.say('İşlem sürüyor…','Working…');try{await fn();}catch(e){status.textContent=(e as Error).message;}finally{buttons.forEach(b=>b.disabled=false);}};
    const buttons:HTMLButtonElement[]=[];const button=(text:string,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;dialog.append(b);buttons.push(b);};
    if(this.store.config&&!this.store.session){
      const form=document.createElement('form');const email=document.createElement('input'),password=document.createElement('input');email.type='email';email.required=true;email.autocomplete='username';email.placeholder='E-posta / Email';email.setAttribute('aria-label','E-posta / Email');password.type='password';password.required=true;password.autocomplete='current-password';password.placeholder=this.say('Hesap parolası','Account password');password.setAttribute('aria-label',password.placeholder);form.append(email,password);dialog.append(form);
      const submit=document.createElement('button');submit.type='submit';submit.textContent=this.say('Giriş yap','Sign in');form.append(submit);buttons.push(submit);
      form.onsubmit=e=>{e.preventDefault();void run(async()=>{await this.store.signIn(email.value.trim(),password.value);password.value='';await this.sync();dialog.close();dialog.remove();this.open();});};
      button(this.say('Hesap oluştur','Create account'),()=>{if(!form.reportValidity())return;if(password.value.length<12){status.textContent=this.say('En az 12 karakterli bir parola seçin.','Choose a password with at least 12 characters.');return;}void run(async()=>{const signedIn=await this.store.signUp(email.value.trim(),password.value);password.value='';if(signedIn){await this.sync();dialog.close();dialog.remove();this.open();}else status.textContent=this.say('E-postanızdaki hesap doğrulama bağlantısını açın, ardından buradan giriş yapın.','Open the verification link in your email, then sign in here.');});});
    }else if(this.store.session){
      button(this.say('Bu sahneyi buluta kaydet','Save this scene online'),()=>void run(async()=>{const ok=await this.save(structuredClone(this.scene()));status.textContent=ok?this.status:this.say('Kayıt tamamlanmadı. Yerel kopya korundu.','Save incomplete. Local copy preserved.');}));
      button(this.say('Buluttaki sahneyi aç','Open cloud scene'),()=>void run(async()=>{const row=await this.store.read();if(!row)throw new Error(this.say('Henüz bulut kaydı yok.','No cloud save yet.'));localStorage.setItem('KS_ADT_BEFORE_CLOUD',JSON.stringify(this.scene()));localStorage.setItem(STORE,JSON.stringify(row.payload));this.apply(row.payload);this.accepted(row);dialog.close();dialog.remove();this.notify(this.say('Bulut sahnesi açıldı. Önceki sahne cihaz yedeğinde.','Cloud scene opened. Previous scene kept in a device backup.'));}));
      button(this.say('Çıkış yap','Sign out'),()=>{this.store.signOut();this.changed();dialog.close();dialog.remove();});
    }
    if(localStorage.getItem('KS_ADT_BEFORE_CLOUD'))button(this.say('Önceki cihaz sahnesini geri getir','Restore previous device scene'),()=>{try{this.apply(JSON.parse(localStorage.getItem('KS_ADT_BEFORE_CLOUD')!));this.pending=true;this.changed();dialog.close();dialog.remove();}catch(e){status.textContent=String(e);}});
    button(this.say('Kapat','Close'),()=>{dialog.close();dialog.remove();});dialog.oncancel=()=>dialog.remove();this.host.append(dialog);dialog.showModal();
  }
}
