import { Client, handle_file } from '@gradio/client';
export function validateGLB(buffer) {
  const b = Buffer.from(buffer);
  if(b.length<20 || b.toString('ascii',0,4)!=='glTF' || b.readUInt32LE(4)!==2 || b.readUInt32LE(8)!==b.length) throw new Error('Geçerli bir GLB 2.0 modeli alınamadı.');
  const length=b.readUInt32LE(12);
  if(b.readUInt32LE(16)!==0x4e4f534a || length+20>b.length) throw new Error('GLB başlığı geçersiz.');
  const doc=JSON.parse(b.toString('utf8',20,20+length).trim());
  if(!doc.meshes?.length)throw new Error('Modelde üçgen yüzey bulunamadı.');
  for(const item of [...(doc.buffers||[]),...(doc.images||[])]) if(item.uri&&!item.uri.startsWith('data:')) throw new Error('Model harici dosyalara bağlı; gömülü GLB gerekli.');
  return doc;
}
export function safeModelURL(value) {
  const url=new URL(value);
  if(url.protocol!=='https:' || url.username || url.password || (url.port && url.port!=='443') || !(['huggingface.co','hf.co'].includes(url.hostname) || ['.hf.space','.huggingface.co','.hf.co'].some(x=>url.hostname.endsWith(x)))) throw new Error('Üretim servisi beklenmeyen bir indirme adresi döndürdü.');
  return url;
}
export async function downloadModel(value, signal) {
  let url=safeModelURL(value);
  for(let redirects=0;redirects<6;redirects++){
    const r=await fetch(url,{redirect:'manual',signal});
    if([301,302,303,307,308].includes(r.status)){url=safeModelURL(new URL(r.headers.get('location'),url).href);continue;}
    if(!r.ok)throw new Error('Üretilen model indirilemedi.');
    if(Number(r.headers.get('content-length'))>40*1024*1024)throw new Error('Üretilen model 40 MB sınırını aşıyor.');
    const parts=[];let size=0;
    for await(const chunk of r.body){size+=chunk.length;if(size>40*1024*1024){await r.body.cancel().catch(()=>{});throw new Error('Üretilen model çok büyük.');}parts.push(chunk);}
    const result=Buffer.concat(parts);validateGLB(result);return result;
  }
  throw new Error('Model indirme yönlendirmesi tamamlanamadı.');
}
export function friendlyEngineError(error) {
  const raw=String(error?.message||error||'');
  if(/worker error/i.test(raw))return 'Hugging Face GPU sunucusu hata verdi. Bu servis hatasıdır; daha sonra tekrar dene.';
  if(/quota|ZeroGPU|GPU.*quota|sign.?in|log.?in|token|unauthorized|401|403/i.test(raw)) return 'Üretim servisinin ücretsiz GPU erişimi veya kotası uygun değil. Hugging Face hesabı bağlantısı gerekebilir. GLB düzenlemeye devam edebilirsin.';
  if(/timeout|abort|cancel/i.test(raw))return 'Üretim zaman aşımına uğradı veya iptal edildi. Tekrar deneyebilirsin.';
  return '3D üretim servisine şu anda ulaşılamıyor veya üretim tamamlanamadı. GLB düzenlemeye devam edebilirsin.';
}
export async function generateTripoSR(bytes,type,{signal,onProgress=()=>{},token=process.env.HF_TOKEN,space=process.env.TRIPOSR_SPACE||'stabilityai/TripoSR'}={}) {
  let client,submission;
  const abort=()=>{try{submission?.cancel();}catch{}try{client?.close();}catch{}};
  signal?.addEventListener('abort',abort,{once:true});
  try{
    onProgress('Üretim servisine bağlanılıyor…');
    client=await Client.connect(space,{hf_token:token||undefined,events:['status','data']});
    if(signal?.aborted)throw new Error('aborted');
    const api=await client.view_api();
    if(!api.named_endpoints?.['/preprocess']||!api.named_endpoints?.['/generate'])throw new Error('Üretim API sözleşmesi değişti.');
    onProgress('Fotoğrafın arka planı hazırlanıyor…');
    submission=client.submit('/preprocess',[handle_file(new Blob([bytes],{type})),true,0.85]);
    let prepared;
    for await(const event of submission){if(signal?.aborted)throw new Error('aborted');if(event.type==='data')prepared=event.data?.[0];if(event.type==='status'&&event.stage==='error')throw new Error(event.message||'preprocess failed');}
    if(!prepared)throw new Error('Ön işlem sonucu alınamadı.');
    onProgress('GPU sırası bekleniyor…');
    submission=client.submit('/generate',[prepared,256]);
    let output;
    for await(const event of submission){
      if(signal?.aborted)throw new Error('aborted');
      if(event.type==='status'){
        if(event.stage==='error')throw new Error(event.message||'generation failed');
        onProgress(event.stage==='pending'?'GPU sırası bekleniyor…':'3D yüzey oluşturuluyor…');
      }
      if(event.type==='data')output=event.data?.[1];
    }
    if(!output?.url)throw new Error('Üretim servisi GLB döndürmedi.');
    onProgress('GLB doğrulanıyor…');
    return await downloadModel(output.url,signal);
  }finally{signal?.removeEventListener('abort',abort);try{client?.close();}catch{}}
}

