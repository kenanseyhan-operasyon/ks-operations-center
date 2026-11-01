import * as T from 'three';
import {surfaceProjector} from './surface-projector';

/** Imported lettering has T junctions between its many tiny coplanar triangles.
 * Bake their union to one mipmapped paint mask, on a continuous curved decal. */
export function stabilizeVehicleMarkings(model:T.Object3D,ownGeometry:(g:T.BufferGeometry)=>T.BufferGeometry,ownMaterial:(m:T.Material)=>void){
 model.updateWorldMatrix(true,true);
 const shell=model.getObjectByName('Tank_Shell'),shellBounds=shell?new T.Box3().setFromObject(shell):undefined;
 const project=shell instanceof T.Mesh?surfaceProjector(shell):undefined;
 model.traverse(node=>{
  if(!(node instanceof T.Mesh)||! /^(?:Cab_SOCAR_Wordmark|SOCAR_Tank_Wordmark|SOCAR_Flame_)/.test(node.name)||Array.isArray(node.material))return;
  const source=node.geometry,p=source.attributes.position,index=source.index,points:Array<T.Vector3>=[];
  for(let i=0;i<p.count;i++)points.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(node.matrixWorld));
  const bounds=new T.Box3().setFromPoints(points),size=bounds.getSize(new T.Vector3());if(size.x<=0||size.y<=0)return;
  const width=size.x>=size.y?1024:Math.max(64,Math.ceil(1024*size.x/size.y)),height=size.y>=size.x?1024:Math.max(64,Math.ceil(1024*size.y/size.x));
  const bytes=new Uint8Array(width*height*4),pixel=points.map(v=>new T.Vector2((v.x-bounds.min.x)/size.x*(width-2)+1,(v.y-bounds.min.y)/size.y*(height-2)+1));
  const cross=(a:T.Vector2,b:T.Vector2,x:number,y:number)=>(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);
  for(let i=0;i<(index?.count||p.count);i+=3){
   const v=[0,1,2].map(k=>pixel[index?index.getX(i+k):i+k]),area=cross(v[0],v[1],v[2].x,v[2].y);if(Math.abs(area)<1e-9)continue;
   const sign=Math.sign(area),margin=v.map((a,k)=>-.2*a.distanceTo(v[(k+1)%3]));
   const x0=Math.max(0,Math.floor(Math.min(...v.map(a=>a.x))-1)),x1=Math.min(width-1,Math.ceil(Math.max(...v.map(a=>a.x))+1)),y0=Math.max(0,Math.floor(Math.min(...v.map(a=>a.y))-1)),y1=Math.min(height-1,Math.ceil(Math.max(...v.map(a=>a.y))+1));
   const edge=v.map((a,k)=>{const b=v[(k+1)%3],dx=b.x-a.x,dy=b.y-a.y;return [-dy*sign,dx*sign,(dy*a.x-dx*a.y)*sign-margin[k]];});
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(edge[0][0]*(x+.5)+edge[0][1]*(y+.5)+edge[0][2]>=0&&edge[1][0]*(x+.5)+edge[1][1]*(y+.5)+edge[1][2]>=0&&edge[2][0]*(x+.5)+edge[2][1]*(y+.5)+edge[2][2]>=0){const j=(y*width+x)*4;bytes[j]=bytes[j+1]=bytes[j+2]=bytes[j+3]=255;}
  }
  const texture=new T.DataTexture(bytes,width,height);texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=true;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.anisotropy=8;texture.needsUpdate=true;texture.name=node.name+'_PAINT';
  const geometry=ownGeometry(new T.PlaneGeometry(size.x,size.y,Math.max(2,Math.ceil(28*size.x/Math.max(size.x,size.y))),Math.max(2,Math.ceil(28*size.y/Math.max(size.x,size.y))))),positions=geometry.attributes.position,uv=geometry.attributes.uv,inverse=node.matrixWorld.clone().invert(),center=bounds.getCenter(new T.Vector3()),cab=node.name.startsWith('Cab_'),side=Math.sign(center.z-(shellBounds?.getCenter(new T.Vector3()).z??.155))||1;
  for(let i=0;i<positions.count;i++){
   const v=new T.Vector3(positions.getX(i)+center.x,positions.getY(i)+center.y,center.z);
   if(!cab&&project){const z=project(v.x,v.y,side);if(z!==undefined)v.z=z+side*.0012;}
   v.applyMatrix4(inverse);positions.setXYZ(i,v.x,v.y,v.z);
   uv.setXY(i,(1+uv.getX(i)*(width-2))/width,(1+uv.getY(i)*(height-2))/height);
  }
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();node.geometry=geometry;
  const material=node.material.clone() as T.MeshStandardMaterial;material.map=texture;material.side=T.DoubleSide;material.alphaTest=.35;material.roughness=.7;material.metalness=0;material.addEventListener('dispose',()=>texture.dispose());ownMaterial(material);node.material=material;
 });
}

