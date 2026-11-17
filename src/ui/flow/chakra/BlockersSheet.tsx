// He decides what stays (PLAN-BLOCKERS.md decision 13, K4, walkthrough steps 5 and 6): a long press on a Blockers row
// (rule 8: long press means pick up) raises the sheet "Root blockers". It lists every flow listed under the sign, struck
// ones too, in the flow list's order (model/mountain.ts blockerSheetOf), one rule a row: its name, and at the right, in
// print, what it is, said only here: a second listing names its home ("also Crown"), a new candidate says "draft".
//
// A tap on a row strikes it off this sign (model/mountain.ts strikeOff, offSigns): a drawn stroke through the name
// (rule 10, parts/Strike), drawn left to right over --t-draw as a pen would (rule 27); a tap on a struck row puts it
// back, the stroke lifted over --t-ui. Nothing is deleted: a struck flow is kept whole and is still reached by
// hand-offs and the door. Each tap reads the page's rows again (Blockers' version).
//
// "+ blocker" is the sheet's last line: the New flow sheet (../NewFlow.tsx FlowForm) with this sign already chosen
// under Under. A sign with every blocker struck shows the word and "+ blocker" only (Blockers' foot), and that
// "+ blocker" raises this sheet, where the struck ones can be put back and a new one made.
//
// Nothing is counted (rule 15). Still: no long press, no "+ blocker", and a sheet up as the light turns goes down
// (nothing opens or lifts in Still, rule 13). Through the door: not mounted (DoorChakraPage). Locked under a tap:
// nothing is written and the row is as it was.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Flow } from '../../../db/schema';
import type { Read } from '../../../db/fields';
import { blockerSheetOf, chakraOf, isChakraId, strikeOff, type ChakraId } from '../../../model/mountain';
import { Sheet, tokenMs } from '../../parts/Sheet';
import { Strike } from '../../parts/Strike';
import { tick } from '../../parts/Haptic';
import { light } from '../../light';
import { FlowForm } from '../NewFlow';
import { Blockers } from './Blockers';

type Row = { flow: Read<Flow>; struck: boolean };

/** What a row is, said only in the sheet: its home when it is listed here a second time, and "draft" for a candidate. */
export function blockerTag(flow: Pick<Flow, 'chakra' | 'draft'>, chakra: ChakraId): string {
  const words: string[] = [];
  if (isChakraId(flow.chakra) && flow.chakra !== chakra) words.push(`also ${chakraOf(flow.chakra).name}`);
  if (flow.draft) words.push('draft');
  return words.join(' · ');
}

type SheetProps = { chakra: ChakraId; open: boolean; onClose: () => void; onAdd: () => void; onChange: () => void };

export function BlockersSheet({ chakra, open, onClose, onAdd, onChange }: SheetProps) {
  const [rows, setRows] = useState<Row[] | null>(null);
  /** The row struck by a tap this time up, whose stroke is drawn; and the row put back, whose stroke is lifting. */
  const [drawn, setDrawn] = useState<string | null>(null);
  const [lifting, setLifting] = useState<string | null>(null);
  const lift = useRef<ReturnType<typeof setTimeout>>();

  // each rise starts from the flows as they are now
  useEffect(() => {
    if (!open) { setRows(null); setDrawn(null); setLifting(null); return; }
    let on = true;
    blockerSheetOf(chakra).then(r => { if (on) setRows(r); }, () => { /* locked under the read */ });
    return () => { on = false; };
  }, [open, chakra]);
  useEffect(() => () => clearTimeout(lift.current), []);

  const toggle = async (row: Row) => {
    const on = !row.struck;
    const id = row.flow.id;
    setRows(rs => rs && rs.map(r => (r.flow.id === id ? { ...r, struck: on } : r)));
    clearTimeout(lift.current);
    if (on) { setDrawn(id); setLifting(null); } else {
      setDrawn(d => (d === id ? null : d));
      setLifting(id);
      lift.current = setTimeout(() => setLifting(l => (l === id ? null : l)), tokenMs('--t-ui'));
    }
    try {
      await strikeOff(id, chakra, on);
      onChange();
    } catch {
      // locked again under the thumb: nothing was written, so the row is as it was
      setRows(rs => rs && rs.map(r => (r.flow.id === id ? { ...r, struck: !on } : r)));
      setDrawn(null); setLifting(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`${chakraOf(chakra).name} blockers`}>
      <div class="bk-sheet" data-blockers-sheet={chakra}>
        {rows?.map(r => {
          const tag = blockerTag(r.flow, chakra);
          const id = r.flow.id;
          const name = r.struck || lifting === id
            ? <Strike class={r.struck ? (drawn === id ? 'bk-drawn' : undefined) : 'bk-lifting'}>{r.flow.name}</Strike>
            : r.flow.name;
          return (
            <button key={id} type="button" class="fs-row bk-pick" data-flow={id} data-struck={r.struck ? '' : undefined}
              aria-pressed={r.struck} aria-label={r.flow.name} onClick={() => void toggle(r)}>
              <span class="bk-pick-name">{name}</span>
              {tag && <small class="bk-tag">{tag}</small>}
            </button>
          );
        })}
        {rows && <div class="fl-add bk-sheet-add"><button type="button" class="fs-chip add" onClick={onAdd}>+ blocker</button></div>}
      </div>
    </Sheet>
  );
}

/** The sheet rises under the held thumb, so the click the browser makes when it lifts would land on whatever row or
 *  word of the sheet is now under it (useHold swallows it only on the row it began on): the next click after this
 *  lift goes nowhere. A thumb lifted by a cancel makes no click, so nothing waits past it. */
function swallowLiftClick() {
  const opts = { capture: true } as const;
  const swallow = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  const done = () => { removeEventListener('pointerup', up, opts); removeEventListener('pointercancel', done, opts); };
  const up = () => {
    done();
    addEventListener('click', swallow, { capture: true, once: true });
    // a lift that makes no click leaves nothing behind for the next tap
    setTimeout(() => removeEventListener('click', swallow, opts), 400);
  };
  addEventListener('pointerup', up, opts);
  addEventListener('pointercancel', done, opts);
}

/** A sign's Blockers with their sheet and "+ blocker" (ChakraPage): what K3 drew, and the long press of K4. */
export function SignBlockers({ chakra }: { chakra: ChakraId }) {
  const [up, setUp] = useState<'blockers' | 'new' | null>(null);
  const [version, setVersion] = useState(0);
  /** A fresh New flow sheet each time, so nothing typed before is still on it. The flow made reads the rows again, so a
   *  quick way back (this page kept through the turn) finds its row. */
  const [made, setMade] = useState(0);
  const still = light.value === 'still';

  // Still: a sheet up as the light turns goes down
  useEffect(() => { if (still) setUp(null); }, [still]);

  const raise = () => { tick('sheet'); setUp('blockers'); };
  const held = () => { swallowLiftClick(); raise(); };
  const add = () => { tick('sheet'); setMade(k => k + 1); setUp('new'); };

  return (
    <>
      <Blockers chakra={chakra} version={version} onHold={held}
        foot={<p class="bk-add fs-notstill"><button type="button" class="fs-word" onClick={raise}>+ blocker</button></p>} />
      <BlockersSheet chakra={chakra} open={up === 'blockers' && !still} onClose={() => setUp(null)} onAdd={add}
        onChange={() => setVersion(k => k + 1)} />
      {made > 0 && <FlowForm key={made} open={up === 'new' && !still} onClose={() => setUp(null)} under={chakra}
        onMade={() => setVersion(k => k + 1)} />}
    </>
  );
}
