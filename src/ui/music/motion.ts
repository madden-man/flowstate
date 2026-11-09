// How the music sheet moves (PLAN-MOTION.md M3, DESIGN.md rules 26 to 28). An album tapped: the drop goes out
// from under the thumb and the other covers hush, at once, beside the bell and the tick; only when Spotify says
// it is playing does a copy of the cover travel to the small cover by the ♪ and land there. A playlist opened:
// its strip's covers travel to the first places of its grid. Every duration and curve is read from tokens.css
// as the light sets it, so Still is slower by itself and Reduce Motion (every duration zero) moves nothing.
import { signal } from '@preact/signals';
import { tokenMs } from '../parts/Sheet';

/** A curve token as the browser takes it ("cubic-bezier(...)"), for the Web Animations API. */
const curve = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'ease-out';
/** Reduce Motion sets every duration token to zero: then nothing here moves, and everything still happens. */
const still = () => tokenMs('--t-page') === 0;
const frames = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// ---- the tap ----

/** Where the thumb was, a soft ring goes out across the cover (a keyboard's Enter starts it from the middle). */
export function drop(tile: HTMLElement, e: MouseEvent) {
  if (still()) return;
  tile.querySelector(':scope > .fs-tile-drop')?.remove();
  const r = tile.getBoundingClientRect();
  const x = e.detail ? e.clientX - r.left : r.width / 2;
  const y = e.detail ? e.clientY - r.top : r.height / 2;
  // big enough to reach the farthest corner from where it starts, so it is drawn sharp and only ever shrunk
  const d = 2 * Math.max(Math.hypot(x, y), Math.hypot(r.width - x, y), Math.hypot(x, r.height - y), Math.hypot(r.width - x, r.height - y));
  const ring = document.createElement('span');
  ring.className = 'fs-tile-drop';
  ring.setAttribute('aria-hidden', 'true');
  Object.assign(ring.style, { left: `${x - d / 2}px`, top: `${y - d / 2}px`, width: `${d}px`, height: `${d}px` });
  ring.addEventListener('animationend', () => ring.remove(), { once: true });
  tile.appendChild(ring);
}

let hushed: ReturnType<typeof setTimeout> | undefined;
/** The other covers hush for one --t-page and come back (Still's covers are already dimmed; parts.css leaves them). */
export function hush(cell: HTMLElement) {
  const grid = cell.closest('.fs-tiles');
  if (!grid || still()) return;
  clearTimeout(hushed);
  grid.querySelector('[data-chosen]')?.removeAttribute('data-chosen');
  cell.setAttribute('data-chosen', '');
  grid.classList.add('hush');
  hushed = setTimeout(() => { grid.classList.remove('hush'); cell.removeAttribute('data-chosen'); }, tokenMs('--t-page'));
}

// ---- the small cover by the ♪ ----

/** The header on screen (an open rail of earlier pages has none of its own; this is the page's). */
const header = () => [...document.querySelectorAll<HTMLElement>('.fs-hdr')].find(h => h.getBoundingClientRect().height > 0);
const miniOf = (albumUri: string) => header()?.querySelector<HTMLElement>(`.fs-mini[data-mini="${CSS.escape(albumUri)}"]`) ?? null;

/** The album travelling now: its small cover waits, unseen, for the copy instead of landing by itself. */
export const flyingTo = signal<string | null>(null);
export const inFlight = (albumUri: string) => flyingTo.peek() === albumUri;

/** The small cover lands: from 1.3 to its own size, on --ease-settle, no overshoot. */
export function land(mini: HTMLElement | null) {
  const img = mini?.querySelector<HTMLElement>('img, span');
  if (!img || still()) return;
  img.animate([{ transform: 'scale(1.3)' }, { transform: 'none' }], { duration: tokenMs('--t-page'), easing: curve('--ease-settle') });
}

/** While the music sheet is up, the small cover a tile flew to sits lit above the scrim; put away with the sheet. */
export function unlight() {
  document.querySelectorAll('.fs-mini[data-lit]').forEach(m => m.removeAttribute('data-lit'));
}

