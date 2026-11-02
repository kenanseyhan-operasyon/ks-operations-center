/**
 * CMU Graphics Lab Motion Capture Database — subject 113, trial 19.
 * Actual human stair ascent AND descent, converted to BVH by Bruce Hahne.
 *
 * Primary license: https://mocap.cs.cmu.edu/ (research/commercial use;
 * do not resell the raw data), conversion terms: public/mocap/cmu/READMEFIRST_CMU_BVH.txt
 *
 * Three.js retargeting is done against the REAL Nathan GLB skeleton; no
 * guessed Mixamorig bone names, no duplicate source root translation.
 */
import * as T from 'three';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { NathanActor } from '../nathan-model';

export const CMU_113_19_URL = '/mocap/cmu/113_19.bvh';
export const CMU_83_34_URL = '/mocap/cmu/83_34.bvh';
export const CMU_83_UP_NAME='CMU_83_34_Stairs_Up';
// One complete left/right stair stride per clip. The older windows included
// stopping on the landing (83) and a 121-degree turnaround (113 ascent).
export const CMU_83_ASCENT_SECONDS = [4+19/60,6+1/12] as const;
export const CMU_ASCENT_SECONDS = [11/15, 67/30] as const;
export const CMU_DESCENT_SECONDS = [3.90, 16/3] as const;
export const CMU_UP_NAME='CMU_113_19_Stairs_Up';
export const CMU_DOWN_NAME='CMU_113_19_Stairs_Down';
export const NATHAN_RIG_PREFIX='rp_nathan_animated_003_walking_';
/** Phase 0: left stance/right swing; .5: right stance/left swing. */
export const CMU_CLIP_CYCLE:Readonly<Record<string,{cycleCount:1;startPhase:0|.5}>>={
  [CMU_83_UP_NAME]:{cycleCount:1,startPhase:0},
  [CMU_UP_NAME]:{cycleCount:1,startPhase:.5},
  [CMU_DOWN_NAME]:{cycleCount:1,startPhase:.5}
};
export const CMU_LOOP_SEAM_SECONDS=.18;
type RotationGap={bone:string;start:number;end:number};
/** These raw CMU83 ankle channels spin 73–147 degrees in one 120 Hz frame.
 * Repair only those measured gaps in the parsed copy; original BVH stays
 * unchanged. Shin/thigh motion and all samples outside the gaps are kept. */
export const CMU_83_ANKLE_REPAIRS:readonly RotationGap[]=[
  {bone:'RightFoot',start:4+41/60,end:4.95},
  {bone:'LeftFoot',start:5+8/15,end:5+5/6}
];

/** Real target bone suffix -> original CMU BVH name. */
export const CMU_TO_NATHAN_BONES:Readonly<Record<string,string>> = {
  hip:'Hips',spine_01:'LowerBack',spine_02:'Spine',spine_03:'Spine1',
  // CMU's zero-length Neck is an intermediate joint; Neck1 is the neck.
  // Use the real Nathan shoulder names, not absent Mixamo-style clavicles.
  neck:'Neck1',head:'Head',
  shoulder_l:'LeftShoulder',upperarm_l:'LeftArm',lowerarm_l:'LeftForeArm',hand_l:'LeftHand',
  shoulder_r:'RightShoulder',upperarm_r:'RightArm',lowerarm_r:'RightForeArm',hand_r:'RightHand',
  upperleg_l:'LeftUpLeg',lowerleg_l:'LeftLeg',foot_l:'LeftFoot',ball_l:'LeftToeBase',
  upperleg_r:'RightUpLeg',lowerleg_r:'RightLeg',foot_r:'RightFoot',ball_r:'RightToeBase'
};

export type CmuStairCapture = {
  sourceFrames:number;
  sourceSeconds:number;
  mappedBones:number;
  ascent:T.AnimationClip;
  descent:T.AnimationClip;
};
/**
 * Retarget to a CLONED rig to avoid scrambling the posed Nathan model during
 * calculation. Source frame 0 is a synthetic T pose; selected time windows
 * exclude it. Source world root movement is not copied: Nathan2Motor retains
 * sole authority over his physical path around the spiral tank.
 */
