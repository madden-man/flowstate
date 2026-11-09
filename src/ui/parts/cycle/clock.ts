// The clock (PLAN-FLOWS.md 3.5, the 3 a.m. night): a face from 11 at night round to 7 in the morning. The night is
// dotted (asleep); the awake stretch from 3 is a thick arc (Awake again, What time is it, Lying there); an arrow
// goes out of bed (Up), a dotted way comes back when sleepy, and 7 is a pinned dot (Same alarm). The day side of
// the face is faint. The face has hour ticks and no hands, and only the 12 is a numeral (class num, so Still shows
// none). The truth it draws: the morning is fixed whatever the night does, and the bed is for sleeping, not trying.
// The dot rests just after 11, asleep, and walks the night to 7.
import { arrowHead, type Drawn, type Label, type Shape } from './shape';
import { piecesD, pieceD, slotsT, walkOf, type Piece } from './walk';

const W = 328, H = 224;
const C = { x: 150, y: 112 }, R = 82;
/** The point at clock time h (hours, 0 to 24; 12 at the top), on a circle of radius r. */
const at = (h: number, r = R) => {
  const a = ((h % 12) / 12) * 2 * Math.PI - Math.PI / 2;
  return { x: C.x + r * Math.cos(a), y: C.y + r * Math.sin(a) };
};
/** An arc of the face from h0 to h1 (h1 later, may pass 12), as short lines. */
const arcOf = (h0: number, h1: number, cls: string): Piece[] => {
  const n = Math.max(2, Math.round((h1 - h0) * 12));
  return Array.from({ length: n }, (_, i) => ({ from: at(h0 + ((h1 - h0) * i) / n), to: at(h0 + ((h1 - h0) * (i + 1)) / n), cls }));
};

const AWAKE = 3, UP = 4.25, BACK = 5.6, ALARM = 7;
const asleep = arcOf(11, 12 + AWAKE, 'arc pass');
const awake = arcOf(12 + AWAKE, 12 + UP, 'arc thick');
const outOfBed = at(UP), upTo = { x: 252, y: 206 };
const up: Piece = { from: outOfBed, to: upTo, cls: 'arc' };
const back: Piece = { from: upTo, c1: { x: 226, y: 218 }, c2: { x: 206, y: 206 }, to: at(BACK), cls: 'arc pass' };
const morning = arcOf(BACK, ALARM, 'arc pass');
const pieces: Piece[] = [...asleep, ...awake, up, back, ...morning];
const walk = walkOf(pieces, 12);

const SLOTS = [at(AWAKE), at(3.58), at(UP - 0.03), { x: upTo.x - 4, y: upTo.y - 6 }, at(ALARM)].map(walk.tNear);
const REST = walk.tNear(at(11.4));

export const clock: Shape = {
  title: 'The clock',
  w: W,
  h: H,
  closed: false,
  at: walk.at,
  slotT: (i, n) => slotsT(SLOTS, i, n),
  restT: () => REST,
  // the page's middle (F2's clock and hold), high inside the face, above the awake arc's words
  mid: { x: C.x, y: C.y - 30 },
  // the stream (M5): the night's water moves in ticks, a second apart
  stream: () => ({ ticks: true }),
  paths(): Drawn[] {
    const out: Drawn[] = [
      // the day side of the face, faint: not part of the night
      { kind: 'path', d: piecesD(arcOf(ALARM, 11, 'arc faint')), cls: 'arc faint' },
      { kind: 'path', d: piecesD(asleep), cls: 'arc pass' },
      { kind: 'path', d: piecesD(awake), cls: 'arc thick' },
      { kind: 'path', d: pieceD(up), cls: 'arc' },
      { kind: 'path', d: arrowHead(upTo, (Math.atan2(upTo.y - outOfBed.y, upTo.x - outOfBed.x) * 180) / Math.PI, 6), cls: 'arrow' },
      { kind: 'path', d: pieceD(back), cls: 'arc pass' },
      { kind: 'path', d: piecesD(morning), cls: 'arc pass' },
    ];
    // the hour ticks, inside the face; no hands
    for (let h = 0; h < 12; h++) { const a = at(h, R - 4), b = at(h, R - 9); out.push({ kind: 'path', d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`, cls: 'arc faint-tick' }); }
    const twelve = at(0, R - 22);
    out.push({ kind: 'text', x: twelve.x, y: twelve.y + 4, text: '12', anchor: 'middle', cls: 'print num' });
    // 7, pinned: a drawn pin through the face at seven (a stake out from the rim, a filled head), and "7" in the hand
    // inside the rim (num: Still drops the digit and keeps the pin). The step's own mark sits on the rim, so the pin
    // stands just outside it and is never covered.
    const rim = at(ALARM, R + 3), head = at(ALARM, R + 15), seven = at(ALARM, R - 18);
    out.push({ kind: 'path', d: `M${rim.x.toFixed(1)} ${rim.y.toFixed(1)} L${head.x.toFixed(1)} ${head.y.toFixed(1)}`, cls: 'arc pin-stake' });
    out.push({ kind: 'path', d: `M${(head.x - 4).toFixed(1)} ${head.y.toFixed(1)} a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0`, cls: 'pin' });
    out.push({ kind: 'text', x: seven.x, y: seven.y + 5, text: '7', anchor: 'middle', cls: 'hand num' });
    out.push({ kind: 'text', x: (upTo.x + at(BACK).x) / 2 - 8, y: 222, text: 'back when sleepy', anchor: 'middle', cls: 'hand' });
    return out;
  },
  label(i, n): Label {
    const p = walk.at(slotsT(SLOTS, i, n));
    // five steps, as designed: waking's word above and outside the face, the clock-check's outside, the lying-awake
    // inside (the arrow out of bed leaves outward, so its word must not), Up beside the arrow's end, the alarm's
    // outside to the left
    if (n === SLOTS.length) {
      return [
        { x: p.x + 8, y: p.y - 8, anchor: 'start', hang: 'above' },
        { x: p.x + 12, y: p.y, anchor: 'start', hang: 'centre' },
        { x: p.x - 21, y: p.y - 2, anchor: 'end', hang: 'centre' },
        { x: p.x + 12, y: p.y - 4, anchor: 'start', hang: 'centre' },
        { x: p.x - 18, y: p.y - 4, anchor: 'end', hang: 'centre' },
      ][i] as Label;
    }
    // any other count: the words alternate outside and inside the face so they never sit on each other
    if (p.y > C.y + R) return { x: p.x + 12, y: p.y - 4, anchor: 'start', hang: 'centre' };
    return i % 2 ? { x: p.x - 12, y: p.y + 2, anchor: 'end', hang: 'centre' } : { x: p.x + 12, y: p.y + 2, anchor: 'start', hang: 'centre' };
  },
};
