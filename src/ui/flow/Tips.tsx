// What to do at a step (F2, PLAN-FLOWS.md sections 3.1, 3.7 and 6): the step's tips under its said line, as drawn
// checks (parts/Check). A tick on a live episode writes episodes.done; at rest it only draws (walk it once, 3.7).
// A wise tip is the wiser second person in italic print, not a check (rule 17). At most six rows, three in Still with
// the short words; every row ends on a blank rule (rule 5). At the peak the rows come one at a time, full width in
// the title size, the next by a swipe or "Next" (3.7, one thing at a time: acute stress narrows attention).
//
// Helpers (the word in print at the row's end): Still enters Still (settle(): its tick and the settling tone);
// ♪ opens the music sheet (tapMusic); Ring is the halo on the dot and the middle a thumb can hold (FlowPage, Clock);
// Five opens five rules on the page, kept on the episode, never on the journal; Journal links today's page to the
// episode and opens it; Timer sets a return time 20 minutes to 24 hours away. Helpers that only move you (Still, ♪,
// Five's rules) work at rest too, so the flow can be rehearsed calm; the ones that write (Journal, Timer, Five's
// lines) wait for a live episode. A print tip (F3, the 988 line) is never a row: PrintLines prints it under these.
// F6: the person row (./Person.tsx) opens Messages with his text, or the person sheet while it has no name; the
// prediction row (./Stamps.tsx) opens one rule for the worry written as a prediction, kept on the episode.
//
// Through the door (F5, the journal locked, door true): a tick draws and writes nothing; the rows that write or leave
// the page (Journal, Timer, ♪) and Five's rules stay behind the PIN, and so does the return line. Ring and the Still
// row stay: they only move you.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Check } from '../parts/Check';
import { settle } from '../still';
import { tapMusic } from '../music/state';
import { clockTime } from '../date';
import { PersonRow, PersonSheet } from './Person';
import { Prediction } from './Stamps';
import { savePerson } from '../../model/carried';
import type { Episode, Step, Tip, TipHelper } from '../../db/schema';
import type { Read } from '../../db/fields';
import {
  doneIds, earliestReturn, linkToday, returnFor, returnPhase, setDone, setLines, setReturnAt, shownTips, tipText,
  RETURN_MIN_MS,
} from '../../model/tips';

/** The helper's word at the row's end, as the flows proposal prints it. */
export const HELPER_WORD: Record<TipHelper, string> = {
  still: 'Still', music: '♪', ring: 'Ring', five: 'Five', journal: 'Journal', timer: 'Timer', person: 'Person', prediction: 'Predict',
};

type Props = {
  step: Step;
  /** Every tip of the flow: the return line finds when the timer was set from any step's Timer row. */
  flowTips: Tip[];
  /** The live episode, if one is open. */
  live?: Read<Episode>;
  still: boolean;
  now: number;
  /** Something was written: read the page again. */
  onChanged: () => void;
  /** Through the door without the PIN (F5): draw, never write; the helpers that write or leave stay behind the PIN. */
  door?: boolean;
  /** The flow the step is on (F6): an unnamed person row writes its person from the page. */
  flowId?: string;
};

/** The helpers that stay behind the PIN: they write (Journal, Timer, Five's lines) or leave the page for an account (♪). */
const BEHIND_PIN: TipHelper[] = ['journal', 'timer', 'music', 'five', 'person', 'prediction'];

const SWIPE_SLOP_PX = 12;
const SWIPE_PX = 60;

/** A horizontal swipe (touch and pen; the Questions page's pattern): -1 back, 1 on. A drag that reads as vertical
 *  is left to the scroll. Nothing moves under the finger, so there is no motion to reduce. */
