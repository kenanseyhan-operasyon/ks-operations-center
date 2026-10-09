import * as T from 'three';

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
  private inside=false;private pillars?:T.Mesh;private sightlines:{mesh:T.Mesh;normal:T.BufferGeometry;open:T.BufferGeometry}[]=[];
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
    // Keep the white paint outside and use a dark lining on the cabin-facing side.
    for(const name of ['Low_Short_Cab_Shell','Low_Roof_Cap']){
      const outer=cab.getObjectByName(name) as T.Mesh;if(!outer||Array.isArray(outer.material))continue;
      const paint=outer.material.clone();paint.side=T.FrontSide;this.materials.add(paint);outer.material=paint;
      const lining=dark.clone();lining.side=T.BackSide;this.materials.add(lining);const inner=new T.Mesh(outer.geometry,lining);inner.name='CAB_INNER_'+name;inner.position.copy(outer.position);inner.quaternion.copy(outer.quaternion);inner.scale.copy(outer.scale);inner.userData.sharedAsset=true;outer.parent!.add(inner);
    }
    if(shell){
      // Glass-like corner sections open the A-pillars at eye height from inside.
      // The roof, lower doors and exterior cab keep their original solid shape.
      const corner:Cut={axis:2,min:-.04,max:.35,polygon:[[-.92,-.112],[-.794,-.112],[-.794,.010],[-.92,.010]].map(([x,y])=>new T.Vector2(x,y))};
      const opened=openWindows(shell,[corner],geometry=>{
        this.geometries.add(geometry);const glass=this.glass.clone();glass.opacity=.09;this.materials.add(glass);
        this.pillars=new T.Mesh(geometry,glass);this.pillars.name='CAB_TRANSPARENT_CORNERS';this.pillars.visible=false;this.pillars.userData.sharedAsset=true;
        this.pillars.position.copy(shell.position);this.pillars.quaternion.copy(shell.quaternion);this.pillars.scale.copy(shell.scale);shell.parent!.add(this.pillars);
      });this.geometries.add(opened);
      for(const mesh of [shell,cab.getObjectByName('CAB_INNER_Low_Short_Cab_Shell') as T.Mesh])if(mesh)this.sightlines.push({mesh,normal:mesh.geometry,open:opened});
    }
    const light=new T.MeshBasicMaterial({color:'#d7ece3'}),red=new T.MeshBasicMaterial({color:'#e95f47'});this.materials.add(light);this.materials.add(red);
    const mesh=(name:string,geometry:T.BufferGeometry,mat:T.Material,parent:T.Object3D=this.interior)=>{this.geometries.add(geometry);const m=new T.Mesh(geometry,mat);m.name=name;m.userData.sharedAsset=true;parent.add(m);return m;};
    const box=(name:string,size:number[],p:number[],mat:T.Material=dark,parent:T.Object3D=this.interior)=>{const m=mesh(name,new T.BoxGeometry(size[0],size[1],size[2]),mat,parent);m.position.fromArray(p);return m;};
    box('CAB_FLOOR',[.275,.009,.337],[-.731,-.253,.155],black);
    box('CAB_REAR_LINER',[.012,.276,.330],[-.599,-.11,.155],soft);
    box('DASHBOARD_LOWER',[.082,.048,.327],[-.830,-.159,.155]);
    box('DASHBOARD_TOP',[.069,.012,.327],[-.841,-.128,.155],soft);
    for(const z of [.062,.265]){
      box('SEAT_CUSHION',[.083,.022,.082],[-.694,-.197,z],seat);
      const back=box('SEAT_BACK',[.023,.126,.083],[-.644,-.145,z],seat);back.rotation.z=-.06;
      box('SEAT_HEADREST',[.027,.034,.060],[-.642,-.068,z],dark);
    }
    for(const z of [-.012,.322]){
      box('DOOR_LINER',[.227,.09,.012],[-.733,-.165,z],soft);
      box('DOOR_ARMREST',[.09,.012,.023],[-.720,-.135,z],dark);
      box('INTERIOR_DOOR_HANDLE',[.037,.008,.008],[-.663,-.109,z+(z<0?.01:-.01)],trim);
    }
    for(const z of [.028,.111,.187,.300]){box('DASH_VENT',[.003,.016,.024],[-.788,-.147,z],black);for(let i=0;i<3;i++)box('VENT_SLAT',[.004,.0015,.022],[-.786,-.153+i*.005,z],trim);}
    box('CENTRE_CONSOLE',[.03,.062,.054],[-.804,-.170,.150],black);
    for(let i=0;i<4;i++)box('DASH_SWITCH',[.005,.008,.006],[-.786,-.157,.131+i*.012],trim);
    for(const z of [.230,.270]){const pedal=box('PEDAL',[.020,.005,.014],[-.806,-.234,z],black);pedal.rotation.z=-.35;}
    this.eye.name='DRIVER_EYE';this.eye.position.set(-.688,-.042,.253);this.interior.add(this.eye);
    const wheelTilt=new T.Group();wheelTilt.position.set(-.787,-.126,.253);wheelTilt.rotation.set(0,Math.PI/2,.4);this.interior.add(wheelTilt);wheelTilt.add(this.wheel);this.wheel.name='DRIVER_STEERING_WHEEL';
    mesh('STEERING_RIM',new T.TorusGeometry(.043,.0042,8,48),black,this.wheel);
    mesh('STEERING_HUB',new T.CylinderGeometry(.011,.011,.011,20).rotateX(Math.PI/2),dark,this.wheel);
    for(const a of [0,Math.PI*2/3,Math.PI*4/3]){const spoke=box('STEERING_SPOKE',[.033,.006,.004],[Math.cos(a)*.022,Math.sin(a)*.022,0],trim,this.wheel);spoke.rotation.z=a;}
    const column=mesh('STEERING_COLUMN',new T.CylinderGeometry(.008,.008,.056,12).rotateZ(Math.PI/2),dark);column.position.set(-.814,-.151,.253);column.rotation.z=.4;
    const cluster=new T.Group();cluster.position.set(-.817,-.104,.254);cluster.rotation.y=Math.PI/2;this.interior.add(cluster);
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
      const z=.155+side*.234,eye=new T.Object3D(),target=new T.Object3D();eye.position.set(-.84,-.076,z);target.position.set(1.7,-.235,z+side*.55);this.interior.add(eye,target);
      const surface=mesh(side>0?'LIVE_MIRROR_LEFT':'LIVE_MIRROR_RIGHT',new T.PlaneGeometry(.022,.075),new T.MeshBasicMaterial({color:'#68818c',side:T.DoubleSide}));this.materials.add(surface.material as T.Material);surface.position.set(-.8415,-.085,z);surface.rotation.y=Math.PI/2;
      const uv=surface.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,.5+(1-2*uv.getX(i))*.22);this.mirrors.push({eye,target,surface,side});
    }
    this.update({speed:0,rpm:0,gear:0,steer:0,running:false,night:false});
  }
  setInside(inside:boolean){this.inside=inside;this.glass.opacity=inside?.055:.16;for(const part of this.sightlines)part.mesh.geometry=inside?part.open:part.normal;if(this.pillars)this.pillars.visible=inside;}
  update(state:CabInstruments){
    this.wheel.rotation.z=-state.steer*14;
    if(this.speedNeedle)this.speedNeedle.rotation.z=(225-270*Math.min(1,Math.abs(state.speed)*3.6/40))*Math.PI/180;
    if(this.rpmNeedle)this.rpmNeedle.rotation.z=(225-270*Math.min(1,state.rpm/2000))*Math.PI/180;
  }
  dispose(){this.interior.removeFromParent();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());}
}
