export type PersonPose = 'idle'|'walk'|'bend'|'crouch'|'reach'|'valve'|'climb'|'seated'|'refuel';
export type PersonCamera = 'eyes'|'rear'|'front'|'top'|'free';
export type PersonSocket = 'driver'|'platform'|'roof'|'landing';
export type PersonnelSettings = {
  skin: 'light'|'medium'|'dark';
  vest: 'yellow'|'orange';
  attachment?: {targetId:string;socket:PersonSocket;headingOffset?:number};
};
export const PERSON_PRESET='REFUEL_OPERATOR';
export const personnelDefaults=():PersonnelSettings=>({skin:'medium',vest:'yellow'});
export function validatePersonnel(v:unknown):PersonnelSettings {
  const p=(v||{}) as Partial<PersonnelSettings>,out=personnelDefaults();
  if(['light','medium','dark'].includes(p.skin||''))out.skin=p.skin!;
  if(p.vest==='orange')out.vest='orange';
  const a=p.attachment;
  if(a&&typeof a.targetId==='string'&&a.targetId.length>0&&a.targetId.length<=180&&['driver','platform','roof','landing'].includes(a.socket))out.attachment={targetId:a.targetId,socket:a.socket,...(typeof a.headingOffset==='number'&&Number.isFinite(a.headingOffset)?{headingOffset:a.headingOffset%360}:{})};
  return out;
}
