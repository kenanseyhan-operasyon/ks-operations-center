import * as THREE from 'three';

/** GLB rest transforms are not necessarily the first animation frame (R14 rails are raised).
 * Evaluate and hold every closed pose before measuring or showing the asset. */
export function closedAnimationPack(model:THREE.Object3D,clips:THREE.AnimationClip[]){
  const mixer=new THREE.AnimationMixer(model),actions=new Map<string,THREE.AnimationAction>();
  for(const clip of clips){
    const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;
    action.play();action.time=0;action.paused=true;actions.set(clip.name,action);
  }
  mixer.update(0);model.updateMatrixWorld(true);
  return {mixer,actions,open:new Set<string>()};
}
