import * as T from 'three';

/** Retargeted idle/walk thumb joints curl into the palm. Use a relaxed local
 * rest-relative pose for these free-hand clips only; never edit the cached GLB
 * or the grasp poses in Driving/Opening/climbing clips. Mixer transitions then
 * blend the corrected thumb tracks together with the rest of the body. */
export function relaxNathanThumbs(source:T.AnimationClip,rest:T.Object3D){
  if(!['Idle','Nathan_Original_Walk'].includes(source.name))return source;
  const clip=source.clone(),q=new T.Quaternion();
  for(const track of clip.tracks){
    if(!/_thumb_0[123]_[lr]\.quaternion$/.test(track.name))continue;
    const bone=rest.getObjectByName(track.name.slice(0,-'.quaternion'.length));
    if(!bone)continue;
    for(let i=0;i<track.values.length;i+=4){
      q.fromArray(track.values,i).normalize();
      // Keep a little natural flex without forcing the thumb onto the palm.
      q.copy(bone.quaternion).slerp(new T.Quaternion().fromArray(track.values,i).normalize(),.18).normalize().toArray(track.values,i);
    }
  }
  return clip;
}
