export const NATHAN_PRESET = 'NATHAN_OPERATOR';
export const NATHAN_MODEL_URL = '/models/personnel/KS_Nathan_15_Hareket.glb';
export const NATHAN_HEIGHT = 1.78;
export type NathanSupport = { targetId: string; kind: 'driver' | 'rear' | 'platform' | 'steps' | 'tank' | 'bridge'; progress: number; local?: [number, number, number]; heading?: number; anchor?:string; crossingSide?: -1 | 1; fromTankId?: string; toTankId?: string };
export type NathanSettings = { clip: string; loop: boolean; speed: number; support?: NathanSupport };
export function validateNathan(value?: Partial<NathanSettings> | null): NathanSettings {
  return {
    clip: typeof value?.clip === 'string' ? value.clip.slice(0, 180) : 'Idle',
    loop: typeof value?.loop === 'boolean' ? value.loop : true,
    speed: Number.isFinite(value?.speed) ? Math.max(.25, Math.min(2, value!.speed!)) : 1,
    ...(value?.support && typeof value.support.targetId === 'string' && ['driver', 'rear', 'platform', 'steps', 'tank', 'bridge'].includes(value.support.kind) && Number.isFinite(value.support.progress)
      ? { support: { targetId: value.support.targetId.slice(0, 180), kind: value.support.kind, progress: Math.max(0, Math.min(1, value.support.progress)),
        ...(['Platform_Grey_Floor','Tank_Top_Walkway','DRIVER_SEAT'].includes(value.support.anchor||'')?{anchor:value.support.anchor}:{}),
        ...(value.support.kind === 'steps' && (value.support.crossingSide === -1 || value.support.crossingSide === 1) ? {crossingSide: value.support.crossingSide} : {}),
        ...(value.support.kind === 'bridge' && typeof value.support.fromTankId === 'string' && typeof value.support.toTankId === 'string'
          ? {fromTankId:value.support.fromTankId.slice(0,180),toTankId:value.support.toTankId.slice(0,180)} : {}),
        ...(Array.isArray(value.support.local) && value.support.local.length === 3 && value.support.local.every(n => Number.isFinite(n) && Math.abs(n) < 50000)
          ? { local: [...value.support.local] as [number, number, number], heading: Number.isFinite(value.support.heading) ? value.support.heading : 0 } : {}) } } : {}),
  };
}
