import * as T from 'three';

/** A spatial index for parallel decal rays. Raycasting every shell triangle
 * for every paint vertex used to block the main thread during vehicle setup. */
export function surfaceProjector(mesh:T.Mesh){
 const g=mesh.geometry,p=g.attributes.position,index=g.index,points:T.Vector3[]=[];
 for(let i=0;i<p.count;i++)points.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));
 const bounds=new T.Box3().setFromPoints(points),size=bounds.getSize(new T.Vector3()),n=32;
 const cells:number[][]=Array.from({length:n*n},()=>[]),triangles:number[][]=[];
 const cell=(value:number,min:number,span:number)=>T.MathUtils.clamp(Math.floor((value-min)/Math.max(span,1e-12)*n),0,n-1);
 for(let i=0;i<(index?.count||p.count);i+=3){
  const a=points[index?index.getX(i):i],b=points[index?index.getX(i+1):i+1],c=points[index?index.getX(i+2):i+2];
  const bx=b.x-a.x,by=b.y-a.y,cx=c.x-a.x,cy=c.y-a.y,det=bx*cy-by*cx;
  if(Math.abs(det)<1e-18)continue;
  const material=Array.isArray(mesh.material)?mesh.material[g.groups.find(group=>i>=group.start&&i<group.start+group.count)?.materialIndex||0]:mesh.material;
  const t=triangles.push([a.x,a.y,a.z,bx,by,b.z-a.z,cx,cy,c.z-a.z,det,material.side])-1;
  const x0=cell(Math.min(a.x,b.x,c.x),bounds.min.x,size.x),x1=cell(Math.max(a.x,b.x,c.x),bounds.min.x,size.x);
  const y0=cell(Math.min(a.y,b.y,c.y),bounds.min.y,size.y),y1=cell(Math.max(a.y,b.y,c.y),bounds.min.y,size.y);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)cells[y*n+x].push(t);
 }
 return (x:number,y:number,side:number):number|undefined=>{
  let nearest:number|undefined;
  if(x<bounds.min.x||x>bounds.max.x||y<bounds.min.y||y>bounds.max.y)return;
  for(const i of cells[cell(y,bounds.min.y,size.y)*n+cell(x,bounds.min.x,size.x)]){
   const t=triangles[i];if(t[10]===T.FrontSide&&t[9]*side<=0||t[10]===T.BackSide&&t[9]*side>=0)continue;
   const dx=x-t[0],dy=y-t[1],u=(dx*t[7]-dy*t[6])/t[9],v=(t[3]*dy-t[4]*dx)/t[9];
   if(u< -1e-10||v< -1e-10||u+v>1+1e-10)continue;
   const z=t[2]+u*t[5]+v*t[8];if(nearest===undefined||side*z>side*nearest)nearest=z;
  }
  return nearest;
 };
}