export type CmuStairAscent=Omit<CmuStairCapture,'descent'>;
type ClipWindow={name:string;start:number;end:number};
export function retargetCmu11319(actor:NathanActor,bvhText:string):CmuStairCapture {
 const data=retargetCmuWindows(actor,bvhText,[
   {name:CMU_UP_NAME,start:CMU_ASCENT_SECONDS[0],end:CMU_ASCENT_SECONDS[1]},
   {name:CMU_DOWN_NAME,start:CMU_DESCENT_SECONDS[0],end:CMU_DESCENT_SECONDS[1]}
 ]);
 if(!data.descent)throw Error('CMU 113_19 descent missing');
 return {...data,descent:data.descent};
}
export function retargetCmu8334Ascent(actor:NathanActor,bvhText:string):CmuStairAscent {
 const data=retargetCmuWindows(actor,bvhText,[
   {name:CMU_83_UP_NAME,start:CMU_83_ASCENT_SECONDS[0],end:CMU_83_ASCENT_SECONDS[1]}
 ],CMU_83_ANKLE_REPAIRS);
 return {ascent:data.ascent,sourceFrames:data.sourceFrames,sourceSeconds:data.sourceSeconds,mappedBones:data.mappedBones};
}
export function retargetCmuWindows(actor:NathanActor,bvhText:string,windows:readonly ClipWindow[],rotationGaps:readonly RotationGap[]=[]):CmuStairAscent&{descent?:T.AnimationClip} {
  if(!bvhText.startsWith('HIERARCHY')||!bvhText.includes('MOTION'))throw Error('CMU BVH source invalid or incomplete');
  const source=new BVHLoader().parse(bvhText);
  for(const gap of rotationGaps){
    const track=source.clip.tracks.find(t=>t.name===gap.bone+'.quaternion');
    if(!track||gap.start<=0||gap.end<=gap.start||gap.end>=source.clip.duration)throw Error('Invalid measured CMU rotation gap: '+gap.bone);
    const interpolate=new T.QuaternionLinearInterpolant(track.times,track.values,4,new Float32Array(4));
    const first=new T.Quaternion().fromArray(interpolate.evaluate(gap.start)).normalize();
    const last=new T.Quaternion().fromArray(interpolate.evaluate(gap.end)).normalize();
    const q=new T.Quaternion();
    for(let i=0;i<track.times.length;i++){
      const time=track.times[i];if(time<=gap.start||time>=gap.end)continue;
      const alpha=(time-gap.start)/(gap.end-gap.start);
      q.copy(first).slerp(last,alpha*alpha*(3-2*alpha)).toArray(track.values,i*4);
    }
  }
  for(const {name,start,end} of windows)
    if(start<=0||end-start<=.6||end>source.clip.duration)throw Error('Invalid CMU capture time window: '+name);
  const snapshot=cloneSkinned(actor.model);
  let mesh:T.SkinnedMesh|undefined;
  snapshot.traverse(obj=>{if(!mesh&&obj instanceof T.SkinnedMesh)mesh=obj;});
  if(!mesh)throw Error('Nathan has no skinned rig to retarget');
  // A live actor is usually already animated. Its current pose is NOT a
  // calibration pose. Restore only this cloned skeleton from inverse binds.
  mesh.skeleton.pose();
  // Skeleton.pose() only converts a bind matrix through BONE parents. This
  // GLB also has a non-bone Armature basis transform, so its root must be
  // converted through that parent as well. Otherwise the reference itself
  // is tilted 90 degrees before any source motion is applied.
  snapshot.updateMatrixWorld(true);
  mesh.skeleton.bones.forEach((bone,index)=>{
    if(bone.parent&&!(bone.parent instanceof T.Bone)){
      const bindWorld=mesh!.skeleton.boneInverses[index].clone().invert();
      const bindLocal=bone.parent.matrixWorld.clone().invert().multiply(bindWorld);
      bindLocal.decompose(bone.position,bone.quaternion,bone.scale);
    }
  });
  snapshot.updateMatrixWorld(true);
  const sourceRoot=source.skeleton.bones[0];
  const sourceMixer=new T.AnimationMixer(sourceRoot);
  const sourceAction=sourceMixer.clipAction(source.clip);
  sourceAction.setLoop(T.LoopOnce,1);sourceAction.clampWhenFinished=true;sourceAction.play();
  sourceMixer.setTime(0);sourceRoot.updateMatrixWorld(true);
  const sourceBones=new Map(source.skeleton.bones.map(b=>[b.name,b]));
  const targetBones=new Map(mesh.skeleton.bones.map(b=>[b.name,b]));
  type Mapping={target:T.Bone;source:T.Bone;inverseSourceRest:T.Quaternion;targetRest:T.Quaternion};
  const mappings:Mapping[]=[];
  for(const [suffix,origin] of Object.entries(CMU_TO_NATHAN_BONES)){
    const target=targetBones.get(NATHAN_RIG_PREFIX+suffix),src=sourceBones.get(origin);
    if(target&&src)mappings.push({target,source:src,
      inverseSourceRest:src.getWorldQuaternion(new T.Quaternion()).invert(),
      targetRest:target.getWorldQuaternion(new T.Quaternion())});
  }
  for(const required of ['hip','upperleg_l','lowerleg_l','foot_l','upperleg_r','lowerleg_r','foot_r','upperarm_l','hand_l','upperarm_r','hand_r']){
    if(!mappings.some(m=>m.target.name===NATHAN_RIG_PREFIX+required))throw Error('Missing essential Nathan/CMU map: '+required);
  }
  // GLTF joint-array order is not guaranteed to be parent-first. Recover
  // local rotations only after each target parent has its new world pose.
  const depth=(bone:T.Object3D)=>{let n=0;for(let p=bone.parent;p;p=p.parent)n++;return n;};
  mappings.sort((a,b)=>depth(a.target)-depth(b.target));
  const hips=mappings.find(m=>m.target.name===NATHAN_RIG_PREFIX+'hip')!;
  const targetRoot=targetBones.get(NATHAN_RIG_PREFIX+'root');
  if(!targetRoot)throw Error('Nathan native root bone is missing');
  const rootRest=targetRoot.quaternion.clone();
  const fps=30;
  const clips=windows.map(({name,start,end})=>{
    // Remove the recording's constant heading, independently for ascent and
    // descent. Keep the captured hip sway and twist around that heading;
    // the laboratory path remains the authority for world-facing direction.
    const forward=new T.Vector3(),sampleForward=new T.Vector3(),sourceQ=new T.Quaternion();
    for(let i=0;i<=24;i++){
      sourceMixer.setTime(T.MathUtils.lerp(start,end,i/24));sourceRoot.updateMatrixWorld(true);
      hips.source.getWorldQuaternion(sourceQ).multiply(hips.inverseSourceRest);
      sampleForward.set(0,0,1).applyQuaternion(sourceQ).setY(0).normalize();
      forward.add(sampleForward);
    }
    if(forward.lengthSq()<1)throw Error('CMU trim has no stable forward heading: '+name);
    const headingInverse=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-Math.atan2(forward.x,forward.z));
    const frames=Math.ceil((end-start)*fps)+1;
    const times=new Float32Array(frames);
    const values=mappings.map(()=>new Float32Array(frames*4));
    const rootValues=new Float32Array(frames*4);
    const desiredWorld=new T.Quaternion(),parentWorld=new T.Quaternion();
    for(let frame=0;frame<frames;frame++){
      const elapsed=Math.min(frame/fps,end-start);times[frame]=elapsed;
      sourceMixer.setTime(start+elapsed);sourceRoot.updateMatrixWorld(true);
      targetRoot.quaternion.copy(rootRest);targetRoot.updateWorldMatrix(true,false);
      mappings.forEach((mapping,index)=>{
        // Rotate the TARGET bind orientation by the SOURCE motion delta.
        // Copying source world axes directly erases Nathan's hip bind axes
        // and turns the otherwise upright body approximately 90 degrees.
        mapping.source.getWorldQuaternion(desiredWorld)
          .multiply(mapping.inverseSourceRest).premultiply(headingInverse)
          .multiply(mapping.targetRest);
        if(mapping.target.parent)mapping.target.parent.getWorldQuaternion(parentWorld);
        else parentWorld.identity();
        mapping.target.quaternion.copy(parentWorld).invert().multiply(desiredWorld).normalize();
        mapping.target.updateWorldMatrix(false,false);
        mapping.target.quaternion.toArray(values[index],frame*4);
      });
      rootRest.toArray(rootValues,frame*4);
    }
    const tracks=mappings.map((mapping,index)=>new T.QuaternionKeyframeTrack(mapping.target.name+'.quaternion',times,values[index]));
    // Explicit native root rotation also makes a transition from an existing
    // Nathan action deterministic, without adding any root position channel.
    tracks.push(new T.QuaternionKeyframeTrack(targetRoot.name+'.quaternion',times,rootValues));
    return new T.AnimationClip(name,end-start,tracks);
  });
  sourceMixer.stopAllAction();sourceMixer.uncacheRoot(sourceRoot);
  const [up,down]=clips;
  for(const clip of clips){
    if(clip.duration<=.6||clip.tracks.length<14)throw Error('Invalid retargeted CMU motion '+clip.name);
    // The selected endpoints have the same footfall phase but separate
    // captured strides are never numerically identical. Close only the
    // final 180 ms using the measured residual rotation. This preserves
    // the actual human motion over the rest of the cycle and prevents a
    // first/last-frame snap during LoopRepeat.
    const first=new T.Quaternion(),last=new T.Quaternion(),residual=new T.Quaternion(),correction=new T.Quaternion(),q=new T.Quaternion();
    for(const track of clip.tracks){
      first.fromArray(track.values,0);last.fromArray(track.values,track.values.length-4);
      residual.copy(last).invert().multiply(first).normalize();
      for(let i=0;i<track.times.length;i++){
        const alpha=T.MathUtils.clamp((track.times[i]-clip.duration+CMU_LOOP_SEAM_SECONDS)/CMU_LOOP_SEAM_SECONDS,0,1);
        if(alpha===0)continue;
        correction.identity().slerp(residual,alpha*alpha*(3-2*alpha));
        q.fromArray(track.values,i*4).multiply(correction).normalize().toArray(track.values,i*4);
      }
    }
    // Avoid quaternion sign inversion on closely sampled motion clips.
    for(const track of clip.tracks)if(track instanceof T.QuaternionKeyframeTrack)
      for(let i=4;i<track.values.length;i+=4){
        const a=track.values,dot=a[i-4]*a[i]+a[i-3]*a[i+1]+a[i-2]*a[i+2]+a[i-1]*a[i+3];
        if(dot<0)for(let k=0;k<4;k++)a[i+k]*=-1;
      }
  }
  return {
    sourceFrames:source.clip.tracks.find(track=>track.name==='Hips.position')?.times.length||0,
    sourceSeconds:source.clip.duration,mappedBones:mappings.length,
    ascent:up, ...(down?{descent:down}:{})
  };
}
