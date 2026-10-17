import * as THREE from 'three';

/** Refit the folded scissors without changing the upper working position.
 * Clone the clip so other vehicles and the cached GLB keep independent state. */
export function platformAccessClip(source:THREE.AnimationClip){
  if(source.name!=='Platform_Raise_4s')return source;
  const clip=source.clone(),base=-.242,closed=.015,opened=.163,length=.17;
  for(const track of clip.tracks){
    const name=track.name.split('.')[0],position=track.name.endsWith('.position');
    for(let i=0;i<track.times.length;i++){
      const t=THREE.MathUtils.smoothstep(track.times[i]/clip.duration,0,1),height=THREE.MathUtils.lerp(closed,opened,t);
      if(position){
        const k=i*3+1;
        if(name.startsWith('Scissor_Stage_1_Arm'))track.values[k]=base+height/2;
        else if(name.startsWith('Scissor_Stage_2_Arm'))track.values[k]=base+height*1.5;
        else if(name==='Stage_Cross_Frame')track.values[k]=base+height;
        else if(name==='Stage_Cross_Frame_1')track.values[k]=base+height*2;
        else if(name==='Platform_Moving_Basket')track.values[k]=base+height*2+.012;
      }else if(name.startsWith('Scissor_Stage_')&&track.name.endsWith('.quaternion')){
        const k=i*4,sign=Math.sign(track.values[k+2])||1,angle=sign*Math.asin(height/length);
        track.values[k]=0;track.values[k+1]=0;track.values[k+2]=Math.sin(angle/2);track.values[k+3]=Math.cos(angle/2);
      }
    }
  }
  return clip;
}

/** GLB rest transforms are not necessarily the first animation frame (R14 rails are raised).
 * Evaluate and hold every closed pose before measuring or showing the asset. */
export function closedAnimationPack(model:THREE.Object3D,clips:THREE.AnimationClip[]){
  const mixer=new THREE.AnimationMixer(model),actions=new Map<string,THREE.AnimationAction>();
  for(const original of clips){
    const clip=platformAccessClip(original);
    const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;
    action.play();action.time=0;action.paused=true;actions.set(clip.name,action);
  }
  mixer.update(0);model.updateMatrixWorld(true);
  return {mixer,actions,open:new Set<string>()};
}