export function useSwipe(go: (dir: 1 | -1) => void) {
  const s = useRef<{ x: number; y: number; id: number; dir?: 'x' | 'y' } | null>(null);
  return {
    onPointerDown: (e: PointerEvent) => { s.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY, id: e.pointerId }; },
    onPointerMove: (e: PointerEvent) => {
      const d = s.current;
      if (!d || d.id !== e.pointerId || d.dir) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.hypot(dx, dy) > SWIPE_SLOP_PX) d.dir = Math.abs(dx) > Math.abs(dy) * 1.5 ? 'x' : 'y';
    },
    onPointerUp: (e: PointerEvent) => {
      const d = s.current;
      s.current = null;
      if (!d || d.id !== e.pointerId || d.dir !== 'x') return;
      const dx = e.clientX - d.x;
      if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
    },
    onPointerCancel: () => { s.current = null; },
  };
}

export function Tips({ step, flowTips, live: stored, still, now, onChanged, door, flowId }: Props) {
  const { route } = useLocation();
  // through the door the live episode is read for its ticks and never written
  const live = door ? undefined : stored;
  const tips = shownTips(step, still).filter(t => !door || !t.helper || !BEHIND_PIN.includes(t.helper));
  // ticks drawn at rest (walk it once) and ticks drawn before the write lands
  const [drawn, setDrawn] = useState<Record<string, boolean>>({});
  const [fiveOpen, setFiveOpen] = useState(false);
  const [one, setOne] = useState(0);
  const [predictOpen, setPredictOpen] = useState(false);
  const [filling, setFilling] = useState<Tip | null>(null);
  const [fillOpen, setFillOpen] = useState(false);
  useEffect(() => { setDrawn({}); setFiveOpen(false); setPredictOpen(false); setOne(0); }, [step.id, live?.id]);
  const done = doneIds(stored);
  const isDone = (t: Tip) => drawn[t.id] ?? done.has(t.id);
  const swipe = useSwipe(dir => setOne(i => (i + dir + tips.length) % tips.length));
  if (!tips.length) return null;

  const run = async (t: Tip) => {
    switch (t.helper) {
      case 'still': settle(); break;
      case 'music': tapMusic(); break;
      case 'five': setFiveOpen(true); break;
      case 'prediction': setPredictOpen(true); break;
      case 'journal':
        if (live && await linkToday(live.id)) route('/journal');
        break;
      case 'timer':
        if (live && live.returnAt === undefined) { await setReturnAt(live.id, earliestReturn(Date.now())); onChanged(); }
        break;
      default:
    }
  };
  const toggle = async (t: Tip, on: boolean) => {
    setDrawn(d => ({ ...d, [t.id]: on }));
    if (live) { await setDone(live.id, t.id, on); onChanged(); }
    if (on) await run(t);
  };

  const row = (t: Tip) => (t.wise
    ? <p key={t.id} class="fl-wise" data-tip={t.id}>{tipText(t, still)}</p>
    : t.helper === 'person' ? (
      <div key={t.id} class="fl-tip" data-tip={t.id}>
        <PersonRow t={t} live={live} done={isDone(t)} now={now} onChanged={onChanged}
          onDrawn={() => setDrawn(d => ({ ...d, [t.id]: true }))} onFill={() => { setFilling(t); setFillOpen(true); }} />
      </div>
    ) : (
      <div key={t.id} class="fl-tip" data-tip={t.id}>
        <Check checked={isDone(t)} onChange={on => void toggle(t, on)} word={t.helper ? HELPER_WORD[t.helper] : undefined}>
          {tipText(t, still)}
        </Check>
        {t.helper === 'five' && (fiveOpen || !!live?.lines?.length) && <Five live={live} onChanged={onChanged} />}
        {t.helper === 'timer' && live?.returnAt !== undefined && <Timer live={live} now={now} onChanged={onChanged} />}
        {t.helper === 'prediction' && (predictOpen || !!live?.prediction) && <Prediction live={live} onChanged={onChanged} />}
      </div>
    ));

  // the person sheet, from an unnamed person row: closing it writes the person on the tip
  const fill = filling && flowId && (
    <PersonSheet open={fillOpen} person={filling.person} onClose={p => {
      if (!fillOpen) return;
      const t = filling;
      setFillOpen(false);
      if (p.name) void savePerson(flowId, step.id, t.id, p).then(onChanged);
    }} />
  );

  const back = live?.returnAt !== undefined ? <Return live={live} returnAt={live.returnAt} now={now} still={still} tips={flowTips} /> : null;

  if (step.peak) {
    const i = Math.min(one, tips.length - 1);
    return (
      <>
      <div class="fl-tips fl-one" aria-label="What to do" {...swipe}>
        {back}
        {row(tips[i])}
        {tips.length > 1 && (
          <div class="fl-next">
            <span class="fl-usual">Swipe for the next</span>
            <button type="button" class="fs-word" onClick={() => setOne((i + 1) % tips.length)}>Next ›</button>
          </div>
        )}
      </div>
      {fill}
      </>
    );
  }
  return <><div class="fl-tips" aria-label="What to do">{back}{tips.map(row)}</div>{fill}</>;
}

