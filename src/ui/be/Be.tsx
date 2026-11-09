// Be (PLAN.md section 5 item 3; V8): a vertical list, one row per active paradox, its two poles facing across
// a short seam ("selfless | selfish"). A tap opens that paradox's spread under its row, drawn like the
// notebook, and a second tap closes it; "+ Goal" on an open spread is its primary act. "New paradox" is a
// secondary word at the top; "Resting" reveals the paradoxes set aside. Long press a row to lift it and drag it
// to a new place (V13, as the Voices screen does). #/be/:id opens that one and scrolls
// to it once it is laid out. Under an active paradox's spread sit its checks due today and its lean (F0, moved
// from Flow; see Due.tsx), in Day and Night.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Page } from '../parts/Page';
import { Spread } from '../parts/Spread';
import { dataVersion } from '../sheets';
import { dropGoal, moveParadox, spreads, type SpreadData } from '../../model/paradox';
import { today, type TodayGroup } from '../../model/flow';
import { dayKey } from '../../model/pages';
import { now } from '../light';
import { useLongPress } from '../council/state';
import { tick } from '../parts/Haptic';
import { beData, beVersion, openGoal, openParadox, changed } from './state';
import { GoalSheet } from './GoalSheet';
import { ParadoxSheet } from './ParadoxSheet';
import { Due } from './Due';
import { moves, tokenMs } from '../turns';

/** A spread under its row grows down from it and folds back up (M2, PLAN-MOTION.md; DESIGN.md rule 11): it is laid
 *  out first, at its full size with none of it showing, and only once laid out is it revealed, over --t-page. Folding,
 *  it is already closed (the row says so at once); it goes once folded. A deep link opens it as it is. */
function Fold({ grow, closing, onFolded, children }: { grow: boolean; closing: boolean; onFolded: () => void; children: ComponentChildren }) {
  const el = useRef<HTMLDivElement>(null);
  const done = useRef(onFolded);
  done.current = onFolded;
  /** Opens from wherever it stands to the height of what it holds. */
  const open = (f: HTMLDivElement) => {
    // measured while it is still shut (reading after the switch would see it at auto, which cannot be eased from)
    const h = f.scrollHeight;
    f.style.height = `${h}px`;
    f.dataset.fold = 'moving';
  };
  useLayoutEffect(() => {
    const f = el.current;
    if (!f || !grow || !moves()) return;
    f.dataset.fold = 'shut';
    let raf = 0, tries = 0;
    const reveal = () => {
      // the spread measures itself after display; wait for it (as the deep link does), then open
      if (f.querySelector('[data-laid="true"]') || !f.querySelector('[data-laid]') || tries++ > 60) open(f);
      else raf = requestAnimationFrame(reveal);
    };
    raf = requestAnimationFrame(reveal);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const f = el.current;
    if (!f) return;
    if (!closing) {
      // opened again while it folded: it opens from where it is
      if (f.dataset.fold === 'closing') open(f);
      return;
    }
    if (!moves()) { done.current(); return; }
    // from the height it has now, which the browser must see before it can go to nothing
    f.style.height = `${f.getBoundingClientRect().height}px`;
    f.dataset.fold = 'closing';
    void f.offsetHeight;
    f.style.height = '0px';
    // its transition's end, or a page's length and a half: whichever is first
    const t = setTimeout(() => done.current(), tokenMs('--t-page') * 1.5);
    return () => clearTimeout(t);
  }, [closing]);
  const end = (e: TransitionEvent) => {
    const f = el.current;
    if (!f || e.target !== f) return;
    if (f.dataset.fold === 'moving') { delete f.dataset.fold; f.style.height = ''; }
    else if (f.dataset.fold === 'closing') done.current();
  };
  return (
    <div ref={el} class="fs-be-fold" onTransitionEnd={end} inert={closing} aria-hidden={closing ? 'true' : undefined}>
      {children}
    </div>
  );
}

