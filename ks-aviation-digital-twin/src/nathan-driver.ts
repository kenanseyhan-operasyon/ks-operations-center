import * as T from 'three';
import type {Entity} from './scene-data';
import type {V3} from './personnel-navigation';
import type {NathanNavigation} from './nathan-navigation';
import type {NathanAccess} from './nathan-access';
import {meshGripLines} from './nathan-grips';
import {stairPose} from './nathan-stair-gait';
import type {NathanContact} from './nathan-contact';
import {CAB_REFERENCE,cabUnits} from './cab-reference';

export type DriverLanding={seat:V3;feet:[V3,V3];hands:[V3,V3];handTangents:[V3,V3];heading:number};
const world=(n:T.Object3D,p:T.Vector3)=>n.localToWorld(p.clone()).toArray() as V3;
export function driverLanding(root:T.Object3D,heading:number):DriverLanding|undefined{
  const seat=root.getObjectByName('DRIVER_SEAT'),wheel=root.getObjectByName('DRIVER_STEERING_WHEEL');
  const pedals=[root.getObjectByName('DRIVER_PEDAL_TARGET_0'),root.getObjectByName('DRIVER_PEDAL_TARGET_1')];if(!seat||!wheel||pedals.some(p=>!p))return;
  wheel.updateWorldMatrix(true,false);
  // Place both palms on the physical 450 mm rim, not arbitrary points inside it.
  // cabUnits keeps the native GLB coordinate scale and wheel transform intact.
  const radius=cabUnits(CAB_REFERENCE.steeringDiameter/2-.012);
  const handX=cabUnits(.16),handY=Math.sqrt(Math.max(0,radius*radius-handX*handX));
  // Follow the rim through a comfortable arc, then let it slip through the
  // grasp. Following a spoke for several turns twisted/crossed both arms.
  const turn=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),T.MathUtils.clamp(wheel.rotation.z,-.30,.30));
  const fixedRotation=new T.Quaternion().setFromEuler(new T.Euler(wheel.rotation.x,wheel.rotation.y,0,wheel.rotation.order));
  const frame=new T.Matrix4().compose(wheel.position,fixedRotation,wheel.scale).premultiply(wheel.parent!.matrixWorld);
  const points=[new T.Vector3(-handX,handY,0),new T.Vector3(handX,handY,0)];
  return {seat:seat.getWorldPosition(new T.Vector3()).toArray() as V3,heading,
    feet:pedals.map(p=>p!.getWorldPosition(new T.Vector3()).toArray() as V3) as [V3,V3],
    hands:points.map(p=>p.clone().applyQuaternion(turn).applyMatrix4(frame).toArray() as V3) as [V3,V3],
    handTangents:points.map((p,i)=>new T.Vector3((i?-1:1)*p.y,Math.abs(p.x),0).applyQuaternion(turn).transformDirection(frame).toArray() as V3) as [V3,V3]};
}
export function makeDriverAccess(e:Entity,root:T.Object3D,nav:NathanNavigation):NathanAccess|undefined{
  root.updateWorldMatrix(true,true);
  const seat=root.getObjectByName('DRIVER_SEAT'),wheel=root.getObjectByName('DRIVER_STEERING_WHEEL'),threshold=root.getObjectByName('CAB_DRIVER_THRESHOLD');
  if(!seat||!wheel||!threshold||Math.abs(e.position[1])>.05)return;
  const inverse=root.matrixWorld.clone().invert(),box=(n:T.Mesh)=>{n.geometry.computeBoundingBox();return n.geometry.boundingBox!.clone().applyMatrix4(inverse.clone().multiply(n.matrixWorld));};
  const treads:T.Vector3[]=[];root.traverse(n=>{if(n instanceof T.Mesh&&n.name.startsWith('CAB_ACCESS_STEP_LEFT_')){const b=box(n),p=b.getCenter(new T.Vector3());p.y=b.max.y;p.x-=.04;treads.push(p);}});
  if(treads.length<3)return;treads.sort((a,b)=>a.y-b.y);
  const bottom=treads[0].clone();bottom.x-=1.10;bottom.z+=1.65;bottom.y=0;
  let entry=world(root,bottom);for(let i=0;i<25&&nav.blocked(entry);i++){bottom.x-=.1;entry=world(root,bottom);}
  if(nav.blocked(entry))return;
  const corner=bottom.clone();corner.z=treads[0].z+.22;
  const near=treads[0].clone();near.x-=.28;near.z+=.22;near.y=0;
  const landing=root.worldToLocal(threshold.getWorldPosition(new T.Vector3()));
  const stops=[bottom];for(const [a,b] of [[bottom,corner],[corner,near]]){const count=Math.max(1,Math.ceil(a.distanceTo(b)/.3));for(let i=1;i<=count;i++)stops.push(a.clone().lerp(b,i/count));}
  stops.push(...treads,landing);
  const outward=new T.Vector3(-1,0,0).transformDirection(root.matrixWorld),heading=e.heading+90;
  const driver=driverLanding(root,e.heading)!;
  const points=stops.map(p=>world(root,p));
  for(let i=1;i<points.length;i++)if(!nav.clear(points[i-1],points[i],e.id))return;
  const length=points.slice(1).reduce((n,p,i)=>n+new T.Vector3(...p).distanceTo(new T.Vector3(...points[i])),0)+.7*e.scale;
  const handGrips:[[V3,V3][],[V3,V3][]]=[[],[]];
  root.traverse(n=>{
    if(!(n instanceof T.Mesh)||!/^CAB_ENTRY_(JAMB|SEAT)_GRIP$/.test(n.name))return;
    const c=new T.Box3().setFromObject(n).getCenter(new T.Vector3());if(root.worldToLocal(c).x>0)return;
    // Facing the cab: anatomical left is the front jamb, right is the rear grip.
    handGrips[n.name==='CAB_ENTRY_JAMB_GRIP'?0:1].push(...meshGripLines(n));
  });
  // The upper part of the real steering rim is a second right-hand support.
  // Keep the sculpted seat rail's shape; move the body/hand to a reachable
  // fixture instead of growing a loop into the doorway to meet the skeleton.
  const radius=cabUnits(CAB_REFERENCE.steeringDiameter/2-.012),rim:V3[]=[];
  for(let i=0;i<=20;i++){
    const angle=T.MathUtils.lerp(Math.PI*.52,Math.PI*.97,i/20);
    rim.push(world(wheel,new T.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,0)));
  }
  handGrips[1].push(...rim.slice(1).map((p,i)=>[rim[i],p] as [V3,V3]));
  const grips=handGrips.flat();
  return {targetId:e.id,kind:'driver',points,heading,length,crest:.8,driver,contacts:{stops:points,heading,scale:e.scale,outward:outward.toArray() as V3,ladder:false,grips,handGrips}};
}
/** Step into the actual doorway, crouch under the roof, then turn onto the seat.
 * The last segment constrains the pelvis, feet and hands to the cab fixtures. */
