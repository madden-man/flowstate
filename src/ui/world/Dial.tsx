// The year dial (PLAN-WORLDS.md section 4, W4): the bible's timeline from its first year to its last, each character a
// thin line from birth to death in their colour, and one upright stroke at the year worn. It lies along a novel cover's
// foot, where a drag moves the year before stepping in, and rises as the year sheet from a tap on the header's year,
// with the bible's chapters and world events marked on it. Drawn in tokens: the lifelines take their voice's hue
// (rule 3); in Still they are the seam, no hue (rule 13).
//
// It answers the finger itself (pointer events with capture, touch-action: none), so a drag on a cover's foot moves the
// year and never slides the shelf or opens the cover. What it shows follows the finger at once, with no transition
// (rule 20); the year is written once the finger lifts (onYear). Arrow keys move it a year at a time.
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { voiceColour } from '../voice';
import { hueOf } from '../../bridge/colour';
import type { NovelPocket } from '../../bridge/protocol';
import { spanOf } from '../../model/story';
import './world.css';

type Props = {
  pocket: NovelPocket; year: number;
  /** The year as the finger moves it (the ages under the cover follow). */
  onMove?: (year: number) => void;
  /** The year let go on, written by the caller. */
  onYear: (year: number) => void;
  /** The year sheet: the chapters and world events marked along the line. */
  marks?: boolean;
};

const clamp = (y: number, a: number, b: number) => Math.max(a, Math.min(b, y));

export function Dial({ pocket, year, onMove, onYear, marks }: Props) {
  const span = spanOf(pocket);
  const [held, setHeld] = useState<number | null>(null);
  const track = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ id: number; y: number; start: number } | null>(null);
  // a year read back from where it was written takes over from the finger's, once the finger is off
  useEffect(() => { if (!drag.current) setHeld(null); }, [year]);
  if (!span) return null;
  const { from, to } = span;
  const shown = clamp(held ?? year, from, to);
  // spanOf never gives a span of no length; guarded here too, so no lifeline ever stands at NaN
  const at = (y: number) => ((clamp(y, from, to) - from) / ((to - from) || 1)) * 100;
  const yearAt = (x: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.round(from + clamp((x - r.left) / (r.width || 1), 0, 1) * (to - from));
  };
  const move = (y: number) => {
    if (drag.current && drag.current.y === y) return;
    if (drag.current) drag.current.y = y;
    setHeld(y);
    onMove?.(y);
  };
  // the dial is the finger's: nothing under it (the cover's tap and hold, the shelf's slide) hears this touch
  const stop = (e: Event) => e.stopPropagation();
  const down = (e: JSX.TargetedPointerEvent<HTMLSpanElement>) => {
    stop(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, y: shown, start: year };
    move(yearAt(e.clientX));
  };
  const moving = (e: JSX.TargetedPointerEvent<HTMLSpanElement>) => {
    stop(e);
    if (drag.current?.id === e.pointerId) move(yearAt(e.clientX));
  };
  const up = (e: JSX.TargetedPointerEvent<HTMLSpanElement>) => {
    stop(e);
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    // the year it was let go on, against the year it stood at when the finger came down
    if (d.y !== d.start) onYear(d.y); else setHeld(null);
  };
  /** The finger taken away from the dial before it lifted (the system took the touch, or the capture was lost): the
   *  drag ends, nothing is written, and the year it stood at comes back. After a lift there is no drag left to end. */
  const cancel = (e: Event) => {
    stop(e);
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setHeld(null);
    onMove?.(d.start);
  };
  const key = (e: JSX.TargetedKeyboardEvent<HTMLSpanElement>) => {
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    stop(e);
    const y = clamp(shown + step, from, to);
    setHeld(y);
    onMove?.(y);
    if (y !== year) onYear(y);
  };
  const lives = pocket.characters.filter(c => typeof c.born === 'number');
  const marked = marks ? [...pocket.chapters.filter(c => typeof c.year === 'number').map(c => c.year!), ...pocket.events.map(e => e.year)] : [];
  return (
    <span class="wd-dial" data-marks={marks ? '' : undefined}
      onClick={e => { e.preventDefault(); stop(e); }}>
      <span ref={track} class="wd-track" role="slider" tabIndex={0} aria-label="Story year"
        aria-valuemin={from} aria-valuemax={to} aria-valuenow={shown} data-year={shown}
        onPointerDown={down} onPointerMove={moving} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={key}>
        <span class="wd-lives" aria-hidden="true">
          {lives.map(c => (
            <i key={c.id} style={{
              '--vc': voiceColour({ hue: hueOf(c.familyColour) }, 'light'),
              marginLeft: `${at(c.born!)}%`, marginRight: `${100 - at(c.died ?? to)}%`,
            } as JSX.CSSProperties} />
          ))}
        </span>
        {marked.map((y, i) => <b key={i} class="wd-mark" aria-hidden="true" style={{ left: `${at(y)}%` }} />)}
        <b class="wd-now" aria-hidden="true" style={{ left: `${at(shown)}%` }} />
      </span>
      <span class="wd-ends" aria-hidden="true"><small>{from}</small><output>{shown}</output><small>{to}</small></span>
    </span>
  );
}
