// The valley (PLAN-FLOWS.md 3.2, Depress): a profile. Ordinary ground (dotted, like the ring's way back), the near
// slope down (Sliding, Pulling in, Head won't stop), the floor (The bottom), the far slope up (A little light,
// Climbing out) drawn exactly as long as the near one, and ordinary ground again. On the floor one dotted arrow runs up
// the inside of the far slope, written "one small thing": the spiral runs outward from one action as surely as inward.
// The truth it draws: an episode has a far side, and the way up starts with doing before feeling. No percentages are
// printed; the shape carries "it ends". The dot rests on the ordinary ground before the slide.
import { arrowHead, type Drawn, type Label, type Shape } from './shape';
import { pieceD, slotsT, walkOf, type Piece } from './walk';

const W = 328, H = 224;
const TOP = 46, FLOOR = 180;

// the near slope and its mirror: the far slope is the near one reflected about the middle, so it is as long
const near: Piece = { from: { x: 46, y: TOP }, c1: { x: 84, y: TOP + 2 }, c2: { x: 100, y: FLOOR - 30 }, to: { x: 128, y: FLOOR }, cls: 'arc' };
const mirror = (p: { x: number; y: number }) => ({ x: W - p.x, y: p.y });
const far: Piece = { from: mirror(near.to), c1: mirror(near.c2!), c2: mirror(near.c1!), to: mirror(near.from), cls: 'arc' };
const pieces: Piece[] = [
  { from: { x: 14, y: TOP }, to: near.from, cls: 'arc pass' },
  near,
  { from: near.to, to: far.from, cls: 'arc' },
  far,
  { from: far.to, to: { x: W - 14, y: TOP }, cls: 'arc pass' },
];
const walk = walkOf(pieces);

// the designed places, by the point each step sits nearest
const SLOTS = [{ x: 70, y: 68 }, { x: 94, y: 112 }, { x: 114, y: 162 }, { x: 164, y: FLOOR }, { x: 214, y: 162 }, { x: 258, y: 68 }].map(walk.tNear);
const REST = walk.tNear({ x: 28, y: TOP });

// the dotted arrow from the floor up the inside of the far slope, and its words in the hand
const UP = { from: { x: 178, y: FLOOR - 8 }, c1: { x: 200, y: 150 }, c2: { x: 216, y: 112 }, to: { x: 226, y: 92 } };

export const valley: Shape = {
  title: 'The valley',
  w: W,
  h: H,
  closed: false,
  at: walk.at,
  slotT: (i, n) => slotsT(SLOTS, i, n),
  restT: () => REST,
  paths(): Drawn[] {
    const out: Drawn[] = pieces.map(p => ({ kind: 'path', d: pieceD(p), cls: p.cls }));
    out.push({ kind: 'path', d: pieceD({ ...UP, cls: '' }), cls: 'arc pass' });
    out.push({ kind: 'path', d: arrowHead(UP.to, -62, 6), cls: 'arrow' });
    out.push({ kind: 'text', x: 164, y: 124, text: 'one small thing', anchor: 'middle', cls: 'hand' });
    return out;
  },
  label(i, n): Label {
    const p = walk.at(slotsT(SLOTS, i, n));
    // the floor's word hangs under it; the near slope's words sit outside it to the left, the far slope's to the right
    if (p.y > FLOOR - 4) return { x: p.x, y: p.y + 8, anchor: 'middle', hang: 'below' };
    return p.x < W / 2 ? { x: p.x - 12, y: p.y + 6, anchor: 'end', hang: 'centre' } : { x: p.x + 12, y: p.y + 6, anchor: 'start', hang: 'centre' };
  },
};
