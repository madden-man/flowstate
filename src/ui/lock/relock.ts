// Relock after relockAfterMin in the background (PLAN.md section 7). Hidden starts the clock; coming back
// after the interval (or a timer that fires while hidden, where the phone lets it) drops the key. pagehide
// stores the moment too, so a page restored from the back-forward cache checks the same clock on pageshow.
import { settings } from '../settings';
import { relock } from './pin';

const STAMP = 'flowstate-hidden-at';
export const RELOCK_CHOICES: [number, string][] = [[0, 'Immediately'], [1, '1 min'], [5, '5 min'], [15, '15 min'], [60, '60 min']];

export function startRelock(win: Window = window): () => void {
  const doc = win.document;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hiddenAt: number | null = null;
  const after = () => settings.value.lock.relockAfterMin * 60_000;
  const stop = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const mark = () => {
    hiddenAt = Date.now();
    try { win.sessionStorage.setItem(STAMP, String(hiddenAt)); } catch { /* private mode: the memory copy is enough */ }
  };
  const since = (): number | null => {
    if (hiddenAt !== null) return hiddenAt;
    try { const v = Number(win.sessionStorage.getItem(STAMP)); return v > 0 ? v : null; } catch { return null; }
  };
  const clear = () => {
    hiddenAt = null;
    try { win.sessionStorage.removeItem(STAMP); } catch { /* nothing kept */ }
  };
  const hide = () => {
    mark();
    stop();
    if (after() === 0) { relock(); return; }
    timer = setTimeout(relock, after());
  };
  const show = () => {
    stop();
    const t = since();
    if (t !== null && Date.now() - t >= after()) relock();
    clear();
  };
  const onVis = () => (doc.visibilityState === 'hidden' ? hide() : show());
  const onShow = (e: PageTransitionEvent) => { if (e.persisted) show(); };
  doc.addEventListener('visibilitychange', onVis);
  win.addEventListener('pagehide', hide);
  win.addEventListener('pageshow', onShow);
  return () => {
    stop();
    doc.removeEventListener('visibilitychange', onVis);
    win.removeEventListener('pagehide', hide);
    win.removeEventListener('pageshow', onShow);
  };
}
