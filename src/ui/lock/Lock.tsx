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

// ---- the unlock (PLAN-MOTION.md M1.4) ----
// The right PIN opens the app at once, and the threshold it leaves stays a moment as a copy over the page: its keypad
// and words fade, the page shows through, and the ring opens outward as one thin circle. The copy is not the app's: it
// sits in a closed shadow root (so no query of the page, a test's or the app's, finds a second keypad), nothing in it
// can be tapped or read out, and it goes when the circle is out.
//
// The shadow root needs the page's rules. Reading them (about 75KB, rule by rule) and parsing them is too slow for the
// frame the app opens in, so it is done once while the keypad waits, when the browser is idle, and kept here. The unlock
// only adopts the sheet; if it is not ready, or the page's sheets changed since, the ring is skipped, never built late.

type Built = { sheet: CSSStyleSheet; sig: string };
let built: Built | null = null;
let host: HTMLElement | null = null;

const canShadow = () => typeof CSSStyleSheet === 'function' && typeof Document !== 'undefined' && 'adoptedStyleSheets' in Document.prototype;

/** Which sheets the page has, cheaply: how many, and how many rules in all. */
function sheetsSig(): string {
  let rules = 0;
  for (const s of document.styleSheets) { try { rules += s.cssRules.length; } catch { /* another origin's: not ours */ } }
  return `${document.styleSheets.length}:${rules}`;
}

/** Only the rules the copy can use: the threshold's own parts, every @keyframes, and the @media blocks that hold
 *  such rules. A small sheet keeps the copy's first style pass short too. The tokens need no rule: they inherit. */
const PARTS = /fs-threshold|fs-ring|fs-manifesto|fs-keypad|fs-keys?\b|fs-key-|fs-dots|fs-word|fs-iris|fl-door/;
function keep(rules: CSSRuleList): string {
  const out: string[] = [];
  for (const r of rules) {
    if (r instanceof CSSStyleRule) { if (PARTS.test(r.selectorText)) out.push(r.cssText); }
    else if (r instanceof CSSKeyframesRule) out.push(r.cssText);
    else if (r instanceof CSSMediaRule) { const inner = keep(r.cssRules); if (inner) out.push(`@media ${r.conditionText} {\n${inner}\n}`); }
  }
  return out.join('\n');
}

/** Builds the copy's sheet when the browser is next idle (Safari has no requestIdleCallback: a task, then). */
export function prepareRing(): void {
  if (!canShadow()) return;
  const build = () => {
    const sig = sheetsSig();
    if (built?.sig === sig) return;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync([...document.styleSheets].map(s => { try { return keep(s.cssRules); } catch { return ''; } }).join('\n'));
    built = { sheet, sig };
  };
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(build, { timeout: 2000 });
  else setTimeout(build, 0);
}

/** Takes the copy away (its time is up, or a second unlock is about to make another). */
function clearRing(): void {
  host?.remove();
  host = null;
}

/** Called while the threshold is still in the document (LockPad unmounting); nothing waits for it. */
export function openRing(): void {
  const t0 = performance.now();
  clearRing();
  const from = document.querySelector<HTMLElement>('.fs-threshold[data-lock]');
  if (!from || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ms = tokenMs('--t-light');
  if (!ms || !built || built.sig !== sheetsSig()) return;
  const ring = from.querySelector('.fs-ring-mark')?.getBoundingClientRect();
  const copy = from.cloneNode(true) as HTMLElement;
  copy.removeAttribute('data-threshold');
  copy.removeAttribute('data-lock');
  copy.classList.add('opening');
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.inert = true;
  const root = el.attachShadow({ mode: 'closed' });
  root.adoptedStyleSheets = [built.sheet];   // the page's own rules; the tokens reach the copy through inheritance
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
  document.body.append(el);
  if (top) copy.scrollTop = top;   // only when the threshold had scrolled: setting it lays the copy out at once
  host = el;
  // gone after --t-light; a hidden tab holds timers back, so coming back past that time takes it away too
  const until = performance.now() + ms;
  const back = () => { if (document.visibilityState === 'visible' && performance.now() >= until) done(); };
  const done = () => { if (host === el) clearRing(); else el.remove(); removeEventListener('visibilitychange', back); clearTimeout(t); };
  const t = setTimeout(done, ms);
  addEventListener('visibilitychange', back);
  performance.measure('fs-open-ring', { start: t0 });
}

/** The keypad for the threshold's slot: the right PIN ticks, rings the unlock bell and opens the app. */
export function LockPad() {
  // the gate swaps the threshold for the page the moment the PIN is right; on the way out, the ring opens
  // the copy's sheet is built while the keypad waits, so the unlock itself only adopts it
  useEffect(() => { prepareRing(); return () => { if (gateState() !== 'locked') openRing(); }; }, []);
  const digits = settings.value.lock.digits;
  const entry = usePinEntry(async pin => {
    const r = await tryPin(pin);
    if (r.ok) { tick('unlock'); bell('unlock'); }
    return r;
  }, digits);
  return <Keypad label="PIN" value={entry.value} onInput={entry.onInput} digits={digits} action={entry.action} held={entry.held} note={entry.note} />;
}
