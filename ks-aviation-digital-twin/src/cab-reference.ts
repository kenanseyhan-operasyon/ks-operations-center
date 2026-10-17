/** Mercedes-Benz, The Atego / The Axor, 29 July 2011, printed p.42 (PDF p.43).
 * Dimensions in metres. The brochure is a dimensional reference, not OEM CAD.
 * See docs/CAB_REFERENCE.md for measured, drawing-derived and assumed values. */
export const CAB_REFERENCE = {
  source:'https://www.linardos.gr/brochures/brochures.specific/brochures.chassis.cab.trucks/MERCEDES-BENZ/MERCEDES-BENZ_ATEGO_AXOR.pdf',
  sourcePage:42, sourceSha256:'3de837387fbe397afbf4258efe272f7a96d24f639608a4c5233dea29a27d8384',
  exteriorWidth:2.490, sourceLength:1.650, length:1.470, interiorWidth:2.000, interiorHeight:1.510,
  exteriorHeight:1.591, steeringDiameter:.450,
  stepRises:[.277,.286,.263] as const,
  // Ground clearance is load/tyre dependent and is not dimensioned on this page.
  floorHeight:1.200, bodyWidth:2.295, axleFromFront:(.8958-.6974)*13.5/2.47,
  treadWidth:.380, treadDepth:.240, treadX:.265,
  nativeFront:-.8958, nativeGround:-.454, nativeCentreZ:.155,
  metresPerNative:13.5/2.47,
} as const;
export const cabUnits=(metres:number)=>metres/CAB_REFERENCE.metresPerNative;
/** Front-to-rear distance, height above ground, driver's-side lateral distance. */
export const cabPoint=(x:number,y:number,z:number):[number,number,number]=>[
  CAB_REFERENCE.nativeFront+cabUnits(x),CAB_REFERENCE.nativeGround+cabUnits(y),CAB_REFERENCE.nativeCentreZ+cabUnits(z),
];
export const cabFloor=cabPoint(0,CAB_REFERENCE.floorHeight,0)[1];
export const cabTreadHeights=[CAB_REFERENCE.floorHeight-.826,CAB_REFERENCE.floorHeight-.549,CAB_REFERENCE.floorHeight-.263] as const;
/** Shorten the rear of the cab; keep the windscreen, front face and bumper fixed.
 * This is the user's installation envelope, not a new manufacturer dimension. */
export const cabLayoutX=(x:number)=>x<=.55?x:.55+(x-.55)*(CAB_REFERENCE.length-.55)/(CAB_REFERENCE.sourceLength-.55);
/** Shared remap of the old decorative cab and its glass/lights/labels. */
export function remapCabPoint(x:number,y:number,z:number):[number,number,number]{
  const c=CAB_REFERENCE;
  return [c.nativeFront+cabUnits(cabLayoutX((x+.8958)*c.sourceLength/.3116)),
    y>=-.26501?cabFloor+(y+.265)*cabUnits(c.exteriorHeight)/.3165:y,
    c.nativeCentreZ+(z-c.nativeCentreZ)*cabUnits(c.bodyWidth)/.36];
}
