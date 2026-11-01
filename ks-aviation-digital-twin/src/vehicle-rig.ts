import {stabilizeVehicleMarkings} from './vehicle-markings';
import {stabilizeVehicleSurfaces,refineVehicleHatches} from './vehicle-surfaces';
import {seatSampleJar,separatePlatformGateFaces} from './vehicle-surface-contacts';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { R14,R14_WHEEL_SCALE } from './r14-spec';
import { FuelGauge, refitTankMarkings, tankLift, clearCouplingSweep,spaceServiceReels } from './refueller-details';
import {VehicleCab} from './vehicle-cab';
import {completeVehicleSteps,clarifyFrontIndicators,refitTankAccessRails} from './vehicle-access';
import {refitCabExterior} from './cab-geometry';
import {lowerEquipmentDeck,refitServicePlatform} from './vehicle-service-layout';
import {refitWheelSurrounds} from './vehicle-running-gear';
import {refitFuelDelivery} from './refueller-fueling';
import {VehicleDeadman} from './vehicle-deadman';
import {trailerFrameGeometry,clearFrameTyreSides} from './vehicle-frame';
import {batchVehicle} from './vehicle-batching';
type Wheel={pivot:THREE.Group;spin:THREE.Group;front:boolean;trailer:boolean};

/** Prepare one cloned R14 in native coordinates, before scaling/grounding.
 * Cached geometry and animation targets remain intact for the other vehicles. */
