// The landing arc (PLAN-FLOWS.md 3.3, Energize): a baseline (ordinary, dotted); the arc climbs from the spark to a
// crest; from just past the crest two paths go down. One glides back to the baseline, "land"; the other drops below
// the line and curves back up to it, "crash". Both reach the line. The truth it draws: the energy ends either way,
// what you do at the crest picks the path, and even the crash curves back. Drawn without numbers: the inverted U is a
// picture, not a law.
// The dot walks the landing path (the steps sit on it: Spark and Build on the climb, Locked in at the crest's near
// side, The tip just past it, Landing on the glide); the crash is drawing. It rests on the baseline before the spark.
import type { Drawn, Label, Shape } from './shape';
import { pieceD, slotsT, walkOf, type Piece } from './walk';

const W = 328, H = 224;
const BASE = 172;
const CREST = { x: 146, y: 42 };

const climb: Piece = { from: { x: 44, y: BASE }, c1: { x: 86, y: BASE - 2 }, c2: { x: 104, y: CREST.y + 2 }, to: CREST, cls: 'arc' };
const land: Piece = { from: CREST, c1: { x: 196, y: CREST.y - 4 }, c2: { x: 226, y: BASE - 2 }, to: { x: 272, y: BASE }, cls: 'arc' };
const pieces: Piece[] = [
  { from: { x: 14, y: BASE }, to: climb.from, cls: 'arc pass' },
  climb,
  land,
  { from: land.to, to: { x: W - 12, y: BASE }, cls: 'arc pass' },
];
const walk = walkOf(pieces);

/** Where the crash leaves the landing path: just past the crest, where The tip sits. */
const FORK_T = walk.tNear({ x: 176, y: 48 });
const fork = walk.at(FORK_T);
const crash: Piece = { from: fork, c1: { x: 196, y: 80 }, c2: { x: 196, y: 206 }, to: { x: 240, y: 206 }, cls: 'arc pass' };
const crashBack: Piece = { from: crash.to, c1: { x: 276, y: 206 }, c2: { x: 296, y: 186 }, to: { x: 306, y: BASE }, cls: 'arc pass' };

const SLOTS = [{ x: 74, y: 160 }, { x: 102, y: 100 }, { x: 132, y: 44 }, fork, { x: 222, y: 120 }].map(walk.tNear);
const REST = walk.tNear({ x: 26, y: BASE });

export const arc: Shape = {
  title: 'The landing arc',
  w: W,
  h: H,
  closed: false,
  at: walk.at,
  slotT: (i, n) => slotsT(SLOTS, i, n),
  restT: () => REST,
  paths(): Drawn[] {
    const out: Drawn[] = pieces.map(p => ({ kind: 'path', d: pieceD(p), cls: p.cls }));
    out.push({ kind: 'path', d: pieceD(crash), cls: crash.cls }, { kind: 'path', d: pieceD(crashBack), cls: crashBack.cls });
    out.push({ kind: 'text', x: 292, y: BASE - 10, text: 'land', anchor: 'middle', cls: 'hand' });
    out.push({ kind: 'text', x: 240, y: 222, text: 'crash, and back', anchor: 'middle', cls: 'hand' });
    return out;
  },
  label(i, n): Label {
    const t = slotsT(SLOTS, i, n), p = walk.at(t);
    if (Math.abs(p.x - CREST.x) < 20 && p.y < CREST.y + 12) return { x: p.x - 4, y: p.y - 10, anchor: 'middle', hang: 'above' };
    // on the climb the words sit outside it, to the left; past the crest, to the right of the glide
    return p.x < CREST.x ? { x: p.x - 12, y: p.y - 4, anchor: 'end', hang: 'centre' } : { x: p.x + 12, y: p.y - 6, anchor: 'start', hang: 'centre' };
  },
};
