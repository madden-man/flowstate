// The deck (PLAN-ENERGIZE.md sections 2 to 4, X3): the sheet a fixation's card opens under Energize's drawing, and
// the one a deck chip opens. Fixations.tsx (X2) owns the state and renders this; it hears onChanged after every write,
// re-reads the three and the deck, redraws the landed card's stroke and sends the stream's ring out in its hue.
//
// From a card (open = { slot }): the card's name with its hue dot, "On since 11 / 7", the deck rows (longest waiting
// first, "last on 10 / 22" or "never on"), then Deal me one and "+ fixation", then "<Name> goes back on deck." with
// Finished instead. A tap on a row is the swap; there is no confirm step (section 2). An empty slot is titled Empty
// and has no fate line. From a deck chip (open = { id }): that fixation, and the three it could replace.
//
// Deal me one writes nothing: the rows riffle once and one is lit; a tap on it is the swap, another deal picks again,
// never the one just taken off and never the last one dealt. "+ fixation" and Edit are screens inside the same sheet
// (the sheet's back word, as the music sheet's Playlists), never a second sheet. No save button (rule 6): leaving
// either screen, by its back word or by putting the sheet away, keeps what is written; an empty name writes nothing.
//
// The swap travels (rule 28, section 4): the tapped row carries view-transition-name fx-slot-<slot> into parts/Turn's
// "fx-swap" turn, and once the page has the new card the name moves to the card ([data-fx-slot="<slot>"], X2's
// markup), so the row is seen landing in its slot on --ease-settle. Where the card has no such mark, or there are no
// view transitions, or Reduce Motion is on, the change just happens. One tick and the rising fifth on a swap, one tick
// on a deal (rules 19 and 21). Still drops the dates (rule 13); a row read locked shows nothing.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Sheet } from '../parts/Sheet';
import { HueWheel } from '../parts/HueWheel';
import { tick } from '../parts/Haptic';
import { bell } from '../parts/Sound';
import { turn, WAIT_MS } from '../parts/Turn';
import { shortDate } from '../date';
import { voiceColour } from '../voice';
import type { Fixation } from '../../db/schema';
import type { Read } from '../../db/fields';
import {
  SLOTS, three, deck, swap, finish, add, rename, recolour, setSince, deal, lastOn, openStint, fixationById, type Three,
} from '../../model/fixations';

export type DeckOpen = { slot: number } | { id: string } | null;
type Props = {
  open: DeckOpen;
  onClose: () => void;
  onChanged: (landed?: { slot: number; hue: number }) => void;
};

/** A fixation's colour, exactly as a voice's (DESIGN.md rule 3): the hue on the light's lightness and chroma. */
export const fixationColour = (hue: number) => voiceColour({ hue }, 'light');

/** The turn the swap travels on, and the name the row and its slot's card share for it. */
export const SWAP_TURN = 'fx-swap';
export const slotName = (slot: number) => `fx-slot-${slot}`;

/** A hue for "+ fixation" to start on: the one furthest round the wheel from every hue already in use. */
export function freeHue(used: number[]): number {
  if (!used.length) return 250;
  let best = 0, gap = -1;
  for (let h = 0; h < 360; h += 5) {
    const near = Math.min(...used.map(u => { const d = Math.abs(((h - u) % 360 + 360) % 360); return Math.min(d, 360 - d); }));
    if (near > gap) { gap = near; best = h; }
  }
  return best;
}

/** A date input's value for a day, by the phone's own calendar ("2026-11-07"), and back to local midnight. */
const dayValue = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayOf = (v: string): number | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : undefined;
};

type Loaded = { three: Three; deck: Read<Fixation>[]; subject?: Read<Fixation> };
type View = 'deck' | 'edit' | 'new';
type EditDraft = { name: string; hue: number; since: string };

const usable = (f: Read<Fixation> | undefined): f is Read<Fixation> => !!f && !f.locked;

