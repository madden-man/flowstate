// What to do at a step (F2, PLAN-FLOWS.md sections 3.1, 3.7 and 6), as a walk (DESIGN.md rule 33, 2026-11-11): the
// step's things come one at a time on every step, each a card in the title size that does its own thing: the ring to
// hold, the covers to put on, the text as it will read in Messages, the five rules. The cards sit side by side in a
// strip that follows the finger and lands on one (rule 20); "Next" turns it too, and a plain thing ticked turns to the
// next one not yet done. The marks under the strip are where you are, drawn, never a number, and they leave in Still.
// A tick on a live episode writes episodes.done; at rest it only draws (walk it once, 3.7). A wise tip is the wiser
// second person in italic print under the strip, not a card (rule 17). Three cards in Still with the short words.
//
// Helpers (the word in print at the row's end): Still enters Still (settle(): its tick and the settling tone);
// ♪ opens the music sheet (tapMusic); Ring is the halo on the dot and the middle a thumb can hold (FlowPage, Clock);
// Five opens five rules on the page, kept on the episode, never on the journal; Journal links today's page to the
// episode and opens it; Timer sets a return time 20 minutes to 24 hours away. Helpers that only move you (Still, ♪,
// Five's rules) work at rest too, so the flow can be rehearsed calm; the ones that write (Journal, Timer, Five's
// lines) wait for a live episode. A print tip (F3, the 988 line) is never a row: PrintLines prints it under these.
// F6: the person row (./Person.tsx) opens Messages with his text, or the person sheet while it has no name; the
// prediction row (./Stamps.tsx) opens one rule for the worry written as a prediction, kept on the episode.
// PLAN-PICKS.md P1, on the walk: an On card is its covers and lines, there on the card (./On.tsx OnCard); the sheet is
// gone. Its head is not a button: a line ticked on the card, or a cover Spotify plays, draws its check, and the head
// then reads its pick ("An album, or the TV: New Girl"). On stays behind the PIN, like ♪: what he puts on is his.
// Calendar (the walk): the card is a link that opens the phone's Calendar; a tap draws its check. The app writes
// nothing there, and reads nothing back.
// Meditate S3: Sit opens #/flow/meditate. A tap does not tick it: with a live episode the row puts the episode and the
// tip in Meditate's sitFrom (in memory, read once by the page), and a sit there of a minute or more ticks the row when
// it ends; at rest it carries nothing. A tap on a ticked Sit row un-ticks it like any row.
//
// Through the door (F5, the journal locked, door true): a tick draws and writes nothing; the rows that write or leave
// the page (Journal, Timer, ♪) and Five's rules stay behind the PIN, and so does the return line. Ring and the Still
// row stay: they only move you; so does Sit (S3), which opens Meditate through the door with no episode carried.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Check } from '../parts/Check';
import { settleFromMoon } from '../still';
import { tapMusic } from '../music/state';
import { clockTime } from '../date';
import { LinkRow, PersonRow, PersonSheet, mark } from './Person';
import { sitFrom } from './Meditate';
import { Prediction } from './Stamps';
import { OnCard } from './On';
import { holdProps, type Breath } from './breath';
import { moves } from '../turns';
import { walkCards, nextOpen } from '../../model/walk';
import { savePerson } from '../../model/carried';
import type { Episode, OnPick, Step, Tip, TipHelper } from '../../db/schema';
import type { Read } from '../../db/fields';
import {
  doneIds, earliestReturn, linkToday, onTitle, returnFor, returnPhase, setDone, setLines, setReturnAt, shownTips, tipText,
  RETURN_MIN_MS,
} from '../../model/tips';

/** The helper's word at the row's end, as the flows proposal prints it. */
export const HELPER_WORD: Record<TipHelper, string> = {
  still: 'Still', music: '♪', ring: 'Ring', five: 'Five', journal: 'Journal', timer: 'Timer', person: 'Person', prediction: 'Predict', sit: 'Sit', on: 'On',
  calendar: 'Calendar',
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
  /** The breath a held thumb runs (./breath.ts): a Ring card's own ring is held like the middle of the drawing. */
  breath?: Breath;
};

