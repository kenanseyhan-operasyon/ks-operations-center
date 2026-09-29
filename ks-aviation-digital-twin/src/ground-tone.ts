// A display treatment of bright, neutral pavement. Original georeferenced assets stay intact.
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function pavementTone(r:number,g:number,b:number):[number,number,number]{
  const amount=.8*smooth(130,190,Math.min(r,g,b))*(1-smooth(35,75,Math.max(r,g,b)-Math.min(r,g,b)));
  const grey=(r*.2126+g*.7152+b*.0722)*.77+13;
  return [r+(grey+5-r)*amount,g+(grey+3-g)*amount,b+(grey-b)*amount];
}
export function groundDisplayImage(image:HTMLImageElement,rect:{x:number;z:number;width:number;height:number}){
  if(!image.naturalWidth||typeof document==='undefined')return image;
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const c=canvas.getContext('2d')!;c.drawImage(image,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height),d=pixels.data;
  for(let y=0;y<canvas.height;y++){
    const v=(rect.z+y/canvas.height*rect.height+3850)/5100;
    if(v<.15||v>.88)continue;
    // Airport strip follows the runway axis; adjacent city and vegetation retain their colors.
    const west=.23+(v-.15)*.33,east=.465+(v-.15)*.36;
    for(let x=0;x<canvas.width;x++){
      const u=(rect.x+x/canvas.width*rect.width+1250)/3000;if(u<west||u>east)continue;
      const i=(y*canvas.width+x)*4;[d[i],d[i+1],d[i+2]]=pavementTone(d[i],d[i+1],d[i+2]);
    }
  }
  c.putImageData(pixels,0,0);return canvas;
}