/** Spotify said yes: a copy of the tapped cover travels from its tile to the small cover by the ♪ and lands. Where
 *  the small cover shows another album (the page heard one first), it goes to the ♪ and fades into it; where the
 *  sheet covers the header, it goes to the sheet's top edge under the ♪ and fades there. Measured after layout. */
export async function fly(tile: HTMLElement, albumUri: string) {
  if (still() || inFlight(albumUri)) return;
  flyingTo.value = albumUri;
  try {
    await frames();
    const img = tile.querySelector('img');
    const sheet = tile.closest<HTMLElement>('.fs-sheet');
    if (!img || !img.src || !sheet || !tile.isConnected) return;
    const mini = miniOf(albumUri);
    const word = header()?.querySelector<HTMLElement>('.fs-musicword');
    const aim = mini?.querySelector<HTMLElement>('img, span') ?? word;
    if (!aim) return;
    const from = tile.getBoundingClientRect();
    const to = aim.getBoundingClientRect();
    const edge = sheet.getBoundingClientRect().top;
    const hidden = to.top + to.height / 2 > edge;
    const lands = !!mini && !hidden;
    // the copy never lands bigger than the small cover is
    const size = mini ? to.width : Math.min(to.width, to.height);
    const x = to.left + (to.width - size) / 2;
    const y = hidden ? edge - size / 2 : to.top + (to.height - size) / 2;

    const copy = document.createElement('img');
    copy.className = 'fs-fly';
    copy.src = img.src;
    copy.alt = '';
    copy.setAttribute('aria-hidden', 'true');
    Object.assign(copy.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.appendChild(copy);
    if (lands) mini!.setAttribute('data-lit', '');

    const s = size / from.width;
    const at = (k: number) => {
      const w = from.width * s * k;
      return `translate(${x + size / 2 - w / 2 - from.left}px, ${y + size / 2 - w / 2 - from.top}px) scale(${s * k})`;
    };
    const r0 = getComputedStyle(tile).borderTopLeftRadius;
    const r1 = `${parseFloat(getComputedStyle(aim).borderTopLeftRadius || '0') / s}px`;
    const o = getComputedStyle(copy).opacity;
    // one curve over the whole move: it covers the distance early, reaches the small cover a little large and
    // settles to its size on the long tail, so arriving and landing are one motion with no stop between
    const keys: Keyframe[] = lands
      ? [{ transform: 'none', borderRadius: r0 }, { transform: at(1.3), offset: .8 }, { transform: at(1), borderRadius: r1 }]
      : [{ transform: 'none', borderRadius: r0, opacity: o }, { opacity: o, offset: .6 }, { transform: at(1), borderRadius: r1, opacity: 0 }];
    const run = copy.animate(keys, { duration: tokenMs('--t-page') + tokenMs('--t-ui'), easing: curve('--ease-settle'), fill: 'forwards' });
    await run.finished.catch(() => undefined);
    copy.remove();
  } finally {
    // a later tap's flight owns it now; leave it be
    if (flyingTo.peek() === albumUri) flyingTo.value = null;
  }
}

// ---- a playlist into its covers ----

/** The strip's covers as they stood when the row was tapped, for the grid to take over. */
let dealt: { id: string; rects: DOMRect[] } | null = null;

/** A playlist row tapped: remember where its strip's covers were. */
export function deal(row: HTMLElement, id: string) {
  dealt = still() ? null : { id, rects: [...row.querySelectorAll<HTMLElement>('.fs-strip > *')].map(c => c.getBoundingClientRect()) };
}

/** The grid's first render takes the strip it was opened from (once; Playlists and back opens it plain). */
export function takeDeal(id: string): DOMRect[] | null {
  const d = dealt;
  dealt = null;
  return d && d.id === id ? d.rects : null;
}

/** Before the grid is painted: each of the first covers starts where it was in the strip and travels to its place. */
export function dealInto(tiles: HTMLElement[], rects: DOMRect[]) {
  const duration = tokenMs('--t-page');
  const easing = curve('--ease-settle');
  rects.forEach((a, i) => {
    const t = tiles[i];
    if (!t) return;
    const b = t.getBoundingClientRect();
    if (!b.width) return;
    t.animate([
      { transformOrigin: '0 0', transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})` },
      { transformOrigin: '0 0', transform: 'none' },
    ], { duration, easing });
  });
}