export class VehicleRig {
  readonly wheels:Wheel[]=[];
  readonly trailer=new THREE.Group();
  readonly gauges:FuelGauge[]=[];
  readonly cab:VehicleCab;
  readonly deadman:VehicleDeadman;
  private platformButton?:THREE.MeshStandardMaterial;
  private platformRaised?:boolean;
  private batching?:ReturnType<typeof batchVehicle>;
  private geometries=new Set<THREE.BufferGeometry>();
  private materials=new Set<THREE.Material>();
  get wheelbase(){return ((this.articulated?R14.tractorAxle:(R14.tractorAxle+R14.trailerAxle)/2)-R14.frontAxle)*this.model.scale.x;}
  constructor(private model:THREE.Object3D,private articulated=true){
    refitCabExterior(model,g=>this.own(g));
    model.updateWorldMatrix(true,true);
    const meshes:THREE.Mesh[]=[];model.traverse(n=>{if(n instanceof THREE.Mesh)meshes.push(n);});
    const centre=(n:THREE.Object3D)=>new THREE.Box3().setFromObject(n).getCenter(new THREE.Vector3());
    this.trailer.name=articulated?'R14_ARTICULATED_TRAILER':'R14_RIGID_CHASSIS';
    this.trailer.position.set(R14.hitchX,R14.hitchY,R14.centreZ);model.add(this.trailer);model.updateMatrixWorld(true);
    for(const name of articulated?['02_TANK_BODY','03_TANK_TOP_ACCESS']:[]){
      const group=model.getObjectByName(name);if(group)this.trailer.attach(group);
    }
    const belongsToTrailer=(n:THREE.Object3D)=>{for(let p=n.parent;p;p=p.parent)if(p===this.trailer)return true;return false;};
    for(const mesh of meshes){
      const name=mesh.name,c=centre(mesh);
      // Scanned wheel pairs contain fender fragments which rotated below ground.
      if(/^(Original_Wheel_Pair|Axle_Hub)/.test(name)||(articulated&&/^(Clean_Chassis_Rail|Clean_Sideguard|Sideguard_Mount)/.test(name)))mesh.removeFromParent();
      // A platform gate also has a "Rear_" prefix. Keep it on its animated
      // tractor hinge, and keep already-attached railing meshes on their hinges.
      else if(articulated&&!belongsToTrailer(mesh)&&(/^(Clean_Rear_Fender|SOCAR_Flame|SOCAR_Tank|Tank_Reflective|Tank_Jet|No_Smoking_Fuel|Fuel_Hazard)/.test(name)
        ||(/^Rear_/.test(name)&&c.x>.9)||(/^(Axle|Chassis_Crossmember|Side_Marker)/.test(name)&&c.x>.4)))this.trailer.attach(mesh);
    }
    model.updateMatrixWorld(true);
    // Restore the full-length wide body; only its underside rises over the hitch.
    for(const mesh of articulated?meshes:[]){
      if(!mesh.parent||!/^(Tank_Shell|Tank_Curved_Saddle|Tank_Saddle)/.test(mesh.name))continue;
      const geometry=this.own(mesh.geometry.clone()),p=geometry.getAttribute('position'),inverse=mesh.matrixWorld.clone().invert();
      for(let i=0;i<p.count;i++){
        const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
        v.y+=tankLift(v.x)*THREE.MathUtils.clamp((.0515-v.y)/.3065,0,1);
        v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);
      }
      geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
    }
    if(articulated)refitTankMarkings(meshes,g=>this.own(g));
    // Both chassis variants need the same free bay for the overwing reel.
    clearCouplingSweep(model,g=>this.own(g));
    spaceServiceReels(model,g=>this.own(g));
    lowerEquipmentDeck(model,g=>this.own(g));
    refitWheelSurrounds(model,g=>this.own(g));
    clearFrameTyreSides(model,g=>this.own(g));
    const steel=this.material('#343e45',.7,.45),silver=this.material('#b8c4cb',.7,.35),rubber=this.material('#232629',0,.94),dark=this.material('#14191d',.3,.65),red=this.material('#b72f24',.3,.5);
    const add=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material)=>{
      const mesh=new THREE.Mesh(this.own(geometry),material);mesh.name=name;mesh.userData.sharedAsset=true;model.add(mesh);return mesh;
    };
    const attach=(mesh:THREE.Object3D)=>{model.updateMatrixWorld(true);this.trailer.attach(mesh);};
    const box=(name:string,size:[number,number,number],position:number[],material=steel,trailer=false)=>{
      const mesh=add(name,new THREE.BoxGeometry(...size),material);mesh.position.fromArray(position);if(trailer)attach(mesh);return mesh;
    };
    const tube=(name:string,a:number[],b:number[],radius:number,material=steel,trailer=true)=>{
      const start=new THREE.Vector3().fromArray(a),end=new THREE.Vector3().fromArray(b),delta=end.clone().sub(start);
      const mesh=add(name,new THREE.CylinderGeometry(radius,radius,delta.length(),24),material);
      mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());if(trailer)attach(mesh);return mesh;
    };
    if(articulated){
      for(const z of [.065,.245]){
        box('R14_TRACTOR_RAIL',[.755,.042,.028],[-.2025,-.31,z]);
        const frame=add('R14_TRAILER_FRAME',trailerFrameGeometry(),steel);frame.position.z=z;attach(frame);
      }
      for(const mesh of meshes)if(/^Side_Marker_Housing/.test(mesh.name)&&belongsToTrailer(mesh)){
        const c=centre(mesh),y=c.x<.27?-.212-(c.x-R14.hitchX)*.018/(.27-R14.hitchX):c.x<.52?-.23-(c.x-.27)*.08/.25:-.31;
        tube('R14_MARKER_BRACKET',[c.x,y,c.z<.155?.065:.245],c.toArray(),.0035,steel);
      }
      box('R14_COUPLING_CROSSMEMBER',[.15,.035,.27],[R14.hitchX,-.275,.155]);
      tube('R14_FIFTH_WHEEL_PEDESTAL',[R14.hitchX,-.26,.155],[R14.hitchX,-.235,.155],.047,steel,false);
      tube('R14_FIFTH_WHEEL_PLATE',[R14.hitchX,-.235,.155],[R14.hitchX,-.221,.155],.082,dark,false);
      tube('R14_KINGPIN',[R14.hitchX,-.245,.155],[R14.hitchX,-.21,.155],.013,silver);
      for(const z of [-.035,.345]){
        for(const y of [-.35,-.375])box('R14_TRAILER_SIDEGUARD',[.49,.01,.01],[.79,y,z],silver,true);
        for(const x of [.545,1.035]){
          box('R14_TRAILER_GUARD_MOUNT',[.008,.065,.008],[x,-.34,z],steel,true);
          const railZ=z<.155?.065:.245;
          box('R14_TRAILER_GUARD_OUTRIGGER',[.014,.014,Math.abs(z-railZ)+.014],[x,-.315,(z+railZ)/2],steel,true);
        }
      }
      // Tank outlet and filling/top-up valves on both sides, above the sideguards.
      tube('R14_TANK_OUTLET',[.77,-.244,.155],[.77,-.309,.155],.019,silver);
      tube('R14_FILL_MANIFOLD',[.77,-.309,-.1],[.77,-.309,.41],.015,silver);
      for(const side of [-1,1]){
        const z=.155+side*.235,end=.155+side*.276;
        box('R14_FILL_VALVE',[.052,.044,.047],[.77,-.309,z],silver,true);
        tube('R14_FILL_FLANGE',[.77,-.309,end-side*.014],[.77,-.309,end],.028,silver);
        tube('R14_FILL_CAP',[.77,-.309,end],[.77,-.309,end+side*.004],.022,dark);
        tube('R14_VALVE_STEM',[.77,-.287,z],[.77,-.271,z],.006,silver);
        box('R14_VALVE_HANDLE',[.062,.007,.008],[.788,-.268,z],red,true);
        box('R14_FILL_GUARD',[.105,.008,.078],[.77,-.348,z],steel,true);
      }
      const face=this.material('#faf8ee',0,.8),ink=this.material('#16242c',0,.8);
      for(const side of [-1,1]){
        const gauge=new FuelGauge(g=>this.own(g),silver,face,ink,red);
        gauge.position.set(.47,-.060,.155+side*.278);gauge.rotation.y=side<0?Math.PI:0;
        model.add(gauge);attach(gauge);this.gauges.push(gauge);
      }
    }
    // Shared, circular tyre/rim geometry; no fender parts rotate with the wheels.
    const profile=[[.055,-.035],[.079,-.035],[.094,-.027],[.1,-.019],[.1,-.012],[.097,-.011],[.097,-.009],[.1,-.008],[.1,.008],[.097,.009],[.097,.011],[.1,.012],[.1,.019],[.094,.027],[.079,.035],[.055,.035],[.055,-.035]].map(([r,z])=>new THREE.Vector2(r,z));
    const tyre=this.own(new THREE.LatheGeometry(profile,64).rotateX(Math.PI/2));
    const rim=this.own(new THREE.CylinderGeometry(.056,.056,.068,32).rotateX(Math.PI/2));
    const hub=this.own(new THREE.CylinderGeometry(.027,.027,.078,32).rotateX(Math.PI/2));
    const bolts:THREE.BufferGeometry[]=[],holes:THREE.BufferGeometry[]=[];
    for(const side of [-1,1])for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      bolts.push(new THREE.CylinderGeometry(.0032,.0032,.004,6).rotateX(Math.PI/2).translate(Math.cos(a)*.033,Math.sin(a)*.033,side*.036));
      holes.push(new THREE.CylinderGeometry(.005,.005,.002,12).rotateX(Math.PI/2).translate(Math.cos(a+.18)*.045,Math.sin(a+.18)*.045,side*.0345));
    }
    const boltGeometry=this.own(mergeGeometries(bolts)!);bolts.forEach(g=>g.dispose());
    const holeGeometry=this.own(mergeGeometries(holes)!);holes.forEach(g=>g.dispose());
    for(const geometry of [tyre,rim,hub,boltGeometry,holeGeometry])geometry.scale(R14_WHEEL_SCALE,R14_WHEEL_SCALE,R14_WHEEL_SCALE);
    for(const [index,x] of [R14.frontAxle,R14.tractorAxle,R14.trailerAxle].entries())for(const side of [-1,1]){
      const pivot=new THREE.Group(),spin=new THREE.Group();pivot.name=`R14_WHEEL_${index}_${side}`;
      pivot.position.set(x,R14.axleY,.155+side*.19);model.add(pivot);pivot.add(spin);
      for(const [name,geometry,material] of [['R14_TYRE',tyre,rubber],['R14_RIM',rim,silver],['R14_HUB',hub,steel],['R14_WHEEL_BOLTS',boltGeometry,silver],['R14_WHEEL_VENTS',holeGeometry,dark]] as const){
        const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.userData.sharedAsset=true;spin.add(mesh);
      }
      if(articulated&&index===2)attach(pivot);this.wheels.push({pivot,spin,front:index===0,trailer:articulated&&index===2});
    }
    completeVehicleSteps(model,g=>this.own(g),silver);clarifyFrontIndicators(model,g=>this.own(g));
    refitServicePlatform(model,g=>this.own(g),silver);
    refitFuelDelivery(model,g=>this.own(g),{metal:silver,dark,black:rubber,red,white:this.material('#e7ecef',.15,.4)});
    refitTankAccessRails(model,g=>this.own(g),silver);
    this.deadman=new VehicleDeadman(model);
    this.cab=new VehicleCab(model);seatSampleJar(model);separatePlatformGateFaces(model,g=>this.own(g));refineVehicleHatches(model,g=>this.own(g));stabilizeVehicleSurfaces(model,m=>this.materials.add(m));stabilizeVehicleMarkings(model,g=>this.own(g),m=>this.materials.add(m));model.updateMatrixWorld(true);
    const button=model.getObjectByName('Platform_Lift_Toggle_Button') as THREE.Mesh|undefined;
    if(button){this.platformButton=this.material('#28df62',.15,.4);button.material=this.platformButton;this.setPlatformRaised(false);}
  }
  private own<T extends THREE.BufferGeometry>(g:T):T{this.geometries.add(g);return g;}
  optimizeRendering(clips:THREE.AnimationClip[]){return this.batching??=batchVehicle(this.model,clips,g=>this.own(g),m=>this.materials.add(m),[this.trailer,...this.wheels.flatMap(w=>[w.pivot,w.spin])]);}
  setPlatformRaised(raised:boolean){if(this.platformButton&&this.platformRaised!==raised){this.platformRaised=raised;this.platformButton.color.set(raised?'#ff2020':'#28df62');this.platformButton.emissive.copy(this.platformButton.color);this.platformButton.emissiveIntensity=raised?1.2:.35;}}
  private material(color:string,metalness:number,roughness:number){const m=new THREE.MeshStandardMaterial({color,metalness,roughness});this.materials.add(m);return m;}
  setArticulation(angle=0){this.trailer.rotation.y=this.articulated?-THREE.MathUtils.clamp(angle,-R14.maxArticulation,R14.maxArticulation):0;}
  setFuelLevel(litres=0){this.gauges.forEach(g=>g.setLitres(litres));}
  update(distanceMetres:number,steer:number,trailerAngle=0){
    const scale=this.model.getWorldScale(new THREE.Vector3()).x;this.setArticulation(trailerAngle);
    for(const wheel of this.wheels){wheel.spin.rotation.z=distanceMetres/(R14.tyreRadius*scale);wheel.pivot.rotation.y=wheel.front?-steer:0;}
  }
  dispose(){this.deadman.dispose();this.cab.dispose();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());}
}



