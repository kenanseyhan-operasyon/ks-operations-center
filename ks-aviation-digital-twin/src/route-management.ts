import type {DriveRoute} from './vehicle-motion';
const normal=(name:string)=>name.trim().replace(/\s+/g,' ').toLocaleLowerCase('tr');
export function cleanRouteName(name:string){return name.trim().replace(/\s+/g,' ').slice(0,100);}
export function routeNameTaken(routes:DriveRoute[],vehicleId:string,name:string,exceptId=''){
  return routes.some(r=>r.vehicleId===vehicleId&&r.id!==exceptId&&normal(r.name)===normal(name));
}
export function nextRouteName(routes:DriveRoute[],vehicleId:string,base:string){
  const name=cleanRouteName(base);if(!routeNameTaken(routes,vehicleId,name))return name;
  for(let n=2;;n++){const suffix=` (${n})`,candidate=name.slice(0,100-suffix.length)+suffix;if(!routeNameTaken(routes,vehicleId,candidate))return candidate;}
}
/** Ordinals also distinguish pre-existing duplicate names without altering saved routes. */
export function routeOptionLabel(route:DriveRoute,index:number){
  const length=route.points.reduce((s,p,i)=>i?s+Math.hypot(p[0]-route.points[i-1][0],p[1]-route.points[i-1][1]):s,0);
  return `${String(index+1).padStart(2,'0')} · ${route.name} · ${Math.round(length)} m`;
}
