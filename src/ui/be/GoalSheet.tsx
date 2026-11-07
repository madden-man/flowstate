// "+ Goal" (PLAN.md section 5 item 3, section 6): one field per pole, headed by the pole values, a cadence
// row and a "follows" picker. Save both and the pair lands linked at the same height; save one side and a
// dashed slot opens on the other page. A goal tapped on the spread opens this same sheet, filled, and a
// slot tapped opens it with the empty side ready. Closing the sheet keeps what was written.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Sheet } from '../parts/Sheet';
import { openSheet } from '../sheets';
import type { Cadence, Item } from '../../db/schema';
import { CADENCES, addGoals, archiveGoal, followable, pairOf, saveGoal } from '../../model/paradox';
import { beData, changed, closeBeSheet, goalTarget } from './state';

export function GoalSheet() {
  const t = goalTarget.value;
  if (!t) return null;
  return <GoalForm key={t.n} open={openSheet.value === 'goal'} />;
}

const short = (s: string) => (s.length > 34 ? `${s.slice(0, 33).trimEnd()}…` : s);

function GoalForm({ open }: { open: boolean }) {
  const t = goalTarget.value!;
  const spread = beData.value.find(s => s.paradox.id === t.paradoxId);
  const goal = t.goalId ? spread?.items.find(i => i.id === t.goalId) : undefined;
  const pair = goal && spread ? pairOf(goal, spread.items) : undefined;
  const textOf = (pole: Item['pole']) => (goal?.pole === pole ? goal.text : pair?.pole === pole ? pair.text : '');
  const [a, setA] = useState(textOf('a'));
  const [b, setB] = useState(textOf('b'));
  const [cadence, setCadence] = useState<Cadence | undefined>(goal?.cadence);
  const [nextTo, setNextTo] = useState<string | undefined>(goal?.nextTo);
  const done = useRef(false);
  const fields = { a: useRef<HTMLTextAreaElement>(null), b: useRef<HTMLTextAreaElement>(null) };

  // the side to write on is ready under the caret (the slot's side, or pole A for a new goal)
  useEffect(() => {
    const side = t.focus ?? (goal ? goal.pole : 'a');
    const id = requestAnimationFrame(() => requestAnimationFrame(() => fields[side].current?.focus({ preventScroll: true })));
    return () => cancelAnimationFrame(id);
  }, []);

  const dirty = a !== textOf('a') || b !== textOf('b') || cadence !== goal?.cadence || nextTo !== goal?.nextTo;
  const both = !!a.trim() && !!b.trim();
  const any = !!a.trim() || !!b.trim();

  const save = async () => {
    if (done.current || !spread || !any) return;
    done.current = true;
    if (goal) {
      const mine = goal.pole === 'a' ? a : b, theirs = goal.pole === 'a' ? b : a;
      await saveGoal(goal.id, { text: mine, other: theirs, cadence, nextTo });
    } else {
      await addGoals(spread.paradox.id, { a, b, cadence, nextTo });
    }
    changed();
  };

  // closing (Done, a swipe, the scrim) keeps what was written: nothing is lost
  useEffect(() => { if (!open && dirty) void save(); }, [open]);

  if (!spread) return null;
  const { paradox } = spread;
  const others = followable(spread.items, goal?.id).filter(i => i.id !== pair?.id);
  const field = (pole: Item['pole'], value: string, set: (v: string) => void) => {
    const p = pole === 'a' ? paradox.poleA : paradox.poleB;
    const filling = !!goal && goal.pole !== pole && !pair;
    return (
      <label class="fs-row stack fs-goalfield" data-side={pole}>
        <span class="fs-print">{p.value}</span>
        <textarea ref={fields[pole]} class="fs-input fs-area" rows={2} value={value} aria-label={`${p.value} goal`}
          placeholder={filling || (!goal && pole === 'b') ? 'What balances it?' : 'A goal'}
          onInput={(e: JSX.TargetedEvent<HTMLTextAreaElement>) => set(e.currentTarget.value)} />
      </label>
    );
  };
  const saveWord = both ? 'Save both' : any ? 'Save one side' : 'Save';

  return (
    <Sheet open={open} onClose={closeBeSheet} title="A goal, and its balance"
      action={{ label: saveWord, inert: !any, onPress: async () => { await save(); closeBeSheet(); } }}>
    <div class="fs-rows">
      {field('a', a, setA)}
      {field('b', b, setB)}
      <div class="fs-row stack">
        <span class="fs-print">Cadence</span>
        <div class="fs-opts" role="group" aria-label="Cadence">
          {CADENCES.map(c => (
            <button key={c} type="button" class="fs-opt" aria-pressed={cadence === c} onClick={() => setCadence(cadence === c ? undefined : c)}>{c}</button>
          ))}
        </div>
      </div>
      {others.length > 0 && (
        <div class="fs-row stack">
          <span class="fs-print">Follows</span>
          <div class="fs-opts fs-oneline" role="group" aria-label="Follows">
            {others.map(o => (
              <button key={o.id} type="button" class="fs-opt" aria-pressed={nextTo === o.id} title={o.text} onClick={() => setNextTo(nextTo === o.id ? undefined : o.id)}>{short(o.text)}</button>
            ))}
          </div>
        </div>
      )}
      {goal && (
        <div class="fs-row fs-acts">
          <button type="button" class="fs-word" onClick={async () => { done.current = true; await archiveGoal(goal.id); changed(); closeBeSheet(); }}>Archive</button>
        </div>
      )}
    </div>
    </Sheet>
  );
}
