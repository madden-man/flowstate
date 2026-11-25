// The covers lean with the phone (PLAN-WORLDS.md section 4, decision 17), kept apart so it can fail on its own. iOS
// hands over the phone's tilt only after DeviceOrientationEvent.requestPermission() is answered, and only from inside a
// tap (a click: a touch's pointerdown is no user activation), so a tap on the shelf asks, quietly; any answer but yes,
// or a phone with no such event, and nothing leans. An ask that throws or is refused unanswered was no answer, so the
// next tap asks again. Reduce Motion: no lean. Still: no lean (the light is read on every reading). Unverified on the iPhone
// itself (PLAN-WORLDS.md section 13): W0 tries it there.

/** The most a cover leans, in degrees, either way. */
export const LEAN_MAX = 6;

type Orientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/** Whether the phone has answered (or has no such event): only then is the ask never made again. */
let answered = false;
let granted = false;
/** An ask under way, so a second tap before the answer does not ask twice. */
let asking: Promise<boolean> | null = null;
/** Shelves on screen waiting for a yes. */
const waiting = new Set<() => void>();

const stillOrCalm = () =>
  document.documentElement.dataset.light === 'still'
  || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** The lean for a reading of the phone's left-right tilt (gamma, -90 to 90): a few degrees, never past LEAN_MAX. */
export const leanOf = (gamma: number | null | undefined): number =>
  typeof gamma === 'number' && Number.isFinite(gamma) ? Math.max(-LEAN_MAX, Math.min(LEAN_MAX, gamma / 5)) : 0;

/** Asks from the tap it is called in, until the phone answers; then never again. Never throws; resolves whether the
 *  tilt may be read. */
export function askTilt(): Promise<boolean> {
  if (answered) return Promise.resolve(granted);
  return (asking ??= ask().finally(() => { asking = null; }));
}
async function ask(): Promise<boolean> {
  try {
    const DOE = (typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined) as Orientation | undefined;
    granted = !DOE ? false : typeof DOE.requestPermission === 'function' ? (await DOE.requestPermission()) === 'granted' : true;
    answered = true;
  } catch {
    // no answer (not from a tap, or the ask itself failed): a later tap asks again
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
export const resetTilt = () => { answered = false; granted = false; asking = null; };
