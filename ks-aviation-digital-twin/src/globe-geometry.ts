import * as THREE from 'three';
export const EARTH_RADIUS=2;
export const CAMERA_FLOOR=2.055;
export const TURKEY_BOUNDS={west:24.1,east:45,north:43,south:34.2};
export const DETAIL_BOUNDS={west:20,east:49,north:46,south:31};
export type GeoPoint={lat:number;lon:number};
export function earthPoint(lat:number,lon:number,r=EARTH_RADIUS){
 const p=THREE.MathUtils.degToRad(lat),l=THREE.MathUtils.degToRad(lon);
 return new THREE.Vector3(r*Math.cos(p)*Math.cos(l),r*Math.sin(p),-r*Math.cos(p)*Math.sin(l));
}
export function worldDistance(aspect:number){
 const vfov=THREE.MathUtils.degToRad(40),hfov=2*Math.atan(Math.tan(vfov/2)*aspect);
 return EARTH_RADIUS/Math.sin(Math.min(vfov,hfov)/2)*1.09;
}
/** Fit geographical bounds on the curved earth, in both portrait and landscape. */
export function regionDistance(aspect:number,center:GeoPoint,bounds=TURKEY_BOUNDS){
 const camera=new THREE.PerspectiveCamera(40,Math.max(.2,aspect),.004,100);
 const n=earthPoint(center.lat,center.lon,1),samples:THREE.Vector3[]=[];
 for(let y=0;y<=6;y++)for(let x=0;x<=10;x++)samples.push(earthPoint(bounds.south+(bounds.north-bounds.south)*y/6,bounds.west+(bounds.east-bounds.west)*x/10));
 let lo=CAMERA_FLOOR,hi=worldDistance(aspect);
 for(let i=0;i<32;i++){
  const d=(lo+hi)/2;camera.position.copy(n).multiplyScalar(d);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const fits=samples.every(p=>{const v=p.clone().project(camera);return Math.abs(v.x)<.89&&Math.abs(v.y)<.76&&v.z<1;});
  if(fits)hi=d;else lo=d;
 }
 return hi;
}
/** Interpolate around the earth, never through it, including interrupted flights. */
export function flightPosition(start:THREE.Vector3,end:THREE.Vector3,t:number){
 const a=start.clone().normalize(),b=end.clone().normalize();
 const rotation=new THREE.Quaternion().setFromUnitVectors(a,b);
 const q=new THREE.Quaternion().slerp(rotation,t);
 const altitude=Math.exp(THREE.MathUtils.lerp(Math.log(Math.max(.055,start.length()-EARTH_RADIUS)),Math.log(Math.max(.055,end.length()-EARTH_RADIUS)),t));
 return a.applyQuaternion(q).multiplyScalar(EARTH_RADIUS+altitude);
}
export function onVisibleHemisphere(point:THREE.Vector3,camera:THREE.Vector3){
 return point.dot(camera)>EARTH_RADIUS*EARTH_RADIUS+.00001;
}
