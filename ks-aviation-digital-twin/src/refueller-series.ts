import type { Entity, SceneData } from './scene-data';
import { R14, r14Dimensions } from './r14-spec';

export const REFUELLERS = {
  R14_2000:{series:2000,tr:'2000 · Sabit şasi · 38.000 L',en:'2000 · Rigid chassis · 38,000 L'},
  R14:{series:3000,tr:'3000 · Mafsallı · 38.000 L',en:'3000 · Articulated · 38,000 L'},
} as const;
export type FleetNumbers=Partial<Record<2000|3000,number>>;
export const isRefueller=(preset:string)=>Object.hasOwn(REFUELLERS,preset);
export const refuellerSeries=(preset:string)=>REFUELLERS[preset as keyof typeof REFUELLERS]?.series;
export function refuellerDimensions(preset:string,length=13.5,scale=1){
  const d=r14Dimensions(length,scale);
  return preset==='R14_2000'?{wheelbase:((R14.tractorAxle+R14.trailerAxle)/2-R14.frontAxle)*length/R14.length*scale,trailerWheelbase:0,hitchOffset:0,maxTrailerAngle:R14.maxArticulation}:d;
}
export function validateFleetNumbers(value:unknown,entities:Entity[]):FleetNumbers{
  const result:FleetNumbers={};
  for(const series of [2000,3000] as const){
    const saved=(value as FleetNumbers|undefined)?.[series];
    const numbers=entities.filter(e=>refuellerSeries(e.preset)===series&&/^\d+$/.test(e.name)).map(e=>Number(e.name)).filter(n=>n>=series&&n<series+1000);
    const high=Math.max(series,...numbers,typeof saved==='number'&&Number.isInteger(saved)&&saved>=series&&saved<series+1000?saved:series);
    if(high>series)result[series]=high;
  }
  return result;
}
/** Called inside a scene change for placement, duplication and paste. */
export function numberRefueller(scene:SceneData,entity:Entity){
  const series=refuellerSeries(entity.preset);if(!series)return;
  const numbers=validateFleetNumbers(scene.fleetNumbers,scene.entities),next=(numbers[series]||series)+1;
  if(next>=series+1000)throw new Error(`${series}: araç numaraları dolu / vehicle number range is full`);
  numbers[series]=next;scene.fleetNumbers=numbers;entity.name=String(next);
}
