import * as T from 'three';
import type {V3} from './personnel-navigation';
const cache=new WeakMap<T.Mesh,{matrix:string;lines:[V3,V3][]}>();
/** Follow the centre of the actual tube through horizontal sections. A curved
 * ladder rail cannot be represented by the diagonal of its bounding box. */
export function meshGripLines(mesh:T.Mesh):[V3,V3][]{
  mesh.updateWorldMatrix(true,false);const key=mesh.matrixWorld.elements.join(','),saved=cache.get(mesh);if(saved?.matrix===key)return saved.lines;
  const g=mesh.geometry,p=g.attributes.position,vertices=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld)),indices=g.index?.array||vertices.map((_,i)=>i);
  const box=new T.Box3().setFromPoints(vertices),height=box.max.y-box.min.y,points:V3[]=[];
  if(height>.12){
    for(let slice=0;slice<=20;slice++){
      const y=T.MathUtils.lerp(box.min.y+.003,box.max.y-.003,slice/20),section=new T.Box3();
      for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){
        const a=vertices[indices[i+j]],b=vertices[indices[i+(j+1)%3]];
        if((a.y<=y&&b.y>=y||b.y<=y&&a.y>=y)&&Math.abs(a.y-b.y)>1e-8)section.expandByPoint(a.clone().lerp(b,(y-a.y)/(b.y-a.y)));
      }
      if(!section.isEmpty())points.push(section.getCenter(new T.Vector3()).toArray() as V3);
    }
  }else{const a=box.getCenter(new T.Vector3()),b=a.clone(),s=box.getSize(new T.Vector3()),axis=s.x>s.z?'x':'z';a[axis]=box.min[axis];b[axis]=box.max[axis];points.push(a.toArray() as V3,b.toArray() as V3);}
  const lines=points.slice(1).map((p,i)=>[points[i],p] as [V3,V3]);cache.set(mesh,{matrix:key,lines});return lines;
}
