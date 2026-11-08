// Be (PLAN.md section 5 item 3; V8): a vertical list, one row per active paradox, its two poles facing across
// a short seam ("selfless | selfish"). A tap opens that paradox's spread under its row, drawn like the
// notebook, and a second tap closes it; "+ Goal" on an open spread is its primary act. "New paradox" is a
// secondary word at the top; "Resting" reveals the paradoxes set aside. #/be/:id opens that one and scrolls
// to it once it is laid out.
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
  const [open, setOpen] = useState<Set<string>>(() => new Set(id ? [id] : []));
  const flip = (pid: string) => setOpen(prev => { const n = new Set(prev); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; });
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledTo = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    spreads().then(s => { if (live) { beData.value = s; setList(s); } });
    return () => { live = false; };
  }, [beVersion.value, dataVersion.value]);

  // the deep link opens its paradox
  useEffect(() => { if (id) setOpen(prev => (prev.has(id) ? prev : new Set([...prev, id]))); }, [id]);

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

  const card = (s: SpreadData) => {
    const pid = s.paradox.id;
    const shown = open.has(pid);
    return (
      <section key={pid} id={`be-${pid}`} class={`fs-be-row${shown ? ' open' : ''}`}>
        <button type="button" class={`fs-dichotomy${s.paradox.status !== 'active' ? ' resting' : ''}`} aria-expanded={shown}
          aria-controls={`spread-${pid}`} onClick={() => flip(pid)}>
          <span class="a">{s.paradox.poleA.value}</span>
          <i aria-hidden="true" />
          <span class="b">{s.paradox.poleB.value}</span>
        </button>
        {shown && <div id={`spread-${pid}`}>{spread(s)}</div>}
      </section>
    );
  };

  const spread = (s: SpreadData) => (
    <Spread paradox={s.paradox} items={s.items}
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