export function Be({ id }: { id?: string }) {
  const [list, setList] = useState<SpreadData[] | null>(null);
  const [resting, setResting] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set(id ? [id] : []));
  // M2: a tapped spread grows; one being closed stays to fold up before it goes
  const [closing, setClosing] = useState<Set<string>>(new Set());
  const grown = useRef(new Set<string>());
  const flip = (pid: string) => {
    const shut = open.has(pid);
    if (!shut) grown.current.add(pid);
    setClosing(prev => { const n = new Set(prev); if (shut) n.add(pid); else n.delete(pid); return n; });
    setOpen(prev => { const n = new Set(prev); if (shut) n.delete(pid); else n.add(pid); return n; });
  };
  const folded = (pid: string) => setClosing(prev => { if (!prev.has(pid)) return prev; const n = new Set(prev); n.delete(pid); return n; });
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledTo = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    spreads().then(s => { if (live) { beData.value = s; setList(s); } });
    return () => { live = false; };
  }, [beVersion.value, dataVersion.value]);

  // what is due today and the latest lean, per active paradox (F0: moved here from Flow); a new day reads again
  const t = now.value;
  const day = dayKey(t);
  const [due, setDue] = useState<Map<string, TodayGroup>>(new Map());
  const [dueVersion, setDueVersion] = useState(0);
  useEffect(() => {
    let live = true;
    today(Date.now()).then(gs => { if (live) setDue(new Map(gs.map(g => [g.paradox.id, g]))); });
    return () => { live = false; };
  }, [day, dueVersion, beVersion.value, dataVersion.value]);

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

  // ---- the drag (V13): long press lifts a row; it rides under the finger and drops into its new place ----
  const [order, setOrder] = useState<string[] | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const drag = useRef<{ id: string; y: number; dy: number } | null>(null);
  const liveOrder = useRef<string[] | null>(null);
  const shownIds = () => (list ?? []).filter(s => s.paradox.status === 'active' || resting).map(s => s.paradox.id);
  const press = useLongPress<HTMLElement>((el, e) => {
    const id = el.closest<HTMLElement>('.fs-be-row')?.dataset.row;
    if (!id) return;
    drag.current = { id, y: (e as PointerEvent).clientY ?? 0, dy: 0 };
    liveOrder.current = shownIds();
    setOrder(liveOrder.current);
    setLifted(id);
  }, '.fs-dichotomy');

  useEffect(() => {
    if (!lifted) return;
    const rowOf = (id: string) => scroller.current?.querySelector<HTMLElement>(`[data-row="${id}"]`) ?? null;
    const hold = (e: TouchEvent) => e.preventDefault();
    const move = (e: PointerEvent) => {
      const d = drag.current, cur = liveOrder.current, el = rowOf(lifted);
      if (!d || !cur || !el) return;
      d.dy = e.clientY - d.y;
      const i = cur.indexOf(d.id);
      const half = el.offsetHeight / 2;
      const j = d.dy > half && i < cur.length - 1 ? i + 1 : d.dy < -half && i > 0 ? i - 1 : i;
      if (j !== i) {
        const h = rowOf(cur[j])?.offsetHeight ?? 0;
        d.y += j > i ? h : -h;
        d.dy -= j > i ? h : -h;
        const n = [...cur];
        [n[i], n[j]] = [n[j], n[i]];
        liveOrder.current = n;
        setOrder(n);
      }
      el.style.transform = `translateY(${d.dy - 2}px)`;
    };
    const up = async () => {
      const d = drag.current;
      drag.current = null;
      const el = rowOf(lifted);
      if (el) el.style.transform = '';
      const ids = shownIds();
      const to = d && liveOrder.current ? liveOrder.current.indexOf(d.id) : -1;
      if (d && to >= 0 && to !== ids.indexOf(d.id)) {
        await moveParadox(ids, d.id, to);
        tick('drop');
        changed();
      }
      liveOrder.current = null;
      setLifted(null);
      setOrder(null);
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

  // while a row is lifted the list shows the order it is being dragged into
  const placed = (ss: SpreadData[]) => (order ? [...ss].sort((a, b) => order.indexOf(a.paradox.id) - order.indexOf(b.paradox.id)) : ss);
  const active = placed(list?.filter(s => s.paradox.status === 'active') ?? []);
  const asleep = placed(list?.filter(s => s.paradox.status !== 'active') ?? []);
  if (id && asleep.some(s => s.paradox.id === id) && !resting) setResting(true);

  const card = (s: SpreadData) => {
    const pid = s.paradox.id;
    const shown = open.has(pid);
    const folding = !shown && closing.has(pid);
    return (
      <section key={pid} id={`be-${pid}`} class={`fs-be-row${shown ? ' open' : ''}${lifted === pid ? ' lift' : ''}`} data-row={pid}>
        <button type="button" class={`fs-dichotomy${s.paradox.status !== 'active' ? ' resting' : ''}`} aria-expanded={shown}
          aria-controls={`spread-${pid}`} onClick={() => flip(pid)}>
          <span class="a">{s.paradox.poleA.value}</span>
          <i aria-hidden="true" />
          <span class="b">{s.paradox.poleB.value}</span>
        </button>
        {(shown || folding) && (
          <Fold grow={grown.current.has(pid)} closing={folding} onFolded={() => folded(pid)}>
            <div id={`spread-${pid}`}>
              {spread(s)}
              {due.has(pid) && <Due key={`${pid} ${day}`} group={due.get(pid)!} now={t} onWritten={() => setDueVersion(v => v + 1)} />}
            </div>
          </Fold>
        )}
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
    <Page label="Be" drawn={list !== null}>
      <div class="fs-be-top">
        {asleep.length > 0 ? (
          <button type="button" class="fs-word fs-state" aria-expanded={resting} onClick={() => setResting(!resting)}>Resting</button>
        ) : <span />}
        <button type="button" class="fs-word" onClick={() => openParadox({})}>New paradox</button>
      </div>
      <div ref={scroller} class="fs-sheetof fs-be" {...press}>
        {list && !list.length && <p class="fs-quiet">Fill both.</p>}
        {active.map(card)}
        {resting && asleep.map(card)}
      </div>
      <GoalSheet />
      <ParadoxSheet />
    </Page>
  );
}
