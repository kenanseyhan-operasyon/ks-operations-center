import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export type V=[number,number,number];
const steel='#aebbbe',red='#bc302a';
export class Builder{
  g=new THREE.Group();mats=new Map<string,THREE.MeshStandardMaterial>();
  mat(c:string){let m=this.mats.get(c);if(!m){m=new THREE.MeshStandardMaterial({color:c,roughness:.68,metalness:c===steel?.45:.08});this.mats.set(c,m);}return m;}
  mesh(geo:THREE.BufferGeometry,p:V,c:string,parent:THREE.Object3D=this.g){const m=new THREE.Mesh(geo,this.mat(c));m.position.fromArray(p);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  glow(mesh:THREE.Mesh,intensity:number){const base=mesh.material as THREE.MeshStandardMaterial,key=`${base.color.getHexString()}:glow:${intensity}`;let mat=this.mats.get(key);if(!mat){mat=base.clone();mat.emissive.copy(mat.color);mat.emissiveIntensity=0;mat.userData.nightGlow=intensity;this.mats.set(key,mat);}mesh.material=mat;return mesh;}
  box(w:number,h:number,l:number,p:V,c=steel,parent?:THREE.Object3D){return this.mesh(new THREE.BoxGeometry(Math.max(.001,w),Math.max(.001,h),Math.max(.001,l)),p,c,parent);}
  cyl(r:number,h:number,p:V,c=steel,top=r,parent?:THREE.Object3D){return this.mesh(new THREE.CylinderGeometry(top,r,h,16),p,c,parent);}
  ball(r:number,p:V,c=steel,parent?:THREE.Object3D){return this.mesh(new THREE.SphereGeometry(r,12,8),p,c,parent);}
  rod(a:V,b:V,r=.026,c=steel,parent?:THREE.Object3D){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const m=this.cyl(r,Math.max(.001,delta.length()),av.add(bv).multiplyScalar(.5).toArray() as V,c,r,parent);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
  tube(points:V[],r=.065,c=red,parent?:THREE.Object3D){for(let i=1;i<points.length;i++)this.rod(points[i-1],points[i],r,c,parent);for(const p of points.slice(1,-1))this.ball(r,p,c,parent);}
  flange(p:V,c=red,axis:'z'|'x'|'y'='z',r=.14){const m=this.cyl(r,.045,p,c);if(axis==='z')m.rotation.x=Math.PI/2;else if(axis==='x')m.rotation.z=Math.PI/2;for(let i=0;i<6;i++){const a=i*Math.PI/3,u=Math.cos(a)*r*.78,v=Math.sin(a)*r*.78,q:V=axis==='z'?[p[0]+u,p[1]+v,p[2]+.027]:axis==='x'?[p[0]+.027,p[1]+u,p[2]+v]:[p[0]+u,p[1]+.027,p[2]+v];this.ball(.017,q,steel);}}
  rail(points:V[],c=steel,height=1.05){this.tube(points.map(p=>[p[0],p[1]+height,p[2]]),.024,c);this.tube(points.map(p=>[p[0],p[1]+height*.5,p[2]]),.017,c);for(const p of points)this.rod(p,[p[0],p[1]+height,p[2]],.024,c);}
  grate(w:number,l:number,y:number,z=0,c=steel){this.box(.07,.12,l,[-w/2,y-.06,z],c);this.box(.07,.12,l,[w/2,y-.06,z],c);const n=Math.min(100,Math.ceil(l/.1));for(let i=0;i<=n;i++)this.box(w,.028,.023,[0,y,z-l/2+l*i/n],c);for(const x of [-w*.25,0,w*.25])this.box(.02,.018,l,[x,y-.015,z],c);}
  label(text:string,w:number,h:number,p:V,bg='#ffffff',fg='#243738',ground=false,parent:THREE.Object3D=this.g,symbol?:string){
    if(typeof document==='undefined')return;const canvas=document.createElement('canvas'),aspect=Math.max(.08,w/Math.max(.01,h));let cw=Math.round(Math.min(2048,Math.max(256,512*Math.sqrt(aspect)))),ch=Math.max(64,Math.round(cw/aspect));if(ch>2048){cw=Math.round(cw*2048/ch);ch=2048;}canvas.width=cw;canvas.height=ch;let ctx:CanvasRenderingContext2D|null;try{ctx=canvas.getContext('2d');}catch{return;}if(!ctx)return;
    if(bg!=='transparent'){ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);}ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';
    if(symbol==='assembly'){ctx.save();ctx.scale(cw/768,ch/384);
      for(const x of [330,384,438]){ctx.beginPath();ctx.arc(x,145,14,0,Math.PI*2);ctx.fill();ctx.fillRect(x-10,165,20,45);}
      for(const [x,y,r] of [[245,80,Math.PI/4],[520,80,3*Math.PI/4],[245,260,-Math.PI/4],[520,260,-3*Math.PI/4]]){ctx.save();ctx.translate(x,y);ctx.rotate(r);ctx.fillRect(-40,-6,60,12);ctx.beginPath();ctx.moveTo(40,0);ctx.lineTo(6,-23);ctx.lineTo(6,23);ctx.fill();ctx.restore();}
      ctx.font='bold 28px Arial';ctx.fillText(text,384,326,720);
      ctx.restore();
    }else{let size=ch*.68,lines:string[]=[];for(let attempt=0;attempt<45;attempt++){ctx.font=`700 ${size}px Arial, sans-serif`;lines=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const candidate=(line+' '+word).trim();if(line&&ctx.measureText(candidate).width>cw*.91){lines.push(line);line=word;}else line=candidate;}lines.push(line);}if(lines.length*size*1.12<=ch*.85&&lines.every(line=>ctx!.measureText(line).width<=cw*.92))break;size*=.9;}lines.forEach((line,i)=>ctx!.fillText(line,cw/2,ch/2+(i-(lines.length-1)/2)*size*1.12));}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;const material=new THREE.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.12,transparent:bg==='transparent',side:THREE.FrontSide,roughness:.95,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,depthWrite:bg!=='transparent'});const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);m.position.fromArray(p);if(ground)m.rotation.x=-Math.PI/2;m.receiveShadow=true;m.userData.signText=text;m.userData.facilityDecoration=true;parent.add(m);return m;
  }
  finish(){
    // Batch static geometry by material; moving handles, doors and labels retain their identity.
    const groups=new Map<THREE.Material,THREE.Mesh[]>();for(const node of [...this.g.children])if(node instanceof THREE.Mesh&&!node.name&&!Array.isArray(node.material)&&!(node.material as THREE.MeshStandardMaterial).map){const list=groups.get(node.material)||[];list.push(node);groups.set(node.material,list);}
    for(const [mat,list] of groups)if(list.length>1){const geometries=list.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});const merged=mergeGeometries(geometries,false);for(const geo of geometries)geo.dispose();if(!merged)continue;for(const m of list){this.g.remove(m);m.geometry.dispose();}const m=new THREE.Mesh(merged,mat);m.castShadow=true;m.receiveShadow=true;this.g.add(m);}
    return this.g;
  }
}

