import type {Entity} from './scene-data';
/** Isolated training state: never modifies saved tank/vehicle quantities. */
export class FuelExercise{
 hoseId='';bonded=false;coupled=false;valve=false;pump=false;held=false;stopped=false;litres=0;source=10000;capacity=10000;flow=300;
 reset(){this.bonded=this.coupled=this.valve=this.pump=this.held=this.stopped=false;this.litres=0;}
 reason(entities:Entity[]){
  const map=new Map(entities.map(e=>[e.id,e]));let node=map.get(this.hoseId);const seen=new Set<string>();
  for(const expected of ['FUEL_HOSE','FUEL_METER','FUEL_FILTER','FUEL_PUMP']){if(!node||node.preset!==expected||seen.has(node.id))return 'Hortum → sayaç → filtre → pompa bağlantısını tamamlayın.';seen.add(node.id);node=map.get(node.facility?.supplyId||'');}
  if(this.stopped)return 'Acil durdurma etkin; denemeyi sıfırlayın.';
  if(!this.bonded)return 'Bonding bağlantısı bekleniyor.';if(!this.coupled)return 'Hortum kaplini bağlı değil.';if(!this.valve)return 'Hat vanası kapalı.';if(!this.pump)return 'Pompa kapalı.';if(!this.held)return 'Akış için deadman düğmesini basılı tutun.';
  if(this.litres>=Math.min(this.source,this.capacity))return 'Kaynak miktarı veya hedef boş hacmi sınırına ulaşıldı.';return '';
 }
 tick(dt:number,entities:Entity[]){if(!Number.isFinite(dt)||dt<=0||this.reason(entities))return;this.litres=Math.min(this.source,this.capacity,this.litres+Math.min(dt,.25)*this.flow/60);}
}
