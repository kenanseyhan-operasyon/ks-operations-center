import assert from 'node:assert/strict';
import {STAIR_CAPTURE_QA,approvedExternalStairCapture} from '../src/nathan2/mocap-quality-gate';

assert.equal(approvedExternalStairCapture('cmu83'),true,'Corrected CMU83 is accepted for isolated lab evaluation');
assert.equal(approvedExternalStairCapture('cmu113'),false,'CMU113 is not an approved or implicit default');
assert.ok(STAIR_CAPTURE_QA.cmu83.postureMeanDegrees!<20,'Corrected posture must stay within the reviewed upright range');
assert.ok(STAIR_CAPTURE_QA.cmu83.postureMaxDegrees!<25,'Maximum corrected torso tilt stays within the posture gate');
assert.ok(['posturePassed','loopPassed','contactsPassed','visuallyAccepted'].every(key=>STAIR_CAPTURE_QA.cmu83[key as keyof typeof STAIR_CAPTURE_QA.cmu83]===true));
assert.equal(STAIR_CAPTURE_QA.cmu113.posturePassed,true,'Posture alone does not approve another capture');
assert.equal(STAIR_CAPTURE_QA.cmu113.contactsPassed,false);
assert.equal(STAIR_CAPTURE_QA.cmu113.visuallyAccepted,false);
console.log('PASS Nathan2 external MoCap gate: reviewed CMU83 enabled only in the lab; CMU113 excluded despite corrected posture');
