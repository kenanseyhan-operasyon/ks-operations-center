import type * as T from 'three';
import type { Entity } from './scene-data';
import type { V3 } from './personnel-navigation';
import { makeNathanAccess, type NathanAccess } from './nathan-access';
import type { NathanNavigation } from './nathan-navigation';

export type NathanRouteLeg = { route: V3[]; access?: NathanAccess };
type Edge = { from: number; to: number; length: number; route?: V3[]; access?: NathanAccess };
const distance = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const routeLength = (start: V3, route: V3[]) => route.reduce((n, p, i) => n + distance(i ? route[i - 1] : start, p), 0);

/** Ground A* regions connected only by validated, bidirectional crossover stairs.
 * Never open a hole in the wall footprint or interpolate a ground path through it. */
export function planNathanRoute(start: V3, end: V3, nav: NathanNavigation, entities: Entity[],
  object: (id: string) => T.Object3D | undefined): NathanRouteLeg[] | undefined {
  if (distance(start, end) > 120 || nav.blocked(start) || nav.blocked(end)) return;
  const direct = nav.path(start, end);
  if (direct) return [{ route: direct }];
  const nodes: V3[] = [start, end], links = new Map<number, Edge>();
  const candidates = entities.filter(e => e.preset === 'CROSSOVER_STAIR' && distance(start, e.position) < 120 && distance(end, e.position) < 120)
    .sort((a, b) => distance(start, a.position) + distance(end, a.position) - distance(start, b.position) - distance(end, b.position)).slice(0, 8);
  for (const e of candidates) {
    const forward = makeNathanAccess(e, object(e.id), 'steps', nav, -1);
    const backward = makeNathanAccess(e, object(e.id), 'steps', nav, 1);
    if (!forward || !backward) continue;
    const from = nodes.length, to = from + 1;
    nodes.push(forward.points[0], forward.points.at(-1)!);
    links.set(from, { from, to, length: forward.length, access: forward });
    links.set(to, { from: to, to: from, length: backward.length, access: backward });
  }
  if (!links.size) return;
  const costs = new Map([[0, 0]]), previous = new Map<number, Edge>(), closed = new Set<number>();
  const ground = new Map<string, V3[] | undefined>([['0:1', undefined]]);
  for (;;) {
    const current = [...costs.keys()].filter(i => !closed.has(i)).sort((a, b) => costs.get(a)! - costs.get(b)!)[0];
    if (current === undefined) return;
    if (current === 1) break;
    closed.add(current);
    const edges: Edge[] = [], link = links.get(current);
    if (link && !closed.has(link.to)) edges.push(link);
    for (let to = 1; to < nodes.length; to++) {
      if (to === current || closed.has(to) || to === link?.to) continue;
      const key = `${current}:${to}`;
      if (!ground.has(key)) ground.set(key, nav.path(nodes[current], nodes[to]));
      const route = ground.get(key);
      if (route) edges.push({ from: current, to, route, length: routeLength(nodes[current], route) });
    }
    for (const edge of edges) {
      const cost = costs.get(current)! + edge.length;
      if (cost >= (costs.get(edge.to) ?? Infinity)) continue;
      costs.set(edge.to, cost); previous.set(edge.to, edge);
    }
  }
  const edges: Edge[] = [];
  for (let i = 1; i !== 0;) { const edge = previous.get(i)!; edges.unshift(edge); i = edge.from; }
  const legs: NathanRouteLeg[] = []; let route: V3[] = [];
  for (const edge of edges) {
    if (edge.route) route.push(...edge.route);
    else if (edge.access) { legs.push({ route, access: edge.access }); route = []; }
  }
  if (route.length) legs.push({ route });
  return legs;
}
