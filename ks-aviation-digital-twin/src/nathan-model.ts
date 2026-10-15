import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Entity } from './scene-data';
import { NATHAN_MODEL_URL, NATHAN_PRESET, validateNathan, type NathanSettings } from './nathan-data';
import { nathanWalkLoop } from './nathan-walk-loop';

export function makeNathanPlaceholder(e: Entity) {
  const root = new T.Group();
  root.name = e.name;
  root.userData.entityId = e.id;
  const marker = new T.Mesh(new T.CapsuleGeometry(.23, e.height - .46, 4, 8),
    new T.MeshStandardMaterial({ color: '#70d9d2', wireframe: true, transparent: true, opacity: .65 }));
  marker.name = 'NATHAN_LOADING_MARKER';
  marker.position.y = e.height / 2;
  root.add(marker);
  return root;
}

/** An entity's transform belongs to the editor. Animation only changes children. */
export class NathanActor {
  readonly model: T.Object3D;
  readonly mixer: T.AnimationMixer;
  readonly clips: T.AnimationClip[];
  readonly offset = new T.Group();
  readonly normalizer = new T.Group();
  readonly actions: T.AnimationAction[];
  index = 0;
  playing = false;
  controlled = false;
  private motionRate = 1;
  settings: NathanSettings;
  private meshes: T.Mesh[] = [];
  private anchor: T.Object3D;
  private disposed = false;
  private blend?: { elapsed: number; weights: number[] };
  private inverse = new T.Matrix4();
  private matrix = new T.Matrix4();
  private point = new T.Vector3();
  private localBox = new T.Box3();
  private bounds = new T.Box3();

  constructor(readonly root: T.Group, gltf: Pick<GLTF, 'scene' | 'animations'>, height: number,
    settings?: NathanSettings, private changed = () => {}) {
    if (!gltf.animations.length) throw new Error('Nathan GLB has no animations');
    this.settings = validateNathan(settings);
    this.model = clone(gltf.scene);
    this.clips = gltf.animations.map(nathanWalkLoop);
    this.model.traverse(node => {
      if (node instanceof T.Mesh) {
        node.userData.sharedAsset = true;
        // Animated bounds are refreshed below for picking. Avoid stale GPU culling.
        node.frustumCulled = false;
        node.castShadow = node.receiveShadow = true;
        this.meshes.push(node);
      }
    });
    if (!this.meshes.length) throw new Error('Nathan GLB has no visible mesh');
    this.anchor = this.model.getObjectByName('rp_nathan_animated_003_walking_hip') || this.model;
    this.normalizer.add(this.model);
    this.offset.add(this.normalizer);
    root.add(this.offset);
    // Establish metres from the unanimated bind pose, never from a crouching clip.
    const bind = this.measure();
    const rawHeight = bind.max.y - bind.min.y;
    if (!Number.isFinite(rawHeight) || rawHeight < .001) {
      this.offset.removeFromParent();
      throw new Error('Nathan GLB has invalid bounds');
    }
    this.normalizer.scale.setScalar(height / rawHeight);
    // The supplied Nathan faces +Z; entity heading 0 (vehicles/editor) faces -Z.
    this.normalizer.rotation.y = Math.PI;
    this.mixer = new T.AnimationMixer(this.model);
    this.actions = this.clips.map(clip => this.mixer.clipAction(clip));
    this.mixer.addEventListener('finished', event => {
      if (event.action === this.actions[this.index]) { this.playing = false; this.changed(); }
    });
    this.select(Math.max(0, this.clips.findIndex(c => c.name === this.settings.clip)), false);
  }

  /** Exact skinned bounds in entity space; also repair local bounds used by raycasts. */
  private measure() {
    this.root.updateWorldMatrix(true, false);
    this.root.updateMatrixWorld(true);
    this.inverse.copy(this.root.matrixWorld).invert();
    this.bounds.makeEmpty();
    for (const mesh of this.meshes) {
      this.matrix.multiplyMatrices(this.inverse, mesh.matrixWorld);
      this.localBox.makeEmpty();
      const count = mesh.geometry.attributes.position.count;
      for (let i = 0; i < count; i++) {
        mesh.getVertexPosition(i, this.point);
        this.localBox.expandByPoint(this.point);
        this.bounds.expandByPoint(this.point.applyMatrix4(this.matrix));
      }
      if (mesh instanceof T.SkinnedMesh) {
        mesh.boundingBox ??= new T.Box3();
        mesh.boundingSphere ??= new T.Sphere();
        mesh.boundingBox.copy(this.localBox);
        this.localBox.getBoundingSphere(mesh.boundingSphere);
      }
    }
    return this.bounds;
  }

