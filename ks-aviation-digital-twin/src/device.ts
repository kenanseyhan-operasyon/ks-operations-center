/** Screen size and input capability, not user-agent sniffing. */
export function deviceProfile(width:number,height:number,coarse=false,touches=0,dpr=1){
  const compact=width<=700||(height<=520&&width<=1100);
  const mobile=compact||(coarse&&touches>0);
  return {compact,mobile,pixelRatio:Math.min(dpr,mobile?1.25:1.6),initialView:mobile?'2d' as const:'3d' as const};
}
export function currentDevice(){return deviceProfile(innerWidth,innerHeight,matchMedia('(pointer: coarse)').matches,navigator.maxTouchPoints,devicePixelRatio||1);}
/** Hold the existing, painted map until its replacements have all arrived. */
export function retainedTiles<T extends {key:string;ready:boolean}>(old:T[],next:T[]):T[]{
  if(next.length&&next.every(t=>t.ready))return next;
  const keys=new Set(next.map(t=>t.key));
  return [...old.filter(t=>t.ready&&!keys.has(t.key)).slice(-64),...next];
}
export function pinchView(center:[number,number],span:number,width:number,height:number,oldMid:[number,number],newMid:[number,number],ratio:number){
  const nextSpan=Math.max(15,Math.min(20000,span/Math.max(.05,ratio)));
  return {span:nextSpan,center:[center[0]+(oldMid[0]-width/2)*span/width-(newMid[0]-width/2)*nextSpan/width,center[1]+(oldMid[1]-height/2)*span/width-(newMid[1]-height/2)*nextSpan/width] as [number,number]};
}
