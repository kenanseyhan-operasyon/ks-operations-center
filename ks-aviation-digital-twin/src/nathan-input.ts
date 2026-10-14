/** Exclusive tap input while managing Nathan. Camera gestures pass through otherwise. */
export function bindNathanInput(canvas: HTMLElement, enabled: () => boolean, tap: (event: PointerEvent) => void) {
  const pointers = new Map<number, { x: number; y: number }>();
  let cancelled = false;
  const down = (e: PointerEvent) => {
    if (!enabled() || (e.pointerType !== 'touch' && e.button !== 0)) return;
    if (!pointers.size) cancelled = false;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size > 1) cancelled = true;
    e.preventDefault(); e.stopImmediatePropagation();
    canvas.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) cancelled = true;
    e.preventDefault(); e.stopImmediatePropagation();
  };
  const up = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    const p = pointers.get(e.pointerId)!;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) cancelled = true;
    pointers.delete(e.pointerId); e.preventDefault(); e.stopImmediatePropagation();
    if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (e.type === 'pointercancel') cancelled = true;
    if (!pointers.size && !cancelled && enabled()) tap(e);
  };
  const clear = () => { cancelled = true; pointers.clear(); };
  canvas.addEventListener('pointerdown', down, true);
  canvas.addEventListener('pointermove', move, true);
  canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', up, true);
  window.addEventListener('blur', clear);
  return () => {
    clear(); canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointermove', move, true);
    canvas.removeEventListener('pointerup', up, true); canvas.removeEventListener('pointercancel', up, true); window.removeEventListener('blur', clear);
  };
}