  private ground() {
    this.offset.position.set(0, 0, 0);
    this.root.updateWorldMatrix(true, false);
    this.root.updateMatrixWorld(true);
    this.anchor.getWorldPosition(this.point);
    this.root.worldToLocal(this.point);
    this.offset.position.x = -this.point.x;
    this.offset.position.z = -this.point.z;
    // Cancel clip root motion. The controller owns the world-space foot position.
    this.offset.position.y = .005 - this.measure().min.y;
    this.root.updateWorldMatrix(true, false);
    this.root.updateMatrixWorld(true);
  }

  select(index: number, fade = true) {
    if (this.disposed || !Number.isInteger(index) || index < 0 || index >= this.clips.length) return;
    const previous = this.actions[this.index], next = this.actions[index];
    const blend = fade && this.playing && previous !== next;
    // Interrupted transitions keep the complete current pose. Weights always sum
    // to one, so a quick retarget cannot leak the arms-out bind pose into a fade.
    const weights = this.actions.map(a => a.isScheduled() ? a.getEffectiveWeight() : 0);
    const total = weights.reduce((sum, w) => sum + w, 0) || 1;
    this.blend = blend ? { elapsed: 0, weights: weights.map(w => w / total) } : undefined;
    if (!blend) this.actions.forEach(a => a.stop());
    if (!blend || !next.isScheduled()) next.reset();
    next.setEffectiveTimeScale(1).setEffectiveWeight(blend ? this.blend!.weights[index] : 1);
    next.setLoop(this.settings.loop ? T.LoopRepeat : T.LoopOnce, this.settings.loop ? Infinity : 1);
    next.clampWhenFinished = true;
    next.play();
    if (blend) {
      this.actions.forEach((a, i) => a.stopFading().setEffectiveWeight(this.blend!.weights[i]));
    }
    this.index = index;
    this.settings.clip = this.clips[index].name;
    this.mixer.update(0);
    this.ground();
    this.changed();
  }
  configure(settings?: NathanSettings) {
    if (this.controlled) return;
    const next = validateNathan(settings);
    if (next.clip !== this.settings.clip) {
      const index = this.clips.findIndex(c => c.name === next.clip);
      if (index >= 0) this.select(index);
    }
    this.settings.loop = next.loop; this.settings.speed = next.speed;
    const action = this.actions[this.index];
    action.setLoop(next.loop ? T.LoopRepeat : T.LoopOnce, next.loop ? Infinity : 1);
  }
  play() {
    if (this.disposed) return;
    const action = this.actions[this.index];
    if (action.paused || !action.isRunning()) { action.reset().play(); }
    this.playing = true; this.changed();
  }
  pause() { this.playing = false; this.changed(); }
  stop() { this.playing = false; this.select(this.index, false); }
  /** Locomotion playback is ephemeral; never overwrite the saved preview settings. */
  motion(clip: string, rate = 1, reverse = false) {
    const index = this.clips.findIndex(c => c.name === clip);
    if (index < 0) return false;
    this.controlled = true;
    if (index !== this.index) this.select(index);
    const action = this.actions[index], direction = reverse ? -1 : 1;
    const changedDirection = Math.sign(action.getEffectiveTimeScale()) !== direction;
    action.setLoop(T.LoopRepeat, Infinity);
    if (reverse && (changedDirection || action.time <= 0)) action.time = this.clips[index].duration;
    action.paused = false; action.setEffectiveTimeScale(direction); action.play();
    this.motionRate = Math.max(.02, Math.min(2, rate));
    if (!this.playing) { this.playing = true; this.changed(); }
    return true;
  }
  release() { this.controlled = false; this.playing = false; }
  update(dt: number) {
    if (!this.playing || this.disposed || !Number.isFinite(dt)) return;
    const step = Math.max(0, Math.min(dt, .1)) * (this.controlled ? this.motionRate : this.settings.speed);
    if (this.blend) {
      this.blend.elapsed += Math.max(0, Math.min(dt, .1));
      const t = Math.min(1, this.blend.elapsed / .25), alpha = t * t * (3 - 2 * t);
      this.actions.forEach((a, i) => {
        a.setEffectiveWeight(T.MathUtils.lerp(this.blend!.weights[i], i === this.index ? 1 : 0, alpha));
        if (t === 1 && i !== this.index) a.stop();
      });
      if (t === 1) this.blend = undefined;
    }
    this.mixer.update(step);
    this.ground();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.playing = false;
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model);
    // Cloned skeletons own their bone texture; geometry/materials belong to the cache.
    const skeletons = new Set<T.Skeleton>();
    this.meshes.forEach(m => { if (m instanceof T.SkinnedMesh) skeletons.add(m.skeleton); });
    skeletons.forEach(s => s.dispose());
    this.offset.removeFromParent();
  }
}

