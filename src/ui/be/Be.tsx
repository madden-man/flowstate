// Be (PLAN-VALUES.md section 3 steps 1, 2, 3 and 11; C2; PLAN-TIERS.md B1): who he is building. "Values | Champions"
// and "New value" at the top, the notebook's line "I determine my core.", then the tiers: the headings First, Second
// and Third, each over its rows (the word large, First's the largest, Third's the size of ink; on the right its
// champions' colours as short rules, a dashed one when nobody fights for it) or, when it has none, a dashed landing
// rule; then the words Resting and Legacy, each a shelf that opens (a Legacy row carries its dates where the rules
// would be). Long press a row to lift it and carry it anywhere: into another tier, onto a shelf, back (V13; B2, the
// geometry in ui/be/drag.ts). A tap opens the value where it stands: the word travels to the left of a seam (rule 28, parts/Turn) and its
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
import { bell } from '../parts/Sound';
import { moves, tokenMs } from '../turns';
import { CORE, callCouncil, placeValue, tiers as readTiers, type Tier, type Tiers, type ValuePlace } from '../../model/values';
import { allVoices } from '../../model/council';
import type { Value, Voice } from '../../db/schema';
import type { Read } from '../../db/fields';
import { beValues, beVersion, changed, openValue } from './state';
import { ruleIds } from './lines';
import { ValueSheet } from './ValueSheet';
import { Champions, ChampionsOf } from './Champions';
import { Said } from './Said';
import { PLACE_WORDS, legacyLine, placeKey, placeWord, sinceLine, slots, stillValues, type Slot } from './tiers';
import { carry, collapse, edgeSpeed, same, target, whereIs, type Box, type Target } from './drag';

