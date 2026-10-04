import { validateScene, type SceneData } from './scene-data';

export type CloudConfig={url:string;anonKey:string};
type Session={access_token:string;refresh_token:string;expires_at:number;user:{id:string;email?:string}};
export type CloudRecord={revision:number;payload:SceneData;updated_at:string};
const SESSION='KS_ADT_CLOUD_AUTH_V1';
export class CloudConflict extends Error{}
export const sceneContent=(scene:SceneData)=>JSON.stringify({...scene,updatedAt:undefined});
/** Only a publishable/anon key enters the browser. All scene access is protected by Supabase Auth + RLS. */
export class CloudStore{
  config?:CloudConfig;session?:Session;revision=0;private refreshing?:Promise<void>;
  constructor(private request:typeof fetch=(...args)=>fetch(...args),private storage:Storage=localStorage){}
  get email(){return this.session?.user.email||'';}
  get userId(){return this.session?.user.id;}
  async init(){
    const response=await this.request('/cloud-config.json',{cache:'no-store'});
    if(!response.ok)return;
    const cfg=await response.json();
    if(typeof cfg.url!=='string'||!/^https:\/\/[-a-z0-9]+\.supabase\.co$/.test(cfg.url)||!cfg.anonKey)return;
    this.config=cfg;
    try{const s=JSON.parse(this.storage.getItem(SESSION)||'null');if(s?.refresh_token&&s?.user?.id)this.session=s;}catch{}
    if(this.session)await this.token();
  }
  private retain(value:Session & {expires_in?:number}){
    this.session={...value,expires_at:value.expires_at||Date.now()/1000+(value.expires_in||3600)};
    this.storage.setItem(SESSION,JSON.stringify(this.session));
  }
  private async api(path:string,init:RequestInit={},authenticated=true){
    if(!this.config)throw new Error('Bulut bağlantısı henüz etkin değil.');
    const authHeaders:Record<string,string>=authenticated?{Authorization:`Bearer ${await this.token()}`}:{ };
    const response=await this.request(this.config.url+path,{...init,signal:AbortSignal.timeout(20000),headers:{apikey:this.config.anonKey,...authHeaders,'Content-Type':'application/json',...init.headers}});
    const body=await response.json().catch(()=>null);
    if(!response.ok){if(body?.code==='40001')throw new CloudConflict('Başka cihaz bulut kaydını değiştirdi. Önce güncel bulut sahnesini açın; yerel çalışmanız korunuyor.');throw new Error(body?.msg||body?.message||body?.error_description||`Bulut bağlantı hatası (${response.status}).`);}
    return body;
  }
  private async token():Promise<string>{
    if(!this.session)throw new Error('Bulut kaydı için hesabınıza giriş yapın.');
    if(this.session.expires_at<Date.now()/1000+60){
      this.refreshing??=(async()=>{const value=await this.api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:this.session!.refresh_token})},false);this.retain(value);})().finally(()=>{this.refreshing=undefined;});
      await this.refreshing;
    }
    return this.session.access_token;
  }
  async signIn(email:string,password:string){this.retain(await this.api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})},false));this.revision=0;}
  async signUp(email:string,password:string){const value=await this.api('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password})},false);if(value.access_token)this.retain(value);return !!value.access_token;}
  signOut(){this.session=undefined;this.revision=0;this.storage.removeItem(SESSION);}
  async read():Promise<CloudRecord|undefined>{
    const rows=await this.api('/rest/v1/ks_adt_scenes?scene_id=eq.ADB&select=revision,payload,updated_at');
    if(!Array.isArray(rows))throw new Error('Bulut kaydı okunamadı.');
    const row=rows[0];return row?{...row,payload:validateScene(row.payload)}:undefined;
  }
  async save(scene:SceneData):Promise<CloudRecord>{
    const snapshot=validateScene(scene);
    const row=await this.api('/rest/v1/rpc/ks_adt_save_scene',{method:'POST',body:JSON.stringify({p_scene_id:'ADB',p_expected_revision:this.revision,p_payload:snapshot})});
    if(!row||!Number.isInteger(row.revision)||row.revision<=this.revision)throw new Error('Bulut kayıt onayı alınamadı.');
    this.revision=row.revision;return {...row,payload:snapshot};
  }
}