/** Keep the supplied 8K image in the file; cap only the shared runtime GPU texture. */
export function limitNathanTextures(gltf: Pick<GLTF, 'scene'>, limit: number) {
  const textures = new Set<T.Texture>();
  gltf.scene.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material instanceof T.MeshStandardMaterial && material.map) textures.add(material.map);
    }
  });
  for (const texture of textures) {
    const image = texture.image as (CanvasImageSource & { width: number; height: number; close?: () => void }) | undefined;
    if (!image || !Number.isFinite(image.width) || !Number.isFinite(image.height) || Math.max(image.width, image.height) <= limit) continue;
    const ratio = limit / Math.max(image.width, image.height), canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    texture.image = canvas; texture.needsUpdate = true;
    if (typeof image.close === 'function') image.close();
  }
}

export type NathanState = { root: T.Group; entity: Entity; status: 'loading' | 'ready' | 'error'; progress: number; actor?: NathanActor };
type AssetLoader = (progress: (fraction: number) => void) => Promise<GLTF>;
export class NathanActors {
  readonly states = new Map<string, NathanState>();
  private asset?: Promise<GLTF>;
  private load: AssetLoader;
  constructor(private changed = () => {}, load?: AssetLoader, textureLimit = () => 4096) {
    this.load = load || (async progress => {
      const gltf = await new GLTFLoader().loadAsync(NATHAN_MODEL_URL, e => progress(e.total ? e.loaded / e.total : 0));
      limitNathanTextures(gltf, textureLimit());
      return gltf;
    });
  }
  sync(entities: Entity[], objects: Map<string, T.Group>, enabled = true) {
    const people = entities.filter(e => e.kind === 'person' && e.preset === NATHAN_PRESET);
    for (const [id, state] of this.states) if (!people.some(e => e.id === id) || objects.get(id) !== state.root) {
      state.actor?.dispose(); this.states.delete(id);
    }
    for (const e of people) {
      const root = objects.get(e.id), state = this.states.get(e.id);
      if (!root) continue;
      if (state) state.entity = e;
      if (!state && enabled) void this.attach(e, root);
      else state?.actor?.configure(e.nathan);
    }
  }
  private async attach(e: Entity, root: T.Group) {
    const state: NathanState = { root, entity: e, status: 'loading', progress: 0 };
    this.states.set(e.id, state); this.changed();
    try {
      this.asset ??= this.load(progress => {
        for (const s of this.states.values()) if (s.status === 'loading') s.progress = progress;
        this.changed();
      }).catch(error => { this.asset = undefined; throw error; });
      const gltf = await this.asset;
      if (this.states.get(e.id) !== state) return;
      state.actor = new NathanActor(root, gltf, state.entity.height, state.entity.nathan, this.changed);
      const marker = root.getObjectByName('NATHAN_LOADING_MARKER') as T.Mesh | undefined;
      if (marker) { marker.removeFromParent(); marker.geometry.dispose(); (marker.material as T.Material).dispose(); }
      state.status = 'ready'; state.progress = 1;
      this.changed();
    } catch (error) {
      if (this.states.get(e.id) !== state) return;
      state.status = 'error';
      const marker = root.getObjectByName('NATHAN_LOADING_MARKER') as T.Mesh | undefined;
      if (marker) (marker.material as T.MeshStandardMaterial).color.set('#ed846a');
      console.warn('Nathan model could not load', error);
      this.changed();
    }
  }
  retry(e: Entity) {
    const state = this.states.get(e.id);
    if (state?.status === 'error') void this.attach(e, state.root);
  }
  update(dt: number) { this.states.forEach(s => s.actor?.update(dt)); }
  pause() { this.states.forEach(s => s.actor?.pause()); }
}
