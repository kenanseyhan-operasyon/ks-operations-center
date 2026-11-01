import * as T from 'three';

const prefix='rp_nathan_animated_003_walking_';
/** Calibrate the cylindrical grasp from Nathan's own Driving finger tracks.
 * The contact is the space enclosed by the fingers, not the wrist/knuckles.
 * All measurements remain in hand-local units, including the mirrored hand. */
export class NathanGrasp {
  readonly centre=new T.Vector3();
  readonly direction=new T.Vector3();
  readonly fingers=new Map<T.Object3D,T.Quaternion>();
  private basisInverse=new T.Quaternion();
  private radius=-1;
  private poses=new Map<number,{centre:T.Vector3;basis:T.Quaternion;fingers:Map<T.Object3D,T.Quaternion>}>();
  constructor(readonly hand:T.Object3D,private model:T.Object3D,private clip:T.AnimationClip,private side:string,private unit=hand.getWorldScale(new T.Vector3()).y){this.setRadius(.012);}
  setRadius(radius:number){
    radius=Math.round(radius*1000)/1000;if(radius===this.radius)return;this.radius=radius;
    const cached=this.poses.get(radius);
    if(cached){this.centre.copy(cached.centre);this.basisInverse.copy(cached.basis);this.fingers.clear();for(const [b,q]of cached.fingers)this.fingers.set(b,q);return;}
    const {hand,model,clip,side}=this,opening=T.MathUtils.clamp(1-(radius-.010)*22,.52,1.04);
    this.centre.set(0,0,0);this.fingers.clear();
    const saved=new Map<T.Object3D,T.Quaternion>();
    for(const track of clip.tracks){
      if(!new RegExp('_(thumb|index|middle|ring|pinky)_0[123]_'+side+'\\.quaternion$').test(track.name))continue;
      const bone=model.getObjectByName(track.name.split('.')[0]);if(!bone)continue;
      const interpolant=new T.QuaternionLinearInterpolant(track.times,track.values,4);
      const q=new T.Quaternion().fromArray(interpolant.evaluate(.3)).normalize();
      // The source is a closed fist. Open the first finger joint around the
      // 24–28 mm tube while retaining its distal curl, rather than squeezing
      // the rim through a fist's webbing.
      const finger=track.name.match(/_(index|middle|ring|pinky)_0([123])_/);
      if(finger){const axis=new T.Vector3(q.x,q.y,q.z).normalize();q.setFromAxisAngle(axis,[.75,1.25,.9][Number(finger[2])-1]*opening);}
      saved.set(bone,bone.quaternion.clone());this.fingers.set(bone,q);bone.quaternion.copy(q);
    }
    model.updateWorldMatrix(true,true);
    // Oppose the thumb outside the cylinder. The source's thumb crosses the
    // cylinder centre; a mirrored arc keeps the pad over the curled fingers.
    const sign=side==='l'?1:-1;
    const wide=T.MathUtils.clamp((radius-.010)/.015,0,1.6);
    for(const [i,d] of [[1,[.65-.55*wide,.75+.24*wide,-.06]],[2,[.68-.13*wide,.70+.13*wide,.22]],[3,[.95,.15*wide,.31]]] as [number,number[]][]){
      const bone=model.getObjectByName(prefix+'thumb_0'+i+'_'+side)!,child=bone.children[0];
      const current=child.getWorldPosition(new T.Vector3()).sub(bone.getWorldPosition(new T.Vector3())).normalize();
      const desired=new T.Vector3(...d as [number,number,number]).multiplyScalar(sign).transformDirection(hand.matrixWorld);
      const world=new T.Quaternion().setFromUnitVectors(current,desired).multiply(bone.getWorldQuaternion(new T.Quaternion()));
      bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));
      bone.updateWorldMatrix(false,true);this.fingers.set(bone,bone.quaternion.clone());
    }
    for(const finger of ['index','middle']){
      const [a,b,c]=[1,2,3].map(i=>hand.worldToLocal(model.getObjectByName(prefix+finger+'_0'+i+'_'+side)!.getWorldPosition(new T.Vector3())));
      // Circumcentre of the proximal, middle and distal knuckles in the curl plane.
      const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));
      const aa=a.x*a.x+a.y*a.y,bb=b.x*b.x+b.y*b.y,cc=c.x*c.x+c.y*c.y;
      this.centre.add(new T.Vector3((aa*(b.y-c.y)+bb*(c.y-a.y)+cc*(a.y-b.y))/d,
        (aa*(c.x-b.x)+bb*(a.x-c.x)+cc*(b.x-a.x))/d,(a.z+b.z+c.z)/3));
    }
    this.centre.multiplyScalar(.5);
    // Knuckle centres lie inside the finger flesh. Offset the cylinder toward
    // the wrist by 10% of the palm length to leave room for the inner pads.
    this.centre.x-=model.getObjectByName(prefix+'middle_01_'+side)!.position.x*.10;
    this.fitSurfaceClearance();
    this.direction.copy(hand.worldToLocal(model.getObjectByName(prefix+'middle_01_'+side)!.getWorldPosition(new T.Vector3()))).normalize();
    const z=new T.Vector3(0,0,1),x=this.centre.clone().setZ(0).normalize(),y=z.clone().cross(x);
    this.basisInverse.setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)).invert();
    this.poses.set(radius,{centre:this.centre.clone(),basis:this.basisInverse.clone(),fingers:new Map(this.fingers)});
    for(const [bone,q] of saved)bone.quaternion.copy(q);
    model.updateWorldMatrix(true,true);
  }
  /** Fit to the rendered hand surface, including the thumb and finger pads.
   * Knuckle-centre calibration alone put 3 mm of the left palm into the tube. */
  private fitSurfaceClearance(){
    const {hand,model}=this,triangles:number[][]=[];
    model.updateWorldMatrix(true,true);
    model.traverse(n=>{
      if(!(n instanceof T.SkinnedMesh))return;
      const g=n.geometry,skin=g.attributes.skinIndex,weights=g.attributes.skinWeight,vertices:T.Vector3[]=[],included:boolean[]=[];
      const handBones=new Set<number>();n.skeleton.bones.forEach((b,i)=>{for(let p:T.Object3D|null=b;p;p=p.parent)if(p===hand){handBones.add(i);break;}});
      for(let i=0;i<g.attributes.position.count;i++){
        let weight=0;for(let j=0;j<4;j++)if(handBones.has(skin.array[i*4+j]))weight+=weights.array[i*4+j];included.push(weight>.7);
        if(weight>.7)vertices[i]=hand.worldToLocal(n.getVertexPosition(i,new T.Vector3()).applyMatrix4(n.matrixWorld));
      }
      const indices=g.index?.array||Array.from({length:g.attributes.position.count},(_,i)=>i);
      for(let i=0;i<indices.length;i+=3)if([0,1,2].every(j=>included[indices[i+j]])){
        const [a,b,c]=[0,1,2].map(j=>vertices[indices[i+j]]);triangles.push([a.x,a.y,b.x,b.y,c.x,c.y]);
      }
    });
    const distance=(x:number,y:number)=>{
      let best=Infinity;
      for(const t of triangles){
        let positive=true,negative=true;
        for(let i=0;i<3;i++){
          const j=(i+1)%3,ax=t[i*2],ay=t[i*2+1],dx=t[j*2]-ax,dy=t[j*2+1]-ay,cross=dx*(y-ay)-dy*(x-ax);
          positive&&=cross>=0;negative&&=cross<=0;
          const f=T.MathUtils.clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);
          best=Math.min(best,(x-ax-dx*f)**2+(y-ay-dy*f)**2);
        }
        if(positive||negative)return 0;
      }
      return best;
    };
    const unit=this.unit,origin=this.centre.clone();let x=origin.x,y=origin.y,best=-1;
    for(const step of [.004,.0015,.0005]){
      const cx=x,cy=y,extent=step===.004?4:2;
      for(let i=-extent;i<=extent;i++)for(let j=-extent;j<=extent;j++){
        const px=cx+i*step/unit,py=cy+j*step/unit,d=distance(px,py);
        if(d>best){best=d;x=px;y=py;}
      }
    }
    this.centre.set(x,y,origin.z);
  }
  rotation(target:T.Vector3,shoulder:T.Vector3,tangent:T.Vector3,side:number,fallback:T.Vector3){
    const z=tangent.clone().normalize().multiplyScalar(side===0?-1:1);
    const x=target.clone().sub(shoulder).addScaledVector(z,-target.clone().sub(shoulder).dot(z));
    if(x.lengthSq()<1e-8)x.copy(fallback).addScaledVector(z,-fallback.dot(z));
    if(x.lengthSq()<1e-8)x.set(1,0,0).addScaledVector(z,-z.x);
    x.normalize();const y=z.clone().cross(x).normalize();
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)).multiply(this.basisInverse);
  }
}
