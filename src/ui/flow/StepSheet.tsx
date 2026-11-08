// The step sheet (F2, PLAN-FLOWS.md 4 step 13): a step's words, editable. Name, your line (Tommy's, italic), what the
// page says, usually, and the things to do: each tip's text, its helper as a chip, a long press to lift it and drag it
// to its place, Strike to strike it (rule 10: struck, never deleted). Earlier lists every word this step no longer
// says, struck through with the day it changed (rule 10, the paradox sheet's pattern). Closing the sheet keeps the work
// (rule 6: no save button): an edit writes the step and adds the new version to the flow's revisions.
// Opened by the Edit word under a step read at rest (walk it once: the words are changed calm, never mid-episode).
// The same sheet adds a step (F3's "+ step" under a flow at rest, and "name the first step" on a flow made from
// nothing): it opens empty, and closing it (Save, inert until there is a name, or Done) with a name written adds the step (model/flow-make.ts addStep), then
// keeps whatever else was written (usually, the tips) with saveStep. With no name, nothing is written. Still keeps
// the page to its words (rule 13), so "+ step" waits for Day or Night; "name the first step" stays.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Sheet } from '../parts/Sheet';
import { Strike } from '../parts/Strike';
import { useHold } from '../parts/Hold';
import { tick } from '../parts/Haptic';
import { shortDate } from '../date';
import { HELPER_WORD } from './Tips';
import { PersonSheet } from './Person';
import { EarlierNotes } from './Notes';
import { personRowText } from '../../model/carried';
import type { Flow, Step, Tip, TipHelper } from '../../db/schema';
import type { Read } from '../../db/fields';
import { earlierOf, moveTip, newTip, saveStep, type StepDraft } from '../../model/tips';
import { addStep, isUnnamed } from '../../model/flow-make';

/** A sheet opening is felt (rule 19): the Edit word and "+ step". */
export const tickSheet = () => tick('sheet');

