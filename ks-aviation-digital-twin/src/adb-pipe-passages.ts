import type {Entity,SceneData} from './scene-data';
import {localToWorld,worldToLocal} from './facility-data';
import {detailFingerprint} from './adb-pipe-details';
import type {Point3} from './socar-fire-layout';

// Revision 18 is the user's saved route. Only exact matching components are repaired.
const baseline:Record<string,string>={"271b17cb-99b0-46b5-a229-b12ec5ddf7ca":"ecb46351:454","adb-fire-loading-outlet":"7beccd89:1033","mtfhc483jg7zz9":"ee7281b5:111","4d41e8fa-fd2d-4eee-9a7b-1af6e32657e3":"d9907168:174","adb-fire-receiving-outlet":"d55a73bb:758","adb-fire-receiving-roof":"5bc351fb:57"};
export function repairAdbPipePassages(scene:SceneData){
 const map=new Map(scene.entities.map(e=>[e.id,e])),match=(id:string)=>{const e=map.get(id);return e&&detailFingerprint(e)===baseline[id]?e:undefined;};let changed=false;
 const loading=match('adb-fire-loading-outlet'),drain=match('4d41e8fa-fd2d-4eee-9a7b-1af6e32657e3'),island=match('mtfhc483jg7zz9'),wall=match('271b17cb-99b0-46b5-a229-b12ec5ddf7ca');
 if(loading&&drain&&island&&wall&&!map.has('adb-passage-receiving')&&!map.has('adb-passage-island')){
  const f=loading.facility!,old=f.supplyRoute!.map(p=>localToWorld(loading,p));
  const ends=drain.points!.map(p=>localToWorld(drain,[p[0],0,p[1]])).sort((a,b)=>Math.hypot(a[0]-old[6][0],a[2]-old[6][2])-Math.hypot(b[0]-old[6][0],b[2]-old[6][2]));
  const [a,b]=ends,len=Math.hypot(b[0]-a[0],b[2]-a[2]),ux=(b[0]-a[0])/len,uz=(b[2]-a[2])/len;
  // Horizontal access lengths are visual placement allowances, not surveyed dimensions.
  // Opening width follows the existing channel (45 cm). 50 cm is depth, not diameter.
  const inside:Point3=[a[0]-ux*.85,0,a[2]-uz*.85],exit:Point3=[b[0]+ux*.55,0,b[2]+uz*.55];
  const access=(id:string,name:string,p:Point3,q:Point3):Entity=>({...structuredClone(drain),id,name,position:[0,0,0],heading:0,scale:1,width:drain.width*drain.scale,points:[[p[0],p[2]],[q[0],q[2]]],facility:{trenchDepth:.5,trenchGrate:false,trenchTop:.25}});
  scene.entities.push(access('adb-passage-receiving','Mal kabul · beton boru geçişi · 50 cm derinlik',inside,a),access('adb-passage-island','Dolum adası · beton boru geçişi · 50 cm derinlik',b,[exit[0]+ux*.15,0,exit[2]+uz*.15]));
  const lower=(p:Point3):Point3=>[p[0],-.18,p[2]],riser=old.at(-1)!,curb=old.at(-2)!;
  const aboveConcrete=island.position[1]+.17*island.scale+(f.pipeDiameter??.0762)*loading.scale/2+.015;curb[1]=aboveConcrete;riser[1]=aboveConcrete;
  // Retain the entire upstream valve/wall route, change only its last approach and channel ends.
  f.supplyRoute=[...f.supplyRoute!.slice(0,6),...[ [inside[0],old[6][1],inside[2]] as Point3,lower(inside),lower(a),lower(b),lower(exit),[exit[0],curb[1],exit[2]] as Point3,curb,riser].map(p=>worldToLocal(loading,p))];
  f.routeEdited=true;changed=true;
 }
 const receiving=match('adb-fire-receiving-outlet'),roof=match('adb-fire-receiving-roof');
 if(receiving&&roof){
  const f=receiving.facility!,old=f.supplyRoute!.map(p=>localToWorld(receiving,p)),near=worldToLocal(roof,old[6]);
  const side=Math.sign(near[0])||1,end=Math.sign(near[2])||1,x=side*(roof.width*.47+.14),columnZ=end*roof.length*.47,z=end*roof.length*.4,y=roof.height-.25;
  const p=(x:number,y:number,z:number)=>localToWorld(roof,[x,y,z]),inlet=p(x,y-.25,columnZ);
  const floor=worldToLocal(roof,old[5])[1];
  f.supplyRoute=[...f.supplyRoute!.slice(0,6),worldToLocal(receiving,p(x,floor,columnZ))];
  f.pipePath=[inlet,p(x,y,columnZ),p(x,y,z),p(0,y,z),p(0,y,-z),p(0,y-1.25,-z)].map(p=>worldToLocal(receiving,p));
  f.routeEdited=true;changed=true;
 }
 return changed;
}
