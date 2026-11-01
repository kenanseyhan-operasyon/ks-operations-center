import {curbPath} from './curb-joins';
import {groundSurfaceMaterial} from './surface-materials';
import * as T from 'three';
import type {Entity} from './scene-data';
import {groundFillContours} from './ground-fill';
import {localToWorld} from './facility-data';
import {pathSections,type Point2} from './site-path';
export function solidPolygon(points:Point2[],height:number){
 const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z))),g=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);return g;
}
export function makePathSolid(o:Entity,curb=false){
 const group=new T.Group(),path=curb?curbPath(o):pathSections(o.points||[],Math.max(.1,o.thickness),o.facility?.closed,Math.max(.45/o.scale,o.thickness*1.5)),materials=[groundSurfaceMaterial(o.color,false),groundSurfaceMaterial('#eeeee3',false)];
 let tile=0;
 for(let i=0;i<path.sections.length-(path.closed?0:1);i++){
  const a=path.sections[i],b=path.sections[(i+1)%path.sections.length],len=Math.hypot(a.center[0]-b.center[0],a.center[1]-b.center[1]),count=curb?Math.ceil(len/.6):1;
  const lerp=(u:Point2,v:Point2,t:number):Point2=>[u[0]+(v[0]-u[0])*t,u[1]+(v[1]-u[1])*t];
  for(let j=0;j<count;j++){const t=j/count,z=(j+1)/count,m=new T.Mesh(solidPolygon([lerp(a.left,b.left,t),lerp(a.right,b.right,t),lerp(a.right,b.right,z),lerp(a.left,b.left,z)],o.height),materials[curb?tile++%2:0]);m.name=curb?'CURB_JOINED_BLOCK':'WALL_JOINED_PANEL';m.castShadow=true;m.receiveShadow=true;group.add(m);}
 }
 return group;
}
export function makeGroundFill(o:Entity){
 const group=new T.Group(),grass=o.preset==='GRASS_FILL',top=groundSurfaceMaterial(o.color,grass),side=new T.MeshStandardMaterial({color:grass?'#645c42':o.color,roughness:1});
 for(const polygon of groundFillContours(o)){const geometry=solidPolygon(polygon,o.height),position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');for(let i=0;i<position.count;i++){const p=localToWorld(o,[position.getX(i),position.getY(i),position.getZ(i)]);uv.setXY(i,p[0],p[2]);}const mesh=new T.Mesh(geometry,[top,side]);mesh.name='GROUND_FILL_SOLID';mesh.receiveShadow=true;group.add(mesh);}
 group.name='SITE_GROUND_FILL';return group;
}

