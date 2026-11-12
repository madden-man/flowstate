// Be (PLAN-VALUES.md section 3 steps 1, 2, 3 and 11; C2; PLAN-TIERS.md B1): who he is building. "Values | Champions"
// and "New value" at the top, the notebook's line "I determine my core.", then the tiers: the headings First, Second
// and Third, each over its rows (the word large, First's the largest, Third's the size of ink; on the right its
// champions' colours as short rules, a dashed one when nobody fights for it) or, when it has none, a dashed landing
// rule; then the words Resting and Legacy, each a shelf that opens (a Legacy row carries its dates where the rules
// would be). Long press a row to lift it and drag it to a new place among its own place's rows (V13; B2 carries it
// across). A tap opens the value where it stands: the word travels to the left of a seam (rule 28, parts/Turn) and its
// shadow is written across it, in italic at full ink (a shadow is a value too, never greyed); under it, the looks line,
// the five words (First, Second, Third, Resting, Legacy: a tap carries it to the foot of that place), "First since
// 11 / 12 / 26", the champions of each side (C3's ChampionsOf), what was said for it (C5's Said) and Edit. #/be/:id
// opens that one and scrolls to it. In Still (rule 13): First's words alone (every held word when First is empty),
// nothing to open, nothing to drag. #/be/champions is the second segment (C3's Champions).
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Page } from '../parts/Page';
import { SpokeRules } from '../parts/SpokeRules';
import { turn } from '../parts/Turn';
import { dataVersion } from '../sheets';
import { light } from '../light';
import { useLongPress } from '../council/state';
import { tick } from '../parts/Haptic';
import { moves, tokenMs } from '../turns';
import { CORE, callCouncil, placeOf, placeValue, tiers as readTiers, type Tiers, type ValuePlace } from '../../model/values';
import { allVoices } from '../../model/council';
import type { Value, Voice } from '../../db/schema';
import type { Read } from '../../db/fields';
import { beValues, beVersion, changed, openValue } from './state';
import { ruleIds } from './lines';
import { ValueSheet } from './ValueSheet';
import { Champions, ChampionsOf } from './Champions';
import { Said } from './Said';
import { PLACE_WORDS, legacyLine, placeKey, placeWord, rowsOf, sinceLine, slots, stillValues, type Slot } from './tiers';

/** The turn that carries a tapped value's word between its list place and its place by the seam (parts.css). */
const VALUE_TURN = 'be-value';
/** The turn that carries an open value to the foot of the place one of its five words names (B1). */
const PLACE_TURN = 'be-place';

/** An open value grows down from its row and folds back up (M2, PLAN-MOTION.md): laid out first at its full size with
 *  none of it showing, then revealed over --t-page. Folding, it is already closed (the row says so at once); it goes
 *  once folded. A deep link opens it as it is. */
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
    const raf = requestAnimationFrame(() => open(f));
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

/** "Values | Champions", and on Values the word "New value". Gone in Still. */
function BeTop({ here }: { here: 'values' | 'champions' }) {
  return (
    <div class="fs-be-top fs-notstill">
      <nav class="fs-seg" aria-label="Be">
        <a href="#/be" aria-current={here === 'values' ? 'page' : undefined}>Values</a>
        <a href="#/be/champions" aria-current={here === 'champions' ? 'page' : undefined}>Champions</a>
      </nav>
      {here === 'values' ? <button type="button" class="fs-word" onClick={() => openValue({})}>New value</button> : <span />}
    </div>
  );
}

export function Be({ id }: { id?: string }) {
  // in Still Be is the words alone, so a hand-typed #/be/champions shows them (rule 13; C3)
  if (id === 'champions') return light.value === 'still' ? <Values /> : <ChampionsPage />;
  return <Values id={id} />;
}

function ChampionsPage() {
  return (
    <Page label="Be">
      <BeTop here="champions" />
      <div class="fs-sheetof fs-rules fs-be fs-values">
        <Champions />
      </div>
    </Page>
  );
}

type Data = Tiers & { voices: Read<Voice>[] };

