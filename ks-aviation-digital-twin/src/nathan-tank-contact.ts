import * as T from 'three';
import type {Entity} from './scene-data';
import type {V3} from './personnel-navigation';
import type {NathanContact} from './nathan-contact';
import {tankStairLayout} from './tank-stairs';
import {localToWorld,worldToLocal} from './facility-data';
import {sampleAccess,type NathanAccess} from './nathan-access';

const radiusTube=.024;
const smooth=(x:number)=>{const t=T.MathUtils.clamp(x,0,1);return t*t*(3-2*t);};
const tau=Math.PI*2;

/**
 * Follow the outside rail actually built by makeTankAccess, rather than playing
 * an unrelated stair clip with unrestrained hands. Only ONE hand holds the
 * outer guardrail; the other remains free. The route still owns body position.
 * No synthetic grasp is allowed at the ground/roof transitions or missing rail.
 */
export function tankStairContact(tank:Entity,access:NathanAccess,progress:number,heading:number):NathanContact|undefined{
  if(tank.kind!=='tank'||tank.facility?.stairs===false||progress<=.025||progress>=.975)return;
  const layout=tankStairLayout(tank);
  const root=sampleAccess(access,progress),q=worldToLocal(tank,root);
  const angle=Math.atan2(q[0],q[2]);
  let nearest:{piece:(typeof layout.pieces)[number];u:number;error:number}|undefined;
  for(const piece of layout.pieces){
    if(piece.roofLanding||Math.abs(piece.b-piece.a)<.00001)continue;
    const mid=(piece.a+piece.b)*.5;
    const unwrapped=angle+Math.round((mid-angle)/tau)*tau;
    const u=T.MathUtils.clamp((unwrapped-piece.a)/(piece.b-piece.a),0,1);
    const at=piece.a+(piece.b-piece.a)*u;
    const y=T.MathUtils.lerp(piece.y0,piece.y1,u);
    const error=Math.abs(unwrapped-at)*layout.radius+Math.abs(q[1]-y)*2;
    if(!nearest||error<nearest.error)nearest={piece,u,error};
  }
  if(!nearest||nearest.error>.75)return;
  const {piece,u}=nearest;
  // The rail is built at the OUTER stringer with a top tube 1.08 m above
  // each real tread. Segment samples stay on the actual piece (no wall cut).
  const rad=layout.radius+layout.width/2+.025;
  const segment=(u:number):V3=>{
    const a=T.MathUtils.lerp(piece.a,piece.b,u);
    const y=T.MathUtils.lerp(piece.y0,piece.y1,u)+1.08;
    return localToWorld(tank,[Math.sin(a)*rad,y,Math.cos(a)*rad]);
  };
  const a=segment(T.MathUtils.clamp(u-.075,0,1)),b=segment(T.MathUtils.clamp(u+.075,0,1));
  if(new T.Vector3(...a).distanceTo(new T.Vector3(...b))<.015)return;
  const rail:[V3,V3]=[a,b],mid=a.map((v,i)=>(v+b[i])*.5) as V3;
  const radial:[number,number]=[Math.sin(angle),Math.cos(angle)];
  const h=heading*Math.PI/180;
  const right:[number,number]=[Math.cos(h),Math.sin(h)];
  const handSide=right[0]*radial[0]+right[1]*radial[1]>0?1:0;
  // Plant the soles on neighbouring access samples, never on generic Y=0.
  const stride=Math.min(.007,.16/Math.max(.1,access.length));
  const aFoot=sampleAccess(access,T.MathUtils.clamp(progress-stride,0,1));
  const bFoot=sampleAccess(access,T.MathUtils.clamp(progress+stride,0,1));
  const feet:[V3,V3]=[
    [aFoot[0]-.11*right[0]*tank.scale,aFoot[1]+.012*tank.scale,aFoot[2]-.11*right[1]*tank.scale],
    [bFoot[0]+.11*right[0]*tank.scale,bFoot[1]+.012*tank.scale,bFoot[2]+.11*right[1]*tank.scale]
  ];
  const nearGround=smooth((progress-.025)/.07),nearRoof=smooth((.975-progress)/.07);
  const handWeight=Math.min(nearGround,nearRoof);
  return {feet,grips:[rail],handGrips:handSide===0?[[rail],[]]:[[],[rail]],
    gripAim:[mid,mid],handWeight,freeHands:true,gripHands:true,procedural:true,
    disableClimbFallback:true,hipHeight:.89,gripRadius:radiusTube,
    elbowPole:[0,-1,0]};
}
