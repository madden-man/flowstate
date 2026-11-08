// The stairs (PLAN-FLOWS.md 3.5, Shutdown): going still, foggy or far away under overload. A staircase down, three
// treads (Too much, Stuck, Far away: alert, frozen, far away, the defense cascade's order, Kozlowska 2015), then a
// long gentle ramp back up, written "thaw" in the hand (Thawing). The truth it draws: the drop is a brake the body
// pulled, a step at a time, and the way back is gradual, not another fall. The dot rests on the level ground before
// the first step down and walks the treads and the ramp.
import type { Drawn, Label, Shape } from './shape';
import { pieceD, slotsT, walkOf, type Piece } from './walk';

const W = 328, H = 224;
const TOP = 60, RISE = 46, TREAD = 48, X0 = 30;
/** The treads, left to right: each a level line at its height. */
const treads = [0, 1, 2].map(k => ({ x0: X0 + k * TREAD, x1: X0 + (k + 1) * TREAD, y: TOP + k * RISE }));
const pieces: Piece[] = [{ from: { x: 12, y: TOP }, to: { x: X0, y: TOP }, cls: 'arc pass' }];
treads.forEach((t, k) => {
  pieces.push({ from: { x: t.x0, y: t.y }, to: { x: t.x1, y: t.y }, cls: 'arc' });
  if (k < 2) pieces.push({ from: { x: t.x1, y: t.y }, to: { x: t.x1, y: t.y + RISE }, cls: 'arc' });
});
const low = treads[2];
// the ramp: long and shallower than the stairs, most of the way back up; the rest is ordinary ground
const RAMP_END = { x: 306, y: TOP + 24 };
const ramp: Piece = { from: { x: low.x1, y: low.y }, c1: { x: low.x1 + 30, y: low.y - 6 }, c2: { x: RAMP_END.x - 40, y: RAMP_END.y + 14 }, to: RAMP_END, cls: 'arc' };
pieces.push(ramp, { from: RAMP_END, to: { x: W - 10, y: RAMP_END.y - 2 }, cls: 'arc pass' });
const walk = walkOf(pieces);

const mid = (t: { x0: number; x1: number; y: number }) => ({ x: (t.x0 + t.x1) / 2, y: t.y });
const SLOTS = [...treads.map(mid), { x: 262, y: 104 }].map(walk.tNear);
const REST = walk.tNear({ x: 18, y: TOP });

export const stairs: Shape = {
  title: 'The stairs',
  w: W,
  h: H,
  closed: false,
  at: walk.at,
  slotT: (i, n) => slotsT(SLOTS, i, n),
  restT: () => REST,
  // the page's middle (F2's clock and hold), under the stairs
  mid: { x: 72, y: 176 },
  paths(): Drawn[] {
    const out: Drawn[] = [];
    // consecutive pieces of one class drawn as one path
    let run: Piece[] = [];
    const flush = () => { if (run.length) out.push({ kind: 'path', d: run.map(p => pieceD(p)).join(' '), cls: run[0].cls }); run = []; };
    for (const p of pieces) { if (run.length && run[0].cls !== p.cls) flush(); run.push(p); }
    flush();
    // the cascade's words under the first two treads, and the ramp's
    out.push({ kind: 'text', x: mid(treads[0]).x, y: TOP + 22, text: 'alert', anchor: 'middle', cls: 'hand' });
    out.push({ kind: 'text', x: mid(treads[1]).x, y: TOP + RISE + 22, text: 'frozen', anchor: 'middle', cls: 'hand' });
    out.push({ kind: 'text', x: 262, y: 136, text: 'thaw', anchor: 'middle', cls: 'hand' });
    return out;
  },
  label(i, n): Label {
    const p = walk.at(slotsT(SLOTS, i, n));
    // a tread's word stands on it; the ramp's sits above it, to the left
    if (p.x <= treads[0].x1) return { x: p.x, y: p.y - 8, anchor: 'middle', hang: 'above' };
    // a lower tread's word starts past the riser above it, so the two never cross
    if (p.x <= low.x1 + 2) return { x: p.x - TREAD / 2 + 6, y: p.y - 8, anchor: 'start', hang: 'above' };
    return { x: p.x - 12, y: p.y - 10, anchor: 'end', hang: 'centre' };
  },
};
