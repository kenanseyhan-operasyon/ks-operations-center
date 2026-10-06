import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';

// The original shell has a ring at X=.515, followed by a long straight section.
// End the lift on that ring so the straight body and its markings stay aligned.
export const tankLift=(x:number)=>.12*(1-THREE.MathUtils.smoothstep(x,.12,.515));
const skinZ=(x:number,y:number,side:number)=>{
  const lift=tankLift(x),originalY=(y-lift*.0515/.3065)/(1-lift/.3065);
  return .155+side*.275*Math.sqrt(Math.max(0,1-((originalY+.10175)/.15325)**2));
};

/** Reuse the model's lettering without stretching its glyphs along the neck. */
export function refitTankMarkings(meshes:THREE.Mesh[],own:(g:THREE.BufferGeometry)=>THREE.BufferGeometry){
  const wrap=(mesh:THREE.Mesh,side:number,place:(v:THREE.Vector3)=>void)=>{
    const flat=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),positions=flat.getAttribute('position');
    for(let i=0;i<positions.count;i++){const v=new THREE.Vector3().fromBufferAttribute(positions,i);place(v);positions.setXYZ(i,v.x,v.y,v.z);}
    // Large decal triangles otherwise cut through the curved shell between corners.
    const g=own(new TessellateModifier(.014,8).modify(flat)),p=g.getAttribute('position'),inverse=mesh.matrixWorld.clone().invert();flat.dispose();
    for(let i=0;i<p.count;i++){
      const v=new THREE.Vector3().fromBufferAttribute(p,i);v.z=skinZ(v.x,v.y,side)+side*v.z;
      v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);
    }
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;
  };
  for(const side of [-1,1]){
    const onSide=meshes.filter(m=>new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).z*side>.155*side);
    const fit=(pattern:RegExp,x:number,y:number,size:number,axis:'x'|'y')=>{
      const parts=onSide.filter(m=>pattern.test(m.name));if(!parts.length)return;
      const bounds=new THREE.Box3();parts.forEach(m=>bounds.union(new THREE.Box3().setFromObject(m,true)));
      const centre=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3()),scale=size/extent[axis];
      for(const mesh of parts){
        wrap(mesh,side,v=>{
          const layer=THREE.MathUtils.clamp((v.z-bounds.min.z)/(extent.z||1),0,1);
          v.x=x+(v.x-centre.x)*scale;v.y=y+(v.y-centre.y)*scale;
          v.z=.0007+.0007*(side>0?layer:1-layer);
        });
      }
    };
    fit(/^Fuel_Hazard/,.145,-.050,.034,'y');
    fit(/^No_Smoking_Fuel/,.16,-.086,.012,'y');
    fit(/^SOCAR_Flame/,side>0?.70:1.29,-.105,.105,'y');
    fit(/^SOCAR_Tank/,side>0?1.075:.925,-.100,.46,'x');
    fit(/^Tank_Jet/,1.015,-.175,.23,'x');
    for(const mesh of onSide.filter(m=>/^Tank_Reflective/.test(m.name)))wrap(mesh,side,v=>{
      v.y=v.y>-.1?-.024+(v.y+.038):v.y+tankLift(v.x)*THREE.MathUtils.clamp((.0515-v.y)/.3065,0,1);v.z=.001;
    });
  }
}

/** Two physical dials share the saved initial fuel volume, in litres. */
export class FuelGauge extends THREE.Group {
  private needle=new THREE.Group();
  constructor(own:(g:THREE.BufferGeometry)=>THREE.BufferGeometry,metal:THREE.Material,face:THREE.Material,ink:THREE.Material,red:THREE.Material){
    super();this.name='R14_FUEL_LEVEL_GAUGE';
    const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=this)=>{const n=new THREE.Mesh(own(g),m);n.name=name;n.userData.sharedAsset=true;parent.add(n);return n;};
    mesh('FUEL_GAUGE_BEZEL',new THREE.CylinderGeometry(.031,.031,.006,48).rotateX(Math.PI/2),metal);
    mesh('FUEL_GAUGE_FACE',new THREE.CylinderGeometry(.027,.027,.0008,48).rotateX(Math.PI/2).translate(0,0,.0035),face);
    const marks:THREE.BufferGeometry[]=[];
    for(let i=0;i<=38;i++){
      const angle=(225-i*270/38)*Math.PI/180,major=i%10===0||i===38,len=major?.0045:.002;
      marks.push(new THREE.BoxGeometry(len,major?.00065:.00035,.0004).translate(.025-len/2,0,.0042).rotateZ(angle));
    }
    // Small vector numerals stay sharp without downloading a font or texture.
    const segments:Record<string,number[]>={'0':[0,1,2,3,4,5],'1':[1,2],'2':[0,1,6,4,3],'3':[0,1,6,2,3],'4':[5,6,1,2],'5':[0,5,6,2,3],'6':[0,5,6,4,3,2],'7':[0,1,2],'8':[0,1,2,3,4,5,6]};
    const bars=[[0,1,1,0],[.5,.5,0,1],[.5,-.5,0,1],[0,-1,1,0],[-.5,-.5,0,1],[-.5,.5,0,1],[0,0,1,0]];
    const number=(text:string,x:number,y:number,h=.005)=>{
      const unit=h/2,advance=unit*1.5;
      [...text].forEach((digit,j)=>{for(const segment of segments[digit]||[]){const [dx,dy,horizontal]=bars[segment];marks.push(new THREE.BoxGeometry(horizontal?unit:unit*.22,horizontal?unit*.22:unit,.0004).translate(x+(j-(text.length-1)/2)*advance+dx*unit,y+dy*unit,.0043));}});
    };
    for(const value of [0,10,20,30,38]){const a=(225-value*270/38)*Math.PI/180;number(String(value),Math.cos(a)*.017,Math.sin(a)*.017);}
    number('1000',0,-.010,.0032);
    // Multiplier × and unit L below the scale.
    for(const angle of [-Math.PI/4,Math.PI/4])marks.push(new THREE.BoxGeometry(.0024,.00035,.0004).rotateZ(angle).translate(-.0058,-.010,.0043));
    marks.push(new THREE.BoxGeometry(.00035,.0027,.0004).translate(.0058,-.010,.0043),new THREE.BoxGeometry(.0016,.00035,.0004).translate(.0064,-.0112,.0043));
    mesh('FUEL_GAUGE_SCALE',mergeGeometries(marks)!,ink);marks.forEach(g=>g.dispose());
    this.needle.name='FUEL_LEVEL_NEEDLE';this.add(this.needle);
    const shape=new THREE.Shape();shape.moveTo(-.004,-.0011);shape.lineTo(.021,0);shape.lineTo(-.004,.0011);shape.closePath();
    mesh('FUEL_GAUGE_POINTER',new THREE.ShapeGeometry(shape).translate(0,0,.005),red,this.needle);
    mesh('FUEL_GAUGE_HUB',new THREE.CylinderGeometry(.002,.002,.001,16).rotateX(Math.PI/2).translate(0,0,.0055),metal);
    this.setLitres(0);
  }
  setLitres(value=0){const litres=Number.isFinite(value)?THREE.MathUtils.clamp(value,0,38000):0;this.userData.fuelLitres=litres;this.needle.rotation.z=(225-270*litres/38000)*Math.PI/180;}
}
