/**
 * KS AVIATION / Nathan motion contract v1
 *
 * Scene geometry and the operator controller own world-space position.
 * The animation clip is visual-only. IK then corrects the planted soles
 * and equipment/handrail contact. UI selection never owns a movement task.
 *
 * Original implementation based on the KS 3D scene coordinate convention:
 *   heading=0 means forward -Z, heading=90 means forward +X;
 *   Three.js local +X (right hand side) in world is [cos(h), -sin(h)].
 */
export type MotionTask =
  | 'idle' | 'ground-walk' | 'ground-run' | 'turn-in-place'
  | 'spiral-stair-up' | 'spiral-stair-down'
  | 'rear-ladder-up' | 'rear-ladder-down'
  | 'vehicle-steps-up' | 'vehicle-steps-down'
  | 'enter-cab' | 'exit-cab' | 'driving'
  | 'ball-valve-open' | 'ball-valve-close'
  | 'door-open' | 'door-close' | 'water-monitor-hold';

export type ContactRule = 'ground'|'step-and-outer-rail'|'rungs-and-two-hands'|
  'vehicle-steps-and-rails'|'driver-handholds'|'steering-wheel'|'lever'|'door-handle'|'monitor-handles'|'none';

export type MotionContract = Readonly<{
  preferredClip: string;
  fallbackClip?: string;
  nominalSpeed: number;
  reverseClip?: boolean;
  contact: ContactRule;
  authoritativeRoot: 'route'|'access'|'vehicle'|'stationary';
  notes: string;
}>;

/** A mapping, NOT a promise that every operation already has a complete IK implementation. */
export const NATHAN_MOTION_CONTRACTS: Readonly<Record<MotionTask,MotionContract>> = {
  idle: { preferredClip:'Idle',nominalSpeed:0,contact:'ground',authoritativeRoot:'stationary',notes:'Keep planted soles and idle posture.' },
  'ground-walk': { preferredClip:'Nathan_Original_Walk',nominalSpeed:1.15,contact:'ground',authoritativeRoot:'route',notes:'Face travel tangent; root controlled by collision-checked path.' },
  'ground-run': { preferredClip:'Running',nominalSpeed:2.3,contact:'ground',authoritativeRoot:'route',notes:'Only on open ground; not on tank/vehicle stairs.' },
  'turn-in-place': { preferredClip:'Idle',fallbackClip:'Walking_Turn_180',nominalSpeed:0,contact:'ground',authoritativeRoot:'stationary',notes:'Turn body without stepping backward along the path.' },
  'spiral-stair-up': { preferredClip:'Nathan_Original_Walk',nominalSpeed:.52,contact:'step-and-outer-rail',authoritativeRoot:'access',notes:'Stance foot fixed to actual tread; other hand swings naturally.' },
  'spiral-stair-down': { preferredClip:'Nathan_Original_Walk',fallbackClip:'Descending_Stairs',nominalSpeed:.48,contact:'step-and-outer-rail',authoritativeRoot:'access',notes:'Walk facing downstairs; do NOT reverse the body/root direction.' },
  'rear-ladder-up': { preferredClip:'Climbing_Ladder',nominalSpeed:.34,contact:'rungs-and-two-hands',authoritativeRoot:'access',notes:'Three points of contact, real rung positions.' },
  'rear-ladder-down': { preferredClip:'Climbing_Ladder',reverseClip:true,nominalSpeed:.31,contact:'rungs-and-two-hands',authoritativeRoot:'access',notes:'Face ladder and use real rung grips, no ground teleport.' },
  'vehicle-steps-up': { preferredClip:'Nathan_Original_Walk',fallbackClip:'Running_Up_Stairs',nominalSpeed:.43,contact:'vehicle-steps-and-rails',authoritativeRoot:'access',notes:'Normal-speed step ascent with physical handholds.' },
  'vehicle-steps-down': { preferredClip:'Nathan_Original_Walk',fallbackClip:'Descending_Stairs',nominalSpeed:.39,contact:'vehicle-steps-and-rails',authoritativeRoot:'access',notes:'Normal-speed descent facing travel direction.' },
  'enter-cab': { preferredClip:'Climbing',nominalSpeed:.28,contact:'driver-handholds',authoritativeRoot:'vehicle',notes:'Handrails + steps + door clearance, then seat.' },
  'exit-cab': { preferredClip:'Climbing',reverseClip:true,nominalSpeed:.26,contact:'driver-handholds',authoritativeRoot:'vehicle',notes:'Leave seat, pivot toward steps, maintain support.' },
  driving: { preferredClip:'Driving',nominalSpeed:0,contact:'steering-wheel',authoritativeRoot:'vehicle',notes:'Hands must follow moving steering wheel.' },
  'ball-valve-open': { preferredClip:'Pulling_Lever',nominalSpeed:0,contact:'lever',authoritativeRoot:'stationary',notes:'Reach, grip actual lever, turn 90 degrees into pipeline alignment, release.' },
  'ball-valve-close': { preferredClip:'Pulling_Lever',nominalSpeed:0,contact:'lever',authoritativeRoot:'stationary',notes:'Reach, grip lever, turn 90 degrees perpendicular to pipeline, release.' },
  'door-open': { preferredClip:'Opening',nominalSpeed:0,contact:'door-handle',authoritativeRoot:'stationary',notes:'The IK goal travels with the door hinge while hand grips.' },
  'door-close': { preferredClip:'Opening',nominalSpeed:0,contact:'door-handle',authoritativeRoot:'stationary',notes:'Keep hand on closing handle until latch, then release.' },
  'water-monitor-hold': { preferredClip:'Idle',nominalSpeed:0,contact:'monitor-handles',authoritativeRoot:'stationary',notes:'Use actual two-grip monitor geometry; mouse aiming changes nozzle, not mission.' }
};

export type Vec3 = readonly [number,number,number];
export type HandSide = 0|1; // 0=LEFT, 1=RIGHT
const rad=(deg:number)=>deg*Math.PI/180;

/** Which of Nathan's hands is on the tank-OUTSIDE, accounting for heading. */
export function outsideRailHand(tankCentre:Vec3,operatorWorld:Vec3,headingDegrees:number,previous?:HandSide):HandSide {
  const x=operatorWorld[0]-tankCentre[0],z=operatorWorld[2]-tankCentre[2];
  const len=Math.hypot(x,z);
  if(len<1e-6)return previous??0;
  const heading=rad(headingDegrees);
  const dot=(Math.cos(heading)*x-Math.sin(heading)*z)/len;
  // When Nathan pivots on a tread, keep the current grip near the
  // perpendicular boundary rather than rapidly swapping hands.
  if(Math.abs(dot)<.12&&previous!==undefined)return previous;
  return dot>=0?1:0;
}

/** Normalized step phase from path arc-length in the chosen travel direction. */
export function stairStepPhase(progress:number,pathLength:number,stride:number,descending:boolean) {
  const length=Math.max(1e-4,pathLength),stepLength=Math.max(.1,stride);
  const travelled=(descending?1-Math.max(0,Math.min(1,progress)):Math.max(0,Math.min(1,progress)))*length;
  const index=Math.min(Math.floor(travelled/stepLength),Math.ceil(length/stepLength)-1);
  const phase=Math.max(0,Math.min(1,(travelled-index*stepLength)/stepLength));
  return {travelled,index,phase,stanceLeg:(index%2) as HandSide,swingLeg:(1-index%2) as HandSide};
}

/** Turn a ball-valve lever relative to the pipe: aligned=open; crosswise=closed. */
export function ballValveLeverRadians(open:boolean):number {
  return open?0:Math.PI/2;
}
