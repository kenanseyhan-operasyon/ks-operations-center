import assert from 'node:assert/strict';
import * as T from 'three';
import {newEntity} from '../src/scene-data';
import {Nathan2Motor} from '../src/nathan2/engine';
import {outsideRailHand} from '../src/nathan-motion-contract';

function runScenario(clockwise:boolean,rotation:number,speed:1|2|4){
 const tank=newEntity('TANK',7,-2);
 tank.heading=rotation;
 tank.facility={...tank.facility,stairs:true,clockwise,stairStart:-100,stairSweep:535,stairWidth:1.02,stairLandings:true};
 const motor=new Nathan2Motor(tank);
 motor.setSpeed(speed);
 const whole=motor.stairs.total;
 assert.ok(whole>tank.height+3,'True curved route is longer than simple tank height');
 const start=motor.tick(.016);
 assert.equal(start.motion,'Idle');assert.equal(start.speed,speed);
 motor.up();
 let maxJump=0,handFrames=0,shoeFrames=0,feetSwitched=0,oldFoot:number|undefined;
 let prior=start.position,lastY=start.position[1],phase=0,ascendingSteps=0;
 for(let i=0;i<22000;i++){
  const pose=motor.tick(.035);
  const jump=new T.Vector3(...pose.position).distanceTo(new T.Vector3(...prior));
  maxJump=Math.max(maxJump,jump);
  assert.ok(jump<.22,'No visible root teleport or step jump: '+jump);
  assert.ok(pose.position[1]>=lastY-.021,'Ascent must not drop Nathan to ground on a raised tread');
  assert.notEqual(pose.motion,'Running' as string,'Spiral stairs are ALWAYS walking, even in 4x test');
  lastY=pose.position[1];prior=pose.position;
  if(pose.activity==='spiral-up'){
   phase++;
   if(pose.contact){
    shoeFrames++;
    const total=(pose.contact.handGrips?.[0].length??0)+(pose.contact.handGrips?.[1].length??0);
    assert.equal(total,1,'Only tank-OUTSIDE hand must hold a rail');
    assert.equal(pose.outsideHand,outsideRailHand(tank.position,pose.position,pose.heading));
    assert.equal(pose.contact.handGrips?.[pose.outsideHand!].length,1,'Wrong gripping hand selected');
    const planted=pose.contact.feet[pose.plantedFoot!];
    const other=pose.contact.feet[1-pose.plantedFoot!];
    assert.ok(planted.every(Number.isFinite)&&other.every(Number.isFinite),'IK contacts must be finite');
    assert.ok(planted[1]>-0.1,'Never put planted sole below facility ground');
    if(oldFoot!==undefined&&oldFoot!==pose.plantedFoot)feetSwitched++;
    oldFoot=pose.plantedFoot;
    handFrames++;
   }
  }
  if(pose.activity==='roof'){ascendingSteps=i;break;}
 }
 assert.ok(ascendingSteps>0,'Tank roof reached without timeout');
 assert.ok(phase>40&&handFrames>30&&shoeFrames>30,'Walking really uses step contacts, not only a clip');
 assert.ok(feetSwitched>6,'Stance feet alternate through the ascent');
 assert.ok(Math.abs(motor.distance-whole)<1e-7);
 const roofPos=motor.position;
 assert.ok(roofPos[1]>tank.height-.1,'Nathan is actually on tank roof');
 motor.down();
 let downFrames=0,descGrip=0,downSwitches=0;oldFoot=undefined;
 for(let i=0;i<22000;i++){
  const pose=motor.tick(.035);
  assert.notEqual(pose.motion,'Running' as string,'Descent cannot trigger running');
  const delta=new T.Vector3(...pose.position).distanceTo(new T.Vector3(...prior));
  assert.ok(delta<.22,'No teleport during descent: '+delta);
  prior=pose.position;
  if(pose.activity==='spiral-down'){
   downFrames++;
   if(pose.contact){
    descGrip++;
    assert.equal(pose.contact.handGrips?.[pose.outsideHand!].length,1,'Outside hand holds on descent');
    if(oldFoot!==undefined&&oldFoot!==pose.plantedFoot)downSwitches++;
    oldFoot=pose.plantedFoot;
   }
  }
  if(pose.activity==='ground')break;
 }
 assert.ok(downFrames>40&&descGrip>25&&downSwitches>6,'Descending footsteps really alternate');
 assert.ok(motor.distance<1e-7,'Nathan returned to exact ground endpoint');
 assert.ok(new T.Vector3(...motor.position).distanceTo(new T.Vector3(...start.position))<1e-7);
 console.log(`PASS Nathan2 ${clockwise?'clockwise':'counter-clockwise'} yaw=${rotation} speed=${speed}x step-grip=${handFrames} reverse-grip=${descGrip} maxRootJump=${maxJump.toFixed(3)}m`);
}
for(const clockwise of [true,false])for(const yaw of [0,45,-125])for(const speed of [1,4] as const)runScenario(clockwise,yaw,speed);

// 1x and 4x are the SAME walking clip. 4x is faster simulation time, not running.
const tank=newEntity('TANK',0,0);
tank.facility={...tank.facility,stairs:true,stairStart:-100,stairSweep:535};
const a=new Nathan2Motor(tank),b=new Nathan2Motor(tank);
a.setSpeed(1);b.setSpeed(4);a.up();b.up();
for(let i=0;i<50;i++){a.tick(.025);b.tick(.025);}
assert.ok(b.distance>a.distance*2,'Test speed changes route advancement (including turn-in-place)');
assert.ok(a.tick(.016).motion==='Nathan_Original_Walk');
assert.ok(b.tick(.016).motion==='Nathan_Original_Walk');
// One left-right stride pair covers exactly 2*0.34 metres. Never use a
// guessed FBX source walking speed to time the cyclic leg movement.
const calibrated=.49*.9/(2*.34*tank.scale);
assert.ok(Math.abs(a.tick(.016).motionRate-calibrated)<1e-9);
assert.ok(Math.abs(b.tick(.016).motionRate-calibrated)<1e-9,'4x test speed scales route and clip together, not gait type');
a.setWalkCycleSeconds(1.12);
assert.ok(Math.abs(a.tick(.016).motionRate-(.49*1.12/(2*.34*tank.scale)))<1e-9,'Runtime walks use real GLB clip duration');
console.log('PASS Nathan2 independent gait motor: no running stairs, outside hand, alternating soles, no teleport, 1/4x speeds, clockwise, rotated tanks, descent');
