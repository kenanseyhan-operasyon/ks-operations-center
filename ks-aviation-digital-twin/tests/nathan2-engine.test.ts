import assert from 'node:assert/strict';
import * as T from 'three';
import {newEntity} from '../src/scene-data';
import {Nathan2Motor} from '../src/nathan2/engine';
import {outsideRailHand} from '../src/nathan-motion-contract';
import {worldToLocal} from '../src/facility-data';

/** Use actual Three.js mesh raycasts as an independent surface oracle.
 * These dimensions are the visible meshes in the lab entry point. Checking
 * a target against itself cannot detect shoes floating above a tread.
 */
function visibleSupports(motor:Nathan2Motor){
 const {layout}=motor.stairs,group=new T.Group(),tank=motor.tank;
 group.position.fromArray(tank.position);group.rotation.y=-T.MathUtils.degToRad(tank.heading);group.scale.setScalar(tank.scale);
 const box=(width:number,depth:number,top:number,x:number,z:number,yaw:number)=>{
  const mesh=new T.Mesh(new T.BoxGeometry(width,.08,depth));
  mesh.position.set(x,top-.04,z);mesh.rotation.y=yaw;group.add(mesh);
 };
 for(const piece of layout.pieces)if(!piece.roofLanding){
  const a=(piece.a+piece.b)/2;
  box(layout.width,Math.max(.13,Math.abs(piece.b-piece.a)*layout.radius+.04),piece.y1,
   Math.sin(a)*layout.radius,Math.cos(a)*layout.radius,a+Math.PI/2);
 }
 const [entry,first]=layout.path;
 box(layout.width,new T.Vector3(...entry).distanceTo(new T.Vector3(...first))+.08,entry[1],
  (entry[0]+first[0])/2,(entry[2]+first[2])/2,Math.atan2(first[0]-entry[0],first[2]-entry[2]));
 const landing=layout.roofLanding,r=(landing.inner+landing.outer)/2;
 box(landing.outer-landing.inner,landing.depth,landing.height,Math.sin(landing.angle)*r,Math.cos(landing.angle)*r,landing.angle+Math.PI/2);
 const roof=new T.Mesh(new T.CylinderGeometry(tank.radius-.08,tank.radius-.08,.10,72));
 roof.position.y=layout.height-.05;group.add(roof);
 box(150,150,0,0,0,0);
 group.updateMatrixWorld(true);
 const ray=new T.Raycaster();
 return (foot:readonly number[])=>{
  ray.set(new T.Vector3(foot[0],foot[1]+.35*tank.scale,foot[2]),new T.Vector3(0,-1,0));ray.far=.8*tank.scale;
  const hit=ray.intersectObject(group,true)[0];
  assert.ok(hit,'A planted foot must have a real visible surface below it: '+JSON.stringify(foot));
  const clearance=foot[1]-hit.point.y;
  assert.ok(Math.abs(clearance-.007*tank.scale)<.0001,
   'Planted foot must be 7 mm above actual tread, not above the sloped route: '+JSON.stringify({foot,clearance,surface:hit.point.y}));
 };
}

function runScenario(clockwise:boolean,rotation:number,speed:1|2|4){
 const tank=newEntity('TANK',7,-2);
 tank.heading=rotation;
 tank.facility={...tank.facility,stairs:true,clockwise,stairStart:-100,stairSweep:535,stairWidth:1.02,stairLandings:true};
 const motor=new Nathan2Motor(tank);
 let previousRailDirection:T.Vector3|undefined;
 for(const [a,b] of motor.stairs.railSegments){
  const localA=worldToLocal(tank,a),localB=worldToLocal(tank,b);
  const delta=Math.atan2(localB[0],localB[2])-Math.atan2(localA[0],localA[2]);
  const signed=Math.atan2(Math.sin(delta),Math.cos(delta))*motor.stairs.layout.sign;
  assert.ok(signed>=-1e-7,'Physical rail cannot backtrack at a duplicated Catmull-Rom knot');
  const direction=new T.Vector3(...b).sub(new T.Vector3(...a)).normalize();
  if(previousRailDirection)assert.ok(previousRailDirection.angleTo(direction)<Math.PI/3,
   'A landing must not rotate the rail axis (and gripping wrist) by 143-180 degrees in one segment');
  previousRailDirection=direction;
 }
 const checkSurface=visibleSupports(motor);
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
    const hands=(pose.contact.handGrips||[[],[]]).filter(grips=>grips.length>0).length;
    if(pose.outsideHand!==undefined){
     assert.equal(hands,1,'Only tank-OUTSIDE hand must hold the connected rail');
     assert.equal(pose.outsideHand,outsideRailHand(tank.position,pose.position,pose.heading));
     assert.ok(pose.contact.handGrips?.[pose.outsideHand!].length,'Wrong gripping hand selected');
     handFrames++;
    }else assert.equal(hands,0,'No fictional grip before the physical rail is reachable');
    assert.ok(pose.contact.feet.flat().every(Number.isFinite),'IK contacts must be finite');
    const planted=pose.plantedFoot===undefined?undefined:pose.contact.feet[pose.plantedFoot];
    if(planted){
     assert.ok(planted[1]>-0.1,'Never put planted sole below facility ground');
     if(oldFoot!==pose.plantedFoot){checkSurface(planted);if(oldFoot!==undefined)feetSwitched++;}
    }
    oldFoot=pose.plantedFoot;
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
    if(pose.outsideHand!==undefined){
     descGrip++;
     assert.ok(pose.contact.handGrips?.[pose.outsideHand].length,'Outside hand holds on descent');
     assert.equal(pose.contact.handGrips?.[1-pose.outsideHand].length,0,'Only outside hand holds on descent');
    }
    if(pose.plantedFoot!==undefined&&oldFoot!==pose.plantedFoot){checkSurface(pose.contact.feet[pose.plantedFoot]);if(oldFoot!==undefined)downSwitches++;}
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
// DUR is a frozen pose, not an Idle transition that drops all stair contacts.
a.distance=a.stairs.total*.42;a.heading=a.stairs.headingAt(a.distance,1);a.activity='spiral-up';
const moving=a.tick(0);assert.ok(moving.contact);
a.stop();
for(let i=0;i<20;i++){
 const stopped=a.tick(.05);
 assert.equal(stopped.paused,true);assert.deepEqual(stopped.position,moving.position);assert.equal(stopped.heading,moving.heading);
 assert.deepEqual(stopped.contact,moving.contact,'Pause preserves both soles and outer hand');
 assert.equal(stopped.motion,moving.motion,'Pause does not select a new clip or reset its phase');
}
a.up();assert.equal(a.tick(.016).paused,false,'Up resumes the paused motor');
a.stop();a.reset();const reset=a.tick(0);assert.equal(reset.paused,false);assert.ok(reset.contact);assert.equal(reset.outsideHand,undefined);assert.equal(reset.progress,0);
for(const foot of reset.contact.feet)checkResetSurface(foot);
function checkResetSurface(foot:readonly number[]){assert.ok(Math.abs(foot[1]-.007)<1e-9,'Reset plants both feet on real ground');}
console.log('PASS Nathan2 independent gait motor: no running stairs, outside hand, alternating soles, no teleport, 1/4x speeds, clockwise, rotated tanks, descent');
