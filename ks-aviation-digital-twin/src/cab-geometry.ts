import * as T from 'three';
import {CAB_REFERENCE as C,cabUnits as u,cabPoint as p,cabTreadHeights,remapCabPoint} from './cab-reference';
import {R14} from './r14-spec';

/** Refit only the cloned cabin. Tank, lift and cached GLB geometry stay intact. */
export function refitCabExterior(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry){
  model.updateWorldMatrix(true,true);
  model.getObjectByName('Cab_Lower_Reference_Correction')?.removeFromParent();
  // The corrected front axle would intersect the old lower platform flight.
  // Move its complete fixed/lifting assemblies together; animation-local
  // transforms and all occupant support coordinates remain unchanged.
  for(const name of ['Fixed_Lower_Access_Steps','Platform_Double_Scissor']){
    const part=model.getObjectByName(name);if(!part?.parent)continue;
    const mount=new T.Group();mount.name='CAB_CLEARANCE_'+name;part.parent.add(mount);mount.attach(part);mount.position.x=.065;
  }
  const cab=model.getObjectByName('KS_LOW_CAB_C3');if(!cab)return;
  // This old straight trim ran through the door lettering after the refit.
  for(const name of ['Door_Lower_Character_Line','Door_Lower_Character_Line_1'])cab.getObjectByName(name)?.removeFromParent();
  const parts:T.Mesh[]=[];cab.traverse(n=>{if(n instanceof T.Mesh)parts.push(n);});
  model.traverse(n=>{if(!(n instanceof T.Mesh))return;
    if(/^Cab_SOCAR_Wordmark/.test(n.name))parts.push(n);
    if(n.name==='Axle'){
      const b=new T.Box3().setFromObject(n);if(b.getCenter(new T.Vector3()).x<-.5)n.position.x+=p(C.axleFromFront,0,0)[0]-(-.6974);
    }
  });
  for(const n of parts){
    const g=own(n.geometry.clone()),a=g.attributes.position,inverse=n.matrixWorld.clone().invert();
    for(let i=0;i<a.count;i++){
      const v=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld);
      v.fromArray(remapCabPoint(v.x,v.y,v.z));
      if(/^Cab_SOCAR_Wordmark/.test(n.name))v.z+=Math.sign(v.z-C.nativeCentreZ)*u(.003);
      v.applyMatrix4(inverse);a.setXYZ(i,v.x,v.y,v.z);
    }
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();n.geometry=g;
  }
}

/** A recessed, attached stairwell and fender, not treads placed on a tyre. */
export function buildCabAccess(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry,paint:T.Material,metal:T.Material,dark:T.Material){
  const group=new T.Group();group.name='CAB_REFERENCE_ACCESS';model.add(group);
  const mesh=(name:string,g:T.BufferGeometry,mat:T.Material)=>{const m=new T.Mesh(own(g),mat);m.name=name;m.userData.sharedAsset=true;group.add(m);return m;};
  const box=(name:string,size:number[],point:number[],mat:T.Material)=>{
    const m=mesh(name,new T.BoxGeometry(...size.map(u) as [number,number,number]),mat);m.position.fromArray(p(...point as [number,number,number]));return m;
  };
  for(const side of [-1,1]){
    const suffix=side>0?'LEFT':'RIGHT';
    box('CAB_STEPWELL_BACK_'+suffix,[.68,.85,.025],[.44,.76,side*.865],dark);
    for(const x of [.105,.775])box('CAB_STEPWELL_CHEEK_'+suffix,[.035,.87,.35],[x,.755,side*1.055],paint);
    for(let i=0;i<3;i++){
      const lateral=C.exteriorWidth/2-C.treadDepth/2-i*.035;
      box(`CAB_ACCESS_STEP_${suffix}_${i+1}`,[C.treadWidth,.026,C.treadDepth],[C.treadX,cabTreadHeights[i]-.013,side*lateral],metal);
      // Raised serrated strips are a visual walking surface, backed by a solid tread.
      for(let j=0;j<8;j++)box(`CAB_TREAD_GRIP_${suffix}_${i}_${j}`,[.012,.004,.21],[C.treadX-.224+j*.064,cabTreadHeights[i]+.002,side*lateral],dark);
    }
    const shape=new T.Shape(),outer=.660,inner=.600;
    shape.moveTo(outer,0);shape.absarc(0,0,outer,0,Math.PI,false);shape.lineTo(-inner,0);shape.absarc(0,0,inner,Math.PI,0,true);shape.closePath();
    const g=new T.ExtrudeGeometry(shape,{depth:.11,bevelEnabled:false,curveSegments:40});g.scale(u(1),u(1),u(1));
    const f=mesh('CAB_FRONT_FENDER_'+suffix,g,paint);
    f.position.fromArray(p(C.axleFromFront,(R14.axleY-C.nativeGround)*C.metresPerNative,side>0?C.exteriorWidth/2-.11:-C.exteriorWidth/2));
    box('CAB_FENDER_REAR_FLAP_'+suffix,[.03,.30,.11],[C.axleFromFront+.63,.395,side*(C.exteriorWidth/2-.055)],dark);
    box('CAB_SILL_'+suffix,[1.47,.025,.035],[.82,C.floorHeight-.0125,side*.995],metal);
  }
  const threshold=new T.Object3D();threshold.name='CAB_DRIVER_THRESHOLD';threshold.position.fromArray(p(C.treadX,C.floorHeight+.006,.93));group.add(threshold);
  return group;
}
