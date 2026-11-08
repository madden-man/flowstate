// "+ step" on a flow's page at rest, and "name the first step" on a flow made from nothing (PLAN-FLOWS.md section 4
// part 2 step 14, F3). Both open the same small sheet: the step's name, your line (italic, yours), and what the page
// says (print). The sheet rises (rule 8); Save stays print-grey and inert until the step has a name, and closing a
// sheet with a name written keeps it (rule 6: everything autosaves).
//
// Still keeps the page to its words (rule 13), so "+ step" waits for Day or Night; "name the first step" stays, since
// an unnamed flow has nothing else on its page.
//
// F2 builds the full step sheet for editing (name, line, said, tips with reorder and strike, Earlier). This is the
// minimal one for adding, in its own file, so the two can be merged into one sheet when both have landed.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Sheet } from '../parts/Sheet';
import { tick } from '../parts/Haptic';
import type { Flow } from '../../db/schema';
import type { Read } from '../../db/fields';
import { addStep, isUnnamed, type StepDraft } from '../../model/flow-make';

export function NewStep({ flow, onSaved }: { flow: Read<Flow>; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  if (flow.locked) return null;
  const first = flow.steps.some(isUnnamed);
  const show = () => { tick('sheet'); setN(k => k + 1); setOpen(true); };
  return (
    <>
      {first
        ? <button type="button" class="fl-name-first" onClick={show}>name the first step<span class="fl-caret" aria-hidden="true" /></button>
        : <div class="fl-add fs-notstill"><button type="button" class="fs-chip add" onClick={show}>+ step</button></div>}
      {n > 0 && <StepForm key={n} open={open} first={first} flowId={flow.id} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  );
}

function StepForm({ open, first, flowId, onClose, onSaved }: { open: boolean; first: boolean; flowId: string; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<StepDraft>({ name: '', line: '', said: '' });
  const done = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const ok = !!d.name.trim();

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => nameRef.current?.focus({ preventScroll: true })));
    return () => cancelAnimationFrame(r);
  }, []);

  const save = async () => {
    if (done.current || !ok) return;
    done.current = true;
    await addStep(flowId, d);
    onSaved();
  };
  // closing keeps the work: a step with a name is saved however the sheet went down
  useEffect(() => { if (!open && ok) void save(); }, [open]);

  const set = (k: keyof StepDraft) => (e: Event) => {
    const v = (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
    setD(prev => ({ ...prev, [k]: v }));
  };
  return (
    <Sheet open={open} onClose={onClose} title={first ? 'The first step' : 'New step'}
      action={{ label: 'Save', inert: !ok, onPress: async () => { await save(); onClose(); } }}>
      <div class="fs-rows">
        <div class="fs-row stack">
          <span class="fs-print">Name</span>
          <input ref={nameRef} class="fs-input" value={d.name} placeholder="Two or three words" aria-label="Name"
            autocomplete="off" onInput={set('name')} />
        </div>
        <div class="fs-row stack">
          <span class="fs-print">Your line</span>
          <input class="fs-input fl-line-field" value={d.line} placeholder="What it's like, in your words" aria-label="Your line"
            autocomplete="off" onInput={set('line')} />
        </div>
        <div class="fs-row stack">
          <span class="fs-print">What the page says</span>
          <textarea class="fs-input fs-area" rows={3} value={d.said} placeholder="What you'd want to read here" aria-label="What the page says"
            onInput={set('said')} />
        </div>
      </div>
    </Sheet>
  );
}
