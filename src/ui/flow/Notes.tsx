// A note to the next one of you (PLAN-FLOWS.md 3.7 and 4 steps 11 and 12, F6). The first time a flow is opened at
// rest after an episode ended, in Day and Night, the page prints once "Anything to tell the next one of you who's
// here?" with a rule under it, the caret ready, and chips for the step the note lands on (the step the episode spent
// longest on, else the peak). The words are his (flow.notes, sealed) and autosave (rule 6). A swipe sideways puts the
// question away for that episode; it is never printed again either way, since it is marked asked the moment it shows.
// Nothing else in the app asks a question.
//
// Next time the page shows that step, the newest note sits above the said line in italic, as his own line (rule 16:
// his words, so the serif italic of a line, not the print of the page), with "you · 11 / 9" in print under it. Still
// keeps the words and drops the date (rule 13: no numbers). The step sheet's Earlier lists every note of the step with
// its day; Strike strikes one (rule 10), and a struck note leaves the page.
//
// At rest, under "what helped": the last episode's note and the page he wrote that day (step 12, "It passed before").
// Through the door none of this is drawn: notes are behind the PIN (F5).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Strike } from '../parts/Strike';
import { shortDate } from '../date';
import { light } from '../light';
import { dataVersion } from '../sheets';
import { hrefOf } from '../journal/href';
import { useSwipe } from './Tips';
import type { Episode, Flow, FlowNote, Page, Step } from '../../db/schema';
import type { Read } from '../../db/fields';
import {
  asksFor, markAsked, moveNote, noteOf, noteShownAt, notesAt, noteStepOf, pageOfEpisode, strikeNote, writeNote,
} from '../../model/carried';

/** The episode the page is asking about, if any. Decided when the page first has its data, so the block stays while
 *  he writes, though the episode is marked asked at once. */
export function useAsk(flow: Read<Flow> | undefined, last: Read<Episode> | undefined, atRest: boolean, door: boolean): [string | null, () => void] {
  const opened = useRef(Date.now());
  const decided = useRef(false);
  const [asking, setAsking] = useState<string | null>(null);
  useEffect(() => {
    if (decided.current || !flow) return;
    decided.current = true;
    if (!atRest || !asksFor(last, opened.current, { still: light.value === 'still', door, locked: !!flow.locked })) return;
    setAsking(last!.id);
    void markAsked(last!.id);
  }, [flow, last]);
  return [asking, () => setAsking(null)];
}

/** The question, the rule under it and the step chips. */
export function AskNote({ flow, episode, onDone }: { flow: Read<Flow>; episode: Read<Episode>; onDone: () => void }) {
  const had = noteOf(flow, episode.id);
  const [text, setText] = useState(had?.text ?? '');
  const [stepId, setStepId] = useState(had?.stepId ?? noteStepOf(flow, episode) ?? flow.steps[0]?.id);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { area.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const swipe = useSwipe(() => { clearTimeout(timer.current); if (text.trim() && stepId) void writeNote(flow.id, episode.id, stepId, text); onDone(); });
  if (!stepId) return null;
  const put = (v: string) => {
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void writeNote(flow.id, episode.id, stepId, v); }, 300);
  };
  const pick = (id: string) => { setStepId(id); void moveNote(flow.id, episode.id, id); };
  return (
    <div class="fl-ask fs-notstill" {...swipe}>
      <p class="fl-usual">Anything to tell the next one of you who's here?</p>
      <textarea ref={area} class="fl-note-field" rows={2} value={text} aria-label="To the next one of you" spellcheck
        onInput={e => put(e.currentTarget.value)} />
      <div class="fs-chips fl-note-steps" role="group" aria-label="Shows at">
        {flow.steps.map(s => (
          <button key={s.id} type="button" class="fs-chip" aria-pressed={s.id === stepId} onClick={() => pick(s.id)}>{s.name}</button>
        ))}
      </div>
    </div>
  );
}

/** His note above a step's said line: italic, his; "you · 11 / 9" under it, not in Still. */
export function NoteAtStep({ flow, step }: { flow: Read<Flow>; step: Step }) {
  const n = flow.locked ? undefined : noteShownAt(flow, step.id);
  if (!n) return null;
  return (
    <div class="fl-note" data-note={n.id}>
      <p class="fl-line">{n.text}</p>
      <p class="fl-usual fs-notstill">you · {shortDate(new Date(n.at))}</p>
    </div>
  );
}

/** At rest: the last episode's note and the page written that day ("It passed before"). */
export function RestCarried({ flow, last, asking }: { flow: Read<Flow>; last?: Read<Episode>; asking: boolean }) {
  const [page, setPage] = useState<{ page: Read<Page>; line: string } | null>(null);
  useEffect(() => {
    let on = true;
    void pageOfEpisode(last).then(p => { if (on) setPage(p ?? null); });
    return () => { on = false; };
  }, [last?.id, last?.pageId, dataVersion.value]);
  const n = last && !asking && !flow.locked ? noteOf(flow, last.id) : undefined;
  const note = n && n.text.trim() && n.struck === undefined ? n : undefined;
  const at = note && flow.steps.find(s => s.id === note.stepId);
  if (!note && !page) return null;
  return (
    <div class="fl-carried">
      {note && (
        <div class="fl-note" data-note={note.id}>
          <p class="fl-usual fs-notstill">To the next one of you</p>
          <p class="fl-line">{note.text}</p>
          <p class="fl-usual fs-notstill">you · {shortDate(new Date(note.at))}{at && ` · shows at ${at.name}`}</p>
        </div>
      )}
      {page && (
        <nav class="fs-links fs-notstill" aria-label="Written that day">
          <a class="fs-link" href={hrefOf(page.page)}><small>Journal · {shortDate(new Date(page.page.createdAt))}</small><span>{page.line}</span></a>
        </nav>
      )}
    </div>
  );
}

/** The step sheet's Earlier, notes part: every note of the step with its day, newest first; Strike strikes one. */
export function EarlierNotes({ flow, stepId }: { flow: Read<Flow>; stepId: string }) {
  const [notes, setNotes] = useState<FlowNote[]>(() => notesAt(flow, stepId));
  useEffect(() => setNotes(notesAt(flow, stepId)), [flow, stepId]);
  if (!notes.length) return null;
  const strike = async (id: string) => {
    const at = Date.now();
    setNotes(ns => ns.map(n => (n.id === id ? { ...n, struck: at } : n)));
    await strikeNote(flow.id, id, at);
  };
  return (
    <>
      {notes.map(n => (n.struck !== undefined
        ? <p key={n.id} class="fs-was fl-note-was" data-note={n.id}><Strike>{n.text}</Strike> <small class="fs-print">· you · {shortDate(new Date(n.at))}</small></p>
        : (
          <div key={n.id} class="fl-note-was" data-note={n.id}>
            <p class="fl-line">{n.text}</p>
            <div class="fl-tipacts">
              <small class="fs-print">you · {shortDate(new Date(n.at))}</small>
              <button type="button" class="fs-word" onClick={() => void strike(n.id)} aria-label={`Strike ${n.text}`}>Strike</button>
            </div>
          </div>
        )))}
    </>
  );
}
