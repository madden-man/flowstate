// The middle of a flow's drawing (F2, PLAN-FLOWS.md sections 4 and 6): the clock while an episode is live, the place a
// thumb holds to breathe, and the wash behind the ring under the last step. It sits over parts/Cycle, centred, so
// Cycle only draws the halo on the dot.
//
// The clock: minutes since the episode's peak mark (or its start) in Day and Night ("6 minutes in", and the step's
// words-only usual under it, so the numbers of "Usually" are not said twice on one screen); words in Still ("a few
// minutes in"), never a digit (rule 13).
// Hold the ring (3.7): a finger down on the middle runs the breath (./breath.ts); the halo scales under it on
// --t-breath, the word reads "in" or "out", and it stops when the finger lifts. Reduced motion stops the scaling;
// the words still turn (rule 18).
// Keep the screen awake (3.7): while the dot is on the peak step and the page is seen (./breath.ts useWakeLock).
// A quiet clock (F4, Flow.quietClock, the 3 a.m. flow) reads in words in every light and is never held awake: the
// flow's own advice is the clock turned away and the bed for sleeping.
import type { JSX } from 'preact';
import { useWakeLock, type Breath } from './breath';
import { clockMinutes, clockStill, clockWords } from '../../model/tips';

type Props = {
  /** The clock's start (the peak mark, or the episode's start) when an episode is live and the dot is on this step. */
  from?: number;
  now: number;
  /** The words under the minutes (the step's usualShort). */
  under?: string;
  /** A finger may hold the middle here (a step with a Ring row). */
  holdable: boolean;
  breath: Breath;
  /** The dot is on the peak in a live episode: the screen stays awake while the page is seen (3.7). */
  awake: boolean;
  /** F4, Flow.quietClock (3 a.m.): the minutes read in words in every light, never a digit; the page passes awake false. */
  quiet?: boolean;
};

export function Wash({ left }: { left: number }) {
  return <div class="fl-wash" aria-hidden="true" style={{ '--wash': String(left) } as JSX.CSSProperties} />;
}

export function Clock({ from, now, under, holdable, breath, awake, quiet }: Props) {
  useWakeLock(awake);
  if (from === undefined && !holdable) return null;
  const m = from === undefined ? undefined : clockMinutes(from, now);
  const down = (e: PointerEvent) => {
    if (!holdable || e.button > 0) return;
    e.preventDefault();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* the pointer has gone */ }
    breath.start();
  };
  const up = () => { if (breath.held) breath.stop(); };
  return (
    <div class={`fl-mid${holdable ? ' holdable' : ''}${breath.held ? ' held' : ''}`}
      role={holdable ? 'button' : undefined} aria-label={holdable ? 'Hold to breathe' : undefined} aria-pressed={holdable ? breath.held : undefined}
      onPointerDown={down} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onContextMenu={e => e.preventDefault()}>
      {breath.held && <span key={breath.since} class="fl-breath" aria-hidden="true" />}
      {breath.held ? (
        <i class="fl-mid-breath" aria-live="polite">{breath.phase}</i>
      ) : (
        <>
          {m !== undefined && !quiet && <span class="fl-mid-min fs-notstill">{clockWords(m)}</span>}
          {m !== undefined && <span class={`fl-mid-min${quiet ? ' fl-quiet' : ' fs-stillonly'}`}>{clockStill(m)}</span>}
          {m !== undefined && under && <i class="fl-mid-under fs-notstill">{under}</i>}
          {m === undefined && <span class="fl-mid-min">hold</span>}
        </>
      )}
    </div>
  );
}
