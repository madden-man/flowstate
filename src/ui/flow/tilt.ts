// The covers lean with the phone (PLAN-WORLDS.md section 4, decision 17), kept apart so it can fail on its own. iOS
// hands over the phone's tilt only after DeviceOrientationEvent.requestPermission() is answered, and only from inside a
// tap, so the first tap on the shelf asks, quietly; any answer but yes, any error, or a phone with no such event, and
// nothing leans. Reduce Motion: no lean. Still: no lean (the light is read on every reading). Unverified on the iPhone
// itself (PLAN-WORLDS.md section 13): W0 tries it there.

/** The most a cover leans, in degrees, either way. */
export const LEAN_MAX = 6;

type Orientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

let asked = false;
let granted = false;
/** Shelves on screen waiting for a yes. */
const waiting = new Set<() => void>();

const stillOrCalm = () =>
  document.documentElement.dataset.light === 'still'
  || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** The lean for a reading of the phone's left-right tilt (gamma, -90 to 90): a few degrees, never past LEAN_MAX. */
export const leanOf = (gamma: number | null | undefined): number =>
  typeof gamma === 'number' && Number.isFinite(gamma) ? Math.max(-LEAN_MAX, Math.min(LEAN_MAX, gamma / 5)) : 0;

/** Asks once, from the tap it is called in. Never throws; resolves whether the tilt may be read. */
export async function askTilt(): Promise<boolean> {
  if (asked) return granted;
  asked = true;
  try {
    const DOE = (typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined) as Orientation | undefined;
    if (!DOE) return (granted = false);
    granted = typeof DOE.requestPermission === 'function' ? (await DOE.requestPermission()) === 'granted' : true;
  } catch {
    granted = false;
  }
  if (granted) for (const w of waiting) w();
  return granted;
}

/** Leans an element (its --lean, in degrees) with the phone while it is on screen; returns the way to stop. Does
 *  nothing until askTilt has been answered yes. */
export function lean(el: HTMLElement): () => void {
  let frame = 0;
  let next = 0;
  const set = () => { frame = 0; el.style.setProperty('--lean', `${stillOrCalm() ? 0 : next.toFixed(2)}deg`); };
  const on = (e: DeviceOrientationEvent) => {
    next = leanOf(e.gamma);
    if (!frame) frame = requestAnimationFrame(set);
  };
  let listening = false;
  const start = () => {
    if (listening || !granted) return;
    listening = true;
    addEventListener('deviceorientation', on);
  };
  start();
  // the answer may come after the shelf is up (the first tap)
  waiting.add(start);
  return () => {
    waiting.delete(start);
    cancelAnimationFrame(frame);
    removeEventListener('deviceorientation', on);
    el.style.removeProperty('--lean');
  };
}

/** For the tests: forget the answer. */
export const resetTilt = () => { asked = false; granted = false; };
