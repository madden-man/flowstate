// The lock (PLAN.md section 7): on the threshold (parts/Threshold, package 5) the notebook's title and the
// manifesto's two lines sit on the page colour with the ring breathing, and this keypad beneath, no tab bar. The right PIN opens the journal with a tick and a bell; a wrong
// one empties the dots and says so in print grey, and after five wrong tries the keypad waits a little
// longer each time (1s, 2s, 4s, 8s). Never a shake, an alert or a lockout.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Keypad } from '../parts/Keypad';
import { tick } from '../parts/Haptic';
import { bell } from '../parts/Sound';
import { settings } from '../settings';
import { tokenMs } from '../parts/Threshold';
import { tryPin, gateState, PIN_MIN } from './pin';

export const NOT_THAT_ONE = 'Not that one';

/** The keypad and its quiet line: a PIN in, a check, the dots empty on a miss. Shared by the lock screen and the sheets. */
export function usePinEntry(check: (pin: string) => Promise<{ ok: true } | { ok: false; waitMs: number }>, digits?: number) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [held, setHeld] = useState(false);
  const wait = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(wait.current), []);
  const submit = async (pin: string) => {
    setHeld(true);
    const r = await check(pin);
    if (r.ok) return;
    setValue('');
    setNote(NOT_THAT_ONE);
    if (r.waitMs) wait.current = setTimeout(() => setHeld(false), r.waitMs);
    else setHeld(false);
  };
  const onInput = (next: string) => {
    setValue(next);
    if (next) setNote('');
    if (digits && next.length === digits) void submit(next);
  };
  const action = digits ? undefined : { label: 'Open', inert: value.length < PIN_MIN, onPress: () => void submit(value) };
  return { value, onInput, held, note, action };
}

/** The unlock (PLAN-MOTION.md M1.4): the right PIN opens the app at once, and the threshold it leaves stays a moment
 *  as a copy over the page: its keypad and words fade, the page shows through, and the ring opens outward as one thin
 *  circle. The copy is not the app's: it sits in a closed shadow root (so no query of the page, a test's or the app's,
 *  finds a second keypad), nothing in it can be tapped or read out, and it goes when the circle is out.
 *  Called while the threshold is still in the document (LockPad unmounting); nothing waits for it. */
export function openRing(): void {
  const from = document.querySelector<HTMLElement>('.fs-threshold[data-lock]');
  if (!from || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ms = tokenMs('--t-light');
  if (!ms || typeof CSSStyleSheet !== 'function' || !('adoptedStyleSheets' in Document.prototype)) return;
  const ring = from.querySelector('.fs-ring-mark')?.getBoundingClientRect();
  const copy = from.cloneNode(true) as HTMLElement;
  copy.removeAttribute('data-threshold');
  copy.removeAttribute('data-lock');
  copy.classList.add('opening');
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  const root = host.attachShadow({ mode: 'closed' });
  // the page's own rules, so the copy looks exactly as the threshold did (the tokens reach it through inheritance)
  const sheet = new CSSStyleSheet();
  sheet.replaceSync([...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n'));
  root.adoptedStyleSheets = [sheet];
  root.append(copy);
  if (ring && ring.width) {
    // the circle starts as the ring is at this moment of its breath and opens past the farthest corner
    const x = ring.left + ring.width / 2, y = ring.top + ring.height / 2;
    const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const iris = document.createElement('i');
    iris.className = 'fs-iris';
    for (const [k, v] of [['--iris-x', x], ['--iris-y', y], ['--iris-from', ring.width], ['--iris-to', far * 2]] as const) iris.style.setProperty(k, `${v}px`);
    root.append(iris);
  }
  const top = from.scrollTop;
  document.body.append(host);
  copy.scrollTop = top;
  setTimeout(() => host.remove(), ms);
}

/** The keypad for the threshold's slot: the right PIN ticks, rings the unlock bell and opens the app. */
export function LockPad() {
  // the gate swaps the threshold for the page the moment the PIN is right; on the way out, the ring opens
  useEffect(() => () => { if (gateState() !== 'locked') openRing(); }, []);
  const digits = settings.value.lock.digits;
  const entry = usePinEntry(async pin => {
    const r = await tryPin(pin);
    if (r.ok) { tick('unlock'); bell('unlock'); }
    return r;
  }, digits);
  return <Keypad label="PIN" value={entry.value} onInput={entry.onInput} digits={digits} action={entry.action} held={entry.held} note={entry.note} />;
}
