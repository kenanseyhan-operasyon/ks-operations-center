import * as T from 'three';
import {cabPoint as cp} from './cab-reference';

/** A triangular prism: triangle in the front Y/Z view, rectangle in the side X/Y view. */
export function cornerIndicatorGeometry(side:number,lens:boolean){
 const front=lens?-.034:-.031,back=lens?.057:.059,top=lens?1.197:1.202,bottom=lens?1.040:1.029,inner=lens?1.039:1.028,outer=lens?1.175:1.173;
 const points=[front,back].flatMap(x=>[[x,top,inner],[x,top,outer],[x,bottom,outer]].map(([x,y,z])=>new T.Vector3(...cp(x,y,side*z))));
 const centre=points.reduce((p,v)=>p.add(v),new T.Vector3()).multiplyScalar(1/6),faces=[[0,1,2],[3,5,4],[0,3,4,1],[1,4,5,2],[2,5,3,0]],positions:number[]=[];
 for(const face of faces){const a=points[face[0]],b=points[face[1]],c=points[face[2]],normal=b.clone().sub(a).cross(c.clone().sub(a)),mid=face.reduce((p,i)=>p.add(points[i]),new T.Vector3()).multiplyScalar(1/face.length),indices=normal.dot(mid.sub(centre))>=0?face:[...face].reverse();for(let i=1;i+1<indices.length;i++)for(const index of [indices[0],indices[i],indices[i+1]])positions.push(...points[index].toArray());}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
