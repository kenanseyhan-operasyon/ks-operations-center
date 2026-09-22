import * as THREE from 'three';
import atlas from './ground-atlas.json';
/** Fixed, georeferenced rasters. Airport and facility share these exact meshes.
 * No terrain, tile eviction, zoom-dependent replacement or camera-dependent offsets. */
export const GROUND_BOUNDS={minX:-1250,maxX:1750,minZ:-3850,maxZ:1250};
export function boundedView(center:[number,number],span:number){return {center:[Math.max(GROUND_BOUNDS.minX,Math.min(GROUND_BOUNDS.maxX,center[0])),Math.max(GROUND_BOUNDS.minZ,Math.min(GROUND_BOUNDS.maxZ,center[1]))] as [number,number],span:Math.max(15,Math.min(16000,span))};}
export class StaticGround{
  group=new THREE.Group();enabled=true;ready=0;failed=0;
  private layers:{image:HTMLImageElement;rect:typeof atlas[number];ready:boolean}[]=[];
  constructor(private change:()=>void){
    atlas.forEach((rect,index)=>{const image=new Image(),layer={image,rect,ready:false};this.layers.push(layer);
      image.onload=()=>{layer.ready=true;this.ready++;const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.needsUpdate=true;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(rect.width,rect.height),new THREE.MeshBasicMaterial({map:texture,depthTest:false,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(rect.x+rect.width/2,-.04,rect.z+rect.height/2);mesh.renderOrder=10+index;this.group.add(mesh);this.change();};
      image.onerror=()=>{this.failed++;this.change();};image.src=rect.url;
    });
  }
  draw(c:CanvasRenderingContext2D){if(!this.enabled)return;for(const l of this.layers)if(l.ready)c.drawImage(l.image,l.rect.x,l.rect.z,l.rect.width,l.rect.height);}
  sync(enabled:boolean){this.enabled=enabled;this.group.visible=enabled;}
}
