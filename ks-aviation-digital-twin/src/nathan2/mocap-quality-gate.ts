/**
 * Safety/quality release gate for *external* Nathan stair captures.
 * These are QA results for OUR retarget implementation, not a judgement
 * about a motion-capture performer's age, health or physical condition.
 *
 * On 2026-11-02 the unmodified Nathan bind pose was 0.32 degrees off world
 * vertical, but CMU83 on the same skinned rig was 91.95 degrees average
 * and 95.79 degrees maximum. The mapping is not acceptable.
 *
 * Gate remains closed until a CORRECT retarget passes the posture test,
 * real sole/rail contact checks and an actual visual movement review.
 */
export type ExternalStairCapture='cmu83'|'cmu113';
export const STAIR_CAPTURE_QA:Readonly<Record<ExternalStairCapture,{
  postureMeanDegrees:number|null;
  postureMaxDegrees:number|null;
  posturePassed:boolean;
  visuallyAccepted:boolean;
  reason:string;
}>>={
 cmu83:{postureMeanDegrees:91.95,postureMaxDegrees:95.79,posturePassed:false,visuallyAccepted:false,
  reason:'Nathan skinned torso lies almost horizontal with current CMU83 retarget'},
 cmu113:{postureMeanDegrees:null,postureMaxDegrees:null,posturePassed:false,visuallyAccepted:false,
  reason:'Neutral upright rig posture and appearance have not been verified'}
};
export function approvedExternalStairCapture(which:ExternalStairCapture):boolean{
 const q=STAIR_CAPTURE_QA[which];
 return q.posturePassed && q.visuallyAccepted;
}
