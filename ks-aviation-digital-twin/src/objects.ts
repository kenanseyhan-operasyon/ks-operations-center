import * as THREE from 'three';
import { FLEET_SPECS } from './fleet-specs';
import { makeFleetAircraft } from './fleet-model';
import { GSE_SPECS } from './gse-specs';
import { makeGSE } from './gse-model';
import type { Entity } from './scene-data';
import { AIRCRAFT_SPECS } from './aircraft-specs';
import { makeAircraft } from './aircraft-model';
export function makeObject(o: Entity) {
  if(o.kind==='aircraft'&&FLEET_SPECS[o.preset]){const g=makeFleetAircraft(o);applyTransform(g,o);return g;}
  if(GSE_SPECS[o.preset]){const g=makeGSE(o);applyTransform(g,o);return g;}
  if(o.kind==='aircraft'&&AIRCRAFT_SPECS[o.preset]){const g=makeAircraft(o);applyTransform(g,o);return g;}
  const g = new THREE.Group(); g.name=o.name; g.userData.entityId=o.id;
  const mats=new Map<string,THREE.MeshStandardMaterial>();
  const mat=(color=o.color)=>{if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.8}));return mats.get(color)!;};
  const mesh=(geo:THREE.BufferGeometry,x:number,y:number,z:number,c=o.color)=>{const m=new THREE.Mesh(geo,mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
  const box=(w:number,h:number,l:number,x=0,y=h/2,z=0,c=o.color)=>mesh(new THREE.BoxGeometry(w,h,l),x,y,z,c);
  const cyl=(r:number,h:number,x=0,y=h/2,z=0,c=o.color,top=r)=>mesh(new THREE.CylinderGeometry(top,r,h,24),x,y,z,c);
  const sphere=(r:number,x:number,y:number,z:number,c=o.color)=>mesh(new THREE.SphereGeometry(r,14,10),x,y,z,c);
  const W=o.width,L=o.length,H=o.height;
  if(o.kind==='ground' && o.points?.length){
    const shape=new THREE.Shape(o.points.map(([x,z])=>new THREE.Vector2(x,-z)));
    const m=mesh(new THREE.ShapeGeometry(shape),0,.018,0);m.rotation.x=-Math.PI/2;m.castShadow=false;
    (m.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;
  } else if(o.kind==='wall' && o.points?.length){
    for(let i=1;i<o.points.length;i++){
      const a=o.points[i-1],b=o.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      if(len<.01)continue;
      const seg=new THREE.Group();seg.position.set((a[0]+b[0])/2,0,(a[1]+b[1])/2);seg.rotation.y=Math.atan2(dx,dz);g.add(seg);
      const add=(w:number,h:number,l:number,x:number,y:number,z:number,c=o.color)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),mat(c));m.position.set(x,y,z);m.castShadow=true;seg.add(m);};
      if(o.wallStyle==='fence'||o.wallStyle==='gate'){
        add(.16,.18,len,0,.09,0,'#9da7a5');
        const count=Math.ceil(len/(o.wallStyle==='gate'?1.1:2.5));
        for(let j=0;j<=count;j++)add(.065,H,.065,0,H/2,-len/2+len*j/count);
        for(const y of [.3,H*.5,H*.94])add(.045,.035,len,0,y,0);
        // Fine transparent mesh panels keep long fence runs inexpensive.
        const m=new THREE.Mesh(new THREE.PlaneGeometry(len,H-.2),new THREE.MeshStandardMaterial({color:o.color,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false}));
        m.rotation.y=Math.PI/2;m.position.y=H/2;seg.add(m);
      } else add(Math.max(.1,o.thickness),H,len,0,H/2,0);
    }
  } else if(o.kind==='tank'){
    cyl(o.radius+.25,.18,0,.09,0,'#b8b5ac');cyl(o.radius,H,0,H/2+.18,0);cyl(o.radius*.99,.14,0,H+.2,0,'#e7ebeb');
    cyl(.45,.3,0,H+.35,0,'#828d90');
    for(const x of [-.35,.35])box(.065,H,.065,x,H/2,o.radius+.13,'#7a898b');
    for(let y=.3;y<H;y+=.42)box(.76,.045,.05,0,y,o.radius+.13,'#7a898b');
  } else if(o.kind==='tree'){
    cyl(W*.07,H*.55,0,H*.275,0,'#755037');
    if(o.preset==='CYPRESS')cyl(W*.43,H*.85,0,H*.56,0,o.color,.04);
    else{const m=sphere(W*.5,0,H*.68,0);m.scale.y=H*.38/(W*.5);}
  } else if(o.kind==='vehicle'){
    if(o.preset==='R14'){
      const m=box(W,H,L,0,H/2);m.material=new THREE.MeshStandardMaterial({color:'#b7ff3c',wireframe:true,transparent:true,opacity:.22});g.userData.modelPending=true;
    }else{
      box(W*.88,.35,L*.95,0,.75,0,'#344347');box(W,H*.58,L*.19,0,H*.45,-L*.36);
      box(W*.88,H*.22,.05,0,H*.62,-L*.46,'#365967');
      for(const side of [-1,1])box(.04,H*.22,L*.15,side*W*.506,H*.64,-L*.36,'#365967');
      if(o.preset!=='HYDRANT'){
        const tank=cyl(W*.48,L*.67,0,H*.63,L*.13);tank.rotation.x=Math.PI/2;tank.scale.z=.94;
        box(W*.95,.12,L*.56,0,1.2,L*.12,'#4f6a6e');
      }else{box(W*.84,.5,L*.5,0,1.7,L*.13);for(const z of [-.4,.9])cyl(.45,1.2,0,1.4,z,'#a3b1b1');}
      for(const z of [-L*.32,L*.28,...(L>11?[L*.14]:[])])for(const side of [-1,1]){
        const w=cyl(.51,.24,side*(W*.48),.54,z,'#232e32');w.rotation.z=Math.PI/2;
        const hub=cyl(.25,.27,side*(W*.49),.54,z,'#a1b0b5');hub.rotation.z=Math.PI/2;
      }
      for(const x of [-W*.36,W*.36]){box(.3,.2,.05,x,.82,-L*.465,'#fff6c4');cyl(.1,.14,x,H*.78,-L*.36,'#ffae2b');}
    }
  } else if(o.kind==='aircraft'){
    const r=W*.055,bodyY=H*.32;
    const body=mesh(new THREE.CapsuleGeometry(r,Math.max(.5,L-2*r),6,16),0,bodyY,0);body.rotation.x=Math.PI/2;
    const cockpit=sphere(r*.75,0,bodyY+r*.25,-L*.445,'#365562');cockpit.scale.set(1,.65,1.1);
    const wing=(pts:number[][],y:number)=>{const shape=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],-p[1])));const m=mesh(new THREE.ShapeGeometry(shape),0,y,0);m.rotation.x=-Math.PI/2;const mm=mat().clone();mm.side=THREE.DoubleSide;m.material=mm;};
    wing([[-r,-L*.17],[-W*.5,L*.08],[-W*.49,L*.14],[-r,L*.14],[r,L*.14],[W*.49,L*.14],[W*.5,L*.08],[r,-L*.17]],bodyY-.25);
    wing([[-r,L*.3],[-W*.2,L*.42],[-W*.19,L*.47],[W*.19,L*.47],[W*.2,L*.42],[r,L*.3]],bodyY+.8);
    const fin=new THREE.Shape();fin.moveTo(L*.22,bodyY);fin.lineTo(L*.4,H);fin.lineTo(L*.46,H);fin.lineTo(L*.48,bodyY);
    const fm=mesh(new THREE.ShapeGeometry(fin),0,0,0,'#337985');fm.rotation.y=-Math.PI/2;(fm.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;
    for(const side of [-1,1]){const e=cyl(r*.65,L*.1,side*W*.19,bodyY-r,L*.01,'#abb7ba');e.rotation.x=Math.PI/2;const inlet=cyl(r*.5,.04,side*W*.19,bodyY-r,-L*.04,'#243239');inlet.rotation.x=Math.PI/2;}
    for(const [x,z] of [[0,-L*.31],[-r,L*.08],[r,L*.08]]){cyl(.13,bodyY, x,bodyY/2,z,'#636f76');const w=cyl(.55,.5,x,.55,z,'#253138');w.rotation.z=Math.PI/2;}
  } else if(o.flag || o.preset.startsWith('FLAG_')){
    cyl(.065,H,0,H/2,0,'#b8c4c7');
    const flag=o.flag||o.preset.slice(5);const flagMat=new THREE.MeshStandardMaterial({color:flag==='TR'?'#e52e39':'#ffffff',side:THREE.DoubleSide});
    if(typeof document!=='undefined'){
      const c=document.createElement('canvas');c.width=384;c.height=256;const ctx=c.getContext('2d')!;
      ctx.fillStyle=flag==='TR'?'#e30a17':'#ffffff';ctx.fillRect(0,0,384,256);
      if(flag==='AZ'){['#00a4dc','#ed2939','#3f9c35'].forEach((v,i)=>{ctx.fillStyle=v;ctx.fillRect(0,i*256/3,384,256/3);});}
      if(flag==='TR'||flag==='AZ'){
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(150,128,flag==='TR'?57:35,0,Math.PI*2);ctx.fill();ctx.fillStyle=flag==='TR'?'#e30a17':'#ed2939';ctx.beginPath();ctx.arc(165,125,flag==='TR'?46:28,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();const tips=flag==='TR'?5:8;for(let j=0;j<tips*2;j++){const a=-Math.PI/2+j*Math.PI/tips,r=j%2?12:29;const x=222+Math.cos(a)*r,y=128+Math.sin(a)*r;j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();
      }else{ctx.fillStyle='#173c4a';ctx.font='bold 60px sans-serif';ctx.fillText('SOCAR',70,155);}
      const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;flagMat.map=tex;flagMat.color.set('#fff');
    }
    const f=new THREE.Mesh(new THREE.PlaneGeometry(2.7,1.8),flagMat);f.position.set(1.4,H-1.1,0);g.add(f);
  } else if(o.preset==='CANOPY'){
    for(const x of [-W*.47,W*.47])for(const z of [-L*.47,L*.47])box(.13,H,.13,x,H/2,z);
    box(W,.17,L,0,H,0);box(W,.14,L,0,H+.1,0,'#e9eded');
  } else if(o.preset==='PUMP'||o.preset==='MANIFOLD'){
    box(W,.15,L,0,.075,0,'#66767a');const f=cyl(W*.42,L*.74,0,H*.57,0);f.rotation.x=Math.PI/2;
    for(const z of [-L*.25,L*.25]){box(W*.65,H*.4,.15,0,H*.2,z,'#788d91');cyl(.09,H, W*.43,H/2,z,'#477c85');}
  } else if(o.preset==='FIRE_EXT'){
    cyl(.2,H*.8,0,H*.4,0,'#df3d2d');box(.3,.12,.22,0,H*.9,0,'#26393e');
  } else if(o.preset.includes('LIGHT')||o.preset.includes('POLE')){
    cyl(.085,H,0,H/2,0,'#b2c4c8');box(1.2,.15,.28,0,H,0,'#e3e7d5');
    if(o.preset.includes('CAM'))box(.25,.16,.6,.3,H*.85,.2,'#e3e7d5');
  } else {
    box(W,H,L);box(W*1.04,.2,L*1.04,0,H+.1,0,'#6a777b');
    for(let x=-W*.38;x<=W*.39;x+=Math.max(1.9,W/5))for(const z of [-L*.505,L*.505])box(Math.min(1.2,W*.15),H*.3,.07,x,H*.48,z,'#385763');
    for(let z=-L*.35;z<=L*.36;z+=Math.max(2.2,L/5))for(const x of [-W*.505,W*.505])box(.07,H*.3,1.1,x,H*.48,z,'#385763');
    if((o.doorSide==='short')===(L>=W))box(Math.min(1.5,W*.2),2.3,.12,0,1.15,-L*.51,'#364e57');else box(.12,2.3,1.5,W*.51,1.15,0,'#364e57');
    for(const x of [-W*.18,W*.18])box(1.1,.6,.85,x,H+.4,0,'#a0aaaa');
  }
  const bounds=new THREE.Box3().setFromObject(g);if(Number.isFinite(bounds.min.y)&&bounds.min.y<0)g.children.forEach(child=>child.position.y-=bounds.min.y);
  applyTransform(g,o);return g;
}
export function applyTransform(g:THREE.Object3D,o:Entity){g.position.fromArray(o.position);g.rotation.y=-THREE.MathUtils.degToRad(o.heading);g.scale.setScalar(o.scale);g.name=o.name;}
export function disposeObject(g:THREE.Object3D){g.traverse(n=>{if(n instanceof THREE.Mesh && !n.userData.sharedAsset){n.geometry.dispose();const mats=Array.isArray(n.material)?n.material:[n.material];mats.forEach(m=>{if(m instanceof THREE.MeshStandardMaterial)m.map?.dispose();m.dispose();});}});}
