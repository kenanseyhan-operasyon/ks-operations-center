export const TEST_RATES=[1,2,4,8] as const;
/** Advance gates and driving together. Short steps preserve every interlock at 8×. */
export function advanceSimulation(dt:number,rate:number,step:(dt:number,last:boolean)=>void){
  const elapsed=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0))*(TEST_RATES.includes(rate as 1)?rate:1);
  const count=Math.ceil(elapsed/.05);for(let i=0;i<count;i++)step(elapsed/count,i===count-1);
}
