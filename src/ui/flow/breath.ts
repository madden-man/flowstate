// The flow page's clocks (F2, PLAN-FLOWS.md 3.7): the minute the page redraws on, the breath a held finger runs, and
// the wake lock at the peak. Nothing here fires on its own: the minute only redraws words, the breath runs only while a
// finger is on the ring, and the wake lock only keeps the screen lit while the dot is on the peak and the page is seen.
import { useEffect, useRef, useState } from 'preact/hooks';
import { tick } from '../parts/Haptic';
import { bell } from '../parts/Sound';

/** Now, redrawn every half minute while the page is open (the clock in the middle says whole minutes). */
export function useNow(every = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    const seen = () => { if (document.visibilityState === 'visible') setNow(Date.now()); };
    document.addEventListener('visibilitychange', seen);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', seen); };
  }, [every]);
  return now;
}

/** The breath: four seconds in, six out (DESIGN.md rule 18, --t-breath 10s; six breaths a minute, PLAN-FLOWS.md P10). */
export const IN_MS = 4_000;
export const OUT_MS = 6_000;

export type Breath = { held: boolean; since: number | null; phase: 'in' | 'out'; start: () => void; stop: () => void };

/**
 * Hold the ring: while a finger is down, the breath runs from the in-breath, and each turn (in, then out) is felt
 * through parts/Haptic (the "breath" site of rule 19) and, with the breath tone on, heard through parts/Sound.
 * The first tick lands inside the touch itself. The later ones come from a timer while the finger stays down: the
 * switch trick may only fire inside a direct gesture on the iPhone, so those may be felt or may come to nothing
 * (the iPhone check in PLAN-FLOWS.md 3.7 is still open). Either way nothing is reported.
 */
export function useBreath(): Breath {
  const [since, setSince] = useState<number | null>(null);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const turn = (p: 'in' | 'out') => {
    setPhase(p);
    tick('breath');
    if (p === 'in') bell('breathIn'); else bell('breathOut');
    timer.current = setTimeout(() => turn(p === 'in' ? 'out' : 'in'), p === 'in' ? IN_MS : OUT_MS);
  };
  const stop = () => { clearTimeout(timer.current); setSince(null); setPhase('in'); };
  const start = () => { clearTimeout(timer.current); setSince(Date.now()); turn('in'); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return { held: since !== null, since, phase, start, stop };
}

type Sentinel = { release: () => Promise<void> };
type WakeLock = { request: (type: 'screen') => Promise<Sentinel> };

/** Keeps the screen awake while `on` and the page is visible (Safari 16.4+); released when it goes off or the page
 *  hides, asked again when the page is seen. Where there is no Wake Lock API, nothing happens. */
export function useWakeLock(on: boolean): void {
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock;
    if (!on || !wl) return;
    let held: Sentinel | null = null, gone = false;
    const ask = () => {
      if (gone || held || document.visibilityState !== 'visible') return;
      wl.request('screen').then(s => { if (gone) void s.release().catch(() => undefined); else held = s; }).catch(() => undefined);
    };
    const drop = () => { const s = held; held = null; if (s) void s.release().catch(() => undefined); };
    const seen = () => (document.visibilityState === 'visible' ? ask() : drop());
    ask();
    document.addEventListener('visibilitychange', seen);
    return () => { gone = true; document.removeEventListener('visibilitychange', seen); drop(); };
  }, [on]);
}
