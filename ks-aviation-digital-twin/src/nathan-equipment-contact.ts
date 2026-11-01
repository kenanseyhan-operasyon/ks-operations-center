import * as T from 'three';
import type {Entity} from './scene-data';
import type {V3} from './personnel-navigation';
import type {NathanContact} from './nathan-contact';
import {standingContact} from './nathan-contact';

const vec=(p:T.Vector3)=>p.toArray() as V3;
const smooth=(x:number)=>{const t=T.MathUtils.clamp(x,0,1);return t*t*(3-2*t);};

/**
 * Physical operator reach for the equipment that Nathan actually operates.
 * A generic "Opening" clip alone is not a hand on a valve or door.
 * Return no fabricated grip if its named, moving handle has not loaded.
 */
export function equipmentGripPose(person:Entity,personRoot:T.Object3D,equipment:Entity,equipmentRoot:T.Object3D|undefined,weight=1):NathanContact|undefined{
  if(!equipmentRoot)return;
  equipmentRoot.updateWorldMatrix(true,true);
  let rail:[V3,V3]|undefined,radius=.026;
  const handle=equipmentRoot.getObjectByName('FACILITY_VALVE_HANDLE');
  const door=equipmentRoot.getObjectByName('FACILITY_DOOR');
  if(handle){
    // The handle group is the exact pivot used to animate open/closed valves.
    rail=[vec(handle.localToWorld(new T.Vector3(0,0,.12))),vec(handle.localToWorld(new T.Vector3(0,0,.27)))];
    radius=.025;
  }else if(equipment.preset==='PEDESTRIAN_GATE'&&door){
    // Red push bar is modelled on the moving leaf, not the fixed gate frame.
    rail=[vec(door.localToWorld(new T.Vector3(equipment.width*.76,1,.07))),
          vec(door.localToWorld(new T.Vector3(equipment.width*.89,1,.07)))];
    radius=.028;
  }else return;
  const midpoint=new T.Vector3(...rail[0]).lerp(new T.Vector3(...rail[1]),.5);
  const angle=person.heading*Math.PI/180;
  const right=new T.Vector3(Math.cos(angle),0,Math.sin(angle));
  const fromPerson=midpoint.clone().sub(new T.Vector3(...person.position));
  const side=right.dot(fromPerson)>0?1:0;
  const hands:[V3|undefined,V3|undefined]=[undefined,undefined];
  const lines:[[V3,V3][],[V3,V3][]]=[[],[]];
  hands[side]=vec(midpoint);
  lines[side]=[rail];
  const tangent=vec(new T.Vector3(...rail[1]).sub(new T.Vector3(...rail[0])).normalize());
  const amount=smooth(weight);
  return {...standingContact(personRoot),hands,handGrips:lines,grips:[rail],
    handTangents:[tangent,tangent],handWeight:amount,
    freeHands:true,gripHands:true,procedural:true,disableClimbFallback:true,
    gripRadius:radius,hipHeight:.89,lean:.08,elbowPole:[0,-1,0]};
}
