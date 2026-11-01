import {prepareMonitor} from './monitor-training';
import {makeFuelModule} from './fuel-modules';
import {bottomFedMonitor} from './bottom-fed-monitor';
import {singleSupport,supportAvailable,batchSupports} from './editable-supports';
import {pipeTrenchSections} from './drain-geometry';
import {pipeSupports} from './pipe-supports';
import {makeAdbLoadingCanopy,isAdbLoadingCanopy} from './adb-loading-canopy';
import * as THREE from 'three';
import {makeReferencePipe} from './socar-fire-geometry';
import {makePipeTube} from './pipe-geometry';
import {referenceConnectionPoints} from './socar-fire-layout';
import {isGroundFill} from './ground-fill';
import {makeGroundFill,makePathSolid} from './site-surface-model';
import {tankStairLayout} from './tank-stairs';
import {connectRail,outsideLanding} from './tank-rail-connections';
import {Builder} from './facility-geometry';
import {makeFacilityDetail,makeFootprint,updateShowerVisual} from './facility-detail-models';
import type {Entity} from './scene-data';
import {FACILITY_CATALOG,portPosition,isFoamStore,type TankOpening} from './facility-data';
import type {FacilityNetwork} from './facility-network';
type V=[number,number,number];
const steel='#aebbbe',dark='#354347',red='#bc302a',yellow='#e5d53f';
export function makeTankAccess(o:Entity,openings:TankOpening[]=[]){
  const b=new Builder(),f=o.facility||{},r=o.radius,H=o.height+.27,w=f.stairWidth??.9,R=r+w*.5+.12,paint='#e0e4dd',railPaint=FACILITY_CATALOG.CROSSOVER_STAIR.color;
  const layout=tankStairLayout(o),{start,sweep,sign,base}=layout,floor=base-.135;
  const p=(a:number,rad:number,y:number,tangent=0):V=>[Math.sin(a)*rad+Math.cos(a)*tangent,y,Math.cos(a)*rad-Math.sin(a)*tangent];
  const box=(width:number,height:number,depth:number,a:number,rad:number,y:number,tangent=0,color=paint)=>{const m=b.box(width,height,depth,p(a,rad,y,tangent),color);m.rotation.y=a-Math.PI/2;return m;};
  const beam=(a:V,z:V,width=.04,height=.23)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...z),direction=bv.clone().sub(av),length=direction.length();direction.normalize();const right=new THREE.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right);const m=b.box(width,height,length,av.add(bv).multiplyScalar(.5).toArray() as V,paint);m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,direction));};
  const deck=(a:number,inner:number,outer:number,depth:number,y:number,tangent=0)=>{
    const width=outer-inner,mid=(inner+outer)/2,count=Math.max(4,Math.ceil(width/.065));
    for(const side of [-1,1]){box(.035,.13,depth,a,mid+side*width/2,y-.065,tangent);box(width,.1,.04,a,mid,y-.05,tangent+side*depth/2);}
    for(let i=0;i<=count;i++)box(.012,.032,depth,a,inner+width*i/count,y-.008,tangent,steel);
    for(let z=-depth/2;z<=depth/2;z+=.13)box(width,.016,.013,a,mid,y-.019,tangent+z,steel);
  };
  const rail=(points:V[])=>{for(let i=1;i<points.length;i++)for(const run of connectRail(points[i-1],points[i],openings)){
    b.rail([run.a,run.b],railPaint,1.08);
    for(const [end,join] of [[run.a,run.joinA],[run.b,run.joinB]] as [V,V|undefined][])if(join&&new THREE.Vector3(...end).distanceTo(new THREE.Vector3(...join))>.008)b.rail([end,join],railPaint,1.08);
  }};
  const {angle:top,depth:landingDepth,inner,outer}=layout.roofLanding;
  if(f.stairs!==false){
    let index=0;
    for(const piece of layout.pieces){
      if(piece.roofLanding)continue;
      const parts=piece.landing?Math.max(2,Math.ceil(Math.abs(piece.b-piece.a)*R/.18)):1;
      for(let k=0;k<parts;k++){const a=piece.a+(piece.b-piece.a)*k/parts,z=piece.a+(piece.b-piece.a)*(k+1)/parts;
        deck((a+z)/2,R-w/2,R+w/2,Math.abs(z-a)*R+.025,piece.y1);
        for(const side of [-1,1])beam(p(a,R+side*(w/2+.025),Math.max(floor+.14,piece.y0-.12)),p(z,R+side*(w/2+.025),Math.max(floor+.14,piece.y1-.12)));
      }
      if(index++%6===0||piece.landing){const a=(piece.a+piece.b)/2,y=piece.y1,low=Math.max(floor+.055,y-.9);box(.055,Math.max(.08,y-.14-low),.22,a,r+.005,(y-.14+low)/2);beam(p(a,r-.02,y-.14),p(a,R+w/2+.045,y-.14),.075,.1);if(y>.45)beam(p(a,r-.02,low),p(a,R+w/2+.045,y-.19),.055,.075);}
    }
    for(const side of [1]){
      const rad=R+side*(w/2+.025),points:V[]=[p(start,rad,base)];
      for(const piece of layout.pieces){const n=Math.max(1,Math.ceil(Math.abs(piece.b-piece.a)*rad/.75));for(let i=1;i<=n;i++)points.push(p(piece.a+(piece.b-piece.a)*i/n,rad,piece.y0+(piece.y1-piece.y0)*i/n));}
      for(let i=1;i<points.length;i++)for(const run of outsideLanding(points[i-1],points[i],{angle:top,inner,outer,depth:landingDepth,height:H}))rail([run.a,run.b]);
    }
    const entry=layout.entry,end=p(start,R,base),d=new THREE.Vector3(...end).sub(new THREE.Vector3(...entry)),len=d.length();
    if(len>.02){const mid=new THREE.Vector3(...entry).add(new THREE.Vector3(...end)).multiplyScalar(.5),entryDeck=new Builder();entryDeck.grate(w,len,base);const eg=entryDeck.finish();eg.position.set(mid.x,0,mid.z);eg.rotation.y=Math.atan2(d.x,d.z);b.g.add(eg);const side=new THREE.Vector3(d.z,0,-d.x).normalize().multiplyScalar(w/2),outward=mid.dot(side)>=0?1:-1;rail([new THREE.Vector3(...entry).addScaledVector(side,outward).toArray() as V,new THREE.Vector3(...end).addScaledVector(side,outward).toArray() as V]);}
    // Rectangular base shoes and a radial bracket anchor both stringer ends.
    for(const side of [-1,1]){const rad=R+side*(w/2+.025);box(.16,.04,.28,start,rad,floor+.02);box(.07,.11,.08,start,rad,floor+.095);}
    beam(p(start,r-.02,floor+.065),p(start,R+w/2+.05,floor+.065),.08,.1);
    deck(top,inner,outer,landingDepth,H);
    rail([p(top,outer,H,-landingDepth/2),p(top,outer,H,landingDepth/2)]);
    rail([p(top,inner,H,sign*landingDepth/2),p(top,outer,H,sign*landingDepth/2)]);
    rail([p(top,inner,H,-sign*landingDepth/2),p(top,r+.09,H,-sign*landingDepth/2)]);
    for(const t of [-landingDepth*.35,landingDepth*.35]){beam(p(top,r,H-.8,t),p(top,outer,H-.12,t),.075,.1);box(.04,.3,.18,top,r+.02,H-.8,t);}
  }
  const tau=Math.PI*2,normalize=(a:number)=>(a%tau+tau)%tau,ringRadius=Math.max(.05,r-.1);
  const gaps=[...openings,...(f.stairs!==false?[{angle:top,halfAngle:Math.asin(Math.min(.95,(landingDepth/2+.08)/ringRadius))}]:[])];
  // Split at the exact opening boundaries, including a gap that crosses angle zero.
  const angles=[...Array.from({length:65},(_,i)=>i/64*tau),...gaps.flatMap(g=>[normalize(g.angle-g.halfAngle),normalize(g.angle+g.halfAngle)])].sort((a,b)=>a-b);
  const blocked=(a:number)=>gaps.some(g=>Math.abs(Math.atan2(Math.sin(a-g.angle),Math.cos(a-g.angle)))<g.halfAngle-1e-7);
  const railGroup=new Builder();
  for(let i=1;i<angles.length;i++){const a=angles[i-1],z=angles[i];if(z-a<1e-7||blocked((a+z)/2))continue;for(const h of [.54,1.08])railGroup.rod(p(a,ringRadius,H+h),p(z,ringRadius,H+h),h===1.08?.024:.017,railPaint);}
  const postCount=Math.max(12,Math.ceil(tau*ringRadius/1.05)),postAngles=[...Array.from({length:postCount},(_,i)=>i/postCount*tau),...gaps.flatMap(g=>[normalize(g.angle-g.halfAngle),normalize(g.angle+g.halfAngle)])];
  for(const a of postAngles)if(!blocked(a))railGroup.rod(p(a,ringRadius,H),p(a,ringRadius,H+1.08),.024,railPaint);
  for(const opening of openings){const c=opening.corridor;if(!c)continue;const dx=c.end[0]-c.start[0],dz=c.end[2]-c.start[2],len=Math.hypot(dx,dz);if(len<.05)continue;
    for(const angle of [opening.angle-opening.halfAngle,opening.angle+opening.halfAngle]){const point=p(angle,ringRadius,H),ux=dx/len,uz=dz/len,along=Math.max(0,Math.min(len,(point[0]-c.start[0])*ux+(point[2]-c.start[2])*uz)),side=Math.sign((point[0]-c.start[0])*uz-(point[2]-c.start[2])*ux)||1,target:V=[c.start[0]+ux*along+uz*side*c.width/2,c.start[1]+along/len*(c.end[1]-c.start[1]),c.start[2]+uz*along-ux*side*c.width/2];
      if(Math.abs(target[1]-H)<.23)railGroup.rail([point,target],railPaint,1.08);
    }
  }
  railGroup.g.name='TANK_ROOF_RAILING';b.g.add(railGroup.finish());
  if(!f.coolingManaged){const waterRing=Array.from({length:65},(_,i)=>p(i/64*tau,r+.08,H-.32));b.tube(waterRing,.04,red);}
  b.g.name='TANK_CURVED_ACCESS';return b.finish();
}

