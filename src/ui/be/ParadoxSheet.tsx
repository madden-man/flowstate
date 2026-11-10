// New paradox, and editing one (PLAN.md section 6). The save word stays print-grey and inert until both
// words are written (the aspects may wait); nothing pops up to say so. Each pole may carry its shadow word,
// drawn in brackets after it on its rule. The middle is optional, offered with the notebook's own doubt.
// Antonyms from the seed list sit as chips under pole B once pole A is written, never filled in.
// An edit pushes the old version onto the paradox's revisions; the earlier versions of the three words
// stay here, struck through (the spread itself now says the current one: the poles and the middle).
// Status is a row here.
// PLAN-SELF.md: a word tapped on the spread opens this sheet with the caret in its field (3.1). "Both" is his one
// line for holding the two together, the creed at the top of Be (3.3); it is saved plainly, never a revision. Five
// are held (3.4.1): a new paradox past them is saved resting and the sheet says so, and an existing one cannot be
// made active until another rests. The sheet ends on Delete, a second tap on the same row within a few seconds (3.2,
// DESIGN.md rule 8): the paradox, its goals, its leans and its refusals go, kept nowhere.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { signal } from '@preact/signals';
import { Sheet } from '../parts/Sheet';
import { Strike } from '../parts/Strike';
import { openSheet } from '../sheets';
import type { Paradox, Pole } from '../../db/schema';
import {
  HELD, HeldError, STATUSES, antonymSuggestions, canHold, canSaveParadox, createParadox, deleteParadox, saveParadox, sameCreed, sameVersion,
  threeWordLines, type ParadoxDraft, type Status,
} from '../../model/paradox';
import { beData, changed, closeBeSheet, paradoxTarget } from './state';

type Draft = ParadoxDraft & { middle: { word?: string; scenario?: string }; creed: string };
const empty = (): Draft => ({ poleA: { value: '', aspect: '', shadow: '' }, poleB: { value: '', aspect: '', shadow: '' }, middle: { word: '', scenario: '' }, creed: '' });
/** A new paradox not yet saveable is kept here, so closing the sheet loses nothing. */
const newDraft = signal<Draft>(empty());

const fromParadox = (p: Paradox): Draft => ({
  poleA: { shadow: '', ...p.poleA }, poleB: { shadow: '', ...p.poleB },
  middle: { word: p.middle?.word ?? '', scenario: p.middle?.scenario ?? '' }, creed: p.creed ?? '',
});

/** HELD as a word for the notes; past ten it is written as the number. */
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const heldWord = WORDS[HELD] ?? String(HELD);

export function ParadoxSheet() {
  const t = paradoxTarget.value;
  if (!t) return null;
  return <ParadoxForm key={t.n} open={openSheet.value === 'paradox'} />;
}