export function driverPose(access:NathanAccess,progress:number,descending=false){
  const data=access.contacts!,driver=access.driver!,p=T.MathUtils.clamp(progress,0,1),phase=Math.min(1,p/.8)*data.stops.length;
  const lastGround=Math.max(0,data.stops.findIndex(point=>point[1]>.02*data.scale)-1);
  const heading=access.heading;
  const walk=stairPose(data,Math.min(1,p/.8));
  if(phase<=lastGround){
    // Flat approach uses the original walk clip with real root speed, without
    // stair foot IK or lifted knees. The final point joins the stair pose exactly.
    const path=data.stops.slice(0,lastGround+1).map(point=>new T.Vector3(...point));
    path[lastGround].lerp(path[Math.max(0,lastGround-1)],.5);
    const lengths=path.slice(1).map((point,i)=>point.distanceTo(path[i]));
    let distance=lengths.reduce((a,b)=>a+b,0)*(lastGround?phase/lastGround:0),segment=0;
    while(segment<lengths.length-1&&distance>lengths[segment])distance-=lengths[segment++];
    const a=path[segment],b=path[Math.min(segment+1,path.length-1)],root=a.clone().lerp(b,lengths[segment]?distance/lengths[segment]:0);
    const direction=b.clone().sub(a),facing=Math.atan2(direction.x,-direction.z)*180/Math.PI+(descending?180:0);
    const right=new T.Vector3(Math.cos(facing*Math.PI/180),0,Math.sin(facing*Math.PI/180));
    const feet=[-1,1].map(side=>root.clone().addScaledVector(right,side*.12*data.scale).add(new T.Vector3(0,.012*data.scale,0)).toArray() as V3) as [V3,V3];
    return {root:root.toArray() as V3,heading:facing,groundWalk:true,contact:{feet,freeHands:true,disableClimbFallback:true,handWeight:0} as NathanContact};
  }
  // Narrow cab door: use its specific handles and elbow plane, never the external ladder fallback.
  walk.contact.disableClimbFallback=true;
  walk.contact.freeHands=true;
  // Release while the trailing foot finishes the last tread, before turning
  // on the ground. The same envelope raises the arms during boarding.
  walk.contact.handWeight=T.MathUtils.smoothstep(walk.root[1],.03*data.scale,.25*data.scale);
  walk.contact.handGrips=data.handGrips;
  // Keep the pelvis and knees outside the sill until the trailing foot clears
  // the floor. Feet stay constrained to the real treads throughout this shift.
  const floor=data.stops.at(-1)![1],lowest=Math.min(...walk.contact.feet.map(f=>f[1]));
  const standOff=.30*data.scale*(1-T.MathUtils.smoothstep(lowest,floor-.09*data.scale,floor));
  const outward=new T.Vector3(...data.outward);
  const shift=T.MathUtils.smoothstep(walk.root[1],floor-1.05*data.scale,floor-.80*data.scale);
  walk.root=new T.Vector3(...walk.root).addScaledVector(outward,standOff*shift).toArray() as V3;
  // Stay upright on the lower treads; crouch only as the head approaches the
  // lintel. Early crouching pushes the thighs through the floor's front edge.
  walk.contact.hipHeight=Math.min(.89,(floor-walk.root[1])/data.scale+.58);
  const right=new T.Vector3(Math.cos(access.heading*Math.PI/180),0,Math.sin(access.heading*Math.PI/180));
  walk.contact.handApproach=right.clone().multiplyScalar(.13*data.scale).toArray() as V3;
  // Keep the torso behind the front-hinged open leaf while both feet remain
  // on the compact treads; this offset does not move the contact targets.
  walk.root=new T.Vector3(...walk.root).addScaledVector(right,.10*data.scale*T.MathUtils.smoothstep(walk.root[1],.05*data.scale,.25*data.scale)).toArray() as V3;
  walk.contact.elbowPole=outward.clone().multiplyScalar(.18).add(new T.Vector3(0,-1,0)).toArray() as V3;
  walk.contact.elbowLimits=[-.04,.095];
  if(walk.root[1]>.05*data.scale)walk.contact.grips=data.grips;
  const gripStarts=driver.hands.map((_,i)=>{
    const desired=new T.Vector3(...data.stops.at(-1)!).addScaledVector(right,.10*data.scale).add(new T.Vector3(0,1.02*data.scale,0)).addScaledVector(right,(i?1:-1)*.25*data.scale);
    const candidates=(data.handGrips?.[i]||data.grips||[]).map(([a,b])=>{const line=new T.Line3(new T.Vector3(...a),new T.Vector3(...b)),axis=line.delta(new T.Vector3()).normalize();if(axis.y<0)axis.negate();return {point:line.closestPointToPoint(desired,true,new T.Vector3()),axis};});
    candidates.sort((a,b)=>a.point.distanceToSquared(desired)-b.point.distanceToSquared(desired));return candidates[0]||{point:desired,axis:new T.Vector3(0,1,0)};
  });
  if(lowest>floor-.09*data.scale){walk.contact.gripAim=gripStarts.map(g=>g.point.toArray()) as [V3,V3];walk.contact.settleGrips=true;}
  if(p<=.8)return {...walk,heading,groundWalk:false};
  const t=T.MathUtils.smoothstep(p,.8,1),scale=data.scale;
  const root=new T.Vector3(...walk.root).lerp(new T.Vector3(...driver.seat).add(new T.Vector3(0,-.529*scale,0)),t);
  const feet=walk.contact.feet.map((v,i)=>new T.Vector3(...v).lerp(new T.Vector3(...driver.feet[i]),t).toArray() as V3) as [V3,V3];
  const seated=new T.Vector3(...walk.root).add(new T.Vector3(0,.59*scale,0)).lerp(new T.Vector3(...driver.seat),t).toArray() as V3;
  const handTangents:V3[]=[];
  const hands=driver.hands.map((hand,i)=>{
    // Transfer one hand at a time: the other stays on the fixed handle or rim.
    const handTime=T.MathUtils.smoothstep(t,i?.2:0,i?.55:.2);
    handTangents.push(gripStarts[i].axis.clone().lerp(new T.Vector3(...driver.handTangents[i]),handTime).normalize().toArray() as V3);
    return gripStarts[i].point.clone().lerp(new T.Vector3(...hand),handTime).toArray() as V3;
  }) as [V3,V3];
  const contact:NathanContact={feet,seated,lean:-.035*t,hands,handTangents:handTangents as [V3,V3],gripHands:true,procedural:true,steeringBlend:1,elbowPole:outward.clone().multiplyScalar(.15*(1-t)).add(new T.Vector3(0,-1,0)).toArray() as V3};
  return {root:root.toArray() as V3,contact,groundWalk:false,heading:access.heading+(driver.heading-access.heading)*t};
}

