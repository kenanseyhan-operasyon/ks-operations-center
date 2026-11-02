import type {NathanActor} from '../nathan-model';
import type {MotorPose} from './engine';
import {CMU_CLIP_CYCLE,CMU_83_UP_NAME,CMU_UP_NAME,CMU_DOWN_NAME} from './cmu-mocap';

export type LabMotionSource='original'|'cmu83'|'cmu';
export function labMotionForPose(pose:MotorPose,distance:number,stairEntryDistance:number,
 selected:LabMotionSource,available:{cmu83:boolean;cmu:boolean}):string{
 // The first part of the route is a level approach. It must use walking,
 // even though the whole task is called spiral-up in the motor state.
 if(distance<stairEntryDistance)return pose.motion;
 if(pose.activity==='spiral-up'){
  if(selected==='cmu83'&&available.cmu83)return CMU_83_UP_NAME;
  if(selected==='cmu'&&available.cmu)return CMU_UP_NAME;
 }
 if(pose.activity==='spiral-down'&&selected==='cmu'&&available.cmu)return CMU_DOWN_NAME;
 return pose.motion;
}

/** The path clock and the animation clock share one left/right stride.
 * The mixer still advances transitions and IK, but cannot add a second time
 * increment to the selected, distance-sampled locomotion action.
 * Shared by the actual lab and its real-skeleton acceptance test.
 */
export function applyLabAnimation(actor:NathanActor,pose:MotorPose,clip:string,
 distance:number,totalDistance:number,tankScale:number,simulationDt:number){
 if(pose.paused)return;
 const moving=pose.activity==='spiral-up'||pose.activity==='spiral-down';
 actor.motion(clip,moving?pose.motionRate:1);
 if(moving){
  const action=actor.actions[actor.index],duration=actor.clips[actor.index].duration;
  const source=CMU_CLIP_CYCLE[clip];
  const cycles=source?.cycleCount??1,startPhase=source?.startPhase??0;
  const travelled=pose.activity==='spiral-down'?totalDistance-distance:distance;
  const pairPhase=travelled/(2*.34*tankScale);
  const phase=((pairPhase-startPhase)%cycles+cycles)%cycles;
  action.time=phase/cycles*duration;
  action.setEffectiveTimeScale(0);
 }
 actor.contact(pose.contact);
 actor.update(simulationDt);
}
