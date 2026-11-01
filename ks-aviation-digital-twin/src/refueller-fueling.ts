import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {cabUnits as u,CAB_REFERENCE} from './cab-reference';

type Materials={metal:T.Material;dark:T.Material;black:T.Material;red:T.Material;white:T.Material};
const metres=CAB_REFERENCE.metresPerNative;
export const FUEL_HOSES={delivery:{inches:2,bore:.0508,outer:.066,length:30},overwing:{inches:1,bore:.0254,outer:.037,length:30}} as const;
const v=(p:number[])=>new T.Vector3(...p as [number,number,number]);
const bounds=(n:T.Object3D)=>new T.Box3().setFromObject(n,true);

/** Level-wound hose, including the short crossover to the next radial layer.
 * Author the profile in metres; apply the native model scale only once. */
class WoundHose extends T.Curve<T.Vector3>{
  constructor(readonly centre:T.Vector3,readonly axis:'x'|'y',readonly turns:number,readonly core:number,readonly pitch:number,readonly rows:number,readonly endAngle:number){super();this.arcLengthDivisions=4096;}
  getPoint(t:number,target=new T.Vector3()){
    const turn=t*this.turns,period=this.rows-1+.25,layer=Math.floor(turn/period),phase=turn-layer*period;
    const cross=T.MathUtils.smoothstep((phase-this.rows+1)/.25,0,1),radius=this.core+this.pitch*(layer+cross);
    const traverse=Math.min(phase,this.rows-1),axial=((layer%2?this.rows-1-traverse:traverse)-(this.rows-1)/2)*this.pitch;
    const angle=this.endAngle+(turn-this.turns)*Math.PI*2;
    return this.axis==='x'?target.set(axial,radius*Math.cos(angle),radius*Math.sin(angle)).multiplyScalar(u(1)).add(this.centre):target.set(radius*Math.cos(angle),axial,radius*Math.sin(angle)).multiplyScalar(u(1)).add(this.centre);
  }
}

/** Carter 64200 and Elaflex ZVF 25 JET are proportion/detail references.
 * These are original scene meshes, not vendor CAD or certified equipment. */
