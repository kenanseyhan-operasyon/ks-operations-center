import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import * as T from 'three';
import {validateScene,newEntity,type Entity} from '../src/scene-data';
import {FIRE_GROUP,FIRE_REFERENCE,FIRE_CIRCUITS,fireId,installSocarFireLayout,referenceConnectionPoints,fireFrame} from '../src/socar-fire-layout';
import {FacilityNetwork} from '../src/facility-network';
import {makeFacilityObject,makeNetworkConnections} from '../src/facility-model';
import {portPosition,localToWorld,worldToLocal,validateFacility,isOutlet} from '../src/facility-data';
import {fireDiagram} from '../src/socar-fire-diagram';

const original=validateScene(JSON.parse(readFileSync('docs/backups/adb-before-fire-lines-revision-6.json','utf8')).payload),scene=structuredClone(original);
assert.equal(scene.entities.length,187,'Use the read-only current published scene, not an obsolete seed');
assert.equal(installSocarFireLayout(scene),true);const first=JSON.stringify(scene);assert.equal(installSocarFireLayout(scene),false);assert.equal(JSON.stringify(scene),first,'Designer edits are not regenerated on reload');
assert.equal(scene.groups.filter(g=>g.id===FIRE_GROUP).length,1);
const map=new Map(scene.entities.map(e=>[e.id,e]));assert.equal(map.size,scene.entities.length);
for(const before of original.entities){const after=map.get(before.id)!;assert.ok(after);assert.deepEqual({...after,facility:undefined},{...before,facility:undefined},`Retain all existing geometry and identity: ${before.id}`);if(!before.id.startsWith('mtfgd')&&before.preset!=='FIRE_MONITOR')assert.deepEqual(after.facility,before.facility,'Unrelated settings preserved');}
const clean=validateScene(scene);for(const e of scene.entities.filter(e=>e.facility?.reference===FIRE_REFERENCE))assert.deepEqual(clean.entities.find(n=>n.id===e.id)?.facility,e.facility,'Save/export/import retains routes and reference metadata');
const canopy=scene.entities.find(e=>e.id==='mtfhc483jg7zz9')!;
for(const key of ['loading','receiving']){const canopy=key==='loading'?scene.entities.find(e=>e.id==='mtfhc483jg7zz9')!:map.get(fireId('receiving-roof'))!;const outlet=map.get(fireId(key+'-outlet'))!;for(const p of outlet.facility!.pipePath!){const q=worldToLocal(canopy,localToWorld(outlet,p));assert.ok(Math.abs(q[0])<canopy.width/2&&Math.abs(q[2])<canopy.length/2,'Sprinklers remain under the rotated canopy roof');assert.ok(q[1]<canopy.height&&q[1]>canopy.height-(key==='receiving'?1.6:.6));}}
const ref=scene.entities.filter(e=>e.facility?.reference===FIRE_REFERENCE);assert.ok(ref.length<70);
for(const e of ref)for(const id of [e.facility?.supplyId,e.facility?.concentrateId])if(id)assert.ok(map.has(id),`No orphan connection ${id}`);
const entity=(id:string)=>{const e=map.get(id)||map.get(fireId(id));assert.ok(e,id);return e;};
const network=new FacilityNetwork();network.start(scene.entities);
assert.ok([...network.states.values()].every(s=>s.reason!=='cycle'));
for(const c of FIRE_CIRCUITS)assert.equal(network.states.get(entity(c.outlet).id)?.flowing,['loading','receiving'].includes(c.key),'Photo starting state: loading/receiving lever valves parallel/open');
const operate=(id:string)=>network.operate(entity(id),scene.entities),state=(id:string)=>network.states.get(entity(id).id)!;
for(const c of FIRE_CIRCUITS.slice(0,6))if(!network.open.get(entity(c.control).id))operate(c.control);
assert.equal(state('foam-1-outlet').fluid,'water','Concentrate isolation remains closed');
operate('foam-isolation');
for(const id of ['foam-1-outlet','foam-2-outlet']){assert.equal(state(id).fluid,'solution');assert.equal(state(id).ratio,0,'No fabricated concentration');assert.ok(state(id).flowing);}
for(const id of ['cool-1-outlet','cool-2-outlet','loading-outlet','receiving-outlet']){assert.equal(state(id).fluid,'water','Water branches must never inherit concentrate');assert.ok(state(id).flowing);}
operate('foam-1-concentrate-valve');assert.equal(state('foam-1-outlet').fluid,'water');assert.equal(state('foam-2-outlet').fluid,'solution');operate('foam-1-concentrate-valve');
operate('foam-1-inlet');assert.equal(state('foam-1-outlet').flowing,false);assert.ok(state('foam-2-outlet').flowing,'Foam circuits are independent');operate('foam-1-inlet');
operate('loading-valve');assert.equal(state('loading-outlet').flowing,false);assert.ok(state('receiving-outlet').flowing,'Gantry zones are independent');operate('loading-valve');
for(const c of FIRE_CIRCUITS.slice(6))operate(c.outlet);
assert.ok(FIRE_CIRCUITS.slice(6).every(c=>state(c.outlet).flowing));
operate('source-2');assert.ok(state(FIRE_CIRCUITS[6].outlet).flowing);assert.ok(state(FIRE_CIRCUITS[7].outlet).flowing);for(const c of [...FIRE_CIRCUITS.slice(0,6),...FIRE_CIRCUITS.slice(8)])assert.equal(state(c.outlet).flowing,false,'Source isolation follows the documented split');operate('source-2');
operate('main-1');assert.equal(state(FIRE_CIRCUITS[6].outlet).flowing,false);assert.ok(state('cool-1-outlet').flowing);operate('main-1');
operate('cool-1-valve');assert.equal(state('cool-1-outlet').flowing,false);assert.ok(state('cool-2-outlet').flowing);operate('cool-1-valve');
const levels=JSON.stringify([...network.levels]);network.tick(90,scene.entities);assert.equal(JSON.stringify([...network.levels]),levels,'No invented hydraulic consumption');
network.stop();assert.equal(JSON.stringify(scene),first,'Exercises never mutate the saved design');
const water=newEntity('WATER_SOURCE',0,0),foam=newEntity('FOAM_DRUM',0,0),mixer=newEntity('FOAM_EDUCTOR',0,0),out=newEntity('FIRE_MONITOR',0,0);mixer.facility={supplyId:water.id,concentrateId:foam.id,ratio:3};out.facility={supplyId:mixer.id,open:true};network.start([water,foam,mixer,out]);assert.equal(network.states.get(out.id)?.ratio,3,'Existing generic assemblies keep their configured ratio');
let vertices=0,meshes=0;const root=new T.Group();
for(const e of ref){const g=makeFacilityObject(e);assert.ok(g,e.name);g.position.fromArray(e.position);g.rotation.y=-e.heading*Math.PI/180;root.add(g);}
root.add(makeNetworkConnections(scene.entities));root.updateMatrixWorld(true);
root.traverse(o=>{if(!(o instanceof T.Mesh))return;meshes++;const p=o.geometry.getAttribute('position');vertices+=p.count;for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)),o.name);});
// Includes two independently operable concentrate valves and two receiving luminaires.
// Current fire-line revision adds three legitimate fittings; cap still guards runaway geometry.
assert.ok(meshes<230,`Batched pipework: ${meshes}`);
assert.ok(vertices<200000,`Bounded pipe/nozzle geometry: ${vertices}`);
for(const e of ref)for(const key of ['supplyId','concentrateId'] as const){const source=map.get(e.facility?.[key]||'');if(!source)continue;const pts=referenceConnectionPoints(source,e,key);assert.ok(new T.Vector3(...pts.at(-1)!).distanceTo(new T.Vector3(...portPosition(e,key==='supplyId'?'in':'foam')))<1e-6,'Connection terminates at the equipment port');for(let i=1;i<pts.length;i++)assert.ok(new T.Vector3(...pts[i]).distanceTo(new T.Vector3(...pts[i-1]))>1e-5,'No zero-length fitting');}
assert.ok(validateFacility({pipePath:[[NaN,0,0]]})?.pipePath===undefined);assert.ok(validateFacility({pipePath:Array.from({length:257},()=>[0,0,0])})?.pipePath===undefined);
const other=structuredClone(original);other.entities=other.entities.filter(e=>e.kind!=='tank');assert.equal(installSocarFireLayout(other),false,'Do not install into an unrelated facility');
const edited=structuredClone(scene);edited.entities=edited.entities.filter(e=>e.id!==fireId('loading-valve'));assert.equal(installSocarFireLayout(edited),false,'Do not resurrect a deliberately deleted component');
const svg=fireDiagram(scene.entities);assert.ok(svg.includes('TANK 1')&&svg.includes('DHMİ-2')&&svg.includes('data-circuit="receiving"'));assert.ok(!/NaN|undefined/.test(svg));
if(process.env.EXPORT_FIRE_REFERENCE==='1'){mkdirSync('public/reference',{recursive:true});writeFileSync('public/reference/socar-adb-fire-lines.svg',svg);mkdirSync('node_modules/.cache',{recursive:true});writeFileSync('node_modules/.cache/fire-scene.json',JSON.stringify(scene));}
console.log(`PASS: current 187 objects preserved; ${ref.length} reference objects; 10 independent branches, source isolation, foam/water separation, save roundtrip, ${meshes} meshes / ${vertices} vertices`);

