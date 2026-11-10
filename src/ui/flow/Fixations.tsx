// The three (PLAN-ENERGIZE.md sections 2 to 4, X2): on the flow named FIXATION_FLOW, at rest, everything under the
// drawing is what Tommy is into right now. Three cards in slot order, each his name at --fs-manifesto over a stroke
// in its hue, drawn like a pen when the card appears (DESIGN.md rule 27), a 3px rule and a wash at --tint in the hue
// as a voice's line has (rules 3 and 9), and a print line, "Since 11 / 7 · 4 days" (a duration, never a run of days: rule
// 15). An emptied slot is a dashed slot (rule 11). Under the three, one blank rule, then the deck peeking as chips,
// longest waiting first, and the foot's "What stuck" (X4's page; a link only here).
//
// A tap on a card opens the deck sheet for its slot, a tap on a chip opens it for that fixation (section 2: it works
// both ways); the sheet is X3's (./DeckSheet), and this file only holds what it is open on. When the sheet has changed
// something, the page reads the three and the deck again, and if one landed in a slot its card is drawn fresh (it
// rises into place and its stroke is drawn again) and the page sends the stream's landing ring out in its hue.
//
// Still (rule 13): the names only; no since line, no stroke, no deck, no foot. Through the door without the PIN the
// page is the drawing alone (FlowPage renders none of this), since the names are sealed (section 2).
//
// Spark it (X5): a card with a Next line shows it as a third rule under the since line, italic, after the print word
// "Next"; it is written in the sheet's Edit or on the ride, never here. The ride's card (FlowPage on a step, when the
// live episode names a fixation) is the same card, alone and not a button (a tap on it does nothing while riding), its
// Next an open line on a rule that keeps itself on blur or a pause (setNext), no save word (rule 6). Still hides Next.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { Fixation } from '../../db/schema';
import type { Read } from '../../db/fields';
import {
  FIXATION_FLOW, deck as readDeck, fixationById, openStint, setNext, spanOfStint, three as readThree, type Sparked, type Three,
} from '../../model/fixations';
import { dataVersion } from '../sheets';
import { shortDate } from '../date';
import { light } from '../light';
import { voiceColour } from '../voice';
import { DeckSheet } from './DeckSheet';

/** ride (X5): the fixation the live episode names, when one does and it can show. */
export type Fixed = { three: Three; deck: Read<Fixation>[]; ride?: Read<Fixation> };
/** What the sheet is open on: one of the three slots, or a deck fixation looking for a slot. */
export type DeckOpen = { slot: number } | { id: string } | null;
/** A fixation that has landed in a slot, as the sheet tells it. */
export type Landed = { slot: number; hue: number };

/** A row the page may show: there, and not read locked. */
const shown = (f: Read<Fixation> | undefined): f is Read<Fixation> => !!f && !f.locked;

/** The three and the deck, and the ridden one when rideId names it (X5), read again on an import (dataVersion), when
 *  the ride changes and on reload(). Nothing is read while off (any other flow, or through the door). */
export function useFixations(on: boolean, rideId?: string): { fixed: Fixed | null; reload: () => Promise<void> } {
  const [fixed, setFixed] = useState<Fixed | null>(null);
  const read = async (): Promise<Fixed> => {
    const [three, deck, ride] = await Promise.all([readThree(), readDeck(), rideId ? fixationById(rideId) : undefined]);
    return { three, deck, ride: shown(ride) ? ride : undefined };
  };
  useEffect(() => {
    if (!on) { setFixed(null); return; }
    let live = true;
    void read().then(f => { if (live) setFixed(f); });
    return () => { live = false; };
  }, [on, rideId, dataVersion.value]);
  return { fixed, reload: async () => { if (on) setFixed(await read()); } };
}

/** The three's hue angles in slot order, for the stream's lanes (null for an empty slot: its lane stays ink). */
export const huesOf = (three: Three): (number | null)[] => three.map(f => (shown(f) ? f.hue : null));

/** The stream's lanes on Energize (rule 30): a ride named by Spark it runs in its one hue, every lane; else the three. */
export const laneHues = (fixed: Fixed): (number | null)[] => (fixed.ride ? [fixed.ride.hue, fixed.ride.hue, fixed.ride.hue] : huesOf(fixed.three));

/** The Flow list's meta line for Energize: the three names in slot order (X2); undefined when none can show. */
export function namesOf(three: Three): string | undefined {
  const names = three.filter(shown).map(f => f.name).filter(Boolean);
  return names.length ? names.join(' · ') : undefined;
}

const colour = (hue: number) => ({ '--vc': voiceColour({ hue }, 'light') });

/** The stroke under a name: one pen line, a little uneven, drawn along its length (pathLength 1, parts.css). */
const Under = () => (
  <svg class="fx-under" viewBox="0 0 120 7" preserveAspectRatio="none" aria-hidden="true">
    <path pathLength={1} d="M2 4.5 C28 1.5 52 6.5 80 3.5 C96 2 108 4 118 3" />
  </svg>
);

