import * as THREE from 'three';
import { GSE_SPECS } from './gse-specs';
import type { Entity } from './scene-data';
/** X right, Y up, nose toward -Z; one scene unit is one metre. */
export function makeGSE(o:Entity){
  const spec=GSE_SPECS[o.preset],g=new THREE.Group();g.userData.entityId=o.id;g.userData.gseSpec=spec.id;
  const {width:W,length:L,height:H}=spec,materials=new Map<string,THREE.MeshStandardMaterial>();
  const mat=(c:string)=>{if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:c==='#203d4c'?.3:.72,metalness:c==='#90a4ae'?.35:.08}));return materials.get(c)!;};
  const group=(name:string)=>{const p=new THREE.Group();p.name=name;g.add(p);return p;};
  const body=group('BODY'),wheels=group('WHEELS'),glass=group('WINDOWS'),lights=group('LIGHTS');
  const box=(name:string,w:number,h:number,l:number,x:number,y:number,z:number,c=o.color,parent=body)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),mat(c));m.name=name;m.position.set(x,y,z);parent.add(m);return m;};
  const bar=(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,c:string,parent=body)=>{const d=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),8),mat(c));m.name=name;m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());parent.add(m);return m;};
  const wheel=(x:number,z:number,r:number,t:number)=>{const p=new THREE.Group();p.position.set(x,r,z);p.name=`WHEEL_${x<0?'L':'R'}_${z<0?'F':'R'}`;wheels.add(p);for(const [rad,thickness,col] of [[r,t,'#202a30'],[r*.54,t+.006,'#90a4ae']] as const){const m=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,thickness,16),mat(col));m.rotation.z=Math.PI/2;p.add(m);}};
  const lamp=(x:number,z:number,y:number,c:string)=>box('MARKER_LIGHT',.08,.07,.06,x,y,z,c,lights);
  const anchor=(name:string,x:number,y:number,z:number)=>{const a=new THREE.Object3D();a.name=name;a.position.set(x,y,z);g.add(a);};
  if(spec.type==='bus'){
    // Body width is schematic; mirrors define the published overall width.
    const B=W-.22;
    box('LOW_FLOOR',B,.16,L-.10,0,.27,0,'#4c6169');
    box('LOWER_BODY',B,.65,L-.04,0,.91,0);
    box('PASSENGER_CABIN',B-.035,1.55,L-.16,0,1.945,0,'#203d4c',glass);
    box('ROOF',B,.15,L-.1,0,2.795,0);
    box('AC_UNIT',1.5,.23,2.3,0,H-.115,2,'#b9c8cd');
    for(const z of [-L/2+.025,L/2-.025]){box('BUMPER',B,.20,.05,0,.58,z,'#34444b');box('END_PANEL',B,.65,.04,0,.965,z);box('WINDSCREEN',B-.14,1.24,.045,0,1.945,z,'#203d4c',glass);}
    for(const side of [-1,1]){
      for(let z=-L/2+.16;z<L/2;z+=1.24)box('WINDOW_PILLAR',.06,1.55,.065,side*(B/2-.015),1.945,z);
      box('WAIST_STRIPE',.012,.16,L-.12,side*(B/2+.002),1.19,0,'#168781');
      for(const z of [-3.5,0,3.5]){const doors=group(`PASSENGER_DOOR_${side<0?'L':'R'}_${z}`);for(const delta of [-.3375,.3375]){box('DOOR_LEAF',.055,2.157,.675,side*(B/2+.01),1.4285,z+delta,'#354951',doors);box('DOOR_GLASS',.058,1.47,.61,side*(B/2+.01),1.86,z+delta,'#203d4c',doors);}anchor(`DOOR_ACCESS_${side}_${z}`,side*W/2,.35,z);}
      for(const z of [-L/2+3.27,L/2-3.24])wheel(side*(z<0?2.156:2.538)/2,z,.562,.425);
      box('MIRROR_STALK',.13,.05,.08,side*(W/2-.065),2.40,-6.36,'#34444b');box('MIRROR',.08,.30,.20,side*(W/2-.04),2.30,-6.36,'#203d4c');
      for(const z of [-6,-2,2,6])lamp(side*(B/2),z,.79,'#ffb82d');
      for(const z of [-L/2+.02,L/2-.02])box('HEAD_TAIL_LIGHT',.3,.13,.032,side*.94,.89,z,z<0?'#fff2c6':'#c74537',lights);
    }
    box('DESTINATION_DISPLAY',1.8,.19,.02,0,2.60,-L/2+.015,'#102228');
  }else if(spec.type==='tractor'){
    box('CHASSIS',W,.29,L,0,.42,0,'#35434b');box('REAR_COUNTERWEIGHT',W,.65,1.0,0,.84,.96);
    box('HOOD',W-.05,.56,.91,0,.84,-1.015);box('CAB_BASE',W-.09,.24,1.23,0,.87,-.04);
    box('CAB_GLASS',W-.14,1.11,1.14,0,1.56,-.04,'#203d4c',glass);box('CAB_ROOF',W,.12,1.3,0,H-.06,-.04);
    for(const x of [-W/2+.07,W/2-.07])for(const z of [-.635,.555])box('CAB_PILLAR',.07,1.2,.07,x,1.56,z,'#46545c');
    for(const z of [-.82,.82])for(const side of [-1,1])wheel(side*(W/2-.13),z,.337,.254);
    box('FRONT_GRILLE',W*.45,.24,.025,0,.82,-L/2+.016,'#34434a');
    for(const side of [-1,1]){box('HEADLIGHT',.18,.14,.025,side*.48,.9,-L/2+.016,'#fff2c6',lights);lamp(side*.55,L/2-.04,.84,'#d94435');}
    anchor('TOW_HITCH_REFERENCE',0,.48,L/2);anchor('DRIVER_ACCESS',-W/2,.32,0);
  }else if(spec.type==='cart'){
    const deckCenter=(L-3)/2;
    box('LOAD_PLATFORM',W,.12,3,0,.5,deckCenter,'#81949c');
    const rails=group('FOLDING_SIDE_RAILS');
    for(const side of [-1,1]){
      for(const y of [.72,H-.025])box('SIDE_RAIL',.045,.05,3,side*(W/2-.023),y,deckCenter,'#c4d4d8',rails);
      for(let i=0;i<6;i++)box('RAIL_UPRIGHT',.045,H-.56,.045,side*(W/2-.023),(.56+H)/2,deckCenter-1.477+i*2.954/5,'#c4d4d8',rails);
      for(const z of [deckCenter-1,deckCenter+1])wheel(side*(W/2-.13),z,.23,.20);
    }
    for(const z of [deckCenter-1.475,deckCenter+1.475]){box('END_RAIL',W,.05,.05,0,H-.025,z,'#c4d4d8',rails);box('END_RAIL',W,.05,.05,0,.75,z,'#c4d4d8',rails);}
    const tow=group('DRAWBAR');for(const x of [-.45,.45])bar('DRAWBAR_ARM',new THREE.Vector3(x,.4,deckCenter-1.2),new THREE.Vector3(0,.4,-L/2+.065),.025,'#98abb3',tow);
    box('TOW_EYE',.11,.05,.10,0,.4,-L/2+.05,'#3e5058',tow);anchor('FRONT_COUPLING',0,.4,-L/2);anchor('REAR_COUPLING',0,.4,L/2);anchor('LOAD_AREA',0,.56,deckCenter);
    if(spec.loaded){const luggage=group('BAGGAGE_LOAD');const colors=['#29465c','#994837','#5b5e83','#5c7157','#ae8a51','#455965'];for(let row=0;row<4;row++)for(const side of [-1,1]){const h=.37+(row%2)*.11;box('SUITCASE',.56,h,.59,side*.34,.56+h/2,deckCenter-1.07+row*.69,colors[(row+(side>0?2:0))%colors.length],luggage);box('HANDLE',.19,.055,.055,side*.34,.56+h+.025,deckCenter-1.07+row*.69,'#283138',luggage);}}
  }else{
    box('CHASSIS',W,.28,4.55,0,.43,-.04,'#50646c');box('ENGINE_HOUSING',W*.89,.58,2.25,0,.86,.1);
    for(const z of [-1.55,1.55])for(const side of [-1,1])wheel(side*(W/2-.145),z,.364,.27);
    box('CABIN',.82,1.24,1.22,-.64,1.40,-1.70,'#203d4c',glass);box('CAB_ROOF',.96,.109,1.30,-.615,H-.0545,-1.7);
    for(const x of [-1.05,-.24])for(const z of [-2.27,-1.13])box('CAB_PILLAR',.055,1.25,.055,x,1.41,z);
    const belt=group('CONVEYOR');const rise=1.120-.459,beltLength=7.5,projection=Math.sqrt(beltLength**2-rise**2),midY=(1.120+.459)/2;
    const deck=new THREE.Group();deck.name='BELT_DECK';deck.position.set(.5,midY,0);deck.rotation.x=Math.asin(rise/beltLength);belt.add(deck);
    box('BELT_SURFACE',.6,.035,beltLength,0,-.0175,0,'#303c40',deck);
    for(const x of [-.355,.355])box('BELT_SIDE_FRAME',.09,.16,beltLength,x,-.10,0,'#a3b6bd',deck);
    for(let z=-3.6;z<3.7;z+=.34)box('BELT_TREAD',.56,.012,.018,0,.003,z,'#566769',deck);
    for(const z of [-2.1,1.55])bar('LIFT_SUPPORT',new THREE.Vector3(.5,.52,z*.55),new THREE.Vector3(.5,midY-z*rise/projection-.14,z),.052,'#81969d',body);
    box('FRONT_BUMPER',.82,.08,.09,.5,1.01,-L/2+.045,'#33444a');box('REAR_BUMPER',.82,.08,.09,.5,.39,L/2-.045,'#33444a');
    for(const side of [-1,1])lamp(side*.94,-2.24,.62,'#fff2c6');
    anchor('BAGGAGE_DELIVERY',.5,1.120,-projection/2);anchor('BAGGAGE_INFEED',.5,.459,projection/2);
  }
  return g;
}