export async function generateTripoSG(bytes,type,{signal,onProgress=()=>{},token=process.env.HF_TOKEN}={}){
  let client,submission;
  const abort=()=>{try{submission?.cancel();}catch{}try{client?.close();}catch{}};
  signal?.addEventListener('abort',abort,{once:true});
  async function call(endpoint,payload,message){
    if(signal?.aborted)throw new Error('aborted');onProgress(message);
    submission=client.submit(endpoint,payload);let data;
    for await(const event of submission){
      if(signal?.aborted)throw new Error('aborted');
      if(event.type==='status'&&event.stage==='error')throw new Error(event.message||'generation failed');
      if(event.type==='status')onProgress(message+(typeof event.queue_size==='number'?' · Sıra: '+event.queue_size:''));
      if(event.type==='data')data=event.data;
    }
    if(!data)throw new Error('Üretim adımı tamamlanamadı.');return data;
  }
  try{
    onProgress('TripoSG servisine bağlanılıyor…');
    client=await Client.connect('VAST-AI/TripoSG',{hf_token:token||undefined,events:['status','data']});
    const api=await client.view_api();
    if(!api.named_endpoints?.['/run_segmentation']||!api.named_endpoints?.['/image_to_3d'])throw new Error('TripoSG API sözleşmesi değişti.');
    if(api.named_endpoints['/start_session'])await call('/start_session',[],'Üretim oturumu açılıyor…');
    const prepared=await call('/run_segmentation',[handle_file(new Blob([bytes],{type}))],'Fotoğrafın arka planı hazırlanıyor…');
    const outputs=await call('/image_to_3d',[prepared[0],0,30,7,true,50000],'TripoSG ile 3D yüzey oluşturuluyor…');
    if(!outputs[0]?.url)throw new Error('TripoSG GLB döndürmedi.');
    onProgress('GLB doğrulanıyor…');return await downloadModel(outputs[0].url,signal);
  }finally{signal?.removeEventListener('abort',abort);try{client?.close();}catch{}}
}
export async function generateModel(bytes,type,options={}){
  if(process.env.MODEL_ENGINE==='triposg')return generateTripoSG(bytes,type,options);
  if(process.env.MODEL_ENGINE==='triposr')return generateTripoSR(bytes,type,options);
  return generateTrellis2(bytes,type,options);
}

export async function generateTrellis2(bytes,type,{signal,onProgress=()=>{},token=process.env.HF_TOKEN,connect=Client.connect}={}){
  if(!token)throw new Error('Hugging Face token required');
  let client,submission;
  const abort=()=>{try{submission?.cancel();}catch{}try{client?.close();}catch{}};
  signal?.addEventListener('abort',abort,{once:true});
  async function call(endpoint,payload,message){
    if(signal?.aborted)throw new Error('aborted');
    onProgress(message);submission=client.submit(endpoint,payload);let data;
    for await(const event of submission){
      if(signal?.aborted)throw new Error('aborted');
      if(event.type==='status'&&event.stage==='error')throw new Error([event.title,event.message].filter(Boolean).join(': ')||'generation failed');
      if(event.type==='status'&&Number.isFinite(event.position))onProgress(message+' · Sıra: '+(event.position+1));
      if(event.type==='data')data=event.data;
    }
    if(!data)throw new Error('Üretim adımı tamamlanamadı.');return data;
  }
  try{
    onProgress('TRELLIS.2 servisine bağlanılıyor…');
    client=await connect('microsoft/TRELLIS.2',{hf_token:token,events:['status','data']});
    const api=await client.view_api();
    for(const name of ['/start_session','/preprocess_image','/image_to_3d','/extract_glb'])if(!api.named_endpoints?.[name])throw new Error('TRELLIS.2 API sözleşmesi değişti.');
    await call('/start_session',[],'Üretim oturumu açılıyor…');
    const prepared=await call('/preprocess_image',[handle_file(new Blob([bytes],{type}))],'Fotoğraf hazırlanıyor…');
    await call('/image_to_3d',[prepared[0],0,'512',7.5,0.7,12,5,7.5,0.5,12,3,1,0,12,3],'TRELLIS.2 ile şekil ve doku üretiliyor…');
    const outputs=await call('/extract_glb',[500000,1024],'Model GLB dosyasına dönüştürülüyor…');
    const url=typeof outputs[0]==='string'?outputs[0]:outputs[0]?.url;
    if(!url)throw new Error('TRELLIS.2 GLB döndürmedi.');
    onProgress('GLB indiriliyor ve doğrulanıyor…');return await downloadModel(url,signal);
  }finally{signal?.removeEventListener('abort',abort);try{client?.close();}catch{}}
}