function Values({ id }: { id?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [shelf, setShelf] = useState<{ resting: boolean; legacy: boolean }>({ resting: false, legacy: false });
  const [open, setOpen] = useState<Set<string>>(() => new Set(id ? [id] : []));
  // a tapped value grows; one being closed stays to fold up before it goes
  const [closing, setClosing] = useState<Set<string>>(new Set());
  const grown = useRef(new Set<string>());
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledTo = useRef<string | null>(null);
  const still = light.value === 'still';

  /** Reads the list again. The sheet and Spoke for's chips find a value here, Legacy ones too, so a line spoken for a
   *  value in Legacy keeps its label. */
  const read = async (live: () => boolean = () => true) => {
    const [t, voices] = await Promise.all([readTiers(), allVoices()]);
    if (!live()) return;
    beValues.value = [...t.first, ...t.second, ...t.third, ...t.resting, ...t.legacy];
    setData({ ...t, voices });
  };
  useEffect(() => {
    let live = true;
    void read(() => live);
    return () => { live = false; };
  }, [beVersion.value, dataVersion.value]);

  const setOpenState = (vid: string) => {
    const shut = open.has(vid);
    if (!shut) grown.current.add(vid);
    setClosing(prev => { const n = new Set(prev); if (shut) n.add(vid); else n.delete(vid); return n; });
    setOpen(prev => { const n = new Set(prev); if (shut) n.delete(vid); else n.add(vid); return n; });
  };
  /** Open or fold a value. Its word travels (rule 28): the row is marked for the turn, and parts.css names its word. */
  const flip = (vid: string) => {
    const row = document.getElementById(`be-${vid}`);
    if (!row) { setOpenState(vid); return; }
    for (const other of document.querySelectorAll<HTMLElement>('[data-turning]')) delete other.dataset.turning;
    row.dataset.turning = '';
    void turn(VALUE_TURN, () => setOpenState(vid)).finally(() => { delete row.dataset.turning; });
  };
  const folded = (vid: string) => setClosing(prev => { if (!prev.has(vid)) return prev; const n = new Set(prev); n.delete(vid); return n; });

  /** The five words (PLAN-TIERS.md section 5, "No drag"): one tap puts the open value at the foot of that place, and the
   *  row travels there (rule 28, parts/Turn), still open; a shelf it lands on opens, and the row is brought into view. */
  const place = (vid: string, to: ValuePlace) => {
    const row = document.getElementById(`be-${vid}`);
    for (const other of document.querySelectorAll<HTMLElement>('[data-turning]')) delete other.dataset.turning;
    if (row) row.dataset.turning = '';
    const update = async () => {
      await placeValue(vid, to);
      if (to === 'resting' || to === 'legacy') setShelf(s => ({ ...s, [to]: true }));
      await read();
    };
    const show = () => {
      const el = document.getElementById(`be-${vid}`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight - el.offsetHeight / 2) el.scrollIntoView({ block: 'start' });
    };
    void turn(PLACE_TURN, update, { settle: show }).finally(() => {
      if (row) delete row.dataset.turning;
      // where the browser has no turn, settle never ran
      show();
      changed();
    });
  };

  // the deep link opens its value
  useEffect(() => { if (id) setOpen(prev => (prev.has(id) ? prev : new Set([...prev, id]))); }, [id]);

  // the deep link: once its row is drawn, bring it into view
  useEffect(() => {
    if (!id || !data || scrolledTo.current === id) return;
    let tries = 0, raf = 0;
    const go = () => {
      const card = document.getElementById(`be-${id}`);
      if (card) { card.scrollIntoView({ block: 'start' }); scrolledTo.current = id; return; }
      if (tries++ < 60) raf = requestAnimationFrame(go);
    };
    raf = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf);
  }, [id, data]);

  // ---- the drag (V13): long press lifts a row; it rides under the finger and drops into its new place among the
  // rows of its own place (a tier, Resting or Legacy). B2 carries it across the headings. ----
  const [order, setOrder] = useState<string[] | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const drag = useRef<{ id: string; y: number; dy: number } | null>(null);
  const liveOrder = useRef<string[] | null>(null);
  const placeRows = (vid: string): Read<Value>[] => {
    if (!data) return [];
    const p = PLACE_WORDS.find(x => rowsOf(data, x.place).some(v => v.id === vid));
    return p ? rowsOf(data, p.place) : [];
  };
  const press = useLongPress<HTMLElement>((el, e) => {
    const vid = el.closest<HTMLElement>('.fs-be-row')?.dataset.row;
    if (!vid) return;
    drag.current = { id: vid, y: (e as PointerEvent).clientY ?? 0, dy: 0 };
    liveOrder.current = placeRows(vid).map(v => v.id);
    setOrder(liveOrder.current);
    setLifted(vid);
  }, '.fs-dichotomy');

  useEffect(() => {
    if (!lifted) return;
    const rowOf = (vid: string) => scroller.current?.querySelector<HTMLElement>(`[data-row="${vid}"]`) ?? null;
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
      const rows = placeRows(lifted);
      const row = rows.find(v => v.id === lifted);
      // the index among the place's rows as they stand without it is its index in the new order (placeValue's)
      const to = d && liveOrder.current ? liveOrder.current.indexOf(d.id) : -1;
      if (d && row && to >= 0 && to !== rows.indexOf(row)) {
        await placeValue(d.id, placeOf(row), to);
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

  // while a row is lifted its place shows the order it is being dragged into
  const placed = (vs: Read<Value>[]) => (order ? [...vs].sort((a, b) => (order.indexOf(a.id) + 1 || Infinity) - (order.indexOf(b.id) + 1 || Infinity)) : vs);
  const shown: Tiers | null = data && {
    first: placed(data.first), second: placed(data.second), third: placed(data.third), resting: placed(data.resting), legacy: placed(data.legacy),
  };
  // a deep link to a value on a shelf opens that shelf
  if (id && data) {
    const on = (['resting', 'legacy'] as const).find(p => !shelf[p] && data[p].some(v => v.id === id));
    if (on) setShelf(s => ({ ...s, [on]: true }));
  }
  const byId = new Map((data?.voices ?? []).map(v => [v.id, v]));

  /** Still: the word alone, nothing to tap. */
  const stillRow = (v: Read<Value>) => (
    <section key={v.id} id={`be-${v.id}`} class="fs-be-row" data-row={v.id}>
      <p class="fs-value">{v.word}</p>
    </section>
  );

  const row = (v: Read<Value>, at: ValuePlace) => {
    const vid = v.id;
    const isOpen = open.has(vid);
    const folding = !isOpen && closing.has(vid);
    const rules = ruleIds(v, data?.voices ?? []);
    const shadow = v.shadow;
    const legacy = at === 'legacy';
    const since = sinceLine(v);
    const size = typeof at === 'number' ? ` fs-value-t${at}` : ' fs-value-shelf';
    return (
      <section key={vid} id={`be-${vid}`} class={`fs-be-row${isOpen ? ' open' : ''}${lifted === vid ? ' lift' : ''}`} data-row={vid} data-place={placeKey(at)}>
        {isOpen ? (
          <button type="button" class={`fs-dichotomy fs-value-open${shadow ? '' : ' alone'}${grown.current.has(vid) ? ' written' : ''}`}
            aria-expanded="true" aria-controls={`value-${vid}`} onClick={() => flip(vid)}>
            <span class="a">{v.word}</span>
            {shadow && <i aria-hidden="true" />}
            {shadow && <span class="b">{shadow}</span>}
          </button>
        ) : (
          <button type="button" class={`fs-dichotomy fs-value${size}${at === 'resting' || legacy ? ' resting' : ''}`}
            aria-expanded="false" aria-controls={`value-${vid}`} onClick={() => flip(vid)}>
            <span class="a">{v.word}</span>
            {legacy ? <span class="fs-value-dates">{legacyLine(v)}</span>
              : rules.length ? <SpokeRules ids={rules} byId={byId} /> : <span class="fs-spoke-none" aria-label="Nobody yet" />}
          </button>
        )}
        {(isOpen || folding) && (
          <Fold grow={grown.current.has(vid)} closing={folding} onFolded={() => folded(vid)}>
            <div id={`value-${vid}`} class="fs-value-body">
              {!shadow && (
                <p class="fs-value-line">
                  <button type="button" class="fs-word fs-value-add" onClick={() => openValue({ valueId: vid, focus: 'shadow' })}>+ shadow</button>
                </p>
              )}
              {v.looks && <p class="fs-value-looks">{v.looks}</p>}
              {/* B1: the five words, the one it is in pressed; one tap carries it to the foot of another */}
              <div class="fs-be-places">
                <div class="fs-opts" role="group" aria-label="Place">
                  {PLACE_WORDS.map(o => (
                    <button key={placeKey(o.place)} type="button" class="fs-opt" aria-pressed={o.place === at}
                      onClick={() => { if (o.place !== at) place(vid, o.place); }}>{o.word}</button>
                  ))}
                </div>
              </div>
              {since && <p class="fs-print fs-be-since">{since}</p>}
              {/* C3: the champions of each side; a Legacy value's are kept, not drawn */}
              {!legacy && <ChampionsOf value={v} />}
              {/* C5: what was said for it */}
              <Said value={v} />
              <div class="fs-value-acts">
                {/* C5: a new council about this value, its champions seated, on "Who sits?"; Legacy is out of the council's way */}
                {!legacy && <button type="button" class="fs-word" onClick={() => void callCouncil(vid).then(p => { location.hash = `/council/${p.id}`; })}>Call a council</button>}
                <button type="button" class="fs-word" onClick={() => openValue({ valueId: vid })}>Edit</button>
              </div>
            </div>
          </Fold>
        )}
      </section>
    );
  };

  /** One slot of the list (ui/be/tiers.ts slots): a heading, a row, a landing rule, or a shelf's word. */
  const slot = (s: Slot) => {
    switch (s.kind) {
      case 'heading': return <p key={s.key} class="fs-be-tier" data-heading={placeKey(s.place)}>{placeWord(s.place)}</p>;
      case 'land': return <p key={s.key} class="fs-be-land" data-land={placeKey(s.place)} aria-hidden="true" />;
      case 'row': return row(s.value, s.place);
      case 'shelf': return (
        <p key={s.key} class="fs-value-line fs-be-shelf" data-shelf={s.place}>
          <button type="button" class="fs-word" aria-expanded={s.open} onClick={() => setShelf(x => ({ ...x, [s.place]: !x[s.place] }))}>{placeWord(s.place)}</button>
        </p>
      );
    }
  };

  const stillList = shown ? stillValues(shown) : [];
  return (
    <Page label="Be" drawn={data !== null}>
      <BeTop here="values" />
      <div ref={scroller} class="fs-sheetof fs-rules fs-be fs-values" {...(still ? {} : press)}>
        <p class="fs-be-core">{CORE}</p>
        {still
          ? <>{data && !stillList.length && <p class="fs-quiet">Nothing held yet.</p>}{stillList.map(stillRow)}</>
          : shown && slots(shown, shelf).map(slot)}
      </div>
      <ValueSheet />
    </Page>
  );
}
