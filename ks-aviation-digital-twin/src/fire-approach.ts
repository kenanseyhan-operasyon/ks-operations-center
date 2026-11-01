import type * as T from 'three';
import type {Entity} from './scene-data';
import {localToWorld} from './facility-data';
import type {V3} from './personnel-navigation';
import type {NathanNavigation} from './nathan-navigation';
import {planNathanRoute} from './nathan-route';
/** Equipment elevation is not the operator's walking elevation. */
export function fireApproachPoints(o:Entity):V3[]{
 const offsets=o.preset==='FIRE_MONITOR'?[-1,-1.3,-1.6,-1.9,-2.2,-2.4].flatMap(z=>[0,-.6,.6,-1,1].map(x=>[x,0,z])):[.75,1,1.2].flatMap(d=>Array.from({length:16},(_,i)=>[Math.sin(i*Math.PI/8)*d/o.scale,0,Math.cos(i*Math.PI/8)*d/o.scale]));
 return offsets.map(p=>{const q=localToWorld(o,p as V3);return [q[0],0,q[2]];});
}
export function planFireApproach(start:V3,o:Entity,nav:NathanNavigation,entities:Entity[],object:(id:string)=>T.Object3D|undefined){
 const candidates=fireApproachPoints(o).filter(p=>!nav.blocked(p)).sort((a,b)=>Math.hypot(a[0]-start[0],a[2]-start[2])-Math.hypot(b[0]-start[0],b[2]-start[2]));
 for(const point of candidates){const legs=planNathanRoute(start,point,nav,entities,object);if(legs)return {point,legs};}
}
