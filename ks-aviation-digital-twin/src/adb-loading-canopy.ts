import * as T from 'three';
import {Builder,type V} from './facility-geometry';
import type {Entity} from './scene-data';
import {socarFasciaSign} from './socar-fascia-sign';
export const isAdbLoadingCanopy=(o:Entity)=>o.preset==='ADB_LOADING_ISLAND'||o.id==='mtfhc483jg7zz9'&&o.preset==='CANOPY';
/** P08–10/13–14: narrow island, paired central columns, broad cantilever roof.
 * Existing user transform/dimensions stay authoritative; small details are fitted. */
export function makeAdbLoadingCanopy(o:Entity){
 const b=new Builder();b.g.userData.entityId=o.id;const W=o.width,L=o.length,H=o.height,iw=W*.36,il=L*.9;
 const white='#e3e4dc',dark='#080a0b',yellow='#e4be32';
 b.box(iw,.17,il,[0,.085,0],'#bfc2b9');
 for(const x of [-iw/2,iw/2])for(let z=-il/2;z<il/2;z+=.55){const len=Math.min(.55,il/2-z);b.box(.1,.18,len,[x,.09,z+len/2],Math.round((z+il/2)/.55)%2?white:yellow);}
 for(const z of [-il/2,il/2])for(let x=-iw/2;x<iw/2;x+=.55){const len=Math.min(.55,iw/2-x);b.box(len,.18,.1,[x+len/2,.09,z],Math.round((x+iw/2)/.55)%2?white:yellow);}
 for(const z of [-L*.34,L*.34]){
  for(const x of [-.23,.23]){b.box(.19,H,.2,[x,H/2,z],white);b.box(.32,.035,.34,[x,.19,z],'#abb5b6');}
  b.box(W-.2,.17,.14,[0,H-.12,z],white);
  for(const x of [-iw*.43,iw*.43]){
   const pts:V[]=[[x,.2,z-.28],[x,.72,z-.28],[x,.72,z+.28],[x,.2,z+.28]];b.tube(pts,.04,'#202c30');b.rod([x,.72,z-.16],[x,.72,z+.16],.042,yellow);
  }
 }
 b.box(W,.12,L,[0,H+.04,0],white);
 for(let z=-L/2;z<=L/2;z+=.16)b.box(W,.018,.022,[0,H-.03,z],'#c7cbc6');
 for(const z of [-L/2,L/2])b.box(W,.46,.12,[0,H+.12,z],dark);
 for(const x of [-W/2,W/2])b.box(.12,.46,L,[x,H+.12,0],dark);
 // Compact fixtures use the existing emissive night switch; no additional shadow passes.
 for(const z of [-L*.32,0,L*.32])for(const x of [-W*.29,W*.29]){
  b.cyl(.13,.065,[x,H-.09,z],'#556164');b.glow(b.cyl(.105,.012,[x,H-.13,z],'#fff1cf'),3);
 }
 for(const z of [-L*.27,L*.27]){const light=new T.SpotLight('#fff1d5',0,12,1.05,.7,2);light.position.set(0,H-.22,z);light.target.position.set(0,0,z);light.userData.nightIntensity=90;light.castShadow=false;b.g.add(light,light.target);}
 // Four raised signs: tall coloured emblem above the fascia, white wordmark.
 for(const [x,z,angle,span] of [[0,L/2+.075,0,W],[0,-L/2-.075,Math.PI,W],[W/2+.075,0,Math.PI/2,L],[-W/2-.075,0,-Math.PI/2,L]]){
  const sign=socarFasciaSign(b,Math.min(span*.8,3.2));sign.position.set(x,H+.12,z);sign.rotation.y=angle;b.g.add(sign);
 }
 b.g.name='ADB · SOCAR dolum adası';return b.finish();
}
