import * as T from 'three';
import type { Entity } from './scene-data';
import { gateSegments, isFacilityGate } from './facility-gates';
import { localToWorld, worldToLocal } from './facility-data';
import type { V3 } from './personnel-navigation';

type Obstacle = { id: string; bottom: number; top: number; bounds?:[number,number,number,number]; hit: (p: V3) => boolean };
type Except = string | string[];
const stepHeight=(e:Entity)=>e.kind==='ground'&&e.points?.length?(e.position[1]>.01?e.position[1]+.018*e.scale:0):e.position[1]+e.height*e.scale;
export const walkableStep = (e:Entity) => (e.preset==='CURB'||e.kind==='ground')&&e.position[1]>=0&&stepHeight(e)<=.221;
const distance = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const segmentDistance = (p: V3, a: number[], b: number[]) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = T.MathUtils.clamp(((p[0] - a[0]) * dx + (p[2] - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(p[0] - a[0] - dx * t, p[2] - a[1] - dz * t);
};

/** Conservative, clearance-expanded footprints. Open gates are sampled live on replanning. */
export class NathanNavigation {
  private obstacles: Obstacle[] = [];
  private regions: ((p: V3) => boolean)[] = [];
  private cells=new Map<string,Obstacle[]>();private global:Obstacle[]=[];
  get clearance() { return this.radius; }
  constructor(private entities: Entity[], private radius = .34, private gateAmount?: (id: string) => number,
    private objects?: (id: string) => T.Object3D | undefined, private ignore?: string) {
    for (const e of entities) {
      if (e.id === ignore || e.kind === 'ground' || walkableStep(e) || e.height * e.scale < .08) continue;
      if (isFacilityGate(e) && (gateAmount?.(e.id) ?? (e.gateOpen ? 1 : 0)) > .98) continue;
      const extent = { id: e.id, bottom: e.position[1], top: e.position[1] + e.height * e.scale };
      if(e.preset==='PEDESTRIAN_GATE'){
        const amount=gateAmount?.(e.id)??(e.facility?.open?1:0),theta=amount*Math.PI*.48;
        const a=localToWorld(e,[-e.width/2,0,0]),b=localToWorld(e,[-e.width/2+e.width*Math.cos(theta),0,-e.width*Math.sin(theta)]),post=localToWorld(e,[e.width/2,0,0]);
        this.obstacles.push({...extent,hit:p=>segmentDistance(p,[a[0],a[2]],[b[0],b[2]])<radius+.03*e.scale||Math.hypot(p[0]-post[0],p[2]-post[2])<radius+.03*e.scale});continue;
      }
      if (e.kind === 'wall' && e.points?.length) {
        const segments = gateSegments(e), pad = radius + e.thickness * e.scale / 2;
        this.obstacles.push({ ...extent, hit: p => segments.some(([a, b]) => segmentDistance(p, a, b) < pad) });
        const first = segments[0]?.[0], last = segments.at(-1)?.[1];
        if (first && last && segments.length > 2 && Math.hypot(first[0]-last[0],first[1]-last[1]) < 2*pad && extent.bottom < 1.78*radius/.34 && extent.top > 0) {
          const polygon = [first, ...segments.map(s => s[1])];
          this.regions.push(p => {
            let inside = false;
            for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
              const a=polygon[i],b=polygon[j];
              if ((a[1]>p[2])!==(b[1]>p[2]) && p[0]<(b[0]-a[0])*(p[2]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
            }
            return inside;
          });
        }
        continue;
      }
      if(e.points && e.points.length>1){
        const points=e.points.map(p=>localToWorld(e,[p[0],0,p[1]])),pad=radius+e.width*e.scale/2;
        this.obstacles.push({...extent,hit:p=>points.slice(1).some((b,i)=>segmentDistance(p,[points[i][0],points[i][2]],[b[0],b[2]])<pad)});
        continue;
      }
      if (e.kind === 'tank' || e.kind === 'tree' || e.kind === 'person') {
        const r = radius + (e.kind === 'tank' ? e.radius * e.scale : e.kind === 'person' ? .28 * e.scale : .25 * e.scale);
        this.obstacles.push({ ...extent, hit: p => Math.hypot(p[0] - e.position[0], p[2] - e.position[2]) < r });
        if (e.kind === 'tank') {
          // The real roof has a central hatch. Keep its obstruction even on the roof.
          this.obstacles.push({id:`${e.id}:hatch`,bottom:e.position[1]+(e.height+.2)*e.scale,top:e.position[1]+(e.height+.5)*e.scale,
            hit:p=>Math.hypot(p[0]-e.position[0],p[2]-e.position[2])<.45*e.scale+radius});
          if (e.facility?.stairs !== false) {
            const f=e.facility||{},w=f.stairWidth??.9,R=e.radius+w/2+.12,H=e.height+.27;
            const start=(f.stairStart??0)*Math.PI/180,sign=f.clockwise===false?-1:1,sweep=(f.sweep??180)*Math.PI/180;
            const pad=radius/e.scale,bodyHeight=1.78*radius/.34/e.scale;
            this.obstacles.push({...extent,top:e.position[1]+(H+1.1)*e.scale,hit:p=>{
              const [x,y,z]=worldToLocal(e,p),rad=Math.hypot(x,z);
              if (rad<R-w/2-pad||rad>R+w/2+pad) return false;
              const theta=((Math.atan2(x,z)-start)*sign+Math.PI*4)%(Math.PI*2),anglePad=pad/R;
              const angle=theta>Math.PI*2-(.8+pad)/R?0:theta;
              if (angle>sweep+anglePad) return false;
              const step=Math.max(.135,H*Math.min(1,angle/sweep));
              return y<step+1.1&&y+bodyHeight>step-.18;
            }});
          }
        }
        continue;
      }
      // Rotated boxes for structures, equipment and complete aircraft. Deliberately
      // conservative: this stage does not route under wings or through canopies.
      const pad = radius / e.scale;
      this.obstacles.push({ ...extent, hit: p => {
        const [x, , z] = worldToLocal(e, p);
        return Math.abs(x) < e.width / 2 + pad && Math.abs(z) < e.length / 2 + pad;
      } });
      // The articulated trailer can extend outside the nominal vehicle rectangle.
      const root = objects?.(e.id);
      if (e.kind === 'vehicle' && Math.abs(e.trailerAngle || 0) > .015 && root) {
        root.updateWorldMatrix(true, true);
        const box = new T.Box3().setFromObject(root).expandByScalar(radius);
        this.obstacles.push({ ...extent, bounds:[box.min.x,box.min.z,box.max.x,box.max.z],bottom: box.min.y, top: box.max.y, hit: p => p[0] > box.min.x && p[0] < box.max.x && p[2] > box.min.z && p[2] < box.max.z });
      }
    }
    // Broad phase for A*: test only obstacles in this four-metre cell. The
    // narrow phase above remains exact; no quantisation of collision clearance.
    const byId=new Map(entities.map(e=>[e.id,e]));
    for(const obstacle of this.obstacles){
      const e=byId.get(obstacle.id)||byId.get(obstacle.id.replace(/:hatch$/,''));if(!e){this.global.push(obstacle);continue;}
      if(!obstacle.bounds){
        const pad=radius+Math.max(e.thickness,e.width)*e.scale/2;
        const reach=e.kind==='tank'?e.radius+(e.facility?.stairWidth??.9)+.12:e.kind==='tree'||e.kind==='person'?Math.max(.28,e.radius):e.preset==='PEDESTRIAN_GATE'?e.width*1.2+.04:0;
        const points=e.points?.length?e.points.map(([x,z])=>localToWorld(e,[x,0,z])):
          (reach?[[-reach,-reach],[reach,reach]]:[[-e.width/2,-e.length/2],[e.width/2,-e.length/2],[-e.width/2,e.length/2],[e.width/2,e.length/2]]).map(([x,z])=>localToWorld(e,[x,0,z]));
        // Circular/swing bounds must be independent of entity heading.
        obstacle.bounds=reach?[e.position[0]-reach*e.scale-radius,e.position[2]-reach*e.scale-radius,e.position[0]+reach*e.scale+radius,e.position[2]+reach*e.scale+radius]:
          [Math.min(...points.map(p=>p[0]))-(e.points?.length?pad:radius*Math.SQRT2),Math.min(...points.map(p=>p[2]))-(e.points?.length?pad:radius*Math.SQRT2),Math.max(...points.map(p=>p[0]))+(e.points?.length?pad:radius*Math.SQRT2),Math.max(...points.map(p=>p[2]))+(e.points?.length?pad:radius*Math.SQRT2)];
      }
      const [x0,z0,x1,z1]=obstacle.bounds.map(n=>Math.floor(n/4));
      if((x1-x0+1)*(z1-z0+1)>4096){this.global.push(obstacle);continue;}
      for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=`${x}:${z}`,cell=this.cells.get(key)||[];cell.push(obstacle);this.cells.set(key,cell);}
    }
  }
  withOpenGate(id:string){return new NathanNavigation(this.entities,this.radius,g=>{const e=this.entities.find(e=>e.id===g);return g===id?1:this.gateAmount?.(g)??((e?.preset==='PEDESTRIAN_GATE'?e.facility?.open:e?.gateOpen)?1:0);},this.objects,this.ignore);}
  surface(p:V3,padding=0){
    let height=0;
    for(const e of this.entities){
      if(!walkableStep(e))continue;
      const v=worldToLocal(e,p),pad=padding/e.scale;
      let inside=false;
      if(e.kind==='ground'&&e.points)for(let i=0,j=e.points.length-1;i<e.points.length;j=i++){
        const a=e.points[i],b=e.points[j];if((a[1]>v[2])!==(b[1]>v[2])&&v[0]<(b[0]-a[0])*(v[2]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      }
      const hit=e.points?.length?e.preset==='CURB'?e.points.slice(1).some((b,i)=>segmentDistance(v,e.points![i],b)<=e.width/2+pad):inside:
        Math.abs(v[0])<=e.width/2+pad&&Math.abs(v[2])<=e.length/2+pad;
      if(hit)height=Math.max(height,stepHeight(e));
    }
    return height;
  }
  blocked(p: V3, except?: Except) {
    const height = 1.78 * this.radius / .34;
    const hit=(o:Obstacle)=>!(Array.isArray(except)?except.includes(o.id):o.id===except)&&p[1]<o.top+.025&&p[1]+height>o.bottom&&o.hit(p);
    return this.global.some(hit)||(this.cells.get(`${Math.floor(p[0]/4)}:${Math.floor(p[2]/4)}`)||[]).some(hit);
  }
  clear(a: V3, b: V3, except?: Except) {
    // Height matters on explicit stair links; ordinary A* nodes remain on ground.
    const n = Math.max(1, Math.ceil(Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]) / .1));
    for (let i = 0; i <= n; i++) if (this.blocked([T.MathUtils.lerp(a[0], b[0], i / n), T.MathUtils.lerp(a[1], b[1], i / n), T.MathUtils.lerp(a[2], b[2], i / n)], except)) return false;
    return true;
  }
  path(start: V3, end: V3, within = (_p: V3) => true, except?: Except): V3[] | undefined {
    if(start[1]<=.221&&end[1]<=.221){start=[start[0],0,start[2]];end=[end[0],0,end[2]];}
    const height=start[1];
    if (Math.abs(end[1]-height)>.08 || distance(start, end) > 120 || this.blocked(end,except) || this.blocked(start,except) || !within(start) || !within(end)) return;
    // A closed containment wall separates ground regions. Avoid exhausting A*
    // inside a sealed yard; the route planner can connect it via a stair link.
    if (height < .1 && this.regions.some(inside => inside(start) !== inside(end))) return;
    const clear=(a:V3,b:V3)=>{
      if (!this.clear(a,b,except)) return false;
      const n=Math.max(1,Math.ceil(distance(a,b)/.15));
      for(let i=0;i<=n;i++)if(!within([T.MathUtils.lerp(a[0],b[0],i/n),height,T.MathUtils.lerp(a[2],b[2],i/n)]))return false;
      return true;
    };
    if (clear(start, end)) return [[end[0], height, end[2]]];
    // A* with a binary heap; no diagonal corner cutting. Bounded work on mobile.
    const step = Math.max(.45, this.radius * 1.25), margin = 12;
    const minX = Math.min(start[0], end[0]) - margin, minZ = Math.min(start[2], end[2]) - margin;
    const cols = Math.ceil((Math.abs(start[0] - end[0]) + margin * 2) / step) + 1;
    const rows = Math.ceil((Math.abs(start[2] - end[2]) + margin * 2) / step) + 1;
    const pos = (id: number): V3 => [minX + (id % cols) * step, height, minZ + Math.floor(id / cols) * step];
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
      if (distance(p, end) < step * 1.5 && clear(p, end)) {
        const result: V3[] = [[end[0], height, end[2]]]; let cursor = id;
        while (cursor !== first) { result.push(pos(cursor)); cursor = from.get(cursor)!; }
        result.reverse(); const smooth: V3[] = []; let previous = start;
        for (let i = 0; i < result.length;) {
          let j = i; while (j + 1 < result.length && clear(previous, result[j + 1])) j++;
          smooth.push(result[j]); previous = result[j]; i = j + 1;
        }
        return smooth;
      }
      const x = id % cols, z = Math.floor(id / cols);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const xx = x + dx, zz = z + dz, next = xx + zz * cols;
        if (xx < 0 || xx >= cols || zz < 0 || zz >= rows || closed.has(next)) continue;
        const q = pos(next); if (!clear(p, q)) continue;
        const g = cost.get(id)! + distance(p, q); if (g >= (cost.get(next) ?? Infinity)) continue;
        cost.set(next, g); from.set(next, id); push(next, g + distance(q, end));
      }
    }
  }
}
