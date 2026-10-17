import * as T from 'three';
import {CAB_REFERENCE as C,cabUnits as u,cabPoint as cp,cabFloor,remapCabPoint,cabLayoutX} from './cab-reference';
import {buildCabAccess} from './cab-geometry';

const layoutPoint=(x:number,y:number,z:number)=>cp(cabLayoutX(x),y,z);

type Vertex=Record<string,number[]>;
type Cut={axis:0|2;min:number;max:number;polygon:T.Vector2[]};
const hull=(points:T.Vector2[])=>{
  const sorted=points.sort((a,b)=>a.x-b.x||a.y-b.y).filter((p,i,a)=>!i||p.distanceTo(a[i-1])>1e-6);
  const cross=(a:T.Vector2,b:T.Vector2,c:T.Vector2)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half=(ps:T.Vector2[])=>{const out:T.Vector2[]=[];for(const p of ps){while(out.length>1&&cross(out.at(-2)!,out.at(-1)!,p)<=0)out.pop();out.push(p);}return out;};
  return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];
};
/** Subtract the actual convex window apertures from the opaque exterior shell.
 * Interpolate every vertex attribute at the cut, leaving the cached GLB intact. */
function openWindows(mesh:T.Mesh,cuts:Cut[],removed?:(geometry:T.BufferGeometry)=>void){
  const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),attributes=Object.entries(source.attributes);
  const inverse=mesh.matrixWorld.clone().invert();
  let triangles:Vertex[][]=[];const panes:Vertex[][]=[];
  for(let i=0;i<source.attributes.position.count;i+=3){
    const tri:Vertex[]=[];
    for(let j=0;j<3;j++){
      const v:Vertex={};for(const [name,a] of attributes)v[name]=Array.from({length:a.itemSize},(_,k)=>a.array[(i+j)*a.itemSize+k]);
      v.position=new T.Vector3().fromArray(v.position).applyMatrix4(mesh.matrixWorld).toArray();tri.push(v);
    }triangles.push(tri);
  }
  const split=(poly:Vertex[],distance:(v:Vertex)=>number)=>{
    const inside:Vertex[]=[],outside:Vertex[]=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b),isIn=da>=0;
      (isIn?inside:outside).push(a);
      if(isIn!==(db>=0)){
        const t=da/(da-db),v:Vertex={};for(const name in a)v[name]=a[name].map((n,k)=>n+(b[name][k]-n)*t);
        inside.push(v);outside.push(v);
      }
    }return {inside,outside};
  };
  const triangulate=(poly:Vertex[])=>poly.slice(1,-1).map((_,i)=>[poly[0],poly[i+1],poly[i+2]]);
  for(const cut of cuts){
    const axes=cut.axis===0?[2,1]:[0,1];
    const planes=[(v:Vertex)=>v.position[cut.axis]-cut.min,(v:Vertex)=>cut.max-v.position[cut.axis],...cut.polygon.map((a,i)=>{
      const b=cut.polygon[(i+1)%cut.polygon.length];
      return (v:Vertex)=>(b.x-a.x)*(v.position[axes[1]]-a.y)-(b.y-a.y)*(v.position[axes[0]]-a.x);
    })];
    const kept:Vertex[][]=[];
    for(const tri of triangles){
      if(planes.some(plane=>tri.every(v=>plane(v)<-1e-9))){kept.push(tri);continue;}
      let remaining=tri;for(const plane of planes){const parts=split(remaining,plane);kept.push(...triangulate(parts.outside));remaining=parts.inside;if(remaining.length<3)break;}
      if(removed&&remaining.length>=3)panes.push(...triangulate(remaining));
    }
    triangles=kept;
  }
  const geometry=(faces:Vertex[][])=>{
    const output=new T.BufferGeometry();
    for(const [name,a] of attributes){const values:number[]=[];for(const tri of faces)for(const v of tri)values.push(...(name==='position'?new T.Vector3().fromArray(v.position).applyMatrix4(inverse).toArray():v[name]));output.setAttribute(name,new T.Float32BufferAttribute(values,a.itemSize));}
    output.computeBoundingBox();output.computeBoundingSphere();return output;
  };
  if(removed)removed(geometry(panes));const output=geometry(triangles);source.dispose();return output;
}

