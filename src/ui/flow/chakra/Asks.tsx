// A sign's questions (DESIGN.md rule 37; Tommy, 2026-11-17: "ask three questions below to prompt journaling. When one
// is clicked, it opens the journal."; PLAN-BLOCKERS.md K2, section 3 steps 7 to 10): under the shelf on every sign's
// page, over the printed safety lines. Three rows on the page's rules, in the wiser second person (italic, rule 17),
// each its words and, at the right of its first rule, the print word Resolve (parts/Resolve). A tap on the words opens
// today's page, linked to the sign, with the question written on it as a wise line and the caret on the rule under it,
// the sign printed by the date and a tap on it coming back here (model/into.ts askInJournal, page.sign; rule 35). The
// same question asked twice in a day is written once.
//
// The three are the first three open questions of the sign's deck (model/acts.ts deckOf), read once when the page
// opens: the slots. A question that stays open keeps its slot from one visit to the next (the ids are kept per sign in
// localStorage, no word of his), so the next one comes up in the slot of the one resolved. A question resolved while the page is up stays in its slot, in print grey with the drawn check,
// until the page is left; on the way back the next open one in the deck stands there (decision 6). Nothing is added
// under the three, so the block holds its height at every moment and the lines printed under it never move. With every
// question resolved the block shows what is left (fewer rows, or none) and keeps the room it took.
//
// Edit, the page's own print word, at the right of the last blank rule, raises the deck sheet (decision 7): every open
// question on its rules, each wrapping so all of it can be read while it is rewritten; a blank last rule that adds one;
// then the print word Resolved (only when there is one) and the resolved questions, each with its date and its check,
// where a tap on the check brings it back. It saves through setDeck as he leaves each rule and when the sheet goes
// down: a rule emptied removes its question, and a deck left under three is filled back up from the starters. No model
// writes any of it (rule 16).
//
// Room (first paint): each question ends on a blank rule (rule 5), so the rows take as many rules as their words wrap
// to. Before they have been read the block holds the rules it took last time (kept per sign in localStorage, one small
// number, no word of his), or the starters' own height. The room is measured from the whole block, so a row put before
// the deck's three (below) is counted into it without a change here.
//
// Where PLAN-SIGN-LINES.md L2 slots in: the sign's fixed grounding question (GROUND_ASKS) is one more row, rendered in
// <section> before the deck's rows (the marked line in Asks), with the same tap and no Resolve, never in `slots` and
// never in the sheet. L1's italic line is the sheet's first rule, before the open questions (the marked line in
// AsksSheet), saved through its own setLine; the deck's rules and setDeck do not see it.
//
// The grounding question (PLAN-SIGN-LINES.md L2, section 5): Ground, the sign's GROUND_ASKS, stands first in the block,
// fixed print in the same italic, drawn over whatever the deck gives and never addressing a deck question by place. It
// has no Resolve and no Edit of its own, is never in the sheet, and its tap is the others' (askInJournal, written once a
// day). Through the door DoorChakraPage prints it, words only, no tap; in Still it leaves with the block. Its rules and
// its blank rule are counted into the block's room, kept under a key of its own (ROOM_KEY): the rooms kept before it
// were measured without it, and a room one row short would move the lines under it on the first paint after the update.
//
// Nothing is counted (rule 15): no mark for a question asked, no tally of resolved, no number. Still never asks (rule
// 13): the block leaves with the light (fs-notstill), Resolve and the check and Edit with it, and a sheet open when the
// light turns goes down. Locked (the door): nothing at all; DoorChakraPage does not mount it. The check is drawn once
// over --t-draw (rule 27) and Reduce Motion puts it there at once; nothing else here moves.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { ChakraId } from '../../../model/mountain';
import { chakraOf } from '../../../model/mountain';
import { GROUND_ASKS, STARTER_ASKS, deckOf, resolveAsk, setDeck, lineOf, setLine } from '../../../model/acts';
import { askInJournal } from '../../../model/into';
import type { DeckAsk } from '../../../db/schema';
import { pageCarry } from './carry';
import { shelfVersion } from './SignShelf';
import { tick } from '../../parts/Haptic';
import { Sheet } from '../../parts/Sheet';
import { Resolve } from '../../parts/Resolve';
import { dataVersion } from '../../sheets';
import { light } from '../../light';
import { notebookDate } from '../../date';
import { gateState } from '../../lock/pin';
import './Asks.css';

