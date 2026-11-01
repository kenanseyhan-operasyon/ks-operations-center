import * as T from 'three';

/** Band-limited variation in metre-based UVs: no high-contrast pixel noise that
 * sparkles at grazing camera angles. Relief is millimetres, not terrain height. */
export function groundSurfaceMaterial(color:string,grass:boolean){
 const size=256,data=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4),base=new T.Color(color).convertLinearToSRGB().toArray();
 const hash=(x:number,y:number)=>{let n=Math.imul(x+91,374761393)^Math.imul(y+137,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
 const noise=(x:number,y:number)=>{const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),t=v*v*(3-2*v);return T.MathUtils.lerp(T.MathUtils.lerp(hash(a,b),hash(a+1,b),s),T.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),s),t);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const n=.6*noise(x/17,y/17)+.3*noise(x/5,y/5)+.1*hash(x,y),shade=grass?.93+n*.12:.96+n*.06,i=(y*size+x)*4;
  for(let c=0;c<3;c++){data[i+c]=Math.min(255,Math.round(base[c]*255*shade));height[i+c]=Math.round(n*255);}data[i+3]=height[i+3]=255;
 }
 const texture=(bytes:Uint8Array)=>{const t=new T.DataTexture(bytes,size,size);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;t.needsUpdate=true;return t;};
 const map=texture(data),bump=texture(height);map.colorSpace=T.SRGBColorSpace;
 const material=new T.MeshStandardMaterial({color:'#ffffff',map,bumpMap:bump,bumpScale:grass?.012:.0012,roughness:grass?1:.94,metalness:0,envMapIntensity:.2});
 material.name=grass?'TRAINING_GRASS':'TRAINING_CONCRETE';material.addEventListener('dispose',()=>bump.dispose());return material;
}
