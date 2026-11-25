// The shelf of notebooks (PLAN-WORLDS.md section 4, rule 40): a cover for each notebook across the top of the Flow tab,
// his own first, then the worlds. A cover is the notebook's name in the serif, one hue on its spine and plain paper in
// its hue (decision 16), or the album covers it wears as a band across its top, or his drawing; the app never draws
// one. The one worn says "Open" in print; any other says what it is. In Still (rule 13) a cover is paper and seam: no
// hue, no band, no shadow, no lean (rule 40).
//
// The covers slide sideways under the thumb and settle one at a time in the middle (CSS scroll snap, one stop at a
// time). As they slide each one's distance from the middle is written on it (--d, and --s with its side), so the ones
// beside the middle are smaller and fainter and turned a little toward it, following the thumb exactly (no transition
// while sliding, rule 20). Where they settle, onSettle hears which is in front (the lamp and the tick are Flow's). The
// covers lean with the phone (./tilt.ts), asked for on the first tap. Nothing here moves by itself (rule 31).
//
// A tap on the cover in front opens it (onOpen); a tap on one beside it slides it to the middle (sliding only looks); a
// hold on a cover raises what it wears (onHold, the wears sheet).
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { voiceColour } from '../voice';
import { useHold } from '../parts/Hold';
import { askTilt, lean } from './tilt';
import type { Notebook } from '../../model/notebooks';
import type { Looks } from './looks';

/** How long the covers must be still before they have settled, where the browser says nothing (no scrollend). */
const SETTLE_MS = 120;

/** What a cover wears, as a band across its top: the albums, the first the largest, or his drawing filling it. */
function Band({ looks }: { looks: Looks | undefined }) {
  if (!looks) return null;
  if ('drawing' in looks) return <span class="fl-band" data-n="1" aria-hidden="true"><img src={looks.drawing} alt="" draggable={false} data-drawing="" /></span>;
  return (
    <span class="fl-band" data-n={looks.albums.length} aria-hidden="true">
      {looks.albums.map(a => <img key={a.uri} src={a.src} alt="" draggable={false} data-album={a.uri} />)}
    </span>
  );
}

/** One notebook's cover. */
export function Cover({ book, worn, front, looks, dial, onTap, onHold }: {
  book: Notebook; worn: boolean; front: boolean; looks?: Looks; dial?: JSX.Element; onTap?: (e: MouseEvent) => void; onHold?: () => void;
}) {
  const style = { '--wc': voiceColour(book.colour, 'light') } as JSX.CSSProperties;
  const hold = useHold(() => onHold?.(), e => onTap?.(e));
  return (
    <a class="fl-cover" href="#/journal" data-book={book.id} data-front={front ? '' : undefined} draggable={false}
      aria-current={worn ? 'true' : undefined} style={style} {...hold}>
      <Band looks={looks} />
      <span class="fl-cover-name">{book.name}</span>
      {/* a novel's year dial along its foot (W4, ui/world/Dial.tsx): it takes its own touches */}
      <span class="fl-cover-foot">{dial}<small>{worn ? 'Open' : book.sub}</small></span>
    </a>
  );
}

type Props = {
  books: readonly Notebook[]; worn: string; front: string;
  looks?: Record<string, Looks | undefined>;
  dials?: Record<string, JSX.Element | undefined>;
  onSettle?: (id: string) => void; onOpen?: (book: Notebook) => void; onHold?: (book: Notebook) => void;
};

