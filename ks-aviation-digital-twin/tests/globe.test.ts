import { globeInteraction } from '../src/globe-geometry';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAMERA_FLOOR, TURKEY_BOUNDS, earthPoint, flightPosition, regionDistance, worldDistance, onVisibleHemisphere } from '../src/globe-geometry';
for(const [width,height] of [[1363,936],[393,740],[320,740],[844,390]]){
 const aspect=width/height,camera=new THREE.PerspectiveCamera(40,aspect,.004,100);
 camera.position.copy(earthPoint(39,34.55,regionDistance(aspect,{lat:39,lon:34.55})));camera.lookAt(0,0,0);camera.updateMatrixWorld();
 for(const [lat,lon] of [[34.2,24.1],[34.2,45],[43,24.1],[43,45],[38.2924,27.157],[36.2992,32.3014]]){
  const p=earthPoint(lat,lon),v=p.clone().project(camera);
  assert.ok(Math.abs(v.x)<.91&&Math.abs(v.y)<.78,`Türkiye clipped at ${width} × ${height}`);
  assert.ok(onVisibleHemisphere(p,camera.position),'All Turkish points must be on the visible surface');
 }
 assert.ok(worldDistance(aspect)>regionDistance(aspect,{lat:39,lon:34.55}));
 const start=earthPoint(-28,-145,worldDistance(aspect)),end=camera.position.clone();
 for(let i=0;i<=100;i++){const p=flightPosition(start,end,i/100);assert.ok(p.length()>=CAMERA_FLOOR,'Flight entered earth');assert.ok(Number.isFinite(p.x));}
 assert.ok(flightPosition(start,end,0).distanceTo(start)<1e-8);
 assert.ok(flightPosition(start,end,1).distanceTo(end)<1e-8);
 assert.equal(onVisibleHemisphere(earthPoint(-39,-145.45),camera.position),false);
}
console.log('Globe camera: world → Türkiye framing, safe spherical flights, portrait/landscape and rear marker occlusion passed.');

for(const mobile of [true,false]){const t=globeInteraction('turkey',2.6,mobile?740:900,mobile),world=globeInteraction('world',2.6,900,mobile);assert.ok(t.rotateSpeed<world.rotateSpeed/8);assert.ok(t.degreesPerPixel*100<3,'100px drag stays within a few degrees');assert.equal(t.enableDamping,false,'Regional drag has no continuing spin');assert.ok(globeInteraction('turkey',2.1,740,mobile).rotateSpeed<t.rotateSpeed,'Zooming closer slows drag further');}
