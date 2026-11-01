import * as T from 'three';
import {Builder,type V} from './facility-geometry';
import {makePipeTube} from './pipe-geometry';
import type {Entity} from './scene-data';
export const isFuelModule=(o:Entity)=>o.preset.startsWith('FUEL_');
/** Photo-fitted equipment. Dimensions remain editable; these are not manufacturer CAD. */
export function makeFuelModule(o:Entity){
 if(!isFuelModule(o))return;const b=new Builder(),white='#e5e6dc',steel='#aebbbe',dark='#242a2c';b.g.userData.entityId=o.id;
 if(o.preset==='FUEL_PIPE'){makePipeTube(b,o.facility?.pipePath||[[0,.65,-o.length/2],[0,.65,o.length/2]],o.width/2,o.color,0,.14);return b.finish();}
 const flange=(z:number)=>b.flange([0,.65,z],white,'z',.12);
 if(o.preset==='FUEL_PUMP'){
  b.box(.65,.1,1.4,[0,.05,0],steel);for(const z of [-.35,.35])b.box(.42,.13,.18,[0,.16,z],'#28734b');
  const motor=b.cyl(.22,.68,[0,.4,-.23],'#28734b');motor.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){const a=i*Math.PI/6;b.rod([Math.cos(a)*.225,.4+Math.sin(a)*.225,-.52],[Math.cos(a)*.225,.4+Math.sin(a)*.225,.06],.012,'#245f40');}
  b.box(.21,.12,.24,[0,.64,-.2],'#28734b');const pump=b.cyl(.24,.23,[0,.4,.3],'#28734b');pump.rotation.x=Math.PI/2;
  b.tube([[0,.65,-.7],[.27,.65,-.7],[.27,.4,.3],[0,.4,.3],[0,.65,.7]],.05,white);flange(-.7);flange(.7);
 }else if(o.preset==='FUEL_FILTER'){
  for(const x of [-.26,.26])for(const z of [-.3,.3]){b.box(.1,.45,.1,[x,.225,z],white);b.box(.2,.04,.2,[x,.02,z],steel);}
  b.cyl(.36,1.03,[0,.94,0],white);b.ball(.36,[0,1.45,0],white);b.cyl(.4,.07,[0,.43,0],white);b.flange([0,1.5,0],white,'y',.39);
  b.tube([[0,.65,-.675],[0,.65,.675]],.05,white);flange(-.675);flange(.675);
  b.rod([.3,1.25,0],[.49,1.25,0],.018,steel);const gauge=b.cyl(.075,.04,[.49,1.32,0],white);gauge.rotation.x=Math.PI/2;b.rod([.49,1.32,.025],[.52,1.36,.025],.006,dark);
  b.label('JET A-1\nFİLTRE',.4,.23,[0,1,.365]);
 }else if(o.preset==='FUEL_METER'){
  b.box(.5,.07,.65,[0,.035,0],steel);b.box(.09,.85,.09,[0,.45,0],white);b.tube([[0,.65,-.375],[0,.65,.375]],.05,white);flange(-.375);flange(.375);
  b.box(.35,.25,.27,[0,.7,0],white);b.box(.5,.38,.18,[0,1.15,0],white);b.box(.38,.17,.015,[0,1.2,.1],'#203d3d');b.label('000000 L',.34,.12,[0,1.2,.112],'#203d3d','#b8e7c1');
  b.cyl(.045,.04,[-.12,1.03,.12],'#c03129').rotation.x=Math.PI/2;b.cyl(.035,.04,[.12,1.03,.12],'#358049').rotation.x=Math.PI/2;
 }else if(o.preset==='FUEL_HOSE'){
  b.box(.5,.06,.55,[0,.03,0],steel);b.box(.07,1.05,.07,[0,.55,-.22],white);b.rod([-.28,1.06,-.22],[.28,1.06,-.22],.025,steel);
  const pts:V[]=[[0,.65,-.75],[.25,.65,-.56]];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;pts.push([.28*Math.cos(a),.6+.42*Math.sin(a),-.10+i*.006]);}pts.push([-.23,.88,.55],[0,.88,.75]);
  b.mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p))),80,.05,10,false),[0,0,0],dark);
  const cap=b.cyl(.10,.22,[0,.88,.78],'#ae302a');cap.rotation.x=Math.PI/2;b.flange([0,.88,.9],steel,'z',.11);for(const x of [-.15,.15])b.rod([x,.79,.74],[x,.97,.74],.018,steel);
 }
 const g=b.finish();g.scale.set(o.width/({FUEL_PUMP:.65,FUEL_FILTER:.8,FUEL_METER:.55,FUEL_HOSE:.7}[o.preset]||1),o.height/({FUEL_PUMP:.85,FUEL_FILTER:1.8,FUEL_METER:1.4,FUEL_HOSE:1.2}[o.preset]||1),o.length/({FUEL_PUMP:1.4,FUEL_FILTER:1.35,FUEL_METER:.75,FUEL_HOSE:1.5}[o.preset]||1));
 // Preserve model scaling when the scene applies the entity's overall scale.
 const root=new T.Group();root.userData.entityId=o.id;root.add(g);return root;
}
