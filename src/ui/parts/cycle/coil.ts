// The coil (PLAN-FLOWS.md 3.5, Replay): going back over something already done. A coil that tightens inward, turn
// by turn, from where it stung (That stung, then Why did I, then Heavier near the middle), and one straight line out
// of the middle to the right: How, not why, with its arrowhead. Each turn is a "why" (written along the coil in the
// hand). The truth it draws: the loop is made of a question, and a different question leaves it (Watkins 2008).
// The dot comes in on a dotted lead, walks the coil and leaves by the straight exit.
import { arrowHead, type Drawn, type Label, type Shape } from './shape';
import { piecesD, slotsT, walkOf, type Piece } from './walk';

const W = 328, H = 224;
const C = { x: 150, y: 118 };
/** Outer and inner radius, and the turns between: one and a half, so the coil ends pointing right, at its exit. */
const R0 = 80, R1 = 12, TURNS = 1.5;

/** The point a fraction u of the way along the coil (u 0 is the outer start, on the left; u 1 the middle). */
function coilAt(u: number) {
  const a = Math.PI + u * TURNS * 2 * Math.PI, r = R0 + (R1 - R0) * u;
  return { x: C.x + r * Math.cos(a), y: C.y + r * Math.sin(a) };
}
// the coil as short lines, fine enough to read as a curve
const SEGS = 90;
const spiral: Piece[] = Array.from({ length: SEGS }, (_, i) => ({ from: coilAt(i / SEGS), to: coilAt((i + 1) / SEGS), cls: 'arc' }));
const start = spiral[0].from, end = spiral.at(-1)!.to;
const lead: Piece = { from: { x: 26, y: 206 }, c1: { x: 58, y: 204 }, c2: { x: start.x, y: 170 }, to: start, cls: 'arc pass' };
const EXIT = { x: 306, y: end.y };
const exit: Piece = { from: end, to: EXIT, cls: 'arc' };
const pieces: Piece[] = [lead, ...spiral, exit];
const walk = walkOf(pieces, 12);

// That stung where the coil starts; Why did I a quarter turn on, at the top; Heavier a turn further in, at the top
// again and tighter; How, not why out on the straight
const SLOTS = [start, coilAt(1 / 6), coilAt(5 / 6), { x: 276, y: end.y }].map(walk.tNear);
const REST = walk.tNear({ x: 40, y: 204 });

export const coil: Shape = {
  title: 'The coil',
  w: W,
  h: H,
  closed: false,
  at: walk.at,
  slotT: (i, n) => slotsT(SLOTS, i, n),
  restT: () => REST,
  paths(): Drawn[] {
    const out: Drawn[] = [
      { kind: 'path', d: piecesD([lead]), cls: 'arc pass' },
      { kind: 'path', d: piecesD(spiral), cls: 'arc' },
      { kind: 'path', d: piecesD([exit]), cls: 'arc' },
      { kind: 'path', d: arrowHead(EXIT, 0, 6), cls: 'arrow' },
    ];
    // each turn is a why: the word in the hand under the outer turn, and again inside it, tighter
    out.push({ kind: 'text', x: C.x, y: C.y + 66, text: 'why', anchor: 'middle', cls: 'hand' });
    out.push({ kind: 'text', x: C.x, y: C.y + 30, text: 'why', anchor: 'middle', cls: 'hand' });
    return out;
  },
  label(i, n): Label {
    const p = walk.at(slotsT(SLOTS, i, n));
    // the start's word sits outside the coil to the left; the top's above; the exit's above the line
    if (p.x < C.x - R0 + 8) return { x: p.x - 10, y: p.y, anchor: 'end', hang: 'centre' };
    if (p.x > C.x + R0 / 2) return { x: p.x, y: p.y - 10, anchor: 'middle', hang: 'above' };
    return { x: p.x, y: p.y - 8, anchor: 'middle', hang: 'above' };
  },
};
