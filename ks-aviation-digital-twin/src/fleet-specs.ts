/** Overall dimensions from manufacturers. Detailed contours/servicing geometry
 * are illustrative until a variant-specific servicing specification is added. */
export type FleetSpec={id:string;model:string;type:'business'|'turboprop'|'piston';length:number;span:number;height:number;source:string;sourceNote:string};
export const FLEET_SPECS:Record<string,FleetSpec>={
 GULFSTREAM:{id:'GULFSTREAM',model:'Gulfstream G500',type:'business',length:27.79,span:26.31,height:7.77,source:'https://www.gulfstream.com/en/aircraft/gulfstream-g500/',sourceNote:'Gulfstream · Exterior measurements'},
 CITATION:{id:'CITATION',model:'Cessna Citation Latitude · 680A',type:'business',length:18.97,span:22.05,height:6.38,source:'https://cessna.txtav.com/en/citation/latitude',sourceNote:'Textron · 62 ft 3 in / 72 ft 4 in / 20 ft 11 in'},
 TURBOPROP:{id:'TURBOPROP',model:'Beechcraft King Air 360',type:'turboprop',length:14.2,span:17.65,height:4.4,source:'https://beechcraft.txtav.com/en/king-air-360',sourceNote:'Textron · Dimensions'},
 PROPELLER:{id:'PROPELLER',model:'Cessna 172S Skyhawk',type:'piston',length:8.28,span:11,height:2.72,source:'https://cessna.txtav.com/-/media/cessna/files/product-cards/piston/skyhawk_product_card.ashx',sourceNote:'Textron · Skyhawk product card · 2024, p2'}
};
export function fleetOutline(s:FleetSpec):[number,number][]{const W=s.span,L=s.length,high=s.type==='piston',sweep=s.type==='business'?.1:.015;return [[0,-L/2],[W*.045,-L*.34],[W*.045,-L*.12],[W/2,L*(-.12+sweep)],[W/2,L*(high?.03:.12)],[W*.045,L*.12],[W*.027,L*.32],[W*.18,L*.37],[W*.18,L*.44],[W*.025,L*.45],[0,L/2],[-W*.025,L*.45],[-W*.18,L*.44],[-W*.18,L*.37],[-W*.027,L*.32],[-W*.045,L*.12],[-W/2,L*(high?.03:.12)],[-W/2,L*(-.12+sweep)],[-W*.045,-L*.12],[-W*.045,-L*.34]];}
