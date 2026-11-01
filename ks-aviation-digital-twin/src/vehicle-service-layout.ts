import * as T from 'three';
import {cabUnits as u} from './cab-reference';

/** Shorten the six 219 mm risers by 100 mm, retaining their chassis seats.
 * Move the complete lift and equipment, never the animated basket in isolation. */
export function lowerEquipmentDeck(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry){
  const deck=model.getObjectByName('Shared_Grey_Equipment_Deck'),drop=u(.10);
  if(!deck||deck.userData.loweredMounts)return;
  deck.userData.loweredMounts=true;model.updateWorldMatrix(true,true);
  const shorten=(n:T.Mesh)=>{
    const bounds=new T.Box3().setFromObject(n),height=bounds.max.y-bounds.min.y;
    const g=own(n.geometry.clone()),p=g.attributes.position,inverse=n.matrixWorld.clone().invert();
    for(let i=0;i<p.count;i++){
      const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld);
      v.y=bounds.min.y+(v.y-bounds.min.y)*(height-drop)/height;
      v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);
    }
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();n.geometry=g;
  };
  const supports:T.Mesh[]=[],stringers:T.Mesh[]=[],mounted:T.Object3D[]=[deck];
  model.traverse(n=>{
    if(n instanceof T.Mesh&&/^Deck_Chassis_Support(?:_\d+)?$/.test(n.name))supports.push(n);
    if(n instanceof T.Mesh&&/^Ladder_Stringer(?:_\d+)?$/.test(n.name))stringers.push(n);
    if(/^(06_CONTROL_PANEL|07_SAMPLE_JAR|08_BONDING|Meter_Backlit_Digits)$/.test(n.name)||/^(Drum_Exit_|Panel_Worklight_)/.test(n.name))mounted.push(n);
  });
  for(const support of supports){model.attach(support);shorten(support);}
  for(const stringer of stringers)shorten(stringer);
  const roots=mounted.filter(n=>{for(let p=n.parent;p;p=p.parent)if(mounted.includes(p))return false;return true;});
  for(const n of roots){
    const point=n.getWorldPosition(new T.Vector3());point.y-=drop;
    n.position.copy(n.parent!.worldToLocal(point));
  }
  model.updateWorldMatrix(true,true);
}

/** Keep the moving basket, gates and both scissor stages in one coordinate frame.
 * Animated local positions remain unchanged when the complete assembly moves. */
export function refitServicePlatform(model:T.Object3D,own:(g:T.BufferGeometry)=>T.BufferGeometry,metal:T.Material){
  const advance=u(.15),platform=model.getObjectByName('Platform_Double_Scissor');
  if(!platform||platform.userData.forwardRefit)return;
  platform.userData.forwardRefit=true;platform.position.x-=advance;
  const steps=model.getObjectByName('Fixed_Lower_Access_Steps');if(steps)steps.position.x-=advance;
  for(const name of ['Deck_Chassis_Support','Deck_Chassis_Support_1']){const n=model.getObjectByName(name);if(n)n.position.x-=advance;}
  model.updateWorldMatrix(true,true);
  const deck=model.getObjectByName('Common_Flat_Grey_Floor');
  if(deck instanceof T.Mesh){
    const bounds=new T.Box3().setFromObject(deck),g=own(deck.geometry.clone()),p=g.attributes.position,inverse=deck.matrixWorld.clone().invert();
    for(let i=0;i<p.count;i++){
      const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(deck.matrixWorld);
      // Extend the front edge only; equipment at the rear keeps its mounting datum.
      v.x-=advance*(1-T.MathUtils.smoothstep(v.x,bounds.min.x,bounds.min.x+.17));
      v.applyMatrix4(inverse);p.setXYZ(i,v.x,v.y,v.z);
    }
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();deck.geometry=g;
  }
  const basket=model.getObjectByName('Platform_Moving_Basket');if(!basket)return;
  const first=basket.getObjectByName('Wing_Contact_Antenna'),second=basket.getObjectByName('Wing_Contact_Antenna_1');
  if(first&&second)for(const [i,source,other] of [[2,first,second],[3,second,first]] as const){
    const antenna=source.clone(true);antenna.name='Wing_Contact_Antenna_'+i;
    const a=new T.Box3().setFromObject(source).getCenter(new T.Vector3()),b=new T.Box3().setFromObject(other).getCenter(new T.Vector3());
    antenna.position.z+=b.z-a.z;
    antenna.traverse(n=>{if(n!==antenna)n.name=n.name.replace(/_\d+$/,'')+'_'+i;});basket.add(antenna);
  }
  const button=basket.getObjectByName('Platform_Lift_Toggle_Button') as T.Mesh|undefined;
  if(button){
    // Re-centre before rotating: the source button has baked world vertices.
    const g=own(button.geometry.clone());g.computeBoundingBox();const centre=g.boundingBox!.getCenter(new T.Vector3());g.translate(-centre.x,-centre.y,-centre.z);button.geometry=g;
    const floor=basket.getObjectByName('Platform_Grey_Floor')!;const bounds=new T.Box3().setFromObject(floor),point=bounds.getCenter(new T.Vector3());
    const rail=basket.getObjectByName('Basket_Back_Rail_1')!,railBounds=new T.Box3().setFromObject(rail);
    point.y=railBounds.getCenter(new T.Vector3()).y-u(.045);point.z=railBounds.max.z+u(.054);
    button.position.copy(basket.worldToLocal(point));button.rotation.y=Math.PI;button.scale.set(1,1,1);
    const plate=new T.Mesh(own(new T.BoxGeometry(u(.18),u(.19),u(.018))),metal);plate.name='PLATFORM_CONTROL_MOUNT';plate.userData.sharedAsset=true;
    plate.position.copy(button.position);plate.position.z-=u(.045);basket.add(plate);
  }
  // Place both amber markers on the forward side-guard upright, clear of the stairs.
  for(const suffix of ['1','8'])for(const part of ['Housing','Amber']){
    const marker=model.getObjectByName(`Side_Marker_${part}_${suffix}`);if(!marker)continue;
    marker.position.x+=u(.22);
  }
  for(const side of [-1,1]){
    const bracket=new T.Mesh(own(new T.BoxGeometry(u(.11),u(.24),u(.018))),metal);bracket.name='PLATFORM_SIDE_MARKER_MOUNT';bracket.userData.sharedAsset=true;
    bracket.position.set(-.48+u(.22),-.291,.155+side*.194);model.add(bracket);
  }
  model.updateWorldMatrix(true,true);
}
