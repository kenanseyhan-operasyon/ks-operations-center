import type * as T from 'three';
import type { Entity } from './scene-data';
import type { V3 } from './personnel-navigation';
import { makeNathanAccess, type NathanAccess } from './nathan-access';
import type { NathanNavigation } from './nathan-navigation';
import {localToWorld} from './facility-data';

export type NathanGatePass={id:string;crossing:V3[]};
export type NathanRouteLeg = { route: V3[]; access?: NathanAccess; gate?:NathanGatePass };
type Edge = { from: number; to: number; length: number; route?: V3[]; access?: NathanAccess; gate?:NathanGatePass };
const distance = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const routeLength = (start: V3, route: V3[]) => route.reduce((n, p, i) => n + distance(i ? route[i - 1] : start, p), 0);

/** Ground A* regions connected only by validated, bidirectional crossover stairs.
 * Never open a hole in the wall footprint or interpolate a ground path through it. */
export function planNathanRoute(start: V3, end: V3, nav: NathanNavigation, entities: Entity[],
  object: (id: string) => T.Object3D | undefined): NathanRouteLeg[] | undefined {
  if (distance(start, end) > 120 || nav.blocked(start) || nav.blocked(end)) return;
  if(nav.clear(start,end))return [{route:[end]}];
  const doors=entities.filter(e=>e.preset==='PEDESTRIAN_GATE'&&e.width*e.scale>2*nav.clearance+.12)
    .sort((a,b)=>distance(start,a.position)+distance(end,a.position)-distance(start,b.position)-distance(end,b.position));
  // Common exit operation: try the actual door corridor before exhausting A*
  // against the closed perimeter. No teleport, ignored posts or open main gate.
  for(const gate of doors){
    const a=localToWorld(gate,[.06,0,.8]),b=localToWorld(gate,[.06,0,-1.5]),open=nav.withOpenGate(gate.id);
    if(!open.clear(a,b))continue;
    for(const [entry,exit] of [[a,b],[b,a]])if(nav.clear(start,entry)&&nav.clear(exit,end))return [{route:[entry],gate:{id:gate.id,crossing:[exit]}},{route:[end]}];
  }
  // A nearby vehicle may obscure the approach while the exit is clear. Route
  // around that vehicle before searching the entire closed facility perimeter.
  for(const gate of doors){
    const a=localToWorld(gate,[.06,0,.8]),b=localToWorld(gate,[.06,0,-1.5]);
    if(!nav.withOpenGate(gate.id).clear(a,b))continue;
    for(const [entry,exit] of [[a,b],[b,a]])if(nav.clear(exit,end)){
      const approach=nav.path(start,entry);if(approach)return [{route:approach,gate:{id:gate.id,crossing:[exit]}},{route:[end]}];
    }
  }
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
  // A pedestrian can operate these doors. Closed vehicle gates remain barriers.
  // Validate the whole opening with the swung leaf and both posts still present.
  for(const gate of doors){
    const a=localToWorld(gate,[.06,0,.8]),b=localToWorld(gate,[.06,0,-1.5]),open=nav.withOpenGate(gate.id);
    const forward=open.path(a,b),backward=open.path(b,a);
    if(!forward||!backward||nav.blocked(a)||nav.blocked(b))continue;
    const from=nodes.length,to=from+1;nodes.push(a,b);
    links.set(from,{from,to,length:routeLength(a,forward)+2,gate:{id:gate.id,crossing:forward}});
    links.set(to,{from:to,to:from,length:routeLength(b,backward)+2,gate:{id:gate.id,crossing:backward}});
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
    else if(edge.gate){legs.push({route,gate:edge.gate});route=[];}
  }
  if (route.length) legs.push({ route });
  return legs;
}
