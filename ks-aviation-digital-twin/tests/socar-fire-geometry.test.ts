import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {validateScene,type Entity} from '../src/scene-data';
import {fireId,fireFrame,installSocarFireLayout,referenceConnectionPoints,type Point3} from '../src/socar-fire-layout';
import {localToWorld} from '../src/facility-data';
import {pipeTubeGeometry,roundedPipeCurve} from '../src/pipe-geometry';

const scene=validateScene(JSON.parse(readFileSync('docs/backups/adb-before-fire-lines-revision-6.json','utf8')).payload);
installSocarFireLayout(scene);
const frame=fireFrame(scene.entities)!,map=new Map(scene.entities.map(e=>[e.id,e]));
const get=(key:string)=>map.get(fireId(key))!;
const vector=(p:Point3)=>new T.Vector3(...p);
const path=(e:Entity)=>e.facility!.pipePath!.map(p=>localToWorld(e,p));
const connection=(e:Entity)=>referenceConnectionPoints(map.get(e.facility!.supplyId!)!,e);
const direction=(a:Point3,b:Point3)=>vector(b).sub(vector(a)).normalize();
const close=(a:Point3,b:Point3)=>assert.ok(vector(a).distanceTo(vector(b))<1e-8,'Shared pipe ends coincide');
const feed=path(get('main-feed')),header=path(get('water-header')),perimeter=path(get('main-west'));
close(feed.at(-1)!,header[0]);close(header.at(-1)!,perimeter[0]);
assert.ok(direction(feed.at(-2)!,feed.at(-1)!).dot(direction(header[0],header[1]))>.999999,'DHMİ and the collector meet on a straight vertical tangent');
assert.ok(direction(header.at(-2)!,header.at(-1)!).dot(direction(perimeter[0],perimeter[1]))>.999999,'Collector owns its outlet elbow; B begins on the same straight tangent');
assert.equal(connection(get('water-header')).length,1,'No phantom gap connector at the collector inlet');
assert.equal(connection(get('main-west')).length,1,'No perpendicular butt joint at the collector outlet');
const corners=[header[1],header[2],perimeter[1],perimeter[2],perimeter[3]];
for(let i=1;i<=3;i++)assert.ok(Math.abs(direction(corners[i-1],corners[i]).dot(direction(corners[i],corners[i+1])))<1e-8,'B has three orthogonal turns: parallel, down, fence');
assert.ok(vector(header[2]).distanceTo(vector(perimeter[1]))>1.25,'Full upper straight precedes the outside drop');
assert.ok(Math.abs(perimeter[1][0]-perimeter[2][0])+Math.abs(perimeter[1][2]-perimeter[2][2])<1e-8,'B drops vertically');

// The reducer reaches exactly the adjoining 4-inch radius at both seams,
// while keeping the intervening collector at its larger diameter.
const radius=.075,small=.0508,geo=pipeTubeGeometry(roundedPipeCurve([[0,0,0],[0,.32,0],[2.28,.32,0],[2.28,.32,.4]],.16),radius,{start:small,end:small,length:.12});
const positions=geo.getAttribute('position'),last=geo.parameters.tubularSegments;
for(const [row,center] of [[0,new T.Vector3()],[last,new T.Vector3(2.28,.32,.4)]] as const)for(let j=0;j<16;j++)assert.ok(Math.abs(new T.Vector3().fromBufferAttribute(positions,row*17+j).distanceTo(center)-small)<1e-6,'Reducer seam matches the small pipe, leaving no annular hole');
assert.ok(Array.from({length:positions.count},(_,i)=>Math.abs(positions.getZ(i))).some(z=>Math.abs(z-radius)<1e-6),'Collector retains its full diameter away from the reducers');
geo.dispose();

const bund=map.get('271b17cb-99b0-46b5-a229-b12ec5ddf7ca')!,wall=bund.points!.map(p=>localToWorld(bund,[p[0],0,p[1]]));
const wallDirection=direction(wall[2],wall[3]),eastDirection=direction(wall[3],wall[4]);
const wallRuns=['loading-outlet','receiving-outlet'].map(key=>{
 const route=connection(get(key));
 return route.slice(1).flatMap((b,i)=>{
  const a=route[i],d=vector(b).sub(vector(a));
  return Math.abs(a[1]-b[1])<1e-8&&a[1]>1.8&&a[1]<3&&d.length()>4?[{a,b,d:d.normalize()}]:[];
 });
});
for(const runs of wallRuns){
 assert.ok(runs.some(s=>Math.abs(s.d.dot(wallDirection))>.999999),'West wall approach and wall run form one straight line');
 assert.ok(runs.some(s=>Math.abs(s.d.dot(eastDirection))>.999999),'East wall run is parallel to the surveyed wall');
}
const southRuns=wallRuns.map(runs=>runs.find(s=>Math.abs(s.d.dot(wallDirection))>.999999)!);
const separation=vector(southRuns[1].a).sub(vector(southRuns[0].a)).cross(wallDirection).length();
assert.ok(Math.abs(separation-.24)<1e-8,'Wall pipes retain a constant 24 cm perpendicular separation');

// Test the rendered elbow centrelines, rather than only their sharp control
// polygons: rounding must not make independent branches intersect.
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const segmentDistance=(p:T.Vector3,q:T.Vector3,r:T.Vector3,s:T.Vector3)=>{
 const d1=q.clone().sub(p),d2=s.clone().sub(r),v=p.clone().sub(r),a=d1.lengthSq(),e=d2.lengthSq(),f=d2.dot(v),c=d1.dot(v),b=d1.dot(d2),denominator=a*e-b*b;
 let u=denominator>1e-16?clamp((b*f-c*e)/denominator):0,t=(b*u+f)/e;
 if(t<0){t=0;u=clamp(-c/a);}else if(t>1){t=1;u=clamp((b-c)/a);}
 return p.clone().addScaledVector(d1,u).distanceTo(r.clone().addScaledVector(d2,t));
};
const keys=['foam-1-outlet','foam-2-outlet','cool-1-outlet','cool-2-outlet','loading-outlet','receiving-outlet','main-west'];
const runs=keys.map(key=>{
 const e=get(key),points=(key==='main-west'?path(e):connection(e)).map(p=>frame.local(p)),curve=roundedPipeCurve(points,.16);
 const segments=curve.curves.flatMap(c=>{const n=c instanceof T.LineCurve3?1:24;return Array.from({length:n},(_,i)=>[c.getPoint(i/n),c.getPoint((i+1)/n)] as [T.Vector3,T.Vector3][]);}).filter(([a,b])=>a.z<-20&&b.z<-20&&a.distanceToSquared(b)>1e-12);
 return {segments,radius:(e.facility!.pipeDiameter??.1016)/2};
});
let minimum=Infinity;
for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){
 let distance=Infinity;for(const [a,b] of runs[i].segments)for(const [c,d] of runs[j].segments)distance=Math.min(distance,segmentDistance(a,b,c,d));
 minimum=Math.min(minimum,distance-runs[i].radius-runs[j].radius);
 assert.ok(distance>runs[i].radius+runs[j].radius+.005,`Independent rounded pipes touch: ${keys[i]} / ${keys[j]}`);
}
console.log(`PASS: three B elbows, straight collector seams and reducers, parallel wall runs, rounded-pipe clearance ${(minimum*1000).toFixed(1)} mm`);
