import * as THREE from 'three';

// Camera-only alignment. The airport raster and every object keep their surveyed coordinates.
export const AIRPORT_TARGET = new THREE.Vector3(250, 0, -1300);
export function cameraOffset(distance:number,bearing:number,elevation=68*Math.PI/180){
  return new THREE.Vector3(Math.sin(bearing)*Math.cos(elevation),Math.sin(elevation),Math.cos(bearing)*Math.cos(elevation)).multiplyScalar(distance);
}
export function airportFrame(width:number,height:number,upright:boolean){
  const aspect=Math.max(.2,width/Math.max(1,height));
  // Align the image edges, not the diagonal runway inside the image.
  const bearing=upright?0:Math.PI/2;
  const span=Math.max(upright?3000:5100,(upright?5100:3000)*aspect)/.96;
  const distance=span/(2*aspect*Math.tan(THREE.MathUtils.degToRad(21)));
  // Infinitesimal pole offset keeps OrbitControls' bearing stable; visually straight down.
  return {bearing,distance,offset:cameraOffset(distance,bearing,Math.PI/2-1e-5),span};
}

export function screenDeltaToWorld(dx:number,dy:number,bearing:number):[number,number]{
  return [Math.cos(bearing)*dx+Math.sin(bearing)*dy,-Math.sin(bearing)*dx+Math.cos(bearing)*dy];
}
