// "Hold to hum" (PLAN-WORLDS.md section 6, W6): the one act under the thumb on a song page and on the loose hums. Down
// asks for the microphone and starts the take (./hum.ts); the line is drawn as it is sung (onFrame); up stops it. A
// cancelled hold (pointercancel, the capture lost, the page hidden) ends the take cleanly, as a lift does. A hold that
// lifts before the microphone opens makes no take. Pointer events, so a finger and a mouse are the same press.
import { useEffect, useRef, useState } from 'preact/hooks';
import { startHum, type Hummed, type Humming } from './hum';

type Props = {
  onFrame: (pitch: readonly number[]) => void;
  onTake: (t: Hummed) => void;
  /** The microphone was refused or is missing: the page says so in print. */
  onRefused?: () => void;
  /** A take stopped at three minutes. */
  onCap?: () => void;
};

export function HumButton({ onFrame, onTake, onRefused, onCap }: Props) {
  const [down, setDown] = useState(false);
  const live = useRef<{ hum?: Humming; lifted: boolean; pointer?: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  // the newest callbacks, so a take ended by the page hiding or by the cap reaches the page as it stands now
  const cb = useRef({ onFrame, onTake, onRefused, onCap });
  cb.current = { onFrame, onTake, onRefused, onCap };

  const end = () => {
    const s = live.current;
    if (!s || s.lifted) return;
    s.lifted = true;
    setDown(false);
    if (btn.current && s.pointer !== undefined && btn.current.hasPointerCapture?.(s.pointer)) btn.current.releasePointerCapture(s.pointer);
    if (s.hum) void s.hum.stop().then(t => { live.current = null; if (t && t.seconds >= 0.3) cb.current.onTake(t); });
    else live.current = null;
  };

  const begin = (e: PointerEvent) => {
    if (live.current) return;
    e.preventDefault();
    const s: { hum?: Humming; lifted: boolean; pointer?: number } = { lifted: false, pointer: e.pointerId };
    live.current = s;
    try { btn.current?.setPointerCapture(e.pointerId); } catch { /* no capture: up still ends it */ }
    setDown(true);
    startHum({ onFrame: p => cb.current.onFrame(p), onCap: () => { cb.current.onCap?.(); end(); } })
      .then(h => {
        s.hum = h;
        // lifted while the microphone was opening: nothing was sung, nothing is kept
        if (s.lifted) void h.stop().then(() => { if (live.current === s) live.current = null; });
      })
      .catch(() => { if (live.current === s) { live.current = null; setDown(false); } cb.current.onRefused?.(); });
  };

  // the page hidden mid-hum ends the take as a lift would
  useEffect(() => {
    const vis = () => { if (document.visibilityState === 'hidden') end(); };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); end(); };
  }, []);

  return (
    <button ref={btn} type="button" class="fs-new sg-hum" data-humming={down ? '' : undefined} aria-pressed={down}
      onPointerDown={begin} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
      onContextMenu={e => e.preventDefault()}>
      {down ? 'Lift to stop' : 'Hold to hum'}
    </button>
  );
}
