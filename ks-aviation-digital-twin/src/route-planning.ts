import {buildDrivePath,type PathSample,type Point,type Pose} from './vehicle-motion';
import {followHitch} from './trailer-motion';

export type RouteGeometry={wheelbase:number;frontAxleOffset?:number;trailerWheelbase?:number;hitchOffset?:number;maxTrailerAngle?:number;trailerAngle?:number};
export type RouteIssue='short'|'start'|'steering'|'trailer';
export type RouteAnalysis={path:PathSample[];danger:boolean[];nodes:number[];issues:RouteIssue[];score:number};
export type RouteDisplay={points:Point[];danger?:boolean[];handles?:Point[];nodes?:number[];selected?:number};
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
export const pathPoints=(path:PathSample[]):Point[]=>path.map(p=>[p.anchorX??p.x,p.anchorZ??p.z]);
export function routeStart(points:Point[],heading:number,offset=0):Pose{return {x:points[0][0]-Math.sin(heading)*offset,z:points[0][1]+Math.cos(heading)*offset,heading};}

/** Integrate the body behind the front axle. Its path tangent is the steered
 * wheel direction, rather than forcing the whole body to face that tangent. */
export function analyzeRoute(points:Point[],heading:number,g:RouteGeometry,reference?:'front-axle'):RouteAnalysis{
  const issues=new Set<RouteIssue>(),nodes=new Set<number>();let score=0;
  if(points.length<2)return {path:[],danger:[],nodes:[],issues:['short'],score:10000};
  let raw:PathSample[];
  try{raw=buildDrivePath(points,heading,g.wheelbase,true);}catch{return {path:[],danger:[],nodes:[1],issues:['short'],score:10000};}
  const first=points[1],start=points[0],wrongStart=Math.abs(wrap(Math.atan2(first[0]-start[0],-(first[1]-start[1]))-heading))>Math.PI/3;
  if(wrongStart){issues.add('start');nodes.add(1);score+=1000;}
  for(let i=1;i<points.length;i++)if(Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1])<=.5){issues.add('short');nodes.add(i);score+=1000;}
  let body=heading,trailer=g.trailerAngle||0,previous:Pose|undefined;
  const path:PathSample[]=[],danger:boolean[]=[];
  for(let i=0;i<raw.length;i++){
    const r=raw[i],last=raw[Math.max(0,i-1)],ds=r.s-last.s;
    if(reference==='front-axle'&&i){
      const n=Math.max(1,Math.ceil(ds/.1)),step=ds/n,turn=wrap(r.heading-last.heading);
      for(let j=0;j<n;j++){const tangent=last.heading+turn*(j+.5)/n,half=body+Math.sin(wrap(tangent-body))*step/(2*g.wheelbase);body+=Math.sin(wrap(tangent-half))*step/g.wheelbase;}
    }else if(reference!=='front-axle')body=r.heading;
    const steer=reference==='front-axle'?wrap(r.heading-body):Math.atan(g.wheelbase*r.curvature),offset=reference==='front-axle'?(g.frontAxleOffset||0):0;
    const p:PathSample=reference==='front-axle'?{...r,x:r.x-Math.sin(body)*offset,z:r.z+Math.cos(body)*offset,heading:body,anchorX:r.x,anchorZ:r.z,steer}:r;
    let bad=wrongStart&&(r.segment||0)===0;
    const ratio=Math.abs(steer)/(Math.PI/5*1.02);
    if(ratio>1){issues.add('steering');score+=(ratio-1)**2+1;bad=true;}
    if(previous&&(g.trailerWheelbase||0)>0){
      const next=followHitch(previous,p,trailer,g.hitchOffset||0,g.trailerWheelbase!);
      const ratio=Math.abs(next)/(g.maxTrailerAngle||Math.PI/3);
      if(ratio>1&&Math.abs(next)>=Math.abs(trailer)-1e-9){issues.add('trailer');score+=(ratio-1)**2+1;bad=true;}
      trailer=next;
    }
    if(bad){const segment=r.segment||0;nodes.add(Math.min(points.length-1,Math.max(1,segment)));if(segment+1<points.length-1)nodes.add(segment+1);}
    path.push(p);danger.push(bad);previous=p;
  }
  return {path,danger,nodes:[...nodes].sort((a,b)=>a-b),issues:[...issues],score};
}

/** Change only the selected interior point. Start, parking target and all other
 * control points are immutable. A failed attempt never changes the draft. */
export function improveRoutePoint(points:Point[],index:number,heading:number,g:RouteGeometry,reference?:'front-axle'):Point[]|undefined{
  if(index<=0||index>=points.length-1)return;
  const initial=analyzeRoute(points,heading,g,reference);if(!initial.issues.length)return;
  let best=initial.score,bestPoints:Point[]|undefined;
  const origin=points[index];
  for(const radius of [.5,1,2,4,7,11,17,25,36]){
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8,candidate=points.map(p=>[...p] as Point);candidate[index]=[origin[0]+Math.cos(a)*radius,origin[1]+Math.sin(a)*radius];
      if(candidate[index].some(n=>Math.abs(n)>50000))continue;
      const result=analyzeRoute(candidate,heading,g,reference);
      if(!result.issues.length)return candidate;
      if(result.score<best*.98){best=result.score;bestPoints=candidate;}
    }
  }
  return bestPoints;
}
