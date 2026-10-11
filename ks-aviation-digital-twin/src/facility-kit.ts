import {newEntity,id,type Entity} from './scene-data';
/** A reusable connected assembly; never replaces a saved facility or claims its operating procedure. */
export function makeWaterFoamAssembly(x:number,z:number,lang:'tr'|'en'){
  const entities:Entity[]=[],gid=id();
  const add=(preset:string,dx:number,dz:number,tr:string,en:string,extra:Entity['facility']={})=>{const o=newEntity(preset,x+dx,z+dz,lang);o.name=lang==='tr'?tr:en;o.groupId=gid;o.facility={...o.facility,...extra};entities.push(o);return o;};
  const source=add('WATER_SOURCE',0,-4,'Su beslemesi','Water supply');
  const main=add('PIPE_TEE',0,-2,'Su kollektörü','Water manifold',{supplyId:source.id});
  const concentrate=add('FOAM_TANK',-4,0,'Köpük tankı · 1.000 L','Foam tank · 1,000 L');
  const foamValve=add('PIPE_VALVE',-2.5,0,'Konsantre çıkış vanası','Concentrate outlet valve',{tag:'KONSANTRE',open:true,supplyId:concentrate.id});
  for(const [i,dx] of [[1,0],[2,2.5]]){
    const valve=add('PIPE_VALVE',dx,0,`Tank ${i} karıştırıcı su girişi`,`Tank ${i} eductor water inlet`,{tag:`SU-K${i}`,supplyId:main.id,open:true});
    const eductor=add('FOAM_EDUCTOR',dx,2,`Tank ${i} köpük karıştırıcısı`,`Tank ${i} foam eductor`,{supplyId:valve.id,concentrateId:foamValve.id,ratio:3});
    add('FIRE_MONITOR',dx,4.5,`Köpüklü su çıkışı ${i}`,`Foam solution outlet ${i}`,{supplyId:eductor.id,open:false});
    const waterValve=add('PIPE_VALVE',5+(i-1)*2.2,0,`Tank ${i} soğutma vanası`,`Tank ${i} cooling valve`,{tag:`SOĞUTMA-${i}`,supplyId:main.id,open:true});
    add('TANK_COOLING',5+(i-1)*2.2,3,`Tank ${i} soğutma çıkışı`,`Tank ${i} cooling outlet`,{supplyId:waterValve.id,open:false});
  }
  return {entities,group:{id:gid,name:lang==='tr'?'Su / köpük bağlantı takımı':'Water / foam connected assembly'}};
}
