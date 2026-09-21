import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { AIRCRAFT_SPECS, pointLocal, SERVICE_COLORS, type AircraftSpec } from './aircraft-specs';
import type { Entity } from './scene-data';
const white='#e5ecef',dark='#25323a';
export function makeAircraft(o:Entity,s:AircraftSpec=AIRCRAFT_SPECS[o.preset]){
  const root=new THREE.Group();root.userData.entityId=o.id;root.userData.aircraftSpec=s.id;root.name=o.name;
  const mats=new Map<string,THREE.MeshStandardMaterial>();
  const mat=(color:string)=>{if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.65,metalness:color==='#92a0aa'?.55:.05}));return mats.get(color)!;};
  const part=(name:string)=>{const g=new THREE.Group();g.name=name;root.add(g);return g;};
  const mesh=(g:THREE.Group,geo:THREE.BufferGeometry,x:number,y:number,z:number,c=white)=>{const m=new THREE.Mesh(geo,mat(c));m.position.set(x,y,z);g.add(m);return m;};
  const box=(g:THREE.Group,w:number,h:number,l:number,x:number,y:number,z:number,c=white)=>mesh(g,new THREE.BoxGeometry(w,h,l),x,y,z,c);
  const cylinder=(g:THREE.Group,r:number,len:number,x:number,y:number,z:number,c:string)=>mesh(g,new THREE.CylinderGeometry(r,r,len,24),x,y,z,c);
  const aft=(m:number)=>m-s.length/2;
  const body=part('AIRCRAFT_BODY'),positions:number[]=[],indices:number[]=[];
  // Elliptical rings preserve the published overall length and cross-section.
  const rings=[[0,.006,-.15],[.45,.28,-.15],[1.3,.55,-.1],[2.6,.83,0],[4.5,.99,0],[6,1,0],[s.length*.7,1,0],[s.length*.8,.89,.1],[s.length*.88,.6,.35],[s.length*.96,.26,.7],[s.length,.007,.85]];
  const skinX=(station:number,y:number)=>{const i=Math.max(0,rings.findIndex((r,j)=>j<rings.length-1&&station>=r[0]&&station<=rings[j+1][0]));const A=rings[i],B=rings[i+1],t=THREE.MathUtils.clamp((station-A[0])/(B[0]-A[0]),0,1),r=THREE.MathUtils.lerp(A[1],B[1],t),cy=s.bodyY+THREE.MathUtils.lerp(A[2],B[2],t);return s.fuselageWidth/2*r*Math.sqrt(Math.max(0,1-((y-cy)/(s.fuselageHeight/2*r))**2));};
  const segments=40;
  for(const [station,r,y] of rings)for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2;positions.push(Math.cos(a)*s.fuselageWidth/2*r,s.bodyY+y+Math.sin(a)*s.fuselageHeight/2*r,aft(station));}
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(body,geo,0,0,0,o.color);
  box(body,s.fuselageWidth*.9,.55,s.length*.23,0,s.bodyY-s.fuselageHeight/2+.2,aft(s.length*.45),'#c6d0d6');
  for(const side of [-1,1]){
    const cockpit=mesh(body,new THREE.SphereGeometry(1,12,8),side*.67,s.bodyY+.57,aft(2.15),'#234856');cockpit.scale.set(.55,.39,.85);
    for(let station=6.1;station<s.length*.78;station+=.56){const win=mesh(body,new THREE.SphereGeometry(1,8,6),side*(skinX(station,s.bodyY+.70)+.015),s.bodyY+.70,aft(station),'#3b6275');win.scale.set(.045,.145,.102);}
  }
  const wingSection=(g:THREE.Group,side:number,sections:number[][],color:string)=>{
    const v:number[]=[],ix:number[]=[];
    for(const [x,le,te,y,t] of sections)v.push(side*x,y-t/2,aft(le),side*x,y+t/2,aft(le+.13*(te-le)),side*x,y+t*.22,aft(te),side*x,y-t*.22,aft(te));
    for(let i=0;i<sections.length-1;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;ix.push(a,c,b,b,c,d);}
    const n=(sections.length-1)*4;ix.push(0,1,2,0,2,3,n,n+2,n+1,n,n+3,n+2);
    const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geom.setIndex(ix);geom.computeVertexNormals();const m=mesh(g,geom,0,0,0,color);m.material=mat(color);m.material.side=THREE.DoubleSide;
  };
  for(const side of [-1,1]){
    const wing=part(side<0?'LEFT_WING':'RIGHT_WING'),midX=s.id.startsWith('A320')?9.83:8,midY=s.id.startsWith('A320')?3.84:3.08;
    wingSection(wing,side,[[s.fuselageWidth*.39,s.wingRootLE,s.wingRootTE,s.wingRootY,.64],[midX,s.id.startsWith('A320')?17.4:18.8,s.id.startsWith('A320')?20.8:22.0,midY,s.id.startsWith('A320')?.38:.36],[s.span/2-1.61,s.wingTipLE-1.64,s.wingTipTE-1.3,s.wingTipY,.1],[s.span/2,s.wingTipLE,s.wingTipTE,s.wingTipY+2.43,.065]],'#c7d0d5');
    const tail=part(side<0?'LEFT_TAILPLANE':'RIGHT_TAILPLANE');wingSection(tail,side,[[.7,s.length*.8,s.length*.97,s.bodyY+1.38,.28],[s.tailSpan/2,s.length*.92,s.length*.977,s.bodyY+1.45,.07]],'#cbd4d9');
    const engine=part(side<0?'ENGINE_1':'ENGINE_2');
    const nacelle=cylinder(engine,s.engineRadius,s.engineLength,side*s.engineX,s.engineY,aft(s.engineAft+s.engineLength/2),'#e1e6e8');nacelle.rotation.x=Math.PI/2;
    if(s.id.startsWith('B737')){nacelle.scale.z=.98;}
    const inlet=cylinder(engine,s.engineRadius*.86,.035,side*s.engineX,s.engineY,aft(s.engineAft)-.005,'#25343d');inlet.rotation.x=Math.PI/2;
    const rim=mesh(engine,new THREE.TorusGeometry(s.engineRadius*.91,s.engineRadius*.07,8,32),side*s.engineX,s.engineY,aft(s.engineAft)-.035,'#92a0aa');
    const cone=mesh(engine,new THREE.ConeGeometry(s.engineRadius*.23,.4,16),side*s.engineX,s.engineY,aft(s.engineAft+.05),'#768b94');cone.rotation.x=-Math.PI/2;
    for(let i=0;i<18;i++){const a=i*Math.PI/9;const blade=box(engine,.035,.6,.025,side*s.engineX+Math.cos(a)*s.engineRadius*.49,s.engineY+Math.sin(a)*s.engineRadius*.49,aft(s.engineAft)+.01,'#6c7b84');blade.rotation.z=a-.45;}
    box(engine,.38,1.6,s.engineLength*.7,side*s.engineX,s.engineY+s.engineRadius+.6,aft(s.engineAft+s.engineLength*.6),'#a6b1b7');
  }
  const fin=part('VERTICAL_TAIL'),fv=[0,s.bodyY+.7,aft(s.length*.75),0,s.height,aft(s.length*.944),0,s.height,aft(s.length*.965),0,s.bodyY+.8,aft(s.length*.98)];
  const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(fv,3));fg.setIndex([0,1,2,0,2,3]);fg.computeVertexNormals();const fm=mesh(fin,fg,0,0,0,'#276475');(fm.material as THREE.Material).side=THREE.DoubleSide;
  const gears=part('LANDING_GEAR');
  for(const [x,station,r] of [[0,s.noseGear,.38],[-s.gearTrack/2,s.mainGear,.56],[s.gearTrack/2,s.mainGear,.56]]){
    cylinder(gears,.09,1.3,x,r+1, aft(station),'#92a0aa');box(gears,.18,.35,.7,x,1.05,aft(station),'#b5c0c5');
    for(const offset of [-.22,.22]){const tyre=cylinder(gears,r,.26,x+offset,r,aft(station),dark);tyre.rotation.z=Math.PI/2;const hub=cylinder(gears,r*.5,.275,x+offset,r,aft(station),'#98a6ab');hub.rotation.z=Math.PI/2;}
  }
  // Persistent model-space anchors are independent of rendered meshes.
  const anchors=part('SERVICE_ANCHORS');
  for(const p of s.points){
    if(p.optional||p.quality==='pending')continue;
    const anchor=new THREE.Object3D();anchor.name=p.id;anchor.position.fromArray(pointLocal(s,p));anchor.userData={servicePoint:p.id,quality:p.quality};anchors.add(anchor);
    const surface=part(p.id+'_HOUSING');const [x,y,z]=pointLocal(s,p);
    if(p.id==='REFUEL_PANEL'){const pivot=new THREE.Group();pivot.name=p.id+'_COVER';pivot.position.set(x,y+.16,z);pivot.userData.hinge=true;surface.add(pivot);box(pivot,.025,.32,.52,0,-.16,0,'#758e98');
    }else if(p.door){
      const w=p.door.width,h=p.door.height,side=x<0?-1:1;
      // Door outlines and a movable cover; their kinematics are schematic.
      const hingeX=side*(skinX(p.aft,y+h)+.025),pivot=new THREE.Group();pivot.name=p.id+'_COVER';pivot.position.set(hingeX,y+h,z);surface.add(pivot);pivot.userData.hinge=true;
      const points:number[]=[],ix:number[]=[],rows=10,cols=4;
      for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){const yy=y+h*row/rows,zz=z-w/2+w*col/cols,xx=side*(skinX(zz+s.length/2,yy)+.025);points.push(xx-hingeX,yy-y-h,zz-z);}
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col,b=a+cols+1;ix.push(a,b,a+1,b,b+1,a+1);}
      const doorGeo=new THREE.BufferGeometry();doorGeo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));doorGeo.setIndex(ix);doorGeo.computeVertexNormals();
      const cover=mesh(pivot,doorGeo,0,0,0,p.id==='REFUEL_PANEL'?'#758e98':'#c2cfd5');cover.material.side=THREE.DoubleSide;
      const handleY=y+h*.45;box(pivot,.035,.07,.19,side*(skinX(p.aft+w*.28,handleY)+.06)-hingeX,-h*.55,w*.28,'#b89648');
    }else{
      const fitting=mesh(surface,new THREE.TorusGeometry(p.kind==='fuel'?.065:.047,.012,7,18),x,y,z,'#a8b5bd');
      if(p.kind==='fuel')fitting.rotation.x=Math.PI/2;
      else if(p.kind==='grounding'){const stud=cylinder(surface,.025,.08,x,y,z,'#c4ba84');stud.rotation.z=Math.PI/2;}
      else fitting.rotation.y=Math.PI/2;
    }
  }
  // Static pieces sharing a material are merged per named module.
  for(const g of [...root.children] as THREE.Group[]){
    const buckets=new Map<THREE.Material,THREE.Mesh[]>();
    for(const child of [...g.children])if(child instanceof THREE.Mesh){const m=child.material as THREE.Material;if(!buckets.has(m))buckets.set(m,[]);buckets.get(m)!.push(child);}
    for(const [material,items] of buckets){if(items.length<2)continue;const geometries=items.map(m=>{m.updateMatrix();const geo=m.geometry.clone().applyMatrix4(m.matrix);return geo.index?geo.toNonIndexed():geo;});const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!merged)continue;items.forEach(m=>{g.remove(m);m.geometry.dispose();});const m=new THREE.Mesh(merged,material);g.add(m);}
  }
  return root;
}
export function setAircraftDoor(root:THREE.Object3D,pointId:string,open:boolean){const door=root.getObjectByName(pointId+'_COVER');if(!door)return false;door.rotation.z=open?(door.position.x<0?-1:1)*Math.PI/2:0;door.userData.open=open;return true;}
export function addTankZones(spec:AircraftSpec){
  const g=new THREE.Group();g.name='TANK_REGIONS';
  for(const [name,x,z,w,l] of [['LEFT_WING_TANK',-6.3,.8,6.6,2.8],['RIGHT_WING_TANK',6.3,.8,6.6,2.8],['CENTER_TANK',0,-.4,3.2,3.2]] as const){const m=new THREE.Mesh(new THREE.BoxGeometry(w,.48,l),new THREE.MeshBasicMaterial({color:x===0?'#9dc3ff':'#65d9da',transparent:true,opacity:.22,depthWrite:false}));m.name=name;m.position.set(x,spec.wingRootY+.8,z);g.add(m);}
  g.userData.note='Schematic tank regions, not tank boundaries or usable capacity volumes.';return g;
}
