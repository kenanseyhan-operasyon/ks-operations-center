/** Nathan 2.0: explicit, verifiable mapping of available source motions.
 * Source CMU 113 is from a post-pregnancy capture subject in CMU's index.
 * It is NOT a diagnosis or an assessment of the performer's age or fitness.
 * Keep it as an opt-in comparison ONLY, never an automatic fallback.
 */
export type StairMotionChoice='original'|'cmu83'|'cmu';
export type SpiralActivity='spiral-up'|'spiral-down';
export const CMU83_ASCENT_CLIP='CMU_83_34_Stairs_Up';
export const CMU113_ASCENT_CLIP='CMU_113_19_Stairs_Up';
export const CMU113_DESCENT_CLIP='CMU_113_19_Stairs_Down';

/** No 113 clip can play unless the user EXPLICITLY chooses `cmu`. */
export function chosenStairClip(choice:StairMotionChoice,activity:string,fallback:string):string{
  if(activity==='spiral-up'){
    if(choice==='cmu83')return CMU83_ASCENT_CLIP;
    if(choice==='cmu')return CMU113_ASCENT_CLIP;
  }
  if(activity==='spiral-down'&&choice==='cmu')return CMU113_DESCENT_CLIP;
  return fallback;
}

/** With CMU83 selected, descent must use the original clip, never CMU113. */
export function chosenStairCycleSeconds(
 choice:StairMotionChoice,activity:string,original:number,
 cmu83UpSeconds:number|undefined,cmu113UpSeconds:number|undefined,cmu113DownSeconds:number|undefined
):number{
 if(choice==='cmu'&&activity==='spiral-up'&&cmu113UpSeconds)return cmu113UpSeconds/2;
 if(choice==='cmu'&&activity==='spiral-down'&&cmu113DownSeconds)return cmu113DownSeconds/2;
 if(choice==='cmu83'&&activity==='spiral-up'&&cmu83UpSeconds)return cmu83UpSeconds/2;
 return original;
}
