import { validateScene, type SceneData } from './scene-data';
import { CloudError, providerError, validateNewPassword } from './cloud-errors';
import type { AuthCallback } from './auth-callback';
export { CloudConflict } from './cloud-errors';

export type CloudConfig={url:string;anonKey:string};
type Session={access_token:string;refresh_token:string;expires_at:number;user:{id:string;email?:string};recovery?:boolean};
export type CloudRecord={revision:number;payload:SceneData;updated_at:string};
export type PublishedSave=CloudRecord&{published_revision:number};
const SESSION='KS_ADT_CLOUD_AUTH_V1';
export const sceneContent=(scene:SceneData)=>JSON.stringify({...scene,updatedAt:undefined});
/** Only a publishable/anon key enters the browser. All scene access is protected by Supabase Auth + RLS. */
export class CloudStore{
  config?:CloudConfig;session?:Session;revision=0;publishedRevision=0;editor=false;private refreshing?:Promise<void>;
  constructor(private request:typeof fetch=(...args)=>fetch(...args),private storage:Storage=localStorage){}
  get email(){return this.session?.user.email||'';}
  get userId(){return this.session?.user.id;}
  get recovering(){return this.session?.recovery===true;}
  async init(callback?:AuthCallback){
    const response=await this.request('/cloud-config.json',{cache:'no-store'});
    if(!response.ok)return;
    const cfg=await response.json();
    if(typeof cfg.url!=='string'||!/^https:\/\/[-a-z0-9]+\.supabase\.co$/.test(cfg.url)||!cfg.anonKey)return;
    this.config=cfg;
    try{const s=JSON.parse(this.storage.getItem(SESSION)||'null');if(s?.refresh_token&&s?.user?.id)this.session=s;}catch{}
    if(callback){await this.consumeCallback(callback);return;}
    if(this.session)await this.token();
  }
  private retain(value:Session & {expires_in?:number}){
    if(!value?.access_token||!value.refresh_token||!value.user?.id)throw new CloudError('unknown');
    this.session={...value,expires_at:value.expires_at||Date.now()/1000+(value.expires_in||3600)};
    this.storage.setItem(SESSION,JSON.stringify(this.session));
  }
  private async api(path:string,init:RequestInit={},authenticated=true){
    if(!this.config)throw new CloudError('unavailable');
    const authHeaders:Record<string,string>=authenticated?{Authorization:`Bearer ${await this.token()}`}:{ };
    let response:Response;
    try{response=await this.request(this.config.url+path,{...init,signal:AbortSignal.timeout(20000),headers:{apikey:this.config.anonKey,...authHeaders,'Content-Type':'application/json',...init.headers}});}
    catch(e){throw new CloudError(e instanceof Error&&['TimeoutError','AbortError'].includes(e.name)?'timeout':'network');}
    const body=await response.json().catch(()=>null);
    if(!response.ok)throw providerError(body,response.status);
    return body;
  }
  private async token():Promise<string>{
    if(!this.session)throw new CloudError('not_signed_in');
    if(this.session.expires_at<Date.now()/1000+60){
      this.refreshing??=(async()=>{try{const recovery=this.recovering;const value=await this.api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:this.session!.refresh_token})},false);this.retain({...value,recovery});}catch(e){if(e instanceof CloudError&&e.code==='session_expired')this.signOut();throw e;}})().finally(()=>{this.refreshing=undefined;});
      await this.refreshing;
    }
    return this.session.access_token;
  }
  async signIn(email:string,password:string){this.editor=false;this.retain(await this.api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})},false));this.revision=0;}
  async signUp(email:string,password:string,repeat:string,redirectTo:string){validateNewPassword(password,repeat);const value=await this.api('/auth/v1/signup?redirect_to='+encodeURIComponent(redirectTo),{method:'POST',body:JSON.stringify({email,password})},false);if(value?.access_token){this.retain(value);this.revision=0;}return !!value?.access_token;}
  async resendVerification(email:string,redirectTo:string){await this.api('/auth/v1/resend?redirect_to='+encodeURIComponent(redirectTo),{method:'POST',body:JSON.stringify({email,type:'signup'})},false);}
  async requestPasswordReset(email:string,redirectTo:string){await this.api('/auth/v1/recover?redirect_to='+encodeURIComponent(redirectTo),{method:'POST',body:JSON.stringify({email})},false);}
  private async consumeCallback(callback:AuthCallback){
    if('error' in callback)throw providerError({error_code:callback.error},400);
    // Ask Auth to validate the received token. Do not trust decoded JWT claims or URL-provided user IDs.
    const user=await this.api('/auth/v1/user',{headers:{Authorization:`Bearer ${callback.accessToken}`}},false);
    if(!user?.id)throw new CloudError('invalid_link');
    this.retain({access_token:callback.accessToken,refresh_token:callback.refreshToken,expires_at:Date.now()/1000+callback.expiresIn,user,recovery:callback.type==='recovery'});this.revision=0;
  }
  async updatePassword(password:string,repeat:string){
    validateNewPassword(password,repeat);if(!this.recovering)throw new CloudError('recovery_required');
    const user=await this.api('/auth/v1/user',{method:'PUT',body:JSON.stringify({password})});
    if(!user?.id||user.id!==this.userId)throw new CloudError('unknown');
    this.retain({...this.session!,user,recovery:false});
  }
  signOut(){this.session=undefined;this.revision=0;this.editor=false;this.storage.removeItem(SESSION);}
  async refreshEditor(){
    this.editor=false;if(!this.session||this.recovering)return false;
    const rows=await this.api('/rest/v1/ks_adt_editors?select=user_id&enabled=eq.true&user_id=eq.'+encodeURIComponent(this.userId!));
    this.editor=Array.isArray(rows)&&rows.some(r=>r.user_id===this.userId);return this.editor;
  }
  async readPublished():Promise<CloudRecord|undefined>{
    const rows=await this.api('/rest/v1/ks_adt_published_scenes?scene_id=eq.ADB&select=revision,payload,updated_at',{cache:'no-store'},false);
    if(!Array.isArray(rows))throw new CloudError('invalid_scene');
    const row=rows[0];if(!row)return;
    if(!Number.isInteger(row.revision)||row.revision<1)throw new CloudError('invalid_scene');
    return {...row,payload:validateScene(row.payload)};
  }
  async savePublished(scene:SceneData):Promise<PublishedSave>{
    if(!this.editor||!this.session||this.recovering)throw new CloudError('read_only');
    const snapshot=validateScene(scene),row=await this.api('/rest/v1/rpc/ks_adt_save_published_scene',{method:'POST',body:JSON.stringify({p_scene_id:'ADB',p_expected_revision:this.revision,p_expected_published_revision:this.publishedRevision,p_payload:snapshot})});
    if(!row||!Number.isInteger(row.revision)||row.revision<=this.revision||!Number.isInteger(row.published_revision)||row.published_revision<=this.publishedRevision)throw new CloudError('save_unconfirmed');
    this.revision=row.revision;this.publishedRevision=row.published_revision;return {...row,payload:snapshot};
  }
  async read():Promise<CloudRecord|undefined>{
    const rows=await this.api('/rest/v1/ks_adt_scenes?scene_id=eq.ADB&select=revision,payload,updated_at');
    if(!Array.isArray(rows))throw new CloudError('invalid_scene');
    const row=rows[0];return row?{...row,payload:validateScene(row.payload)}:undefined;
  }
  async save(scene:SceneData):Promise<CloudRecord>{
    const snapshot=validateScene(scene);
    const row=await this.api('/rest/v1/rpc/ks_adt_save_scene',{method:'POST',body:JSON.stringify({p_scene_id:'ADB',p_expected_revision:this.revision,p_payload:snapshot})});
    if(!row||!Number.isInteger(row.revision)||row.revision<=this.revision)throw new CloudError('save_unconfirmed');
    this.revision=row.revision;return {...row,payload:snapshot};
  }
}