/** "+ step" under a flow at rest, or "name the first step" on a flow made from nothing: the step sheet, empty. */
export function AddStep({ flow, onSaved }: { flow: Read<Flow>; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  if (flow.locked) return null;
  const first = flow.steps.some(isUnnamed);
  const show = () => { tickSheet(); setN(k => k + 1); setOpen(true); };
  return (
    <>
      {first
        ? <button type="button" class="fl-name-first" onClick={show}>name the first step<span class="fl-caret" aria-hidden="true" /></button>
        : <div class="fl-add fs-notstill"><button type="button" class="fs-chip add" onClick={show}>+ step</button></div>}
      {n > 0 && <StepSheet key={n} flow={flow} open={open} first={first} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  );
}

/** The helpers a tip can carry from this sheet. Person (F6) opens the person sheet over this one: who, the number,
 *  what the text says; prediction (F6) is the What if worry written as a prediction, one rule on the episode. */
const HELPERS: TipHelper[] = ['still', 'music', 'ring', 'five', 'journal', 'timer', 'person', 'prediction'];

/** step: the step to edit; none to add one (first: it names the flow's unnamed step). */
type Props = { flow: Read<Flow>; step?: Step; first?: boolean; open: boolean; onClose: () => void; onSaved: () => void };

const draftOf = (s: Step | undefined): StepDraft => ({
  name: s?.name ?? '', line: s?.line ?? '', said: s?.said ?? '', usual: s?.usual ?? '', tips: structuredClone(s?.tips ?? []),
});

/** A new step: added by name, then the rest of what was written kept on it. */
async function addAndSave(flow: Read<Flow>, d: StepDraft): Promise<void> {
  if (!d.name.trim()) return;
  const blank = flow.steps.find(isUnnamed)?.id;
  const next = await addStep(flow.id, d);
  const id = blank ?? next?.steps.at(-1)?.id;
  if (next && id && (d.usual?.trim() || d.tips.some(t => t.text.trim()))) await saveStep(flow.id, id, d);
}

export function StepSheet({ flow, step, first, open, onClose, onSaved }: Props) {
  const [d, setD] = useState<StepDraft>(() => draftOf(step));
  const dRef = useRef(d);
  dRef.current = d;
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open && step) setD(draftOf(step)); }, [open, step?.id]);
  // adding: the caret waits in the name
  useEffect(() => {
    if (!open || step) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => nameRef.current?.focus({ preventScroll: true })));
    return () => cancelAnimationFrame(r);
  }, [open]);
  // closing keeps the work
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) void (step ? saveStep(flow.id, step.id, dRef.current) : addAndSave(flow, dRef.current)).then(onSaved);
    wasOpen.current = open;
  }, [open]);

  const set = (k: 'name' | 'line' | 'said' | 'usual') => (e: JSX.TargetedEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.currentTarget.value;
    setD(p => ({ ...p, [k]: v }));
  };
  const setTip = (id: string, patch: Partial<Tip>) => setD(p => ({ ...p, tips: p.tips.map(t => (t.id === id ? { ...t, ...patch } : t)) }));

  // ---- the drag: a long press lifts a tip; it rides under the finger and drops into its place ----
  const list = useRef<HTMLDivElement>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const drag = useRef<{ id: string; y: number; dy: number } | null>(null);
  useEffect(() => {
    if (!lifted) return;
    const rowOf = (id: string) => list.current?.querySelector<HTMLElement>(`[data-tip="${id}"]`) ?? null;
    const hold = (e: TouchEvent) => e.preventDefault();
    const move = (e: PointerEvent) => {
      const g = drag.current, el = rowOf(lifted);
      if (!g || !el) return;
      g.dy = e.clientY - g.y;
      const live = dRef.current.tips.filter(t => !t.struck);
      const i = live.findIndex(t => t.id === g.id), half = el.offsetHeight / 2;
      const j = g.dy > half && i < live.length - 1 ? i + 1 : g.dy < -half && i > 0 ? i - 1 : i;
      if (j !== i) {
        const h = rowOf(live[j].id)?.offsetHeight ?? 0;
        g.y += j > i ? h : -h;
        g.dy -= j > i ? h : -h;
        const all = dRef.current.tips;
        setD(p => ({ ...p, tips: moveTip(all, g.id, all.findIndex(t => t.id === live[j].id)) }));
      }
      el.style.transform = `translateY(${g.dy - 2}px)`;
    };
    const up = () => {
      const el = rowOf(lifted);
      if (el) el.style.transform = '';
      if (drag.current) tick('drop');
      drag.current = null;
      setLifted(null);
    };
    document.addEventListener('touchmove', hold, { passive: false });
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    return () => {
      document.removeEventListener('touchmove', hold);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };
  }, [lifted]);
  const lift = (id: string, y: number) => { drag.current = { id, y, dy: 0 }; setLifted(id); };

  // the person sheet (F6), over this one, for one tip: closing it keeps the person on the draft (saved with the step)
  const [personFor, setPersonFor] = useState<string | null>(null);
  const [personOpen, setPersonOpen] = useState(false);
  const personTip = d.tips.find(t => t.id === personFor);
  const askPerson = (id: string) => { tick('sheet'); setPersonFor(id); setPersonOpen(true); };

  const earlier = step ? earlierOf({ revisions: flow.revisions, steps: flow.steps.map(s => (s.id === step.id ? { ...s, ...d } : s)) }, step.id) : [];
  const tips = d.tips.filter(t => !t.struck);

  return (
    <>
    <Sheet open={open} onClose={onClose} title={step ? d.name.trim() || step.name : first ? 'The first step' : 'New step'}
      action={step ? undefined : { label: 'Save', inert: !d.name.trim(), onPress: onClose }}>
      <div class="fs-rows fl-stepsheet">
        <label class="fs-row stack">
          <span class="fs-print">Name</span>
          <input ref={nameRef} class="fs-input" value={d.name} aria-label="Name" placeholder={step ? undefined : 'Two or three words'}
            autocomplete="off" onInput={set('name')} />
        </label>
        <label class="fs-row stack">
          <span class="fs-print">Your line</span>
          <textarea class="fs-input fs-area fl-line-field" rows={2} value={d.line} aria-label="Your line" onInput={set('line')} />
        </label>
        <label class="fs-row stack">
          <span class="fs-print">What the page says</span>
          <textarea class="fs-input fs-area fl-said-field" rows={4} value={d.said} aria-label="What the page says" onInput={set('said')} />
        </label>
        <label class="fs-row stack">
          <span class="fs-print">Usually</span>
          <input class="fs-input" value={d.usual} aria-label="Usually" autocomplete="off" onInput={set('usual')} />
        </label>
        <div class="fs-row stack">
          <span class="fs-print">Things to do</span>
          <div ref={list} class="fl-tiplist" role="list" aria-label="Things to do">
            {tips.map(t => (
              <TipRow key={t.id} t={t} lifted={lifted === t.id} onLift={y => lift(t.id, y)}
                onText={text => setTip(t.id, { text })} onStrike={() => setTip(t.id, { struck: true })}
                onHelper={helper => { setTip(t.id, { helper }); if (helper === 'person') askPerson(t.id); }} onPerson={() => askPerson(t.id)} />
            ))}
          </div>
          <div class="fs-opts">
            <button type="button" class="fs-chip add" onClick={() => setD(p => ({ ...p, tips: [...p.tips, newTip()] }))}>+ thing</button>
          </div>
        </div>
        {step && (earlier.length > 0 || flow.notes?.some(n => n.stepId === step.id && n.text.trim())) && (
          <div class="fs-row stack" aria-label="Earlier">
            <span class="fs-print">Earlier</span>
            <EarlierNotes flow={flow} stepId={step.id} />
            {earlier.map((w, k) => <p key={k} class="fs-was"><Strike>{w.text}</Strike> <small class="fs-print">· {shortDate(new Date(w.at))}</small></p>)}
          </div>
        )}
      </div>
    </Sheet>
      {personTip && (
        <PersonSheet open={personOpen} person={personTip.person} onClose={p => {
          if (!personOpen) return;
          setPersonOpen(false);
          setTip(personTip.id, { person: p.name ? p : undefined, text: personTip.text.trim() || (p.name ? personRowText({ person: p }) : 'One person, written when calm') });
        }} />
      )}
    </>
  );
}

