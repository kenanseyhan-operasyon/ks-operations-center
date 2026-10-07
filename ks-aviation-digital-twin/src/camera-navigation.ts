import * as THREE from 'three';
import type {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
export const CAMERA_FLOOR=.25;
export const CAMERA_CEILING=20000;
/** The ground image is a visual layer, not a horizontal camera boundary. */
export function constrainCameraHeight(camera:THREE.Camera){camera.position.y=THREE.MathUtils.clamp(camera.position.y,CAMERA_FLOOR,CAMERA_CEILING);}
export function configureWorkspaceOrbit(orbit:OrbitControls){
  orbit.enableDamping=true;orbit.zoomToCursor=true;orbit.touches.ONE=THREE.TOUCH.ROTATE;orbit.touches.TWO=THREE.TOUCH.DOLLY_PAN;
  orbit.maxPolarAngle=Math.PI-.03;orbit.minDistance=.5;orbit.maxDistance=25000;orbit.screenSpacePanning=false;
}
/** Translate along the pointer ray in free-look mode, without changing its orientation. */
export function zoomFreeCamera(camera:THREE.PerspectiveCamera,canvas:HTMLElement,clientX:number,clientY:number,deltaY:number){
  if(!Number.isFinite(deltaY)||deltaY===0)return false;
  const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();camera.updateMatrixWorld();
  ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/Math.max(1,rect.width)*2-1,1-(clientY-rect.top)/Math.max(1,rect.height)*2),camera);
  const ground=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
  const distance=THREE.MathUtils.clamp(ground?ground.distanceTo(camera.position):camera.position.y*2,2,25000);
  let travel=distance*(1-Math.exp(THREE.MathUtils.clamp(deltaY*.001,-.3,.3)));
  const vertical=ray.ray.direction.y*travel;
  if(camera.position.y+vertical<CAMERA_FLOOR)travel*=(CAMERA_FLOOR-camera.position.y)/vertical;
  if(camera.position.y+vertical>CAMERA_CEILING)travel*=(CAMERA_CEILING-camera.position.y)/vertical;
  camera.position.addScaledVector(ray.ray.direction,travel);constrainCameraHeight(camera);camera.updateMatrixWorld();return true;
}
/** Keep bearing and gently approach the clicked ground point. */
export function clickApproachOffset(position:THREE.Vector3,focus:THREE.Vector3){
  const offset=position.clone().sub(focus),length=offset.length();
  if(!Number.isFinite(length)||length<.001)return new THREE.Vector3(0,5,.001);
  offset.multiplyScalar(Math.max(5,length*.8)/length);offset.y=Math.max(CAMERA_FLOOR,offset.y);return offset;
}
