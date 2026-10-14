import * as T from 'three';
import type { Entity } from './scene-data';
import { accessPath, type V3 } from './personnel-navigation';
import { NathanNavigation } from './nathan-navigation';
export type NathanAccessKind = 'rear' | 'platform' | 'steps';
export type NathanAccess = { targetId: string; kind: NathanAccessKind; points: V3[]; heading: number; length: number; crest: number };

/** Match actual picked ladder, stringer, stair tread or landing mesh. */
export function nathanAccessKind(node: T.Object3D, e: Entity): NathanAccessKind | undefined {
  if (['MOBILE_STAIR', 'CROSSOVER_STAIR'].includes(e.preset)) return 'steps';
  for (let n: T.Object3D | null = node; n; n = n.parent) {
    if (/Rear_Ladder|Tank_Top_Walkway|Rear_Fold.*Hand/i.test(n.name)) return 'rear';
    if (/Fixed_Step|Platform_Grey_Floor|Platform_Gate/i.test(n.name)) return 'platform';
  }
}
export function sampleAccess(access: NathanAccess, progress: number): V3 {
  let left = T.MathUtils.clamp(progress, 0, 1) * access.length;
  for (let i = 1; i < access.points.length; i++) {
    const a = new T.Vector3(...access.points[i - 1]), b = new T.Vector3(...access.points[i]), length = a.distanceTo(b);
    if (left <= length || i === access.points.length - 1) return a.lerp(b, length ? T.MathUtils.clamp(left / length, 0, 1) : 1).toArray() as V3;
    left -= length;
  }
  return access.points[0];
}
export function makeNathanAccess(e: Entity, root: T.Object3D | undefined, kind: NathanAccessKind,
  nav: NathanNavigation): NathanAccess | undefined {
  let points: V3[] | undefined;
  if (kind === 'steps') points = accessPath(e, root);
  else if (root) {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert();
    const boxFor = (node: T.Mesh) => {
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      return node.geometry.boundingBox!.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, node.matrixWorld));
    };
    const steps: T.Vector3[] = []; let floor: T.Box3 | undefined;
    root.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      if ((kind === 'rear' ? /^Rear_Ladder_Close_Step(?:_|$)/ : /^Fixed_Step(?:_|$)/).test(node.name)) {
        const box = boxFor(node), p = box.getCenter(new T.Vector3()); p.y = box.max.y; steps.push(p);
      }
      if (node.name === (kind === 'rear' ? 'Tank_Top_Walkway' : 'Platform_Grey_Floor')) floor = boxFor(node);
    });
    if (!steps.length || !floor) return;
    const landingBox: T.Box3 = floor;
    steps.sort((a, b) => a.y - b.y);
    const first = steps[0], last = steps.at(-1)!, centre = landingBox.getCenter(new T.Vector3());
    // Stop on the landing beside the ladder, not at the far-away centre of a roof.
    const outward = first.clone().sub(centre); outward.y = 0;
    if (Math.abs(outward.x) > Math.abs(outward.z)) outward.set(Math.sign(outward.x), 0, 0);
    else outward.set(0, 0, Math.sign(outward.z) || 1);
    if ((landingBox.max.y - last.y) * e.scale > .8 || landingBox.max.y <= first.y) return;
    const inset = .31;
    const landing = new T.Vector3(T.MathUtils.clamp(last.x, landingBox.min.x + inset, landingBox.max.x - inset), landingBox.max.y + .012,
      T.MathUtils.clamp(last.z, landingBox.min.z + inset, landingBox.max.z - inset));
    const bottom = first.clone().addScaledVector(outward, 1); bottom.y = 0;
    points = [bottom, ...steps.map(p => p.clone().addScaledVector(outward, .12)),
      // Feet clear the last rung before crossing onto the landing.
      last.clone().addScaledVector(outward, .12).setY(landing.y), landing]
      .map(p => root.localToWorld(p).toArray() as V3);
  }
  if (!points || points.length < 3) return;
  points[0][1] = 0;
  const outward = new T.Vector3(...points[0]).sub(new T.Vector3(...points[1])); outward.y = 0; outward.normalize();
  // The approach endpoint must be outside the whole expanded vehicle footprint.
  for (let i = 0; i < 30 && nav.blocked(points[0]); i++) {
    points[0][0] += outward.x * .1; points[0][2] += outward.z * .1;
  }
  if (nav.blocked(points[0])) return;
  // Only this target has an explicit access corridor. Never exempt another obstacle.
  for (let i = 1; i < points.length; i++) if (!nav.clear(points[i - 1], points[i], e.id)) return;
  const lengths = points.slice(1).map((p, i) => new T.Vector3(...p).distanceTo(new T.Vector3(...points![i])));
  const length = lengths.reduce((a, b) => a + b, 0);
  return { targetId: e.id, kind, points, length, crest: 1 - lengths.at(-1)! / length,
    heading: Math.atan2(-outward.x, outward.z) * 180 / Math.PI };
}
