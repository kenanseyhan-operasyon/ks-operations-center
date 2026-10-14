import * as T from 'three';
import type { Entity } from './scene-data';
import { gateSegments, isFacilityGate } from './facility-gates';
import { localToWorld, worldToLocal } from './facility-data';
import type { V3 } from './personnel-navigation';

type Obstacle = { id: string; hit: (p: V3) => boolean };
const distance = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const segmentDistance = (p: V3, a: number[], b: number[]) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = T.MathUtils.clamp(((p[0] - a[0]) * dx + (p[2] - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(p[0] - a[0] - dx * t, p[2] - a[1] - dz * t);
};

/** Conservative, clearance-expanded footprints. Open gates are sampled live on replanning. */
export class NathanNavigation {
  private obstacles: Obstacle[] = [];
  constructor(entities: Entity[], private radius = .34, gateAmount?: (id: string) => number,
    objects?: (id: string) => T.Object3D | undefined, ignore?: string) {
    for (const e of entities) {
      if (e.id === ignore || e.kind === 'ground' || e.position[1] > 1.8 || e.height * e.scale < .08) continue;
      if (isFacilityGate(e) && (gateAmount?.(e.id) ?? (e.gateOpen ? 1 : 0)) > .98) continue;
      if (e.kind === 'wall' && e.points?.length) {
        const segments = gateSegments(e), pad = radius + e.thickness * e.scale / 2;
        this.obstacles.push({ id: e.id, hit: p => segments.some(([a, b]) => segmentDistance(p, a, b) < pad) });
        continue;
      }
      if(e.points && e.points.length>1){
        const points=e.points.map(p=>localToWorld(e,[p[0],0,p[1]])),pad=radius+e.width*e.scale/2;
        this.obstacles.push({id:e.id,hit:p=>points.slice(1).some((b,i)=>segmentDistance(p,[points[i][0],points[i][2]],[b[0],b[2]])<pad)});
        continue;
      }
      if (e.kind === 'tank' || e.kind === 'tree' || e.kind === 'person') {
        const r = radius + (e.kind === 'tank' ? e.radius * e.scale : e.kind === 'person' ? .28 * e.scale : .25 * e.scale);
        this.obstacles.push({ id: e.id, hit: p => Math.hypot(p[0] - e.position[0], p[2] - e.position[2]) < r });
        continue;
      }
      // Rotated boxes for structures, equipment and complete aircraft. Deliberately
      // conservative: this stage does not route under wings or through canopies.
      const pad = radius / e.scale;
      this.obstacles.push({ id: e.id, hit: p => {
        const [x, , z] = worldToLocal(e, p);
        return Math.abs(x) < e.width / 2 + pad && Math.abs(z) < e.length / 2 + pad;
      } });
      // The articulated trailer can extend outside the nominal vehicle rectangle.
      const root = objects?.(e.id);
      if (e.kind === 'vehicle' && Math.abs(e.trailerAngle || 0) > .015 && root) {
        root.updateWorldMatrix(true, true);
        const box = new T.Box3().setFromObject(root).expandByScalar(radius);
        this.obstacles.push({ id: e.id, hit: p => p[0] > box.min.x && p[0] < box.max.x && p[2] > box.min.z && p[2] < box.max.z });
      }
    }
  }
  blocked(p: V3, except?: string) { return this.obstacles.some(o => o.id !== except && o.hit(p)); }
  clear(a: V3, b: V3, except?: string) {
    const n = Math.max(1, Math.ceil(distance(a, b) / .14));
    for (let i = 1; i <= n; i++) if (this.blocked([T.MathUtils.lerp(a[0], b[0], i / n), 0, T.MathUtils.lerp(a[2], b[2], i / n)], except)) return false;
    return true;
  }
  path(start: V3, end: V3): V3[] | undefined {
    if (distance(start, end) > 120 || this.blocked(end) || this.blocked(start)) return;
    if (this.clear(start, end)) return [[end[0], 0, end[2]]];
    // A* with a binary heap; no diagonal corner cutting. Bounded work on mobile.
    const step = Math.max(.45, this.radius * 1.25), margin = 12;
    const minX = Math.min(start[0], end[0]) - margin, minZ = Math.min(start[2], end[2]) - margin;
    const cols = Math.ceil((Math.abs(start[0] - end[0]) + margin * 2) / step) + 1;
    const rows = Math.ceil((Math.abs(start[2] - end[2]) + margin * 2) / step) + 1;
    const pos = (id: number): V3 => [minX + (id % cols) * step, 0, minZ + Math.floor(id / cols) * step];
    const cell = (p: V3) => Math.round((p[0] - minX) / step) + Math.round((p[2] - minZ) / step) * cols;
    const first = cell(start), from = new Map<number, number>(), cost = new Map([[first, 0]]), closed = new Set<number>();
    const heap: { id: number; score: number }[] = [];
    const push = (id: number, score: number) => {
      let i = heap.length; heap.push({ id, score });
      while (i > 0) { const j = (i - 1) >> 1; if (heap[j].score <= score) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; }
    };
    const pop = () => {
      const head = heap[0], tail = heap.pop()!;
      if (heap.length) {
        heap[0] = tail; let i = 0;
        for (;;) { let j = i * 2 + 1; if (j >= heap.length) break; if (j + 1 < heap.length && heap[j + 1].score < heap[j].score) j++; if (heap[i].score <= heap[j].score) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; }
      }
      return head.id;
    };
    push(first, distance(start, end));
    for (let expanded = 0; heap.length && expanded < 24000; expanded++) {
      const id = pop(); if (closed.has(id)) continue; closed.add(id);
      const p = id === first ? start : pos(id);
      if (distance(p, end) < step * 1.5 && this.clear(p, end)) {
        const result: V3[] = [[end[0], 0, end[2]]]; let cursor = id;
        while (cursor !== first) { result.push(pos(cursor)); cursor = from.get(cursor)!; }
        result.reverse(); const smooth: V3[] = []; let previous = start;
        for (let i = 0; i < result.length;) {
          let j = i; while (j + 1 < result.length && this.clear(previous, result[j + 1])) j++;
          smooth.push(result[j]); previous = result[j]; i = j + 1;
        }
        return smooth;
      }
      const x = id % cols, z = Math.floor(id / cols);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const xx = x + dx, zz = z + dz, next = xx + zz * cols;
        if (xx < 0 || xx >= cols || zz < 0 || zz >= rows || closed.has(next)) continue;
        const q = pos(next); if (!this.clear(p, q)) continue;
        const g = cost.get(id)! + distance(p, q); if (g >= (cost.get(next) ?? Infinity)) continue;
        cost.set(next, g); from.set(next, id); push(next, g + distance(q, end));
      }
    }
  }
}
