import type {Entity} from './scene-data';
import {fillHeightAt,isGroundFill} from './ground-fill';
const floorEquipment=new Set(['MANHOLE','SAFETY_SHOWER','CHAIN_POSTS','BOLLARD','LIGHT_CAM','FLAG_TR','FLAG_AZ','FLAG_SOCAR','FIRE_MONITOR','HYDRANT_POINT','HOSE_CABINET','EXTINGUISHER_TROLLEY','FOAM_DRUM','FOAM_TANK','SPILL_KIT','FIRE_EXT','GUARD_CABIN','DRIVER_WC','DIESEL_UNIT','WASTE_SHELTER','SMOKING_AREA','FOAM_SHELTER']);
/** Footings follow the surface; manually elevated and attached objects keep their offsets. */
export function groundSupportLift(e:Entity,entities:Entity[],visited=new Set<string>()):number{
 if(visited.has(e.id))return 0;visited.add(e.id);if(e.facility?.mount){const parent=entities.find(p=>p.id===e.facility!.mount!.parentId);return parent?groundSupportLift(parent,entities,visited):0;}
 if(e.kind!=='tree'&&!floorEquipment.has(e.preset))return 0;
 const surface=Math.max(0,...entities.filter(isGroundFill).map(f=>fillHeightAt(f,[e.position[0],e.position[2]])??0));
 const offset=e.preset==='MANHOLE'?e.height*e.scale-.006:0;return Math.max(0,surface-e.position[1]-offset);
}
