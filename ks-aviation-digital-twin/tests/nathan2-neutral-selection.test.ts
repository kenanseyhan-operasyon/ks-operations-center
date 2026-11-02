import assert from 'node:assert/strict';
import {chosenStairClip,chosenStairCycleSeconds,CMU83_ASCENT_CLIP,CMU113_ASCENT_CLIP,CMU113_DESCENT_CLIP} from '../src/nathan2/motion-selection';

const fallback='Nathan_Original_Walk',normal=1.18;
assert.equal(chosenStairClip('cmu83','spiral-up',fallback),CMU83_ASCENT_CLIP);
assert.equal(chosenStairClip('cmu83','spiral-down',fallback),fallback,
  'CMU 113 must NEVER play automatically for the 83 default when descending');
assert.equal(chosenStairClip('cmu83','ground',fallback),fallback);
assert.equal(chosenStairClip('original','spiral-down',fallback),fallback);
assert.equal(chosenStairClip('original','spiral-up',fallback),fallback);
assert.equal(chosenStairClip('cmu','spiral-up',fallback),CMU113_ASCENT_CLIP,
  'Explicit opt-in comparison may use the CMU 113 ascent');
assert.equal(chosenStairClip('cmu','spiral-down',fallback),CMU113_DESCENT_CLIP,
  'Explicit opt-in comparison may use the CMU 113 descent');
assert.equal(chosenStairCycleSeconds('cmu83','spiral-up',normal,2.4,2.17,1.73),1.2);
assert.equal(chosenStairCycleSeconds('cmu83','spiral-down',normal,2.4,2.17,1.73),normal,
  'Automatic descent must not inherit 113 stride timing');
assert.equal(chosenStairCycleSeconds('original','spiral-up',normal,2.4,2.17,1.73),normal);
assert.equal(chosenStairCycleSeconds('cmu','spiral-down',normal,2.4,2.17,1.73),1.73/2);
for(const source of ['cmu83','original'] as const)
 for(const mode of ['spiral-up','spiral-down'] as const){
  const chosen=chosenStairClip(source,mode,fallback);
  assert.ok(!chosen.includes('113_19'),source+' '+mode+' cannot silently start 113 performer');
 }
console.log('PASS Nathan 2.0 CMU 83 normal stair ascent, neutral default and CMU 113 opt-in only');
