import assert from 'node:assert/strict';
import * as T from 'three';
import {stairPose} from '../src/nathan-stair-gait';
import {driverLanding} from '../src/nathan-driver';
import {nathanLandingHeight} from '../src/nathan-controller';
import {CAB_REFERENCE,cabUnits} from '../src/cab-reference';
const steps={stops:[[0,0,0],[.2,.28,0],[.4,.56,0]] as [number,number,number][],heading:90,scale:1,outward:[1,0,0] as [number,number,number],ladder:true};
for(const progress of [0,.03,.1,.2,.4,.6,.8,1]){
 const pose=stairPose(steps,progress);
 assert.ok(pose.contact.feet.every((p)=>Number.isFinite(p[1])&&p[1]>=.012-1e-5),'stair soles have positive clearance');
 assert.ok(pose.contact.feet.every(p=>p.every(Number.isFinite)),'valid stair contact');
}
const root=new T.Group();
const seat=new T.Group();seat.name='DRIVER_SEAT';root.add(seat);
const wheel=new T.Group();wheel.name='DRIVER_STEERING_WHEEL';wheel.position.set(.4,1.5,.3);wheel.rotation.x=.18;root.add(wheel);
for(let i=0;i<2;i++){const pedal=new T.Group();pedal.name='DRIVER_PEDAL_TARGET_'+i;root.add(pedal);}
root.updateWorldMatrix(true,true);
const driver=driverLanding(root,0);
assert.ok(driver,'driver anchors present');
// The grasp encloses the tube centreline, 12 mm inside the outer diameter.
const radius=cabUnits(CAB_REFERENCE.steeringDiameter/2-.012);
const center=wheel.getWorldPosition(new T.Vector3());
assert.ok(driver!.hands.every(h=>Math.abs(new T.Vector3(...h).distanceTo(center)-radius)<1e-5),'hands precisely on steering rim');
assert.ok(new T.Vector3(...driver!.hands[0]).distanceTo(new T.Vector3(...driver!.hands[1]))>0,'separate grips');
assert.equal(nathanLandingHeight(.12,0,0,.25),.12,'landing starts without jump');
assert.equal(nathanLandingHeight(.12,0,.25,.25),0,'landing ends at surface');
for(const t of [.04,.1,.15,.2]){
 const y=nathanLandingHeight(.12,0,t,.25);
 assert.ok(y>0&&y<.12,'smooth intermediate landing frame');
}
console.log('PASS Gemini video review: stair clearance, physical wheel grips, time-based landing easing');