/** The link a Calendar card opens: the phone's own Calendar, on today. Nothing is written there. */
export const CALENDAR_HREF = 'calshow:';

/** The helpers that stay behind the PIN: they write (Journal, Timer, Five's lines) or leave the page for an account (♪),
 *  and On (PLAN-PICKS.md P1), since what he puts on is his. */
export const BEHIND_PIN: TipHelper[] = ['journal', 'timer', 'music', 'five', 'person', 'prediction', 'on', 'calendar'];

const SWIPE_SLOP_PX = 12;
const SWIPE_PX = 60;

/** A horizontal swipe (touch and pen; the Questions page's pattern; the note at a step, ./Notes.tsx, uses it): -1 back, 1 on. A drag that reads as vertical
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

export function Tips({ step, flowTips, live: stored, still, now, onChanged, door, flowId, breath }: Props) {
  const { route } = useLocation();
  // through the door the live episode is read for its ticks and never written
  const live = door ? undefined : stored;
  const tips = shownTips(step, still).filter(t => !door || !t.helper || !BEHIND_PIN.includes(t.helper));
  const { cards, wise } = walkCards(tips);
  // ticks drawn at rest (walk it once) and ticks drawn before the write lands
  const [drawn, setDrawn] = useState<Record<string, boolean>>({});
  const [fiveOpen, setFiveOpen] = useState(false);
  const [predictOpen, setPredictOpen] = useState(false);
  const [filling, setFilling] = useState<Tip | null>(null);
  const [fillOpen, setFillOpen] = useState(false);
  // the line drawn on an On card at rest (in memory only), by the card's tip
  const [restOn, setRestOn] = useState<Record<string, OnPick | null>>({});
  // the walk: the card the strip rests on
  const [at, setAt] = useState(0);
  const deck = useRef<HTMLDivElement>(null);
  const turning = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    setDrawn({}); setFiveOpen(false); setPredictOpen(false); setRestOn({}); setAt(0);
    clearTimeout(turning.current);
    deck.current?.scrollTo({ left: 0 });
  }, [step.id, live?.id]);
  useEffect(() => () => clearTimeout(turning.current), []);
  // the strip is as tall as the card in front, not the tallest one: measured after display, and again when a card
  // grows (the five rules open, the covers come from the cache)
  useEffect(() => {
    const el = deck.current;
    if (!el) return;
    const fit = () => {
      const front = el.children[Math.min(at, el.children.length - 1)] as HTMLElement | undefined;
      if (front?.offsetHeight) el.style.height = `${front.offsetHeight}px`;
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    for (const c of Array.from(el.children)) ro.observe(c);
    return () => ro.disconnect();
  });
  const done = doneIds(stored);
  const isDone = (t: Tip) => drawn[t.id] ?? done.has(t.id);
  if (!tips.length) return null;

  /** Turn the strip to card k: it travels under no finger, so Reduce Motion makes it a change (rule 18). */
  const turnTo = (k: number) => {
    const el = deck.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * k, behavior: moves() ? 'smooth' : 'auto' });
    setAt(k);
  };
  const onScroll = () => {
    const el = deck.current;
    if (el && el.clientWidth) setAt(Math.max(0, Math.min(cards.length - 1, Math.round(el.scrollLeft / el.clientWidth))));
  };

  const run = async (t: Tip) => {
    switch (t.helper) {
      case 'still': settleFromMoon(); break;
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
    if (t.helper === 'sit' && on) {
      // the sit ticks it, not the tap
      sitFrom.value = live ? { episodeId: live.id, tipId: t.id } : null;
      route('/flow/meditate');
      return;
    }
    setDrawn(d => ({ ...d, [t.id]: on }));
    // a plain thing done: once its check is drawn, the strip turns to the next one not yet done
    if (on && !t.helper) {
      const k = nextOpen(cards, id => id === t.id || isDone(cards.find(c => c.id === id)!), cards.indexOf(t));
      clearTimeout(turning.current);
      if (k >= 0) turning.current = setTimeout(() => turnTo(k), TURN_AFTER_MS);
    }
    if (live) { await setDone(live.id, t.id, on); onChanged(); }
    if (on) await run(t);
  };

  // an On card's head reads its pick once one is put on: the live episode's, or the one drawn at rest
  const picked = (t: Tip) => (live ? onTitle(step, live) : restOn[t.id] && isDone(t) ? restOn[t.id]!.title : undefined);

  const card = (t: Tip) => (t.helper === 'person' ? (
    <PersonRow t={t} live={live} done={isDone(t)} now={now} onChanged={onChanged}
      onDrawn={() => setDrawn(d => ({ ...d, [t.id]: true }))} onFill={() => { setFilling(t); setFillOpen(true); }} />
  ) : t.helper === 'on' ? (
    <>
      <p class={`fs-check fl-on-head${isDone(t) ? ' done' : ''}`}>
        {mark}<span class="fs-check-text">{tipText(t, still)}{picked(t) ? `: ${picked(t)}` : ''}</span><small>{HELPER_WORD.on}</small>
      </p>
      <OnCard step={step} tip={t} flowId={flowId} live={live} rest={restOn[t.id]}
        onRest={p => { setRestOn(r => ({ ...r, [t.id]: p })); setDrawn(d => ({ ...d, [t.id]: !!p })); }} onChanged={onChanged} />
    </>
  ) : t.helper === 'calendar' ? (
    <LinkRow href={CALENDAR_HREF} text={tipText(t, still)} word={HELPER_WORD.calendar} opens="Calendar" done={isDone(t)}
      onDrawn={() => { setDrawn(d => ({ ...d, [t.id]: true })); if (live) void setDone(live.id, t.id, true).then(onChanged); }} />
  ) : (
    <>
      <Check checked={isDone(t)} onChange={on => void toggle(t, on)} word={t.helper ? HELPER_WORD[t.helper] : undefined}>
        {tipText(t, still)}
      </Check>
      {t.helper === 'ring' && breath && (
        <div class={`fl-hold${breath.held ? ' held' : ''}`} role="button" aria-label="Hold the ring" aria-pressed={breath.held} {...holdProps(breath)}>
          {breath.held && <span key={breath.since} class="fl-breath" aria-hidden="true" />}
          <i aria-live="polite">{breath.held ? breath.phase : 'hold'}</i>
        </div>
      )}
      {t.helper === 'five' && (fiveOpen || !!live?.lines?.length) && <Five live={live} onChanged={onChanged} />}
      {t.helper === 'timer' && live?.returnAt !== undefined && <Timer live={live} now={now} onChanged={onChanged} />}
      {t.helper === 'prediction' && (predictOpen || !!live?.prediction) && <Prediction live={live} onChanged={onChanged} />}
    </>
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
  const k = Math.min(at, Math.max(0, cards.length - 1));

  return (
    <>
      <div class="fl-tips fl-walk" aria-label="What to do">
        {back}
        {cards.length > 0 && (
          <div class="fl-deck" ref={deck} onScroll={onScroll}>
            {cards.map((t, i) => (
              <div key={t.id} class="fl-tip fl-card" data-tip={t.id} data-helper={t.helper} aria-current={i === k ? 'step' : undefined}>{card(t)}</div>
            ))}
          </div>
        )}
        {cards.length > 1 && (
          <div class="fl-next">
            <span class="fl-pips fs-notstill" aria-hidden="true">
              {cards.map((t, i) => <i key={t.id} class={`${i === k ? 'here' : ''}${isDone(t) ? ' done' : ''}`} />)}
            </span>
            <button type="button" class="fs-word" onClick={() => turnTo((k + 1) % cards.length)}>Next ›</button>
          </div>
        )}
        {wise.map(t => <p key={t.id} class="fl-wise" data-tip={t.id}>{tipText(t, still)}</p>)}
      </div>
      {fill}
    </>
  );
}

/** How long after a plain tick the strip turns: the check is drawn first (rule 27), then the page turns (rule 31:
 *  it starts from that touch, runs once and ends still). */
const TURN_AFTER_MS = 600;

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