function ParadoxForm({ open }: { open: boolean }) {
  const id = paradoxTarget.value?.paradoxId;
  const focus = paradoxTarget.value?.focus;
  const live = id ? beData.value.find(s => s.paradox.id === id)?.paradox : undefined;
  // the paradox as the sheet opened on it, so a delete does not turn the sheet into a new one while it goes down
  const opened = useRef(live);
  const existing = id ? live ?? opened.current : undefined;
  const all = beData.value.map(s => s.paradox);
  const [d, setD] = useState<Draft>(existing ? fromParadox(existing) : newDraft.value);
  const [status, setStatus] = useState<Status>(existing?.status ?? 'active');
  // Delete asks once more on the same row, and lets go of the ask after a few seconds
  const [arming, setArming] = useState(false);
  useEffect(() => { if (!arming) return; const t = setTimeout(() => setArming(false), 4000); return () => clearTimeout(t); }, [arming]);
  const done = useRef(false);
  const fields = {
    poleA: useRef<HTMLInputElement>(null), poleB: useRef<HTMLInputElement>(null),
    word: useRef<HTMLInputElement>(null), scene: useRef<HTMLTextAreaElement>(null),
  };

  // the caret is ready where it is wanted: pole A on a new paradox, the tapped word's field on an existing one
  useEffect(() => {
    if (existing && !focus) return;
    const el = focus === 'middle'
      ? (!d.middle.word && d.middle.scenario ? fields.scene : fields.word).current
      : fields[focus ?? 'poleA'].current;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!el) return;
      el.focus({ preventScroll: true });
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }));
    return () => cancelAnimationFrame(r);
  }, []);

  const ok = canSaveParadox(d);
  const dirty = existing ? !sameVersion(existing, d) || !sameCreed(existing, d) || status !== existing.status : true;
  // five are held: a new one past them lands resting; an existing one waits to be made active
  const full = existing ? existing.status !== 'active' && !canHold(all, existing.id) : !canHold(all);

  const save = async () => {
    if (done.current || !ok) return false;
    done.current = true;
    if (existing) {
      // the inert option keeps HeldError out of reach; were the list to change under the sheet, the status stays
      try { await saveParadox(existing, d, status); }
      catch (e) { if (e instanceof HeldError) await saveParadox(existing, d, existing.status); else throw e; }
    } else { await createParadox(d); newDraft.value = empty(); }
    changed();
    return true;
  };

  const remove = async () => {
    if (!existing) return;
    if (!arming) { setArming(true); return; }
    done.current = true;
    await deleteParadox(existing.id);
    changed();
    closeBeSheet();
  };

  // closing keeps the work: a valid form saves; an unfinished new one waits as a draft
  useEffect(() => {
    if (open) return;
    if (ok && dirty) void save();
    else if (!existing && !done.current) newDraft.value = d;
  }, [open]);

  const setPole = (side: 'poleA' | 'poleB', k: keyof Pole) => (e: JSX.TargetedEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.currentTarget.value;
    setD(prev => ({ ...prev, [side]: { ...prev[side], [k]: v } }));
  };
  const setMiddle = (k: 'word' | 'scenario') => (e: JSX.TargetedEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.currentTarget.value;
    setD(prev => ({ ...prev, middle: { ...prev.middle, [k]: v } }));
  };
  const struck = existing ? threeWordLines(existing)?.struck ?? [] : [];
  const chips = d.poleA.value.trim() ? antonymSuggestions(d.poleA.value, d.poleB.value) : [];

  const pole = (side: 'poleA' | 'poleB', head: string, valueHint: string) => (
    <div class="fs-row stack fs-polefields" data-pole={side}>
      <span class="fs-print">{head}</span>
      <input ref={fields[side]} class="fs-input" value={d[side].value} placeholder={valueHint} aria-label={`${head}: value`}
        autocomplete="off" autocapitalize="none" onInput={setPole(side, 'value')} />
      {side === 'poleB' && chips.length > 0 && (
        <div class="fs-opts" role="group" aria-label="Opposites to try">
          {chips.map(w => (
            <button key={w} type="button" class="fs-chip add" onClick={() => setD(prev => ({ ...prev, poleB: { ...prev.poleB, value: w } }))}>{w}</button>
          ))}
        </div>
      )}
      <textarea class="fs-input fs-area" rows={2} value={d[side].aspect} placeholder="What living this side looks like" aria-label={`${head}: aspect`} onInput={setPole(side, 'aspect')} />
      <input class="fs-input fs-shadowfield" value={d[side].shadow ?? ''} placeholder="This side, overdone" aria-label={`${head}: shadow`}
        autocomplete="off" autocapitalize="none" onInput={setPole(side, 'shadow')} />
    </div>
  );

  return (
    <Sheet open={open} onClose={closeBeSheet} title={existing ? 'The paradox' : 'New paradox'}
      action={{ label: 'Save', inert: !ok, onPress: async () => { if (await save()) closeBeSheet(); } }}>
    <div class="fs-rows">
      {pole('poleA', 'Top', 'selfless')}
      {pole('poleB', 'Bottom', 'its opposite')}
      <div class="fs-row stack">
        <span class="fs-print">The middle</span>
        <input ref={fields.word} class="fs-input" value={d.middle.word} placeholder="A third word" aria-label="Middle word" autocomplete="off" onInput={setMiddle('word')} />
        <textarea ref={fields.scene} class="fs-input fs-area" rows={2} value={d.middle.scenario} placeholder="Or a specific scene" aria-label="Middle scene" onInput={setMiddle('scenario')} />
        <span class="fs-note">that third word is hard to come by; a specific scene works too</span>
      </div>
      <div class="fs-row stack">
        <span class="fs-print">Both</span>
        <textarea class="fs-input fs-area" rows={2} value={d.creed} placeholder="Both, in a sentence" aria-label="Both, in a sentence"
          onInput={(e: JSX.TargetedEvent<HTMLTextAreaElement>) => { const v = e.currentTarget.value; setD(prev => ({ ...prev, creed: v })); }} />
      </div>
      {!existing && full && (
        <div class="fs-row stack"><span class="fs-note">{heldWord} are held. This one rests until one of them does.</span></div>
      )}
      {struck.length > 0 && (
        <div class="fs-row stack fs-state" aria-label="Earlier versions">
          <span class="fs-print">Earlier</span>
          {struck.map((w, k) => <p key={k} class="fs-was"><Strike>{w}</Strike></p>)}
        </div>
      )}
      {existing && (
        <div class="fs-row stack">
          <span class="fs-print">Status</span>
          <div class="fs-opts" role="group" aria-label="Status">
            {STATUSES.map(s => {
              const inert = s === 'active' && full;
              return <button key={s} type="button" class="fs-opt" aria-pressed={status === s} aria-disabled={inert ? 'true' : undefined}
                onClick={() => { if (!inert) setStatus(s); }}>{s}</button>;
            })}
          </div>
          {full && <span class="fs-note">{heldWord} are held. Rest one first.</span>}
        </div>
      )}
      {existing && (
        <button type="button" class={`fs-row fs-delete${arming ? ' armed' : ''}`} onClick={() => void remove()}>
          <span>{arming ? 'Delete it' : 'Delete'}</span>{arming && <small>Tap again</small>}
        </button>
      )}
    </div>
    </Sheet>
  );
}
