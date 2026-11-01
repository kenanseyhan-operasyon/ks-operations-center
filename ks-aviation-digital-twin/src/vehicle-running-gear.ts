import * as T from 'three';
import {R14,R14_WHEEL_SCALE} from './r14-spec';

/** Keep axle rods and fixed arches concentric with the smaller grounded tyres.
 * Work on clone-owned vertices, including parts already attached to the trailer. */
export function refitWheelSurrounds(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry){
  model.updateWorldMatrix(true,true);
  model.traverse(n=>{
    if(!(n instanceof T.Mesh)||!/^(Axle(?:_\d+)?|Clean_(Mid|Rear)_Fender(?:_\d+)?)$/.test(n.name))return;
    const centre=new T.Box3().setFromObject(n).getCenter(new T.Vector3());
    const g=own(n.geometry.clone()),p=g.attributes.position,inverse=n.matrixWorld.clone().invert();
    for(let i=0;i<p.count;i++){
      const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld);
      v.x=centre.x+(v.x-centre.x)*R14_WHEEL_SCALE;
      v.y=R14.axleY+(v.y-(-.354))*R14_WHEEL_SCALE;
      v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);
    }
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();n.geometry=g;
  });
}