export type CabInstruments={speed:number;rpm:number;gear:number;steer:number;running:boolean;night:boolean};
export type CabMirror={eye:T.Object3D;target:T.Object3D;surface:T.Mesh;side:-1|1};
/** Both refueller series share this cab, in the GLB's native -X-forward frame. */
export class VehicleCab{
  readonly interior=new T.Group();readonly eye=new T.Object3D();readonly mirrors:CabMirror[]=[];
  readonly glass=new T.MeshStandardMaterial({color:'#a4c8d2',transparent:true,opacity:.16,roughness:.18,metalness:.05,side:T.DoubleSide,depthWrite:false});
  readonly wheel=new T.Group();private speedNeedle!:T.Group;private rpmNeedle!:T.Group;
  readonly seat=new T.Object3D();
  readonly doors=new Map<'left'|'right',{hinge:T.Group;amount:number;open:boolean;side:number;handle:T.Object3D}>();
  private inside=false;private pillars?:T.Mesh;private sightlines:{mesh:T.Mesh;normal:T.BufferGeometry;open:T.BufferGeometry}[]=[];
  private windowFrames:{mesh:T.Mesh;normal:T.Material|T.Material[];inside:T.Material|T.Material[]}[]=[];
  get isInside(){return this.inside;}
  private geometries=new Set<T.BufferGeometry>();private materials=new Set<T.Material>();private textures=new Set<T.Texture>();
  constructor(readonly model:T.Object3D){
    this.interior.name='KS_DRIVER_INTERIOR';model.add(this.interior);this.materials.add(this.glass);
    const cab=model.getObjectByName('KS_LOW_CAB_C3');if(!cab)return;
    model.updateWorldMatrix(true,true);const cuts:Cut[]=[];
    cab.traverse(n=>{
      if(!(n instanceof T.Mesh)||! /^(Windshield_Glass|Side_Window_Glass|Front_Quarter_Glass)/.test(n.name))return;
      const p=n.geometry.attributes.position,front=n.name==='Windshield_Glass',axis=front?0:2;
      const vertices=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));
      const polygon=hull(vertices.map(v=>new T.Vector2(front?v.z:v.x,v.y)));
      const centre=polygon.reduce((a,p)=>a.add(p),new T.Vector2()).multiplyScalar(1/polygon.length);
      // Leave a narrow lip behind the existing rubber seal.
      polygon.forEach(p=>p.sub(centre).multiplyScalar(.975).add(centre));
      const depth=vertices.reduce((s,v)=>s+v.getComponent(axis),0)/vertices.length;
      cuts.push({axis,min:depth-.036,max:depth+.036,polygon});n.material=this.glass;n.renderOrder=3;
    });
    const shell=cab.getObjectByName('Low_Short_Cab_Shell') as T.Mesh;
    if(shell){shell.geometry=openWindows(shell,cuts);this.geometries.add(shell.geometry);}
    const material=(color:string,roughness=.85)=>{const m=new T.MeshStandardMaterial({color,roughness});this.materials.add(m);return m;};
    const dark=material('#202b31'),soft=material('#34434a'),trim=material('#6b777c'),black=material('#111a20'),seat=material('#40505a');
    cab.traverse(n=>{if(!(n instanceof T.Mesh)||!/^(Windshield_Rubber_Seal|Front_Quarter_Seal|Side_Window_Seal)/.test(n.name))return;
      const fade=(m:T.Material)=>{const copy=m.clone();copy.transparent=true;copy.opacity=.12;copy.depthWrite=false;this.materials.add(copy);return copy;};
      this.windowFrames.push({mesh:n,normal:n.material,inside:Array.isArray(n.material)?n.material.map(fade):fade(n.material)});
    });
    if(shell)for(const side of [-1,1]){
      const z=cp(0,0,side*C.bodyWidth/2)[2],hinge=new T.Group();hinge.name=side>0?'DRIVER_DOOR_HINGE':'PASSENGER_DOOR_HINGE';hinge.position.set(cp(.07,0,0)[0],cabFloor+u(.7),z);model.add(hinge);model.updateWorldMatrix(true,true);
      const cut:Cut={axis:2,min:z-u(.16),max:z+u(.16),polygon:[[.07,C.floorHeight-.015],[1.55,C.floorHeight-.015],[1.55,C.floorHeight+C.interiorHeight-.07],[.18,C.floorHeight+C.interiorHeight-.07],[.07,C.floorHeight+.72]].map(([x,y])=>{const q=layoutPoint(x,y,0);return new T.Vector2(q[0],q[1]);})};
      const geometry=openWindows(shell,[cut],part=>{
        this.geometries.add(part);const paint=(Array.isArray(shell.material)?shell.material[0]:shell.material).clone();paint.side=T.DoubleSide;this.materials.add(paint);
        const leaf=new T.Mesh(part,paint);leaf.name=side>0?'DRIVER_DOOR_PANEL':'PASSENGER_DOOR_PANEL';leaf.position.copy(shell.position);leaf.quaternion.copy(shell.quaternion);leaf.scale.copy(shell.scale);leaf.userData.sharedAsset=true;shell.parent!.add(leaf);model.updateWorldMatrix(true,true);hinge.attach(leaf);
      });this.geometries.add(geometry);shell.geometry=geometry;
      const existing=[cab.getObjectByName('Door_Left'),cab.getObjectByName('Door_Right')].find(n=>n&&Math.sign(new T.Box3().setFromObject(n).getCenter(new T.Vector3()).z-.155)===side);
      if(existing)hinge.attach(existing);
      const handle=new T.Object3D();handle.name=side>0?'DRIVER_DOOR_HANDLE':'PASSENGER_DOOR_HANDLE';handle.position.set(layoutPoint(1.43,0,0)[0],cabFloor+u(.64),z+side*u(.04));model.add(handle);model.updateWorldMatrix(true,true);hinge.attach(handle);
      this.doors.set(side>0?'left':'right',{hinge,amount:0,open:false,side,handle});
      const labels:T.Object3D[]=[];model.traverse(n=>{if(/^Cab_SOCAR_Wordmark/.test(n.name)&&Math.sign(new T.Box3().setFromObject(n).getCenter(new T.Vector3()).z-.155)===side)labels.push(n);});labels.forEach(n=>hinge.attach(n));
    }
    // A single paint surface avoids coincident black/white copies. Separate
    // interior trim stays physically inset behind the exterior skin.
    for(const name of ['Low_Short_Cab_Shell','Low_Roof_Cap']){
      const outer=cab.getObjectByName(name) as T.Mesh;if(!outer||Array.isArray(outer.material))continue;
      const paint=outer.material.clone();paint.side=T.DoubleSide;this.materials.add(paint);outer.material=paint;
    }
    if(shell){
      // Glass-like corner sections open the A-pillars at eye height from inside.
      // The roof, lower doors and exterior cab keep their original solid shape.
      const corner:Cut={axis:2,min:-.12,max:.43,polygon:[[-.92,-.112],[-.794,-.112],[-.794,.010],[-.92,.010]].map(([x,y])=>{const q=remapCabPoint(x,y,.155);return new T.Vector2(q[0],q[1]);})};
      const opened=openWindows(shell,[corner],geometry=>{
        this.geometries.add(geometry);const glass=this.glass.clone();glass.opacity=.09;this.materials.add(glass);
        this.pillars=new T.Mesh(geometry,glass);this.pillars.name='CAB_TRANSPARENT_CORNERS';this.pillars.visible=false;this.pillars.userData.sharedAsset=true;
        this.pillars.position.copy(shell.position);this.pillars.quaternion.copy(shell.quaternion);this.pillars.scale.copy(shell.scale);shell.parent!.add(this.pillars);
      });this.geometries.add(opened);
      for(const mesh of [shell])if(mesh)this.sightlines.push({mesh,normal:mesh.geometry,open:opened});
      for(const door of this.doors.values()){
        const leaf=door.hinge.getObjectByName(door.side>0?'DRIVER_DOOR_PANEL':'PASSENGER_DOOR_PANEL') as T.Mesh;
        if(leaf){const open=openWindows(leaf,[corner]);this.geometries.add(open);this.sightlines.push({mesh:leaf,normal:leaf.geometry,open});}
      }
    }
    const light=new T.MeshBasicMaterial({color:'#d7ece3'}),red=new T.MeshBasicMaterial({color:'#e95f47'});this.materials.add(light);this.materials.add(red);
    const mesh=(name:string,geometry:T.BufferGeometry,mat:T.Material,parent:T.Object3D=this.interior)=>{this.geometries.add(geometry);const m=new T.Mesh(geometry,mat);m.name=name;m.userData.sharedAsset=true;parent.add(m);return m;};
    const box=(name:string,size:number[],p:number[],mat:T.Material=dark,parent:T.Object3D=this.interior)=>{const m=mesh(name,new T.BoxGeometry(size[0],size[1],size[2]),mat,parent);m.position.fromArray(p);return m;};
    const rod=(name:string,a:number[],b:number[],parent:T.Object3D=this.interior)=>{const start=new T.Vector3(...a),end=new T.Vector3(...b),d=end.clone().sub(start),m=mesh(name,new T.CylinderGeometry(.004,.004,d.length(),12),trim,parent);m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;};
    const mbox=(name:string,size:number[],point:number[],mat:T.Material=dark,parent:T.Object3D=this.interior)=>{
      const dims=[...size],p=layoutPoint(...point as [number,number,number]);
      if(/^(CAB_FLOOR|CAB_HEADLINER|DOOR_LINER)$/.test(name)){
        const a=cabLayoutX(point[0]-size[0]/2),b=cabLayoutX(point[0]+size[0]/2);dims[0]=b-a;p[0]=cp((a+b)/2,0,0)[0];
      }
      return box(name,dims.map(u),p,mat,parent);
    };
    const owner=(g:T.BufferGeometry)=>{this.geometries.add(g);return g;};
    const paint=(Array.isArray(shell.material)?shell.material[0]:shell.material);
    buildCabAccess(model,owner,paint,trim,dark);
    const handle=(name:string,x:number,y0:number,y1:number,z:number,side:number,parent:T.Object3D=this.interior)=>{
      const main=rod(name,cp(x,y0,z),cp(x,y1,z));
      const jamb=name==='CAB_ENTRY_JAMB_GRIP';
      const mounts=[y0,y1].flatMap(y=>{
        const foot=cp(jamb?.045:x,y,jamb?side*1.133:side*1.100);
        const plate=box('CAB_COMPACT_HANDLE_FOOT',[u(.035),u(.055),u(.015)],foot,trim);
        return [rod('CAB_COMPACT_HANDLE_MOUNT',cp(x,y,z),foot),plate];
      });
      model.updateWorldMatrix(true,true);if(parent!==this.interior)for(const part of [main,...mounts])parent.attach(part);
    };
    for(const side of [-1,1]){
      // Compact handhold mounted to the front jamb, not a rail across the cab.
      handle('CAB_ENTRY_JAMB_GRIP',.205,1.67,2.15,side*1.06,side);
      const door=this.doors.get(side>0?'left':'right')!;
      const parts=[mbox('DOOR_LINER',[1.28,.48,.045],[.83,C.floorHeight+.41,side*1.100],soft),
        mbox('DOOR_ARMREST',[.40,.06,.09],[.97,C.floorHeight+.57,side*1.08]),
        mbox('INTERIOR_DOOR_HANDLE',[.16,.035,.035],[1.29,C.floorHeight+.72,side*1.085],trim)];
      // Upper tread cover belongs to the door and leaves with the complete leaf.
      const extension=mbox('DOOR_STEP_COVER',[C.treadWidth+.07,.263,.035],[C.treadX,C.floorHeight-.1315,side*1.15],paint);
      parts.push(extension);model.updateWorldMatrix(true,true);parts.forEach(n=>door.hinge.attach(n));
      // The second grip is on the inner door card and travels with the leaf.
      handle('CAB_ENTRY_DOOR_GRIP',.49,1.51,1.81,side*1.010,side,door.hinge);
    }
    // Remove the original bumper's solid side returns inside the new stairwell.
    const bumper=cab.getObjectByName('Bumper') as T.Mesh;
    if(bumper){const cuts:Cut[]=[-1,1].map(side=>{
      const z0=cp(0,0,side*.83)[2],z1=cp(0,0,side*1.4)[2];
      return {axis:2,min:Math.min(z0,z1),max:Math.max(z0,z1),polygon:[[.03,.27],[.51,.27],[.51,C.floorHeight],[.03,C.floorHeight]].map(([x,y])=>{const q=cp(x,y,0);return new T.Vector2(q[0],q[1]);})};
    });bumper.geometry=owner(openWindows(bumper,cuts));}
    mbox('CAB_FLOOR',[1.60,.035,C.interiorWidth],[.825,C.floorHeight-.0175,0],black);
    mbox('CAB_REAR_LINER',[.04,C.interiorHeight,2],[1.595,C.floorHeight+C.interiorHeight/2,0],soft);
    mbox('CAB_HEADLINER',[1.5,.018,2],[.86,C.floorHeight+C.interiorHeight+.009,0],soft);
    mbox('DASHBOARD_LOWER',[.36,.23,1.96],[.33,C.floorHeight+.52,0]);
    mbox('DASHBOARD_TOP',[.36,.055,1.96],[.33,C.floorHeight+.665,0],soft);
    for(const z of [-.63,.63]){
      mbox('SEAT_CUSHION',[.46,.12,.48],[1.11,C.floorHeight+.40,z],seat);
      const back=mbox('SEAT_BACK',[.11,.61,.48],[1.39,C.floorHeight+.76,z],seat);back.rotation.z=-.06;
      mbox('SEAT_HEADREST',[.13,.18,.34],[1.39,C.floorHeight+1.12,z]);
      mbox('SEAT_SUSPENSION',[.32,.28,.30],[1.11,C.floorHeight+.20,z],black);
    }
    for(const z of [-.83,-.32,.27,.83]){mbox('DASH_VENT',[.018,.08,.13],[.516,C.floorHeight+.52,z],black);for(let i=0;i<3;i++)mbox('VENT_SLAT',[.022,.008,.12],[.52,C.floorHeight+.49+i*.03,z],trim);}
    mbox('CENTRE_CONSOLE',[.10,.30,.29],[.48,C.floorHeight+.46,0],black);
    for(let i=0;i<4;i++)mbox('DASH_SWITCH',[.025,.04,.032],[.54,C.floorHeight+.50,-.10+i*.065],trim);
    for(const z of [.51,.73]){const pedal=mbox('PEDAL',[.12,.025,.08],[.47,C.floorHeight+.07,z],black);pedal.rotation.z=-.35;}
    this.eye.name='DRIVER_EYE';this.eye.position.fromArray(layoutPoint(1.10,C.floorHeight+1.23,.63));this.interior.add(this.eye);
    for(const [i,z] of [.73,.51].entries()){const target=new T.Object3D();target.name='DRIVER_PEDAL_TARGET_'+i;target.position.fromArray(cp(.47,C.floorHeight+.085,z));this.interior.add(target);}
    this.seat.name='DRIVER_SEAT';this.seat.position.fromArray(layoutPoint(1.09,C.floorHeight+.53,.63));this.interior.add(this.seat);
    const wheelTilt=new T.Group();wheelTilt.position.fromArray(layoutPoint(.63,C.floorHeight+.82,.63));wheelTilt.rotation.set(0,Math.PI/2,.4);this.interior.add(wheelTilt);wheelTilt.add(this.wheel);this.wheel.name='DRIVER_STEERING_WHEEL';
    mesh('STEERING_RIM',new T.TorusGeometry(u(C.steeringDiameter/2)-u(.012),u(.012),10,48),black,this.wheel);
    mesh('STEERING_HUB',new T.CylinderGeometry(.011,.011,.011,20).rotateX(Math.PI/2),dark,this.wheel);
    for(const a of [0,Math.PI*2/3,Math.PI*4/3]){const spoke=box('STEERING_SPOKE',[.033,.006,.004],[Math.cos(a)*.022,Math.sin(a)*.022,0],trim,this.wheel);spoke.rotation.z=a;}
    const column=mesh('STEERING_COLUMN',new T.CylinderGeometry(.008,.008,.056,12).rotateZ(Math.PI/2),dark);column.position.fromArray(cp(.48,C.floorHeight+.64,.63));column.rotation.z=.4;
    const cluster=new T.Group();cluster.position.fromArray(cp(.44,C.floorHeight+.78,.63));cluster.rotation.y=Math.PI/2;this.interior.add(cluster);
    const dial=(x:number,caption:string,max:number)=>{
      const group=new T.Group();group.position.x=x;cluster.add(group);
      mesh(caption+'_DIAL',new T.CircleGeometry(.024,40),black,group);
      mesh('DIAL_BEZEL',new T.TorusGeometry(.024,.001,6,40),trim,group);
      for(let i=0;i<=10;i++){const a=(225-i*27)*Math.PI/180,tick=box('DIAL_TICK',[.003,.0008,.0004],[Math.cos(a)*.019,Math.sin(a)*.019,.0005],light,group);tick.rotation.z=a;}
      if(typeof document!=='undefined'){
        const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d');
        if(c){c.clearRect(0,0,256,256);c.fillStyle='#d2e7df';c.font='20px sans-serif';c.textAlign='center';c.textBaseline='middle';for(let i=0;i<=5;i++){const a=(225-i*54)*Math.PI/180;c.fillText(String(Math.round(max*i/5)),128+Math.cos(a)*72,128-Math.sin(a)*72);}c.font='16px sans-serif';c.fillText(caption,128,178);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;this.textures.add(texture);const mat=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});this.materials.add(mat);const labels=mesh('DIAL_NUMBERS',new T.PlaneGeometry(.048,.048),mat,group);labels.position.z=.0008;}
      }
      const needle=new T.Group();needle.position.z=.0012;group.add(needle);box('DIAL_NEEDLE',[.016,.0015,.0008],[.0065,0,0],red,needle);return needle;
    };
    this.speedNeedle=dial(-.027,'km/h',40);this.rpmNeedle=dial(.027,'rpm',2000);
    for(const side of [-1,1] as const){
      // Cab mirror names use the source model's convention; native +Z is the driver's left.
      const z=remapCabPoint(-.84,-.076,.155+side*.234)[2],eye=new T.Object3D(),target=new T.Object3D();eye.position.fromArray(remapCabPoint(-.84,-.076,.155+side*.234));target.position.set(1.7,-.235,z+side*.55);this.interior.add(eye,target);
      const surface=mesh(side>0?'LIVE_MIRROR_LEFT':'LIVE_MIRROR_RIGHT',new T.PlaneGeometry(.022,.075),new T.MeshBasicMaterial({color:'#68818c',side:T.DoubleSide}));this.materials.add(surface.material as T.Material);surface.position.fromArray(remapCabPoint(-.8415,-.085,.155+side*.234));surface.rotation.y=Math.PI/2;
      const uv=surface.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,.5+(1-2*uv.getX(i))*.22);this.mirrors.push({eye,target,surface,side});
    }
    this.update({speed:0,rpm:0,gear:0,steer:0,running:false,night:false});
  }
  setInside(inside:boolean){this.inside=inside;this.glass.opacity=inside?.055:.16;for(const part of this.sightlines)part.mesh.geometry=inside?part.open:part.normal;for(const part of this.windowFrames)part.mesh.material=inside?part.inside:part.normal;if(this.pillars)this.pillars.visible=inside;}
  setDoor(side:'left'|'right',open:boolean){const door=this.doors.get(side);if(door)door.open=open;}
  doorAmount(side:'left'|'right'='left'){return this.doors.get(side)?.amount??0;}
  get doorsClosed(){return [...this.doors.values()].every(d=>!d.open&&d.amount<.001);}
  updateDoors(dt:number){for(const d of this.doors.values()){
    d.amount=T.MathUtils.clamp(d.amount+(d.open?1:-1)*Math.max(0,Math.min(.1,dt))/.85,0,1);
    const t=d.amount*d.amount*(3-2*d.amount);d.hinge.rotation.y=-d.side*t*Math.PI/2;
  }this.model.updateWorldMatrix(true,true);}
  update(state:CabInstruments){
    this.wheel.rotation.z=-state.steer*14;
    if(this.speedNeedle)this.speedNeedle.rotation.z=(225-270*Math.min(1,Math.abs(state.speed)*3.6/40))*Math.PI/180;
    if(this.rpmNeedle)this.rpmNeedle.rotation.z=(225-270*Math.min(1,state.rpm/2000))*Math.PI/180;
  }
  dispose(){this.interior.removeFromParent();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());}
}
