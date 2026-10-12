import * as THREE from 'three';
import {Builder} from './facility-geometry';
import {makeFacilityDetail,makeFootprint,updateShowerVisual} from './facility-detail-models';
import type {Entity} from './scene-data';
import {FACILITY_CATALOG,portPosition,isFoamStore,type TankOpening} from './facility-data';
import type {FacilityNetwork} from './facility-network';
type V=[number,number,number];
const steel='#aebbbe',dark='#354347',red='#bc302a',yellow='#e5d53f';
export function makeTankAccess(o:Entity,openings:TankOpening[]=[]){
  const b=new Builder(),f=o.facility||{},r=o.radius,H=o.height+.27,w=f.stairWidth??.9,R=r+w*.5+.12,paint='#e0e4dd';
  const N=Math.min(180,Math.max(4,Math.ceil(H/.185))),sign=f.clockwise===false?-1:1,start=(f.stairStart??0)*Math.PI/180,sweep=(f.sweep??180)*Math.PI/180*sign;
  const p=(a:number,rad:number,y:number,tangent=0):V=>[Math.sin(a)*rad+Math.cos(a)*tangent,y,Math.cos(a)*rad-Math.sin(a)*tangent];
  const box=(width:number,height:number,depth:number,a:number,rad:number,y:number,tangent=0,color=paint)=>{const m=b.box(width,height,depth,p(a,rad,y,tangent),color);m.rotation.y=a-Math.PI/2;return m;};
  const beam=(a:V,z:V,width=.04,height=.23)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...z),direction=bv.clone().sub(av),length=direction.length();direction.normalize();const right=new THREE.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right);const m=b.box(width,height,length,av.add(bv).multiplyScalar(.5).toArray() as V,paint);m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,direction));};
  const deck=(a:number,inner:number,outer:number,depth:number,y:number,tangent=0)=>{
    const width=outer-inner,mid=(inner+outer)/2,count=Math.max(4,Math.ceil(width/.065));
    for(const side of [-1,1]){box(.035,.13,depth,a,mid+side*width/2,y-.065,tangent);box(width,.1,.04,a,mid,y-.05,tangent+side*depth/2);}
    for(let i=0;i<=count;i++)box(.012,.032,depth,a,inner+width*i/count,y-.008,tangent,steel);
    for(let z=-depth/2;z<=depth/2;z+=.13)box(width,.016,.013,a,mid,y-.019,tangent+z,steel);
  };
  const top=start+sweep,landingDepth=Math.max(1.1,w+.2),inner=r-.32,outer=R+w/2+.1;
  if(f.stairs!==false){
    const run=Math.abs(sweep)*R/N;
    for(let i=0;i<N;i++){
      const a=start+(i+.5)/N*sweep,y=H*(i+1)/N;
      deck(a,R-w/2,R+w/2,run+.018,y);
      for(const side of [-1,1])beam(p(start+i/N*sweep,R+side*(w/2+.025),Math.max(.14,H*i/N-.12)),p(start+(i+1)/N*sweep,R+side*(w/2+.025),Math.max(.14,H*(i+1)/N-.12)));
      if(i>2&&i%6===0){box(.045,.38,.22,a,r+.035,y-.3);beam(p(a,r+.055,y-.14),p(a,R+w/2+.045,y-.14),.075,.1);beam(p(a,r+.055,Math.max(.08,y-.9)),p(a,R+w/2+.045,y-.19),.055,.075);}
    }
    const segments=Math.max(8,Math.ceil(Math.abs(sweep)*R/1.05));
    for(const side of [-1,1])b.rail(Array.from({length:segments+1},(_,i)=>p(start+sweep*i/segments,R+side*(w/2+.025),Math.max(.135,H*i/segments))),paint,1.08);
    // An open lower entry and a horizontal upper landing lead onto the roof.
    deck(start,R-w/2-.03,R+w/2+.03,.8,.135,-sign*.4);
    for(const side of [-1,1])b.rail([p(start,R+side*(w/2+.025),.135,-sign*.8),p(start,R+side*(w/2+.025),.135,0)],paint,1.08);
    deck(top,inner,outer,landingDepth,H);
    b.rail([p(top,outer,H,-landingDepth/2),p(top,outer,H,landingDepth/2)],paint,1.08);
    b.rail([p(top,inner,H,sign*landingDepth/2),p(top,outer,H,sign*landingDepth/2)],paint,1.08);
    b.rail([p(top,inner,H,-sign*landingDepth/2),p(top,r+.09,H,-sign*landingDepth/2)],paint,1.08);
    for(const t of [-landingDepth*.35,landingDepth*.35]){beam(p(top,r,H-.8,t),p(top,outer,H-.12,t),.075,.1);box(.04,.3,.18,top,r+.02,H-.8,t);}
  }
  const tau=Math.PI*2,normalize=(a:number)=>(a%tau+tau)%tau,ringRadius=Math.max(.05,r-.1);
  const gaps=[...openings,...(f.stairs!==false?[{angle:top,halfAngle:Math.asin(Math.min(.95,(landingDepth/2+.08)/ringRadius))}]:[])];
  // Split at the exact opening boundaries, including a gap that crosses angle zero.
  const angles=[...Array.from({length:65},(_,i)=>i/64*tau),...gaps.flatMap(g=>[normalize(g.angle-g.halfAngle),normalize(g.angle+g.halfAngle)])].sort((a,b)=>a-b);
  const blocked=(a:number)=>gaps.some(g=>Math.abs(Math.atan2(Math.sin(a-g.angle),Math.cos(a-g.angle)))<g.halfAngle-1e-7);
  const railGroup=new Builder();
  for(let i=1;i<angles.length;i++){const a=angles[i-1],z=angles[i];if(z-a<1e-7||blocked((a+z)/2))continue;for(const h of [.54,1.08])railGroup.rod(p(a,ringRadius,H+h),p(z,ringRadius,H+h),h===1.08?.024:.017,paint);}
  const postCount=Math.max(12,Math.ceil(tau*ringRadius/1.05)),postAngles=[...Array.from({length:postCount},(_,i)=>i/postCount*tau),...gaps.flatMap(g=>[normalize(g.angle-g.halfAngle),normalize(g.angle+g.halfAngle)])];
  for(const a of postAngles)if(!blocked(a))railGroup.rod(p(a,ringRadius,H),p(a,ringRadius,H+1.08),.024,paint);
  railGroup.g.name='TANK_ROOF_RAILING';b.g.add(railGroup.finish());
  const waterRing=Array.from({length:65},(_,i)=>p(i/64*tau,r+.08,H-.32));b.tube(waterRing,.04,red);
  b.g.name='TANK_CURVED_ACCESS';return b.finish();
}

