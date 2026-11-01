import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {validateScene,newEntity,type Entity} from '../src/scene-data';
import {FIRE_REFERENCE,FIRE_GROUP,FIRE_LAYOUT_REVISION,MONITOR_IDS,fireId,fireFrame,installSocarFireLayout,referenceConnectionPoints,type Point3} from '../src/socar-fire-layout';
import {localToWorld,portPosition} from '../src/facility-data';
import {FacilityNetwork} from '../src/facility-network';
import {NathanNavigation} from '../src/nathan-navigation';
import {fireDiagram} from '../src/socar-fire-diagram';
const original=validateScene(JSON.parse(readFileSync('docs/backups/adb-before-fire-lines-revision-6.json','utf8')).payload),scene=structuredClone(original);
installSocarFireLayout(scene);const map=new Map(scene.entities.map(e=>[e.id,e])),frame=fireFrame(scene.entities)!;
const get=(key:string)=>map.get(fireId(key))!;
assert.deepEqual(scene.routes,original.routes,'Existing driving routes are not edited');
assert.equal(get('water-header').facility?.referenceRevision,FIRE_LAYOUT_REVISION);
const shelter=scene.entities.find(e=>e.preset==='FOAM_SHELTER')!;
const bank=['foam-2-inlet','foam-1-inlet','cool-2-valve','cool-1-valve','loading-valve','receiving-valve'].map(get);
for(const [i,e] of bank.entries()){
 assert.ok(Math.hypot(e.position[0]-shelter.position[0],e.position[2]-shelter.position[2])<9,'Valve bank immediately beside foam shelter');
 const p=frame.local(e.position);assert.ok(p[2]<-34);if(i)assert.ok(p[0]<frame.local(bank[i-1].position)[0],'Field control order, facing bank');
}
const loading=map.get('mtfhc483jg7zz9')!,receiving=get('receiving-roof');
assert.ok(Math.hypot(loading.position[0]-receiving.position[0],loading.position[2]-receiving.position[2])>8,'Separate loading and receiving roofs');
const isolation=get('foam-isolation'),suction=referenceConnectionPoints(map.get(isolation.facility!.supplyId!)!,isolation);
assert.ok(suction.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...p.map((v,j)=>v-suction[i][j])),0)<5,'Short local concentrate pickup, not a 30m cross-site suction line');
let samples=0;
for(const e of scene.entities.filter(e=>e.facility?.reference===FIRE_REFERENCE)){
 const f=e.facility!,paths=e.preset!=='PIPE_RACK'&&f.pipePath?[f.pipePath.map(p=>localToWorld(e,p))]:[];
 for(const key of ['supplyId','concentrateId'] as const){const source=map.get(f[key]||'');if(source)paths.push(referenceConnectionPoints(source,e,key));}
 for(const path of paths)for(let i=1;i<path.length;i++){
  if(!f.routeEdited&&f.unverifiedSupplySpan===i-1&&paths.indexOf(path)===(f.pipePath?1:0))continue;
  const a=path[i-1],b=path[i],count=Math.max(1,Math.ceil(Math.hypot(...b.map((v,j)=>v-a[j]))/.08));
  for(let n=0;n<=count;n++){
   const p=frame.local(a.map((v,j)=>v+(b[j]-v)*n/count) as Point3),[x,y,z]=p;samples++;
   if(x>8.8&&x<11.8&&z>-5&&z<20||x>11.5&&x<24&&z>-25&&z<-.3)assert.ok(y<-.1||y>4.8,`${e.name} obstructs vehicle lane at ${p}`);
  }
 }
}
const oldNav=new NathanNavigation(original.entities),nav=new NathanNavigation(scene.entities);
for(let x=9.2;x<=11.6;x+=.4)for(let z=-4;z<=18;z++){
 const p=frame.world(x,0,z);if(!oldNav.blocked(p))assert.equal(nav.blocked(p),false,'Fire additions preserve existing clear pedestrian lane');
}
let officeWalkSamples=0;
for(const office of original.entities.filter(e=>e.preset==='BUILDING'&&e.name.includes('OFİS'))){
 const w=office.width/2+.55,l=office.length/2+.55,corners:Point3[]=[[-w,0,-l],[w,0,-l],[w,0,l],[-w,0,l],[-w,0,-l]];
 for(let j=1;j<corners.length;j++)for(let k=0;k<=30;k++){const p=localToWorld(office,corners[j-1].map((v,i)=>v+(corners[j][i]-v)*k/30) as Point3);if(!oldNav.blocked(p)){assert.equal(nav.blocked(p),false,'Office-side walking strip stays open');officeWalkSamples++;}}
}
assert.ok(officeWalkSamples>50);console.log('Office perimeter clear samples',officeWalkSamples);
assert.equal(new NathanNavigation([get('loading-outlet')]).blocked(get('loading-outlet').position),false,'No phantom equipment box at elevated sprinkler metadata origin');
assert.equal(new NathanNavigation([receiving]).blocked(receiving.position),false,'Canopy posts and roof, not a filled block');
const buried=newEntity('PIPE_RED',0,0);buried.facility={reference:FIRE_REFERENCE,pipePath:[[0,-.4,-2],[0,-.4,2]],pipeDiameter:.1};
assert.equal(new NathanNavigation([buried]).blocked([0,0,0]),false,'Buried pipe does not obstruct ground movement');
const network=new FacilityNetwork();network.start(scene.entities);
for(const id of MONITOR_IDS){
 const m=map.get(id)!,drum=map.get(m.facility!.concentrateId!)!;assert.equal(drum.preset,'FOAM_DRUM');
 network.operate(m,scene.entities);assert.equal(network.states.get(id)?.fluid,'solution');assert.equal(network.states.get(id)?.ratio,0,'Unmeasured ratio remains unspecified');
 const hose=referenceConnectionPoints(drum,m,'concentrateId');assert.deepEqual(hose[0],localToWorld(drum,[0,drum.height+.02,0]));assert.deepEqual(hose.at(-1),portPosition(m,'foam'));
}
network.levels.set(map.get(MONITOR_IDS[0])!.facility!.concentrateId!,0);network.evaluate(scene.entities);
assert.equal(network.states.get(MONITOR_IDS[0])?.fluid,'water');assert.equal(network.states.get(MONITOR_IDS[1])?.fluid,'solution','Local monitor foam supplies are independent');
const v1=JSON.parse(readFileSync('tests/fixtures/socar-fire-v1.json','utf8')) as {entities:Entity[];groups:typeof scene.groups};
const migrated=structuredClone(original),ids=new Set(v1.entities.map(e=>e.id));migrated.entities=[...migrated.entities.filter(e=>!ids.has(e.id)),...v1.entities];migrated.groups.push(...v1.groups);
const custom=newEntity('PIPE_RED',3,3);custom.groupId=FIRE_GROUP;migrated.entities.push(custom);
const oldCool=migrated.entities.find(e=>e.id===fireId('cool-1-valve'))!;oldCool.facility!.open=true;
const oldMix=migrated.entities.find(e=>e.id===fireId('foam-1-mixer'))!;oldMix.facility!.ratio=2.5;oldMix.facility!.ratioUnspecified=false;
assert.equal(installSocarFireLayout(migrated),true);assert.equal(migrated.entities.filter(e=>e.id===fireId('water-header')).length,1);
assert.equal(migrated.entities.find(e=>e.id===oldCool.id)?.facility?.open,true);assert.equal(migrated.entities.find(e=>e.id===oldMix.id)?.facility?.ratio,2.5);
assert.deepEqual(migrated.entities.find(e=>e.id===custom.id),custom,'Unrelated designer work survives migration');
const after=JSON.stringify(migrated);assert.equal(installSocarFireLayout(migrated),false);assert.equal(JSON.stringify(migrated),after);
assert.equal(validateScene(migrated).entities.find(e=>e.id===fireId('water-header'))?.facility?.referenceRevision,FIRE_LAYOUT_REVISION);
const svg=fireDiagram(scene.entities);assert.ok(svg.includes('MAL KABUL')&&svg.includes('DOLUM ADASI')&&!svg.includes('DOLUM / MAL KABUL'));assert.ok(svg.includes('Kesikli çizgi')&&svg.includes('DEPO YANI'));
console.log(`PASS: photo valve order, separate roofs, short foam pickup, ${samples} pipe-clearance samples, Nathan navigation, independent monitor drums, real v1 migration and diagram labels`);




