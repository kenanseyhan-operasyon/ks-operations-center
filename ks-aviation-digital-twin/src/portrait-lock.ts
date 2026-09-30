type Turn=-90|0|90;
let turn:Turn=0;
let active=false;
let nativeRequested=false;
export function portraitViewport(width:number,height:number,locked:boolean,angle=90){
  const rotated=locked&&width>height;
  return {width:rotated?height:width,height:rotated?width:height,turn:(rotated?(angle===270||angle===-90?-90:90):0) as Turn};
}
/** Keep the complete airport UI in portrait, including browsers without orientation.lock. */
export function syncPortraitLock(locked:boolean){
  active=locked;
  const angle=screen.orientation?.angle??90,view=portraitViewport(innerWidth,innerHeight,locked,angle);
  turn=view.turn;document.body.classList.toggle('airport-portrait',locked);
  document.body.style.setProperty('--airport-width',`${view.width}px`);
  document.body.style.setProperty('--airport-height',`${view.height}px`);
  document.body.style.setProperty('--airport-turn',`${view.turn}deg`);
  const orientation=screen.orientation as ScreenOrientation&{lock?:(value:string)=>Promise<void>};
  if(locked&&document.fullscreenElement&&orientation?.lock&&!nativeRequested){nativeRequested=true;void orientation.lock('portrait-primary').catch(()=>{});}
  if(!locked&&nativeRequested){orientation?.unlock?.();nativeRequested=false;}
  if(!document.fullscreenElement)nativeRequested=false;
  return view;
}
export function portraitLockEnabled(){return active;}

export function portraitPoint(x:number,y:number,rect:{left:number;top:number;width:number;height:number},width:number,height:number,rotation:Turn):[number,number]{
  const u=(x-rect.left)/Math.max(1,rect.width),v=(y-rect.top)/Math.max(1,rect.height);
  return rotation===90?[v*width,(1-u)*height]:rotation===-90?[(1-v)*width,u*height]:[u*width,v*height];
}
/** Three.js and map gestures receive coordinates in the unrotated portrait canvas.
 * Native buttons retain normal browser hit testing. Document-level drag listeners
 * use the same mapping as canvas pointer-down, including pinch and gizmo gestures. */
export function portraitInput<T extends HTMLElement>(element:T):T{
  const proxies=new WeakMap<object,object>();
  const point=(event:MouseEvent)=>portraitPoint(event.clientX,event.clientY,element.getBoundingClientRect(),element.clientWidth,element.clientHeight,turn);
  const proxyTarget=(target:EventTarget):any=>{
    const existing=proxies.get(target);if(existing)return existing;
    const listeners=new Map<EventListenerOrEventListenerObject,Map<string,EventListener>>();
    const proxy=new Proxy(target,{get(object,key){
      if(key==='getBoundingClientRect'&&object===element)return ()=>({left:0,top:0,x:0,y:0,right:element.clientWidth,bottom:element.clientHeight,width:element.clientWidth,height:element.clientHeight});
      if(key==='ownerDocument')return proxyTarget(element.ownerDocument);
      if(key==='getRootNode')return ()=>proxyTarget(element.getRootNode());
      if(key==='addEventListener')return (type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{
        let byType=listeners.get(listener);if(!byType){byType=new Map();listeners.set(listener,byType);}
        const id=`${type}/${typeof options==='boolean'?options:!!options?.capture}`;
        let wrapped=byType.get(id);
        if(!wrapped){wrapped=(event:Event)=>{const mouse=event as MouseEvent,coords=typeof mouse.clientX==='number'?point(mouse):undefined;
          const mapped=coords?new Proxy(event,{get(e,k){if(k==='clientX'||k==='pageX')return coords[0];if(k==='clientY'||k==='pageY')return coords[1];const value=Reflect.get(e,k,e);return typeof value==='function'?value.bind(e):value;}}):event;
          if(typeof listener==='function')listener.call(element,mapped);else listener.handleEvent(mapped);
        };byType.set(id,wrapped);}
        object.addEventListener(type,wrapped,options);
      };
      if(key==='removeEventListener')return (type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>{const id=`${type}/${typeof options==='boolean'?options:!!options?.capture}`,wrapped=listeners.get(listener)?.get(id);if(wrapped){object.removeEventListener(type,wrapped,options);listeners.get(listener)?.delete(id);}};
      const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;
    }});
    proxies.set(target,proxy);return proxy;
  };
  return proxyTarget(element);
}
