import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {validateScene} from '../src/scene-data';
import {installSocarFireLayout,fireId} from '../src/socar-fire-layout';
import {SocarFirePanel} from '../src/socar-fire-panel';
import {FacilityPanel} from '../src/facility-panel';
import {FacilityNetwork} from '../src/facility-network';

const dom=new JSDOM('<body><main></main></body>',{url:'https://test.invalid'});
for(const name of ['window','document','HTMLElement','HTMLButtonElement','HTMLInputElement','HTMLFormElement','FormData'])Object.defineProperty(globalThis,name,{value:(dom.window as any)[name],configurable:true});
const host=document.querySelector<HTMLElement>('main')!,scene=validateScene(JSON.parse(readFileSync('docs/backups/adb-before-fire-lines-revision-6.json','utf8')).payload);
installSocarFireLayout(scene);const original=JSON.stringify(scene),network=new FacilityNetwork();let focused='',refreshed=0;
const panel=new SocarFirePanel(host,network,{entities:()=>scene.entities,training:on=>{on?network.start(scene.entities):network.stop();},select:id=>{focused=id;},visuals:()=>{refreshed++;}});
const click=(selector:string)=>{const b=panel.element.querySelector<HTMLButtonElement>(selector);assert.ok(b,selector);b.click();};
panel.sync();assert.equal(panel.launcher.hidden,false);panel.launcher.click();assert.equal(panel.element.hidden,false);
assert.equal(panel.element.querySelectorAll('.socar-fire-circuits article').length,10);
assert.equal(panel.element.querySelector<HTMLButtonElement>('[data-operate]')!.disabled,true);
click('[data-training=start]');assert.equal(network.active,true);
assert.equal(network.states.get(fireId('loading-outlet'))?.flowing,true);assert.equal(network.states.get(fireId('receiving-outlet'))?.flowing,true);click(`[data-operate="${fireId('loading-valve')}"]`);assert.equal(network.states.get(fireId('loading-outlet'))?.flowing,false);assert.equal(network.states.get(fireId('receiving-outlet'))?.flowing,true);
click(`[data-operate="${fireId('foam-1-inlet')}"]`);assert.equal(network.states.get(fireId('foam-1-outlet'))?.fluid,'water');
click(`[data-operate="${fireId('foam-isolation')}"]`);assert.equal(network.states.get(fireId('foam-1-outlet'))?.fluid,'solution');
click('.socar-circuit-name[data-circuit=loading]');assert.ok(panel.element.querySelector('.selected [data-circuit=loading]'));
click('[data-training=reset]');assert.equal(network.states.get(fireId('loading-outlet'))?.flowing,true);assert.equal(network.events.length,0);
click('[data-training=stop]');assert.equal(network.active,false);assert.equal(JSON.stringify(scene),original,'UI exercises do not change the design');assert.ok(refreshed>=3);
click(`[data-locate="${fireId('loading-valve')}"]`);assert.equal(focused,fireId('loading-valve'));assert.equal(panel.element.hidden,true);
panel.open();panel.element.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(panel.element.hidden,true);

// Opening/applying unrelated property fields must not invent a 3% setting.
const generic=new FacilityPanel(host,network,{entities:()=>scene.entities,editing:()=>true,edit:()=>true,place:()=>{},select:()=>{},change:fn=>fn(),mount:()=>{},bridge:()=>{},stair:()=>{},points:()=>{},assembly:()=>{},training:()=>{},visuals:()=>{},notify:()=>{}});
const mixer=scene.entities.find(e=>e.id===fireId('foam-1-mixer'))!;generic.selection(mixer);generic.openProperties();
const ratio=generic.element.querySelector<HTMLInputElement>('[name=ratio]')!;assert.equal(ratio.value,'');
generic.element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));assert.equal(mixer.facility?.ratio,undefined);assert.equal(mixer.facility?.ratioUnspecified,true);
generic.openProperties();generic.element.querySelector<HTMLInputElement>('[name=ratio]')!.value='3';generic.element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));assert.equal(mixer.facility?.ratio,3);assert.equal(mixer.facility?.ratioUnspecified,false);
generic.openProperties();generic.element.querySelector<HTMLInputElement>('[name=ratio]')!.value='';generic.element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));assert.equal(mixer.facility?.ratio,undefined);assert.equal(mixer.facility?.ratioUnspecified,true);
console.log('PASS: fire panel launch, isolated valve operation, foam pickup, reset/stop, scene focus, keyboard close, design preservation, and explicit-only ratio editing.');
