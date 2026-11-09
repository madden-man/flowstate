// parts/Circle (PLAN-MEDITATE.md, S1): the Meditate page's one drawn circle, the ring of parts/Cycle with nothing on it
// (no marks, no arrows, no dotted way back). At rest it breathes on --t-breath by CSS, four seconds in and six out, the
// breath of the Still ring and the Panic ring. While sitting it is driven from the sound's own clock (the scape's
// AudioContext.currentTime, or the wall clock for Quiet), so the ocean's waves and the circle cannot drift apart.
// Reduce Motion stills it. A tap on it is the page's one act: it begins a sit, and ends one.
//
// The circle is drawn twice in the same place: the line in print, and a second path in ink (class "sat",
// pathLength 1, nothing shown) that S2 draws round as the clock of a sit with an end.
//
// Under the thumb (rule 26): parts/Press puts data-down on the button and the drawn line gives, scale(var(--press)),
// down at once and back over --t-ui. The two circles (this one and the list row's CircleMark) carry data-circle, so the
// motion pass's open turn (M2) can name them for the row's circle to travel into the page's.
import { useEffect, useRef } from 'preact/hooks';
import { IN_S, OUT_S, BREATH_S } from './Sound';

/** The page's circle: a 328 by 264 drawing (the width of parts/Cycle, a rule and a half taller), radius 110. */
export const CIRCLE_D = 'M164 22 A110 110 0 1 1 164 242 A110 110 0 1 1 164 22';
/** The row's circle: the ring's own size on parts/Cycle's 328 by 224 grid. */
const MARK_D = 'M164 40 A72 72 0 1 1 164 184 A72 72 0 1 1 164 40';

/** The circle's breath, the CSS keyframes' shape on a clock: .86 breathed out, 1 at the top of the in-breath. */
export function breathScale(seconds: number): number {
  const p = ((seconds % BREATH_S) + BREATH_S) % BREATH_S;
  const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x)));
  const open = p < IN_S ? ease(p / IN_S) : 1 - ease((p - IN_S) / OUT_S);
  return 0.86 + 0.14 * open;
}

const stillMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** How long the circle takes to move from where the CSS breath had it onto the sound's clock. */
const JOIN_S = 1.2;

type Props = {
  /** A sit is on: the circle breathes on `clock`, not on the CSS. */
  sitting: boolean;
  /** The sit's clock: its first in-breath begins at t0, on now()'s seconds. */
  clock?: { t0: number; now: () => number } | null;
  /** The word in the middle at rest ("begin"); gone while sitting. */
  word: string;
  label: string;
  onTap: () => void;
};

export function Circle({ sitting, clock, word, label, onTap }: Props) {
  const breath = useRef<SVGGElement>(null);
  /** Where the CSS breath had the circle at the tap, so the sit starts from there and not from a jump. */
  const from = useRef(1);
  const tap = () => {
    const g = breath.current;
    if (g && !sitting) {
      const m = getComputedStyle(g).transform;
      const a = m && m !== 'none' ? Number(m.slice(m.indexOf('(') + 1).split(',')[0]) : 1;
      from.current = Number.isFinite(a) && a > 0 ? a : 1;
    }
    onTap();
  };

  useEffect(() => {
    const g = breath.current;
    if (!g) return;
    if (!sitting || !clock) { g.style.transform = ''; return; }
    if (stillMotion()) return;
    let raf = 0;
    const frame = () => {
      const t = clock.now() - clock.t0, k = Math.max(0, Math.min(1, t / JOIN_S));
      const s = breathScale(t), join = from.current + (s - from.current) * (0.5 - 0.5 * Math.cos(Math.PI * k));
      g.style.transform = `scale(${(k < 1 ? join : s).toFixed(4)})`;
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => {
      cancelAnimationFrame(raf);
      // back at rest, the CSS breath carries on from where the sound's clock left it
      const p = ((clock.now() - clock.t0) % BREATH_S + BREATH_S) % BREATH_S;
      g.style.transform = '';
      g.style.animationDelay = `${(-p).toFixed(2)}s`;
    };
  }, [sitting, clock]);

  return (
    <button type="button" class="md-circle" data-circle="page" aria-label={label} onClick={tap}>
      <svg viewBox="0 0 328 264" aria-hidden="true">
        <g class="md-breath" ref={breath}>
          <path class="arc" d={CIRCLE_D} />
          <path class="arc sat" pathLength={1} d={CIRCLE_D} />
        </g>
      </svg>
      <span class="md-mid">{word}</span>
    </button>
  );
}

/** The list row's small circle, where a flow has its small drawing: the ring with nothing on it, still. */
export function CircleMark() {
  return (
    <div class="fs-cycle small" data-circle="row">
      <svg viewBox="0 0 328 224" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path class="arc" d={MARK_D} />
      </svg>
    </div>
  );
}
