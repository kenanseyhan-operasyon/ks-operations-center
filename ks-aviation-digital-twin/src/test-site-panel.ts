import {validateScene, type SceneData} from './scene-data';
import {TEST_SCENE_KEY} from './site-mode';
export const TEST_SCENE_SEED_MARKER='KS_3D_TEST_IMPORTED_GEMINI_SCENE_V1';
export const TEST_SCENE_PREVIOUS_BACKUP='KS_3D_TEST_PREVIOUS_LOCAL_BACKUP_V1';
import type {AuthCallback} from './auth-callback';

/** Test saves never use CloudStore, production credentials, or a remote write endpoint. */
export class TestSitePanel {
  pending=false;
  busy=false;
  private ready=false;
  private lang:'tr'|'en'='tr';
  private dialog?:HTMLDialogElement;
  constructor(
    private host:HTMLElement,
    private scene:()=>SceneData,
    private apply:(scene:SceneData)=>void,
    private notify:(message:string)=>void,
    private changed:()=>void,
    private storage:Storage=localStorage,
    private request:typeof fetch=(...args)=>fetch(...args),
  ){}
  private say(tr:string,en:string){return this.lang==='tr'?tr:en;}
  setLanguage(lang:'tr'|'en'){this.lang=lang;}
  get canEdit(){return this.ready;}
  get status(){
    if(!this.ready)return this.say('Test sahnesi yükleniyor…','Loading test scene…');
    if(this.pending)return this.say('3D TEST · kayıt başarısız; JSON yedeği alın','3D TEST · save failed; export a JSON backup');
    return this.say('3D TEST · kayıt yalnızca bu tarayıcıda','3D TEST · saves stay in this browser');
  }
  async init(_callback?:AuthCallback){
    let saved:SceneData|undefined, raw:string|null=null;
    try{
      raw=this.storage.getItem(TEST_SCENE_KEY);
      if(raw)saved=validateScene(JSON.parse(raw));
    }catch{
      this.notify(this.say('Test kaydı okunamadı. Son yayınlanan başlangıç sahnesi açılacak.','Test save could not be read. Opening the bundled scene.'));
    }
    let seed:SceneData|undefined;
    try{
      const response=await this.request('/data/adb-test-seed.json',{cache:'no-store'});
      if(!response.ok)throw new Error('seed unavailable');
      seed=validateScene(await response.json());
    }catch{
      if(!saved)throw new Error(this.say('ADB test başlangıç sahnesi yüklenemedi. Sayfayı yenileyin.','Could not load the ADB test scene. Reload the page.'));
      this.notify(this.say('Bağlantı yok; cihazdaki son test kaydı açıldı.','Offline: the latest local test save was opened.'));
    }
    let next=saved||seed;
    if(seed){
      // When a newer Gemini snapshot is bundled, keep the previous browser scene
      // as a separately recoverable backup before making that snapshot the default.
      const version=String(seed.updatedAt||'')+':'+seed.entities.length;
      const previous=this.storage.getItem(TEST_SCENE_SEED_MARKER);
      if(!saved||previous!==version){
        if(saved&&raw){
          try{this.storage.setItem(TEST_SCENE_PREVIOUS_BACKUP,raw);}
          catch{
            this.notify(this.say('Eski test çalışması yedeklenemedi; bu cihazdaki çalışma korunuyor.','Could not back up the older test scene; the local version is preserved.'));
            next=saved;seed=undefined;
          }
        }
        if(seed){
          next=seed;
          try{
            this.storage.setItem(TEST_SCENE_KEY,JSON.stringify(seed));
            this.storage.setItem(TEST_SCENE_SEED_MARKER,version);
            if(saved)this.notify(this.say('Gemini son tesisi açıldı. Eski tarayıcı sahnenizin yedeği saklandı.','Latest Gemini facility loaded. The previous browser scene has been backed up.'));
          }catch{this.notify(this.say('Yeni tesis açıldı ancak yerel yedek yazılamadı. JSON dışarı aktar ile koruyun.','New facility opened but could not be saved locally. Export JSON to keep it.'));}
        }
      }
    }
    if(!next)throw new Error(this.say('ADB test sahnesi bulunamadı.','ADB test scene is unavailable.'));
    this.apply(structuredClone(next));
    this.ready=true;
    this.changed();
  }
  async save(snapshot:SceneData){
    if(!this.ready)return false;
    try{
      this.storage.setItem(TEST_SCENE_KEY,JSON.stringify(validateScene(snapshot)));
      this.pending=false;
      this.notify(this.say('Test sahnesi bu tarayıcıya kaydedildi.','Test scene saved in this browser.'));
      return true;
    }catch{
      this.pending=true;
      this.notify(this.say('Test kaydı yazılamadı. Çalışmanız açık; JSON dışarı aktar ile yedekleyin.','Could not save the test scene. Your work is still open; export a JSON backup.'));
      return false;
    }finally{this.changed();}
  }
  open(){
    if(this.dialog?.open)return;
    const dialog=document.createElement('dialog');dialog.className='ws-dialog cloud-dialog';this.dialog=dialog;
    const title=document.createElement('h2');title.textContent='Kenan Seyhan 3D Test';dialog.append(title);
    for(const message of [
      this.say('ADB tesisinin kopyasında araçları, ekipmanları ve Nathan’ın 16 hareketini deneyebilirsiniz.','Try vehicles, equipment and Nathan’s 16 animations in a copy of the ADB facility.'),
      this.say('Kaydet, çalışmayı yalnızca bu cihazdaki tarayıcıda tutar. Ana sahneye yayın yapılmaz. Tarayıcı verilerini silerseniz yerel kayıt da silinir.','Save keeps your work only in this browser on this device. It does not publish to the main scene. Clearing browser data also removes this save.'),
      this.say('Telefon ve bilgisayar arasında aktarmak veya yedeklemek için Çizim / Tasarım → JSON dışarı aktar / içeri al kullanın.','Use Draw / Design → Export / Import JSON to back up or transfer work between your phone and computer.'),
    ]){const p=document.createElement('p');p.textContent=message;dialog.append(p);}
    if(this.storage.getItem(TEST_SCENE_PREVIOUS_BACKUP)){
      const restore=document.createElement('button');restore.type='button';
      restore.textContent=this.say('Önceki test sahnemin yedeğini aç','Open previous local test backup');
      restore.onclick=()=>{try{
        const old=validateScene(JSON.parse(this.storage.getItem(TEST_SCENE_PREVIOUS_BACKUP)!));
        this.apply(structuredClone(old));this.storage.setItem(TEST_SCENE_KEY,JSON.stringify(old));this.changed();dialog.close();dialog.remove();this.dialog=undefined;
        this.notify(this.say('Önceki test sahnesi geri getirildi.','Previous test scene restored.'));
      }catch{this.notify(this.say('Önceki yedek açılamadı.','Could not open the previous backup.'));}};
      dialog.append(restore);
    }
    const close=()=>{dialog.close();dialog.remove();this.dialog=undefined;};
    const button=document.createElement('button');button.textContent=this.say('Kapat','Close');button.onclick=close;dialog.append(button);
    dialog.oncancel=e=>{e.preventDefault();close();};this.host.append(dialog);dialog.showModal();
  }
}
