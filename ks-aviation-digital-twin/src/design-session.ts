import type { SceneData } from './scene-data';
const content=(d:SceneData)=>JSON.stringify({...d,updatedAt:undefined});
/** Saving is explicit: mutations cannot overwrite the committed browser scene. */
export class DesignSession{
  private saved:SceneData;
  constructor(data:SceneData){this.saved=structuredClone(data);}
  dirty(data:SceneData){return content(data)!==content(this.saved);}
  commit(data:SceneData,write:(json:string)=>void){write(JSON.stringify(data));this.saved=structuredClone(data);}
  discard(){return structuredClone(this.saved);}
}
