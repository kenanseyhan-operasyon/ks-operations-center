import * as THREE from 'three';
import type {Entity} from './scene-data';
import {SOCAR_LOGO} from './socar-logo';
export function tankLogoGeometry(radius:number,width:number,height:number,angle:number){
  const arc=Math.min(Math.PI*.85,width/radius);
  return new THREE.CylinderGeometry(radius,radius,height,Math.max(24,Math.ceil(arc*48)),1,true,angle-arc/2,arc);
}
/** Two separately wrapped decals: text stays readable on the opposite face. */
export function makeTankLogos(o:Entity){
  const g=new THREE.Group();g.name='TANK_OPPOSITE_LOGOS';const f=o.facility||{};if(f.logoEnabled===false)return g;
  const width=f.logoWidth??Math.min(5,o.radius*1.2),height=Math.min(f.logoHeight??Math.min(1.8,o.height*.2),o.height*.9);
  const y=Math.max(.18+height/2,Math.min(o.height+.18-height/2,f.logoElevation??o.height*.68));
  const material=new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,roughness:.8,polygonOffset:true,polygonOffsetFactor:-2});
  for(const side of [0,Math.PI]){const m=new THREE.Mesh(tankLogoGeometry(o.radius+.018,width,height,(f.logoAngle??90)*Math.PI/180+side),material);m.position.y=y;m.name=side?'TANK_LOGO_BACK':'TANK_LOGO_FRONT';m.userData.facilityDecoration=true;m.raycast=()=>{};g.add(m);}
  if(typeof document==='undefined')return g;
  let disposed=false;material.addEventListener('dispose',()=>{disposed=true;});
  const img=document.createElement('img');img.onload=()=>{
    if(disposed)return;const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)return;
    canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;ctx.drawImage(img,0,0);
    // Discard transparent margins without changing the artwork or aspect ratio.
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,y0=canvas.height,x1=0,y1=0;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>12){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    if(x1<x0||y1<y0)return;const trimmed=document.createElement('canvas');trimmed.width=Math.min(2048,Math.max(256,x1-x0+1));trimmed.height=Math.max(64,Math.round(trimmed.width*(y1-y0+1)/(x1-x0+1)));trimmed.getContext('2d')!.drawImage(img,x0,y0,x1-x0+1,y1-y0+1,0,0,trimmed.width,trimmed.height);
    const texture=new THREE.CanvasTexture(trimmed);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;material.map=texture;material.opacity=1;material.needsUpdate=true;
  };img.src=f.logoData||SOCAR_LOGO;return g;
}
