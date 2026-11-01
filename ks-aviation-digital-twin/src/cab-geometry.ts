import * as T from 'three';
import {CAB_REFERENCE as C,cabUnits as u,cabPoint as p,cabTreadHeights,remapCabPoint} from './cab-reference';
import {R14,R14_WHEEL_SCALE as wheelScale} from './r14-spec';

/** Refit only the cloned cabin. Tank, lift and cached GLB geometry stay intact. */
export function refitCabExterior(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry){
  model.updateWorldMatrix(true,true);
  model.getObjectByName('Cab_Lower_Reference_Correction')?.removeFromParent();
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
    box('CAB_STEPWELL_BACK_'+suffix,[.44,.85,.025],[C.treadX,.76,side*.865],dark);
    // Thin recessed stringers finish flush with the bumper and tread noses.
    for(const x of [.055,.475])box('CAB_STEPWELL_CHEEK_'+suffix,[.022,.86,.275],[x,.755,side*1.005],dark);
    for(let i=0;i<3;i++){
      const lateral=C.exteriorWidth/2-C.treadDepth/2-i*.035;
      const width=i===2?.43:C.treadWidth,depth=i===2?.29:C.treadDepth;
      box(`CAB_ACCESS_STEP_${suffix}_${i+1}`,[width,.026,depth],[C.treadX+(width-C.treadWidth)/2,cabTreadHeights[i]-.013,side*(lateral-(depth-C.treadDepth)/2)],metal);
      // Raised serrated strips are a visual walking surface, backed by a solid tread.
      for(let j=0;j<6;j++)box(`CAB_TREAD_GRIP_${suffix}_${i}_${j}`,[.012,.004,.21],[C.treadX-.16+j*.064,cabTreadHeights[i]+.002,side*lateral],dark);
    }
    const shape=new T.Shape(),outer=.625*wheelScale,inner=.585*wheelScale;
    shape.moveTo(outer,0);shape.absarc(0,0,outer,0,Math.PI,false);shape.lineTo(-inner,0);shape.absarc(0,0,inner,Math.PI,0,true);shape.closePath();
    const g=new T.ExtrudeGeometry(shape,{depth:.11,bevelEnabled:false,curveSegments:40});g.scale(u(1),u(1),u(1));
    const f=mesh('CAB_FRONT_FENDER_'+suffix,g,paint);
    f.position.fromArray(p(C.axleFromFront,(R14.axleY-C.nativeGround)*C.metresPerNative,side>0?C.exteriorWidth/2-.11:-C.exteriorWidth/2));
    // Closed inner wheelhouse: a black arch shaped backing, like the service
    // stair backing. It remains fixed when the painted door apron swings away.
    const axleY=(R14.axleY-C.nativeGround)*C.metresPerNative;
    const closure=new T.Shape();closure.moveTo(.465,C.floorHeight-.005);closure.lineTo(C.length-.015,C.floorHeight-.005);
    for(let i=0;i<=40;i++){const x=T.MathUtils.lerp(C.length-.015,.465,i/40),y=axleY+Math.sqrt(Math.max(0,(.634*wheelScale)**2-(x-C.axleFromFront)**2));closure.lineTo(x,Math.min(C.floorHeight-.018,y));}
    closure.closePath();
    const panel=new T.ExtrudeGeometry(closure,{depth:.022,bevelEnabled:false,curveSegments:32});panel.scale(u(1),u(1),u(1));
    mesh('CAB_WHEELHOUSE_CLOSURE_'+suffix,panel,dark).position.fromArray(p(0,0,side>0?1.104:-1.126));
    // The rubber floor ends at |z|=1 m. Butt the threshold against it instead
    // of drawing three different materials on the same horizontal plane.
    box('CAB_UPPER_LANDING_'+suffix,[.415,.025,.111],[.2575,C.floorHeight-.0125,side*1.0575],metal);
    // Close the daylight slot above the wheelhouse, all the way to the sill.
    box('CAB_WHEELHOUSE_TOP_'+suffix,[C.length-.480,.022,.143],[(.465+C.length-.015)/2,C.floorHeight-.011,side*1.0735],dark);
    box('CAB_FENDER_REAR_FLAP_'+suffix,[.03*wheelScale,.30*wheelScale,.11],[C.axleFromFront+.63*wheelScale,axleY+(.395-.1*C.metresPerNative)*wheelScale,side*(C.exteriorWidth/2-.055)],dark);
  }
  const threshold=new T.Object3D();threshold.name='CAB_DRIVER_THRESHOLD';threshold.position.fromArray(p(C.treadX,C.floorHeight+.006,.93));group.add(threshold);
  return group;
}

