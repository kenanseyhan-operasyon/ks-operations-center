import * as T from 'three';

/** The world-space operator/access controller, not the source FBX clip,
 * is responsible for moving Nathan's root between positions and levels.
 *
 * The imported Nathan GLB contains e.g. +289 raw root-Y units for walking
 * and -282 raw root-Y units for running. Playing that over the controller
 * causes obvious pops and backwards-looking locomotion. Strip only the
 * imported root POSITION channel for controller-driven in-place tasks.
 *
 * All finger/hip/foot rotation tracks remain untouched. Source assets,
 * alternate previews and user-authored weights remain unchanged.
 */
export const NATHAN_CONTROLLER_DRIVEN_CLIPS=new Set([
  'Nathan_Original_Walk','Running','Running_Up_Stairs',
  'Climbing','Climbing_Ladder','Climbing_To_Top',
  'Descending_Stairs','Walking_Turn_180'
]);
export const NATHAN_SOURCE_ROOT_POSITION='rp_nathan_animated_003_walking_root.position';

/** Safe to call multiple times: source AnimationClip objects are never modified. */
export function nathanInPlaceClip(source:T.AnimationClip):T.AnimationClip {
  if(!NATHAN_CONTROLLER_DRIVEN_CLIPS.has(source.name))return source;
  const cleaned=source.tracks.filter(track=>track.name!==NATHAN_SOURCE_ROOT_POSITION);
  if(cleaned.length===source.tracks.length)return source;
  return new T.AnimationClip(source.name,source.duration,cleaned,source.blendMode);
}
