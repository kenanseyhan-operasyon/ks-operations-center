import assert from 'node:assert/strict';
import {STAIR_CAPTURE_QA,approvedExternalStairCapture} from '../src/nathan2/mocap-quality-gate';

assert.equal(approvedExternalStairCapture('cmu83'),false,'Reject CMU83 until corrected rig posture and visual review');
assert.equal(approvedExternalStairCapture('cmu113'),false,'CMU113 is not an approved or implicit default');
assert.ok(STAIR_CAPTURE_QA.cmu83.postureMeanDegrees!>85,'The observed near-horizontal torso must remain recorded as regression evidence');
assert.equal(STAIR_CAPTURE_QA.cmu83.visuallyAccepted,false);
assert.ok(Object.values(STAIR_CAPTURE_QA).every(q=>!q.posturePassed||!q.visuallyAccepted));
console.log('PASS Nathan2 external MoCap failed-closed: CMU83 92-degree torso rejected, CMU113 excluded until QA');
