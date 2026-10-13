import * as T from 'three';
import type {Entity} from './scene-data';
import {validatePersonnel,type PersonPose} from './personnel-data';

/** Articulated, metre-scale operator. No downloaded model or animation service. */
export class PersonnelRig {
  readonly root=new T.Group();readonly body=new T.Group();readonly torso=new T.Group();readonly head=new T.Group();
  readonly eye=new T.Object3D();readonly hands:T.Group[]=[];
  readonly shoulders:T.Group[]=[];readonly elbows:T.Group[]=[];readonly hips:T.Group[]=[];readonly knees:T.Group[]=[];
  private lenses:T.MeshStandardMaterial;private reflective:T.MeshStandardMaterial;private vest:T.MeshStandardMaterial;
  private elapsed=0;private size:number;private hipsY=.95;
  constructor(o:Entity){
    const p=validatePersonnel(o.personnel);this.size=o.height/1.78;
    this.root.name=o.name;this.root.userData.entityId=o.id;this.root.userData.personnelRig=this;
    this.body.scale.setScalar(this.size);this.root.add(this.body);
    const mat=(color:string,roughness=.8)=>new T.MeshStandardMaterial({color,roughness});
    const navy=mat(o.color),dark=mat('#15222e'),seam=mat('#32485a'),skin=mat(({light:'#d5a77f',medium:'#b17c57',dark:'#6c4533'})[p.skin]),rubber=mat('#172026'),sole=mat('#4a5356');
    this.vest=mat(p.vest==='orange'?'#ff8318':'#d8ef25');
    this.reflective=mat('#c9d9dd',.35);this.reflective.metalness=.35;
    this.lenses=new T.MeshStandardMaterial({color:'#263c48',roughness:.16,metalness:.1,transparent:true,opacity:.86,depthWrite:false});
    const ell=(g:T.Object3D,x:number,y:number,z:number,sx:number,sy:number,sz:number,m:T.Material)=>{const n=new T.Mesh(new T.SphereGeometry(1,14,10),m);n.position.set(x,y,z);n.scale.set(sx,sy,sz);n.castShadow=true;n.receiveShadow=true;g.add(n);return n;};
    const box=(g:T.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const n=new T.Mesh(new T.BoxGeometry(w,h,d),m);n.position.set(x,y,z);n.castShadow=true;g.add(n);return n;};
    const joint=(g:T.Object3D,name:string,x:number,y:number,z:number)=>{const n=new T.Group();n.name=name;n.position.set(x,y,z);g.add(n);return n;};
    const limb=(g:T.Object3D,length:number,top:number,bottom:number,m:T.Material)=>{const n=new T.Mesh(new T.CylinderGeometry(top,bottom,length,12),m);n.position.y=-length/2;n.scale.z=.88;n.castShadow=true;g.add(n);ell(g,0,-length,0,bottom,bottom*.9,bottom*.86,m);};
    this.torso.position.y=this.hipsY;this.body.add(this.torso);
    ell(this.torso,0,.04,0,.185,.15,.12,navy);
    // Tailored torso and high-visibility waistcoat, with real front/back bands.
    ell(this.torso,0,.28,0,.215,.29,.125,navy);
    ell(this.torso,0,.30,-.002,.221,.26,.132,this.vest);
    box(this.torso,.024,.43,.021,0,.30,-.14,dark);
    for(const z of [-.131,.131]){
      for(const y of [.18,.25])box(this.torso,.396,.027,.013,0,y,z,this.reflective);
      for(const x of [-.105,.105])box(this.torso,.036,.27,.014,x,.415,z*.91,this.reflective);
    }
    for(const x of [-.13,.13]){box(this.torso,.088,.085,.019,x,.12,-.122,seam);box(this.torso,.09,.016,.021,x,.16,-.136,navy);}
    box(this.torso,.04,.028,.026,.155,.38,-.123,reflectiveMaterial());
    ell(this.torso,0,.565,0,.06,.073,.055,skin);
    this.head.position.set(0,.70,0);this.torso.add(this.head);
    ell(this.head,0,0,0,.096,.124,.092,skin);
    ell(this.head,0,-.036,-.022,.078,.077,.083,skin);
    ell(this.head,0,-.011,-.093,.020,.035,.032,skin);
    for(const s of [-1,1]){
      ell(this.head,s*.096,-.009,0,.015,.031,.016,skin);
      ell(this.head,s*.042,.025,-.084,.033,.026,.016,this.lenses);
      box(this.head,.070,.006,.01,s*.040,.046,-.09,dark);
      box(this.head,.009,.009,.099,s*.091,.026,-.025,dark);
    }
    box(this.head,.022,.008,.014,0,.03,-.10,dark);
    box(this.head,.033,.004,.01,0,-.063,-.094,seam);
    // Low-profile protective bump cap, peak, seam and ventilation eyelets.
    const cap=new T.Mesh(new T.SphereGeometry(.103,18,10,0,Math.PI*2,0,Math.PI/2),navy);cap.position.y=.052;cap.scale.set(1,.65,1.03);this.head.add(cap);
    ell(this.head,0,.05,-.087,.11,.010,.088,navy);
    box(this.head,.065,.014,.008,0,.081,-.099,this.reflective);
    for(const s of [-1,1])for(const z of [-.018,.025])ell(this.head,s*.098,.074,z,.003,.003,.004,dark);
    this.eye.name='PERSON_EYES';this.eye.position.set(0,.026,-.112);this.head.add(this.eye);
    for(const [i,s] of [-1,1].entries()){
      const shoulder=joint(this.torso,`PERSON_SHOULDER_${i}`,s*.222,.49,0);this.shoulders.push(shoulder);
      ell(shoulder,0,0,0,.076,.085,.079,navy);limb(shoulder,.275,.070,.053,navy);
      const elbow=joint(shoulder,`PERSON_ELBOW_${i}`,0,-.275,0);this.elbows.push(elbow);limb(elbow,.255,.052,.039,navy);
      box(elbow,.080,.029,.080,0,-.235,0,this.reflective);
      const hand=joint(elbow,`PERSON_HAND_${i}`,0,-.275,0);this.hands.push(hand);
      ell(hand,0,-.035,-.007,.038,.062,.026,skin);
      for(let f=0;f<4;f++)ell(hand,-.024+f*.016,-.09,-.008,.008,.028-(f===3?.007:0),.01,skin);
      const thumb=ell(hand,-s*.037,-.037,-.019,.015,.034,.014,skin);thumb.rotation.z=-s*.5;
      const hip=joint(this.body,`PERSON_HIP_${i}`,s*.102,this.hipsY,0);this.hips.push(hip);
      limb(hip,.415,.098,.070,navy);box(hip,.106,.136,.028,s*.044,-.20,-.005,seam);
      const knee=joint(hip,`PERSON_KNEE_${i}`,0,-.415,0);this.knees.push(knee);limb(knee,.39,.066,.052,navy);
      box(knee,.12,.027,.107,0,-.27,0,this.reflective);
      ell(knee,0,-.385,0,.070,.083,.082,rubber);
      box(knee,.145,.042,.284,0,-.512,-.061,sole);
      ell(knee,0,-.467,-.056,.078,.061,.143,rubber);
      ell(knee,0,-.46,-.156,.075,.046,.041,sole);
      for(let l=0;l<3;l++)box(knee,.071,.006,.01,0,-.418,-.023-l*.025,seam);
    }
    this.update(0,'idle',0,false);
  }
  setEyes(inside:boolean){this.head.visible=!inside;}
  eyeWorld(){this.root.updateWorldMatrix(true,true);return this.eye.getWorldPosition(new T.Vector3());}
  handWorld(side=1){this.root.updateWorldMatrix(true,true);return this.hands[side].getWorldPosition(new T.Vector3());}
  update(dt:number,pose:PersonPose,speed=0,night=false,reach?:T.Vector3){
    this.elapsed+=dt;const t=this.elapsed,w=t*7.4*Math.max(.4,Math.abs(speed)),swing=Math.sin(w),blend=dt?1-Math.exp(-dt*14):1;
    const arms=[.05,-.05],elbows=[.12,.12],legs=[0,0],knees=[0,0];let lower=0,bend=0,lean=0;
    if(pose==='walk'){legs[0]=swing*.43;legs[1]=-swing*.43;knees[0]=-Math.max(0,-swing)*.55;knees[1]=-Math.max(0,swing)*.55;arms[0]=-swing*.36;arms[1]=swing*.36;lower=Math.abs(Math.sin(w))*.017;}
    if(pose==='bend'){bend=-.92;lower=-.08;legs.fill(.12);knees.fill(-.30);arms.fill(1.12);elbows.fill(.18);}
    if(pose==='crouch'){lower=-.43;bend=-.28;legs.fill(.95);knees.fill(-1.75);arms.fill(.6);elbows.fill(.85);}
    if(pose==='seated'){lower=-.42;legs.fill(Math.PI/2);knees.fill(-Math.PI/2);arms.fill(.78);elbows.fill(.72);}
    if(pose==='climb'){legs[0]=.6+Math.sin(t*5)*.43;legs[1]=.6-Math.sin(t*5)*.43;knees[0]=-legs[0]*1.5;knees[1]=-legs[1]*1.5;arms[0]=2.15-Math.sin(t*5)*.35;arms[1]=2.15+Math.sin(t*5)*.35;elbows.fill(.45);lower=-.10;lean=-.10;}
    if(['reach','valve','refuel'].includes(pose)){arms.fill(1.20);elbows.fill(.42);if(pose==='valve'){arms[0]+=.14*Math.sin(t*5);arms[1]-=.14*Math.sin(t*5);}if(pose==='refuel'){arms[0]=.50;elbows[0]=1.05;}}
    const lerp=(v:number,n:number)=>T.MathUtils.lerp(v,n,blend);
    this.torso.position.y=lerp(this.torso.position.y,this.hipsY+lower);this.torso.rotation.x=lerp(this.torso.rotation.x,bend+lean);
    this.hips.forEach((hip,i)=>{hip.position.y=lerp(hip.position.y,this.hipsY+lower);hip.rotation.x=lerp(hip.rotation.x,legs[i]);this.knees[i].rotation.x=lerp(this.knees[i].rotation.x,knees[i]);this.shoulders[i].rotation.x=lerp(this.shoulders[i].rotation.x,arms[i]);this.shoulders[i].rotation.z=lerp(this.shoulders[i].rotation.z,i===0?-.06:.06);this.elbows[i].rotation.x=lerp(this.elbows[i].rotation.x,elbows[i]);});
    this.lenses.color.set(night?'#d9f1f5':'#263c48');this.lenses.opacity=night?.18:.86;
    this.reflective.emissive.set(night?'#99b6c0':'#000000');this.reflective.emissiveIntensity=night?.4:0;
    this.vest.emissive.copy(this.vest.color);this.vest.emissiveIntensity=night?.09:0;
    if(reach&&['reach','valve','refuel'].includes(pose))this.reachRight(reach,blend);
    this.root.updateWorldMatrix(true,true);
  }
  private reachRight(target:T.Vector3,blend:number){
    const shoulder=this.shoulders[1];this.root.updateWorldMatrix(true,true);const p=this.torso.worldToLocal(target.clone()).sub(shoulder.position);
    const a=.275,b=.31,d=T.MathUtils.clamp(p.length(),.09,a+b-.003),elbow=Math.PI-Math.acos(T.MathUtils.clamp((a*a+b*b-d*d)/(2*a*b),-1,1));
    const angle=Math.atan2(-p.z,-p.y)-Math.acos(T.MathUtils.clamp((a*a+d*d-b*b)/(2*a*d),-1,1));
    shoulder.rotation.x=T.MathUtils.lerp(shoulder.rotation.x,angle,blend);shoulder.rotation.z=T.MathUtils.lerp(shoulder.rotation.z,Math.atan2(p.x,Math.hypot(p.y,p.z)),blend);this.elbows[1].rotation.x=T.MathUtils.lerp(this.elbows[1].rotation.x,elbow,blend);
  }
}
function reflectiveMaterial(){return new T.MeshStandardMaterial({color:'#e2eaf0',roughness:.5});}
export function makePersonnel(o:Entity){return new PersonnelRig(o).root;}
export function personnelRig(root?:T.Object3D):PersonnelRig|undefined{return root?.userData.personnelRig;}
