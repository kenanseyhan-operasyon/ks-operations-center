import * as T from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {Pass} from 'three/examples/jsm/postprocessing/Pass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/examples/jsm/postprocessing/SMAAPass.js';
import {FXAAPass} from 'three/examples/jsm/postprocessing/FXAAPass.js';

/** A real pixel ceiling, including high-DPI screens. A small desktop density
 * floor keeps thin rails smooth without stacking multisampling and SMAA. */
export function antialiasSize(width:number,height:number,dpr:number,mobile=false){
 const budget=mobile?1500000:3000000;
 const ratio=Math.min(Math.max(dpr,mobile?1:1.5),mobile?1.25:1.5,Math.sqrt(budget/Math.max(1,width*height)));
 return {width:Math.max(1,Math.floor(width*ratio)),height:Math.max(1,Math.floor(height*ratio))};
}

/** Keep the map and equipment in separate depth layers, then smooth the complete
 * image. Canvas MSAA alone leaves long shallow edges visibly stair-stepped. */
class WorldPass extends Pass{
 constructor(private ground:T.Scene,private world:T.Scene,private camera:T.Camera){super();this.needsSwap=false;}
 render(renderer:T.WebGLRenderer,_write:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  const color=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha();
  renderer.setRenderTarget(read);renderer.setClearColor(color,alpha);
  renderer.clear();renderer.render(this.ground,this.camera);renderer.clearDepth();renderer.render(this.world,this.camera);
 }
}
export class SceneAntialias{
 private composer:EffectComposer;
 private size='';
 readonly method:'SMAA'|'FXAA';
 constructor(private renderer:T.WebGLRenderer,ground:T.Scene,world:T.Scene,camera:T.Camera,private mobile=false){
  const floating=renderer.extensions.has('EXT_color_buffer_float');this.method=floating?'SMAA':'FXAA';
  const target=new T.WebGLRenderTarget(1,1,{type:floating?T.HalfFloatType:T.UnsignedByteType,samples:0});
  target.texture.name='SceneAntialias.linear';this.composer=new EffectComposer(renderer,target);
  // Only the scene buffer needs depth. SMAA provides the sole edge filter.
  this.composer.renderTarget1.samples=0;this.composer.renderTarget1.depthBuffer=false;this.composer.setPixelRatio(1);
  this.composer.addPass(new WorldPass(ground,world,camera));
  if(floating)this.composer.addPass(new SMAAPass());
  this.composer.addPass(new OutputPass());
  if(!floating)this.composer.addPass(new FXAAPass());
 }
 render(dt=0){
  const renderer=this.renderer,size=renderer.getSize(new T.Vector2()),resolution=antialiasSize(size.x,size.y,renderer.getPixelRatio(),this.mobile),key=`${resolution.width}/${resolution.height}`;
  if(key!==this.size){this.size=key;this.composer.setSize(resolution.width,resolution.height);}
  const color=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha();
  try{this.composer.render(dt);}finally{renderer.setClearColor(color,alpha);}
 }
 dispose(){this.composer.passes.forEach(pass=>pass.dispose());this.composer.dispose();}
}

