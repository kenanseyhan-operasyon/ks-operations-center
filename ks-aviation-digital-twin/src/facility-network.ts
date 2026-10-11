import type {Entity} from './scene-data';
import {isNetwork,isOutlet,isFoamStore} from './facility-data';
export type Fluid='none'|'water'|'concentrate'|'solution';
export type FlowState={fluid:Fluid;available:boolean;flowing:boolean;ratio:number;reason:'ready'|'closed'|'no-supply'|'empty'|'cycle'|'wrong-fluid'|'water-only'|'idle';path:string[];foamPath:string[];foamTank?:string;eductor?:string};
export type TrainingEvent={seconds:number;id:string;name:string;action:string};
const empty=(reason:FlowState['reason']='no-supply'):FlowState=>({fluid:'none',available:false,flowing:false,ratio:0,reason,path:[],foamPath:[]});
/** A directed connectivity model. No inferred pressure, discharge capacity or fire outcome. */
export class FacilityNetwork{
  active=false;seconds=0;events:TrainingEvent[]=[];open=new Map<string,boolean>();enabled=new Map<string,boolean>();levels=new Map<string,number>();alarms=new Set<string>();states=new Map<string,FlowState>();
  reset(entities:Entity[]){this.seconds=0;this.events=[];this.open.clear();this.enabled.clear();this.levels.clear();this.alarms.clear();for(const o of entities){this.open.set(o.id,o.facility?.open??true);this.enabled.set(o.id,o.facility?.enabled??true);if(isFoamStore(o))this.levels.set(o.id,Math.min(o.facility?.capacity??1000,o.facility?.volume??o.facility?.capacity??1000));}this.evaluate(entities);}
  start(entities:Entity[]){this.active=true;this.reset(entities);}
  stop(){this.active=false;this.states.clear();this.alarms.clear();}
  log(o:Entity,action:string){this.events.push({seconds:Math.round(this.seconds*10)/10,id:o.id,name:o.facility?.tag||o.name,action});if(this.events.length>500)this.events.shift();}
  operate(o:Entity,entities:Entity[]){
    if(!this.active)return;
    if(o.preset==='FIRE_ALARM'){this.alarms.add(o.id);this.log(o,'alarm');}
    else if(o.preset==='EMERGENCY_STOP'){const targets=o.facility?.stopTargets||[];for(const id of targets){this.enabled.set(id,false);this.open.set(id,false);}this.log(o,targets.length?'emergency-stop':'unassigned-stop');}
    else if(o.preset==='WATER_SOURCE'){const on=!(this.enabled.get(o.id)??true);this.enabled.set(o.id,on);this.log(o,on?'supply-on':'supply-off');}
    else{const on=!(this.open.get(o.id)??true);this.open.set(o.id,on);this.log(o,on?'open':'close');}
    this.evaluate(entities);
  }
  evaluate(entities:Entity[]){
    const nodes=new Map(entities.filter(isNetwork).map(o=>[o.id,o]));const cache=new Map<string,FlowState>(),visiting=new Set<string>();
    const read=(id:string|undefined):FlowState=>{
      if(!id||!nodes.has(id))return empty();if(cache.has(id))return cache.get(id)!;if(visiting.has(id))return empty('cycle');visiting.add(id);
      const o=nodes.get(id)!,f=o.facility||{};let s:FlowState;
      const on=this.active?(this.open.get(id)??f.open??true):(f.open??true),enabled=this.active?(this.enabled.get(id)??f.enabled??true):(f.enabled??true);
      if(!enabled||((o.preset==='PIPE_VALVE'||isOutlet(o))&&!on))s=empty('closed');
      else if(o.preset==='WATER_SOURCE')s={...empty('ready'),fluid:'water',available:true,path:[id]};
      else if(isFoamStore(o)){const litres=this.active?(this.levels.get(id)??f.volume??0):(f.volume??f.capacity??1000);s=litres>0?{...empty('ready'),fluid:'concentrate',available:true,path:[id],foamTank:id}:empty('empty');}
      else{
        const upstream=read(f.supplyId);s={...upstream,path:[...upstream.path,id],foamPath:[...upstream.foamPath]};
        if(o.preset==='FOAM_EDUCTOR'&&upstream.available){
          if(upstream.fluid!=='water')s=empty('wrong-fluid');
          else{const foam=read(f.concentrateId);const ratio=f.ratio??3;s=foam.available&&foam.fluid==='concentrate'&&ratio>0?{...s,fluid:'solution',ratio,foamTank:foam.foamTank,foamPath:[...foam.path],eductor:id,reason:'ready'}:{...s,fluid:'water',ratio:0,reason:'water-only',eductor:id};}
        }
        if(isOutlet(o)&&s.fluid==='concentrate')s=empty('wrong-fluid');
      }
      visiting.delete(id);cache.set(id,s);return s;
    };
    for(const id of nodes.keys())read(id);
    const running=new Set<string>();for(const o of nodes.values())if(isOutlet(o)){const s=cache.get(o.id)!;if(s.available){for(const id of [...s.path,...s.foamPath])running.add(id);}}
    for(const [id,s] of cache){s.flowing=running.has(id)&&s.available;if(s.available&&!s.flowing&&s.reason==='ready')s.reason='idle';}this.states=cache;return cache;
  }
  tick(dt:number,entities:Entity[]){
    if(!this.active)return;this.seconds+=dt;this.evaluate(entities);
    // Consumption is enabled only when a designer explicitly supplies an exercise flow rate.
    const demand=new Map<string,number>();for(const o of entities){if(!isOutlet(o))continue;const s=this.states.get(o.id);if(!s?.flowing||!s.foamTank||s.fluid!=='solution')continue;const flow=o.facility?.flowLpm;if(flow&&flow>0)demand.set(s.foamTank,(demand.get(s.foamTank)||0)+flow*s.ratio/100*dt/60);}
    let depleted=false;for(const [id,n] of demand){const old=this.levels.get(id)||0,next=Math.max(0,old-n);this.levels.set(id,next);if(old>0&&next===0){depleted=true;const o=entities.find(o=>o.id===id);if(o)this.log(o,'foam-empty');}}
    if(depleted)this.evaluate(entities);
  }
}
