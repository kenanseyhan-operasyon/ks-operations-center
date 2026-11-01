import * as T from 'three';

/** Seat the sampler on its actual deck. An embedded foot shared a vertical
 * front face with the deck, producing the black/white interference band. */
export function seatSampleJar(model:T.Object3D){
 model.updateWorldMatrix(true,true);
 const deck=model.getObjectByName('Common_Flat_Grey_Floor'),foot=model.getObjectByName('Jar_Deck_Foot'),jar=model.getObjectByName('Sample_Jar');
 if(!deck||!foot||!jar)return;
 const move=(node:T.Object3D,dy:number)=>{const point=node.getWorldPosition(new T.Vector3());point.y+=dy;node.position.copy(node.parent!.worldToLocal(point));model.updateWorldMatrix(true,true);};
 move(foot,new T.Box3().setFromObject(deck).max.y-new T.Box3().setFromObject(foot).min.y);
 move(jar,new T.Box3().setFromObject(foot).max.y-new T.Box3().setFromObject(jar).min.y);
}

/** Two independent spring leaves need separate meeting posts. The supplied
 * closed pose put both posts in precisely the same place. Keep both hinges. */
export function separatePlatformGateFaces(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry){
 model.updateWorldMatrix(true,true);
 for(const [prefix,sign] of [['Gate_',-1],['Rear_Leaf_Gate_',1]] as const){
  model.traverse(node=>{
   if(!(node instanceof T.Mesh)||!(node.name===prefix+'Reinforced_Upright_1'||new RegExp('^'+prefix+'Rail(?:_\\d+)?$').test(node.name)))return;
   const b=new T.Box3().setFromObject(node),g=own(node.geometry.clone()),p=g.attributes.position,inverse=node.matrixWorld.clone().invert(),gap=.00225;
   for(let i=0;i<p.count;i++){
    const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(node.matrixWorld);
    if(node.name.endsWith('Upright_1'))v.x+=sign*gap;
    else v.x=sign<0?b.min.x+(v.x-b.min.x)*(b.max.x-b.min.x-gap)/(b.max.x-b.min.x):b.min.x+gap+(v.x-b.min.x)*(b.max.x-b.min.x-gap)/(b.max.x-b.min.x);
    v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);
   }
   g.computeBoundingBox();g.computeBoundingSphere();node.geometry=g;
  });
 }
}
