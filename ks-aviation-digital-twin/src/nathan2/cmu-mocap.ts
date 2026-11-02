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
import { retargetClip, clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { NathanActor } from '../nathan-model';

export const CMU_113_19_URL = '/mocap/cmu/113_19.bvh';
export const CMU_ASCENT_SECONDS = [0.87, 3.05] as const;
export const CMU_DESCENT_SECONDS = [3.60, 5.35] as const;
export const CMU_UP_NAME='CMU_113_19_Stairs_Up';
export const CMU_DOWN_NAME='CMU_113_19_Stairs_Down';
export const NATHAN_RIG_PREFIX='rp_nathan_animated_003_walking_';

/** Real target bone suffix -> original CMU BVH name. */
export const CMU_TO_NATHAN_BONES:Readonly<Record<string,string>> = {
  hip:'Hips',spine_01:'LowerBack',spine_02:'Spine',spine_03:'Spine1',
  neck:'Neck',head:'Head',
  clavicle_l:'LeftShoulder',upperarm_l:'LeftArm',lowerarm_l:'LeftForeArm',hand_l:'LeftHand',
  clavicle_r:'RightShoulder',upperarm_r:'RightArm',lowerarm_r:'RightForeArm',hand_r:'RightHand',
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
export function retargetCmu11319(actor:NathanActor,bvhText:string):CmuStairCapture {
  if(!bvhText.startsWith('HIERARCHY')||!bvhText.includes('MOTION'))throw Error('CMU BVH source invalid or incomplete');
  const source=new BVHLoader().parse(bvhText);
  const snapshot=cloneSkinned(actor.model);
  let mesh:T.SkinnedMesh|undefined;
  snapshot.traverse(obj=>{if(!mesh&&obj instanceof T.SkinnedMesh)mesh=obj;});
  if(!mesh)throw Error('Nathan has no skinned rig to retarget');
  const srcNames=new Set(source.skeleton.bones.map(b=>b.name));
  const tgtNames=new Set(mesh.skeleton.bones.map(b=>b.name));
  const names:Record<string,string>={};
  for(const [suffix,origin] of Object.entries(CMU_TO_NATHAN_BONES)){
    const target=NATHAN_RIG_PREFIX+suffix;
    if(srcNames.has(origin)&&tgtNames.has(target))names[target]=origin;
  }
  for(const required of ['hip','upperleg_l','lowerleg_l','foot_l','upperleg_r','lowerleg_r','foot_r','upperarm_l','hand_l','upperarm_r','hand_r']){
    if(!names[NATHAN_RIG_PREFIX+required])throw Error('Missing essential Nathan/CMU map: '+required);
  }
  // This returns a clip with .bones[NAME] bindings for a SkinnedMesh root.
  // NathanActor uses an Object3D animation root; translate the bindings to
  // node names, preserve rotations, and reject all double root translations.
  const temp=retargetClip(mesh,source.skeleton,source.clip,{
    names,hip:'Hips',hipInfluence:new T.Vector3(0,0,0),fps:30,
    preserveBoneMatrix:true,useFirstFramePosition:true
  });
  const clean=temp.tracks.filter(track=>track.name.endsWith('.quaternion')).map(track=>{
    const cloned=track.clone();
    cloned.name=cloned.name.replace(/^\.bones\[([^\]]+)\]\.quaternion$/,(_all:string,bone:string)=>bone+'.quaternion');
    return cloned;
  });
  if(clean.length<14||clean.some(track=>track.name.startsWith('.bones[')))
    throw Error('CMU retarget produced incomplete/unbound Nathan tracks: '+clean.length);
  const whole=new T.AnimationClip('CMU_113_19_Full',temp.duration,clean);
  const up=T.AnimationUtils.subclip(whole,CMU_UP_NAME,Math.round(CMU_ASCENT_SECONDS[0]*30),Math.round(CMU_ASCENT_SECONDS[1]*30),30);
  const down=T.AnimationUtils.subclip(whole,CMU_DOWN_NAME,Math.round(CMU_DESCENT_SECONDS[0]*30),Math.round(CMU_DESCENT_SECONDS[1]*30),30);
  for(const clip of [up,down]){
    if(clip.duration<=.6||clip.tracks.length<14)throw Error('Invalid retargeted CMU motion '+clip.name);
    // Avoid quaternion sign inversion on closely sampled motion clips.
    for(const track of clip.tracks)if(track instanceof T.QuaternionKeyframeTrack)
      for(let i=4;i<track.values.length;i+=4){
        const a=track.values,dot=a[i-4]*a[i]+a[i-3]*a[i+1]+a[i-2]*a[i+2]+a[i-1]*a[i+3];
        if(dot<0)for(let k=0;k<4;k++)a[i+k]*=-1;
      }
  }
  return {
    sourceFrames:source.clip.tracks.find(track=>track.name==='Hips.position')?.times.length||0,
    sourceSeconds:source.clip.duration,mappedBones:Object.keys(names).length,
    ascent:up,descent:down
  };
}
