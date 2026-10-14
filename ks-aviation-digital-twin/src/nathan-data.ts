export const NATHAN_PRESET = 'NATHAN_OPERATOR';
export const NATHAN_MODEL_URL = '/models/personnel/KS_Nathan_15_Hareket.glb';
export const NATHAN_HEIGHT = 1.78;
export type NathanSettings = { clip: string; loop: boolean; speed: number };
export function validateNathan(value?: Partial<NathanSettings> | null): NathanSettings {
  return {
    clip: typeof value?.clip === 'string' ? value.clip.slice(0, 180) : 'Idle',
    loop: typeof value?.loop === 'boolean' ? value.loop : true,
    speed: Number.isFinite(value?.speed) ? Math.max(.25, Math.min(2, value!.speed!)) : 1,
  };
}