function drawPath(b:Builder,o:Entity){
  const pts=o.points||[[-o.length/2,0],[o.length/2,0]],f=o.facility||{},id=o.preset;let travelled=0,nextStep=.25,step=0;
  if(id.startsWith('PIPE_')){b.tube(pts.map(p=>[p[0],o.height,p[1]]),o.width/2,o.color);for(const p of [pts[0],pts[pts.length-1]]){b.box(.22,.06,.25,[p[0],.03,p[1]],'#d6dcd8');b.box(.06,Math.max(.05,o.height-.05),.06,[p[0],o.height/2,p[1]],steel);}return;}
  for(let i=1;i<pts.length;i++){const a=pts[i-1],z=pts[i],dx=z[0]-a[0],dz=z[1]-a[1],l=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);if(l<.01)continue;
    const piece=(from:number,len:number,width:number,height:number,color:string,offset=0)=>{const t=(from+len/2)/l,x=a[0]+dx*t+Math.cos(angle)*offset,zz=a[1]+dz*t-Math.sin(angle)*offset,m=b.box(width,height,len,[x,height/2+.022,zz],color);m.rotation.y=angle;if(id==='GROUND_LINE')b.glow(m,.17);};
    if(id==='DRAIN'){piece(0,l,o.width,.035,dark);for(let x=0;x<l;x+=.1)piece(x,Math.min(.027,l-x),o.width,.05,steel);}
    else if(id==='CURB'){for(let x=0;x<l;x+=.6)piece(x,Math.min(.59,l-x),o.width,o.height,Math.floor(x/.6)%2?'#eeeee3':o.color);}
    else if(id==='FOOTPRINTS'||f.pattern==='footprints'){while(nextStep<travelled+l-.13){const x=nextStep-travelled,side=step++%2?1:-1;if(x>.15)makeFootprint(b,a[0]+dx*x/l+Math.cos(angle)*side*.13,a[1]+dz*x/l-Math.sin(angle)*side*.13,angle,side,o.color);nextStep+=.55;}travelled+=l;}
    else if(f.pattern==='dash'){for(let x=0;x<l;x+=1.2)piece(x,Math.min(.65,l-x),f.lineWidth??o.width,.009,o.color);}
    else piece(0,l,f.lineWidth??o.width,.009,o.color);
  }
}
export function makeFacilityObject(o:Entity){
  if(!FACILITY_CATALOG[o.preset])return undefined;const b=new Builder(),W=o.width,L=o.length,H=o.height,c=o.color,p=o.preset,f=o.facility||{};b.g.userData.entityId=o.id;
  const post=(x:number,z:number,h=1,col=c)=>{b.cyl(.1,.08,[x,.04,z],dark);b.glow(b.cyl(.057,h,[x,h/2,z],col),.17);for(const y of [.49,.73,.91])b.glow(b.cyl(.058,h*.09,[x,h*y,z],'#f1f0dc'),.27);};
  const wheel=(x:number,y:number,z:number,r=.16)=>{const w=b.cyl(r,.095,[x,y,z],dark);w.rotation.z=Math.PI/2;};
  const ext=(x=0,z=0,h=.8)=>{b.cyl(h*.145,h*.73,[x,h*.45,z],c);b.ball(h*.14,[x,h*.81,z],c);b.cyl(.028,.13,[x,h*.95,z],steel);b.box(.22,.035,.06,[x+.035,h,z],dark);b.label('YANGIN',h*.24,h*.2,[x,h*.52,z+h*.146]);b.tube([[x+.05,h,z],[x+.2,h*.83,z],[x+.2,h*.28,z]],.018,dark);};
  if(makeFacilityDetail(b,o)){}
  else if(FACILITY_CATALOG[p].draw==='line')drawPath(b,o);
  else if(['WALKWAY','HATCH_AREA'].includes(p)){
    const pts=o.points||[[-W/2,-L/2],[W/2,-L/2],[W/2,L/2],[-W/2,L/2]],shape=new THREE.Shape(pts.map(q=>new THREE.Vector2(q[0],-q[1]))),m=b.mesh(new THREE.ShapeGeometry(shape),[0,.018,0],c);m.rotation.x=-Math.PI/2;m.material=new THREE.MeshStandardMaterial({color:c,side:THREE.DoubleSide,roughness:1,polygonOffset:true,polygonOffsetFactor:-1});
    if(p==='WALKWAY'){b.glow(m,.09);drawPath(b,{...o,preset:'GROUND_LINE',points:[...pts,pts[0]],color:yellow,facility:{lineWidth:f.lineWidth??.1}});}
    else{const material=m.material as THREE.MeshStandardMaterial;if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle=c;ctx.fillRect(0,0,128,128);ctx.strokeStyle='#354347';ctx.lineWidth=35;for(let x=-128;x<256;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+128,128);ctx.stroke();}const tx=new THREE.CanvasTexture(canvas);tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.repeat.set(1,1);tx.colorSpace=THREE.SRGBColorSpace;material.map=tx;}}}
  }
  else if(['GROUND_TEXT','ASSEMBLY_MARK'].includes(p))b.label(f.label||'DUR',W,L,[0,.027,0],p==='ASSEMBLY_MARK'?c:'transparent',f.textColor||'#ffffff',true,undefined,p==='ASSEMBLY_MARK'?'assembly':undefined);
  else if(p==='GROUND_ARROW'){const shape=new THREE.Shape();shape.moveTo(-W*.18,L*.5);shape.lineTo(W*.18,L*.5);shape.lineTo(W*.18,-L*.05);shape.lineTo(W*.5,-L*.05);shape.lineTo(0,-L*.5);shape.lineTo(-W*.5,-L*.05);shape.lineTo(-W*.18,-L*.05);shape.closePath();const m=b.mesh(new THREE.ShapeGeometry(shape),[0,.029,0],c);m.rotation.x=Math.PI/2;m.material.side=THREE.DoubleSide;}
  else if(p==='MONITOR_SHIELD'){const r=W/2,arc=(f.sweep??230)*Math.PI/180,n=Math.ceil(arc*12);for(let i=0;i<n;i++){const a=-arc/2+i*arc/n,z=a+arc/n;b.rod([Math.sin(a)*r,H/2,Math.cos(a)*r],[Math.sin(z)*r,H/2,Math.cos(z)*r],.05,c);const m=b.box(.16,H,r*arc/n+.03,[Math.sin((a+z)/2)*r,H/2,Math.cos((a+z)/2)*r],c);m.rotation.y=(a+z)/2;}}
  else if(p==='FIRE_MONITOR'||p==='HYDRANT_POINT'){
    b.cyl(.25,.12,[0,.06,0],c);b.cyl(.095,.9,[0,.55,0],c);b.flange([0,.18,0],c,'y');b.flange([0,.86,0],c,'y');b.tube([[0,.8,0],[0,1.05,.18],[0,1.15,.4]],.075,c);b.rod([0,1.15,.4],[0,1.48,1.05],.085,steel);b.flange([0,1.12,.43],steel);const ring=b.mesh(new THREE.TorusGeometry(.19,.025,8,24),[.28,.92,.1],c);ring.rotation.y=Math.PI/2;
    b.rod([0,.85,0],[.28,.92,.1],.028,steel);b.tube([[0,.65,-L/2],[0,.65,0]],.065,c);
    const jet=new THREE.Group();jet.name='FACILITY_JET';const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,1.5,1.1),new THREE.Vector3(0,2.8,5),new THREE.Vector3(0,.15,10)]);const stream=new THREE.Mesh(new THREE.TubeGeometry(curve,24,.065,6,false),new THREE.MeshStandardMaterial({color:'#8acbea',transparent:true,opacity:.45,depthWrite:false}));jet.add(stream);jet.visible=false;b.g.add(jet);
  }
  else if(isFoamStore(o)){
    if(p==='FOAM_DRUM'){b.cyl(W/2,H,[0,H/2,0],c);for(const y of [.08,H*.3,H*.7,H-.05])b.cyl(W/2+.012,.025,[0,y,0],c);b.label('KÖPÜK · 200 L',W*.9,H*.36,[0,H*.55,W/2+.01],c,'#ffffff');}
    else{b.box(W,H*.7,L,[0,H*.55,0],c);for(const x of [-W*.4,W*.4])for(const z of [-L*.4,L*.4])b.box(.07,.36,.07,[x,.18,z],steel);b.cyl(.14,.04,[0,H*.92,0],dark);b.label(f.tag||'KPT01',W*.8,.25,[0,H*.67,L/2+.016]);b.label('KÖPÜK TANKI · 1000 L',W*.88,.2,[0,H*.45,L/2+.016]);}
    const gauge=b.box(.035,H*.65,.035,[W*.48,H*.56,L*.51],dark);gauge.name='FOAM_LEVEL_BACK';const level=b.box(.025,H*.62,.039,[W*.48,H*.56,L*.51+.01],'#e4c357');level.name='FACILITY_LEVEL';level.userData.baseY=H*.25;level.userData.fullHeight=H*.62;b.tube([[0,.2,0],[0,.2,L/2]],.035,steel);
  }
  else if(['PIPE_TEE','PIPE_ELBOW','PIPE_VALVE','FOAM_EDUCTOR','PRESSURE_GAUGE','WATER_SOURCE','SPRINKLER','TANK_COOLING'].includes(p)){
    if(p==='PIPE_ELBOW')b.tube([[0,.65,-L/2],[0,.65,0],[W/2,.65,0]],.065,c);else b.tube([[0,.65,-L/2],[0,.65,L/2]],.065,c);
    for(const z of [-L/2,L/2])b.flange([0,.65,z],c);
    if(p==='PIPE_TEE')b.tube([[0,.65,0],[W/2,.65,0]],.065,c);
    if(p==='PIPE_VALVE'){const body=b.cyl(.16,.2,[0,.65,0],c);body.rotation.x=Math.PI/2;b.rod([0,.65,0],[0,.92,0],.035,steel);const handle=new THREE.Group();handle.name='FACILITY_VALVE_HANDLE';handle.position.set(0,.94,0);b.rod([0,0,-.24],[0,0,.24],.028,c,handle);b.g.add(handle);handle.rotation.y=f.open===false?Math.PI/2:0;b.label(f.tag||'FV',.3,.15,[.2,.74,0]);}
    if(p==='FOAM_EDUCTOR'){const body=b.cyl(.13,.45,[0,.65,0],c,.07);body.rotation.x=Math.PI/2;b.tube([[.36,.72,0],[.2,.72,0],[0,.65,0]],.024,steel);b.label(`${f.ratio??3}%`,.28,.14,[0,.8,.03],c,dark);}
    if(p==='PRESSURE_GAUGE'){b.rod([0,.7,0],[0,1.02,0],.02,steel);const gauge=b.cyl(.14,.06,[0,1.1,.01],steel);gauge.rotation.x=Math.PI/2;b.label('0   5   10',.24,.24,[0,1.1,.05]);b.rod([0,1.09,.06],[-.045,1.17,.06],.006,dark);}
    if(p==='WATER_SOURCE'){b.box(.5,.15,.7,[0,.075,0],'#bcc8c4');b.rod([0,.65,0],[0,.2,0],.09,c);b.label('SU / WATER',.5,.2,[0,.9,0]);}
    if(p==='SPRINKLER'||p==='TANK_COOLING'){b.cyl(.12,.025,[0,.45,0],steel);const jet=new THREE.Group();jet.name='FACILITY_JET';for(let i=0;i<8;i++){const a=i*Math.PI/4;const m=b.rod([0,.42,0],[Math.sin(a)*1.2,-.05,Math.cos(a)*1.2],.015,'#8ed1ee',jet);m.material=new THREE.MeshStandardMaterial({color:'#8ed1ee',transparent:true,opacity:.5,depthWrite:false});}jet.visible=false;b.g.add(jet);}
    for(const z of [-L*.3,L*.3]){b.box(.22,.06,.25,[0,.03,z],'#d9dfdb');b.box(.06,.55,.06,[0,.3,z],steel);}
  }
  else if(p==='TANK_BRIDGE'){
    const rise=f.bridgeRise||0,deckLength=Math.hypot(L,rise);b.grate(W,deckLength,0);for(const side of [-1,1])b.rail(Array.from({length:Math.max(2,Math.ceil(deckLength/1.2))+1},(_,i):V=>[side*W/2,0,-deckLength/2+deckLength*i/Math.max(2,Math.ceil(deckLength/1.2))]),steel);b.g.rotation.x=-Math.atan2(rise,L);const wrap=new THREE.Group();wrap.add(b.finish());wrap.userData.entityId=o.id;return wrap;
  }
  else if(p==='CROSSOVER_STAIR'||p==='MOBILE_STAIR'){
    const topLen=p==='MOBILE_STAIR'?.75:1.1,run=(L-topLen)/(p==='MOBILE_STAIR'?1:2),count=Math.max(4,Math.ceil(H/.2));b.grate(W,topLen,H);for(const side of [-1,1]){if(side===1&&p==='MOBILE_STAIR')continue;for(let i=0;i<count;i++){const y=H*(i+1)/count,z=side*(L/2-run*(i+.5)/count);b.grate(W,run/count,y,z,steel);}for(const x of [-W/2,W/2]){b.rod([x,.08,side*L/2],[x,H-.08,side*topLen/2],.06,steel);b.rail([[x,0,side*L/2],[x,H,side*topLen/2]],c);}}
    for(const x of [-W/2,W/2]){b.rail([[x,H,-topLen/2],[x,H,topLen/2]],c);for(const z of [-topLen/2,topLen/2])b.rod([x,0,z],[x,H,z],.045,steel);}
    if(p==='MOBILE_STAIR'){for(const x of [-W/2,W/2])for(const z of [-L/2,L/2])wheel(x,.12,z,.12);b.rail([[-W/2,H,topLen/2],[W/2,H,topLen/2]],c);}
  }
  else if(p==='SURFACE_SIGN'){b.box(W,H,.035,[0,H/2,0],c);b.label(f.label||o.name,W*.96,H*.92,[0,H/2,.023],c,f.textColor||'#ffffff');for(const x of [-W*.44,W*.44])for(const y of [H*.08,H*.92])b.ball(.012,[x,y,.025],steel);}
  else if(p==='FIRE_ALARM'||p==='EMERGENCY_STOP'){
    b.box(W,H,.08,[0,H/2,0],c);if(p==='EMERGENCY_STOP'){const button=b.cyl(.055,.06,[0,H*.55,.06],red);button.rotation.x=Math.PI/2;}else{b.box(W*.7,H*.45,.02,[0,H*.54,.05],'#e9e6df');b.label('PRESS',W*.65,H*.2,[0,H*.52,.064]);}b.label(f.tag||f.label||o.name,W*1.8,.09,[0,H+.08,0]);
  }
  else if(p==='ALARM_BEACON'){b.cyl(W*.46,H*.3,[0,H*.15,0],dark);const lamp=b.cyl(W*.4,H*.6,[0,H*.6,0],c);lamp.name='FACILITY_BEACON';lamp.material=new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.12,transparent:true,opacity:.8});}
  else if(p==='EXTINGUISHER_WALL'||p==='EXTINGUISHER_TROLLEY'){
    ext(0,0,H*.9);if(p==='EXTINGUISHER_TROLLEY'){for(const x of [-W*.42,W*.42]){wheel(x,.2,0,.2);b.tube([[x,.13,-.15],[x,H+.08,-.15],[x,H+.1,.1]],.025,red);}b.box(W,.045,L,[0,.13,0],red);}
  }
  else if(p==='HOSE_CABINET'||p==='WALL_HOSE_CABINET'){
    const bottom=p==='HOSE_CABINET'?.4:0,h=H-bottom;b.box(W,h,.04,[0,bottom+h/2,-L/2],c);for(const x of [-W/2,W/2])b.box(.04,h,L,[x,bottom+h/2,0],c);for(const y of [bottom,H])b.box(W,.045,L,[0,y,0],c);const roof=b.box(W+.12,.035,L+.12,[0,H+.08,0],c);roof.rotation.z=.035;for(const x of [-W*.35,W*.35])b.box(.06,bottom,.06,[x,bottom/2,0],dark);
    for(const x of [-W*.23,W*.23]){const hose=b.mesh(new THREE.TorusGeometry(W*.15,.05,8,24),[x,bottom+h*.56,0],red);hose.rotation.y=.08;}
    b.rod([-W*.2,bottom+.13,.06],[W*.2,bottom+.13,.06],.033,steel);b.label('YANGIN',W*.88,.16,[0,H-.12,L/2+.02],c,'#ffffff');
  }
  else if(p==='BOLLARD')post(0,0,H);
  else if(p==='TRAFFIC_CONE'){b.box(W,.04,W,[0,.02,0],dark);b.cyl(W*.35,H-.04,[0,H/2,0],c,.025);b.cyl(W*.18,.1,[0,H*.55,0],'#f5f1e3',W*.14);}
  else if(p==='CHAIN_POSTS'){for(const z of [-L/2,L/2])post(0,z,H);const pts=Array.from({length:17},(_,i):V=>[0,H*.85-Math.sin(i/16*Math.PI)*.2,-L/2+L*i/16]);for(let i=1;i<pts.length;i++)b.rod(pts[i-1],pts[i],.02,i%2?'#f0eee2':red);}
  else if(p==='IMPACT_BARRIER'){for(const z of [-L/2,L/2])b.cyl(.11,.06,[0,.03,z],dark);b.tube([[0,0,-L/2],[0,H,-L/2],[0,H,L/2],[0,0,L/2]],.065,c);for(let z=-L/2;z<L/2;z+=.45)b.rod([0,H,z],[0,H,Math.min(z+.18,L/2)],.066,dark);}
  else if(p==='MANHOLE'){b.cyl(W/2,H,[0,H/2,0],c);for(const x of [-W*.2,W*.2])b.box(.12,.04,.03,[x,H+.02,0],dark);b.label('KAPALI ALAN',W*.75,W*.3,[0,H+.005,0],c,'#ffffff',true);}
  else if(p==='SPILL_KIT'){b.box(W,H*.8,L,[0,H*.45,0],c);b.box(W*1.06,.07,L*1.05,[0,H*.88,0],dark);for(const x of [-W*.4,W*.4])wheel(x,.1,-L*.35,.1);b.label(f.label||'SPILL KIT',W*.9,.3,[0,H*.55,L/2+.01]);}
  else if(p==='PEDESTRIAN_GATE'){
    for(const x of [-W/2,W/2])b.box(.06,H+.1,.06,[x,(H+.1)/2,0],steel);const leaf=new THREE.Group();leaf.name='FACILITY_DOOR';leaf.position.x=-W/2;b.g.add(leaf);for(const y of [.1,H*.5,H-.1])b.box(W,.035,.035,[W/2,y,0],c,leaf);for(let x=.05;x<W;x+=.12)b.rod([x,.1,0],[x,H-.1,0],.01,c,leaf);b.box(W*.85,.055,.055,[W/2,1,.07],red,leaf);leaf.rotation.y=f.open?Math.PI*.48:0;
  }
  else if(['DRIVER_WC','WASTE_SHELTER'].includes(p)){
    b.box(W+.15,.12,L+.15,[0,.06,0],'#b5b8ad');for(const x of [-W/2,W/2])b.box(.045,H,L,[x,H/2,0],c);b.box(W,H,.045,[0,H/2,-L/2],c);const roof=b.box(W+.35,.08,L+.45,[0,H+.06,0],steel);roof.rotation.x=.025;
    for(let z=-L/2;z<L/2;z+=.14)for(const x of [-W/2,W/2])b.box(.016,H,.026,[x,H/2,z],'#c2cbc7');
    if(p==='WASTE_SHELTER'){for(const x of [-W/2,0,W/2])b.rod([x,.1,L/2],[x,H,L/2],.035,steel);for(let x=-W/2;x<W/2;x+=.18)b.rod([x,.15,L/2],[x,H-.15,L/2],.008,steel);for(let y=.2;y<H;y+=.2)b.rod([-W/2,y,L/2],[W/2,y,L/2],.008,steel);for(const x of [-W*.28,0,W*.28]){b.box(.85,.13,.85,[x,.19,-L*.1],dark);b.cyl(.27,.85,[x,.68,-L*.1],red);}}
    else{b.box(W,H,.045,[0,H/2,L/2],c);b.box(.8,1.95,.035,[W*.2,1.075,L/2+.04],steel);b.box(.5,.65,.038,[W*.2,1.65,L/2+.065],'#476972');b.ball(.025,[W*.2-.28,1,L/2+.095],dark);}
    const ink=f.textColor||dark,col=new THREE.Color(ink),bg=col.r*.2126+col.g*.7152+col.b*.0722>.6?dark:'#ffffff';b.box(W*.94,.33,.035,[0,H-.18,L/2+.04],bg);b.label(f.label||o.name,W*.9,.28,[0,H-.18,L/2+.063],bg,ink);
    if(p==='WASTE_SHELTER'){const surface=new THREE.Mesh(new THREE.PlaneGeometry(W,H-.15),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false,side:THREE.DoubleSide}));surface.position.set(0,H/2+.075,L/2+.015);surface.name='FACILITY_MOUNT_SURFACE';surface.userData.mountSurface=true;b.g.add(surface);}
  }
  b.g.name=o.name;return b.finish();
}

