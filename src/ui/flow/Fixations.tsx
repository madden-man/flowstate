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
import { useEffect, useState } from 'preact/hooks';
import type { Fixation } from '../../db/schema';
import type { Read } from '../../db/fields';
import { FIXATION_FLOW, deck as readDeck, openStint, spanOfStint, three as readThree, type Three } from '../../model/fixations';
import { dataVersion } from '../sheets';
import { shortDate } from '../date';
import { light } from '../light';
import { voiceColour } from '../voice';
import { DeckSheet } from './DeckSheet';

export type Fixed = { three: Three; deck: Read<Fixation>[] };
/** What the sheet is open on: one of the three slots, or a deck fixation looking for a slot. */
export type DeckOpen = { slot: number } | { id: string } | null;
/** A fixation that has landed in a slot, as the sheet tells it. */
export type Landed = { slot: number; hue: number };

/** A row the page may show: there, and not read locked. */
const shown = (f: Read<Fixation> | undefined): f is Read<Fixation> => !!f && !f.locked;

/** The three and the deck, read again on an import (dataVersion) and on reload(). Nothing is read while off (any other
 *  flow, or through the door). */
export function useFixations(on: boolean): { fixed: Fixed | null; reload: () => Promise<void> } {
  const [fixed, setFixed] = useState<Fixed | null>(null);
  const read = async () => { const [three, deck] = await Promise.all([readThree(), readDeck()]); return { three, deck }; };
  useEffect(() => {
    if (!on) { setFixed(null); return; }
    let live = true;
    void read().then(f => { if (live) setFixed(f); });
    return () => { live = false; };
  }, [on, dataVersion.value]);
  return { fixed, reload: async () => { if (on) setFixed(await read()); } };
}

/** The three's hue angles in slot order, for the stream's lanes (null for an empty slot: its lane stays ink). */
export const huesOf = (three: Three): (number | null)[] => three.map(f => (shown(f) ? f.hue : null));

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

type Props = Fixed & {
  /** The minute now (FlowPage's useNow), for the span. */
  now: number;
  /** The sheet changed something: read again, then (if one landed) send the ring. Resolves once the page has the new rows. */
  onChanged: (landed?: Landed) => Promise<void> | void;
};

export function Fixations({ three, deck, now, onChanged }: Props) {
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
              <button key={key} type="button" class="fx-card fx-empty" data-slot={slot} aria-label="An empty place" onClick={() => setOpen({ slot })}>
                <span class="fx-name" />
                {!still && <small class="fx-meta">Empty</small>}
              </button>
            );
          }
          const stint = openStint(f);
          return (
            <button key={key} type="button" class={`fx-card${isFresh ? ' fresh' : ''}`} data-slot={slot} style={colour(f.hue)} onClick={() => setOpen({ slot })}>
              <span class="fx-name"><span>{f.name}{!still && <Under />}</span></span>
              {!still && stint && (
                <small class="fx-meta">
                  Since {shortDate(new Date(stint.from))}<span class="fs-notstill"> · {spanOfStint(stint, now)}</span>
                </small>
              )}
            </button>
          );
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
      <DeckSheet open={open} onClose={() => setOpen(null)} onChanged={landed => { void changed(landed); }} />
    </section>
  );
}
