import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {JSDOM} from 'jsdom';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {newEntity} from '../src/scene-data';
import {NathanActor,makeNathanPlaceholder,parseNathanAccessClips} from '../src/nathan-model';
import {NATHAN_PRESET,NATHAN_MODEL_URL} from '../src/nathan-data';
import {Nathan2Motor,type MotorPose} from '../src/nathan2/engine';
import {applyLabAnimation,labMotionForPose} from '../src/nathan2/playback';
import {retargetCmu11319,retargetCmu8334Ascent} from '../src/nathan2/cmu-mocap';

/** Continuous acceptance test. Use the real Nathan skeleton and the same
 * rendering geometry as main.ts; measure final posed soles/palm AFTER mixer
 * and IK. Target-only or isolated pose checks miss phase and transition jumps.
 */
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://test.invalid'});
for(const key of ['window','document','HTMLElement','HTMLCanvasElement'])Object.defineProperty(globalThis,key,{value:(dom.window as any)[key],configurable:true});
dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
const bytes=fs.readFileSync('public'+NATHAN_MODEL_URL),loader=new GLTFLoader();
loader.register(()=>({name:'KS_TEST_TEXTURE_NO_GL',loadTexture:async()=>new T.Texture()}));
const asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
asset.animations.push(...parseNathanAccessClips(JSON.parse(fs.readFileSync('public/models/personnel/nathan-access-animations.json','utf8'))));
const bvh83=fs.readFileSync('public/mocap/cmu/83_34.bvh','utf8'),bvh113=fs.readFileSync('public/mocap/cmu/113_19.bvh','utf8');
const DT=1/60,upVector=new T.Vector3(0,1,0);
const json=(value:unknown)=>JSON.stringify(value,(_key,item)=>typeof item==='number'&&!Number.isFinite(item)?String(item):item);
const failures:Record<string,{count:number;examples:unknown[]}>={};
function requireMetric(ok:boolean,key:string,detail:unknown){
 if(ok)return;
 const failure=failures[key]??={count:0,examples:[]};failure.count++;
 if(failure.examples.length<4)failure.examples.push(detail);
 if(failure.count===1)console.log('NATHAN2_FIRST_CONTINUITY_FAILURE '+json({key,detail}));
}
function visibleGeometry(motor:Nathan2Motor){
 const {layout}=motor.stairs,tank=motor.tank,group=new T.Group();
 const box=(width:number,depth:number,top:number,x:number,z:number,yaw:number)=>{
  const mesh=new T.Mesh(new T.BoxGeometry(width,.09,depth));
  mesh.position.set(x,top-.045,z);mesh.rotation.y=yaw;group.add(mesh);
 };
 const railPoints:T.Vector3[]=[];
 for(const piece of layout.pieces){
  const n=Math.max(2,Math.ceil(Math.abs(piece.b-piece.a)*layout.radius/.22));
  for(let j=0;j<=n;j++){
   const u=j/n,a=T.MathUtils.lerp(piece.a,piece.b,u),r=layout.radius+layout.width/2+.025;
   const point=new T.Vector3(Math.sin(a)*r,T.MathUtils.lerp(piece.y0,piece.y1,u)+1.08,Math.cos(a)*r);
   if(!railPoints.length||railPoints.at(-1)!.distanceToSquared(point)>=1e-12)railPoints.push(point);
  }
  if(!piece.roofLanding){
   const a=(piece.a+piece.b)/2;
   box(layout.width,Math.max(.13,Math.abs(piece.b-piece.a)*layout.radius+.04),piece.y1,Math.sin(a)*layout.radius,Math.cos(a)*layout.radius,a+Math.PI/2);
  }
 }
 const [entry,first]=layout.path;
 box(layout.width,new T.Vector3(...entry).distanceTo(new T.Vector3(...first))+.08,entry[1],(entry[0]+first[0])/2,(entry[2]+first[2])/2,Math.atan2(first[0]-entry[0],first[2]-entry[2]));
 const landing=layout.roofLanding,r=(landing.inner+landing.outer)/2;
 box(landing.outer-landing.inner,landing.depth,landing.height,Math.sin(landing.angle)*r,Math.cos(landing.angle)*r,landing.angle+Math.PI/2);
 const roof=new T.Mesh(new T.CylinderGeometry(tank.radius-.08,tank.radius-.08,.10,72));roof.position.y=layout.height-.05;group.add(roof);
 box(150,150,0,0,0,0);group.updateMatrixWorld(true);
 const ray=new T.Raycaster();
 const supportAt=(point:T.Vector3)=>{
  ray.set(point.clone().addScaledVector(upVector,.35),upVector.clone().negate());ray.far=.8;
  return ray.intersectObject(group,true)[0]?.point.y;
 };
 // Recover the centreline from the actual render tube's vertex rings. The
 // mesh follows chords between rings, not an infinitely dense ideal curve.
 const railCurve=new T.CatmullRomCurve3(railPoints,false,'centripetal');
 railCurve.arcLengthDivisions=Math.max(200,railPoints.length*8);
 const tube=new T.TubeGeometry(railCurve,railPoints.length*2,.031,8,false),vertices=tube.getAttribute('position'),centres:T.Vector3[]=[];
 for(let ring=0;ring<=railPoints.length*2;ring++){
  const centre=new T.Vector3();
  for(let radial=0;radial<8;radial++)centre.add(new T.Vector3().fromBufferAttribute(vertices,ring*9+radial));
  centres.push(centre.multiplyScalar(1/8));
 }
 const segments=centres.slice(1).map((point,i)=>new T.Line3(centres[i],point)),closest=new T.Vector3();
 const railDistance=(p:T.Vector3)=>{
  let best=Infinity;
  for(const segment of segments)best=Math.min(best,segment.closestPointToPoint(p,true,closest).distanceToSquared(p));
  return Math.sqrt(best);
 };
 return {supportAt,railDistance};
}
type Reading={pose:MotorPose;feet:T.Vector3[];palm?:T.Vector3;wrists:T.Vector3[];neck:T.Vector3;root:T.Vector3;clip:string};
function runScenario(source:'cmu83'|'cmu113'){
 const tank=newEntity('TANK',0,0);
 tank.facility={...tank.facility,stairs:true,stairStart:-105,stairSweep:535,clockwise:true,stairWidth:1.02,stairLandings:true,stairLandingLength:1.35};
 const motor=new Nathan2Motor(tank),geometry=visibleGeometry(motor);
 const person=newEntity(NATHAN_PRESET,motor.position[0],motor.position[2]),root=makeNathanPlaceholder(person),actor=new NathanActor(root,asset,person.height);
 const capture=source==='cmu83'?retargetCmu8334Ascent(actor,bvh83):retargetCmu11319(actor,bvh113);
 actor.addExternalMotion(capture.ascent);if('descent' in capture)actor.addExternalMotion(capture.descent as T.AnimationClip);
 const native=actor.clips.find(c=>c.name==='Nathan_Original_Walk')!;
 const hip=actor.model.getObjectByName('rp_nathan_animated_003_walking_hip')!,neck=actor.model.getObjectByName('rp_nathan_animated_003_walking_neck')!;
 root.position.fromArray(motor.position);root.rotation.y=-T.MathUtils.degToRad(motor.heading);actor.motion('Idle');actor.update(DT);
 let previous:Reading|undefined;
 const report:Record<string,unknown>[]=[];
 for(const direction of ['up','down'] as const){
  if(direction==='up')motor.up();else motor.down();
  const summary={source,direction,frames:0,contactFrames:0,fullyHeldFrames:0,missingHandFrames:0,postureMeanDegrees:0,postureMaxDegrees:0,maxSoleTargetErrorM:0,maxPlantedSurfaceErrorM:0,maxSwingPenetrationM:0,maxPalmTargetErrorM:0,maxPalmRailErrorM:0,maxFootFrameJumpM:0,maxHandFrameJumpM:0,maxWristFrameJumpM:0,maxNeckFrameJumpM:0,maxRootFrameJumpM:0,footJumpsOver50mm:0,handJumpsOver50mm:0,stepBoundaryFootJumpM:0};
  let postureSum=0,endpointFrames=0;
  for(let i=0;i<15000;i++){
   const down=motor.activity==='spiral-down';
   const external=motor.distance>=motor.stairs.lengths[2]?(source==='cmu113'?(down?(capture as ReturnType<typeof retargetCmu11319>).descent:capture.ascent):!down?capture.ascent:undefined):undefined;
   motor.setWalkCycleSeconds(external?external.duration:native.duration);
   const pose=motor.tick(DT);
   root.position.fromArray(pose.position);root.rotation.y=-T.MathUtils.degToRad(pose.heading);
   const clip=labMotionForPose(pose,motor.distance,motor.stairs.lengths[2],source==='cmu113'?'cmu':'cmu83',{cmu83:source==='cmu83',cmu:source==='cmu113'});
   applyLabAnimation(actor,pose,clip,motor.distance,motor.stairs.total,tank.scale,DT*pose.speed);
   const feet=[actor.contactRig!.sole(0),actor.contactRig!.sole(1)],wrists=actor.contactRig!.arms.map(arm=>arm.end.getWorldPosition(new T.Vector3())),neckPoint=neck.getWorldPosition(new T.Vector3()),hipPoint=hip.getWorldPosition(new T.Vector3());
   const tilt=T.MathUtils.radToDeg(neckPoint.clone().sub(hipPoint).angleTo(upVector)),hand=pose.outsideHand===undefined?undefined:actor.contactRig!.handContacts[pose.outsideHand];
   const frame={source,direction,frame:i,progress:pose.progress,activity:pose.activity,clip};
   summary.frames++;postureSum+=tilt;summary.postureMaxDegrees=Math.max(summary.postureMaxDegrees,tilt);
   requireMetric(Number.isFinite(tilt)&&tilt<=30,'upright_torso',{...frame,tilt});
   if(pose.contact){
    summary.contactFrames++;
    for(let side=0;side<2;side++){
     const error=feet[side].distanceTo(new T.Vector3(...pose.contact.feet[side]));summary.maxSoleTargetErrorM=Math.max(summary.maxSoleTargetErrorM,error);
     requireMetric(error<=.015,'sole_reaches_target',{...frame,side,error});
    }
    const stance=pose.plantedFoot;
    if(stance!==undefined){
     const support=geometry.supportAt(feet[stance]);
     const clearanceError=support===undefined?Infinity:Math.abs(feet[stance].y-support-.007);
     summary.maxPlantedSurfaceErrorM=Math.max(summary.maxPlantedSurfaceErrorM,clearanceError);
     requireMetric(clearanceError<=.012,'planted_sole_on_visible_surface',{...frame,stance,clearanceError,support,sole:feet[stance].toArray()});
    }
    for(let side=0;side<2;side++)if(side!==stance){
     const support=geometry.supportAt(feet[side]);
     const penetration=support===undefined?0:Math.max(0,support-feet[side].y);
     summary.maxSwingPenetrationM=Math.max(summary.maxSwingPenetrationM,penetration);
     requireMetric(penetration<=.01,'swing_sole_clears_visible_tread',{...frame,side,penetration});
    }
    if((pose.contact.handWeight??1)>.999){
     summary.fullyHeldFrames++;if(!hand?.gripping)summary.missingHandFrames++;
     const error=hand?hand.centre.distanceTo(hand.target):Infinity,railError=hand?geometry.railDistance(hand.centre):Infinity;
     summary.maxPalmTargetErrorM=Math.max(summary.maxPalmTargetErrorM,error);summary.maxPalmRailErrorM=Math.max(summary.maxPalmRailErrorM,railError);
     requireMetric(!!hand?.gripping,'outside_hand_keeps_grip',{...frame,hand:pose.outsideHand,gripping:hand?.gripping});
     requireMetric(error<=.015,'palm_reaches_target',{...frame,error});
     requireMetric(railError<=.005,'palm_follows_visible_rail',{...frame,railError});
    }
   }
   if(previous){
    const rootJump=root.position.distanceTo(previous.root),neckJump=neckPoint.distanceTo(previous.neck);
    const footJump=Math.max(...feet.map((p,j)=>p.distanceTo(previous!.feet[j])));
    const changedStep=pose.contact&&previous.pose.contact&&pose.plantedFoot!==previous.pose.plantedFoot;
    const handJump=hand&&previous.palm&&pose.outsideHand===previous.pose.outsideHand?hand.centre.distanceTo(previous.palm):0;
    const wristJumps=wrists.map((p,j)=>p.distanceTo(previous!.wrists[j])),wristJump=Math.max(...wristJumps),wristSide=wristJumps.indexOf(wristJump);
    summary.maxRootFrameJumpM=Math.max(summary.maxRootFrameJumpM,rootJump);summary.maxFootFrameJumpM=Math.max(summary.maxFootFrameJumpM,footJump);summary.maxNeckFrameJumpM=Math.max(summary.maxNeckFrameJumpM,neckJump);summary.maxHandFrameJumpM=Math.max(summary.maxHandFrameJumpM,handJump);
    if(changedStep)summary.stepBoundaryFootJumpM=Math.max(summary.stepBoundaryFootJumpM,footJump);
    summary.maxWristFrameJumpM=Math.max(summary.maxWristFrameJumpM,wristJump);
    if(footJump>.05)summary.footJumpsOver50mm++;if(handJump>.05)summary.handJumpsOver50mm++;
    // At 60 Hz, a 5 cm excess above route movement is an abrupt correction,
    // not normal ~0.49 m/s travel. Include contact on/off transitions.
    requireMetric(footJump<=.05+rootJump,'continuous_soles',{...frame,footJump,rootJump,previousActivity:previous.pose.activity,changedStep,hadContact:!!previous.pose.contact,hasContact:!!pose.contact});
    requireMetric(handJump<=.05+rootJump,'continuous_gripping_hand',{...frame,handJump,rootJump,previousActivity:previous.pose.activity});
    requireMetric(wristJump<=.05+rootJump,'continuous_wrists_through_release',{...frame,wristSide,wristJump,rootJump,handWeight:pose.contact?.handWeight,previousHandWeight:previous.pose.contact?.handWeight,previousActivity:previous.pose.activity});
    requireMetric(neckJump<=.05+rootJump,'continuous_torso',{...frame,neckJump,rootJump,previousActivity:previous.pose.activity});
   }
   previous={pose,feet:feet.map(p=>p.clone()),palm:hand?.centre.clone(),wrists:wrists.map(p=>p.clone()),neck:neckPoint.clone(),root:root.position.clone(),clip};
   if((direction==='up'&&pose.activity==='roof')||(direction==='down'&&pose.activity==='ground')){
    if(++endpointFrames>=30)break; // include the walking-to-idle transition
   }
   assert.ok(i<14999,'Continuous scenario must reach its destination');
  }
  summary.postureMeanDegrees=postureSum/summary.frames;report.push(summary);
  console.log('NATHAN2_CONTINUOUS_SKIN_SEGMENT '+json(summary));
 }
 actor.dispose();return report;
}
const report=[...runScenario('cmu83'),...(process.argv.includes('--include-optional')?runScenario('cmu113'):[])];
console.log('NATHAN2_CONTINUOUS_SKIN_REPORT '+json({report,failures}));
assert.equal(Object.keys(failures).length,0,'Continuous skinned acceptance failed: '+Object.entries(failures).map(([name,v])=>`${name}=${v.count}`).join(', '));
console.log('PASS Nathan2 continuous real-skeleton acceptance: source clips, both travel directions, posture, physical treads/rail and frame continuity');
