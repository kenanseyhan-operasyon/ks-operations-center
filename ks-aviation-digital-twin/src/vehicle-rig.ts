import * as THREE from 'three';
type Wheel={pivot:THREE.Group;spin:THREE.Group;radius:number;front:boolean};
/** Split the existing paired tyres without touching the GLB or shared geometry. */
export class VehicleRig{
  wheels:Wheel[]=[];wheelbase=7;private generated:THREE.BufferGeometry[]=[];
  constructor(private model:THREE.Object3D){
    model.updateWorldMatrix(true,true);const inverse=model.matrixWorld.clone().invert();
    const pairs:THREE.Mesh[]=[];model.traverse(n=>{if(n instanceof THREE.Mesh&&n.name.startsWith('Original_Wheel_Pair'))pairs.push(n);});
    const centers:number[]=[];
    for(const pair of pairs){
      const geometry=pair.geometry.clone().applyMatrix4(inverse.clone().multiply(pair.matrixWorld));geometry.computeBoundingBox();
      const bounds=geometry.boundingBox!,middle=(bounds.min.z+bounds.max.z)/2,front=pair.name.endsWith('Front');centers.push((bounds.min.x+bounds.max.x)/2);
      const pos=geometry.getAttribute('position'),indices=geometry.index?.array||Array.from({length:pos.count},(_,i)=>i);
      for(const side of [-1,1]){
        const idx:number[]=[];for(let i=0;i<indices.length;i+=3){const z=(pos.getZ(indices[i])+pos.getZ(indices[i+1])+pos.getZ(indices[i+2]))/3;if((z>=middle?1:-1)===side)idx.push(indices[i],indices[i+1],indices[i+2]);}
        const geo=geometry.clone();geo.setIndex(idx);const box=new THREE.Box3();for(const i of idx)box.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos,i));
        const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());geo.translate(-center.x,-center.y,-center.z);geo.computeBoundingBox();geo.computeBoundingSphere();this.generated.push(geo);
        const pivot=new THREE.Group(),spin=new THREE.Group();pivot.name=`DRIVE_${front?'FRONT':'REAR'}_${side>0?'LEFT':'RIGHT'}`;pivot.position.copy(center);pivot.add(spin);model.add(pivot);
        const mesh=new THREE.Mesh(geo,pair.material);mesh.userData.sharedAsset=true;spin.add(mesh);
        // The existing hubs are separate; attach them to the matching tyre pivot.
        const hubs:THREE.Mesh[]=[];model.traverse(n=>{if(n instanceof THREE.Mesh&&/^Axle_Hub/.test(n.name))hubs.push(n);});
        for(const hub of hubs){const b=new THREE.Box3().setFromObject(hub),c=model.worldToLocal(b.getCenter(new THREE.Vector3()));if(Math.abs(c.x-center.x)<.045&&Math.abs(c.z-center.z)<.075){model.updateWorldMatrix(true,true);spin.attach(hub);}}
        this.wheels.push({pivot,spin,radius:Math.max(size.x,size.y)/2,front});
      }
      pair.visible=false;geometry.dispose();
    }
    if(centers.length===3)this.wheelbase=Math.abs(centers[0]-(centers[1]+centers[2])/2)*model.scale.x;
  }
  update(distanceMetres:number,steer:number){
    const scale=this.model.getWorldScale(new THREE.Vector3()).x;
    for(const wheel of this.wheels){wheel.spin.rotation.z=distanceMetres/(wheel.radius*scale);wheel.pivot.rotation.y=wheel.front?-steer:0;}
  }
  dispose(){this.generated.forEach(g=>g.dispose());}
}
