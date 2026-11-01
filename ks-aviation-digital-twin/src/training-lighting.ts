import * as T from 'three';

/** Keep daylight colour and reflections without any shadow-map passes. */
export class TrainingLighting{
 private environment:T.WebGLRenderTarget;
 constructor(private renderer:T.WebGLRenderer,private scene:T.Scene,private sun:T.DirectionalLight,private sky:T.HemisphereLight,mobile=false){
  void mobile;
  renderer.shadowMap.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
  sun.castShadow=false;sun.position.set(-120,240,90);scene.add(sun.target);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d')!,gradient=ctx.createLinearGradient(0,0,0,256);
  gradient.addColorStop(0,'#a6bed1');gradient.addColorStop(.48,'#dce3e4');gradient.addColorStop(.53,'#a8b0a6');gradient.addColorStop(1,'#646c60');ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256);
  const glow=ctx.createRadialGradient(220,65,0,220,65,45);glow.addColorStop(0,'rgba(255,251,232,1)');glow.addColorStop(.3,'rgba(255,251,232,.7)');glow.addColorStop(1,'rgba(255,251,232,0)');ctx.fillStyle=glow;ctx.fillRect(170,15,100,100);
  const source=new T.CanvasTexture(canvas);source.colorSpace=T.SRGBColorSpace;source.mapping=T.EquirectangularReflectionMapping;
  const pmrem=new T.PMREMGenerator(renderer);this.environment=pmrem.fromEquirectangular(source);this.environment.texture.name='TRAINING_DAYLIGHT_REFLECTIONS';source.dispose();pmrem.dispose();scene.environment=this.environment.texture;
 }
 prepare(root:T.Object3D){root.traverse(node=>{if(node instanceof T.Mesh)node.castShadow=node.receiveShadow=false;});}
 update(_target:T.Vector3,night:boolean){
  this.sky.color.set('#c9dbea');this.sky.groundColor.set('#727b69');this.sky.intensity=night?.28:.95;this.sun.intensity=night?.1:3.2;this.scene.environmentIntensity=night?.06:.5;
 }
 dispose(){if(this.scene.environment===this.environment.texture)this.scene.environment=null;this.environment.dispose();}
}