export function makeNetworkConnections(entities:Entity[]){
  const b=new Builder(),map=new Map(entities.map(o=>[o.id,o]));for(const o of entities){for(const key of ['supplyId','concentrateId'] as const){const source=map.get(o.facility?.[key]||'');if(!source)continue;const a=portPosition(source),z=portPosition(o,key==='concentrateId'?'foam':'in');if(new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...z))<.025)continue;const middle:V=[a[0],z[1],z[2]],group=new THREE.Group();group.userData.connectionId=o.id;group.userData.entityId=o.id;group.name='FACILITY_CONNECTION';b.g.add(group);b.tube([a,[a[0],z[1],a[2]],middle,z],key==='concentrateId'?.025:.055,key==='concentrateId'?steel:o.color,group);}}
  return b.finish();
}
export function updateFacilityVisual(o:Entity,g:THREE.Group,network:FacilityNetwork,now:number,night=false){
  if(g.userData.nightState!==night){g.userData.nightState=night;g.traverse(node=>{if(node instanceof THREE.Mesh){const mats=Array.isArray(node.material)?node.material:[node.material];for(const mat of mats)if(mat.userData.nightGlow!==undefined)(mat as THREE.MeshStandardMaterial).emissiveIntensity=night?mat.userData.nightGlow:0;}});}
  updateShowerVisual(o,g,network,now);
  const s=network.active?network.states.get(o.id):undefined;const handle=g.getObjectByName('FACILITY_VALVE_HANDLE');if(handle)handle.rotation.y=(network.active?network.open.get(o.id):o.facility?.open)===false?Math.PI/2:0;
  const door=g.getObjectByName('FACILITY_DOOR');if(door)door.rotation.y=(network.active?network.open.get(o.id):o.facility?.open)?Math.PI*.48:0;
  const jet=g.getObjectByName('FACILITY_JET');if(jet){jet.visible=!!s?.flowing;jet.traverse(m=>{if(m instanceof THREE.Mesh){const mat=m.material as THREE.MeshStandardMaterial;mat.color.set(s?.fluid==='solution'?'#f4f0d5':'#91cee8');mat.opacity=s?.fluid==='solution'?.8:.45;}});}
  const level=g.getObjectByName('FACILITY_LEVEL');if(level){const cap=o.facility?.capacity||1000,litres=network.active?(network.levels.get(o.id)??o.facility?.volume??cap):(o.facility?.volume??cap),ratio=Math.max(0,Math.min(1,litres/cap));level.scale.y=Math.max(.001,ratio);level.position.y=level.userData.baseY+level.userData.fullHeight*ratio/2;}
  const beacon=g.getObjectByName('FACILITY_BEACON') as THREE.Mesh|undefined;if(beacon)(beacon.material as THREE.MeshStandardMaterial).emissiveIntensity=network.active&&network.alarms.size?(Math.sin(now/150)>0?2:.2):.12;
}