// October 27 photo corrections: no invented gate valve, separate A/B and accessible foam controls.
assert.equal(get('main-2'),undefined);
assert.equal(get('gate-fire-connection').facility?.connectionHeads,2);
assert.equal(get('header-fire-connection').facility?.connectionHeads,1);
assert.equal(get('hose-1').facility?.supplyId,get('main-west').id);
assert.equal(map.get(MONITOR_IDS[3])?.facility?.supplyId,get('monitor-4-valve').id);
assert.equal(get('monitor-4-valve').facility?.supplyId,get('main-west').id);
const start=frame.world(5,0,-36.2);assert.equal(nav.blocked(start),false);
for(const key of ['foam-1-outlet-valve','foam-2-outlet-valve','foam-isolation']){
 const e=get(key);let reachable=false;
 for(let r=.45;r<=.951&&!reachable;r+=.1)for(let j=0;j<32&&!reachable;j++){
  const angle=j*Math.PI/16,p:Point3=[e.position[0]+r*Math.cos(angle),0,e.position[2]+r*Math.sin(angle)];
  reachable=!nav.blocked(p)&&!!nav.path(start,p);
 }
 assert.ok(reachable,`${key}: Nathan can approach from the office-side aisle within 95 cm`);
}
for(const k of [1,2]){assert.equal(get(`foam-${k}-inspection`).preset,'FOAM_INSPECTION_ACCESS');const cool=get(`cool-${k}-outlet`),points=cool.facility!.pipePath!.map(p=>frame.local(localToWorld(cool,p)));const ring=points.slice(cool.facility!.ringStartIndex);assert.ok(Math.hypot(...ring[0].map((v,i)=>v-ring.at(-1)![i]))<1e-8,'Closed cooling ring');}
console.log('PASS: unvalved double-head gate fitting, A/B topology, closed rings, inspection access and reachable foam valves');

