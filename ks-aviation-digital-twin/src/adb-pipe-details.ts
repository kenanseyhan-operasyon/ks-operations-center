import type {Entity,SceneData} from './scene-data';import {localToWorld,worldToLocal} from './facility-data';import {setPipeElevation} from './pipe-elevation';import type {Point3} from './socar-fire-layout';
/** Narrow repair of the exact revision-17 geometry supplied by the user.
 * Any subsequent manual geometry edit fails the fingerprint and is preserved.
 * This never writes cloud data; normal Save persists the repaired scene. */
export function detailFingerprint(e:Entity){const text=JSON.stringify([e.position,e.heading,e.scale,e.width,e.length,e.height,e.points,e.facility?.pipePath,e.facility?.supplyRoute,e.facility?.supplyId]);let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return (hash>>>0).toString(16)+':'+text.length;}
const baseline:Record<string,string>={"adb-fire-cool-1-outlet":"85918db1:4201","adb-fire-cool-2-outlet":"66dbc072:4222","adb-fire-loading-outlet":"8d5e6a0c:897","mtfhc483jg7zz9":"ee7281b5:111","4d41e8fa-fd2d-4eee-9a7b-1af6e32657e3":"d9907168:174","adb-fire-receiving-outlet":"cf48e67f:818","adb-fire-receiving-roof":"5bc351fb:57"};
export function repairAdbPipeDetails(scene:SceneData){const map=new Map(scene.entities.map(e=>[e.id,e])),matches=(id:string)=>{const e=map.get(id);return e&&detailFingerprint(e)===baseline[id]?e:undefined;};let changed=false;
 for(const id of ['adb-fire-cool-1-outlet','adb-fire-cool-2-outlet']){const e=matches(id);if(!e)continue;setPipeElevation(e,9.45);changed=true;}
 const loading=matches('adb-fire-loading-outlet'),roof=matches('mtfhc483jg7zz9'),drain=matches('4d41e8fa-fd2d-4eee-9a7b-1af6e32657e3');
 if(loading&&roof&&drain){const f=loading.facility!,route=f.supplyRoute!.map(p=>localToWorld(loading,p)),channel=drain.points!.map(p=>localToWorld(drain,[p[0],0,p[1]]));channel.sort((a,b)=>Math.hypot(a[0]-route[7][0],a[2]-route[7][2])-Math.hypot(b[0]-route[7][0],b[2]-route[7][2]));const lower=(p:Point3):Point3=>[p[0],-.18,p[2]],riser=route[10],topY=localToWorld(roof,[0,roof.height-.25,0])[1],riserTop:Point3=[riser[0],topY,riser[2]],local=worldToLocal(roof,riserTop),center=localToWorld(roof,[0,roof.height-.25,local[2]]),end=localToWorld(roof,[0,roof.height-.25,local[2]>0?-roof.length*.44:roof.length*.44]),inlet:Point3=[riser[0],topY-.25,riser[2]];
 f.supplyRoute=[...f.supplyRoute!.slice(0,7),...[lower(route[6]),lower(channel[0]),lower(channel[1]),[channel[1][0],route[8][1],channel[1][2]] as Point3,route[9],riser].map(p=>worldToLocal(loading,p))];
 f.pipePath=[inlet,riserTop,center,end].map(p=>worldToLocal(loading,p));f.routeEdited=true;delete f.unverifiedSupplySpan;changed=true;
 }
 const receiving=matches('adb-fire-receiving-outlet'),smallRoof=matches('adb-fire-receiving-roof');
 if(receiving&&smallRoof){const f=receiving.facility!,old=f.supplyRoute!.map(p=>localToWorld(receiving,p)),roofPoint=(p:Point3)=>localToWorld(smallRoof,p),lastLocal=worldToLocal(smallRoof,old[9]),near=lastLocal[2]<0?-1:1,side=lastLocal[0]<0?-1:1,z=near*smallRoof.length*.44,x=side*smallRoof.width*.47,y=smallRoof.height-.25,top=roofPoint([x,y,z]),inlet=roofPoint([x,y-.25,z]),centre=roofPoint([0,y,z]),end=roofPoint([0,y,-z]),down=roofPoint([0,y-1.25,-z]),floor=old[6][1],approachLocal=worldToLocal(smallRoof,old[6]);
 f.supplyRoute=[...f.supplyRoute!.slice(0,7),...[roofPoint([approachLocal[0],floor,z]),roofPoint([x,floor,z])].map(p=>worldToLocal(receiving,p))];f.pipePath=[inlet,top,centre,end,down].map(p=>worldToLocal(receiving,p));f.routeEdited=true;changed=true;}
 return changed;
}
