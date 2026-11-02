import {AnimationClip,MathUtils} from 'three';

export const MIXAMO_MOTION_URL='/mocap/mixamo/nathan-mixamo.json';
export const MIXAMO_MOTIONS=[
 {id:'start-walking',label:'Yürümeye başla',file:'Start Walking.fbx',name:'Mixamo_Start_Walking',kind:'start'},
 {id:'walking',label:'Yürü',file:'Walking.fbx',name:'Mixamo_Walking',kind:'walk'},
 {id:'stop-walking',label:'Yürüyüşü bitir',file:'Stop Walking.fbx',name:'Mixamo_Stop_Walking',kind:'stop'},
 {id:'ascending-stairs',label:'Merdiven A',file:'Ascending Stairs.fbx',name:'Mixamo_Ascending_Stairs',kind:'stairs'},
 {id:'walking-up-stairs',label:'Merdiven B',file:'Walking Up The Stairs.fbx',name:'Mixamo_Walking_Up_The_Stairs',kind:'stairs'}
] as const;
export type MixamoMotionId=typeof MIXAMO_MOTIONS[number]['id'];
export type MixamoMotion={
 id:MixamoMotionId;label:string;file:string;name:string;kind:'start'|'walk'|'stop'|'stairs';
 duration:number;clip:AnimationClip;mappedBones:number;
 source:{file:string;sha256:string;duration:number;frames:number;translationScale:number};
 /** Captured displacement in the target GLTF model coordinate space, metres. */
 displacement:[number,number,number];
 /** Model-space hips and calibrated sole samples; actor normalizer is not applied. */
 trajectory:{times:number[];hips:[number,number,number][];leftFoot:[number,number,number][];rightFoot:[number,number,number][]};
};
type SerializedMotion=Omit<MixamoMotion,'clip'>&{clip:Parameters<typeof AnimationClip.parse>[0]};

/** The asset is baked once from the supplied FBX files against Nathan's bind
 * skeleton. Raw hip translation and complete lower-body rotations survive. */
export function parseMixamoMotions(data:unknown):MixamoMotion[]{
 const asset=data as {schema?:number;motions?:SerializedMotion[]};
 if(asset?.schema!==1||!Array.isArray(asset.motions)||asset.motions.length!==5)
  throw Error('Beş Mixamo kaydı bekleniyordu.');
 return MIXAMO_MOTIONS.map(definition=>{
  const record=asset.motions!.find(motion=>motion.id===definition.id);
  if(!record||record.name!==definition.name||record.file!==definition.file||record.kind!==definition.kind||
   !(record.duration>0)||record.mappedBones!==52||!/^[0-9a-f]{64}$/.test(record.source?.sha256??''))
   throw Error('Mixamo kayıt kimliği geçersiz: '+definition.id);
  // AnimationClip.parse assigns json.uuid even when it is absent. The baked
  // asset deliberately omits random runtime identities for reproducibility;
  // without replacing it, AnimationMixer aliases all clips under undefined.
  const clip=AnimationClip.parse({...record.clip,uuid:MathUtils.generateUUID()});
  const hip=clip.tracks.find(track=>track.name==='rp_nathan_animated_003_walking_hip.position');
  const required=['hip','upperleg_l','lowerleg_l','foot_l','ball_l','upperleg_r','lowerleg_r','foot_r','ball_r'];
  const fullLowerBody=required.every(bone=>clip.tracks.some(track=>track.name===`rp_nathan_animated_003_walking_${bone}.quaternion`));
  if(!hip||hip.times.length<2||!fullLowerBody||clip.name!==definition.name||!clip.validate())
   throw Error('Mixamo kalça hareketi eksik: '+definition.id);
  return {...record,clip};
 });
}
