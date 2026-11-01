import * as T from 'three';
import {Builder,type V} from './facility-geometry';
import {inspectionLayout} from './inspection-layout';
import type {Entity} from './scene-data';
export function inspectionStair(b:Builder,o:Entity){
 const {R,w,L,landing,run,lowerZ,upperZ,point}=inspectionLayout(o),rise=o.height,n=Math.max(3,Math.ceil(rise/.18)),white='#e3e7e5',yellow='#dfc64d';
 const deck=(width:number,length:number,y:number,z:number,x=0)=>{const first=b.g.children.length;b.grate(width,length,y,z);for(const node of b.g.children.slice(first))node.position.x+=x;};
 const tread=run/n;
 deck(w+.2,landing+tread,0,lowerZ+tread/2,-.1);
 const inner=R-o.radius+.35,outer=-w/2;deck(inner-outer,landing,rise,upperZ,(inner+outer)/2);
 for(let i=2;i<=n;i++)deck(w,run/n+.025,rise*(i-1)/(n-1),-L/2+landing+(i-.5)*run/n);
 const beam=(a:V,z:V)=>{const d=new T.Vector3(...z).sub(new T.Vector3(...a)),m=b.box(.065,.15,d.length(),new T.Vector3(...a).add(new T.Vector3(...z)).multiplyScalar(.5).toArray() as V,white);m.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),d.normalize());};
 for(const x of [-w/2,w/2])beam([x,-.1,-L/2+landing],[x,rise-.1,L/2-landing]);
 b.rail([[outer,0,-L/2],[outer,0,-L/2+landing],[outer,rise,L/2-landing],[outer,rise,L/2]],yellow);
 b.rail([[w/2,0,-L/2],[w/2,0,-L/2+landing],[w/2,rise,L/2-landing]],yellow);
 b.rail([[outer,0,-L/2],[w/2,0,-L/2]],yellow);
 // The upper landing opens radially onto the roof, not into the outside void.
 b.rail([[outer,rise,L/2],[inner,rise,L/2]],yellow);
 b.rail([[w/2,rise,L/2-landing],[inner,rise,L/2-landing]],yellow);
 for(const [z,y] of [[lowerZ,0],[upperZ,rise]]){beam([R-o.radius,y-.8,z],[outer,y-.12,z]);b.box(.06,.3,.16,[R-o.radius,y-.8,z],white);}
 if(o.facility?.tag==='PHOTO-STAIR-31')for(const node of b.g.children)if(node instanceof T.Mesh){node.updateMatrix();node.geometry.applyMatrix4(node.matrix);node.position.set(0,0,0);node.quaternion.identity();node.scale.set(1,1,1);const p=node.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const v=point(p.getX(i),p.getY(i),p.getZ(i));p.setXYZ(i,...v);}p.needsUpdate=true;node.geometry.computeVertexNormals();}
}
