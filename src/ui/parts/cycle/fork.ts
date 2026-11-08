// The fork (PLAN-FLOWS.md 3.5, Shame): a sudden drop after being seen. From the level ground the line drops (Seen,
// then I'm worthless) to a fork (Hide or hit back). Two dotted paths lead away and down off the page, "hide" and
// "hit back"; the third, solid, curves back up and over with an arrowhead (I did a thing), written "I can fix it" in
// the hand. The truth it draws: the whole-self verdict is the trap, and the one-act version has a road back
// (Tangney 2007). The dot walks the third path; the two that lead away are drawing only. It rests on the level
// ground before the drop.
import { arrowHead, tangentAt, type Drawn, type Label, type Shape } from './shape';
import { pieceD, slotsT, walkOf, type Piece } from './walk';

const W = 328, H = 224;
const GROUND = 40;
const FORK = { x: 128, y: 150 };
const drop: Piece = { from: { x: 34, y: GROUND }, c1: { x: 78, y: GROUND }, c2: { x: 112, y: 96 }, to: FORK, cls: 'arc' };
const END = { x: 304, y: 36 };
const fix: Piece = { from: FORK, c1: { x: 146, y: 178 }, c2: { x: 230, y: 140 }, to: END, cls: 'arc' };
const pieces: Piece[] = [{ from: { x: 12, y: GROUND }, to: drop.from, cls: 'arc pass' }, drop, fix];
const walk = walkOf(pieces);

// the two that lead away: down and off, either side
const hide: Piece = { from: FORK, c1: { x: 118, y: 176 }, c2: { x: 92, y: 200 }, to: { x: 44, y: 214 }, cls: 'arc pass' };
const hitBack: Piece = { from: FORK, c1: { x: 136, y: 190 }, c2: { x: 160, y: 212 }, to: { x: 196, y: 222 }, cls: 'arc pass' };

const SLOTS = [{ x: 52, y: GROUND }, { x: 100, y: 84 }, FORK, { x: 262, y: 92 }].map(walk.tNear);
const REST = walk.tNear({ x: 20, y: GROUND });

export const fork: Shape = {
  title: 'The fork',
  w: W,
  h: H,
  closed: false,
  at: walk.at,
  slotT: (i, n) => slotsT(SLOTS, i, n),
  restT: () => REST,
  // the page's middle (F2's clock and hold), low on the right, under the road back (its word sits under the road, left of it)
  mid: { x: 278, y: 196 },
  paths(): Drawn[] {
    const out: Drawn[] = pieces.map(p => ({ kind: 'path', d: pieceD(p), cls: p.cls }));
    out.push({ kind: 'path', d: pieceD(hide), cls: hide.cls }, { kind: 'path', d: pieceD(hitBack), cls: hitBack.cls });
    out.push({ kind: 'path', d: arrowHead(END, tangentAt(fork, 0.999), 6), cls: 'arrow' });
    out.push({ kind: 'text', x: 40, y: 206, text: 'hide', anchor: 'middle', cls: 'hand' });
    out.push({ kind: 'text', x: 188, y: 222, text: 'hit back', anchor: 'end', cls: 'hand' });
    out.push({ kind: 'text', x: 178, y: 177, text: 'I can fix it', anchor: 'middle', cls: 'hand' });
    return out;
  },
  label(i, n): Label {
    const p = walk.at(slotsT(SLOTS, i, n));
    // the ground's word stands above it; the drop's sits to its right, clear of the two that lead away; the fork's
    // to its left, above "hide"; the road back's above it, to the left
    if (p.y < GROUND + 4) return { x: p.x, y: p.y - 8, anchor: 'middle', hang: 'above' };
    if (p.x < FORK.x - 2) return { x: p.x + 20, y: p.y - 8, anchor: 'start', hang: 'centre' };
    if (Math.abs(p.x - FORK.x) < 3) return { x: p.x - 12, y: p.y - 14, anchor: 'end', hang: 'centre' };
    return { x: p.x - 6, y: p.y - 10, anchor: 'end', hang: 'above' };
  },
};