/** One of the three, as at rest; the ride's card when ride is set. */
export function FixationCard({ f, now, slot, fresh, onOpen, ride }: {
  f: Read<Fixation>; now: number; slot?: number; fresh?: boolean; onOpen?: () => void;
  /** X5: the ride's card, not a button, its Next written here. */
  ride?: boolean;
}) {
  const still = light.value === 'still';
  const stint = openStint(f);
  const inner = (
    <>
      <span class="fx-name"><span>{f.name}{!still && <Under />}</span></span>
      {!still && stint && (
        <small class="fx-meta">
          Since {shortDate(new Date(stint.from))}<span class="fs-notstill"> · {spanOfStint(stint, now)}</span>
        </small>
      )}
      {!still && (ride ? <NextLine f={f} /> : f.next && <span class="fx-next fs-notstill"><small>Next</small>{f.next}</span>)}
    </>
  );
  if (ride) return <div class="fx-card fx-ride" data-ride="" style={colour(f.hue)}>{inner}</div>;
  return (
    <button type="button" class={`fx-card${fresh ? ' fresh' : ''}`} data-slot={slot} data-fx-slot={slot} style={colour(f.hue)} onClick={onOpen}>
      {inner}
    </button>
  );
}

/** A pause in the typing this long keeps the Next line, as a page keeps a block (journal/PageView's SAVE_AFTER_MS). */
const NEXT_AFTER_MS = 600;

/** The ride's Next line (X5): an open line on a rule, kept on blur and after a pause; an empty line takes it away. */
function NextLine({ f }: { f: Read<Fixation> }) {
  const [text, setText] = useState(f.next ?? '');
  const kept = useRef(f.next ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setText(f.next ?? ''); kept.current = f.next ?? ''; }, [f.id]);
  const keep = (v: string) => {
    clearTimeout(timer.current);
    if (v.trim() === kept.current) return;
    kept.current = v.trim();
    void setNext(f.id, v);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <label class="fx-next fx-next-edit fs-notstill">
      <small>Next</small>
      <input class="fx-next-input" value={text} placeholder="The next small step" aria-label="Next" autocomplete="off" enterKeyHint="done"
        onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => {
          const v = e.currentTarget.value;
          setText(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => keep(v), NEXT_AFTER_MS);
        }}
        onBlur={e => keep(e.currentTarget.value)}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    </label>
  );
}

type Props = Fixed & {
  /** The minute now (FlowPage's useNow), for the span. */
  now: number;
  /** The sheet changed something: read again, then (if one landed) send the ring. Resolves once the page has the new rows. */
  onChanged: (landed?: Landed) => Promise<void> | void;
  /** Spark it (X5) named the ride: the page routes to the dot's step. */
  onSpark?: (sparked: Sparked) => void;
};

export function Fixations({ three, deck, now, onChanged, onSpark }: Props) {
  const [open, setOpen] = useState<DeckOpen>(null);
  // the card that last landed, drawn fresh: a new seq remounts it so its stroke is drawn again
  const [fresh, setFresh] = useState<{ slot: number; seq: number } | null>(null);
  const still = light.value === 'still';

  const changed = async (landed?: Landed) => {
    await onChanged(landed);
    if (landed) setFresh(f => ({ slot: landed.slot, seq: (f?.seq ?? 0) + 1 }));
  };

  return (
    <section class="fl-step-page fx-page" aria-label="What I'm into">
      <div class="fx-cards">
        {three.map((f, slot) => {
          const isFresh = fresh?.slot === slot;
          const key = `${slot}:${shown(f) ? f.id : ''}:${isFresh ? fresh.seq : 0}`;
          if (!shown(f)) {
            return (
              <button key={key} type="button" class="fx-card fx-empty" data-slot={slot} data-fx-slot={slot} aria-label="An empty place" onClick={() => setOpen({ slot })}>
                <span class="fx-name" />
                {!still && <small class="fx-meta">Empty</small>}
              </button>
            );
          }
          return <FixationCard key={key} f={f} now={now} slot={slot} fresh={isFresh} onOpen={() => setOpen({ slot })} />;
        })}
      </div>
      {!still && deck.some(shown) && (
        <div class="fx-deckpeek">
          <small class="fx-label">On deck</small>
          <div class="fs-chips">
            {deck.filter(shown).map(f => (
              <button key={f.id} type="button" class="fs-chip" style={colour(f.hue)} onClick={() => setOpen({ id: f.id })}>
                <i />{f.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {!still && <p class="fx-foot"><a class="fs-word" href={`#/flow/${FIXATION_FLOW}/stuck`}>What stuck</a></p>}
      <DeckSheet open={open} onClose={() => setOpen(null)} onChanged={landed => { void changed(landed); }} onSpark={onSpark} />
    </section>
  );
}