// Centreline clearance through the manifold and fence approach: independent circuits never merge.
const keys=['foam-1-outlet','foam-2-outlet','cool-1-outlet','cool-2-outlet','loading-outlet','receiving-outlet','main-west'];const paths=keys.map(k=>{const e=map.get(fireId(k))!;return(k==='main-west'?e.facility!.pipePath!.map(p=>localToWorld(e,p)):referenceConnectionPoints(map.get(e.facility!.supplyId!)!,e)).map(p=>new T.Vector3(...frame.local(p)));});
for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){let min=Infinity,where='';for(let a=1;a<paths[i].length;a++){const p=paths[i][a-1],q=paths[i][a];if(p.z>-20||q.z>-20)continue;const n=Math.ceil(p.distanceTo(q)/.04);for(let t=0;t<=n;t++){const v=p.clone().lerp(q,t/n);for(let b=1;b<paths[j].length;b++){const c=paths[j][b-1],d=paths[j][b];if(c.z>-20||d.z>-20)continue;const w=new T.Line3(c,d).closestPointToPoint(v,true,new T.Vector3()),dist=v.distanceTo(w);if(dist<min){min=dist;where=v.toArray().join(',');}}}}assert.ok(min>.105,`Independent runs overlap: ${keys[i]} / ${keys[j]} at ${where}`);}
