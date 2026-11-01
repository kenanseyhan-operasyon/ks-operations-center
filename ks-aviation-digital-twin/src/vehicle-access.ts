import * as T from 'three';
import {R14} from './r14-spec';
import {cabUnits as u} from './cab-reference';
/** Fill measured gaps in the supplied access geometry with visible fixed rungs.
 * The source GLB is never changed. All added parts follow their original parent. */
export function completeVehicleSteps(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry,material:T.Material){
  model.updateWorldMatrix(true,true);
  const add=(name:string,size:number[],position:number[],parent:T.Object3D=model)=>{
    const mesh=new T.Mesh(own(new T.BoxGeometry(...size as [number,number,number])),material);mesh.name=name;mesh.userData.sharedAsset=true;mesh.position.fromArray(position);model.add(mesh);model.updateMatrixWorld(true);if(parent!==model)parent.attach(mesh);return mesh;
  };
  const rear=model.getObjectByName('Rear_Bumper') as T.Mesh|undefined;
  if(rear){
    const parent=rear.parent!;rear.removeFromParent();
    const obsolete:T.Object3D[]=[];model.traverse(n=>{if(/^Rear_Ladder_(Close_(Stringer|Step)|Short_Body_Mount)|^Rear_Handhold_Short_Mount/.test(n.name))obsolete.push(n);});
    obsolete.forEach(n=>n.removeFromParent());
    // Retain the bumper ends and lamps; the narrow central section is a tread.
    for(const z of [.015,.295])add('Rear_Bumper_End',[.035,.045,.15],[1.525,-.345,z],parent);
    // Bring the ladder into the bumper depth, towards the tank, as marked in
    // the rear-view reference. Its bottom fixing sits on the tank-side face.
    const ladderX=1.525,bumperBack=1.5075,walkway=model.getObjectByName('Tank_Top_Walkway') as T.Mesh;
    const landingY=new T.Box3().setFromObject(walkway).max.y,bumperY=-.329;
    // The three lower rungs use the same section and width as the upper eight.
    add('Rear_Ladder_Close_Step_BUMPER',[.018,.006,.10],[ladderX,bumperY-.003,.155],parent);
    for(const [i,y] of [-.414,-.372].entries())add(`Rear_Ladder_Close_Step_LOWER_${i}`,[.018,.006,.10],[ladderX,y-.003,.155],parent);
    for(let i=1;i<=8;i++)add('Rear_Ladder_Close_Step_'+i,[.018,.006,.10],[ladderX,T.MathUtils.lerp(bumperY,landingY,i/9)-.003,.155],parent);
    add('Rear_Ladder_Bumper_Backplate',[u(.006),u(.11),.15],[bumperBack-u(.003),-.345,.155],parent);
    for(const [i,z] of [.105,.205].entries()){
      const a=new T.Vector3(ladderX,-.426,z),b=new T.Vector3(ladderX,landingY+.002,z),curve=new T.LineCurve3(a,b);
      const rail=new T.Mesh(own(new T.TubeGeometry(curve,1,.0035,12,false)),material);rail.name='Rear_Ladder_Close_Stringer'+(i?'_'+i:'');rail.userData.sharedAsset=true;rail.userData.gripPath=[a.toArray(),b.toArray()];model.add(rail);model.updateWorldMatrix(true,true);parent.attach(rail);
      add('Rear_Ladder_Bumper_Mount',[ladderX-bumperBack+u(.006),u(.008),u(.06)],[(bumperBack+ladderX)/2,bumperY-.006-u(.003),z],parent);
      // The bumper and roof landing support the stiles; no intermediate arms
      // project from the tank through the climbing space.
    }
    // Extend the rear landing to meet the straight ladder, without a gap.
    const g=own(walkway.geometry.clone()),p=g.attributes.position,oldMax=new T.Box3().setFromObject(walkway).max.x,inverse=walkway.matrixWorld.clone().invert();
    for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(walkway.matrixWorld);if(v.x>oldMax-.001)v.x=ladderX;v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);}
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();walkway.geometry=g;
    const button=model.getObjectByName('Rear_Railing_Toggle_Button') as T.Mesh|undefined,shell=model.getObjectByName('Tank_Shell');
    if(button&&shell){
      const centre=new T.Box3().setFromObject(button).getCenter(new T.Vector3());
      const hit=new T.Raycaster(new T.Vector3(ladderX+.1,centre.y,centre.z),new T.Vector3(-1,0,0)).intersectObject(shell)[0];
      if(hit?.face){
        const normal=(hit.normal||hit.face.normal).clone().applyNormalMatrix(new T.Matrix3().getNormalMatrix(hit.object.matrixWorld));
        const rotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),normal),tankParent=shell.parent!;
        const bezel=new T.Mesh(own(new T.CylinderGeometry(u(.026),u(.026),u(.010),32)),material);
        bezel.name='Rear_Railing_Button_Bezel';bezel.userData.sharedAsset=true;
        bezel.position.copy(hit.point).addScaledVector(normal,u(.004));bezel.quaternion.copy(rotation);model.add(bezel);
        // Keep the original control mesh and metadata, with a compact 38 mm
        // green face and a shallow bezel seated against the measured tank skin.
        button.geometry=own(new T.CylinderGeometry(u(.019),u(.019),u(.005),32));
        model.add(button);button.scale.setScalar(1);button.position.copy(hit.point).addScaledVector(normal,u(.011));button.quaternion.copy(rotation);
        model.updateWorldMatrix(true,true);tankParent.attach(bezel);tankParent.attach(button);
      }
    }
  }
  // The equipment deck is level four. Preserve the bottom tread and divide the
  // remaining rise into three equal intervals, lowering only treads two/three.
  const bottom=R14.axleY-R14.tyreRadius+u(.355),deckTop=new T.Box3().setFromObject(model.getObjectByName('Common_Flat_Grey_Floor')!).max.y;
  const tops=[bottom,T.MathUtils.lerp(bottom,deckTop,1/3),T.MathUtils.lerp(bottom,deckTop,2/3)];
  const steps:T.Mesh[]=[];model.traverse(n=>{if(n instanceof T.Mesh&&/^Fixed_Step(?:_\d+)?$/.test(n.name))steps.push(n);});
  steps.sort((a,b)=>new T.Box3().setFromObject(a).max.y-new T.Box3().setFromObject(b).max.y);
  for(const [i,step] of steps.entries()){
    const delta=tops[i]-new T.Box3().setFromObject(step).max.y;
    step.position.y+=delta;
  }
  const handles:T.Object3D[]=[];model.traverse(n=>{if(/^Platform_Outside_Grab_Handle/.test(n.name))handles.push(n);});
  // Retain the original structural guardrail and spring gates. Nathan uses its
  // entry posts; the supplementary external grab loops are not needed.
  for(const handle of handles)handle.visible=false;
  // The cab's dimensioned stairwell is built with its doorway in VehicleCab.
}

