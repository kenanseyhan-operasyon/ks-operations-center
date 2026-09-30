type WebkitDocument=Document&{webkitFullscreenElement?:Element;webkitExitFullscreen?:()=>Promise<void>|void};
type WebkitElement=HTMLElement&{webkitRequestFullscreen?:()=>Promise<void>|void};
export function fullscreenState(doc:Document=document){return !!(doc.fullscreenElement||(doc as WebkitDocument).webkitFullscreenElement);}
export function standaloneDisplay(){return matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;}
export async function toggleNativeFullscreen(doc:Document=document):Promise<'entered'|'exited'|'unavailable'>{
  const d=doc as WebkitDocument,root=doc.documentElement as WebkitElement;
  try{
    if(fullscreenState(doc)){if(doc.exitFullscreen)await doc.exitFullscreen();else if(d.webkitExitFullscreen)await d.webkitExitFullscreen();else return 'unavailable';return 'exited';}
    if(root.requestFullscreen)await root.requestFullscreen({navigationUI:'hide'});else if(root.webkitRequestFullscreen)await root.webkitRequestFullscreen();else return 'unavailable';
    return fullscreenState(doc)?'entered':'unavailable';
  }catch{return 'unavailable';}
}
export function setupFullscreen(button:HTMLElement,language:()=>string,onChange:()=>void){
  let panel:HTMLElement|undefined;
  const refresh=()=>{const tr=language()==='tr',full=fullscreenState(),installed=standaloneDisplay();button.textContent=full?'×':installed?'✓':'⛶';const label=full?(tr?'Tam ekrandan çık':'Exit fullscreen'):installed?(tr?'Uygulama görünümü açık':'App view is active'):(tr?'Tam ekran':'Fullscreen');button.title=label;button.setAttribute('aria-label',label);};
  const guidance=()=>{
    panel?.remove();const tr=language()==='tr',installed=standaloneDisplay();
    panel=document.createElement('aside');panel.className='fullscreen-help';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',tr?'Tam ekran yardımı':'Fullscreen help');
    panel.innerHTML=`<strong>${installed?(tr?'Uygulama görünümü açık':'App view is active'):(tr?'iPhone’da uygulama görünümü':'App view on iPhone')}</strong><p>${installed?(tr?'Siteyi Ana Ekran simgesinden açtınız. Tarayıcı çubukları olmadan kullanıyorsunuz.':'You opened the site from its Home Screen icon, without browser toolbars.'):(tr?'Bu tarayıcıda sayfa tam ekranı açılamadı. iPhone’da tarayıcı çubuklarını kaldırmak için:':'Page fullscreen could not open in this browser. To remove browser toolbars on iPhone:')}</p>${installed?'':`<ol><li>${tr?'Bu adresi Safari’de aç.':'Open this address in Safari.'}</li><li>${tr?'Paylaş → Ana Ekrana Ekle.':'Share → Add to Home Screen.'}</li><li>${tr?'Varsa “Web Uygulaması Olarak Aç” seçeneğini açık tut ve Ekle’ye bas.':'Keep “Open as Web App” on, if shown, and tap Add.'}</li><li>${tr?'Ana Ekrandaki KS Aviation simgesinden aç.':'Open the KS Aviation icon on your Home Screen.'}</li></ol>`}<button type="button">${tr?'Tamam':'OK'}</button>`;
    document.querySelector('#app')!.appendChild(panel);const close=()=>{panel?.remove();panel=undefined;button.focus();};panel.querySelector('button')!.onclick=close;panel.addEventListener('keydown',e=>{if(e.key==='Escape')close();});panel.querySelector('button')!.focus();
  };
  button.onclick=()=>{if(standaloneDisplay()&&!fullscreenState()){guidance();return;}void toggleNativeFullscreen().then(result=>{refresh();if(result==='unavailable')guidance();});};
  for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,()=>{refresh();onChange();});
  refresh();return refresh;
}
