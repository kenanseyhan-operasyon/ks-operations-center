/** Frame-independent pedestrian locomotion rules for Nathan.
 * Do not translate while the actor is still facing away from the requested route.
 */
export const turningInPlace = (signedHeadingErrorDegrees: number, limitDegrees: number) =>
  Math.abs(signedHeadingErrorDegrees) > limitDegrees;

export const walkingStep = (distance: number, velocity: number, dt: number, signedErrorDegrees: number, turnLimit = 35) =>
  !Number.isFinite(distance) || !Number.isFinite(velocity) || !Number.isFinite(dt) ||
  distance <= 0 || dt <= 0 || turningInPlace(signedErrorDegrees, turnLimit)
    ? 0 : Math.min(distance, Math.max(0, velocity) * dt);