/** Taller folding tank rails and short returned handholds: the handhold top
 * finishes level with the rail, with no old spear-like projection above it. */
export function refitTankAccessRails(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry,material:T.Material){
  const extra=u(.10),height=.12+extra;
  const jointGeometry=own(new T.SphereGeometry(.0034,12,8));
  const joint=(parent:T.Object3D,point:T.Vector3)=>{const mesh=new T.Mesh(jointGeometry,material);mesh.name='Tank_Rail_Joint';mesh.userData.sharedAsset=true;mesh.position.copy(point);parent.add(mesh);};
  model.updateWorldMatrix(true,true);
  const ladderX=new T.Box3().setFromObject(model.getObjectByName('Rear_Ladder_Close_Stringer')!).getCenter(new T.Vector3()).x;
  model.traverse(n=>{
    if(!(n instanceof T.Mesh))return;
    if(/^Tank_Rail_Post(?:_|$)/.test(n.name)){
      const g=own(n.geometry.clone());g.scale(1,height/.12,1);g.computeBoundingBox();g.computeBoundingSphere();n.geometry=g;
      // Sealed joints travel with each post throughout folding, rather than
      // leaving exposed cut faces where the horizontal tubes meet it.
      for(const y of [height/2,height])joint(n.parent!,new T.Vector3(0,y,0));
    }else if(/^Tank_Rail_Long(?:_|$)/.test(n.name)){
      const suffix=Number(n.name.split('_').at(-1)),upper=Number.isFinite(suffix)&&suffix%2===1;
      const g=own(n.geometry.clone());g.computeBoundingBox();const p=g.attributes.position,end=g.boundingBox!.max.x;
      for(let i=0;i<p.count;i++)if(p.getX(i)>end-.001)p.setX(i,p.getX(i)+ladderX-1.4655);
      g.translate(0,extra*(upper?1:.5),0);g.computeBoundingBox();g.computeBoundingSphere();n.geometry=g;
    }else if(/^Rear_Ladder_Folding_Handhold(?:_|$)/.test(n.name)){
      const hinge=n.parent!,world=hinge.getWorldPosition(new T.Vector3()),side=world.z>.155?1:-1;
      world.x=ladderX;world.z=.155+side*.05;hinge.position.copy(hinge.parent!.worldToLocal(world));
      const points=[[0,0,0],[0,height-.020,0],[0,height-.004,side*.008],[0,height,side*.030]].map(p=>new T.Vector3(...p as [number,number,number]));
      const curve=new T.CatmullRomCurve3(points,false,'centripetal');n.geometry=own(new T.TubeGeometry(curve,64,.003,12,false));n.material=material;
      // Grip only the upright continuation of the ladder, never both branches
      // of the return averaged into an invisible central target.
      n.userData.gripPath=curve.getPoints(128).filter(p=>p.x>-.008&&p.y<height-.006).map(p=>p.toArray());
      const link=new T.Mesh(own(new T.TubeGeometry(new T.LineCurve3(new T.Vector3(0,height/2,0),new T.Vector3(0,height/2,side*.030)),1,.003,12,false)),material);link.name='Rear_Ladder_Rail_Link';link.userData.sharedAsset=true;hinge.add(link);
      for(const y of [height/2,height])joint(hinge,new T.Vector3(0,y,side*.030));
    }
  });
  model.updateWorldMatrix(true,true);
}

export function clarifyFrontIndicators(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry){
  model.traverse(n=>{if(!(n instanceof T.Mesh)||!/^Amber_Indicator(?:_|$)/.test(n.name))return;
    const geometry=own(n.geometry.clone());geometry.computeBoundingBox();const box=geometry.boundingBox!,p=geometry.attributes.position;
    // Keep the original location/side, with a visible amber face above each lamp.
    const old=box.max.y-box.min.y;for(let i=0;i<p.count;i++)p.setY(i,box.min.y+(p.getY(i)-box.min.y)*Math.max(1,.018/old));
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();n.geometry=geometry;
  });
}


