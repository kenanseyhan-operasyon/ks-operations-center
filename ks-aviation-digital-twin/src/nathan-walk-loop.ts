import * as T from 'three';

const cache = new WeakMap<T.AnimationClip, T.AnimationClip>();

/** The supplied walk starts with two bind-pose frames. Use its complete, measured
 * stride at frames 15–42 (30 fps), with a short seam correction. Source GLB stays intact. */
export function nathanWalkLoop(source: T.AnimationClip) {
  if (source.name !== 'Nathan_Original_Walk' || source.duration < 1.4) return source;
  const cached = cache.get(source); if (cached) return cached;
  const start = 15 / 30, frames = 27, duration = frames / 30;
  const tracks = source.tracks.map(track => {
    const copy = track.clone(), size = track.getValueSize();
    const sample = track.InterpolantFactoryMethodLinear();
    const first = Array.from(sample.evaluate(start)), times: number[] = [], values: number[] = [];
    for (let frame = 0; frame <= frames; frame++) {
      const time = frame / 30, value = Array.from(sample.evaluate(start + time));
      const t = T.MathUtils.clamp((frame - (frames - 3)) / 3, 0, 1), weight = t * t * (3 - 2 * t);
      if (track instanceof T.QuaternionKeyframeTrack) T.Quaternion.slerpFlat(value, 0, value, 0, first, 0, weight);
      else for (let k = 0; k < size; k++) value[k] = T.MathUtils.lerp(value[k], first[k], weight);
      times.push(time); values.push(...value);
    }
    copy.times = new Float32Array(times); copy.values = new Float32Array(values);
    return copy;
  });
  const clip = new T.AnimationClip(source.name, duration, tracks, source.blendMode);
  cache.set(source, clip); return clip;
}
