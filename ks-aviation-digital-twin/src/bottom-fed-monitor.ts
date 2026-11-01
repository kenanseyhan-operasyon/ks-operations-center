import * as T from 'three';
import {Builder} from './facility-geometry';
import {makePipeTube} from './pipe-geometry';
/** Lower vertical flange, looped body and black hand wheel from the user's photo.
 * Dimensions are visual fitting values; the saved entity transform is retained. */
export function bottomFedMonitor(b:Builder,color:string){
 b.flange([0,.9,0],color,'y',.22);b.cyl(.105,.36,[0,1.08,0],color);b.cyl(.14,.12,[0,1.28,0],color);
 makePipeTube(b,[[0,1.28,0],[-.32,1.28,0],[-.4,1.55,0],[-.25,1.75,.06],[0,1.7,.25]],.105,color,-1000,.18);
 b.flange([0,1.74,.39],'#aebbbe','z',.12);
 const wheel=new T.Group();wheel.position.set(.04,1.72,-.12);wheel.rotation.x=-.8;
 b.mesh(new T.TorusGeometry(.25,.028,8,32),[0,0,0],'#252c2c',wheel);b.rod([-.24,0,0],[.24,0,0],.021,'#252c2c',wheel);b.rod([0,-.24,0],[0,.24,0],.021,'#252c2c',wheel);b.rod([.19,.13,0],[.19,.13,.16],.027,'#252c2c',wheel);b.g.add(wheel);
 b.rod([0,1.7,.35],[.04,1.63,.35],.02,'#b9a357');
 b.rod([.11,1.25,0],[.28,1.25,0],.025,'#aebbbe');const side=b.mesh(new T.TorusGeometry(.10,.016,6,20),[.29,1.25,0],color);side.rotation.y=Math.PI/2;
}
