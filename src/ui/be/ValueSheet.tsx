// The value sheet (PLAN-VALUES.md section 3 step 2, C2): Value, Shadow, What it looks like; Held or Resting; the struck
// versions (DESIGN.md rule 10); Delete. It replaces the paradox and goal sheets. No save word (rule 6): putting the
// sheet away keeps what is written, and a value needs only its word; a new one without a word waits as a draft, so
// closing loses nothing. An edit on a later day keeps the old word and shadow struck (model/values.ts saveValue).
// Delete asks once more on the same row and lets go of the ask after four seconds (MessageSheet.tsx's pattern), never
// a dialog (rule 8).
import { useEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { Sheet } from '../parts/Sheet';
import { Strike } from '../parts/Strike';
import { openSheet } from '../sheets';
import { shortDate } from '../date';
import { createValue, deleteValue, saveValue, type ValueDraft, type ValueStatus } from '../../model/values';
import { beValues, changed, closeValueSheet, valueTarget } from './state';
import { struckLines } from './lines';

const empty = (): ValueDraft => ({ word: '', shadow: '', looks: '' });
/** A new value not yet given its word is kept here, so closing the sheet loses nothing. */
const newDraft = signal<ValueDraft>(empty());

const STATUSES: { s: ValueStatus; word: string }[] = [{ s: 'held', word: 'Held' }, { s: 'resting', word: 'Resting' }];

export function ValueSheet() {
  const t = valueTarget.value;
  if (!t) return null;
  return <ValueForm key={t.n} open={openSheet.value === 'value'} />;
}

function ValueForm({ open }: { open: boolean }) {
  const t = valueTarget.value;
  const existing = t?.valueId ? beValues.value.find(v => v.id === t.valueId) : undefined;
  const [d, setD] = useState<ValueDraft>(existing ? { word: existing.word, shadow: existing.shadow ?? '', looks: existing.looks ?? '' } : newDraft.value);
  const [status, setStatus] = useState<ValueStatus>(existing?.status ?? 'held');
  const done = useRef(false);
  const wordField = useRef<HTMLInputElement>(null);
  const shadowField = useRef<HTMLInputElement>(null);
  const [arming, setArming] = useState(false);
  useEffect(() => { if (!arming) return; const a = setTimeout(() => setArming(false), 4000); return () => clearTimeout(a); }, [arming]);

  // a new value opens with the caret in Value; "+ shadow" opens with it in Shadow
  useEffect(() => {
    const field = t?.focus === 'shadow' ? shadowField : existing ? null : wordField;
    if (!field) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => field.current?.focus({ preventScroll: true })));
    return () => cancelAnimationFrame(r);
  }, []);

  const ok = !!d.word.trim();
  const dirty = existing
    ? d.word.trim() !== existing.word || (d.shadow ?? '').trim() !== (existing.shadow ?? '') || (d.looks ?? '').trim() !== (existing.looks ?? '') || status !== existing.status
    : true;

  const save = async () => {
    if (done.current || !ok) return;
    done.current = true;
    if (existing) await saveValue(existing, d, status);
    else { await createValue(d); newDraft.value = empty(); }
    changed();
  };

  // closing keeps the work: a value with its word saves; a new one without it waits as a draft
  useEffect(() => {
    if (open) return;
    if (ok && dirty) void save();
    else if (!existing && !done.current) newDraft.value = d;
  }, [open]);

  const field = (k: keyof ValueDraft) => (e: Event) => {
    const v = (e.currentTarget as HTMLInputElement).value;
    setD(prev => ({ ...prev, [k]: v }));
  };
  const struck = existing && !existing.locked ? struckLines(existing) : [];

  return (
    <Sheet open={open} onClose={closeValueSheet} title="Value">
      <div class="fs-rows fs-valuesheet">
        <label class="fs-row stack">
          <span class="fs-print">Value</span>
          <input ref={wordField} class="fs-input" value={d.word} aria-label="Value" autocomplete="off" autocapitalize="none" onInput={field('word')} />
        </label>
        <label class="fs-row stack">
          <span class="fs-print">Shadow</span>
          <input ref={shadowField} class="fs-input fs-value-shadowfield" value={d.shadow} placeholder="The one that looks after me" aria-label="Shadow"
            autocomplete="off" autocapitalize="none" onInput={field('shadow')} />
        </label>
        <label class="fs-row stack">
          <span class="fs-print">What it looks like</span>
          <input class="fs-input" value={d.looks} placeholder="Living it, in a sentence" aria-label="What it looks like" onInput={field('looks')} />
        </label>
        <div class="fs-row stack">
          <span class="fs-print">Status</span>
          <div class="fs-opts" role="group" aria-label="Status">
            {STATUSES.map(o => <button key={o.s} type="button" class="fs-opt" aria-pressed={status === o.s} onClick={() => setStatus(o.s)}>{o.word}</button>)}
          </div>
        </div>
        {struck.length > 0 && (
          <div class="fs-row stack" aria-label="Earlier versions">
            <span class="fs-print">Earlier</span>
            {struck.map((s, k) => (
              <p key={k} class="fs-was fs-value-was">
                <Strike>{'text' in s ? s.text : <>{s.word}{s.shadow && <> | <i>{s.shadow}</i></>}</>}</Strike>
                <small>{shortDate(new Date(s.at))}</small>
              </p>
            ))}
          </div>
        )}
        {existing && (
          <button type="button" class={`fs-row fs-delete${arming ? ' armed' : ''}`} onClick={async () => {
            if (!arming) { setArming(true); return; }
            done.current = true;
            await deleteValue(existing.id);
            changed();
            closeValueSheet();
          }}><span>{arming ? 'Delete it' : 'Delete'}</span>{arming && <small>Tap again</small>}</button>
        )}
      </div>
    </Sheet>
  );
}
