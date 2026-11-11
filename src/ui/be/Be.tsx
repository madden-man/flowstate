// Be (PLAN-VALUES.md section 3 steps 1, 2, 3 and 11; C2): who he is building. "Values | Champions" and "New value" at
// the top, the notebook's line "I determine my core.", then a row per held value: the word, large, and on the right
// its champions' colours as short rules (a dashed one when nobody fights for it). "Resting" reveals the values put
// down. Long press a row to lift it and drag it to a new place (V13). A tap opens the value where it stands: the word
// travels to the left of a seam (rule 28, parts/Turn) and its shadow is written across it, in italic at full ink (a
// shadow is a value too, never greyed); under it, the looks line, the champions of each side (C3's ChampionsOf), what
// was said for it (C5's Said) and Edit. #/be/:id opens that one and scrolls to it. In Still (rule 13): the held words
// alone, nothing to open, nothing to drag. #/be/champions is the second segment (C3's Champions).
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
import { CORE, held as readHeld, moveValue, resting as readResting } from '../../model/values';
import { allVoices } from '../../model/council';
import type { Value, Voice } from '../../db/schema';
import type { Read } from '../../db/fields';
import { beValues, beVersion, changed, openValue } from './state';
import { ruleIds } from './lines';
import { ValueSheet } from './ValueSheet';
import { Champions, ChampionsOf } from './Champions';
import { Said } from './Said';

/** The turn that carries a tapped value's word between its list place and its place by the seam (parts.css). */
const VALUE_TURN = 'be-value';

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

type Data = { held: Read<Value>[]; resting: Read<Value>[]; voices: Read<Voice>[] };

function Values({ id }: { id?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [showResting, setShowResting] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set(id ? [id] : []));
  // a tapped value grows; one being closed stays to fold up before it goes
  const [closing, setClosing] = useState<Set<string>>(new Set());
  const grown = useRef(new Set<string>());
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledTo = useRef<string | null>(null);
  const still = light.value === 'still';

  useEffect(() => {
    let live = true;
    Promise.all([readHeld(), readResting(), allVoices()]).then(([h, r, voices]) => {
      if (!live) return;
      beValues.value = [...h, ...r];
      setData({ held: h, resting: r, voices });
    });
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
  // values of its own kind (held among held, resting among resting) ----
  const [order, setOrder] = useState<string[] | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const drag = useRef<{ id: string; y: number; dy: number } | null>(null);
  const liveOrder = useRef<string[] | null>(null);
  const kindOf = (vid: string) => (data?.resting.some(v => v.id === vid) ? data.resting : data?.held ?? []);
  const press = useLongPress<HTMLElement>((el, e) => {
    const vid = el.closest<HTMLElement>('.fs-be-row')?.dataset.row;
    if (!vid) return;
    drag.current = { id: vid, y: (e as PointerEvent).clientY ?? 0, dy: 0 };
    liveOrder.current = kindOf(vid).map(v => v.id);
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
      const ids = kindOf(lifted).map(v => v.id);
      const to = d && liveOrder.current ? liveOrder.current.indexOf(d.id) : -1;
      if (d && to >= 0 && to !== ids.indexOf(d.id)) {
        await moveValue(ids, d.id, to);
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
  const placed = (vs: Read<Value>[]) => (order ? [...vs].sort((a, b) => (order.indexOf(a.id) + 1 || Infinity) - (order.indexOf(b.id) + 1 || Infinity)) : vs);
  const heldList = placed(data?.held ?? []);
  const restingList = placed(data?.resting ?? []);
  if (id && !showResting && data?.resting.some(v => v.id === id)) setShowResting(true);
  const byId = new Map((data?.voices ?? []).map(v => [v.id, v]));

  /** Still: the word alone, nothing to tap. */
  const stillRow = (v: Read<Value>) => (
    <section key={v.id} id={`be-${v.id}`} class="fs-be-row" data-row={v.id}>
      <p class="fs-value">{v.word}</p>
    </section>
  );

  const row = (v: Read<Value>) => {
    const vid = v.id;
    const shown = open.has(vid);
    const folding = !shown && closing.has(vid);
    const rules = ruleIds(v, data?.voices ?? []);
    const shadow = v.shadow;
    return (
      <section key={vid} id={`be-${vid}`} class={`fs-be-row${shown ? ' open' : ''}${lifted === vid ? ' lift' : ''}`} data-row={vid}>
        {shown ? (
          <button type="button" class={`fs-dichotomy fs-value-open${shadow ? '' : ' alone'}${grown.current.has(vid) ? ' written' : ''}`}
            aria-expanded="true" aria-controls={`value-${vid}`} onClick={() => flip(vid)}>
            <span class="a">{v.word}</span>
            {shadow && <i aria-hidden="true" />}
            {shadow && <span class="b">{shadow}</span>}
          </button>
        ) : (
          <button type="button" class={`fs-dichotomy fs-value${v.status === 'resting' ? ' resting' : ''}`}
            aria-expanded="false" aria-controls={`value-${vid}`} onClick={() => flip(vid)}>
            <span class="a">{v.word}</span>
            {rules.length ? <SpokeRules ids={rules} byId={byId} /> : <span class="fs-spoke-none" aria-label="Nobody yet" />}
          </button>
        )}
        {(shown || folding) && (
          <Fold grow={grown.current.has(vid)} closing={folding} onFolded={() => folded(vid)}>
            <div id={`value-${vid}`} class="fs-value-body">
              {!shadow && (
                <p class="fs-value-line">
                  <button type="button" class="fs-word fs-value-add" onClick={() => openValue({ valueId: vid, focus: 'shadow' })}>+ shadow</button>
                </p>
              )}
              {v.looks && <p class="fs-value-looks">{v.looks}</p>}
              {/* C3: the champions of each side */}
              <ChampionsOf value={v} />
              {/* C5: what was said for it */}
              <Said value={v} />
              <div class="fs-value-acts">
                <button type="button" class="fs-word" onClick={() => openValue({ valueId: vid })}>Edit</button>
              </div>
            </div>
          </Fold>
        )}
      </section>
    );
  };

  return (
    <Page label="Be" drawn={data !== null}>
      <BeTop here="values" />
      <div ref={scroller} class="fs-sheetof fs-rules fs-be fs-values" {...(still ? {} : press)}>
        <p class="fs-be-core">{CORE}</p>
        {data && !heldList.length && <p class="fs-quiet">Nothing held yet.</p>}
        {still ? heldList.map(stillRow) : heldList.map(row)}
        {!still && restingList.length > 0 && (
          <p class="fs-value-line fs-be-resting">
            <button type="button" class="fs-word" aria-expanded={showResting} onClick={() => setShowResting(!showResting)}>Resting</button>
          </p>
        )}
        {!still && showResting && restingList.map(row)}
      </div>
      <ValueSheet />
    </Page>
  );
}
