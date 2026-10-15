import * as T from 'three';
import {R14} from './r14-spec';
/** Fill measured gaps in the supplied access geometry with visible fixed rungs.
 * The source GLB is never changed. All added parts follow their original parent. */
export function completeVehicleSteps(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry,material:T.Material){
  model.updateWorldMatrix(true,true);
  for(const kind of ['rear','platform']){
    const steps:T.Mesh[]=[];model.traverse(n=>{if(n instanceof T.Mesh&&(kind==='rear'?/^Rear_Ladder_Close_Step(?:_|$)/:/^Fixed_Step(?:_|$)/).test(n.name))steps.push(n);});
    steps.sort((a,b)=>new T.Box3().setFromObject(a).max.y-new T.Box3().setFromObject(b).max.y);if(!steps.length)continue;
    const first=new T.Box3().setFromObject(steps[0]),last=new T.Box3().setFromObject(steps.at(-1)!);
    const floor=model.getObjectByName(kind==='rear'?'Tank_Top_Walkway':'Platform_Grey_Floor');if(!floor)continue;
    const tops=[R14.axleY-R14.tyreRadius,...steps.map(s=>new T.Box3().setFromObject(s).max.y),new T.Box3().setFromObject(floor).max.y];
    let serial=0;
    for(let i=1;i<tops.length;i++){
      const rise=tops[i]-tops[i-1],count=Math.ceil(rise/.058);
      for(let j=1;j<count;j++){
        const source=i===tops.length-1?last:first,size=source.getSize(new T.Vector3()),centre=source.getCenter(new T.Vector3());
        if(kind==='rear')size.x=Math.max(.018,size.x);else size.z=Math.max(.07,size.z);
        size.y=.006;centre.y=T.MathUtils.lerp(tops[i-1],tops[i],j/count)-size.y/2;
        const mesh=new T.Mesh(own(new T.BoxGeometry(size.x,size.y,size.z)),material);mesh.name=(kind==='rear'?'Rear_Ladder_Close_Step':'Fixed_Step')+'_KS_'+serial++;mesh.userData.sharedAsset=true;mesh.position.copy(centre);model.add(mesh);
        model.updateMatrixWorld(true);steps[0].parent!.attach(mesh);
      }
    }
  }
  // Cab entry treads sit below the cut door aperture, separate from the original
  // decorative steps beside the front bumper.
  for(const side of [-1,1])for(let i=1;i<=3;i++){
    const g=own(new T.BoxGeometry(.105,.008,.06)),m=new T.Mesh(g,material);
    m.name=`CAB_ACCESS_STEP_${side>0?'LEFT':'RIGHT'}_${i}`;m.userData.sharedAsset=true;
    m.position.set(-.711,R14.axleY-R14.tyreRadius+i*.05-.004,.155+side*(.214-(i-1)*.009));model.add(m);
  }
}

export function clarifyFrontIndicators(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry){
  model.traverse(n=>{if(!(n instanceof T.Mesh)||!/^Amber_Indicator(?:_|$)/.test(n.name))return;
    const geometry=own(n.geometry.clone());geometry.computeBoundingBox();const box=geometry.boundingBox!,p=geometry.attributes.position;
    // Keep the original location/side, with a visible amber face above each lamp.
    const old=box.max.y-box.min.y;for(let i=0;i<p.count;i++)p.setY(i,box.min.y+(p.getY(i)-box.min.y)*Math.max(1,.018/old));
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();n.geometry=geometry;
  });
}