function drawPath(b:Builder,o:Entity){
  const pts=o.points||[[-o.length/2,0],[o.length/2,0]],f=o.facility||{},id=o.preset;let travelled=0,nextStep=.25,step=0;
  if(id.startsWith('PIPE_')){b.tube(pts.map(p=>[p[0],o.height,p[1]]),o.width/2,o.color);for(const p of [pts[0],pts[pts.length-1]]){b.box(.22,.06,.25,[p[0],.03,p[1]],'#d6dcd8');b.box(.06,Math.max(.05,o.height-.05),.06,[p[0],o.height/2,p[1]],steel);}return;}
  for(let i=1;i<pts.length;i++){const a=pts[i-1],z=pts[i],dx=z[0]-a[0],dz=z[1]-a[1],l=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);if(l<.01)continue;
    const piece=(from:number,len:number,width:number,height:number,color:string,offset=0)=>{const t=(from+len/2)/l,x=a[0]+dx*t+Math.cos(angle)*offset,zz=a[1]+dz*t-Math.sin(angle)*offset,m=b.box(width,height,len,[x,height/2+.022,zz],color);m.rotation.y=angle;if(id==='GROUND_LINE')b.glow(m,.17);};
    if(id==='DRAIN'){
      const depth=(f.trenchDepth??.5)/o.scale;
      const section=(width:number,height:number,y:number,offset=0)=>{const m=b.box(width,height,l,[(a[0]+z[0])/2+Math.cos(angle)*offset,y,(a[1]+z[1])/2-Math.sin(angle)*offset],dark);m.rotation.y=angle;return m;};
      section(o.width,.04,-depth-.02).name='DRAIN_FLOOR';for(const side of [-1,1])section(.035,depth,-depth/2,side*(o.width/2+.0175)).name='DRAIN_SIDE';
      if(f.trenchGrate!==false)for(let x=0;x<l;x+=.1)piece(x,Math.min(.022,l-x),o.width,.035,steel);
      if(f.trenchGrate!==false)for(const side of [-1,1])piece(0,l,.025,.035,steel,side*(o.width/2-.0125));
    }
    else if(id==='CURB'){for(let x=0;x<l;x+=.6)piece(x,Math.min(.59,l-x),o.width,o.height,Math.floor(x/.6)%2?'#eeeee3':o.color);}
    else if(id==='FOOTPRINTS'||f.pattern==='footprints'){while(nextStep<travelled+l-.13){const x=nextStep-travelled,side=step++%2?1:-1;if(x>.15)makeFootprint(b,a[0]+dx*x/l+Math.cos(angle)*side*.13,a[1]+dz*x/l-Math.sin(angle)*side*.13,angle,side,o.color);nextStep+=.55;}travelled+=l;}
    else if(f.pattern==='dash'){for(let x=0;x<l;x+=1.2)piece(x,Math.min(.65,l-x),f.lineWidth??o.width,.009,o.color);}
    else piece(0,l,f.lineWidth??o.width,.009,o.color);
  }
}
export function makeFacilityObject(o:Entity,openings:TankOpening[]=[]){
  const fuel=makeFuelModule(o);if(fuel)return fuel;
  if(o.preset==='PIPE_SUPPORT'){const g=singleSupport(o.facility?.supportStyle??'rack',o.width,o.height,o.color);g.userData.entityId=o.id;return g;}
  if(isAdbLoadingCanopy(o))return makeAdbLoadingCanopy(o);
  const referenceRoof=o.preset==='ADB_RECEIVING_ISLAND'||o.preset==='CANOPY'&&o.facility?.reference?.startsWith('SOCAR-ADB-');
  if(!FACILITY_CATALOG[o.preset]&&!referenceRoof)return undefined;const b=new Builder(),W=o.width,L=o.length,H=o.height,c=o.color,p=o.preset,f=o.facility||{};b.g.userData.entityId=o.id;
  if(o.id==='adb-fire-terminal-cabinet'&&p==='HOSE_CABINET'){
    for(const x of [-W*.38,W*.38])for(const z of [-L*.32,L*.32])b.box(.065,.2,.065,[x,.1,z],c);
    b.box(W,H-.2,L,[0,(H+.2)/2,0],c);b.box(W+.12,.055,L+.1,[0,H+.025,0],c);
    b.box(W-.09,H-.3,.025,[0,(H+.2)/2,L/2+.018],'#bd302d');b.box(.045,.14,.035,[W*.35,H*.53,L/2+.047],'#b8c2c1');
    b.label('YANGIN\nDOLABI',W*.55,.4,[0,H*.62,L/2+.035],c,'#ffffff');return b.finish();
  }
  if(referenceRoof){
    for(const x of [-W*.47,W*.47])for(const z of [-L*.47,L*.47])b.box(.09,H,.09,[x,H/2,z],c);
    b.box(W,.09,L,[0,H,0],c);for(let z=-L/2;z<=L/2;z+=.22)b.box(W,.025,.025,[0,H+.055,z],c);
    for(const z of [-L*.34,0,L*.34])b.box(W,.11,.08,[0,H-.08,z],'#d5d8d1');
    // Video 12, 24–29 s: two hanging round luminaires next to the pipe.
    b.box(.10,.045,L*.85,[W*.17,H-.29,0],'#737e7c');
    for(const z of [-L*.23,L*.23]){
      const x=W*.17;b.rod([x,H-.15,z],[x,H-.5,z],.014,'#596461');
      b.cyl(.18,.09,[x,H-.53,z],'#52615d');b.glow(b.cyl(.15,.035,[x,H-.59,z],'#fff1d5'),3);
      for(const side of [-1,1])b.rod([x+side*.16,H-.54,z],[x+side*.16,H-.65,z],.008,'#52615d');
      b.rod([x-.16,H-.65,z],[x+.16,H-.65,z],.008,'#52615d');
      const light=new THREE.SpotLight('#fff1d5',0,9,1,.65,2);light.position.set(x,H-.67,z);light.target.position.set(x,0,z);light.userData.nightIntensity=65;light.castShadow=false;b.g.add(light,light.target);
    }return b.finish();
  }
  if(isGroundFill(o)){b.g.add(makeGroundFill(o));return b.finish();}
  if(p==='CURB'){b.g.add(makePathSolid(o.points?o:{...o,points:[[-L/2,0],[L/2,0]]},true));return b.finish();}
  const post=(x:number,z:number,h=1,col=c)=>{b.cyl(.1,.08,[x,.04,z],dark);b.glow(b.cyl(.057,h,[x,h/2,z],col),.17);for(const y of [.49,.73,.91])b.glow(b.cyl(.058,h*.09,[x,h*y,z],'#f1f0dc'),.27);};
  const wheel=(x:number,y:number,z:number,r=.16)=>{const w=b.cyl(r,.095,[x,y,z],dark);w.rotation.z=Math.PI/2;};
  const ext=(x=0,z=0,h=.8)=>{b.cyl(h*.145,h*.73,[x,h*.45,z],c);b.ball(h*.14,[x,h*.81,z],c);b.cyl(.028,.13,[x,h*.95,z],steel);b.box(.22,.035,.06,[x+.035,h,z],dark);b.label('YANGIN',h*.24,h*.2,[x,h*.52,z+h*.146]);b.tube([[x+.05,h,z],[x+.2,h*.83,z],[x+.2,h*.28,z]],.018,dark);};
  if(makeReferencePipe(b,o)){}
  else if(makeFacilityDetail(b,o)){}
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
    if(p==='FIRE_MONITOR'&&f.monitorBottomInlet)bottomFedMonitor(b,c);else{
    b.cyl(.25,.12,[0,.06,0],c);b.cyl(.095,.9,[0,.55,0],c);b.flange([0,.18,0],c,'y');b.flange([0,.86,0],c,'y');b.tube([[0,.8,0],[0,1.05,.18],[0,1.15,.4]],.075,c);if(p!=='FIRE_MONITOR')b.rod([0,1.15,.4],[0,1.48,1.05],.085,steel);b.flange([0,1.12,.43],steel);const ring=b.mesh(new THREE.TorusGeometry(.19,.025,8,24),[.28,.92,.1],c);ring.rotation.y=Math.PI/2;
    b.rod([0,.85,0],[.28,.92,.1],.028,steel);b.tube([[0,.65,-L/2],[0,.65,0]],.065,c);
    }
    const jet=new THREE.Group();jet.name='FACILITY_JET';const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,f.monitorBottomInlet?1.85:1.5,f.monitorBottomInlet?.8:1.1),new THREE.Vector3(0,2.8,5),new THREE.Vector3(0,.15,10)]);const stream=new THREE.Mesh(new THREE.TubeGeometry(curve,24,.065,6,false),new THREE.MeshStandardMaterial({color:'#8acbea',transparent:true,opacity:.45,depthWrite:false}));jet.add(stream);jet.visible=false;b.g.add(jet);
  }
  else if(isFoamStore(o)){
    if(p==='FOAM_DRUM'){b.cyl(W/2,H,[0,H/2,0],c);for(const y of [.08,H*.3,H*.7,H-.05])b.cyl(W/2+.012,.025,[0,y,0],c);b.label('KÖPÜK · 200 L',W*.9,H*.36,[0,H*.55,W/2+.01],c,'#ffffff');}
    else{b.box(W,H*.7,L,[0,H*.55,0],c);for(const x of [-W*.4,W*.4])for(const z of [-L*.4,L*.4])b.box(.07,.36,.07,[x,.18,z],steel);b.cyl(.14,.04,[0,H*.92,0],dark);b.label(f.tag||'KPT01',W*.8,.25,[0,H*.67,L/2+.016]);b.label('KÖPÜK TANKI · 1000 L',W*.88,.2,[0,H*.45,L/2+.016]);}
    const gauge=b.box(.035,H*.65,.035,[W*.48,H*.56,L*.51],dark);gauge.name='FOAM_LEVEL_BACK';const level=b.box(.025,H*.62,.039,[W*.48,H*.56,L*.51+.01],'#e4c357');level.name='FACILITY_LEVEL';level.userData.baseY=H*.25;level.userData.fullHeight=H*.62;b.tube([[0,.2,0],[0,.2,L/2]],.035,steel);
  }
  else if(p==='FIRE_HOSE_OUTLET'){
    makePipeTube(b,[[0,.3,-.4],[0,.3,-.18],[0,1.05,-.18],[0,1.05,.35]],.05,c,0,.14);
    b.flange([0,1.05,.08],'#245b9c','z',.13);const valveBody=b.cyl(.09,.16,[0,1.05,.11],'#245b9c');valveBody.rotation.x=Math.PI/2;b.flange([0,1.05,.35],steel,'z',.1);
    for(const x of [-.105,.105])b.box(.055,.075,.06,[x,1.05,.35],steel);
    const cap=b.cyl(.085,.025,[0,1.05,.39],steel);cap.rotation.x=Math.PI/2;
    b.rod([0,1.05,.02],[0,1.19,.02],.022,steel);const handle=new THREE.Group();handle.name='FACILITY_VALVE_HANDLE';handle.position.set(0,1.2,.02);b.box(.055,.025,.23,[0,0,.1],c,handle);handle.rotation.y=f.open===false?Math.PI/2:0;b.g.add(handle);
    b.label(f.tag||'YANGIN',.38,.14,[0,.7,-.115]);
  }
  else if(p==='TANK_FOAM_INLET'){
    b.tube([[0,.65,-L/2],[0,.65,0],[0,.85,L/2]],.05,c);b.flange([0,.65,-L/2],c);
    b.cyl(.16,.45,[0,.9,0],c);b.cyl(.2,.035,[0,1.14,0],steel);b.label(f.tag||'FC',.3,.15,[0,.95,.17]);
    const jet=new THREE.Group();jet.name='FACILITY_JET';jet.visible=false;b.rod([0,.85,L/2],[0,.15,L/2+.2],.05,'#f4f0d5',jet);b.g.add(jet);
  }
  else if(['PIPE_TEE','PIPE_ELBOW','PIPE_VALVE','FOAM_EDUCTOR','PRESSURE_GAUGE','WATER_SOURCE','SPRINKLER','TANK_COOLING'].includes(p)){
    if(p==='PIPE_ELBOW')b.tube([[0,.65,-L/2],[0,.65,0],[W/2,.65,0]],.065,c);else b.tube([[0,.65,-L/2],[0,.65,L/2]],.065,c);
    for(const z of [-L/2,L/2])b.flange([0,.65,z],c);
    if(p==='PIPE_TEE')b.tube([[0,.65,0],[W/2,.65,0]],.065,c);
    if(p==='PIPE_VALVE'){const body=b.cyl(.16,.2,[0,.65,0],c);body.rotation.x=Math.PI/2;b.rod([0,.65,0],[0,.92,0],.035,steel);const handle=new THREE.Group();handle.name='FACILITY_VALVE_HANDLE';handle.position.set(0,.94,0);if(f.valveStyle==='lever'){b.box(.07,.035,.38,[0,0,.17],steel,handle);b.box(.085,.045,.17,[0,.005,.3],o.id.includes('-concentrate-valve')?'#225a9c':c,handle);b.box(.22,.21,.24,[0,.65,0],c);}else b.rod([0,0,-.24],[0,0,.24],.028,c,handle);b.g.add(handle);handle.rotation.y=f.open===false?Math.PI/2:0;b.label(f.tag||'FV',.3,.15,[.2,.74,0]);}
    if(p==='FOAM_EDUCTOR'){const body=b.cyl(.13,.45,[0,.65,0],c,.07);body.rotation.x=Math.PI/2;if(!f.inlineMixer)b.tube([[.36,.72,0],[.2,.72,0],[0,.65,0]],.024,steel);else b.rod([0,.65,0],[0,.82,0],.022,steel);b.label(f.ratioUnspecified?'KÖPÜK':`${f.ratio??3}%`,.28,.14,[0,.8,.03],c,dark);}
    if(p==='PRESSURE_GAUGE'){b.rod([0,.7,0],[0,1.02,0],.02,steel);const gauge=b.cyl(.14,.06,[0,1.1,.01],steel);gauge.rotation.x=Math.PI/2;b.label('0   5   10',.24,.24,[0,1.1,.05]);b.rod([0,1.09,.06],[-.045,1.17,.06],.006,dark);}
    if(p==='PIPE_VALVE'&&o.id.includes('-concentrate-valve')){for(const z of [-L*.32,L*.32])b.cyl(.19,.09,[0,.65,z],steel).rotation.x=Math.PI/2;}
    if(p==='WATER_SOURCE'){b.box(.5,.15,.7,[0,.075,0],'#bcc8c4');b.rod([0,.65,0],[0,.2,0],.09,c);b.label('SU / WATER',.5,.2,[0,.9,0]);}
    if(p==='SPRINKLER'||p==='TANK_COOLING'){b.cyl(.12,.025,[0,.45,0],steel);const jet=new THREE.Group();jet.name='FACILITY_JET';for(let i=0;i<8;i++){const a=i*Math.PI/4;const m=b.rod([0,.42,0],[Math.sin(a)*1.2,-.05,Math.cos(a)*1.2],.015,'#8ed1ee',jet);m.material=new THREE.MeshStandardMaterial({color:'#8ed1ee',transparent:true,opacity:.5,depthWrite:false});}jet.visible=false;b.g.add(jet);}
    if(!f.inlineMixer)for(const z of [-L*.3,L*.3]){b.box(.22,.06,.25,[0,.03,z],'#d9dfdb');b.box(.06,.55,.06,[0,.3,z],steel);}
  }
  else if(p==='TANK_STAIR'){return makeTankAccess({...o,kind:'tank',radius:Math.max(1,o.radius)});}
  else if(p==='TANK_BRIDGE'){
    const rise=f.bridgeRise||0,deckLength=Math.hypot(L,rise),deck=new Builder();deck.grate(W,deckLength,0);const mesh=deck.finish();mesh.rotation.x=-Math.atan2(rise,L);b.g.add(mesh);
    const n=Math.max(2,Math.ceil(deckLength/1.2));for(const side of [-1,1]){
      const points=Array.from({length:n+1},(_,i):V=>[side*W/2,rise*(i/n-.5),L*(i/n-.5)]);
      for(let i=1;i<points.length;i++)for(const run of connectRail(points[i-1],points[i],openings)){
        b.rail([run.a,run.b],steel,1.08);
        for(const [end,join] of [[run.a,run.joinA],[run.b,run.joinB]] as [V,V|undefined][])if(join&&new THREE.Vector3(...end).distanceTo(new THREE.Vector3(...join))>.008)b.rail([end,join],steel,1.08);
      }
    }
    return b.finish();
  }
  else if(p==='CROSSOVER_STAIR'||p==='MOBILE_STAIR'){
    const topLen=p==='MOBILE_STAIR'?.75:1.1,run=(L-topLen)/(p==='MOBILE_STAIR'?1:2),count=Math.max(4,Math.ceil(H/.2));b.grate(W,topLen,H);for(const side of [-1,1]){if(side===1&&p==='MOBILE_STAIR')continue;for(let i=0;i<count;i++){const y=H*(i+1)/count,z=side*(L/2-run*(i+.5)/count);b.grate(W,run/count,y,z,steel);}for(const x of [-W/2,W/2]){
      if(p==='CROSSOVER_STAIR'){const from=new THREE.Vector3(x,.12,side*L/2),to=new THREE.Vector3(x,H-.08,side*topLen/2),delta=to.clone().sub(from),beam=b.box(.09,.14,delta.length(),from.clone().add(to).multiplyScalar(.5).toArray() as V,steel);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),delta.normalize());b.box(.28,.045,.36,[x,.0225,side*L/2],steel);b.box(.1,.14,.1,[x,.07,side*L/2],steel);b.rail([[x,.14,side*L/2],[x,H,side*topLen/2]],c);}
      else{b.rod([x,.08,side*L/2],[x,H-.08,side*topLen/2],.06,steel);b.rail([[x,0,side*L/2],[x,H,side*topLen/2]],c);}
    }}
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
  if(p==='FIRE_MONITOR')prepareMonitor(b.g,o);b.g.name=o.name;return b.finish();
}

