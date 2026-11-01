import assert from 'node:assert/strict';
const damp=(dt,rate=9)=>1-Math.exp(-Math.max(0,Math.min(dt,.1))*rate);
assert.equal(damp(0),0);
assert.ok(damp(1/30)>damp(1/60));
assert.ok(damp(1/60)>0&&damp(1/60)<1);
const afterOneSecond=(fps)=>{let x=0;for(let i=0;i<fps;i++)x+=(1-x)*damp(1/fps);return x;};
assert.ok(Math.abs(afterOneSecond(30)-afterOneSecond(60))<1e-10);
assert.ok(Math.abs(afterOneSecond(60)-afterOneSecond(144))<1e-10);
console.log('Gemini camera damping math: PASS (0, 30/60/144 FPS)');