/** Five things you can see: five rules, the caret on the first; each line kept on the live episode (sealed). At rest
 *  the rules take the words and keep nothing. */
function Five({ live, onChanged }: { live?: Read<Episode>; onChanged: () => void }) {
  const [lines, setL] = useState<string[]>(() => Array.from({ length: 5 }, (_, i) => live?.lines?.[i] ?? ''));
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!live?.lines?.length) first.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const put = (i: number, v: string) => {
    const next = lines.map((l, k) => (k === i ? v : l));
    setL(next);
    if (!live) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void setLines(live.id, next).then(onChanged); }, 300);
  };
  return (
    <div class="fl-five" role="group" aria-label="Five things you can see">
      {lines.map((l, i) => (
        <input key={i} ref={i === 0 ? first : undefined} class="fl-five-line" value={l} aria-label={`Thing ${i + 1} you can see`}
          autocomplete="off" spellcheck={false} onInput={e => put(i, e.currentTarget.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget.nextElementSibling as HTMLInputElement | null)?.focus(); } }} />
      ))}
    </div>
  );
}

/** The return time (the Timer helper): a clock time, the 20-minute minimum printed beside it. Digits, so not in Still. */
function Timer({ live, now, onChanged }: { live: Read<Episode>; now: number; onChanged: () => void }) {
  const at = live.returnAt!;
  const least = earliestReturn(now);
  return (
    <label class="fl-timer fs-notstill">
      <span class="fl-usual">Back at</span>
      <input class="fs-input" type="time" value={clockTime(new Date(at))} aria-label="Back at"
        onChange={e => { void setReturnAt(live.id, returnFor(e.currentTarget.value, Date.now())).then(onChanged); }} />
      <span class="fl-usual">{RETURN_MIN_MS / 60_000} minutes at least: {clockTime(new Date(least))}</span>
    </label>
  );
}

/** What the page says about the return time when it is open: "back at", then "slower now?", then "ready?". */
function Return({ live, returnAt, now, still, tips }: { live: Read<Episode>; returnAt: number; now: number; still: boolean; tips: Tip[] }) {
  const timerIds = new Set(tips.filter(t => t.helper === 'timer').map(t => t.id));
  const setAt = live.done.find(d => timerIds.has(d.tipId))?.at;
  const phase = returnPhase(returnAt, setAt, now);
  const t = clockTime(new Date(returnAt));
  const words = still
    ? { waiting: 'Back soon.', slower: 'Slower now?', ready: 'Slower now? Ready?' }[phase]
    : { waiting: `Back at ${t}.`, slower: `Back at ${t}. Slower now?`, ready: `It's ${t}. Slower now? Ready?` }[phase];
  return <p class="fl-wise fl-return" data-phase={phase}>{words}</p>;
}
