import {FACILITY_CATALOG,type FacilityCategory} from './facility-data';
/** Offline renders of the same default models used by placement, not category icons. */
export function facilityThumbnail(id:string,_category:FacilityCategory,_color:string){
 if(!Object.hasOwn(FACILITY_CATALOG,id))return '';
 const base=import.meta.env?.BASE_URL||'/';
 return `<img src="${base}facility-previews/${id}.svg" alt="" width="384" height="288" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:contain">`;
}