/** The turn that carries a tapped value's word between its list place and its place by the seam (parts.css). */
const VALUE_TURN = 'be-value';
/** The turn that carries an open value to the foot of the place one of its five words names (B1). */
const PLACE_TURN = 'be-place';
/** The fastest the list scrolls under a lifted row, at the very edge: pixels a frame (about a screen a second). */
const EDGE_MAX_PX = 14;

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

  // ---- the drag (V13; PLAN-TIERS.md section 5, B2): long press lifts a row; every open value folds, every tier ends in
  // a landing rule and both shelves show open, each opening with one. The row rides under the finger across headings
  // and shelf words as across rows (ui/be/drag.ts), taking the word size of the place it rides in, a tier tick as it
  // crosses into another place; near the list's top or bottom edge the list scrolls under it, by hand, as iOS will not
  // scroll a container while touchmove is held. It drops where it rides: placeValue, the drop tick, and the word
  // settles. A drop where it started writes nothing. ----
  const [lifted, setLifted] = useState<string | null>(null);
  const [live, setLive] = useState<Target | null>(null);
  const liveRef = useRef<Target | null>(null);
  // y: the pointer's last y; grab: how far below the row's top it took hold; applied: the row's translate now;
  // before: the row's top on screen as it lifted (the list is put back under it once it has folded); armed: the
  // pointer has moved since the lift, so the edges may scroll
  const drag = useRef<{ id: string; y: number; grab: number; from: Target; applied: number; before: number; armed: boolean } | null>(null);
  // a dropped row's top on screen as it was let go, and where the list had put it, for it to settle from once the
  // list is drawn at rest
  const settle = useRef<{ id: string; top: number; natural: number } | null>(null);
  const press = useLongPress<HTMLElement>((el, e) => {
    const r = el.closest<HTMLElement>('.fs-be-row');
    const vid = r?.dataset.row;
    const from = vid && data ? whereIs(data, vid) : null;
    if (!r || !vid || !from) return;
    const y = (e as PointerEvent).clientY ?? 0, top = r.getBoundingClientRect().top;
    drag.current = { id: vid, y, grab: y - top, from, applied: 0, before: top, armed: false };
    liveRef.current = from;
    setLive(from);
    // every open value folds at once, so each row is one height (a fold drawn over --t-page would move the slots)
    setOpen(new Set());
    setClosing(new Set());
    setLifted(vid);
  }, '.fs-dichotomy');

  const rowOf = (vid: string) => scroller.current?.querySelector<HTMLElement>(`:scope > [data-row="${CSS.escape(vid)}"]`) ?? null;
  /** The row under the finger: its translate is where the finger wants it less where the list has put it. */
  const ride = () => {
    const d = drag.current, el = d && rowOf(d.id);
    if (!d || !el) return;
    const natural = el.getBoundingClientRect().top - d.applied;
    d.applied = d.y - d.grab - natural - 2;
    el.style.transform = `translateY(${d.applied}px)`;
  };
  /** The slots but the lifted row, on the list's content axis, and the place the row's top edge has reached. */
  const follow = () => {
    const d = drag.current, sc = scroller.current, el = d && rowOf(d.id);
    if (!d || !sc || !el) return;
    const base = sc.getBoundingClientRect().top - sc.scrollTop;
    const boxes: Box[] = [];
    for (const c of sc.children as HTMLCollectionOf<HTMLElement>) {
      if (c === el) continue;
      const ds = c.dataset;
      const kind = ds.heading ? 'heading' : ds.land ? 'land' : ds.row ? 'row' : ds.shelf ? 'shelf' : null;
      const key = ds.heading ?? ds.land ?? ds.place ?? ds.shelf;
      if (!kind || !key) continue;
      const rc = c.getBoundingClientRect();
      boxes.push({ kind, place: /^\d$/.test(key) ? (Number(key) as Tier) : (key as ValuePlace), top: rc.top - base, bottom: rc.bottom - base });
    }
    const lt = el.getBoundingClientRect().top - d.applied - base;
    const t = target(collapse(boxes, lt, lt + el.offsetHeight), d.y - d.grab - base);
    const was = liveRef.current;
    if (was && !same(t, was)) {
      if (t.to !== was.to) { tick('tier'); bell('tier'); }
      liveRef.current = t;
      setLive(t);
    }
    ride();
  };

  // lifted: the list is put back under the row once it has folded and grown its landing rules (only the scroll can
  // move; at the top of the list the row itself moves instead, so nothing changes place under a still finger)
  useLayoutEffect(() => {
    const d = drag.current, sc = scroller.current, el = lifted && rowOf(lifted);
    if (!d || !sc || !el) return;
    el.style.transform = 'none';
    // the hold had already lifted it 2px when it was measured
    sc.scrollTop += el.getBoundingClientRect().top - (d.before + (moves() ? 2 : 0));
    d.grab = d.y - el.getBoundingClientRect().top;
    d.applied = -2;
    el.style.transform = 'translateY(-2px)';
  }, [lifted]);
  // the row has changed place in the run: keep it under the finger
  useLayoutEffect(() => { if (lifted) ride(); }, [live]);
  // dropped: the row settles from where it was let go into its slot, over --t-ui (rule 18's settle)
  useLayoutEffect(() => {
    const s = settle.current, sc = scroller.current;
    if (lifted || !s || !sc) return;
    settle.current = null;
    const el = rowOf(s.id);
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform = '';
    // the list keeps the row's slot where it was (landing rules and shelves going above it move nothing), and the row
    // eases from under the finger into it
    sc.scrollTop += el.getBoundingClientRect().top - s.natural;
    const off = s.top - el.getBoundingClientRect().top;
    if (!off || !moves()) { el.style.transition = ''; return; }
    el.style.transform = `translateY(${off}px)`;
    void el.offsetHeight;
    el.dataset.settling = '';
    el.style.transition = '';
    el.style.transform = '';
    const done = () => { delete el.dataset.settling; };
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, tokenMs('--t-ui') * 2);
  }, [lifted]);

  useEffect(() => {
    if (!lifted) return;
    const hold = (e: TouchEvent) => e.preventDefault();
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (Math.abs(e.clientY - d.y) > 0) d.armed = true;
      d.y = e.clientY;
      follow();
    };
    // the edges: within a thumb's height (two --hit) of the list's top or bottom the list scrolls under the row,
    // faster nearer the edge, on a frame loop for as long as the finger sits there (moved since the lift)
    const band = 2 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit')) || 44);
    let raf = requestAnimationFrame(function frame() {
      const d = drag.current, sc = scroller.current;
      if (d && sc && d.armed) {
        const r = sc.getBoundingClientRect();
        const v = edgeSpeed(d.y, r.top, r.bottom, band, EDGE_MAX_PX);
        const was = sc.scrollTop;
        if (v) sc.scrollTop = was + v;
        if (sc.scrollTop !== was) follow();
      }
      raf = requestAnimationFrame(frame);
    });
    const up = async () => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      cancelAnimationFrame(raf);
      const t = liveRef.current;
      const el = rowOf(d.id);
      const at = el ? el.getBoundingClientRect().top : 0;
      settle.current = { id: d.id, top: at, natural: at - d.applied };
      const moved = !!t && !same(t, d.from);
      try {
        if (moved) {
          await placeValue(d.id, t.to, t.index);
          tick('drop');
          // a drop on a shelf leaves it open; one opened only for the lift closes again
          if (t.to === 'resting' || t.to === 'legacy') setShelf(s => ({ ...s, [t.to as 'resting' | 'legacy']: true }));
          await read();
        }
      } finally {
        liveRef.current = null;
        setLive(null);
        setLifted(null);
        if (moved) changed();
      }
    };
    document.addEventListener('touchmove', hold, { passive: false });
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('touchmove', hold);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };
  }, [lifted]);

  // while a row is lifted the list is drawn with it where it rides
  const shown: Tiers | null = data && (lifted && live ? carry(data, lifted, live) : data);
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
          : shown && slots(shown, shelf, !!lifted).map(slot)}
      </div>
      <ValueSheet />
    </Page>
  );
}