export function DeckSheet({ open, onClose, onChanged }: Props): JSX.Element | null {
  // what the sheet was opened for, kept while it goes down so its words do not empty under the thumb
  const [asked, setAsked] = useState<Exclude<DeckOpen, null> | null>(open);
  const [data, setData] = useState<Loaded | null>(null);
  const [view, setView] = useState<View>('deck');
  const [dealt, setDealt] = useState<string | undefined>(undefined);
  const [riffle, setRiffle] = useState(0);
  const [edit, setEdit] = useState<EditDraft>({ name: '', hue: 0, since: '' });
  const [fresh, setFresh] = useState({ name: '', hue: 0 });
  // the sheet session (section 2): the one just taken off and the last one dealt are never dealt
  const takenOff = useRef<string | undefined>(undefined);
  const lastDealt = useRef<string | undefined>(undefined);
  const busy = useRef(false);
  const freshName = useRef<HTMLInputElement>(null);
  // "+ fixation": the caret waits in the name
  useEffect(() => {
    if (view !== 'new') return;
    const r = requestAnimationFrame(() => freshName.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(r);
  }, [view]);

  const load = async (o: Exclude<DeckOpen, null>): Promise<Loaded> => {
    const [t, d] = await Promise.all([three(), deck()]);
    const subject = 'slot' in o ? t[o.slot] : await fixationById(o.id);
    return { three: t, deck: d, subject };
  };

  useEffect(() => {
    if (!open) return;
    let live = true;
    setAsked(open);
    setView('deck');
    setDealt(undefined);
    setRiffle(0);
    lastDealt.current = undefined;
    busy.current = false;
    setData(null);
    void load(open).then(d => { if (live) setData(d); });
    return () => { live = false; };
  }, [open && ('slot' in open ? `s${open.slot}` : `i${open.id}`)]);

  if (!asked) return null;
  const bySlot = 'slot' in asked;
  const slot = bySlot ? (asked as { slot: number }).slot : -1;
  const subject = data?.subject;
  // a fixation read while the journal is locked shows nothing (its name is sealed); one from a chip must be there
  if (subject?.locked || (!bySlot && data && !subject)) return null;
  const f = usable(subject) ? subject : undefined;

  const reload = async () => { const d = await load(asked); setData(d); };

  /** Writes what the open screen holds, if anything (leaving Edit or "+ fixation" keeps the work). */
  const keep = async (): Promise<boolean> => {
    if (view === 'edit' && f) {
      let wrote = false;
      if (edit.name.trim() && edit.name.trim() !== f.name) wrote = !!(await rename(f.id, edit.name)) || wrote;
      if (edit.hue !== f.hue) wrote = !!(await recolour(f.id, edit.hue)) || wrote;
      const since = dayOf(edit.since), on = openStint(f);
      if (on && since !== undefined && dayValue(on.from) !== edit.since) wrote = !!(await setSince(f.id, since)) || wrote;
      return wrote;
    }
    if (view === 'new' && fresh.name.trim()) return !!(await add(fresh.name, fresh.hue));
    return false;
  };
  const back = async () => {
    const wrote = await keep();
    setView('deck');
    if (wrote) { await reload(); onChanged(); }
  };
  const close = () => {
    onClose();
    void keep().then(wrote => { if (wrote) onChanged(); });
  };

  const openEdit = () => {
    if (!f) return;
    const on = openStint(f);
    setEdit({ name: f.name, hue: f.hue, since: on ? dayValue(on.from) : '' });
    setView('edit');
  };
  const openNew = () => {
    const used = [...(data?.three ?? []), ...(data?.deck ?? [])].filter(usable).map(x => x.hue);
    setFresh({ name: '', hue: freeHue(used) });
    setView('new');
  };

  /** The swap: into slot goes id. The row tapped travels to the card (rule 28) where the browser can. */
  const take = (into: number, incoming: Read<Fixation>, row: HTMLElement) => {
    if (busy.current) return;
    busy.current = true;
    tick('swap');
    bell('swap');
    const off = data?.three[into]?.id;
    const name = slotName(into);
    let card: HTMLElement | null = null;
    // the write comes first, outside the turn, so the page is not held still while the database answers; the row
    // stays pressed meanwhile (parts/Press), and the turn only waits for the card's new name (parts/Turn's cap)
    void swap(into, incoming.id).then(wrote => {
      if (wrote && off && off !== incoming.id) takenOff.current = off;
      row.style.setProperty('view-transition-name', name);
      return turn(SWAP_TURN, () => {
        if (wrote) onChanged({ slot: into, hue: incoming.hue });
        onClose();
      }, {
        // X2 re-reads on onChanged: wait for the card to carry the new name, never past parts/Turn's own cap
        ready: () => new Promise<void>(r => {
          const until = performance.now() + WAIT_MS;
          const seen = () => document.querySelector<HTMLElement>(`[data-fx-slot="${into}"]`)?.textContent?.includes(incoming.name);
          const look = () => (seen() || performance.now() > until ? r() : requestAnimationFrame(look));
          look();
        }),
        settle: () => {
          // the row lands as the card: it leaves the sheet going down, so it is not seen twice
          row.style.removeProperty('view-transition-name');
          row.style.setProperty('visibility', 'hidden');
          card = document.querySelector<HTMLElement>(`[data-fx-slot="${into}"]`);
          card?.style.setProperty('view-transition-name', name);
        },
      });
    }).finally(() => {
      row.style.removeProperty('view-transition-name');
      card?.style.removeProperty('view-transition-name');
    });
  };

  const dealOne = async () => {
    tick('deal');
    const exclude = [takenOff.current, lastDealt.current].filter((x): x is string => !!x);
    const d = await deal(exclude);
    if (!d) return;
    lastDealt.current = d.id;
    setDealt(d.id);
    setRiffle(n => n + 1);
  };

  const finished = async () => {
    if (!f || busy.current) return;
    busy.current = true;
    await finish(f.id);
    onChanged();
    onClose();
  };

  const was = f ? f.name : 'Empty';
  const dot = (hue: number | undefined) => (hue === undefined ? {} : ({ '--vc': fixationColour(hue) } as JSX.CSSProperties));
  const rows = (data?.deck ?? []).filter(usable);

  // ---- the three screens ----
  let title: string, body: JSX.Element | null, action: { label: string; inert?: boolean; onPress: () => void } | undefined;
  let backWord: { label: string; onPress: () => void } | undefined;
  let hue: number | undefined = f?.hue;

  if (view === 'edit' && f) {
    title = edit.name.trim() || f.name;
    hue = edit.hue;
    backWord = { label: was, onPress: () => void back() };
    body = (
      <div class="fs-rows fx-edit">
        <label class="fs-row stack">
          <span>Name</span>
          <input class="fs-input" value={edit.name} aria-label="Name" autocomplete="off" enterKeyHint="done"
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => { const v = e.currentTarget.value; setEdit(p => ({ ...p, name: v })); }} />
        </label>
        <div class="fs-row stack">
          <span>Colour</span>
          <HueWheel hue={edit.hue} colour={fixationColour(edit.hue)} label={edit.name.trim() || undefined}
            onHue={h => setEdit(p => ({ ...p, hue: h }))} />
        </div>
        {openStint(f) && (
          <label class="fs-row stack fs-notstill">
            <span>On since</span>
            <input class="fs-input" type="date" value={edit.since} max={dayValue(Date.now())} aria-label="On since"
              onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => { const v = e.currentTarget.value; setEdit(p => ({ ...p, since: v })); }} />
          </label>
        )}
      </div>
    );
  } else if (view === 'new') {
    title = fresh.name.trim() || 'New fixation';
    hue = fresh.hue;
    backWord = { label: was, onPress: () => void back() };
    action = { label: 'On deck', inert: !fresh.name.trim(), onPress: () => void back() };
    body = (
      <div class="fx-new">
        <input class="fs-input" value={fresh.name} aria-label="Name" placeholder="A new obsession" autocomplete="off" enterKeyHint="done"
          ref={freshName}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => { const v = e.currentTarget.value; setFresh(p => ({ ...p, name: v })); }} />
        <HueWheel hue={fresh.hue} colour={fixationColour(fresh.hue)} label="Its colour" onHue={h => setFresh(p => ({ ...p, hue: h }))} />
      </div>
    );
  } else if (bySlot) {
    title = f ? f.name : 'Empty';
    action = f ? { label: 'Edit', onPress: openEdit } : undefined;
    const on = f && openStint(f);
    body = (
      <>
        {on && <small class="fx-label fs-notstill"><span class="fx-since">On since {shortDate(new Date(on.from))}</span></small>}
        <div key={riffle} class="fx-deck" role="list" aria-label="On deck" data-riffle={riffle ? '' : undefined}>
          {rows.map((r, i) => {
            const last = lastOn(r);
            return (
              <button key={r.id} type="button" role="listitem" class="fx-deckrow" data-fx={r.id} data-dealt={dealt === r.id ? '' : undefined}
                style={{ ...dot(r.hue), '--i': i } as JSX.CSSProperties}
                onClick={e => take(slot, r, e.currentTarget)}>
                <b>{r.name}</b>
                <small class="fs-notstill">{last === undefined ? 'never on' : `last on ${shortDate(new Date(last))}`}</small>
              </button>
            );
          })}
        </div>
        <div class="fx-acts">
          <button type="button" class="fs-chip go" data-deal="" aria-disabled={rows.length ? undefined : 'true'}
            onClick={() => { if (rows.length) void dealOne(); }}>Deal me one</button>
          <button type="button" class="fs-chip add" onClick={openNew}>+ fixation</button>
        </div>
        {f && (
          <p class="fx-fate">
            <span>{f.name} goes back on deck.</span>
            <button type="button" class="fs-word" onClick={() => void finished()}>Finished instead</button>
          </p>
        )}
      </>
    );
  } else {
    // from a deck chip: which of the three does it replace
    title = f?.name ?? '';
    action = f ? { label: 'Edit', onPress: openEdit } : undefined;
    const t = data?.three ?? ([undefined, undefined, undefined] as Three);
    body = (
      <>
        <small class="fx-label">In place of</small>
        <div class="fx-deck" role="list" aria-label="In place of">
          {Array.from({ length: SLOTS }, (_, k) => {
            const there = t[k];
            if (there?.locked) return null;
            const on = there && openStint(there);
            return (
              <button key={k} type="button" role="listitem" class={`fx-deckrow${there ? '' : ' empty'}`} data-slot={k}
                style={{ ...dot(there?.hue), '--i': k } as JSX.CSSProperties}
                onClick={e => { if (f) take(k, f, e.currentTarget); }}>
                <b>{there ? there.name : 'Empty'}</b>
                {on && <small class="fs-notstill">since {shortDate(new Date(on.from))}</small>}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div class="fx-sheet" data-hue={hue === undefined ? undefined : ''} style={dot(hue)}>
      <Sheet open={!!open && !!data} onClose={close} title={title} action={action} back={backWord}>
        {body}
      </Sheet>
    </div>
  );
}
