import * as T from 'three';
import {R14} from './r14-spec';
/** Fill measured gaps in the supplied access geometry with visible fixed rungs.
 * The source GLB is never changed. All added parts follow their original parent. */
export function completeVehicleSteps(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry,material:T.Material){
  model.updateWorldMatrix(true,true);
  model.traverse(n=>{if(!(n instanceof T.Mesh)||!/^Rear_Ladder_Folding_Handhold/.test(n.name))return;
    const g=own(n.geometry.clone());g.computeBoundingBox();const b=g.boundingBox!,p=g.attributes.position,s=b.getSize(new T.Vector3()),axis=s.y>=s.x&&s.y>=s.z?1:s.x>=s.z?0:2,min=b.min.getComponent(axis);
    for(let i=0;i<p.count;i++)p.setComponent(i,axis,min+(p.getComponent(i,axis)-min)*1.65);
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();n.geometry=g;
  });
  const add=(name:string,size:number[],position:number[],parent:T.Object3D=model)=>{
    const mesh=new T.Mesh(own(new T.BoxGeometry(...size as [number,number,number])),material);mesh.name=name;mesh.userData.sharedAsset=true;mesh.position.fromArray(position);model.add(mesh);model.updateMatrixWorld(true);if(parent!==model)parent.attach(mesh);return mesh;
  };
  const rear=model.getObjectByName('Rear_Bumper') as T.Mesh|undefined;
  if(rear){
    const parent=rear.parent!;rear.removeFromParent();
    // Retain the bumper ends and lamps; the narrow central section is a tread.
    for(const z of [.015,.295])add('Rear_Bumper_End',[.035,.045,.15],[1.525,-.345,z],parent);
    add('Rear_Ladder_Close_Step_BUMPER',[.048,.009,.13],[1.534,-.3335,.155],parent);
    for(const [i,y] of [-.414,-.372].entries())add(`Rear_Ladder_Close_Step_LOWER_${i}`,[.048,.008,.12],[1.542,y-.004,.155],parent);
    model.getObjectByName('Rear_Ladder_Close_Step')?.removeFromParent();
    // The lowest stringers now terminate on the bumper instead of below it.
    model.traverse(n=>{if(!(n instanceof T.Mesh)||!/^Rear_Ladder_Close_Stringer/.test(n.name))return;
      const g=own(n.geometry.clone()),p=g.attributes.position,inverse=n.matrixWorld.clone().invert();
      for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld);if(v.y<-.29){const t=T.MathUtils.clamp((-.29-v.y)/.039,0,1);v.x=T.MathUtils.lerp(v.x,1.534,t);v.y=Math.max(-.329,v.y);}v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);}
      g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();n.geometry=g;
    });
    for(const z of [.105,.205])add('Rear_Ladder_Bumper_Mount',[.048,.012,.012],[1.534,-.334,z],parent);
  }
  for(const kind of ['platform']){
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
  // The cab's dimensioned stairwell is built with its doorway in VehicleCab.
}

export function clarifyFrontIndicators(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry){
  model.traverse(n=>{if(!(n instanceof T.Mesh)||!/^Amber_Indicator(?:_|$)/.test(n.name))return;
    const geometry=own(n.geometry.clone());geometry.computeBoundingBox();const box=geometry.boundingBox!,p=geometry.attributes.position;
    // Keep the original location/side, with a visible amber face above each lamp.
    const old=box.max.y-box.min.y;for(let i=0;i<p.count;i++)p.setY(i,box.min.y+(p.getY(i)-box.min.y)*Math.max(1,.018/old));
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();n.geometry=geometry;
  });
}