// with the grounding question counted in (L2); 'fs-asks-room', measured before it, is left unread
export const ROOM_KEY = 'fs-asks-room-2';
const SHOWN = 3;

/** The rules the block took the last time it was drawn on this sign's page, or null if never. */
export function asksRoomOf(chakra: ChakraId): number | null {
  try {
    const v = (JSON.parse(localStorage.getItem(ROOM_KEY) ?? '{}') as Record<string, unknown>)[chakra];
    return typeof v === 'number' && Number.isInteger(v) && v >= 3 && v <= 40 ? v : null;
  } catch { return null; }
}
function keepAsksRoom(chakra: ChakraId, rules: number) {
  try {
    const all = JSON.parse(localStorage.getItem(ROOM_KEY) ?? '{}') as Record<string, unknown>;
    if (all[chakra] === rules) return;
    localStorage.setItem(ROOM_KEY, JSON.stringify({ ...all, [chakra]: rules }));
  } catch { /* private mode: the starters' height is held */ }
}

const SLOTS_KEY = 'fs-asks-slots';

/** Which question stood in which slot the last time this sign's page was up: ids only, never a word of his. */
export function slotIdsOf(chakra: ChakraId): string[] {
  try {
    const v = (JSON.parse(localStorage.getItem(SLOTS_KEY) ?? '{}') as Record<string, unknown>)[chakra];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, SHOWN) : [];
  } catch { return []; }
}
function keepSlotIds(chakra: ChakraId, ids: string[]) {
  try {
    const all = JSON.parse(localStorage.getItem(SLOTS_KEY) ?? '{}') as Record<string, unknown>;
    if (JSON.stringify(all[chakra]) === JSON.stringify(ids)) return;
    localStorage.setItem(SLOTS_KEY, JSON.stringify({ ...all, [chakra]: ids }));
  } catch { /* private mode: the three stand in deck order */ }
}

/**
 * The three slots after a read of the deck. The three shown are the first three open questions, placed so that each
 * keeps the slot it stood in (from `was`, the slots on the screen now, else `ids`, the slots the page last showed), and
 * a slot left empty takes the next of them in deck order: so the next in the deck stands where a resolved one stood
 * (PLAN-BLOCKERS.md step 9). A question resolved while the page is up (in `was`, resolved there and still resolved)
 * holds its slot and the block stays at three. Exported for the tests.
 */
export function slotsAfter(was: readonly DeckAsk[], deck: { open: DeckAsk[]; resolved: DeckAsk[] }, ids: readonly string[] = []): DeckAsk[] {
  const out: (DeckAsk | undefined)[] = [];
  was.forEach((q, i) => {
    const r = q.resolvedAt !== undefined ? deck.resolved.find(x => x.id === q.id) : undefined;
    if (r && i < SHOWN) out[i] = r;
  });
  const free = SHOWN - out.filter(Boolean).length;
  const first = deck.open.slice(0, free);
  const placed = new Set<string>();
  const where = (id: string | undefined, i: number) => {
    const q = id ? first.find(x => x.id === id) : undefined;
    if (q && !out[i] && !placed.has(q.id)) { out[i] = q; placed.add(q.id); }
  };
  for (let i = 0; i < SHOWN; i++) where(was[i]?.id, i);
  if (!was.length) for (let i = 0; i < SHOWN; i++) where(ids[i], i);
  const rest = first.filter(q => !placed.has(q.id));
  for (let i = 0; i < SHOWN && rest.length; i++) if (!out[i]) out[i] = rest.shift();
  return out.filter((q): q is DeckAsk => !!q);
}

/** The sign's grounding question (PLAN-SIGN-LINES.md section 5): with onAsk, a row whose tap carries it to today's
 *  page as the deck's questions do; without, print (through the door, and unseen before the read). No Resolve. */
