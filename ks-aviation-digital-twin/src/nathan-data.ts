export const NATHAN_PRESET = 'NATHAN_OPERATOR';
export const NATHAN_MODEL_URL = '/models/personnel/KS_Nathan_15_Hareket.glb';
export const NATHAN_HEIGHT = 1.78;
export type NathanSupport = { targetId: string; kind: 'rear' | 'platform' | 'steps'; progress: number; local?: [number, number, number]; heading?: number };
export type NathanSettings = { clip: string; loop: boolean; speed: number; support?: NathanSupport };
export function validateNathan(value?: Partial<NathanSettings> | null): NathanSettings {
  return {
    clip: typeof value?.clip === 'string' ? value.clip.slice(0, 180) : 'Idle',
    loop: typeof value?.loop === 'boolean' ? value.loop : true,
    speed: Number.isFinite(value?.speed) ? Math.max(.25, Math.min(2, value!.speed!)) : 1,
    ...(value?.support && typeof value.support.targetId === 'string' && ['rear', 'platform', 'steps'].includes(value.support.kind) && Number.isFinite(value.support.progress)
      ? { support: { targetId: value.support.targetId.slice(0, 180), kind: value.support.kind, progress: Math.max(0, Math.min(1, value.support.progress)),
        ...(Array.isArray(value.support.local) && value.support.local.length === 3 && value.support.local.every(n => Number.isFinite(n) && Math.abs(n) < 50000)
          ? { local: [...value.support.local] as [number, number, number], heading: Number.isFinite(value.support.heading) ? value.support.heading : 0 } : {}) } } : {}),
  };
}
