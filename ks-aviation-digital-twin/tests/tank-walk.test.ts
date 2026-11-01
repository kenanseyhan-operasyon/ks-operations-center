import assert from 'node:assert/strict';
import {newEntity} from '../src/scene-data';
import {updateFacilityAttachments} from '../src/facility-data';
import {makeNathanAccess} from '../src/nathan-access';
import {NathanNavigation} from '../src/nathan-navigation';
import {tankRoofPoint} from '../src/nathan-roof';
import {tankStairLayout} from '../src/tank-stairs';
for(const clockwise of [true,false]){
 const a=newEntity('TANK',-7,0),b=newEntity('TANK',7,0),bridge=newEntity('TANK_BRIDGE',0,0);
 a.facility={clockwise,stairStart:90-(clockwise?270:-270),stairSweep:270};b.facility={clockwise,stairStart:-90-(clockwise?270:-270),stairSweep:270};
 bridge.facility={tankA:a.id,tankB:b.id};const entities=[a,b,bridge];updateFacilityAttachments(entities);
 for(const tank of [a,b])assert.ok(makeNathanAccess(tank,undefined,'tank',new NathanNavigation(entities)),`Linked bridge must not reject tank stairs: ${clockwise} ${tank.position[0]}`);
 const layout=tankStairLayout(a),roof=tankRoofPoint(a);assert.ok(Math.abs(roof[0]-(a.position[0]+layout.exit[0]))<.06,'Default roof target follows the actual stair exit');
}
console.log('PASS Nathan accepts the current tank stair / bridge junctions and actual exit.');

const tank=newEntity('TANK',0,0),bridge=newEntity('TANK_BRIDGE',0,0);tank.facility={stairStart:-180,stairSweep:270};bridge.facility={bridgeStart:{parentId:tank.id,point:[tank.radius-.6,11.28,0]},bridgeEnd:{point:[tank.radius+8,11.28,0]}};updateFacilityAttachments([tank,bridge]);
const layout=tankStairLayout(tank),at=layout.path.at(-3)!,blocker=newEntity('BUILDING',at[0],at[2]);blocker.position[1]=at[1];blocker.width=1;blocker.length=1;blocker.height=2;
assert.equal(makeNathanAccess(tank,undefined,'tank',new NathanNavigation([tank,bridge,blocker])),undefined,'A real obstruction on the stair landing still stops Nathan');
const nav=new NathanNavigation([tank,bridge]);assert.equal(nav.clearAccess([tank.radius+.57,10,0],[tank.radius+.57,10.1,0],tank.id,'tank'),false,'A bridge overhead remains an obstacle below deck height');