export function Ground({ chakra, onAsk }: { chakra: ChakraId; onAsk?: (text: string) => void }) {
  const text = GROUND_ASKS[chakra];
  if (!onAsk) return <p class="ck-ground fs-wise fs-notstill" data-ground={chakra}>{text}</p>;
  return (
    <div class="ck-ground-row" data-ground={chakra}>
      <button type="button" class="ck-ground fs-wise" onClick={() => onAsk(text)}>{text}</button>
    </div>
  );
}

/** The starters drawn unseen before the first read, so the block takes its height. */
function Waiting({ chakra }: { chakra: ChakraId }) {
  return (
    <>
      {STARTER_ASKS[chakra].map((q, i) => (
        <div key={i} class="ck-ask-row"><span class="ck-ask fs-wise">{q}</span></div>
      ))}
    </>
  );
}

/** edit false leaves Edit off (a flow in front: its step's Edit is the page's one, so two never stand on a screen). */
export function Asks({ chakra, edit = true }: { chakra: ChakraId; edit?: boolean }) {
  const { route } = useLocation();
  const locked = gateState() === 'locked';
  const still = light.value === 'still';
  const [slots, setSlots] = useState<DeckAsk[] | null>(null);
  const [editing, setEditing] = useState(false);
  const busy = useRef(false);
  const root = useRef<HTMLElement>(null);
  const slotsRef = useRef<{ chakra: ChakraId; slots: DeckAsk[] } | null>(null);
  const v = shelfVersion.value, d = dataVersion.value;

  const put = (next: DeckAsk[]) => { slotsRef.current = { chakra, slots: next }; setSlots(next); };

  useEffect(() => {
    if (locked) { slotsRef.current = null; setSlots(null); return; }
    let on = true;
    deckOf(chakra).then(deck => {
      if (!on) return;
      const was = slotsRef.current?.chakra === chakra ? slotsRef.current.slots : [];
      const next = slotsAfter(was, deck, slotIdsOf(chakra));
      keepSlotIds(chakra, next.map(q => q.id));
      put(next);
    }, () => { /* locked under the read */ });
    return () => { on = false; };
  }, [chakra, locked, v, d]);

  // Still never asks: a sheet open as the light turns goes down
  useEffect(() => { if (still) setEditing(false); }, [still]);

  // the rules the block took with all three shown, kept for the next first paint (measured only where they show)
  useLayoutEffect(() => {
    const el = root.current;
    if (!slots || slots.length < SHOWN || still || !el) return;
    const lh = parseFloat(getComputedStyle(el).lineHeight);
    if (lh > 0 && el.offsetHeight > 0) keepAsksRoom(chakra, Math.round(el.offsetHeight / lh));
  }, [slots, still]);

  if (locked) return null;
  const rules = asksRoomOf(chakra);
  const room = rules ? { '--ck-ask-rules': rules } : undefined;
  if (!slots) {
    // before the read: the room it took last time, or the starters drawn unseen, so nothing under it moves
    return (
      <section ref={root} class="ck-asks wait fs-notstill" aria-hidden="true" style={room}>
        {!rules && <Ground chakra={chakra} />}
        {!rules && <Waiting chakra={chakra} />}
      </section>
    );
  }

  const ask = async (text: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await askInJournal(chakra, text);
      // the page opens on the rule under the question, in his own ink (no carry: the question is the wise line)
      pageCarry.value = null;
      route('/journal');
    } catch {
      // locked under the thumb: nothing was written, and the page stays
    } finally {
      busy.current = false;
    }
  };

  // resolved here: the slot keeps the question, grey with the check, until the page is left; taken back, it is open
  const resolve = async (q: DeckAsk, on: boolean) => {
    const at = Date.now();
    put((slotsRef.current?.slots ?? slots).map(x => (x.id === q.id ? (on ? { ...x, resolvedAt: at } : { id: x.id, text: x.text }) : x)));
    try { await resolveAsk(chakra, q.id, on, at); } catch { /* locked again under the thumb: nothing was written */ }
  };

  return (
    <>
      {/* short of three (every other one resolved), the block keeps the room it took with three */}
      <section ref={root} class={`ck-asks fs-notstill${slots.length < SHOWN ? ' short' : ''}`} data-asks={chakra} aria-label="Questions"
        style={slots.length < SHOWN ? room : undefined}>
        {/* PLAN-SIGN-LINES.md L2: the grounding question, first, fixed, with no Resolve */}
        <Ground chakra={chakra} onAsk={text => void ask(text)} />
        {slots.map(q => {
          const done = q.resolvedAt !== undefined;
          return (
            <div key={q.id} class={`ck-ask-row${done ? ' done' : ''}`} data-ask={q.id}>
              <button type="button" class="ck-ask fs-wise" onClick={() => void ask(q.text)}>{q.text}</button>
              <Resolve class="ck-ask-resolve" on={done} onChange={on => void resolve(q, on)} />
            </div>
          );
        })}
        {edit && <p class="ck-asks-edit"><button type="button" class="fs-word" onClick={() => { tick('sheet'); setEditing(true); }}>Edit</button></p>}
      </section>
      <AsksSheet chakra={chakra} open={editing && edit && !still} onClose={() => setEditing(false)} />
    </>
  );
}