export function refitFuelDelivery(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry,m:Materials){
  const drum=model.getObjectByName('Large_Reference_Hose_Drum'),park=model.getObjectByName('Delivery_Coupling_Red_Park'),deck=model.getObjectByName('Common_Flat_Grey_Floor');
  if(!drum||!park||!deck)return;
  model.updateWorldMatrix(true,true);
  const deckBox=bounds(deck),oldHead=bounds(model.getObjectByName('Parked_Delivery_Coupling')!).getCenter(new T.Vector3()),parent=deck.parent!;
  const mesh=(name:string,g:T.BufferGeometry,mat:T.Material,p:T.Object3D)=>{const n=new T.Mesh(own(g),mat);n.name=name;n.userData.sharedAsset=true;p.add(n);return n;};
  const group=(name:string,point:T.Vector3)=>{const n=new T.Group();n.name=name;n.position.copy(point);n.scale.setScalar(u(1));model.add(n);model.updateWorldMatrix(true,true);parent.attach(n);return n;};
  const box=(p:T.Object3D,name:string,size:number[],point:number[],mat=m.metal,r=.004)=>{const n=mesh(name,new RoundedBoxGeometry(...size as [number,number,number],2,r),mat,p);n.position.fromArray(point);return n;};
  const cylinder=(p:T.Object3D,name:string,r:number,h:number,point:number[],mat=m.metal,segments=40)=>{const n=mesh(name,new T.CylinderGeometry(r,r,h,segments),mat,p);n.position.fromArray(point);return n;};
  const tube=(p:T.Object3D,name:string,points:number[][],radius:number,mat=m.metal)=>mesh(name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v),false,'centripetal'),Math.max(16,points.length*12),radius,12,false),mat,p);
  const ring=(p:T.Object3D,name:string,r:number,thick:number,point:number[],mat=m.metal)=>{const n=mesh(name,new T.TorusGeometry(r,thick,10,72).rotateX(Math.PI/2),mat,p);n.position.fromArray(point);return n;};
  const bolt=(p:T.Object3D,point:number[])=>cylinder(p,'FUEL_EQUIPMENT_BOLT',.007,.005,point,m.metal,6);
  const plateLabel=(p:T.Object3D,text:string,point:number[],size=.027)=>{
    const chars:Record<string,string[]>={J:['00111','00010','00010','00010','10010','01100'],E:['11111','10000','11110','10000','10000','11111'],T:['11111','00100','00100','00100','00100','00100'],A:['01110','10001','10001','11111','10001','10001'],'-':['00000','00000','11111','00000','00000','00000'],'1':['00100','01100','00100','00100','00100','01110'],'2':['01110','10001','00010','00100','01000','11111'],'3':['11110','00001','01110','00001','00001','11110'],'0':['01110','10001','10011','10101','10001','01110'],M:['10001','11011','10101','10001','10001','10001'],'"':['01010','01010','00000','00000','00000','00000']};
    const unit=size/6,width=text.length*unit*6,base=box(p,'JET_A1_IDENTIFICATION_PLATE',[width+.018,size+.018,.003],point,m.dark,.002),parts:T.BufferGeometry[]=[];
    [...text].forEach((c,i)=>chars[c]?.forEach((row,y)=>[...row].forEach((on,x)=>{if(on==='1')parts.push(new T.PlaneGeometry(unit*.92,unit*.92).translate((i*6+x)*unit-width/2+unit/2,(2.5-y)*unit,.002));})));
    if(parts.length){mesh('JET_A1_MARKING',mergeGeometries(parts)!,m.white,base);parts.forEach(g=>g.dispose());}
  };

  // Replace the oversized generic red cylinder, keeping the parked control name.
  park.clear();model.add(park);park.position.set(oldHead.x,deckBox.max.y,oldHead.z);park.rotation.set(0,0,0);park.scale.setScalar(u(1));model.updateWorldMatrix(true,true);parent.attach(park);
  box(park,'DELIVERY_DOCK_BASE',[.32,.012,.27],[0,.006,0],m.red,.006);
  for(const x of [-.13,.13])for(const z of [-.105,.105])bolt(park,[x,.015,z]);
  cylinder(park,'DELIVERY_STOWAGE_ADAPTER',.054,.055,[0,.041,0],m.dark);
  const head=new T.Group();head.name='Parked_Delivery_Coupling';head.userData={fuel:'JET A-1',type:'underwing-pressure',inletInches:2};park.add(head);
  const body=new T.LatheGeometry([[.059,.070],[.062,.078],[.061,.095],[.047,.104],[.043,.170],[.049,.191],[.050,.202],[.041,.214],[.039,.249],[.034,.261]].map(([r,y])=>new T.Vector2(r,y)),48);
  mesh('JET_A1_PRESSURE_BODY',body,m.metal,head);
  ring(head,'JET_A1_NOSE_BUMPER',.060,.008,[0,.079,0],m.red);
  ring(head,'JET_A1_NOSE_SEAL',.044,.005,[0,.071,0],m.black);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3,n=box(head,'JET_A1_BAYONET_LUG',[.026,.012,.015],[Math.cos(a)*.049,.074,Math.sin(a)*.049],m.metal,.002);n.rotation.y=-a+Math.PI/2;}
  cylinder(head,'JET_A1_QD_COLLAR',.048,.028,[0,.266,0],m.dark);
  cylinder(head,'JET_A1_2IN_UNION',.044,.030,[0,.295,0],m.metal,12);
  cylinder(head,'JET_A1_HOSE_FERRULE',.038,.065,[0,.338,0]);
  for(const y of [.314,.325,.351,.362])ring(head,'JET_A1_FERRULE_BAND',.038,.0018,[0,y,0]);
  for(const s of [-1,1]){
    tube(head,'JET_A1_HANDLE_ARM',[[s*.047,.189,0],[s*.075,.199,0],[s*.101,.234,0]],.011);
    const grip=cylinder(head,'Delivery_Coupling_Handle'+(s>0?'_1':''),.017,.112,[s*.119,.278,0],m.black);grip.rotation.z=-s*.34;
    for(let i=0;i<5;i++){const rr=ring(head,'JET_A1_GRIP_RIB',.0177,.0025,[s*(.105+i*.006),.239+i*.016,0],m.black);rr.rotation.z=-s*.34;}
  }
  tube(head,'JET_A1_OPERATING_LEVER',[[0,.184,.042],[.019,.184,.073],[.062,.184,.094]],.009);
  const lever=cylinder(head,'JET_A1_LEVER_GRIP',.013,.058,[.065,.184,.094],m.red);lever.rotation.z=Math.PI/2;
  // Keep the operating lever's complete sweep free: no front stowage bail.
  plateLabel(park,'JET A-1',[0,.047,.137],.024);
  const inlet=new T.Object3D();inlet.name='DELIVERY_HOSE_INLET';inlet.position.set(0,.368,0);head.add(inlet);
  model.updateWorldMatrix(true,true);

  const wind=(name:string,coilParent:T.Object3D,centre:T.Vector3,axis:'x'|'y',core:number,rows:number,endAngle:number,spec:typeof FUEL_HOSES.delivery|typeof FUEL_HOSES.overwing,tailFor:(curve:WoundHose)=>T.CurvePath<T.Vector3>)=>{
    const build=(turns:number)=>{const coil=new WoundHose(centre,axis,turns,core,spec.outer*1.065,rows,endAngle),tail=tailFor(coil);return {coil,tail,length:(coil.getLength()+tail.getLength())*metres};};
    let low=.25,high=40;for(let i=0;i<34;i++){const mid=(low+high)/2;if(build(mid).length<spec.length)low=mid;else high=mid;}
    const {coil,tail,length}=build((low+high)/2),segments=Math.ceil(coil.turns*48);
    const addNative=(part:string,path:T.Curve<T.Vector3>,count:number,p:T.Object3D)=>{p.updateWorldMatrix(true,false);const g=new T.TubeGeometry(path,count,u(spec.outer/2),12,false);g.applyMatrix4(p.matrixWorld.clone().invert());return mesh(part,g,m.black,p);};
    const wound=addNative(name,coil,segments,coilParent),free=addNative(name==='Coiled_Delivery_Hose'?'Delivery_Hose_Taut_Parked':'Overwing_Hose_Tail',tail,160,parent);
    for(const n of [wound,free])Object.assign(n.userData,{fuel:'JET A-1',hoseSizeInches:spec.inches,innerDiameterMetres:spec.bore,outerDiameterMetres:spec.outer,nominalLengthMetres:spec.length,totalPathLengthMetres:length,woundLengthMetres:coil.getLength()*metres,freeLengthMetres:tail.getLength()*metres});
    free.userData.hosePath=tail.getPoints(160).map(p=>p.toArray());free.userData.hoseStart=tail.getPoint(0).toArray();free.userData.hoseEnd=tail.getPoint(1).toArray();
    wound.userData.turns=coil.turns;wound.userData.hosePath=coil.getPoints(segments).map(p=>p.toArray());
    return {coil,tail,wound,free};
  };
  const old:T.Object3D[]=[];model.traverse(n=>{if(/^Coiled_Delivery_Hose(?:_|$)|^Delivery_Hose_Taut_Parked$/.test(n.name))old.push(n);});old.forEach(n=>n.removeFromParent());
  const centre=bounds(model.getObjectByName('Drum_Center_Spindle')!).getCenter(new T.Vector3());
  const lower=model.getObjectByName('Drum_Exit_Horizontal_Roller')!,upper=model.getObjectByName('Drum_Exit_Horizontal_Roller_1')!,guide=bounds(lower).getCenter(new T.Vector3()).lerp(bounds(upper).getCenter(new T.Vector3()),.5),end=inlet.getWorldPosition(new T.Vector3());
  const main=wind('Coiled_Delivery_Hose',drum,centre,'x',.235,2,.24,FUEL_HOSES.delivery,coil=>{
    const start=coil.getPoint(1),path=new T.CurvePath<T.Vector3>();
    path.add(new T.CubicBezierCurve3(start,start.clone().addScaledVector(coil.getTangent(1),u(.22)),guide.clone().add(new T.Vector3(0,0,-u(.18))),guide));
    path.add(new T.CubicBezierCurve3(guide,guide.clone().add(new T.Vector3(0,0,u(.20))),end.clone().add(new T.Vector3(0,u(.42),0)),end));return path;
  });main.free.userData.guideCentre=guide.toArray();
  const coreGeometry=new T.CylinderGeometry(u(.202),u(.202),u(.14),64).rotateZ(Math.PI/2).translate(centre.x,centre.y,centre.z).applyMatrix4(drum.matrixWorld.clone().invert());
  mesh('DELIVERY_REEL_CORE',coreGeometry,m.dark,drum);Object.assign(drum.userData,{fuel:'JET A-1',hoseSizeInches:2,hoseLengthMetres:30});

  // Upright overwing reel in the marked bay, with a horizontal spindle.
  const reelCentre=new T.Vector3(deckBox.max.x-u(.355),deckBox.max.y,.105),reel=group('Overwing_Vertical_Reel',reelCentre);
  reel.userData={fuel:'JET A-1',hoseSizeInches:1,hoseLengthMetres:30,axis:'horizontal'};
  box(reel,'OVERWING_REEL_BASE',[.40,.018,.68],[0,.009,0],m.red,.010);
  for(const x of [-.16,.16])for(const z of [-.29,.29])bolt(reel,[x,.022,z]);
  for(const x of [-.16,.16]){
    box(reel,'OVERWING_BEARING_SUPPORT',[.028,.322,.085],[x,.179,0],m.red,.006);
    const bearing=cylinder(reel,'OVERWING_BEARING',.047,.047,[x,.36,0],m.dark);bearing.rotation.z=Math.PI/2;
  }
  for(const [name,r,h,point,mat] of [
    ['OVERWING_SPINDLE',.025,.395,[0,.36,0],m.metal],
    ['OVERWING_ROTARY_UNION',.047,.048,[-.20,.36,0],m.dark],
    ['OVERWING_REEL_CORE',.1015,.245,[0,.36,0],m.dark],
  ] as const){const n=cylinder(reel,name,r,h,[...point],mat);n.rotation.z=Math.PI/2;}
  for(const x of [-.126,.126]){
    for(const [name,r] of [['OVERWING_FLANGE_RIM',.317],['OVERWING_FLANGE_INNER',.107]] as const){const n=ring(reel,name,r,.006,[x,.36,0],m.red);n.rotation.z=Math.PI/2;}
    for(let i=0;i<8;i++){const a=i*Math.PI/4,n=box(reel,'OVERWING_FLANGE_SPOKE',[.009,.214,.023],[x,.36+Math.cos(a)*.21,Math.sin(a)*.21],m.red,.003);n.rotation.x=a;}
  }
  const cap=cylinder(reel,'OVERWING_HUB_CAP',.044,.025,[.19,.36,0],m.metal,8);cap.rotation.z=Math.PI/2;
  tube(reel,'OVERWING_REWIND_CRANK',[[.20,.36,0],[.20,.48,0],[.26,.48,0]],.009);
  const crank=cylinder(reel,'OVERWING_CRANK_GRIP',.016,.055,[.285,.48,0],m.black);crank.rotation.z=Math.PI/2;
  plateLabel(reel,'1" 30 M',[0,.040,.342],.027);
  const nozzle=group('Overwing_Nozzle_Park',new T.Vector3(-.118,deckBox.max.y,.301));
  box(nozzle,'OVERWING_NOZZLE_DOCK_BASE',[.18,.012,.22],[0,.006,0],m.dark,.006);
  for(const x of [-.067,.067])for(const z of [-.083,.083])bolt(nozzle,[x,.015,z]);
  // Open, lined slip-in pocket: the JET spout is visibly inserted in it.
  box(nozzle,'OVERWING_HOLSTER_BACK',[.09,.18,.009],[0,.102,.107],m.metal);
  for(const x of [-.042,.042])box(nozzle,'OVERWING_HOLSTER_CHEEK',[.009,.125,.094],[x,.077,.058],m.metal);
  box(nozzle,'OVERWING_HOLSTER_LINER',[.07,.012,.08],[0,.026,.05],m.black);
  const gun=new T.Group();gun.name='JET_A1_OVERWING_NOZZLE';gun.userData={fuel:'JET A-1',type:'overwing-deadman',inletInches:1,spoutProfileMillimetres:[52,70]};nozzle.add(gun);
  // Cast upper body and open trigger guard, following the ZVF 25 silhouette.
  tube(gun,'OVERWING_CAST_BODY',[[0,.262,.025],[0,.312,-.020],[0,.327,-.11]],.025);
  tube(gun,'OVERWING_TRIGGER_GUARD',[[0,.271,.016],[0,.222,-.015],[0,.218,-.102],[0,.251,-.123],[0,.311,-.12]],.008,m.black);
  tube(gun,'OVERWING_DEADMAN_TRIGGER',[[0,.269,.008],[0,.263,-.035],[0,.241,-.099]],.0048,m.metal);
  const pivot=cylinder(gun,'OVERWING_TRIGGER_PIVOT',.009,.060,[0,.273,.008],m.dark);pivot.rotation.z=Math.PI/2;
  const spoutCurve=new T.CatmullRomCurve3([[0,.268,.025],[0,.232,.046],[0,.186,.060],[0,.122,.062]].map(v));
  mesh('OVERWING_SPOUT_TUBE',new T.TubeGeometry(spoutCurve,40,.0155,20,false),m.metal,gun);
  const profile=new T.Shape();profile.absellipse(0,0,.035,.026,0,Math.PI*2,false,0);const hole=new T.Path();hole.absellipse(0,0,.032,.023,0,Math.PI*2,true,0);profile.holes.push(hole);
  const tip=mesh('OVERWING_JET_A1_OVAL_SPOUT',new T.ExtrudeGeometry(profile,{depth:.07,bevelEnabled:false,curveSegments:32}).rotateX(Math.PI/2),m.metal,gun);tip.position.set(0,.139,.062);
  const reducer=new T.CylinderGeometry(1,1,.029,48,8,true),rp=reducer.attributes.position;
  for(let i=0;i<rp.count;i++){const t=(rp.getY(i)+.0145)/.029;rp.setXYZ(i,rp.getX(i)*T.MathUtils.lerp(.035,.0155,t),rp.getY(i)+.1535,rp.getZ(i)*T.MathUtils.lerp(.026,.0155,t)+.062);}reducer.computeVertexNormals();
  mesh('OVERWING_JET_SPOUT_SHOULDER',reducer,m.metal,gun);
  const union=cylinder(gun,'OVERWING_1IN_SWIVEL',.023,.045,[0,.329,-.137],m.metal,12);union.rotation.x=Math.PI/2;
  const ferrule=cylinder(gun,'OVERWING_HOSE_FERRULE',.021,.06,[0,.329,-.184]);ferrule.rotation.x=Math.PI/2;
  plateLabel(nozzle,'JET A-1',[0,.134,.113],.021);
  const gunInlet=new T.Object3D();gunInlet.name='OVERWING_HOSE_INLET';gunInlet.position.set(0,.329,-.213);gun.add(gunInlet);
  // Present the trigger guard toward the operator while keeping the spout seated.
  gun.rotation.y=Math.PI/3;gun.position.set(-.062*Math.sin(Math.PI/3),0,.062*(1-Math.cos(Math.PI/3)));
  model.updateWorldMatrix(true,true);
  const smallCentre=reel.localToWorld(new T.Vector3(0,.36,0)),gunEnd=gunInlet.getWorldPosition(new T.Vector3());
  const small=wind('Overwing_Coiled_Hose',reel,smallCentre,'x',.1205,6,.25,FUEL_HOSES.overwing,coil=>{
    const start=coil.getPoint(1),path=new T.CurvePath<T.Vector3>();
    const guide=reel.localToWorld(new T.Vector3(0,.56,.40));
    path.add(new T.CubicBezierCurve3(start,start.clone().addScaledVector(coil.getTangent(1),u(.12)),guide.clone().add(new T.Vector3(0,0,-u(.12))),guide));
    path.add(new T.CubicBezierCurve3(guide,guide.clone().add(new T.Vector3(0,0,u(.12))),gunEnd.clone().addScaledVector(new T.Vector3(0,0,-1).transformDirection(gun.matrixWorld),u(.18)),gunEnd));return path;
  });
  // A smaller four-roller guide, behind the nozzle, bolted to the deck.
  const guidePoint=new T.Vector3(0,.56,.40);
  for(const dx of [-.065,.065]){
    box(reel,'OVERWING_GUIDE_BRACKET',[.014,.61,.018],[dx,.305,.40]);
    box(reel,'OVERWING_GUIDE_FOOT',[.055,.009,.10],[dx,.0045,.40]);
    for(const z of [.367,.433])bolt(reel,[dx,.012,z]);
    cylinder(reel,'OVERWING_SIDE_ROLLER',.009,.10,[dx*.72,.56,.40],m.dark);
  }
  for(const dy of [-.040,.040]){const roller=cylinder(reel,'OVERWING_EXIT_ROLLER',.010,.12,[0,.56+dy,.40],m.dark);roller.rotation.z=Math.PI/2;}
  small.free.userData.guideCentre=reel.localToWorld(guidePoint.clone()).toArray();
  model.updateWorldMatrix(true,true);
}