export function makeNetworkConnections(entities:Entity[]){
  const result=new THREE.Group(),map=new Map(entities.map(o=>[o.id,o]));
  for(const o of entities)for(const key of ['supplyId','concentrateId'] as const){
    const source=map.get(o.facility?.[key]||'');if(!source)continue;
    const a=portPosition(source),z=portPosition(o,key==='concentrateId'?'foam':'in');
    if(new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...z))<.025&&!o.facility?.[key==='concentrateId'?'concentrateRoute':'supplyRoute']?.length)continue;
    const route=o.facility?.[key==='concentrateId'?'concentrateRoute':'supplyRoute'],b=new Builder();
    const points=route?referenceConnectionPoints(source,o,key):[a,[a[0],z[1],a[2]] as V,[a[0],z[1],z[2]] as V,z];
    const compact=points.filter((p,i)=>!i||new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...points[i-1]))>.0001);
    const hose=key==='concentrateId'&&o.preset==='FIRE_MONITOR';
    const shape:V[]=hose?new THREE.CatmullRomCurve3(compact.map(p=>new THREE.Vector3(...p))).getPoints(16).map(p=>[p.x,p.y,p.z]):compact;
    const radius=key==='concentrateId'?(o.facility?.reference?.startsWith('SOCAR-ADB-')?.018:.025):(o.facility?.pipeDiameter??.11)/2,color=o.preset.startsWith('FUEL_')?'#e5e6dc':hose?'#d5c59b':key==='concentrateId'?steel:o.color;
    if(o.facility?.reference||o.facility?.routeEdited){
     const gap=key==='supplyId'&&!o.facility?.routeEdited?o.facility?.unverifiedSupplySpan:undefined;
     const sections=gap===undefined?[shape]:[shape.slice(0,gap+1),shape.slice(gap+1)];
     for(const section of sections)for(const part of pipeTrenchSections(section,entities))makePipeTube(b,part.points,radius,color,part.exposed?-1000:0,hose?.025:o.facility?.bendRadius??.16);
    }else b.tube(shape,radius,color);
    if(o.facility?.reference&&key==='supplyId'&&['loading','receiving'].includes(o.facility.circuit||'')){
     for(const {top,base,key} of pipeSupports(shape,entities,radius)){if(!supportAvailable(o,key))continue;const h=top[1]-base[1],part=singleSupport('post',.14,h,'#b8c2c1');part.position.fromArray(base);part.userData.autoSupport={ownerId:o.id,key,position:base,heading:0,scale:1,width:.14,height:h,color:'#b8c2c1',style:'post'};b.g.add(part);}
    }
    batchSupports(b.g);const group=b.finish();group.userData.pipeRouteKey=key==='supplyId'?'supplyRoute':'concentrateRoute';group.userData.connectionId=o.id;group.userData.entityId=o.id;group.name='FACILITY_CONNECTION';result.add(group);
  }
  return result;
}
export function updateFacilityVisual(o:Entity,g:THREE.Group,network:FacilityNetwork,now:number,night=false){
  if(g.userData.nightState!==night){g.userData.nightState=night;g.traverse(node=>{if(node instanceof THREE.Light&&node.userData.nightIntensity!==undefined)node.intensity=night?node.userData.nightIntensity:0;if(node instanceof THREE.Mesh){const mats=Array.isArray(node.material)?node.material:[node.material];for(const mat of mats)if(mat.userData.nightGlow!==undefined)(mat as THREE.MeshStandardMaterial).emissiveIntensity=night?mat.userData.nightGlow:0;}});}
  updateShowerVisual(o,g,network,now);
  const s=network.active?network.states.get(o.id):undefined;const handle=g.getObjectByName('FACILITY_VALVE_HANDLE');if(handle)handle.rotation.y=(network.active?network.open.get(o.id):o.facility?.open)===false?Math.PI/2:0;
  const door=g.getObjectByName('FACILITY_DOOR');if(door)door.rotation.y=(network.active?network.open.get(o.id):o.facility?.open)?Math.PI*.48:0;
  const jet=g.getObjectByName('FACILITY_JET');if(jet){jet.visible=!!s?.flowing;jet.traverse(m=>{if(m instanceof THREE.Mesh){const mat=m.material as THREE.MeshStandardMaterial;mat.color.set(s?.fluid==='solution'?'#f4f0d5':'#91cee8');mat.opacity=s?.fluid==='solution'?.8:.45;}});}
  const level=g.getObjectByName('FACILITY_LEVEL');if(level){const cap=o.facility?.capacity||1000,litres=network.active?(network.levels.get(o.id)??o.facility?.volume??cap):(o.facility?.volume??cap),ratio=Math.max(0,Math.min(1,litres/cap));level.scale.y=Math.max(.001,ratio);level.position.y=level.userData.baseY+level.userData.fullHeight*ratio/2;}
  const beacon=g.getObjectByName('FACILITY_BEACON') as THREE.Mesh|undefined;if(beacon)(beacon.material as THREE.MeshStandardMaterial).emissiveIntensity=network.active&&network.alarms.size?(Math.sin(now/150)>0?2:.2):.12;
}








