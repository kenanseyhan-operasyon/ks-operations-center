import type {Entity} from './scene-data';
export function pipeElevation(o:Entity){const p=o.facility?.pipePath;if(!p?.length)return undefined;return o.position[1]+p[o.facility?.ringStartIndex??0][1]*o.scale;}
/** Ring height changes only the upper riser and ring; the supply/valve region stays fixed. */
export function setPipeElevation(o:Entity,height:number){const path=o.facility?.pipePath,current=pipeElevation(o);if(!path?.length||current===undefined||!Number.isFinite(height)||height< -100||height>1000)throw Error('Geçerli boru kotu girin.');const delta=(height-current)/o.scale,start=o.facility?.ringStartIndex===undefined?0:Math.max(0,o.facility.ringStartIndex-1);o.facility={...o.facility,pipePath:path.map((p,i)=>[p[0],p[1]+(i>=start?delta:0),p[2]]),routeEdited:true};}
