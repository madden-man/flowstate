// A sign's three questions (DESIGN.md rule 37; Tommy, 2026-11-17: "ask three questions below to prompt journaling.
// When one is clicked, it opens the journal."): under the shelf on every sign's page, over the printed safety lines.
// Three lines on the page's rules, in the wiser second person (italic, rule 17), each one a tap: today's page opens,
// linked to the sign, with the question written on it as a wise line and the caret on the rule under it, the sign
// printed by the date and a tap on it coming back here (model/into.ts askInJournal, page.sign; rule 35). The same
// question asked twice in a day is written once.
//
// The questions are fixed print starters until he rewrites them (model/acts.ts STARTER_ASKS, asksOf, setAsk): Edit, the
// page's own print word, at the right of the last blank rule, raises a sheet with the three on their rules; what he
// writes there is kept as he leaves each rule and when the sheet goes down, and a rule left empty puts its starter
// back. No model writes any of it (rule 16).
//
// Room (first paint): each question ends on a blank rule (rule 5), so the three take as many rules as their words
// wrap to. Before they have been read the block holds the rules it took last time (kept per sign in localStorage, one
// small number, no word of his), or the starters' own height, so the lines printed under it never move.
//
// Nothing is counted (rule 15): no mark for a question asked, no tally. Still never asks (rule 13): the block leaves with
// the light (fs-notstill), Edit with it, and a sheet open when the light turns goes down. Locked (the door): nothing at
// all; DoorChakraPage does not mount it. Nothing here moves, so Reduce Motion has nothing to stop.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { ChakraId } from '../../../model/mountain';
import { chakraOf } from '../../../model/mountain';
import { STARTER_ASKS, asksOf, setAsk } from '../../../model/acts';
import { askInJournal } from '../../../model/into';
import { pageCarry } from './carry';
import { shelfVersion } from './SignShelf';
import { tick } from '../../parts/Haptic';
import { Sheet } from '../../parts/Sheet';
import { dataVersion } from '../../sheets';
import { light } from '../../light';
import { gateState } from '../../lock/pin';
import './Asks.css';

const ROOM_KEY = 'fs-asks-room';
/** The sheet's rules, named for a reader by place, in words. */
const PLACES = ['The first question', 'The second question', 'The third question'];

/** The rules the three took the last time they were drawn on this sign's page, or null if never. */
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

/** The three lines, as buttons on the rules. */
function Lines({ asks, onAsk }: { asks: readonly string[]; onAsk?: (text: string) => void }) {
  return (
    <>
      {asks.map((q, i) => (
        <button key={i} type="button" class="ck-ask fs-wise" tabIndex={onAsk ? undefined : -1}
          onClick={onAsk ? () => onAsk(q) : undefined}>{q}</button>
      ))}
    </>
  );
}

/** edit false leaves Edit off (a flow in front: its step's Edit is the page's one, so two never stand on a screen). */
export function Asks({ chakra, edit = true }: { chakra: ChakraId; edit?: boolean }) {
  const { route } = useLocation();
  const locked = gateState() === 'locked';
  const still = light.value === 'still';
  const [asks, setAsks] = useState<string[] | null>(null);
  const [editing, setEditing] = useState(false);
  const busy = useRef(false);
  const root = useRef<HTMLElement>(null);
  const v = shelfVersion.value, d = dataVersion.value;

  useEffect(() => {
    if (locked) { setAsks(null); return; }
    let on = true;
    asksOf(chakra).then(a => { if (on) setAsks(a.length ? a : null); }, () => { /* locked under the read */ });
    return () => { on = false; };
  }, [chakra, locked, v, d]);

  // Still never asks: a sheet open as the light turns goes down
  useEffect(() => { if (still) setEditing(false); }, [still]);

  // the rules the three took, kept for the next first paint (measured only where they show, by Day or Night)
  useLayoutEffect(() => {
    const el = root.current;
    if (!asks || still || !el) return;
    const lh = parseFloat(getComputedStyle(el).lineHeight);
    if (lh > 0 && el.offsetHeight > 0) keepAsksRoom(chakra, Math.round(el.offsetHeight / lh));
  }, [asks, still]);

  if (locked) return null;
  if (!asks) {
    const rules = asksRoomOf(chakra);
    // before the read: the room it took last time, or the starters drawn unseen, so nothing under it moves
    return (
      <section ref={root} class="ck-asks wait fs-notstill" aria-hidden="true" style={rules ? { '--ck-ask-rules': rules } : undefined}>
        {!rules && <Lines asks={STARTER_ASKS[chakra]} />}
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

  return (
    <>
      <section ref={root} class="ck-asks fs-notstill" data-asks={chakra} aria-label="Questions">
        <Lines asks={asks} onAsk={t => void ask(t)} />
        {edit && <p class="ck-asks-edit"><button type="button" class="fs-word" onClick={() => { tick('sheet'); setEditing(true); }}>Edit</button></p>}
      </section>
      <AsksSheet chakra={chakra} asks={asks} open={editing && edit && !still} onClose={() => setEditing(false)} />
    </>
  );
}

/** Edit: the three on their rules, his to rewrite. Each is kept as he leaves its rule and when the sheet goes down;
 *  one left empty is its starter again (setAsk), shown as the rule's placeholder. */
function AsksSheet({ chakra, asks, open, onClose }: { chakra: ChakraId; asks: string[]; open: boolean; onClose: () => void }) {
  const starters = STARTER_ASKS[chakra];
  const [texts, setTexts] = useState<string[]>(asks);
  const saved = useRef<string[]>(asks);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // each rise starts from the three as they are now
  useEffect(() => { if (open) { setTexts(asks); saved.current = asks; } }, [open]);

  const keep = async (i: number, text: string) => {
    const was = saved.current[i];
    const now = text.trim() || starters[i];
    if (now === was) return;
    saved.current = saved.current.map((x, k) => (k === i ? now : x));
    try { await setAsk(chakra, i, text); } catch { /* locked again under the thumb: nothing was written */ }
    shelfVersion.value++;
  };
  const close = () => {
    texts.forEach((t, i) => void keep(i, t));
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={`${chakraOf(chakra).name} asks`}>
      <div class="ck-asks-sheet">
        {starters.map((s, i) => (
          <input key={i} ref={el => { inputs.current[i] = el; }} class="fs-input fs-wise" type="text" value={texts[i] ?? ''}
            aria-label={PLACES[i]} placeholder={s} autocomplete="off" spellcheck enterkeyhint={i < 2 ? 'next' : 'done'}
            onInput={e => { const t = e.currentTarget.value; setTexts(x => x.map((y, k) => (k === i ? t : y))); }}
            onBlur={e => void keep(i, e.currentTarget.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter' || e.isComposing) return;
              e.preventDefault();
              if (i < 2) inputs.current[i + 1]?.focus();
              else close();
            }} />
        ))}
      </div>
    </Sheet>
  );
}
