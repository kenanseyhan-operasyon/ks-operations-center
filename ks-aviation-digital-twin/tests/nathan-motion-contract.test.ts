import assert from 'node:assert/strict';
import {NATHAN_MOTION_CONTRACTS,outsideRailHand,stairStepPhase,ballValveLeverRadians,type MotionTask} from '../src/nathan-motion-contract';
import {newEntity} from '../src/scene-data';
import {tankStairLayout} from '../src/tank-stairs';
import {localToWorld,worldToLocal} from '../src/facility-data';
import {sampleAccess,type NathanAccess} from '../src/nathan-access';
import {tankStairContact} from '../src/nathan-tank-contact';

const clipSet=new Set([
  'Climbing','Climbing_Ladder','Climbing_To_Top','Crouch_To_Stand','Driving','Idle',
  'Jumping_Down','Kneeling_Down','Nathan_Original_Walk','Opening','Opening_1',
  'Pulling_Lever','Running','Running_Up_Stairs','Shaking_Hands_2','Walking_Turn_180',
  'Descending_Stairs'
]);
const allTasks=Object.keys(NATHAN_MOTION_CONTRACTS) as MotionTask[];
assert.equal(allTasks.length,18,'Contract enumerates all 18 movement and equipment action families');
for(const task of allTasks){
  const spec=NATHAN_MOTION_CONTRACTS[task];
  assert.ok(clipSet.has(spec.preferredClip),'Uninstalled preferred clip for '+task);
  assert.ok(spec.fallbackClip===undefined||clipSet.has(spec.fallbackClip),'Uninstalled fallback clip for '+task);
  assert.ok(Number.isFinite(spec.nominalSpeed));
}
assert.equal(NATHAN_MOTION_CONTRACTS['spiral-stair-up'].preferredClip,'Nathan_Original_Walk');
assert.equal(NATHAN_MOTION_CONTRACTS['spiral-stair-down'].preferredClip,'Nathan_Original_Walk');
assert.equal(NATHAN_MOTION_CONTRACTS['rear-ladder-down'].reverseClip,true);
assert.equal(NATHAN_MOTION_CONTRACTS['ball-valve-open'].contact,'lever');
assert.equal(NATHAN_MOTION_CONTRACTS['water-monitor-hold'].contact,'monitor-handles');
assert.equal(ballValveLeverRadians(true),0);
assert.equal(ballValveLeverRadians(false),Math.PI/2);

const centre:[number,number,number]=[15,0,-18];
for(const angle of [0,15,45,90,165,220,315])for(const heading of [0,33,90,145,220,280]){
  const rad=angle*Math.PI/180,h=heading*Math.PI/180,radius=7.3;
  const world:[number,number,number]=[centre[0]+radius*Math.sin(rad),4,centre[2]+radius*Math.cos(rad)];
  const right=(world[0]-centre[0])*Math.cos(h)-(world[2]-centre[2])*Math.sin(h);
  if(Math.abs(right)<.001)continue;
  const expect=right>0?1:0;
  assert.equal(outsideRailHand(centre,world,heading),expect,'Right hand must be on actual OUTER rail');
  assert.equal(outsideRailHand(centre,world,heading+180),1-expect,'Reversing walking direction must switch to the newly outer hand');
}
assert.equal(outsideRailHand(centre,centre,90,1),1,'Pivot near tank centre may keep previous hold');
for(const down of [false,true]){
  let last=-1;
  for(let i=0;i<=100;i++){
    const progress=down?1-i/100:i/100;
    const gait=stairStepPhase(progress,14.85,.34,down);
    assert.ok(gait.travelled>=last,'Forward and reverse traversal each advance monotonically');
    assert.equal(gait.stanceLeg===gait.swingLeg,false,'Never use the same foot for swing and stance');
    assert.ok(gait.phase>=0&&gait.phase<=1);
    last=gait.travelled;
  }
}
// Check the actual source geometry, with both spiral directions, rotated tanks
// and their own local coordinate systems. No guessing based on a fixed axis.
for(const clockwise of [false,true])for(const yaw of [0,37,-125])for(const descending of [false,true]){
  const tank=newEntity('TANK',15,-18);
  tank.heading=yaw;tank.scale=1.2;
  tank.facility={...tank.facility,stairs:true,clockwise,stairStart:65,stairSweep:540,stairWidth:.96};
  const layout=tankStairLayout(tank),points=layout.path.map(p=>localToWorld(tank,p));
  const length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1],p[2]-points[i][2]),0);
  const access:NathanAccess={kind:'tank',targetId:tank.id,points,length,crest:.96,heading:0};
  let checked=0,active=0;
  for(let i=12;i<88;i+=2){
    const progress=i/100,at=sampleAccess(access,progress);
    const q=sampleAccess(access,Math.max(0,Math.min(1,progress+(descending?-.003:.003))));
    const heading=Math.atan2(q[0]-at[0],-(q[2]-at[2]))*180/Math.PI;
    const pose=tankStairContact(tank,access,progress,heading,descending);
    if(!pose)continue;checked++;
    const side=outsideRailHand(tank.position,at,heading);
    assert.equal(pose.handGrips?.[side]?.length,1,'Outside hand must have actual exterior rail segment');
    assert.equal(pose.handGrips?.[1-side]?.length,0,'Tank-facing hand must remain free');
    assert.ok((pose.handWeight??0)>0,'No invisible hand contact in mid flight');
    const contact=pose.handGrips![side][0];
    for(const p of contact){
      const local=worldToLocal(tank,p),dist=Math.hypot(local[0],local[2]);
      const trueOuter=layout.radius+layout.width/2+.025;
      assert.ok(Math.abs(dist-trueOuter)<.0001,'Hand goal must lie on OUTER rail, not tank side');
    }
    for(const f of pose.feet){
      assert.ok(f.every(Number.isFinite),'No NaN in foot IK target');
      assert.ok(f[1]>tank.position[1]+layout.base*tank.scale-.3,'No foot teleport to terrain Y=0');
    }
    active+=(pose.handGrips?.[0].length??0)+(pose.handGrips?.[1].length??0);
  }
  assert.ok(checked>=10,'Enough hand/foot samples on actual spiral treads');
  assert.equal(active,checked,'One outside handhold on each sampled tread');
}
console.log('PASS KS Nathan motion contracts, clockwise/anticlockwise rotation, one OUTSIDE hand, correct descent-side, planted soles and valve convention');
