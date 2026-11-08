// The mountain with a fork (PLAN-FLOWS.md 3.4, Fight): a profile. A steep climb from the floor to a sharp summit and a
// long shallow slope down. At the summit the road forks: "leave" is the slope itself, the shorter road; "say it" runs
// longer and dips through shame below it; both rejoin at repair on the floor. Two faint lines cross the slope, "20 min"
// (the least a break takes) and "about an hour" (the slow hormone), and replaying it is a bump back up the slope. The
// truth it draws: coming down takes many times longer than going up, every branch reaches the floor, and leaving is
// the shorter road.
// The dot walks the leave road (the steps sit on it); "say it" and the replay bump are drawing. It rests on the floor
// before the trigger.
import type { Drawn, Label, Shape } from './shape';
import { pieceD, slotsT, walkOf, type Piece } from './walk';

const W = 328, H = 224;
const FLOOR = 186;
const SUMMIT = { x: 94, y: 44 };
const REPAIR = { x: 290, y: FLOOR };

const climb: Piece = { from: { x: 42, y: FLOOR }, c1: { x: 62, y: FLOOR - 4 }, c2: { x: 82, y: 100 }, to: SUMMIT, cls: 'arc' };
const leave: Piece = { from: SUMMIT, c1: { x: 134, y: 100 }, c2: { x: 206, y: FLOOR - 6 }, to: REPAIR, cls: 'arc' };
const pieces: Piece[] = [
  { from: { x: 12, y: FLOOR }, to: climb.from, cls: 'arc pass' },
  climb,
  leave,
  { from: REPAIR, to: { x: W - 12, y: FLOOR }, cls: 'arc pass' },
];
const walk = walkOf(pieces);

// "say it": from the summit, steeper, below the leave road and under the floor's line (shame), back up to repair
const say1: Piece = { from: SUMMIT, c1: { x: 104, y: 130 }, c2: { x: 130, y: 204 }, to: { x: 190, y: 204 }, cls: 'arc pass' };
const say2: Piece = { from: say1.to, c1: { x: 240, y: 204 }, c2: { x: 266, y: FLOOR }, to: REPAIR, cls: 'arc pass' };

const onRoad = (x: number) => walk.at(nearestX(x));
/** The t on the leave road (past the summit) at x, for the lines across it and the replay bump. */
function nearestX(x: number) {
  let best = 0, bd = Infinity;
  for (let i = 0; i <= 400; i++) { const t = i / 400, p = walk.at(t); if (p.x >= SUMMIT.x && Math.abs(p.x - x) < bd) { bd = Math.abs(p.x - x); best = t; } }
  return best;
}
const MIN20 = 166, HOUR = 252;
/** The lines across the slope run from this height to the floor; their words sit above them. */
const LINE_TOP = 30;
// replaying: a dotted bump that leaves the slope and climbs back up it before it comes down again
const b0 = onRoad(278), b1 = onRoad(252);
const bump: Piece = { from: b0, c1: { x: b0.x - 2, y: b0.y - 28 }, c2: { x: b1.x + 4, y: b1.y - 28 }, to: b1, cls: 'arc pass' };

const SLOTS = [{ x: 50, y: FLOOR - 2 }, { x: 72, y: 124 }, SUMMIT, { x: 118, y: 76 }, { x: 196, y: 150 }, REPAIR].map(walk.tNear);
const REST = walk.tNear({ x: 22, y: FLOOR });

export const mountain: Shape = {
  title: 'The mountain',
  w: W,
  h: H,
  closed: false,
  at: walk.at,
  slotT: (i, n) => slotsT(SLOTS, i, n),
  restT: () => REST,
  // the page's middle (F2's clock and hold), right of the long slope, above the replay (F4: the centre is drawn on)
  mid: { x: 274, y: 100 },
  paths(): Drawn[] {
    const out: Drawn[] = pieces.map(p => ({ kind: 'path', d: pieceD(p), cls: p.cls }));
    out.push({ kind: 'path', d: pieceD(say1), cls: say1.cls }, { kind: 'path', d: pieceD(say2), cls: say2.cls });
    for (const x of [MIN20, HOUR]) out.push({ kind: 'path', d: `M${x} ${LINE_TOP} L${x} ${FLOOR}`, cls: 'arc faint' });
    out.push({ kind: 'text', x: MIN20, y: LINE_TOP - 8, text: '20 min', anchor: 'middle', cls: 'print num' });
    out.push({ kind: 'text', x: HOUR, y: LINE_TOP - 8, text: 'about an hour', anchor: 'middle', cls: 'print' });
    out.push({ kind: 'path', d: pieceD(bump), cls: bump.cls });
    out.push({ kind: 'text', x: b0.x + 2, y: b0.y - 26, text: 'replay', anchor: 'start', cls: 'hand' });
    out.push({ kind: 'text', x: 108, y: 150, text: 'say it', anchor: 'end', cls: 'hand' });
    out.push({ kind: 'text', x: 184, y: 104, text: 'leave', anchor: 'start', cls: 'hand' });
    out.push({ kind: 'text', x: 186, y: 194, text: 'shame', anchor: 'middle', cls: 'hand' });
    return out;
  },
  label(i, n): Label {
    const p = walk.at(slotsT(SLOTS, i, n));
    if (Math.abs(p.x - SUMMIT.x) < 6) return { x: p.x, y: p.y - 10, anchor: 'middle', hang: 'above' };
    if (p.x < SUMMIT.x) return p.y > FLOOR - 4 ? { x: p.x, y: p.y + 8, anchor: 'middle', hang: 'below' } : { x: p.x - 12, y: p.y - 4, anchor: 'end', hang: 'centre' };
    if (p.y > FLOOR - 4) return { x: p.x, y: p.y + 8, anchor: 'middle', hang: 'below' };
    return { x: p.x + 12, y: p.y - 6, anchor: 'start', hang: 'centre' };
  },
};
