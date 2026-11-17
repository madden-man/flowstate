// What blocks a sign (PLAN-BLOCKERS.md decisions 8 to 12 and 15, K3): directly under the gate, over the shelf. The gate
// says how shut the sign is; these rows say what shuts it. The print word "Blockers" on its own rule, then a row for
// each flow listed under the sign (model/mountain.ts blockersOf: its own, a second listing, a draft; never one struck
// off it), each the Flow list's own row (.fl-flow) and nothing else: the name at --fs-title, the step words in print,
// whole, joined by " · " on one line (as many as fit; a word that would be cut goes to a second line that is never
// shown), and the small drawing at the right. A row is exactly two rules and draws no border of its own: the page's
// rules are its lines (rule 5). A tap opens the flow's own page (#/flow/:id, FlowPage), the small drawing travelling to
// the large one (rule 28, ui/turns.ts).
//
// A running blocker says where he is, in words (decision 11): its row comes first, and in place of the step words it
// prints the step he is on, in ink ("The wave"), with the dot on its small drawing.
//
// Still (decision 15, rule 13): the word and the names only, one rule each, at --fs-ink, in stored order: no drawing, no
// step words, no dot and no live order. Through the door: not mounted (DoorChakraPage). Nothing is counted (rule 15).
//
// Room: before the read the block holds the rows it took last time on this sign (kept per sign in localStorage, one
// small number, no word of his), or the seeded number, so the shelf, the questions and the safety lines under it never
// move. Locked under the page it holds that room empty.
//
// The Blockers sheet (K4, ./BlockersSheet.tsx): onHold, when given, makes a long press on a row (rule 8: long press
// means pick up) call it with the row's flow instead of opening it; never in Still, where nothing opens or lifts. foot
// is drawn under the word only when no row is left (every blocker struck off the sign): "+ blocker", which raises the
// same sheet. version, bumped by the sheet, reads the rows again.
import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import type { Flow } from '../../../db/schema';
import type { Read } from '../../../db/fields';
import { blockersOf, blockersSeeded, isChakraId, seededBlockerCount, type Blocker, type ChakraId } from '../../../model/mountain';
import { currentStepId, placeOf } from '../../../model/flows';
import { Cycle } from '../../parts/Cycle';
import { useHold } from '../../parts/Hold';
import { dataVersion } from '../../sheets';
import { light } from '../../light';
import { gateState } from '../../lock/pin';
import { useDrawn } from '../../turns';
import './Blockers.css';

/** The sign whose page was open last in this load: a flow's page opened from it goes back to it (FlowPage). */
export const lastSign = signal<ChakraId | null>(null);

/** The sign a flow's page goes back to: the last sign opened, when it lists the flow; else the flow's own sign; else
 *  none (the page goes back to Flow). */
export function backSignOf(flow: Pick<Flow, 'chakra' | 'alsoUnder'>): ChakraId | null {
  const last = lastSign.value;
  if (last && (flow.chakra === last || flow.alsoUnder?.includes(last))) return last;
  return isChakraId(flow.chakra) ? flow.chakra : null;
}

const ROOM_KEY = 'fs-blockers-room';
/** How long, and how often, the list waits for the first blockers pass before it is drawn as it is. */
const SEED_WAIT_MS = 150;
const SEED_TRIES = 20;

/** The rows the list had the last time it was drawn on this sign's page, else the seeded number. */
export function blockersRoomOf(chakra: ChakraId): number {
  try {
    const v = (JSON.parse(localStorage.getItem(ROOM_KEY) ?? '{}') as Record<string, unknown>)[chakra];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 40) return v;
  } catch { /* private mode: the seeded room */ }
  return seededBlockerCount(chakra);
}
function keepRoom(chakra: ChakraId, rows: number) {
  try {
    const all = JSON.parse(localStorage.getItem(ROOM_KEY) ?? '{}') as Record<string, unknown>;
    if (all[chakra] === rows) return;
    localStorage.setItem(ROOM_KEY, JSON.stringify({ ...all, [chakra]: rows }));
  } catch { /* private mode */ }
}

