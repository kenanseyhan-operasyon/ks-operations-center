import * as T from 'three';

/** Exact CPU skinning bounds. Bone matrices and immutable vertex inputs are
 * prepared once, instead of multiplying the same bone matrices per vertex.
 * Keep the ordinary Three path for meshes with morph targets. */
export class SkinnedBounds {
  private geometry?: T.BufferGeometry;
  private bind = new T.Matrix4();
  private rest = new Float64Array(0);
  private weights = new Float64Array(0);
  private indices = new Uint32Array(0);
  private bones = new Float64Array(0);
  private matrix = new T.Matrix4();
  private point = new T.Vector3();

  constructor(private mesh: T.SkinnedMesh) {}

  measure(local: T.Box3, entity: T.Box3, transform: T.Matrix4) {
    const mesh = this.mesh, g = mesh.geometry;
    if (g.morphAttributes.position?.length) {
      for (let i = 0; i < g.attributes.position.count; i++) {
        mesh.getVertexPosition(i, this.point);
        local.expandByPoint(this.point);
        entity.expandByPoint(this.point.applyMatrix4(transform));
      }
      return;
    }
    if (this.geometry !== g || !this.bind.equals(mesh.bindMatrix)) {
      this.geometry = g; this.bind.copy(mesh.bindMatrix);
      const p = g.attributes.position, weight = g.attributes.skinWeight, index = g.attributes.skinIndex;
      this.rest = new Float64Array(p.count * 3);
      this.weights = new Float64Array(p.count * 4);
      this.indices = new Uint32Array(p.count * 4);
      for (let i = 0; i < p.count; i++) {
        this.point.fromBufferAttribute(p, i).applyMatrix4(this.bind).toArray(this.rest, i * 3);
        for (let j = 0; j < 4; j++) {
          this.weights[i * 4 + j] = weight.getComponent(i, j);
          this.indices[i * 4 + j] = index.getComponent(i, j) * 16;
        }
      }
    }
    const skeleton = mesh.skeleton;
    if (this.bones.length !== skeleton.bones.length * 16) this.bones = new Float64Array(skeleton.bones.length * 16);
    for (let i = 0; i < skeleton.bones.length; i++)
      this.matrix.multiplyMatrices(skeleton.bones[i].matrixWorld, skeleton.boneInverses[i]).toArray(this.bones, i * 16);

    const rest = this.rest, weights = this.weights, indices = this.indices, bones = this.bones;
    const b = mesh.bindMatrixInverse.elements, e = transform.elements;
    const lmin = local.min, lmax = local.max, emin = entity.min, emax = entity.max;
    for (let i = 0, k = 0; i < rest.length; i += 3, k += 4) {
      const x = rest[i], y = rest[i + 1], z = rest[i + 2];
      let sx = 0, sy = 0, sz = 0;
      for (let j = 0; j < 4; j++) {
        const w = weights[k + j]; if (w === 0) continue;
        const o = indices[k + j];
        sx += (bones[o] * x + bones[o + 4] * y + bones[o + 8] * z + bones[o + 12]) * w;
        sy += (bones[o + 1] * x + bones[o + 5] * y + bones[o + 9] * z + bones[o + 13]) * w;
        sz += (bones[o + 2] * x + bones[o + 6] * y + bones[o + 10] * z + bones[o + 14]) * w;
      }
      const bw = 1 / (b[3] * sx + b[7] * sy + b[11] * sz + b[15]);
      const lx = (b[0] * sx + b[4] * sy + b[8] * sz + b[12]) * bw;
      const ly = (b[1] * sx + b[5] * sy + b[9] * sz + b[13]) * bw;
      const lz = (b[2] * sx + b[6] * sy + b[10] * sz + b[14]) * bw;
      lmin.x = Math.min(lmin.x, lx); lmin.y = Math.min(lmin.y, ly); lmin.z = Math.min(lmin.z, lz);
      lmax.x = Math.max(lmax.x, lx); lmax.y = Math.max(lmax.y, ly); lmax.z = Math.max(lmax.z, lz);
      const ew = 1 / (e[3] * lx + e[7] * ly + e[11] * lz + e[15]);
      const ex = (e[0] * lx + e[4] * ly + e[8] * lz + e[12]) * ew;
      const ey = (e[1] * lx + e[5] * ly + e[9] * lz + e[13]) * ew;
      const ez = (e[2] * lx + e[6] * ly + e[10] * lz + e[14]) * ew;
      emin.x = Math.min(emin.x, ex); emin.y = Math.min(emin.y, ey); emin.z = Math.min(emin.z, ez);
      emax.x = Math.max(emax.x, ex); emax.y = Math.max(emax.y, ey); emax.z = Math.max(emax.z, ez);
    }
  }
}
