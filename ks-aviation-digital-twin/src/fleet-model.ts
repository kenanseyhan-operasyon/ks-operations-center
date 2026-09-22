import * as THREE from 'three';
import { FLEET_SPECS } from './fleet-specs';
import type { Entity } from './scene-data';
export function makeFleetAircraft(o:Entity){
 const s=FLEET_SPECS[o.preset],g=new THREE.Group();g.name=o.name;g.userData.entityId=o.id;g.userData.dimensionSource=s.source;
 const body=new THREE.Group();g.add(body);const L=s.length,W=s.span,H=s.height,piston=s.type==='piston',prop=s.type!=='business',radius=piston?.6:prop?.83:s.id==='GULFSTREAM'?1.3:1.12,cy=piston?1.1:prop?1.7:2.4;
 const mats=new Map<string,THREE.MeshStandardMaterial>();const mat=(c:string)=>{if(!mats.has(c))mats.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.65,side:THREE.DoubleSide}));return mats.get(c)!;};
 const add=(name:string,geo:THREE.BufferGeometry,x:number,y:number,z:number,c=o.color)=>{const m=new THREE.Mesh(geo,mat(c));m.name=name;m.position.set(x,y,z);body.add(m);return m;};
 const box=(name:string,w:number,h:number,l:number,x:number,y:number,z:number,c=o.color)=>add(name,new THREE.BoxGeometry(w,h,l),x,y,z,c);
 // A tapered, longitudinal fuselage with a distinct nose and tail cone.
 const stations=[[-.5,0],[-.46,.45],[-.37,.94],[-.24,1],[.18,1],[.3,.8],[.42,.35],[.5,0]];
 const points=stations.map(([z,r])=>new THREE.Vector2(radius*r,z*L));const fus=add('AIRCRAFT_BODY',new THREE.LatheGeometry(points,24),0,cy,0);fus.rotation.x=Math.PI/2;
 const pane=(name:string,pts:number[][],y:number,c=o.color)=>{const shape=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],-p[1])));const m=add(name,new THREE.ShapeGeometry(shape),0,y,0,c);m.rotation.x=-Math.PI/2;return m;};
 const wingY=piston?cy+radius*.8:cy-radius*.45,rootFront=-L*.12,tipFront=prop?rootFront+L*.015:rootFront+L*.14;
 pane('MAIN_WING',[[-radius,rootFront],[-W/2,tipFront],[-W/2,tipFront+L*.11],[-radius,L*.13],[radius,L*.13],[W/2,tipFront+L*.11],[W/2,tipFront],[radius,rootFront]],wingY);
 const tailY=piston?cy: H*.92;pane('HORIZONTAL_STABILIZER',[[-radius*.25,L*.3],[-W*.19,L*.36],[-W*.19,L*.46],[W*.19,L*.46],[W*.19,L*.36],[radius*.25,L*.3]],tailY);
 const fin=new THREE.Shape();fin.moveTo(L*.21,cy);fin.lineTo(L*.36,H);fin.lineTo(L*.44,H);fin.lineTo(L*.47,cy);const fm=add('VERTICAL_STABILIZER',new THREE.ShapeGeometry(fin),0,0,0,'#367c8b');fm.rotation.y=-Math.PI/2;
 for(const side of [-1,1]){
   const c=add('COCKPIT_WINDOW',new THREE.SphereGeometry(radius*.65,12,8),side*radius*.49,cy+radius*.46,-L*.345,'#254c61');c.scale.set(.42,.52,1.1);
   for(let z=-L*.21;z<L*.23;z+=L/(piston?4:14)){const win=add('CABIN_WINDOW',new THREE.SphereGeometry(radius*.2,10,6),side*radius*.987,cy+radius*.27,z,'#355b6d');win.scale.set(.1,1.35,.85);}
 }
 const rod=(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,c:string)=>{const m=add(name,new THREE.CylinderGeometry(r,r,a.distanceTo(b),10),...a.clone().add(b).multiplyScalar(.5).toArray() as [number,number,number],c);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());};
 const propeller=(x:number,y:number,z:number,r:number,blades:number)=>{for(let i=0;i<blades;i++){const a=i*Math.PI*2/blades,m=box('PROPELLER',r*.16,r,.06,x+Math.sin(a)*r*.48,y+Math.cos(a)*r*.48,z,'#303d42');m.rotation.z=-a;}const hub=add('PROPELLER_HUB',new THREE.ConeGeometry(r*.16,r*.4,14),x,y,z-r*.13,'#cad6d8');hub.rotation.x=-Math.PI/2;};
 if(piston){propeller(0,cy,-L/2,1,2);for(const side of [-1,1])rod('WING_STRUT',new THREE.Vector3(side*radius,cy-radius*.6,-L*.06),new THREE.Vector3(side*W*.29,wingY,L*.015),.035,'#8c9d9e');}
 else for(const side of [-1,1]){const x=side*(prop?W*.15:radius*1.55),y=prop?wingY:cy+radius*.3,z=prop?-L*.09:L*.29,er=prop?.36:radius*.5,el=prop?L*.19:L*.15;const engine=add(side<0?'ENGINE_1':'ENGINE_2',new THREE.CylinderGeometry(er,er*.83,el,20),x,y,z);engine.rotation.x=Math.PI/2;const inlet=add('ENGINE_INTAKE',new THREE.CircleGeometry(er*.8,20),x,y,z-el/2-.01,'#253840');inlet.rotation.y=Math.PI;box('ENGINE_PYLON',Math.abs(x),.12,el*.45,x/2,y,z);if(prop)propeller(x,y,z-el/2-.04,.95,4);}
 const wheelR=piston?.25:prop?.35:.45;
 for(const [x,z] of [[0,-L*.3],[-(piston?1.2:prop?2.615:1.8),L*.08],[(piston?1.2:prop?2.615:1.8),L*.08]]){rod('GEAR_STRUT',new THREE.Vector3(x,wheelR,z),new THREE.Vector3(x*.6,cy-radius*.55,z),.06,'#87969b');const wh=add('LANDING_GEAR_WHEEL',new THREE.CylinderGeometry(wheelR,wheelR,wheelR*.6,16),x,wheelR,z,'#202e34');wh.rotation.z=Math.PI/2;}
 // Keep the published overall envelope exact, while explicitly treating contours as illustrative.
 const bounds=new THREE.Box3().setFromObject(body),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());body.scale.set(W/size.x,H/size.y,L/size.z);body.position.set(-center.x*body.scale.x,-bounds.min.y*body.scale.y,-center.z*body.scale.z);
 return g;
}
