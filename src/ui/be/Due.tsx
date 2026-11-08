// Under a paradox's spread on Be (PLAN-FLOWS.md F0, moved from the Flow tab): its goals due today by cadence,
// each a drawn check writing to the item's done log, then the lean slider writing a leans row, with its one
// line of note. Day and Night only: Still hides counts and states (DESIGN.md rule 13), so .fs-notstill puts
// the whole block away there. A check row ends on one blank rule however many lines its text took (rule 5).
// The check is drawn at once and the write follows; data-saved says when the writes have landed.
import { useState } from 'preact/hooks';
import { Check } from '../parts/Check';
import { LeanSlider } from '../parts/LeanSlider';
import { addLean, doneOn, setDone, setLeanNote, type TodayGroup } from '../../model/flow';

type Props = {
  group: TodayGroup;
  now: number;
  /** A write landed: the tab reads again. */
  onWritten: () => void;
};

export function Due({ group, now, onWritten }: Props) {
  const { paradox } = group;
  // the check and the lean show at once, before the reread brings the written rows back
  const [drawn, setDrawn] = useState<Record<string, boolean>>({});
  const [leaned, setLeaned] = useState<TodayGroup['lean']>(undefined);
  const [writing, setWriting] = useState(0);
  const saving = async (w: () => Promise<unknown>) => {
    setWriting(n => n + 1);
    try { await w(); } finally { setWriting(n => n - 1); onWritten(); }
  };

  const lean = leaned && (!group.lean || leaned.at > group.lean.at) ? leaned : group.lean;
  const a = paradox.poleA.value, b = paradox.poleB.value;

  return (
    <section class="fs-due fs-rules fs-notstill" aria-label={`Today, ${a} and ${b}`} data-saved={writing ? 'false' : 'true'}>
      {group.items.length > 0 && <h3 class="fs-print fs-due-head">Today</h3>}
      {group.items.map(i => {
        const checked = drawn[i.id] ?? doneOn(i, now);
        return (
          <Check key={i.id} checked={checked} aside={i.cadence} disabled={!!i.locked}
            onChange={done => {
              setDrawn(d => ({ ...d, [i.id]: done }));
              void saving(() => setDone(i.id, done, Date.now()));
            }}>{i.locked ? '' : i.text}</Check>
        );
      })}
      <LeanSlider a={a} b={b} lean={lean?.lean} note={lean?.note}
        disabled={!!paradox.locked}
        onLean={v => void saving(async () => setLeaned(await addLean(paradox.id, v)))}
        onNote={lean ? text => void saving(() => setLeanNote(lean.id, text)) : undefined} />
    </section>
  );
}
