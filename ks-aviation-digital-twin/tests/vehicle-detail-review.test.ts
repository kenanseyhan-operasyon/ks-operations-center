import './vehicle-surface-review.test';
import {reviewVehicleConnections} from './vehicle-connections.test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VehicleRig} from '../src/vehicle-rig';
import {VehicleLighting} from '../src/vehicle-lighting';
import {closedAnimationPack} from '../src/model-animations';
import {cabPoint as cp,cabUnits as u} from '../src/cab-reference';
import {R14} from '../src/r14-spec';

const bytes=fs.readFileSync('public/models/refueller-38k-r14.glb'),loader=new GLTFLoader();
loader.register(()=>({name:'QA_TEXTURE',loadTexture:async()=>new T.Texture()}));
const asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const metres=13.5/2.47,near=(a:number,b:number,label:string,epsilon=.00001)=>assert.ok(Math.abs(a-b)<epsilon,`${label}: ${a}, expected ${b}`);
const originalBounds=new Map<string,T.Box3>();
asset.scene.updateWorldMatrix(true,true);asset.scene.traverse(n=>{if(n.name)originalBounds.set(n.name,new T.Box3().setFromObject(n,true));});
for(const articulated of [true,false]){
  const model=asset.scene.clone(true),pack=closedAnimationPack(model,asset.animations),rig=new VehicleRig(model,articulated);
  const node=(name:string)=>model.getObjectByName(name)!,bounds=(name:string)=>new T.Box3().setFromObject(node(name),true);
  model.updateWorldMatrix(true,true);
  for(const name of ['Tank_Inspection_Hatch','Tank_Inspection_Hatch_1','Tank_Inspection_Hatch_2']){
    const hatch=node(name) as T.Mesh<T.LatheGeometry>,before=originalBounds.get(name)!,after=bounds(name);
    assert.ok(before.getCenter(new T.Vector3()).distanceTo(after.getCenter(new T.Vector3()))<1e-6,'Smoothing keeps the cover centre fixed');
    assert.ok(before.getSize(new T.Vector3()).distanceTo(after.getSize(new T.Vector3()))<1e-6,'Smoothing preserves cover diameter and height');
    assert.equal(hatch.geometry.parameters.segments,128,'Close views use a smooth circular silhouette');
  }
  reviewVehicleConnections(model,articulated,pack);
  const wheelRatio=(.2*metres-.05)/(.2*metres);
  assert.equal(rig.wheels.length,6);
  for(const wheel of rig.wheels){
    const tyre=new T.Box3().setFromObject(wheel.spin.getObjectByName('R14_TYRE')!,true),size=tyre.getSize(new T.Vector3());
    near(size.y*metres,.2*metres-.05,'All six tyre diameters decrease by exactly 50 mm',.000001);
    near((tyre.min.y+.454)*metres,0,'Every smaller tyre still contacts the ground',.000001);
    near(size.z*metres,.07*metres*wheelRatio,'Tyre width scales with the complete wheel',.000001);
    for(const [part,diameter,width] of [['R14_RIM',.112,.068],['R14_HUB',.054,.078]] as const){
      const b=new T.Box3().setFromObject(wheel.spin.getObjectByName(part)!,true).getSize(new T.Vector3());
      near(b.y*metres,diameter*metres*wheelRatio,`${part}: proportional diameter`,.000001);
      near(b.z*metres,width*metres*wheelRatio,`${part}: proportional width`,.000001);
    }
  }
  for(const name of ['Axle','Axle_1','Axle_2'])near(bounds(name).getCenter(new T.Vector3()).y,R14.axleY,'Axle rods follow the lower wheel centres');
  for(const name of ['Clean_Mid_Fender','Clean_Mid_Fender_1','Clean_Rear_Fender','Clean_Rear_Fender_1']){
    const old=originalBounds.get(name)!,b=bounds(name);
    near(b.max.y,R14.axleY+(old.max.y+.354)*wheelRatio,'Fixed arches scale concentrically with the wheel');
    near(b.getSize(new T.Vector3()).x,old.getSize(new T.Vector3()).x*wheelRatio,'Arch diameter follows the tyre');
  }
  for(const side of ['LEFT','RIGHT']){
    assert.equal(node('CAB_SILL_'+side),undefined,'Remove the arrow-marked long silver threshold strip');
    near((bounds('CAB_FRONT_FENDER_'+side).max.y-R14.axleY)*metres,.625*wheelRatio,'Front arch radius follows the smaller tyre');
  }
  rig.update(2,0);for(const wheel of rig.wheels)near(wheel.spin.rotation.z,2/(R14.tyreRadius),'Rolling distance uses the reduced tyre radius');rig.update(0,0);
  const deckBounds=bounds('Common_Flat_Grey_Floor'),deckBefore=originalBounds.get('Common_Flat_Grey_Floor')!;
  near((deckBefore.max.y-deckBounds.max.y)*metres,.10,'Equipment deck lowers exactly 100 mm');
  for(const name of ['Deck_Chassis_Support',...Array.from({length:5},(_,i)=>'Deck_Chassis_Support_'+(i+1))]){
    const b=bounds(name),old=originalBounds.get(name)!;
    near(b.min.y,old.min.y,'Shortened riser remains seated in the chassis');
    near((old.max.y-b.max.y)*metres,.10,'Every riser loses 100 mm at the top');
    near(b.max.y-deckBounds.min.y,old.max.y-deckBefore.min.y,'Riser retains its contact with the deck underside');
  }
  for(const name of ['06_CONTROL_PANEL','Transverse_Filter_Behind_Panel','Drum_Deck_Foot','Drum_Deck_Foot_1']){
    const old=originalBounds.get(name)!;
    near((old.min.y-bounds(name).min.y)*metres,.10,`${name}: equipment follows the lowered deck`,.0001);
  }
  near(bounds('Jar_Deck_Foot').min.y,deckBounds.max.y,'Sampler foot sits on the deck without an embedded coplanar face');
  near(bounds('Sample_Jar').min.y,bounds('Jar_Deck_Foot').max.y,'Sampler sits on its mounting foot');
  assert.ok(!bounds('Gate_Reinforced_Upright_1').intersectsBox(bounds('Rear_Leaf_Gate_Reinforced_Upright_1')),'Meeting gate posts occupy distinct volumes');
  for(const name of ['Ladder_Stringer','Ladder_Stringer_1']){
    const b=bounds(name),old=originalBounds.get(name)!;
    near(b.min.y,old.min.y,'Platform stair stringer keeps its ground end');
    near((old.max.y-b.max.y)*metres,.10,'Platform stair stringer meets the lowered platform');
  }
  // Sample the actual visible surfaces, including the old problem at both sills.
  for(const x of [.3,.6,1,1.35])for(const z of [-1.10,-1.07,-.98,-.69,0,.69,.98,1.07,1.10]){
    const ray=new T.Raycaster(new T.Vector3(...cp(x,1.205,z)),new T.Vector3(0,-1,0),0,.03/metres);
    const hits=ray.intersectObject(model,true).filter(h=>Math.abs(h.point.y-cp(0,1.2,0)[1])<.00001);
    assert.equal(new Set(hits.map(h=>h.object.uuid)).size,1,`One floor surface at ${x}/${z}, no black/grey overlap or wheelhouse hole`);
  }
  for(const z of [-.69,.69])for(const x of [.8,1.0,1.2]){
    const ray=new T.Raycaster(new T.Vector3(...cp(x,1.59,z)),new T.Vector3(0,-1,0),0,.38/metres);
    assert.equal(ray.intersectObject(node('Low_Short_Cab_Shell')).length,0,'Remove the old white arch from under both seats');
  }
  const accelerator=node('PEDAL_ACCELERATOR') as T.Mesh;accelerator.geometry.computeBoundingBox();
  near(accelerator.geometry.boundingBox!.getSize(new T.Vector3()).x*metres,.18,'180 mm accelerator',.0001);
  near((accelerator.position.x+.8958)*metres,.41,'Accelerator moved 60 mm forward');
  const target=accelerator.worldToLocal(node('DRIVER_PEDAL_TARGET_1').getWorldPosition(new T.Vector3()));
  assert.ok(Math.abs(target.x)*metres<.09&&Math.abs(target.z)*metres<.0475&&Math.abs(target.y*metres-.0125)<.01,'Right foot target follows the actual pedal');
  model.traverse(n=>{if(n instanceof T.Mesh&&n.name==='CAB_ENTRY_SEAT_GRIP'){
    const g=n.geometry as T.TubeGeometry;near(g.parameters.radius*2*metres,.022,'Slender 22 mm returned seat rail');
    const points=g.parameters.path.getPoints(80),middle=points.filter(p=>{const y=(p.y+.454)*metres;return y>1.64&&y<1.69;});
    assert.ok(new T.Box3().setFromPoints(middle).getSize(new T.Vector3()).x*metres>.25,'Smooth return along the seat edge, without an artificial tall loop');
  }});

  const lenses:T.Mesh[]=[];model.traverse(n=>{if(n instanceof T.Mesh&&n.name==='CAB_CORNER_INDICATOR_LENS')lenses.push(n);});
  assert.equal(lenses.length,2);const positions=lenses.map(n=>n.getWorldPosition(new T.Vector3()));
  for(const side of [-1,1]){
    const front=new T.Raycaster(new T.Vector3(...cp(-.20,1.15,side*1.115)),new T.Vector3(1,0,0));
    const lateral=new T.Raycaster(new T.Vector3(...cp(.045,1.15,side*1.35)),new T.Vector3(0,0,-side));
    assert.ok(front.intersectObjects(lenses).length,'Corner lens fills the front-facing recess');
    assert.ok(lateral.intersectObjects(lenses).length,'The same lens wraps around onto the side');
  }
  rig.cab.setDoor('left',true);rig.cab.setDoor('right',true);for(let i=0;i<20;i++)rig.cab.updateDoors(.05);
  lenses.forEach((n,i)=>assert.ok(n.getWorldPosition(new T.Vector3()).distanceTo(positions[i])<1e-8,'Corner signal remains on the fixed body'));
  const lighting=new VehicleLighting(model,new T.Scene());lighting.update(false,false,0,'hazard');
  assert.ok(lenses.every(n=>(n.material as T.MeshStandardMaterial).emissiveIntensity>0),'Both new lenses flash with hazards');
  lighting.update(false,false,400,'hazard');assert.ok(lenses.every(n=>(n.material as T.MeshStandardMaterial).emissiveIntensity===0));
  lighting.dispose();rig.cab.setInside(true);assert.ok(lenses.every(n=>!n.visible));rig.cab.setInside(false);
  for(const side of ['left','right'] as const)rig.cab.setDoor(side,false);for(let i=0;i<20;i++)rig.cab.updateDoors(.05);

  const drum=bounds('Large_Reference_Hose_Drum'),coupling=bounds('Delivery_Coupling_Red_Park'),bonding=bounds('Bonding_Assembly');
  near(bounds('Parked_Delivery_Coupling').getCenter(new T.Vector3()).x,bounds('Drum_Exit_Horizontal_Roller').getCenter(new T.Vector3()).x,'Coupling is directly below the drum exit, not offset toward the cab');
  assert.equal(node('JET_A1_STOWAGE_BAIL'),undefined,'No bail obstructs the coupling operating lever');
  assert.ok(bounds('Drum_Exit_Base_Plate').max.z<coupling.min.z,'The main guide is behind the parked coupling');
  assert.ok(coupling.min.z>drum.max.z,'Coupling is in front of the operating face');
  assert.ok(!coupling.intersectsBox(bonding)&&!drum.intersectsBox(bonding),'The assemblies remain separate');
  const base=bounds('Bonding_Deck_Base'),support=bounds('Common_Flat_Grey_Floor');
  assert.equal(node('BONDING_DECK_EXTENSION'),undefined,'Bonding stays on the existing deck');
  near(bounds('Bonding_Deck_Base').max.x,support.max.x-u(.025),'Bonding mounting base at the rear corner');
  near(bounds('Bonding_Deck_Base').max.z,support.max.z-u(.025),'Bonding mounting base at the outboard corner');
  assert.ok(base.min.x>=support.min.x&&base.max.x<=support.max.x&&base.min.z>=support.min.z&&base.max.z<=support.max.z,'Bonding mounting foot is supported on both vehicle variants');
  const hoseRings=(name:string,diameter:number)=>{
    const hose=node(name) as T.Mesh<T.TubeGeometry>,p=hose.geometry.attributes.position,segments=hose.geometry.parameters.tubularSegments,radial=hose.geometry.parameters.radialSegments,rings:T.Vector3[]=[];
    for(let i=0;i<=segments;i++){
      const points=Array.from({length:radial},(_,j)=>new T.Vector3().fromBufferAttribute(p,i*(radial+1)+j).applyMatrix4(hose.matrixWorld));
      const centre=points.reduce((a,b)=>a.add(b),new T.Vector3()).multiplyScalar(1/radial);rings.push(centre);
      for(const point of points)near(point.distanceTo(centre)*metres,diameter/2,'Round hose section despite inherited drum scale',.000003);
    }return rings;
  };
  const rings=hoseRings('Delivery_Hose_Taut_Parked',.066),end=rings.at(-1)!;
  assert.ok(end.distanceTo(node('DELIVERY_HOSE_INLET').getWorldPosition(new T.Vector3()))*metres<.00001,'Two-inch hose seats in the actual union');
  const guide=bounds('Drum_Exit_Horizontal_Roller').getCenter(new T.Vector3()).lerp(bounds('Drum_Exit_Horizontal_Roller_1').getCenter(new T.Vector3()),.5);
  const guideError=Math.min(...rings.slice(1).map((p,i)=>new T.Line3(rings[i],p).closestPointToPoint(guide,true,new T.Vector3()).distanceTo(guide)));
  assert.ok(guideError<.0005,'Continuous hose passes through the roller aperture');

  for(const [coilName,tailName,inletName,bore,outer] of [
    ['Coiled_Delivery_Hose','Delivery_Hose_Taut_Parked','DELIVERY_HOSE_INLET',.0508,.066],
    ['Overwing_Coiled_Hose','Overwing_Hose_Tail','OVERWING_HOSE_INLET',.0254,.037],
  ] as const){
    const coil=node(coilName),tail=node(tailName),wound=hoseRings(coilName,outer),free=hoseRings(tailName,outer);
    near(coil.userData.innerDiameterMetres,bore,'Specified 2-inch / 1-inch internal diameter');
    near(coil.userData.totalPathLengthMetres,30,'Thirty metres includes the exposed connected tail',.0001);
    near(coil.userData.woundLengthMetres+tail.userData.freeLengthMetres,30,'No missing or doubled length',.0001);
    assert.ok(wound.at(-1)!.distanceTo(free[0])*metres<.00001,'One continuous hose from winding to tail');
    assert.ok(free.at(-1)!.distanceTo(node(inletName).getWorldPosition(new T.Vector3()))*metres<.00001,'Tail reaches its own nozzle inlet');
    const points=(coil.userData.hosePath as number[][]).map(p=>new T.Vector3(...p as [number,number,number]).multiplyScalar(metres)),arcs=[0];
    for(let i=1;i<points.length;i++)arcs.push(arcs[i-1]+points[i].distanceTo(points[i-1]));
    let clearance=Infinity;
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(arcs[j]-arcs[i]>outer*3)clearance=Math.min(clearance,points[i].distanceToSquared(points[j]));
    assert.ok(Math.sqrt(clearance)>outer,`${coilName}: separate winding turns do not pass through each other`);
  }
  const flatBase=bounds('OVERWING_REEL_BASE'),flatCoil=bounds('Overwing_Coiled_Hose'),flatReel=bounds('Overwing_Vertical_Reel'),gun=bounds('Overwing_Nozzle_Park');
  assert.ok(bounds('DELIVERY_REEL_CORE').getSize(new T.Vector3()).y*metres>=.400,'Two-inch hose uses at least a 400 mm reel core');
  assert.ok(bounds('OVERWING_REEL_CORE').getSize(new T.Vector3()).y*metres>=.200,'One-inch hose uses at least a 200 mm reel core');
  assert.ok(flatBase.min.x>=support.min.x&&flatBase.max.x<=support.max.x&&flatBase.min.z>=support.min.z&&flatBase.max.z<=support.max.z,'Vertical reel is supported by the XX deck bay');
  assert.ok(flatReel.min.x>drum.max.x&&flatReel.max.x<bounds('Tank_Shell').min.x,'New reel clears both the large drum and tank');
  assert.ok(gun.min.x>coupling.max.x&&gun.max.x<bonding.min.x,'Slip-in nozzle holder occupies X, between pressure coupling and bonding');
  const flanges:T.Box3[]=[];node('Overwing_Vertical_Reel').traverse(n=>{if(n.name==='OVERWING_FLANGE_SPOKE')flanges.push(new T.Box3().setFromObject(n));});
  assert.ok(flatCoil.min.x>Math.min(...flanges.map(b=>b.max.x))&&flatCoil.max.x<Math.max(...flanges.map(b=>b.min.x)),'Hose pack fits between both vertical flanges');
  const smallTail=node('Overwing_Hose_Tail'),smallGuide=new T.Vector3(...smallTail.userData.guideCentre as [number,number,number]);
  const rollers:T.Box3[]=[];node('Overwing_Vertical_Reel').traverse(n=>{if(n.name==='OVERWING_EXIT_ROLLER')rollers.push(new T.Box3().setFromObject(n));});
  assert.ok(smallGuide.y-u(.037/2)>rollers[0].max.y&&smallGuide.y+u(.037/2)<rollers[1].min.y,'One-inch hose clears both guide rollers');
  assert.equal(node('JET_A1_PRESSURE_BODY').parent?.name,'Parked_Delivery_Coupling');
  assert.deepEqual(node('JET_A1_OVERWING_NOZZLE').userData.spoutProfileMillimetres,[52,70]);
  const tip=bounds('OVERWING_JET_A1_OVAL_SPOUT');
  assert.ok(tip.min.y>bounds('OVERWING_HOLSTER_LINER').max.y&&tip.max.y<bounds('OVERWING_HOLSTER_BACK').max.y,'JET spout is inserted into the lined holster');

  const rearSteps:T.Mesh[]=[];model.traverse(n=>{if(n instanceof T.Mesh&&/^Rear_Ladder_Close_Step/.test(n.name))rearSteps.push(n);});
  const bumper=bounds('Rear_Bumper_End'),ladderX=bumper.getCenter(new T.Vector3()).x;
  assert.equal(rearSteps.length,11);rearSteps.forEach(n=>near(new T.Box3().setFromObject(n).getCenter(new T.Vector3()).x,ladderX,'Every rear rung is aligned inside the bumper depth'));
  assert.equal(node('Rear_Ladder_Short_Body_Mount'),undefined,'No intermediate tank-to-ladder brackets');
  const backplate=bounds('Rear_Ladder_Bumper_Backplate');
  near(backplate.max.x,bumper.min.x,'Bottom mounting plate rests against the tank-side bumper face');
  assert.ok(backplate.min.y<bumper.max.y&&backplate.max.y>bumper.min.y&&backplate.min.z<bumper.max.z,'Bottom mounting plate overlaps the bumper');
  model.traverse(n=>{if(n.name==='Rear_Ladder_Bumper_Mount'){
    const b=new T.Box3().setFromObject(n);assert.ok(b.intersectsBox(backplate)&&b.intersectsBox(bounds('Rear_Ladder_Close_Step_BUMPER')),'Both bottom brackets join the backplate and tread');
  }});
  for(const suffix of ['','_1']){
    const rail=bounds('Rear_Ladder_Close_Stringer'+suffix);near(rail.getSize(new T.Vector3()).x,.007,'Straight round stile, no outward bow');
    assert.ok(rail.intersectsBox(bounds('Rear_Ladder_Close_Step_BUMPER')),'Stile meets the bumper tread');
  }
  near(bounds('Tank_Top_Walkway').max.x,ladderX,'Roof landing meets the relocated ladder');
  const rearButton=node('Rear_Railing_Toggle_Button') as T.Mesh<T.CylinderGeometry>,bezel=node('Rear_Railing_Button_Bezel') as T.Mesh<T.CylinderGeometry>,shell=node('Tank_Shell');
  near(rearButton.geometry.parameters.radiusTop*2*metres,.038,'Compact 38 mm green button');
  near(bezel.geometry.parameters.radiusTop*2*metres,.052,'52 mm mounting bezel');
  assert.equal(rearButton.parent,shell.parent,'Control follows the tank');assert.equal(bezel.parent,shell.parent);
  assert.equal(rearButton.userData.control,'railing','Original control metadata retained');
  const normal=new T.Vector3(0,1,0).transformDirection(bezel.matrixWorld),bezelCentre=bezel.getWorldPosition(new T.Vector3());
  const surface=new T.Raycaster(bezelCentre.clone().addScaledVector(normal,u(.1)),normal.clone().negate()).intersectObject(shell)[0];
  assert.ok(surface,'Mount points into the actual tank skin');
  near(bezelCentre.clone().sub(surface.point).dot(normal)*metres,.004,'Bezel is seated 1 mm into the tank surface',.0001);
  const front=rearButton.getWorldPosition(new T.Vector3()).addScaledVector(normal,u(.1));
  assert.equal(new T.Raycaster(front,normal.clone().negate()).intersectObject(model,true)[0].object,rearButton,'Small button remains exposed and pickable');
  const railing=pack.actions.get('Tank_Railing_Raise')!;
  for(let frame=0;frame<=40;frame++){
    railing.time=railing.getClip().duration*frame/40;pack.mixer.update(0);model.updateWorldMatrix(true,true);
    for(const [side,suffix] of [[-1,''],[1,'_1']] as const){
      const hand=node('Rear_Ladder_Folding_Handhold'+suffix) as T.Mesh<T.TubeGeometry>,end=hand.geometry.parameters.path.getPoint(1).applyMatrix4(hand.matrixWorld);
      const long=node(side<0?'Tank_Rail_Long_1':'Tank_Rail_Long_3') as T.Mesh;long.geometry.computeBoundingBox();const b=long.geometry.boundingBox!,tip=b.getCenter(new T.Vector3());tip.x=b.max.x;tip.applyMatrix4(long.matrixWorld);
      assert.ok(tip.distanceTo(end)*metres<.001,`Returned handhold stays joined to the top rail throughout folding: ${frame}/${side}, ${tip.distanceTo(end)*metres} m, tip=${tip.toArray()}, end=${end.toArray()}`);
    }
  }
  near((bounds('Tank_Rail_Post').max.y-.1784999973)*metres,.10,'Tank railing is exactly 100 mm taller',.0001);
  assert.ok(bounds('Rear_Ladder_Folding_Handhold').max.y<bounds('Tank_Rail_Long_1').max.y+.002,'No protruding spear above the top rail');
  rig.dispose();console.log(`PASS ${articulated?'articulated':'rigid'}: six grounded proportional wheels, lower deck/equipment, floor/arch, pedal, wraparound signals, two continuous 30 m hoses, pressure nozzle/overwing holster, supported equipment, vertical ladder, 41 connected railing poses`);
}
for(const [name,before] of originalBounds){
  const source=asset.scene.getObjectByName(name);if(!source)continue;const after=new T.Box3().setFromObject(source,true);
  assert.ok(before.equals(after),`${name}: refitting either vehicle must not mutate the cached source model`);
}
