import { VehicleMotion, type DriveRoute, type Pose } from './vehicle-motion';

/** A saved run always opens stopped; the existing motion engine performs the resume. */
export type DriveCheckpoint = {
  version: 1;
  vehicleId: string;
  routeId: string;
  routeKey: string;
  start: Pose;
  pose: Pose;
  progress: number;
  distance: number;
  wheelbase: number;
  scale: number;
  status: 'paused' | 'complete';
};
type SavedEntity = { id: string; preset: string; position: [number, number, number]; heading: number; scale: number };
const routeKey = (route: DriveRoute) => JSON.stringify([route.vehicleId, route.points, route.speedKmh, route.approachKmh, route.approachDistance]);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const validPose = (value: any): value is Pose => !!value && finite(value.x) && finite(value.z) && finite(value.heading) && Math.abs(value.x) <= 50000 && Math.abs(value.z) <= 50000;
const samePose = (a: Pose, b: Pose) => Math.hypot(a.x-b.x, a.z-b.z) < 0.0001 && Math.abs(Math.atan2(Math.sin(a.heading-b.heading), Math.cos(a.heading-b.heading))) < 0.0001;

export function captureDriveCheckpoint(vehicleId: string, motion: VehicleMotion, scale = 1): DriveCheckpoint | undefined {
  if (!motion.route || !motion.path.length || motion.mode === 'manual') return;
  const first = motion.path[0];
  return {
    version: 1, vehicleId, routeId: motion.route.id, routeKey: routeKey(motion.route),
    start: {x:first.x, z:first.z, heading:first.heading}, pose: {...motion.pose},
    progress: motion.progress, distance: motion.distance, wheelbase: motion.wheelbase, scale,
    status: motion.mode === 'complete' ? 'complete' : 'paused',
  };
}

/** Invalid or obsolete resume data must never prevent the scene itself from opening. */
export function validateDriveCheckpoints(value: unknown, entities: SavedEntity[], routes: DriveRoute[]): DriveCheckpoint[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  const result: DriveCheckpoint[] = [];
  for (const state of value.slice(0, 100)) {
    if (!state || state.version !== 1 || used.has(state.vehicleId) || !validPose(state.start) || !validPose(state.pose)
      || !finite(state.progress) || state.progress < 0 || !finite(state.distance)
      || !finite(state.wheelbase) || state.wheelbase < 0.05 || state.wheelbase > 1000
      || !finite(state.scale) || state.scale < 0.02 || state.scale > 100
      || !['paused', 'complete'].includes(state.status)) continue;
    const entity = entities.find(e => e.id === state.vehicleId && e.preset === 'R14');
    const route = routes.find(r => r.id === state.routeId && r.vehicleId === state.vehicleId);
    if (!entity || !route || entity.scale !== state.scale || state.routeKey !== routeKey(route)
      || !samePose(state.pose, {x:entity.position[0], z:entity.position[2], heading:entity.heading*Math.PI/180})) continue;
    used.add(state.vehicleId);
    result.push({version:1, vehicleId:state.vehicleId, routeId:state.routeId, routeKey:state.routeKey,
      start:{x:state.start.x,z:state.start.z,heading:state.start.heading},
      pose:{x:state.pose.x,z:state.pose.z,heading:state.pose.heading}, progress:state.progress, distance:state.distance,
      wheelbase:state.wheelbase, scale:state.scale, status:state.status});
  }
  return result;
}

export function restoreDriveCheckpoint(motion: VehicleMotion, state: DriveCheckpoint, route: DriveRoute): boolean {
  if (state.version !== 1 || state.vehicleId !== route.vehicleId || state.routeId !== route.id
    || state.routeKey !== routeKey(route) || !validPose(state.start) || !validPose(state.pose)
    || !samePose(motion.pose, state.pose) || !finite(state.progress) || state.progress < 0
    || !finite(state.distance) || !finite(state.wheelbase) || state.wheelbase < 0.05 || state.wheelbase > 1000
    || !['paused','complete'].includes(state.status)) return false;
  try {
    // Rebuild using the original starting pose, never the halfway vehicle heading.
    const restored = new VehicleMotion(state.start);
    restored.wheelbase = state.wheelbase;
    restored.startRoute(route);
    const length = restored.path.at(-1)!.s;
    if (state.progress > length || (state.status === 'complete' && length-state.progress >= 0.01)) return false;
    restored.progress = state.progress;
    // Reuse the existing interpolation at zero elapsed time to verify the saved pose.
    restored.step(0);
    if (!samePose(restored.pose, state.pose)) return false;
    motion.path = restored.path;
    motion.route = route;
    motion.progress = state.progress;
    motion.distance = state.distance;
    // The GLB may still be loading on the other device. Preserve the geometry of this run.
    motion.wheelbase = state.wheelbase;
    motion.speed = 0;
    motion.steer = 0;
    motion.braking = true;
    motion.clearInput();
    motion.mode = restored.mode === 'complete' ? 'complete' : 'paused';
    return true;
  } catch { return false; }
}
