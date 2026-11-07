// Be (PLAN.md section 5 item 3): one spread per active paradox, drawn like the notebook. "+ Goal" on each
// card is the primary act; "New paradox" is a secondary word at the top; "Resting" reveals the paradoxes
// set aside. #/be/:id scrolls to that card once it is laid out.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Page } from '../parts/Page';
import { Spread } from '../parts/Spread';
import { dataVersion } from '../sheets';
import { dropGoal, spreads, type SpreadData } from '../../model/paradox';
import { beData, beVersion, openGoal, openParadox, changed } from './state';
import { GoalSheet } from './GoalSheet';
import { ParadoxSheet } from './ParadoxSheet';

export function Be({ id }: { id?: string }) {
  const [list, setList] = useState<SpreadData[] | null>(null);
  const [resting, setResting] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledTo = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    spreads().then(s => { if (live) { beData.value = s; setList(s); } });
    return () => { live = false; };
  }, [beVersion.value, dataVersion.value]);

  // the deep link: wait until the card has been measured and laid out, then bring it into view
  useEffect(() => {
    if (!id || !list || scrolledTo.current === id) return;
    let tries = 0, raf = 0;
    const go = () => {
      const card = document.getElementById(`be-${id}`);
      const laid = card?.querySelector('[data-laid="true"]');
      if (card && laid) { card.scrollIntoView({ block: 'start' }); scrolledTo.current = id; return; }
      if (tries++ < 60) raf = requestAnimationFrame(go);
    };
    raf = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf);
  }, [id, list]);

  const active = list?.filter(s => s.paradox.status === 'active') ?? [];
  const asleep = list?.filter(s => s.paradox.status !== 'active') ?? [];
  if (id && asleep.some(s => s.paradox.id === id) && !resting) setResting(true);

  const card = (s: SpreadData) => (
    <Spread key={s.paradox.id} paradox={s.paradox} items={s.items}
      onAdd={() => openGoal({ paradoxId: s.paradox.id })}
      onGoal={(goalId, focus) => openGoal({ paradoxId: s.paradox.id, goalId, focus })}
      onEdit={() => openParadox({ paradoxId: s.paradox.id })}
      onDrop={async (goalId, lean) => {
        const changedRows = await dropGoal(s.items, goalId, lean);
        if (changedRows.length) {
          // the moved rows land at once; the reread follows
          setList(prev => prev && prev.map(x => (x.paradox.id !== s.paradox.id ? x : { ...x, items: x.items.map(i => changedRows.find(c => c.id === i.id) ?? i) })));
          changed();
        }
      }} />
  );

  return (
    <Page label="Be">
      <div class="fs-be-top">
        {asleep.length > 0 ? (
          <button type="button" class="fs-word fs-state" aria-expanded={resting} onClick={() => setResting(!resting)}>Resting</button>
        ) : <span />}
        <button type="button" class="fs-word" onClick={() => openParadox({})}>New paradox</button>
      </div>
      <div ref={scroller} class="fs-sheetof fs-be">
        {list && !list.length && <p class="fs-quiet">Fill both.</p>}
        {active.map(card)}
        {resting && asleep.map(card)}
      </div>
      <GoalSheet />
      <ParadoxSheet />
    </Page>
  );
}
