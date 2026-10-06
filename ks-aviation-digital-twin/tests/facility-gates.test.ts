import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FacilityGates,gateSegments,gateIntersects,vehicleFootprint,setGateOpening} from '../src/facility-gates';
import {newEntity,validateScene} from '../src/scene-data';
import {makeObject,disposeObject} from '../src/objects';

const gate=newEntity('MAIN_GATE',0,0);Object.assign(gate,{id:'gate',preset:'MAIN_GATE',wallStyle:'gate',points:[[-6,0],[6,0]],height:2});
const truck=newEntity('R14',0,8);truck.id='truck';const scene=[gate,truck],gates=new FacilityGates(),running=new Set([truck.id]);
const object=makeObject(gate);const objects=(id:string)=>id===gate.id?object:undefined;
assert.equal(gates.waiting(truck,{x:0,z:8,heading:0},2,false,scene)?.id,gate.id);
gates.update(.1,scene,running,objects);assert.ok(gates.amount('gate')>0&&gates.amount('gate')<1);
for(let i=0;i<30;i++)gates.update(.1,scene,running,objects);
assert.equal(gates.amount('gate'),1);assert.equal(gates.waiting(truck,{x:0,z:8,heading:0},2,false,scene),undefined);
const leaves:THREE.Object3D[]=[];object.traverse(n=>{if(n.name==='FACILITY_GATE_LEAF')leaves.push(n);});assert.equal(leaves.length,2);
object.updateMatrixWorld(true);for(const leaf of leaves){const box=new THREE.Box3().setFromObject(leaf);assert.ok(box.max.x< -6||box.min.x>6,'Fully open leaves leave the complete doorway clear');}
// Tractor has passed, but the angled trailer is still within the gate opening.
truck.position[2]=-3;truck.trailerAngle=.35;running.clear();assert.ok(gateIntersects(vehicleFootprint(truck),...gateSegments(gate)[0]));
for(let i=0;i<100;i++)gates.update(.1,scene,running,objects);assert.equal(gates.amount(gate.id),1,'Stationary trailer prevents closure, even with its engine off');
truck.position[2]=-40;for(let i=0;i<35;i++)gates.update(.1,scene,running,objects);assert.equal(gates.amount(gate.id),1,'Hold after clearing');
for(let i=0;i<40;i++)gates.update(.1,scene,running,objects);assert.equal(gates.amount(gate.id),0);
// The same automatic gate supports entering from the other side and reversing.
truck.heading=180;truck.position[2]=-8;truck.trailerAngle=0;running.add(truck.id);assert.equal(gates.waiting(truck,{x:0,z:-8,heading:Math.PI},2,false,scene)?.id,gate.id);
for(let i=0;i<30;i++)gates.update(.1,scene,running,objects);assert.equal(gates.amount(gate.id),1);
const reverse=new FacilityGates();assert.equal(reverse.waiting(truck,{x:0,z:8,heading:Math.PI},-1,true,scene)?.id,gate.id);
assert.equal(reverse.waiting(truck,{x:30,z:8,heading:Math.PI},-1,true,scene),undefined,'Nearby parallel vehicles are not blocked');
gate.gateOpen=true;truck.position[2]=-100;running.clear();for(let i=0;i<100;i++)gates.update(.1,scene,running,objects);assert.equal(gates.amount(gate.id),1,'Manual open stays open');
const saved=validateScene({schema:'KS_DIGITAL_TWIN_V1',airport:'ADB',source:'gate-test',entities:scene,groups:[]});assert.equal(saved.entities[0].gateOpen,true);
gate.heading=90;gate.position=[10,0,20];gate.scale=2;const segments=gateSegments(gate);assert.ok(Math.hypot(segments[0][0][0]-10,segments[0][0][1]-8)<1e-8);assert.ok(Math.hypot(segments[0][1][0]-10,segments[0][1][1]-32)<1e-8);
setGateOpening(object,0);object.updateMatrixWorld(true);assert.ok(leaves.every(l=>Math.abs(l.position.z)===3));disposeObject(object);
console.log('PASS: entry/exit/reversing gate waits, sliding geometry clearance, angled trailer occupancy, hold/close, manual open persistence and transformed gate coordinates.');