/** The covers in a row, the one in front in the middle. */
export function Shelf({ books, worn, front, looks = {}, dials = {}, onSettle, onOpen, onHold }: Props) {
  const shelf = useRef<HTMLDivElement>(null);
  const shown = useRef(front);
  shown.current = front;
  const hear = useRef(onSettle);
  hear.current = onSettle;
  // where the shelf stood when the finger went down
  const pressedAt = useRef(0);

  // where each cover stands from the middle, written on it; the nearest is the one that would settle in front
  const measure = (): string | null => {
    const el = shelf.current;
    if (!el) return null;
    // in the shelf's own coordinates (offsets, which a cover's transform does not change)
    const mid = el.scrollLeft + el.clientWidth / 2;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    let near: string | null = null, best = Infinity;
    for (const c of el.querySelectorAll<HTMLElement>('.fl-cover')) {
      const step = c.offsetWidth + gap || 1;
      const s = Math.max(-1.5, Math.min(1.5, (c.offsetLeft + c.offsetWidth / 2 - mid) / step));
      c.style.setProperty('--s', s.toFixed(3));
      c.style.setProperty('--d', Math.min(1, Math.abs(s)).toFixed(3));
      if (Math.abs(s) < best) { best = Math.abs(s); near = c.dataset.book ?? null; }
    }
    return near;
  };

  // the one in front stands in the middle from the first paint, with no slide and no tick
  useLayoutEffect(() => {
    const el = shelf.current;
    const c = el?.querySelector<HTMLElement>(`.fl-cover[data-book="${CSS.escape(front)}"]`);
    if (el && c) el.scrollLeft = c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2;
    const near = measure();
    if (el && near) el.dataset.settled = near;
  }, [books.length]);

  useEffect(() => {
    const el = shelf.current;
    if (!el) return;
    let frame = 0, timer: ReturnType<typeof setTimeout> | undefined;
    // fingers on the shelf: nothing settles under a held finger, however long it rests mid-slide (a pause longer than
    // SETTLE_MS used to settle there, with the tick and the lamp, while the thumb was still down)
    let fingers = 0;
    const settle = () => {
      clearTimeout(timer);
      if (fingers > 0) return;
      delete el.dataset.sliding;
      const near = measure();
      // the shelf's own word that it has come to rest, and on which cover (the e2e waits on it, never on time)
      if (near) el.dataset.settled = near;
      if (near && near !== shown.current) hear.current?.(near);
    };
    const onScroll = () => {
      el.dataset.sliding = '';
      delete el.dataset.settled;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); });
      clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_MS);
    };
    const down = (e: TouchEvent) => { fingers = e.touches.length; };
    // lifted: the covers carry on to their stop and settle there (scrollend, or the fallback); a lift that moved nothing
    // settles where it is
    const up = (e: TouchEvent) => {
      fingers = e.touches.length;
      if (fingers) return;
      clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_MS);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', settle);
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchend', up, { passive: true });
    el.addEventListener('touchcancel', up, { passive: true });
    addEventListener('resize', measure);
    const stop = lean(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('scrollend', settle);
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
      removeEventListener('resize', measure);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      stop();
    };
  }, []);

  /** A cover beside the middle, tapped, slides there; it settles like any other. */
  const bring = (id: string) => {
    const el = shelf.current;
    const c = el?.querySelector<HTMLElement>(`.fl-cover[data-book="${CSS.escape(id)}"]`);
    if (!el || !c) return;
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: calm ? 'auto' : 'smooth' });
  };

  return (
    <div class="fl-shelfwrap">
      {/* the first tap on the shelf asks for the phone's tilt, quietly (./tilt.ts) */}
      <div ref={shelf} class="fl-shelf" role="group" aria-label="Notebooks"
        onPointerDownCapture={() => { pressedAt.current = shelf.current?.scrollLeft ?? 0; void askTilt(); }}>
        {books.map(b => (
          <Cover key={b.id} book={b} worn={b.id === worn} front={b.id === front} looks={looks[b.id]} dial={dials[b.id]}
            onHold={() => {
              // a finger that slid the shelf was not holding a cover, whatever the timer says (a press handed on
              // from a turn, ui/turns.ts, never hears the slide that followed it)
              const el = shelf.current;
              if (!el || el.dataset.sliding !== undefined || Math.abs(el.scrollLeft - pressedAt.current) > 4) return;
              onHold?.(b);
            }}
            onTap={e => {
              e.preventDefault();
              if (b.id === front) onOpen?.(b); else bring(b.id);
            }} />
        ))}
      </div>
    </div>
  );
}
