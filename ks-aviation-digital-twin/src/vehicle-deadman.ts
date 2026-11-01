import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {cabUnits as u} from './cab-reference';

export const DEADMAN_CABLE_LENGTH=40;
/** Parked cabinet, removable normally-open hand switch and its continuous lead. */
export class VehicleDeadman {
  readonly box=new T.Group();readonly door=new T.Group();readonly handle=new T.Group();
  readonly dock=new T.Object3D();readonly outlet=new T.Object3D();readonly coil=new T.Group();
  readonly lever=new T.Group();readonly cable:T.Mesh;
  open=false;amount=0;pressed=false;deployed=false;cableLength=0;
  private geometries:T.BufferGeometry[]=[];private materials:T.Material[]=[];
  private lastPath='';
  constructor(readonly model:T.Object3D){
    const deck=model.getObjectByName('Common_Flat_Grey_Floor')!;
    model.updateWorldMatrix(true,true);const floor=new T.Box3().setFromObject(deck).max.y;
    for(const name of ['Deadman_Panel_Front','Deadman_Fluorescent_Yellow_Cable','Deadman_Yellow_Lead'])model.getObjectByName(name)?.removeFromParent();
    const material=(color:string,metalness=.2)=>{const m=new T.MeshStandardMaterial({color,metalness,roughness:.48});this.materials.push(m);return m;};
    const metal=material('#b4bdc3',.65),dark=material('#222a2e'),black=material('#121a1c'),yellow=material('#e0eb36',.05);
    const mesh=(name:string,g:T.BufferGeometry,m:T.Material,p:T.Object3D=this.box)=>{this.geometries.push(g);const n=new T.Mesh(g,m);n.name=name;n.userData.sharedAsset=true;p.add(n);return n;};
    const cuboid=(name:string,size:number[],at:number[],m=metal,p:T.Object3D=this.box)=>{const n=mesh(name,new RoundedBoxGeometry(...size as [number,number,number],2,.003),m,p);n.position.fromArray(at);return n;};
    const cylinder=(name:string,r:number,h:number,at:number[],m=metal,p:T.Object3D=this.box)=>{const n=mesh(name,new T.CylinderGeometry(r,r,h,32),m,p);n.position.fromArray(at);return n;};
    this.box.name='DEADMAN_CABINET';this.box.userData.deadmanControl='box';this.box.position.set(-.29,floor,.309);this.box.scale.setScalar(u(1));model.add(this.box);
    model.updateWorldMatrix(true,true);deck.parent!.attach(this.box);
    cuboid('DEADMAN_BASE',[.38,.014,.26],[0,.007,0],dark);
    cuboid('DEADMAN_BACK',[.36,.38,.009],[0,.197,-.122]);
    for(const x of [-.176,.176])cuboid('DEADMAN_SIDE',[.008,.38,.25],[x,.197,0]);
    for(const y of [.024,.382])cuboid('DEADMAN_SHELF',[.35,.009,.25],[0,y,0]);
    cuboid('DEADMAN_INTERIOR',[.34,.342,.006],[0,.202,-.114],dark);
    for(const x of [-.16,.16])for(const z of [-.10,.10])cylinder('DEADMAN_MOUNT_BOLT',.007,.005,[x,.016,z]);
    this.door.name='DEADMAN_DOOR_HINGE';this.door.position.set(-.18,.20,.13);this.box.add(this.door);
    cuboid('DEADMAN_DOOR_GASKET',[.355,.36,.006],[.18,0,0],black,this.door);
    cuboid('DEADMAN_DOOR',[.36,.37,.009],[.18,0,.007],metal,this.door);
    cuboid('DEADMAN_DOOR_BADGE',[.20,.045,.004],[.18,.11,.014],yellow,this.door);
    const font:Record<string,string[]>={D:['1110','1001','1001','1001','1110'],E:['1111','1000','1110','1000','1111'],A:['0110','1001','1111','1001','1001'],M:['10001','11011','10101','10001','10001'],N:['1001','1101','1011','1001','1001']},letters:T.BufferGeometry[]=[];
    [...'DEADMAN'].forEach((c,i)=>font[c].forEach((row,y)=>[...row].forEach((on,x)=>{if(on==='1')letters.push(new T.PlaneGeometry(.0035,.0035).translate(.097+i*.025+x*.004,.118-y*.004,.0165));})));
    mesh('DEADMAN_LABEL',mergeGeometries(letters)!,black,this.door);letters.forEach(g=>g.dispose());
    cuboid('DEADMAN_DOOR_LATCH',[.024,.065,.015],[.325,0,.019],dark,this.door);
    for(const y of [-.11,.11])cylinder('DEADMAN_HINGE_PIN',.008,.055,[0,y,0],metal,this.door);
    this.coil.name='DEADMAN_STORED_CABLE';this.coil.position.set(-.061,.183,-.025);this.box.add(this.coil);
    const spool=cylinder('DEADMAN_CABLE_CORE',.046,.10,[0,0,0],dark,this.coil);spool.rotation.x=Math.PI/2;
    // Remaining cable stays inside the box; pay-out is measured on the live lead.
    const windings:T.BufferGeometry[]=[];
    for(let layer=0;layer<7;layer++)for(let row=0;row<12;row++)windings.push(new T.TorusGeometry(.050+layer*.009,.0038,6,32).translate(0,0,-.0495+row*.009));
    mesh('DEADMAN_CABLE_WINDING',mergeGeometries(windings)!,yellow,this.coil);windings.forEach(g=>g.dispose());
    this.dock.name='DEADMAN_HANDLE_DOCK';this.dock.position.set(.113,.255,.077);this.box.add(this.dock);
    cuboid('DEADMAN_HANDLE_CLIP',[.053,.024,.045],[.113,.216,.047],black);
    this.handle.name='DEADMAN_HAND_SWITCH';this.handle.userData.deadmanControl='handle';this.handle.userData.normallyOpen=true;this.box.add(this.handle);
    cylinder('DEADMAN_GRIP',.016,.125,[0,0,0],black,this.handle);
    for(const y of [-.07,.07])cylinder('DEADMAN_END_CAP',.022,.018,[0,y,0],yellow,this.handle);
    cylinder('DEADMAN_CABLE_GLAND',.009,.029,[0,-.093,0],dark,this.handle);
    this.lever.name='DEADMAN_SQUEEZE_LEVER';this.lever.position.set(0,.055,.018);this.handle.add(this.lever);
    cuboid('DEADMAN_LEVER_PAD',[.023,.107,.008],[0,-.047,.009],yellow,this.lever);
    this.outlet.name='DEADMAN_CABLE_OUTLET';this.outlet.position.set(.09,.052,.124);this.box.add(this.outlet);
    cuboid('DEADMAN_OUTLET_GROMMET',[.025,.028,.012],[.09,.052,.124],black);
    this.cable=new T.Mesh(new T.BufferGeometry(),yellow);this.cable.name='DEADMAN_DEPLOYED_CABLE';this.cable.userData.sharedAsset=true;model.add(this.cable);
    this.stow();
  }
  setOpen(open:boolean){if(!open&&this.deployed)return false;this.open=open;return true;}
  update(dt:number){this.amount=T.MathUtils.damp(this.amount,this.open?1:0,9,Math.max(0,Math.min(.1,dt)));this.door.rotation.y=-this.amount*Math.PI*.62;this.lever.rotation.x=T.MathUtils.damp(this.lever.rotation.x,this.pressed?.23:0,22,Math.max(0,Math.min(.1,dt)));this.box.userData.refuellingEnabled=this.pressed&&this.deployed;}
  press(on:boolean){this.pressed=on&&this.deployed;this.box.userData.refuellingEnabled=this.pressed;}
  dockPoint(){return this.dock.getWorldPosition(new T.Vector3());}
  normal(){return new T.Vector3(0,0,1).transformDirection(this.box.matrixWorld);}
  approach(){const p=this.dockPoint().addScaledVector(this.normal(),.73).addScaledVector(new T.Vector3(1,0,0).transformDirection(this.box.matrixWorld),-.18);p.y=0;return p;}
  setHandle(point:T.Vector3,rotation:T.Quaternion){this.box.updateWorldMatrix(true,false);this.handle.position.copy(this.box.worldToLocal(point.clone()));this.handle.quaternion.copy(this.box.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));this.handle.updateWorldMatrix(false,true);}
  stow(){this.deployed=false;this.press(false);this.handle.position.copy(this.dock.position);this.handle.quaternion.identity();this.handle.updateWorldMatrix(true,true);this.coil.scale.z=1;this.drawCable();}
  /** Cable follows a floor route, with smooth supported rises at both ends. */
  cableCurve(end:T.Vector3,route:T.Vector3[]=[]){
    const start=this.outlet.getWorldPosition(new T.Vector3()),normal=this.normal();
    const gland=end.clone();
    if(route.length<2||start.distanceTo(end)<1.2){const middle=start.clone().lerp(end,.5);middle.y=Math.max(.018,middle.y-.12);return new T.CatmullRomCurve3([start,middle,gland],false,'centripetal');}
    const points=route.map(p=>new T.Vector3(p.x,.018,p.z)).filter((p,i,a)=>!i||p.distanceTo(a[i-1])>.005);
    const path=new T.CurvePath<T.Vector3>(),first=points[0],last=points.at(-1)!;
    path.add(new T.CubicBezierCurve3(start,start.clone().addScaledVector(normal,.16),first.clone().add(new T.Vector3(0,.22,0)),first));
    for(let i=1;i<points.length;i++)path.add(new T.LineCurve3(points[i-1],points[i]));
    path.add(new T.CubicBezierCurve3(last,last.clone().add(new T.Vector3(0,.22,0)),end.clone().add(new T.Vector3(0,-.22,0)),end));
    return path;
  }
  drawCable(route:T.Vector3[]=[]){
    this.model.updateWorldMatrix(true,true);
    const end=this.handle.localToWorld(new T.Vector3(0,-.107,0));
    const path=this.deployed?this.cableCurve(end,route):new T.CatmullRomCurve3([
      this.coil.localToWorld(new T.Vector3(0,-.07,.05)),this.box.localToWorld(new T.Vector3(.06,.10,.07)),end],false,'centripetal');
    this.cableLength=this.deployed?path.getLength():0;this.coil.scale.z=Math.max(.025,1-this.cableLength/DEADMAN_CABLE_LENGTH);
    const key=path.getPoints(12).map(p=>p.toArray().map(x=>x.toFixed(4)).join(',')).join(';');if(key===this.lastPath)return;
    this.lastPath=key;const count=Math.max(32,Math.min(384,Math.ceil(path.getLength()*18)));
    const g=new T.TubeGeometry(path,count,.004*this.box.getWorldScale(new T.Vector3()).y,6,false).applyMatrix4(this.model.matrixWorld.clone().invert());
    this.cable.geometry.dispose();this.cable.geometry=g;this.cable.userData.lengthMetres=this.cableLength;this.cable.userData.maxLengthMetres=DEADMAN_CABLE_LENGTH;
  }
  dispose(){this.press(false);this.cable.geometry.dispose();this.cable.removeFromParent();this.box.removeFromParent();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());}
}
