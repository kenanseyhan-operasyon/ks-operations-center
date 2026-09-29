import * as THREE from 'three';

type Lamp={material:THREE.MeshStandardMaterial;color:THREE.Color;beacon:boolean;phase:number};
/** R14's named lenses are the light sources. Each vehicle owns its materials/state. */
export class VehicleLighting{
  private lamps:Lamp[]=[];
  private originals:{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[]}[]=[];
  private lights=new THREE.Group();
  private pools=new THREE.Group();
  private head=new THREE.Vector3();private panel=new THREE.Vector3();
  private spot=new THREE.SpotLight(0xfff0ce,0,25,.48,.7,1.5);
  private work=new THREE.PointLight(0xfff3d2,0,6,1.5);
  private texture:THREE.DataTexture;
  private beams:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];
  private groundY=0;
  constructor(private model:THREE.Object3D,groundScene:THREE.Scene){
    model.updateWorldMatrix(true,true);
    const headlights:THREE.Vector3[]=[];
    model.traverse(n=>{
      if(!(n instanceof THREE.Mesh))return;
      const name=n.name,isBeacon=/Beacon_Amber_Lens|Beacon_Rounded_Top/.test(name);
      const white=/Headlamp_Lens|Fog_Lamp|Panel_Worklight_Lens|Manometer_Dial|Meter_Display|Meter_Backlit/.test(name);
      const red=/Rear_Position_Lamp/.test(name),amber=/Side_Marker_Amber|Amber_Indicator|Rear_Indicator/.test(name);
      if(!isBeacon&&!white&&!red&&!amber)return;
      this.originals.push({mesh:n,material:n.material});
      const anchor=model.worldToLocal(new THREE.Box3().setFromObject(n).getCenter(new THREE.Vector3()));
      const color=new THREE.Color(red?0xff2620:isBeacon||amber?0xff9c16:0xfff1d0),phase=anchor.z>0?0:3;
      const clone=(m:THREE.Material)=>{const copy=m.clone();if(copy instanceof THREE.MeshStandardMaterial){copy.emissive.set(0);copy.emissiveIntensity=0;this.lamps.push({material:copy,color,beacon:isBeacon,phase});}return copy;};
      n.material=Array.isArray(n.material)?n.material.map(clone):clone(n.material);
      if(/Headlamp_Lens/.test(name))headlights.push(anchor);
      if(/Panel_Worklight_Lens/.test(name))this.panel.copy(anchor);
    });
    headlights.forEach(p=>this.head.add(p));if(headlights.length)this.head.divideScalar(headlights.length);
    this.groundY=model.worldToLocal(new THREE.Box3().setFromObject(model).min.clone()).y;
    this.spot.position.copy(this.head);this.spot.target.position.copy(this.head).add(new THREE.Vector3(-12,-1,0));
    this.work.position.copy(this.panel).add(new THREE.Vector3(0,0,.1));
    this.lights.add(this.spot,this.spot.target,this.work);model.add(this.lights);
    // Basic map materials don't receive lights. Small pooled textures illuminate that same flat raster.
    const data=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5);data[i]=255;data[i+1]=234;data[i+2]=187;data[i+3]=Math.round(Math.max(0,1-r)**2*190);}
    this.texture=new THREE.DataTexture(data,64,64);this.texture.needsUpdate=true;
    for(let i=0;i<2;i++){const beam=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:this.texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));beam.rotation.x=-Math.PI/2;beam.renderOrder=1100;beam.raycast=()=>{};this.beams.push(beam);this.pools.add(beam);}
    groundScene.add(this.pools);this.update(false,false,0);
  }
  update(running:boolean,night:boolean,time:number){
    for(const lamp of this.lamps){const flash=!lamp.beacon||((Math.floor(time/160)+lamp.phase)%6<2);lamp.material.emissive.copy(lamp.beacon&&Math.floor(time/960)%2?new THREE.Color(0xf3f7ff):lamp.color);lamp.material.emissiveIntensity=running&&flash?(night?3.2:1.3):0;}
    this.spot.intensity=running&&night?65:0;this.work.intensity=running&&night?14:0;this.pools.visible=running&&night;
    if(!this.pools.visible)return;
    this.model.updateWorldMatrix(true,false);
    const dir=new THREE.Vector3(-1,0,0).transformDirection(this.model.matrixWorld),head=this.model.localToWorld(this.head.clone()),panel=this.model.localToWorld(this.panel.clone()),ground=this.model.localToWorld(new THREE.Vector3(0,this.groundY,0)).y;
    const yaw=Math.atan2(dir.x,dir.z);this.beams[0].position.copy(head).addScaledVector(dir,4);this.beams[0].position.y=ground+.012;this.beams[0].rotation.set(-Math.PI/2,0,yaw);this.beams[0].scale.set(4,11,1);
    this.beams[1].position.set(panel.x,ground+.015,panel.z);this.beams[1].scale.set(4,4,1);
  }
  dispose(){this.lights.removeFromParent();this.pools.removeFromParent();for(const {mesh,material} of this.originals){(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());mesh.material=material;}this.beams.forEach(b=>{b.geometry.dispose();b.material.dispose();});this.texture.dispose();}
}