/** The step he is on in a live blocker, or none (no episode, or the dot at rest). */
const liveStep = (b: Blocker) => {
  if (!b.live) return undefined;
  const at = placeOf(b.flow, currentStepId(b.live));
  return at > 0 ? { at, name: b.flow.steps[at - 1].name } : undefined;
};

type RowProps = { b: Blocker; still: boolean; onHold?: (flow: Read<Flow>) => void };

/** One row: a link to the flow's page, two rules (one in Still). */
export function BlockerRow({ b, still, onHold }: RowProps) {
  const { flow } = b;
  const hold = useHold(() => onHold?.(flow));
  const press = onHold ? hold : {};
  const href = `#/flow/${flow.id}`;
  if (still) {
    return <a class="bk-row bk-name" href={href} data-flow={flow.id} {...press}>{flow.name}</a>;
  }
  const now = liveStep(b);
  const words = flow.steps.map(s => s.name).filter(Boolean);
  return (
    <a class="fs-row fs-list-row fl-flow bk-row" href={href} data-flow={flow.id} data-live={now ? 'true' : undefined}
      data-draft={flow.draft ? '' : undefined} {...press}>
      <span class="fs-list-line">{flow.name}</span>
      {now
        ? <span class="bk-now">{now.name}</span>
        : (
          <small class="fs-list-meta bk-words">
            {words.map((w, i) => <span key={i} class="bk-word">{i ? ` · ${w}` : w}</span>)}
          </small>
        )}
      <span class="fl-mini" aria-hidden="true" data-travel="fs-drawing">
        <Cycle small diagram={flow.diagram} steps={flow.steps} at={now?.at ?? 0} />
      </span>
    </a>
  );
}

type Props = { chakra: ChakraId; onHold?: (flow: Read<Flow>) => void; foot?: ComponentChildren; version?: number };

export function Blockers({ chakra, onHold, foot, version = 0 }: Props) {
  const locked = gateState() === 'locked';
  const still = light.value === 'still';
  // Still: nothing lifts, so a long press is a tap
  const hold = still ? undefined : onHold;
  const [rows, setRows] = useState<Blocker[] | null>(null);
  // a turn back to this page waits for the rows (parts/Turn caps the wait), so the small drawing it lands on is there
  useDrawn(rows !== null || locked);

  useEffect(() => {
    if (locked) { setRows(null); return; }
    let on = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    // on the first open of a journal the blockers pass runs just after the page is drawn (app.tsx): the list read
    // before it would be short and then grow, moving everything under it. So until the pass has run the room stays
    // held and the read is tried again (its dataVersion bump reads again too); after a while the list is drawn as it is.
    const read = (tries: number): void => void Promise.all([blockersOf(chakra), blockersSeeded()]).then(([r, seeded]) => {
      if (!on) return;
      if (!seeded && tries > 0) { retry = setTimeout(() => read(tries - 1), SEED_WAIT_MS); return; }
      setRows(r);
      keepRoom(chakra, r.length);
    }, () => { /* locked under the read: the room stays held */ });
    read(SEED_TRIES);
    return () => { on = false; clearTimeout(retry); };
  }, [chakra, locked, version, dataVersion.value]);

  if (!rows || locked) {
    const n = blockersRoomOf(chakra);
    // none left: the word and "+ blocker", one rule more
    return (
      <section class="bk" data-blockers="" data-wait="" aria-label="Blockers"
        style={{ '--bk-rows': String(n), '--bk-foot': n === 0 && foot ? '1' : '0' }}>
        <p class="fs-month bk-word-head">Blockers</p>
      </section>
    );
  }
  // Still: stored order (the flow list's), not live first
  const shown = still ? [...rows].sort((a, b) => a.flow.order - b.flow.order || a.flow.createdAt - b.flow.createdAt || a.flow.id.localeCompare(b.flow.id)) : rows;
  return (
    <section class="bk" data-blockers="" aria-label="Blockers">
      <p class="fs-month bk-word-head">Blockers</p>
      {shown.map(b => <BlockerRow key={b.flow.id} b={b} still={still} onHold={hold} />)}
      {shown.length === 0 && foot}
    </section>
  );
}
