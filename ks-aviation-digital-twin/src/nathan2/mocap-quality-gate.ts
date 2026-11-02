/**
 * Safety/quality release gate for *external* Nathan stair captures.
 * These are QA results for OUR retarget implementation, not a judgement
 * about a motion-capture performer's age, health or physical condition.
 *
 * Scope: the isolated laboratory, CMU83 ascent plus native Nathan descent.
 * Evidence and limits: docs/NATHAN2_UPRIGHT_REVIEW_20261102.md.
 * Posture, loop, physical contacts and visual review must all pass. Approval
 * of one recording never implicitly enables another recording.
 */
export type ExternalStairCapture='cmu83'|'cmu113';
export const STAIR_CAPTURE_QA:Readonly<Record<ExternalStairCapture,{
  postureMeanDegrees:number|null;
  postureMaxDegrees:number|null;
  posturePassed:boolean;
  loopPassed:boolean;
  contactsPassed:boolean;
  visuallyAccepted:boolean;
  reason:string;
}>>={
 cmu83:{postureMeanDegrees:14.607,postureMaxDegrees:17.929,posturePassed:true,loopPassed:true,contactsPassed:true,visuallyAccepted:true,
  reason:'Accepted for the isolated lab: corrected bind axes and loop, full-route contact checks, and actual-model CPU visual review; browser GPU review remains outstanding'},
 cmu113:{postureMeanDegrees:6.078,postureMaxDegrees:8.727,posturePassed:true,loopPassed:true,contactsPassed:false,visuallyAccepted:false,
  reason:'Retarget posture corrected, but this optional capture is not accepted for the laboratory route'}
};
export function approvedExternalStairCapture(which:ExternalStairCapture):boolean{
 const q=STAIR_CAPTURE_QA[which];
 return q.posturePassed && q.loopPassed && q.contactsPassed && q.visuallyAccepted;
}