/** A rule of the sheet: a field that wraps and grows with what is on it. */
function grow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

type Row = { id: string; text: string };
const BLANK = 'blank';
const LINE = 'line';

/** Edit: the deck. Every open question on its rules, a blank last rule, then Resolved and the resolved ones with their
 *  dates and checks. Each rule is kept as he leaves it and when the sheet goes down (setDeck). */
function AsksSheet({ chakra, open, onClose }: { chakra: ChakraId; open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [blank, setBlank] = useState('');
  const [resolved, setResolved] = useState<DeckAsk[]>([]);
  const [read, setRead] = useState(false);
  const rowsRef = useRef<Row[]>([]);
  const blankRef = useRef('');
  /** What was last written for each rule, so a rule left unchanged writes nothing. */
  const saved = useRef<string>('');
  const chain = useRef<Promise<void>>(Promise.resolve());
  const fields = useRef(new Map<string, HTMLTextAreaElement>());
  const want = useRef<string | null>(null);
  // PLAN-SIGN-LINES.md L1: the sign's italic line on the sheet's first rule, kept through setLine as he leaves it
  const [line, setLineText] = useState('');
  const lineRef = useRef('');
  const lineSaved = useRef('');

  const show = (deck: { open: DeckAsk[]; resolved: DeckAsk[] }, typed?: Map<string, string>) => {
    // a rule typed on while the write ran keeps what is on it
    const next = deck.open.map(q => ({ id: q.id, text: typed?.get(q.id) ?? q.text }));
    rowsRef.current = next;
    setRows(next);
    setResolved(deck.resolved);
    saved.current = JSON.stringify(deck.open.map(q => q.text));
  };

  // each rise starts from the deck as it is now
  useEffect(() => {
    if (!open) { setRead(false); return; }
    let on = true;
    blankRef.current = '';
    setBlank('');
    Promise.all([deckOf(chakra), lineOf(chakra)]).then(([deck, l]) => {
      if (!on) return;
      show(deck);
      lineRef.current = l; lineSaved.current = l; setLineText(l);
      setRead(true);
    }, () => undefined);
    return () => { on = false; };
  }, [open, chakra]);

  // a rule asked for (the next after Return, the new blank) takes the caret once it is drawn
  useLayoutEffect(() => {
    const id = want.current;
    if (!id) return;
    const el = fields.current.get(id);
    if (!el) return;
    want.current = null;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  });
  // the line height changes with the light, so each rule is measured again
  useLayoutEffect(() => { fields.current.forEach(grow); }, [rows, blank, line, read, light.value]);

  /** Writes the rules as they stand, one write at a time. */
  const keep = () => {
    chain.current = chain.current.then(async () => {
      const texts = rowsRef.current.map(r => r.text);
      const add = blankRef.current.trim();
      const all = add ? [...texts, add] : texts;
      if (!add && JSON.stringify(texts.map(t => t.replace(/\s+/g, ' ').trim())) === saved.current) return;
      const sent = new Map(rowsRef.current.map(r => [r.id, r.text]));
      try {
        const deck = await setDeck(chakra, all);
        if (add && blankRef.current.trim() === add) { blankRef.current = ''; setBlank(''); }
        const typed = new Map<string, string>();
        rowsRef.current.forEach(r => { if (sent.get(r.id) !== r.text) typed.set(r.id, r.text); });
        show(deck, typed);
        shelfVersion.value++;
      } catch { /* locked again under the thumb: nothing was written */ }
    });
    return chain.current;
  };
  /** Writes the line as it stands, in the same queue; a rule left empty puts the starter back on it (setLine). */
  const keepLine = () => {
    chain.current = chain.current.then(async () => {
      const typed = lineRef.current;
      if (typed.replace(/\s+/g, ' ').trim() === lineSaved.current) return;
      try {
        const l = await setLine(chakra, typed);
        lineSaved.current = l;
        if (lineRef.current === typed) { lineRef.current = l; setLineText(l); }
        shelfVersion.value++;
      } catch { /* locked again under the thumb: nothing was written */ }
    });
    return chain.current;
  };
  const close = () => { void keepLine(); void keep(); onClose(); };

  const bringBack = async (q: DeckAsk) => {
    await keep();
    try {
      show(await resolveAsk(chakra, q.id, false));
      shelfVersion.value++;
    } catch { /* locked again */ }
  };

  const type = (id: string, text: string) => {
    if (id === BLANK) { blankRef.current = text; setBlank(text); return; }
    rowsRef.current = rowsRef.current.map(r => (r.id === id ? { ...r, text } : r));
    setRows(rowsRef.current);
  };

  const rule = (id: string, text: string, label: string, i: number) => (
    <textarea key={id} ref={el => { if (el) fields.current.set(id, el); else fields.current.delete(id); }}
      class="fs-input fs-area fs-wise ck-deck-rule" rows={1} value={text} aria-label={label} autocomplete="off" spellcheck
      enterkeyhint={id === BLANK ? 'done' : 'next'} data-rule={id}
      onInput={e => { grow(e.currentTarget); type(id, e.currentTarget.value); }}
      onBlur={() => void keep()}
      onKeyDown={e => {
        if (e.key !== 'Enter' || e.isComposing) return;
        // one question is one line: Return goes on to the next rule
        e.preventDefault();
        if (id !== BLANK) { fields.current.get(rowsRef.current[i + 1]?.id ?? BLANK)?.focus(); return; }
        if (!blankRef.current.trim()) { close(); return; }
        want.current = BLANK;
        void keep();
      }} />
  );

  return (
    <Sheet open={open} onClose={close} title={`${chakraOf(chakra).name} asks`}>
      <div class="ck-asks-sheet">
        {/* PLAN-SIGN-LINES.md L1: the sign's italic line takes the first rule here, before the open questions */}
        {read && (
          <textarea ref={el => { if (el) fields.current.set(LINE, el); else fields.current.delete(LINE); }}
            class="fs-input fs-area fs-wise ck-deck-rule ck-line-rule" rows={1} value={line} aria-label="The line" autocomplete="off" spellcheck
            enterkeyhint="next" data-rule={LINE}
            onInput={e => { grow(e.currentTarget); lineRef.current = e.currentTarget.value; setLineText(e.currentTarget.value); }}
            onBlur={() => void keepLine()}
            onKeyDown={e => {
              if (e.key !== 'Enter' || e.isComposing) return;
              // one line: Return goes on to the first question
              e.preventDefault();
              fields.current.get(rowsRef.current[0]?.id ?? BLANK)?.focus();
            }} />
        )}
        {read && (
          <div class="ck-deck" role="group" aria-label="Open">
            {rows.map((r, i) => rule(r.id, r.text, 'A question', i))}
            {rule(BLANK, blank, 'Another question', rows.length)}
          </div>
        )}
        {read && resolved.length > 0 && (
          <div class="ck-deck-resolved fs-notstill" role="group" aria-label="Resolved">
            <p class="fs-month">Resolved</p>
            {resolved.map(q => (
              <div key={q.id} class="ck-deck-done" data-ask={q.id}>
                <span class="fs-list-meta">{notebookDate(new Date(q.resolvedAt!))}</span>
                <span class="ck-deck-text fs-wise">{q.text}</span>
                <Resolve class="ck-ask-resolve" on onChange={on => { if (!on) void bringBack(q); }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
