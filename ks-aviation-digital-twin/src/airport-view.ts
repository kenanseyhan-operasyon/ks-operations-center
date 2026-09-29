import * as THREE from 'three';

// Camera-only alignment. The airport raster and every object keep their surveyed coordinates.
export const AIRPORT_TARGET = new THREE.Vector3(250, 0, -1300);
export const RUNWAY_BEARING = 14 * Math.PI / 180;
export function cameraOffset(distance:number,bearing:number,elevation=68*Math.PI/180){
  return new THREE.Vector3(Math.sin(bearing)*Math.cos(elevation),Math.sin(elevation),Math.cos(bearing)*Math.cos(elevation)).multiplyScalar(distance);
}
export function airportFrame(width:number,height:number,upright:boolean){
  const aspect=Math.max(.2,width/Math.max(1,height));
  const bearing=RUNWAY_BEARING+(upright?0:Math.PI/2);
  const camera=new THREE.PerspectiveCamera(42,aspect,.05,30000);
  const corners=[[-1250,-3850],[1750,-3850],[-1250,1250],[1750,1250]].map(([x,z])=>new THREE.Vector3(x,0,z));
  let distance=1000;
  for(;distance<18000;distance+=25){
    camera.position.copy(AIRPORT_TARGET).add(cameraOffset(distance,bearing));camera.lookAt(AIRPORT_TARGET);camera.updateMatrixWorld();
    if(corners.every(p=>{const q=p.clone().project(camera);return Math.abs(q.x)<.91&&Math.abs(q.y)<.85;}))break;
  }
  const projected=corners.map(p=>{const x=p.x-AIRPORT_TARGET.x,z=p.z-AIRPORT_TARGET.z;return [Math.cos(bearing)*x-Math.sin(bearing)*z,Math.sin(bearing)*x+Math.cos(bearing)*z];});
  const span=2*Math.max(...projected.map(p=>Math.max(Math.abs(p[0])/.91,Math.abs(p[1])*aspect/.85)));
  return {bearing,distance,offset:cameraOffset(distance,bearing),span};
}

export function screenDeltaToWorld(dx:number,dy:number,bearing:number):[number,number]{
  return [Math.cos(bearing)*dx+Math.sin(bearing)*dy,-Math.sin(bearing)*dx+Math.cos(bearing)*dy];
}
