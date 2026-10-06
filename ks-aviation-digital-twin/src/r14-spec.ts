/** Native GLB: front is -X, up is Y, centre line is Z=.155. */
export const R14 = {
  length:2.47, centreX:.315, centreZ:.155,
  frontAxle:-.6974, tractorAxle:.077, trailerAxle:1.289,
  axleY:-.354, tyreRadius:.1, hitchX:.077, hitchY:-.225,
  maxArticulation:55*Math.PI/180,
  // Full-width extended front needs clearance from the tractor hose drum.
  drivingArticulation:22*Math.PI/180,
} as const;
/** Geometry is available even before a model has loaded on another device. */
export function r14Dimensions(length=13.5, scale=1) {
  const s=length/R14.length*scale;
  return {wheelbase:(R14.tractorAxle-R14.frontAxle)*s,
    trailerWheelbase:(R14.trailerAxle-R14.hitchX)*s,
    hitchOffset:(R14.centreX-R14.hitchX)*s,maxTrailerAngle:R14.drivingArticulation};
}