type RowProps = {
  t: Tip; lifted: boolean; onLift: (y: number) => void;
  onText: (text: string) => void; onHelper: (h: TipHelper | undefined) => void; onStrike: () => void;
  /** A person tip (F6): open its sheet again. */
  onPerson: () => void;
};

/** One thing to do: its words (a tap writes in them), its helper chip, Strike. A long press on the words lifts it. */
function TipRow({ t, lifted, onLift, onText, onHelper, onStrike, onPerson }: RowProps) {
  const [edit, setEdit] = useState(!t.text);
  const [helpers, setHelpers] = useState(false);
  const y = useRef(0);
  const hold = useHold(() => onLift(y.current), () => setEdit(true));
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (edit) area.current?.focus({ preventScroll: true }); }, [edit]);
  return (
    <div class={`fl-tiprow${lifted ? ' lift' : ''}`} role="listitem" data-tip={t.id}>
      {edit ? (
        <textarea ref={area} class="fs-input fs-area" rows={2} value={t.text} aria-label="A thing to do" placeholder="A thing to do"
          onInput={e => onText(e.currentTarget.value)} onBlur={() => { if (t.text.trim()) setEdit(false); }} />
      ) : (
        <p class={`fl-tiptext fs-hold${t.wise ? ' fs-wise' : ''}`} {...hold}
          onPointerDown={e => { y.current = e.clientY; hold.onPointerDown(e); }}>{t.text}</p>
      )}
      <div class="fl-tipacts">
        {/* a wise line (the wiser second person) and a print line (F3: the page's own, the 988 line) are not things to
            tick: neither carries a helper */}
        {!t.wise && !t.print ? (
          <button type="button" class={`fs-chip${t.helper ? '' : ' add'}`} aria-expanded={helpers} onClick={() => setHelpers(!helpers)}>
            {t.helper ? HELPER_WORD[t.helper] : 'helper'}
          </button>
        ) : <span />}
        {t.helper === 'person' && (
          <button type="button" class="fs-word fl-who" onClick={onPerson}>{personRowText(t)}</button>
        )}
        <button type="button" class="fs-word" onClick={onStrike} aria-label={`Strike ${t.text}`}>Strike</button>
      </div>
      {helpers && (
        <div class="fs-opts" role="group" aria-label="Helper">
          <button type="button" class="fs-opt" aria-pressed={!t.helper} onClick={() => { onHelper(undefined); setHelpers(false); }}>none</button>
          {HELPERS.map(h => (
            <button key={h} type="button" class="fs-opt" aria-pressed={t.helper === h} onClick={() => { onHelper(h); setHelpers(false); }}>{HELPER_WORD[h]}</button>
          ))}
        </div>
      )}
    </div>
  );
}
