const handled = Symbol('nathan-gesture');
/** Let camera controls clean up their pointers, but prevent a second scene click. */
// Portrait input wraps the same native event in a proxy per listener. Store the
// marker on that native event so every mapped listener sees the same ownership.
export const isNathanInputEvent = (event: Event) => Reflect.get(event, handled) === true;

/** A stationary tap sets a target; drags and pinches belong to OrbitControls. */
export function bindNathanInput(canvas: HTMLElement, enabled: () => boolean, tap: (event: PointerEvent) => void) {
  const pointers = new Map<number, { x: number; y: number }>();
  let cancelled = false;
  const down = (e: PointerEvent) => {
    if (!enabled()) return;
    if (e.pointerType !== 'touch' && e.button !== 0) { cancelled = true; return; }
    if (!pointers.size) cancelled = false;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size > 1 || e.ctrlKey || e.metaKey || e.shiftKey) cancelled = true;
  };
  const move = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) cancelled = true;
  };
  const up = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    const p = pointers.get(e.pointerId)!;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) cancelled = true;
    pointers.delete(e.pointerId); Reflect.set(e, handled, true);
    if (e.type === 'pointercancel') cancelled = true;
    if (!pointers.size && !cancelled && enabled()) tap(e);
  };
  const clear = () => { cancelled = true; pointers.clear(); };
  canvas.addEventListener('pointerdown', down, true);
  canvas.addEventListener('pointermove', move, true);
  canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', up, true);
  canvas.addEventListener('lostpointercapture', clear);
  window.addEventListener('blur', clear);
  return () => {
    clear(); canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointermove', move, true);
    canvas.removeEventListener('pointerup', up, true); canvas.removeEventListener('pointercancel', up, true);
    canvas.removeEventListener('lostpointercapture', clear); window.removeEventListener('blur', clear);
  };
}
