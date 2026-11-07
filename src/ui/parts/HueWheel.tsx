// The colour wheel for a voice (PLAN.md section 4: a wheel, not a fixed palette). A conic ring of
// oklch(var(--voice-l) var(--voice-c) <hue>), so it follows the light; deep draws the deep formula.
// Tap or drag anywhere on it to pick the hue; arrow keys turn it five degrees.
import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';

type Props = { hue: number; deep?: boolean; colour: string; label?: string; onHue: (h: number) => void };

export function HueWheel({ hue, deep, colour, label, onHue }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const at = (e: PointerEvent) => {
    const r = el.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (!dx && !dy) return;
    onHue(Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360));
  };
  const style = { '--h': `${hue}deg`, '--vc': colour } as JSX.CSSProperties;
  return (
    <div ref={el} class={`fs-wheel${deep ? ' deep' : ''}`} style={style}
      role="slider" tabIndex={0} aria-label="Colour" aria-valuemin={0} aria-valuemax={359} aria-valuenow={hue}
      onPointerDown={e => { dragging.current = e.pointerId; el.current!.setPointerCapture(e.pointerId); at(e); }}
      onPointerMove={e => { if (dragging.current === e.pointerId) at(e); }}
      onPointerUp={() => { dragging.current = null; }}
      onPointerCancel={() => { dragging.current = null; }}
      onKeyDown={e => {
        const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : 0;
        if (step) { e.preventDefault(); onHue((hue + step + 360) % 360); }
      }}>
      <div class="fs-wheel-ring" />
      <div class="fs-wheel-dot" />
      <div class="fs-wheel-mid"><i />{label && <span>{label}</span>}</div>
    </div>
  );
}
