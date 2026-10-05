import { CloudStore, sceneContent, type CloudRecord } from './cloud-store';
import type { SceneData } from './scene-data';
import { CloudAuth, type AuthViewState } from './cloud-auth';
import { CloudError, cloudErrorMessage } from './cloud-errors';
import type { AuthCallback } from './auth-callback';
import './cloud-auth.css';
const STORE='KS_DIGITAL_TWIN_ADB_V1',BASE='KS_ADT_CLOUD_BASE_V1';
export class CloudPanel{
  store=new CloudStore();pending=false;busy=false;private lang:'tr'|'en'='tr';
  private authState:AuthViewState={mode:'signin',email:'',retryAt:0};private authNotice='';private dialog?:HTMLDialogElement;
  constructor(private host:HTMLElement,private scene:()=>SceneData,private apply:(s:SceneData)=>void,private notify:(s:string)=>void,private changed:()=>void){}
  setLanguage(lang:'tr'|'en'){this.lang=lang;}
  private say(tr:string,en:string){return this.lang==='tr'?tr:en;}
  get status(){return this.busy?this.say('Bulut kaydediliyor…','Saving to cloud…'):this.store.recovering?this.say('Yeni şifre bekleniyor','New password required'):this.pending?this.say('Yerel kayıt var · bulut bekliyor','Local copy saved · cloud pending'):this.store.session?`${this.say('Bulut','Cloud')} · v${this.store.revision}`:this.say('Bu cihazda kayıt','Saved on this device');}
  private meta(){try{return JSON.parse(localStorage.getItem(BASE)||'null');}catch{return null;}}
  private accepted(row:CloudRecord){this.store.revision=row.revision;localStorage.setItem(BASE,JSON.stringify({userId:this.store.userId,revision:row.revision,content:sceneContent(row.payload)}));this.pending=false;this.changed();}
  async init(callback?:AuthCallback){
    try{await this.store.init(callback);if(this.store.session&&!this.store.recovering)await this.sync();if(this.store.session&&callback&&!('error' in callback)&&callback.type==='signup')this.authNotice=this.say('E-posta adresiniz doğrulandı. Hesabınız açık.','Your email has been verified. You are signed in.');}
    catch(e){this.authNotice=cloudErrorMessage(e,this.lang);this.notify(this.authNotice);}
    this.changed();if(callback||this.store.recovering)this.open();
  }
  private async sync(){
    const row=await this.store.read(),meta=this.meta(),local=localStorage.getItem(STORE);
    if(!row){this.store.revision=0;this.pending=true;this.changed();return;}
    if(!local||(meta?.userId===this.store.userId&&meta.content===sceneContent(this.scene()))){localStorage.setItem(STORE,JSON.stringify(row.payload));this.apply(row.payload);this.accepted(row);this.notify(this.say('Buluttaki güncel sahne açıldı.','Latest cloud scene loaded.'));}
    else if(meta?.userId===this.store.userId&&meta.revision===row.revision){this.store.revision=row.revision;this.pending=meta.content!==sceneContent(this.scene());this.changed();}
    else{this.store.revision=meta?.userId===this.store.userId?meta.revision:0;this.pending=true;this.changed();this.notify(this.say('Bulutta farklı bir sahne var. Bulut menüsünden açabilirsiniz; yerel çalışma korunuyor.','A different scene exists in the cloud. Open it from Cloud; local work is preserved.'));}
  }
  async save(snapshot:SceneData){
    localStorage.setItem(STORE,JSON.stringify(snapshot));
    if(!this.store.config||!this.store.session||this.store.recovering){this.pending=true;this.changed();this.notify(this.store.recovering?this.say('Bu cihaza kaydedildi. Bulut menüsünden yeni şifrenizi belirleyin.','Saved on this device. Set your new password in the Cloud menu.'):this.say('Bu cihaza kaydedildi. İnternete kaydetmek için Bulut menüsünden giriş yapın.','Saved on this device. Sign in through Cloud to save online.'));return true;}
    this.busy=true;this.changed();try{const row=await this.store.save(snapshot);this.accepted(row);this.notify(this.say(`İnternete kaydedildi · sürüm ${row.revision}.`,`Saved online · revision ${row.revision}.`));return true;}catch(e){this.pending=true;this.notify(`${cloudErrorMessage(e,this.lang)} ${this.say('Bu cihazdaki kopya korundu.','The local copy is safe.')}`);return false;}finally{this.busy=false;this.changed();}
  }
  open(){
    if(this.dialog?.open)return;
    const dialog=document.createElement('dialog');dialog.className='ws-dialog cloud-dialog';
    this.dialog=dialog;let auth:CloudAuth|undefined;
    const close=()=>{auth?.destroy();dialog.close();dialog.remove();if(this.dialog===dialog)this.dialog=undefined;};
    const title=document.createElement('h2');title.textContent=this.say('Bulut kayıt / hesap','Cloud save / account');dialog.append(title);
    if(!this.store.config||this.store.session){const info=document.createElement('p');info.textContent=this.store.config?this.store.email:this.say('Bulut hizmeti henüz yapılandırılmadı. Bu cihazdaki kayıtlar korunuyor.','Cloud service is not configured yet. Local saves are preserved.');dialog.append(info);}
    const status=document.createElement('p');status.setAttribute('role','status');dialog.append(status);
    const notice=this.authNotice;this.authNotice='';
    const run=async(fn:()=>Promise<void>)=>{buttons.forEach(b=>b.disabled=true);status.textContent=this.say('İşlem sürüyor…','Working…');try{await fn();}catch(e){status.textContent=cloudErrorMessage(e,this.lang);}finally{buttons.forEach(b=>b.disabled=false);}};
    const buttons:HTMLButtonElement[]=[];const button=(text:string,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;dialog.append(b);buttons.push(b);return b;};
    if(this.store.config&&(!this.store.session||this.store.recovering)){
      const host=document.createElement('section');dialog.append(host);
      auth=new CloudAuth(host,this.store,this.lang,this.authState,async(message)=>{
        // A cloud read failure must not make a successful login appear to have failed.
        try{await this.sync();}catch(e){this.notify(cloudErrorMessage(e,this.lang));}
        this.authState.mode='signin';this.authNotice=message||'';this.changed();close();this.open();
      },notice);
    }else if(this.store.session){
      status.textContent=notice||this.say('Hesabınız açık. Telefon ve bilgisayarda aynı e-posta adresini kullanın.','You are signed in. Use the same email on your phone and computer.');
      button(this.say('Bu sahneyi buluta kaydet','Save this scene online'),()=>void run(async()=>{const ok=await this.save(structuredClone(this.scene()));status.textContent=ok?this.status:this.say('Kayıt tamamlanmadı. Yerel kopya korundu.','Save incomplete. Local copy preserved.');}));
      button(this.say('Buluttaki sahneyi aç','Open cloud scene'),()=>void run(async()=>{const row=await this.store.read();if(!row)throw new CloudError('no_cloud_scene');localStorage.setItem('KS_ADT_BEFORE_CLOUD',JSON.stringify(this.scene()));localStorage.setItem(STORE,JSON.stringify(row.payload));this.apply(row.payload);this.accepted(row);close();this.notify(this.say('Bulut sahnesi açıldı. Önceki sahne cihaz yedeğinde.','Cloud scene opened. Previous scene kept in a device backup.'));}));
      button(this.say('Çıkış yap','Sign out'),()=>{this.store.signOut();this.authState.mode='signin';this.changed();close();this.open();});
    }
    if(localStorage.getItem('KS_ADT_BEFORE_CLOUD'))button(this.say('Önceki cihaz sahnesini geri getir','Restore previous device scene'),()=>{try{this.apply(JSON.parse(localStorage.getItem('KS_ADT_BEFORE_CLOUD')!));this.pending=true;this.changed();close();}catch(e){status.textContent=cloudErrorMessage(e,this.lang);}});
    button(this.say('Kapat','Close'),close).className='cloud-close';dialog.oncancel=e=>{e.preventDefault();close();};this.host.append(dialog);dialog.showModal();
  }
}
