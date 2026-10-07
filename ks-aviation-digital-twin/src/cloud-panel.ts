import {CloudStore,sceneContent,type CloudRecord,type PublishedSave} from './cloud-store';
import {validateScene,type SceneData} from './scene-data';
import {CloudAuth,type AuthViewState} from './cloud-auth';
import {CloudError,cloudErrorMessage} from './cloud-errors';
import type {AuthCallback} from './auth-callback';
import './cloud-auth.css';
const STORE='KS_DIGITAL_TWIN_ADB_V1',BASE='KS_ADT_CLOUD_BASE_V1';
export class CloudPanel{
  pending=false;busy=false;private ready=false;private lang:'tr'|'en'='tr';private published?:CloudRecord;private fallback:SceneData;
  private authState:AuthViewState={mode:'signin',email:'',retryAt:0};private authNotice='';private dialog?:HTMLDialogElement;
  constructor(private host:HTMLElement,private scene:()=>SceneData,private apply:(s:SceneData)=>void,private notify:(s:string)=>void,private changed:()=>void,public store=new CloudStore(),private storage:Storage=localStorage){this.fallback=structuredClone(scene());}
  setLanguage(lang:'tr'|'en'){this.lang=lang;}
  private say(tr:string,en:string){return this.lang==='tr'?tr:en;}
  get canEdit(){return this.ready&&this.store.editor&&!!this.store.session&&!this.store.recovering;}
  get status(){
    if(this.busy)return this.say('Kaydediliyor ve yayınlanıyor…','Saving and publishing…');
    if(this.store.recovering)return this.say('Yeni şifre bekleniyor','New password required');
    if(!this.ready)return this.say('Ortak sahne yükleniyor…','Loading shared scene…');
    if(this.canEdit&&this.pending)return this.say('Cihazdaki çalışma korunuyor · yayın bekliyor','Device draft preserved · not yet published');
    const version=this.published?` · ${this.say('ortak kayıt','shared revision')} ${this.published.revision}`:'';
    return (this.canEdit?this.say('Tasarımcı','Designer'):this.say('Gösterim · kayıt kapalı','Viewing · saving disabled'))+version;
  }
  private meta(){try{return JSON.parse(this.storage.getItem(BASE)||'null');}catch{return null;}}
  private rememberBase(payload:SceneData){
    this.storage.setItem(STORE,JSON.stringify(payload));
    this.storage.setItem(BASE,JSON.stringify({userId:this.store.userId,revision:this.store.revision,publishedRevision:this.store.publishedRevision,content:sceneContent(payload)}));
  }
  private accepted(row:PublishedSave){
    this.published={revision:row.published_revision,payload:row.payload,updated_at:row.updated_at};
    try{this.rememberBase(row.payload);}catch{this.notify(this.say('Yayın tamamlandı; cihaz yedeği yazılamadı.','Publishing completed; the device backup could not be written.'));}this.pending=false;this.changed();
  }
  async init(callback?:AuthCallback){
    try{await this.store.init(callback);}catch(e){this.authNotice=cloudErrorMessage(e,this.lang);this.notify(this.authNotice);}
    try{await this.sync();}catch(e){this.notify(cloudErrorMessage(e,this.lang));}
    this.ready=true;this.changed();
    if(this.store.session&&callback&&!('error' in callback)&&callback.type==='signup')this.authNotice=this.say('E-posta adresiniz doğrulandı. Hesabınız açık.','Your email has been verified. You are signed in.');
    if(callback||this.store.recovering)this.open();
  }
  /** The shared scene is the default for both owner accounts and every visitor.
   * Old local data is examined only after the server grants editor access. */
  private async sync(restoreDraft=true){
    this.ready=false;this.changed();
    try{
      try{await this.store.refreshEditor();}catch(e){this.notify(cloudErrorMessage(e,this.lang));}
      const [row,personal]=await Promise.all([this.store.readPublished(),this.store.editor?this.store.read():Promise.resolve(undefined)]);
      this.published=row;this.store.publishedRevision=row?.revision||0;this.store.revision=personal?.revision||0;this.pending=false;
      let next=row?.payload||this.fallback;
      if(this.store.editor&&restoreDraft){
        const meta=this.meta(),raw=this.storage.getItem(STORE);
        if(raw&&meta?.userId===this.store.userId){
          try{const local=validateScene(JSON.parse(raw));if(meta.content!==sceneContent(local)){
            next=local;this.pending=true;this.store.revision=Number.isInteger(meta.revision)?meta.revision:0;this.store.publishedRevision=Number.isInteger(meta.publishedRevision)?meta.publishedRevision:0;
            this.notify(this.say('Bu cihazdaki yayınlanmamış çalışma korundu. Ortak kayıt değiştiyse önce son sahneyi açın.','This device’s unpublished draft was preserved. If the shared scene changed, open its latest version first.'));
          }}catch{this.notify(this.say('Cihaz kaydı okunamadı. Yayınlanan sahne açıldı.','Device data could not be read. The published scene was opened.'));}
        }
      }
      this.apply(structuredClone(next));
      if(this.store.editor&&!this.pending){try{
        const raw=this.storage.getItem(STORE);if(restoreDraft&&raw&&sceneContent(validateScene(JSON.parse(raw)))!==sceneContent(next))this.storage.setItem('KS_ADT_BEFORE_CLOUD',raw);
        this.rememberBase(next);
      }catch{this.notify(this.say('Ortak sahne açıldı; cihaz yedeği güncellenemedi.','Shared scene opened; the device backup could not be updated.'));}}
    }finally{this.ready=true;this.changed();}
  }
  async reloadPublished(){
    if(this.canEdit)this.storage.setItem('KS_ADT_BEFORE_CLOUD',JSON.stringify(this.scene()));
    await this.sync(false);this.notify(this.say('Yayınlanan son sahne açıldı.','The latest published scene was opened.'));
  }
  async signOut(){
    this.store.signOut();this.pending=false;this.authState.mode='signin';this.changed();
    this.apply(structuredClone(this.published?.payload||this.fallback));
    try{await this.sync(false);}catch(e){this.notify(cloudErrorMessage(e,this.lang));}
  }
  async save(snapshot:SceneData){
    if(!this.canEdit){this.notify(cloudErrorMessage(new CloudError('read_only'),this.lang));return false;}
    snapshot=validateScene(snapshot);
    this.storage.setItem(STORE,JSON.stringify(snapshot));
    this.busy=true;this.changed();
    try{const row=await this.store.savePublished(snapshot);this.accepted(row);this.notify(this.say(`Kaydedildi ve herkes için yayınlandı · ortak kayıt ${row.published_revision}.`,`Saved and published for everyone · shared revision ${row.published_revision}.`));return true;}
    catch(e){this.pending=true;if(e instanceof CloudError&&['read_only','session_expired'].includes(e.code))this.store.editor=false;this.notify(`${cloudErrorMessage(e,this.lang)} ${this.say('Bu cihazdaki kopya korundu.','The local copy is safe.')}`);return false;}
    finally{this.busy=false;this.changed();}
  }
  open(){
    if(this.dialog?.open)return;
    const dialog=document.createElement('dialog');dialog.className='ws-dialog cloud-dialog';this.dialog=dialog;let auth:CloudAuth|undefined;
    const close=()=>{auth?.destroy();dialog.close();dialog.remove();if(this.dialog===dialog)this.dialog=undefined;};
    const title=document.createElement('h2');title.textContent=this.say('Bulut kayıt / hesap','Cloud save / account');dialog.append(title);
    const info=document.createElement('p');info.textContent=this.canEdit?this.say('Tasarımcı hesabı. Kaydettiğiniz sahne siteyi açan herkese gösterilir.','Designer account. Saved scenes are shown to everyone who opens the site.'):this.say('Gösterim modu. Sahneyi inceleyebilir ve araçları deneyebilirsiniz. Kalıcı değişiklik için tasarımcı hesabıyla giriş yapın.','Viewing mode. Explore the scene and try the vehicles. Sign in with a designer account to save changes.');dialog.append(info);
    if(this.store.session){const email=document.createElement('p');email.textContent=this.store.email;dialog.append(email);}
    const status=document.createElement('p');status.setAttribute('role','status');dialog.append(status);const notice=this.authNotice;this.authNotice='';
    const buttons:HTMLButtonElement[]=[];
    const run=async(fn:()=>Promise<void>)=>{buttons.forEach(b=>b.disabled=true);status.textContent=this.say('İşlem sürüyor…','Working…');try{await fn();}catch(e){status.textContent=cloudErrorMessage(e,this.lang);}finally{buttons.forEach(b=>b.disabled=false);}};
    const button=(text:string,fn:()=>void,parent:HTMLElement=dialog)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;parent.append(b);buttons.push(b);return b;};
    if(this.store.config&&(!this.store.session||this.store.recovering)){
      const host=document.createElement('section');dialog.append(host);
      auth=new CloudAuth(host,this.store,this.lang,this.authState,async(message)=>{
        try{await this.sync();}catch(e){this.notify(cloudErrorMessage(e,this.lang));}
        this.authState.mode='signin';this.authNotice=message||'';this.changed();close();this.open();
      },notice);
    }else status.textContent=notice||this.status;
    if(this.canEdit){
      button(this.say('Kaydet ve herkes için yayınla','Save and publish for everyone'),()=>void run(async()=>{const ok=await this.save(structuredClone(this.scene()));status.textContent=ok?this.status:this.say('Yayın tamamlanmadı. Cihazdaki kopya korundu.','Publishing incomplete. Device copy preserved.');}));
      const backups=document.createElement('details'),summary=document.createElement('summary');summary.textContent=this.say('Kişisel kayıt ve cihaz yedeği','Personal save and device backup');backups.append(summary);dialog.append(backups);
      button(this.say('Kişisel bulut kaydını aç','Open personal cloud save'),()=>void run(async()=>{const row=await this.store.read();if(!row)throw new CloudError('no_cloud_scene');this.storage.setItem('KS_ADT_BEFORE_CLOUD',JSON.stringify(this.scene()));this.apply(row.payload);this.store.revision=row.revision;this.pending=true;this.changed();close();}),backups);
      if(this.storage.getItem('KS_ADT_BEFORE_CLOUD'))button(this.say('Önceki cihaz sahnesini geri getir','Restore previous device scene'),()=>{try{this.apply(validateScene(JSON.parse(this.storage.getItem('KS_ADT_BEFORE_CLOUD')!)));this.pending=true;this.changed();close();}catch(e){status.textContent=cloudErrorMessage(e,this.lang);}},backups);
    }
    if(this.store.config)button(this.say('Yayınlanan son sahneyi aç','Open latest published scene'),()=>void run(async()=>{await this.reloadPublished();close();}));
    if(this.store.session)button(this.say('Çıkış yap','Sign out'),()=>void run(async()=>{await this.signOut();close();this.open();}));
    button(this.say('Kapat','Close'),close).className='cloud-close';dialog.oncancel=e=>{e.preventDefault();close();};this.host.append(dialog);dialog.showModal();
  }
}
