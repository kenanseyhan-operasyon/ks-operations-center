import * as THREE from 'three';
import atlas from './ground-atlas.json';
import { groundDisplayImage } from './ground-tone';
/** Fixed, georeferenced rasters. Airport and facility share these exact meshes.
 * No terrain, tile eviction, zoom-dependent replacement or camera-dependent offsets. */
export const GROUND_BOUNDS={minX:-1250,maxX:1750,minZ:-3850,maxZ:1250};
/** Limit zoom, while allowing the view centre to move beyond the raster edges. */
export function boundedView(center:[number,number],span:number){return {center:center.map(v=>Number.isFinite(v)?v:0) as [number,number],span:Math.max(15,Math.min(20000,Number.isFinite(span)?span:180))};}
export class StaticGround{
  group=new THREE.Group();enabled=true;ready=0;failed=0;
  private layers:{image:HTMLImageElement|HTMLCanvasElement;rect:typeof atlas[number];ready:boolean}[]=[];
  constructor(private change:()=>void){
    atlas.forEach((rect,index)=>{const image=new Image(),layer:{image:HTMLImageElement|HTMLCanvasElement;rect:typeof rect;ready:boolean}={image,rect,ready:false};this.layers.push(layer);
      image.onload=()=>{layer.image=groundDisplayImage(image,rect);layer.ready=true;this.ready++;const texture=new THREE.Texture(layer.image);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.needsUpdate=true;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(rect.width,rect.height),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,depthTest:false,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(rect.x+rect.width/2,-.04,rect.z+rect.height/2);mesh.renderOrder=10+index;this.group.add(mesh);this.change();};
      image.onerror=()=>{this.failed++;this.change();};image.src=rect.url;
    });
  }
  draw(c:CanvasRenderingContext2D){if(!this.enabled)return;for(const l of this.layers)if(l.ready)c.drawImage(l.image,l.rect.x,l.rect.z,l.rect.width,l.rect.height);}
  sync(enabled:boolean){this.enabled=enabled;this.group.visible=enabled;}
}
