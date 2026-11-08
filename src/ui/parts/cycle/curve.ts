// The curve (PLAN-FLOWS.md 3.5, What if): worry that faces a known event. A dotted level line, the climb toward the
// thing (Something's coming, What if), the peak the night before, then the drop: straight down the moment the thing
// starts (The thing), and the flat after it (It was fine). On the flat, ten faint marks stand for the record: nine
// drawn checks and one cross, "didn't happen, nine in ten" (LaFreniere and Newman 2020). The truth it draws: the
// worry peaks before the thing, not during it, and the record says the thing was mostly fine.
// The dot walks the curve; it rests on the level line before the climb.
//
// Your own stamps (F6, PLAN-FLOWS.md 3.7): curveWith(outcomes) is the same curve with his marks on the flat in place
// of the seeded ten, oldest leftmost, a check for "didn't happen" and a cross for "happened". The seeded marks are
// print (a fact from a study), never a count of his, and they carry no digit.
import { arrowHead, type Drawn, type Label, type Shape } from './shape';
import { pieceD, slotsT, walkOf, type Piece } from './walk';

const W = 328, H = 224;
const BASE = 180;
const PEAK = { x: 204, y: 48 };
/** The drop: the foot of the near-vertical fall, where the flat after begins. */
const FOOT = { x: 210, y: BASE };

const climb: Piece = { from: { x: 34, y: BASE }, c1: { x: 120, y: BASE - 2 }, c2: { x: 160, y: PEAK.y + 6 }, to: PEAK, cls: 'arc' };
const drop: Piece = { from: PEAK, to: FOOT, cls: 'arc' };
const pieces: Piece[] = [
  { from: { x: 14, y: BASE }, to: climb.from, cls: 'arc pass' },
  climb,
  drop,
  { from: FOOT, to: { x: 300, y: BASE }, cls: 'arc' },
  { from: { x: 300, y: BASE }, to: { x: W - 12, y: BASE }, cls: 'arc pass' },
];
const walk = walkOf(pieces);

const SLOTS = [{ x: 64, y: BASE - 2 }, { x: 140, y: 120 }, { x: PEAK.x - 6, y: PEAK.y + 2 }, { x: 207, y: 88 }, { x: 278, y: BASE }].map(walk.tNear);
const REST = walk.tNear({ x: 22, y: BASE });

/** An outcome stamped on the flat: a check for "didn't happen", a cross for "happened" (episodes.prediction). */
export type Stamp = 'didnt' | 'happened';
/** Where the stamps sit: two rows of five on the flat after the thing, oldest leftmost, top row first. */
export const STAMPS = { x0: 228, dx: 18, rows: [154, 168], perRow: 5, max: 10 } as const;
/** The record the seed carries: nine in ten logged worries didn't happen. */
export const SEEDED: Stamp[] = ['didnt', 'didnt', 'didnt', 'didnt', 'didnt', 'didnt', 'happened', 'didnt', 'didnt', 'didnt'];

/** The marks for these outcomes (the newest ten), drawn in print; `cls` adds 'faint' for the seeded record. */
export function stampMarks(outcomes: Stamp[], cls = 'stamp'): Drawn[] {
  return outcomes.slice(-STAMPS.max).map((o, i) => {
    const x = STAMPS.x0 + (i % STAMPS.perRow) * STAMPS.dx, y = STAMPS.rows[Math.floor(i / STAMPS.perRow)];
    const d = o === 'didnt' ? `M${x} ${y} L${x + 3.5} ${y + 4} L${x + 10.5} ${y - 5}` : `M${x} ${y - 5} L${x + 9} ${y + 4} M${x + 9} ${y - 5} L${x} ${y + 4}`;
    return { kind: 'path', d, cls };
  });
}

/** The curve with these outcomes on its flat; with none, the seeded nine in ten, faint. */
export function curveWith(outcomes: Stamp[] = []): Shape {
  const own = outcomes.length > 0;
  return {
    title: 'The curve',
    w: W,
    h: H,
    closed: false,
    at: walk.at,
    slotT: (i, n) => slotsT(SLOTS, i, n),
    restT: () => REST,
  // the page's middle (F2's clock and hold), above the climb, clear of it
  mid: { x: 80, y: 70 },
    paths(): Drawn[] {
      const out: Drawn[] = [{ kind: 'path', d: `M14 ${BASE} L${W - 12} ${BASE}`, cls: 'arc faint' }];
      out.push(...pieces.map((p): Drawn => ({ kind: 'path', d: pieceD(p), cls: p.cls })));
      // the drop's direction, drawn once at its foot: straight down, the moment the thing starts
      out.push({ kind: 'path', d: arrowHead({ x: FOOT.x - 0.3, y: FOOT.y - 18 }, 92, 5), cls: 'arrow' });
      out.push(...stampMarks(own ? outcomes : SEEDED, own ? 'stamp' : 'stamp faint-stamp'));
      if (!own) {
        out.push({ kind: 'text', x: 264, y: 124, text: "didn't happen,", anchor: 'middle', cls: 'hand' });
        out.push({ kind: 'text', x: 264, y: 140, text: 'nine in ten', anchor: 'middle', cls: 'hand' });
      }
      return out;
    },
    label(i, n): Label {
      const p = walk.at(slotsT(SLOTS, i, n));
      // on the level line the words hang under it; on the climb they sit outside it, to the left; the peak's above;
      // the drop's to its right
      if (p.y > BASE - 6) return p.x < PEAK.x ? { x: p.x - 18, y: p.y + 8, anchor: 'start', hang: 'below' } : { x: p.x, y: p.y + 8, anchor: 'middle', hang: 'below' };
      if (p.y < PEAK.y + 12) return { x: p.x, y: p.y - 10, anchor: 'middle', hang: 'above' };
      if (p.x > PEAK.x) return { x: p.x + 12, y: p.y, anchor: 'start', hang: 'centre' };
      return { x: p.x - 12, y: p.y - 4, anchor: 'end', hang: 'centre' };
    },
  };
}

export const curve: Shape = curveWith();
