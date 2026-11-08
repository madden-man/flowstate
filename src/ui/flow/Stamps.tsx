// Your own stamps (PLAN-FLOWS.md 3.5 What if, 3.7 "Across flows and after", others step 8; F6). Three parts:
//
// The prediction helper: on the What if flow's first step ("Something's coming") a row "Write the worry as a
// prediction" opens one rule under it, the caret ready, like Five's rules but one line: the worry, written as a
// prediction to check later, kept on the live episode (episodes.prediction, sealed), never on the journal. At rest the
// rule takes the words and keeps nothing (walk it once). A helper of its own, not Journal: the journal is the journal,
// and the outcome needs the words on the episode to ask about them.
//
// The ask: the morning after (any later day), the Flow list opens with the prediction in his words and two chips,
// "Didn't happen" and "Happened". One tap and the block goes; there is no second ask and no reminder (rule 22: nothing
// nudges). Not in Still (Still never asks, rule 13), not through the door (the list is behind the PIN anyway).
//
// The marks (F4): the curve draws them itself, in place of its seeded record (cycle/curve.ts curveWith, through
// Cycle's stamps); StampMarks below draws them over any other shape that carries a prediction row. Each outcome is a drawn check (didn't happen) or cross (happened) on the curve's flat after the drop,
// his, oldest leftmost, at most STAMPS_MAX (the oldest beyond are not drawn). Once there are any, the seeded "nine in
// ten" marks give way to his (the page sets data-own on the drawing, and the shape's seeded stamps hide under it). No
// number is printed (rule 15). Hidden in Still, like the ghost rings: they are past episodes.
import { useEffect, useRef, useState } from 'preact/hooks';
import { shapeOf } from '../parts/cycle/index';
import { tick } from '../parts/Haptic';
import { dataVersion } from '../sheets';
import { shortDate } from '../date';
import type { DiagramName, Episode, Flow } from '../../db/schema';
import type { Read } from '../../db/fields';
import { setOutcome, setPrediction, stampDue, stampsOf, stampWhen } from '../../model/carried';

/** One rule for the worry, as a prediction. */
export function Prediction({ live, onChanged }: { live?: Read<Episode>; onChanged: () => void }) {
  const [text, setText] = useState(live?.prediction?.text ?? '');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!live?.prediction) field.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const put = (v: string) => {
    setText(v);
    if (!live) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void setPrediction(live.id, v).then(onChanged); }, 300);
  };
  return (
    <div class="fl-five fl-predict">
      <input ref={field} class="fl-five-line" value={text} aria-label="The worry, as a prediction" autocomplete="off"
        onInput={e => put(e.currentTarget.value)} />
    </div>
  );
}

/** The Flow list's block the morning after: the prediction and the two chips. */
export function StampAsk() {
  const [due, setDue] = useState<{ episode: Read<Episode>; flow: Read<Flow> } | null>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let on = true;
    void stampDue().then(d => { if (on) setDue(d ?? null); });
    return () => { on = false; };
  }, [dataVersion.value]);
  if (!due || gone || !due.episode.prediction) return null;
  const w = stampWhen(due.episode.prediction.at);
  const mark = async (o: 'didnt' | 'happened') => {
    tick('check');
    setGone(true);
    await setOutcome(due.episode.id, o);
    const next = await stampDue();
    setDue(next ?? null);
    setGone(false);
  };
  return (
    <div class="fl-stampask fs-notstill" data-episode={due.episode.id}>
      <p class="fl-usual">{w.yesterday ? "Yesterday's worry" : `The worry from ${shortDate(new Date(w.at))}`}</p>
      <p class="fl-line">{due.episode.prediction.text}</p>
      <div class="fs-chips fl-stampchips" role="group" aria-label="Did it happen">
        <button type="button" class="fs-chip" onClick={() => void mark('didnt')}>Didn't happen</button>
        <button type="button" class="fs-chip" onClick={() => void mark('happened')}>Happened</button>
      </div>
    </div>
  );
}

/** The most marks drawn on the flat; the oldest beyond are not drawn, so the flat never fills. */
export const STAMPS_MAX = 12;

/** Where the marks sit: from just past the last step's place to the walk's end, spread evenly, oldest first. */
export function stampTs(lastSlotT: number, k: number): number[] {
  if (!k) return [];
  const a = lastSlotT + (1 - lastSlotT) * 0.12, b = 1 - (1 - lastSlotT) * 0.04;
  return Array.from({ length: k }, (_, i) => (k === 1 ? (a + b) / 2 : a + ((b - a) * i) / (k - 1)));
}

/** His marks on the flow's drawing, from the shape's own at(): a check or a cross a little above the line. */
export function StampMarks({ flowId, diagram, n, version, onMarks }: { flowId: string; diagram: DiagramName; n: number; version: number; onMarks?: (marks: ('didnt' | 'happened')[]) => void }) {
  const [marks, setMarks] = useState<('didnt' | 'happened')[]>([]);
  useEffect(() => {
    let on = true;
    void stampsOf(flowId).then(m => { if (on) { setMarks(m); onMarks?.(m); } });
    return () => { on = false; };
  }, [flowId, version, dataVersion.value]);
  if (!marks.length || n < 1) return null;
  const shape = shapeOf(diagram);
  // F4: the curve draws his marks itself, on its flat (Cycle's stamps, cycle/curve.ts curveWith); this overlay is for
  // a shape that does not
  if (shape.withStamps) return null;
  const shown = marks.slice(-STAMPS_MAX);
  const ts = stampTs(shape.slotT(n - 1, n), shown.length);
  return (
    <div class="fl-stamps fs-notstill" aria-hidden="true">
      <svg viewBox={`0 0 ${shape.w} ${shape.h}`} preserveAspectRatio="xMidYMid meet">
        {shown.map((m, i) => {
          const p = shape.at(ts[i]);
          const x = p.x, y = p.y - 14;
          const d = m === 'didnt'
            ? `M${x - 4} ${y} L${x - 1} ${y + 3.5} L${x + 4.5} ${y - 4}`
            : `M${x - 3.5} ${y - 3.5} L${x + 3.5} ${y + 3.5} M${x + 3.5} ${y - 3.5} L${x - 3.5} ${y + 3.5}`;
          return <path key={i} class={`stamp ${m}`} data-stamp={m} d={d} />;
        })}
      </svg>
    </div>
  );
}
