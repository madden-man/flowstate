// PLAN-TIERS.md B2: the drag's geometry (src/ui/be/drag.ts), with no browser. A list is laid out here as Be draws it
// while a row is lifted: for each place (PLAN-FOLDS.md G2: the shelves as the tiers) its heading (a rule's margin above
// it), then, open, its rows (two rules each) and its landing rule, its foot; folded, the heading alone.
import { describe, it, expect } from 'vitest';
import type { Value } from '../../src/db/schema';
import type { Tiers, ValuePlace } from '../../src/model/values';
import { aim, carry, collapse, edgeSpeed, fingerOn, same, target, whereIs, type Box } from '../../src/ui/be/drag';
import { slots } from '../../src/ui/be/tiers';

const R = 28;
type Spec = { place: ValuePlace; rows: string[]; folded?: boolean };
/** The boxes of a lifted list: [place, row ids] in run order; rows are 2R, headings, words and rules R, with R above
 *  each heading and each shelf word. Returns the boxes and each row's top by id. */
function lay(specs: Spec[]): { boxes: (Box & { id?: string })[]; top: Record<string, number> } {
  const boxes: (Box & { id?: string })[] = [], top: Record<string, number> = {};
  let y = 0;
  const put = (b: Omit<Box, 'top' | 'bottom'> & { id?: string }, h: number) => { boxes.push({ ...b, top: y, bottom: y + h }); if (b.id) top[b.id] = y; y += h; };
  for (const s of specs) {
    y += R;
    if (s.folded) { put({ kind: 'heading', place: s.place, folded: true }, R); continue; }
    put({ kind: 'heading', place: s.place }, R);
    for (const id of s.rows) put({ kind: 'row', place: s.place, id }, 2 * R);
    put({ kind: 'land', place: s.place }, R);
  }
  return { boxes, top };
}
/** The lifted row id at its top edge t: the others, collapsed, and where it goes. */
function at(specs: Spec[], id: string, t: number) {
  const { boxes, top } = lay(specs);
  const others = boxes.filter(b => b.id !== id);
  return target(collapse(others, top[id], top[id] + 2 * R), t);
}
const LIST: Spec[] = [
  { place: 1, rows: [] }, { place: 2, rows: ['a', 'b', 'c'] }, { place: 3, rows: [] },
  { place: 'resting', rows: [] }, { place: 'legacy', rows: ['l'] },
];
// with 'b' lifted and collapsed out, the run on the content axis is:
//   heading-1 28..56, land-1 56..84, heading-2 112..140, a 140..196, c 196..252, land-2 252..280,
//   heading-3 308..336, land-3 336..364, heading-resting 392..420, land-resting 420..448,
//   heading-legacy 476..504, l 504..560, land-legacy 560..588

describe('the lifted row goes where its top edge has passed the middles of the slots', () => {
  it('at rest it stays where it is', () => {
    expect(at(LIST, 'b', 196)).toEqual({ to: 2, index: 1 });
  });

  it('above the first heading is the head of First', () => {
    expect(at(LIST, 'b', -500)).toEqual({ to: 1, index: 0 });
    expect(at(LIST, 'b', 41)).toEqual({ to: 1, index: 0 });
  });

  it('past First\'s heading, and over its landing rule, is First (empty, so index 0)', () => {
    expect(at(LIST, 'b', 43)).toEqual({ to: 1, index: 0 });
    expect(at(LIST, 'b', 71)).toEqual({ to: 1, index: 0 });
  });

  it('between tiers: past First\'s rule it is still First\'s foot until it passes Second\'s heading', () => {
    expect(at(LIST, 'b', 100)).toEqual({ to: 1, index: 0 });
    expect(at(LIST, 'b', 125)).toEqual({ to: 1, index: 0 });
    expect(at(LIST, 'b', 127)).toEqual({ to: 2, index: 0 });
  });

  it('within a place the index leaves the moved row out', () => {
    // past a (middle 168) and not yet c (middle 224): index 1, its own place
    expect(at(LIST, 'b', 169)).toEqual({ to: 2, index: 1 });
    expect(at(LIST, 'b', 167)).toEqual({ to: 2, index: 0 });
    // past c: the foot of Second, index 2 (two others), over Second's rule too
    expect(at(LIST, 'b', 225)).toEqual({ to: 2, index: 2 });
    expect(at(LIST, 'b', 267)).toEqual({ to: 2, index: 2 });
    // a carried from the head: past b, index 1 among b and c
    const { boxes, top } = lay(LIST);
    const others = boxes.filter(x => x.id !== 'a');
    expect(target(collapse(others, top.a, top.a + 2 * R), 140 + 29)).toEqual({ to: 2, index: 1 });
  });

  it('into an empty tier\'s landing rule: Third, index 0', () => {
    expect(at(LIST, 'b', 323)).toEqual({ to: 3, index: 0 });
    expect(at(LIST, 'b', 351)).toEqual({ to: 3, index: 0 });
  });

  it('into each open shelf: past its heading is its head; its landing rule is its foot, as a tier\'s is (G2)', () => {
    expect(at(LIST, 'b', 405)).toEqual({ to: 3, index: 0 });
    expect(at(LIST, 'b', 407)).toEqual({ to: 'resting', index: 0 });
    expect(at(LIST, 'b', 435)).toEqual({ to: 'resting', index: 0 });
    expect(at(LIST, 'b', 489)).toEqual({ to: 'resting', index: 0 });
    expect(at(LIST, 'b', 493)).toEqual({ to: 'legacy', index: 0 });
    expect(at(LIST, 'b', 531)).toEqual({ to: 'legacy', index: 0 });
    // past l, and over Legacy's rule: its foot, after l
    expect(at(LIST, 'b', 533)).toEqual({ to: 'legacy', index: 1 });
    expect(at(LIST, 'b', 575)).toEqual({ to: 'legacy', index: 1 });
  });

  it('past the foot is the end of the last place', () => {
    expect(at(LIST, 'b', 561)).toEqual({ to: 'legacy', index: 1 });
    expect(at(LIST, 'b', 99999)).toEqual({ to: 'legacy', index: 1 });
    // with nothing on Legacy, past its rule is its foot, which is its head
    const bare: Spec[] = [{ place: 1, rows: ['a'] }, { place: 2, rows: [] }, { place: 3, rows: [] }, { place: 'resting', rows: [] }, { place: 'legacy', rows: [] }];
    expect(at(bare, 'a', 99999)).toEqual({ to: 'legacy', index: 0 });
  });

  it('a row carried back from Legacy to a tier', () => {
    // l lifted: the run above it is as before, b among the rows
    const { boxes, top } = lay(LIST);
    const others = boxes.filter(x => x.id !== 'l');
    expect(top.l).toBe(560);
    expect(target(collapse(others, top.l, top.l + 2 * R), 560)).toEqual({ to: 'legacy', index: 0 });
    // up to Second's foot (c: 252..308, its middle 280; Second's rule 308..336, middle 322)
    expect(target(collapse(others, top.l, top.l + 2 * R), 300)).toEqual({ to: 2, index: 3 });
    expect(target(collapse(others, top.l, top.l + 2 * R), 279)).toEqual({ to: 2, index: 2 });
  });

  it('collapse moves up only what lies below the lifted row', () => {
    const b: Box[] = [{ kind: 'heading', place: 1, top: 0, bottom: 28 }, { kind: 'row', place: 1, top: 84, bottom: 140 }];
    expect(collapse(b, 28, 84)).toEqual([b[0], { ...b[1], top: 28, bottom: 84 }]);
  });

  it('it never rocks: half a row each way from where it sits', () => {
    // b sits at index 1 with its top at 196 (collapsed); it must travel past c's middle (224) to move on
    for (const t of [170, 196, 223]) expect(at(LIST, 'b', t)).toEqual({ to: 2, index: 1 });
  });
});

describe('folded places keep their fold under a lift (PLAN-FOLDS.md G2)', () => {
  // First open over a, Second folded (its two rows are not drawn), Third open over b, both shelves folded and empty.
  // Drawn as it is with b lifted: heading-1 28..56, a 56..112, land-1 112..140, heading-2~ 168..196, heading-3 224..252,
  // b 252..308, land-3 308..336, heading-resting~ 364..392, heading-legacy~ 420..448. Collapsed (b out, 56 up from 308):
  // land-3 252..280, heading-resting~ 308..336, heading-legacy~ 364..392.
  const F: Spec[] = [
    { place: 1, rows: ['a'] }, { place: 2, rows: [], folded: true }, { place: 3, rows: ['b'] },
    { place: 'resting', rows: [], folded: true }, { place: 'legacy', rows: [], folded: true },
  ];
  const feet = (p: ValuePlace) => (p === 1 ? 1 : p === 2 ? 2 : 0);
  const { boxes, top } = lay(F);
  const others = boxes.filter(b => b.id !== 'b');
  const edge = (t: number) => target(collapse(others, top.b, top.b + 2 * R), t, feet);
  const lift = { top: top.b, bottom: top.b + 2 * R, place: 3 as ValuePlace, infold: false };

  it('the gap under a folded heading is its foot, approached from above', () => {
    expect(edge(181)).toEqual({ to: 1, index: 1 });
    expect(edge(183)).toEqual({ to: 2, index: 2 });
  });

  it('and from below, until the top edge passes the next heading\'s middle', () => {
    expect(edge(237)).toEqual({ to: 2, index: 2 });
    expect(edge(239)).toEqual({ to: 3, index: 0 });
  });

  it('a finger on a folded line is in that place, its foot, whatever the top edge says', () => {
    // the top edge is over First, the finger on Second's line
    expect(aim(others, lift, 140, 180, feet)).toEqual({ to: 2, index: 2 });
    // off the line, the top edge decides
    expect(aim(others, lift, 140, 160, feet)).toEqual({ to: 1, index: 1 });
  });

  it('the finger is tested against the heading where it is drawn, not where it would lie collapsed', () => {
    // Resting's line is drawn at 364..392 (it lies at 308..336 collapsed)
    expect(aim(others, lift, 300, 370, feet)).toEqual({ to: 'resting', index: 0 });
    expect(fingerOn(others, 320)).toBeNull();
    expect(fingerOn(others, 430)).toBe('legacy');
    // an open heading is no folded line
    expect(fingerOn(others, 30)).toBeNull();
  });

  it('riding under a folded heading, its own slot counts as that line, so a still finger is not let go', () => {
    // b drawn under Second's line, one rule: 196..224
    expect(fingerOn(others, 210, { place: 2, bottom: 224 })).toBe(2);
    expect(fingerOn(others, 210, { place: 3, bottom: 224 })).toBeNull();
    expect(fingerOn(others, 210)).toBeNull();
  });

  it('with First folded, above everything is First\'s foot', () => {
    const G: Spec[] = [{ place: 1, rows: [], folded: true }, { place: 2, rows: ['c', 'd'] }];
    const g = lay(G);
    const o = g.boxes.filter(b => b.id !== 'd');
    const f = (p: ValuePlace) => (p === 1 ? 3 : 1);
    expect(target(collapse(o, g.top.d, g.top.d + 2 * R), -500, f)).toEqual({ to: 1, index: 3 });
    expect(target(collapse(o, g.top.d, g.top.d + 2 * R), 43, f)).toEqual({ to: 1, index: 3 });
  });

  it('with nothing folded, feet change nothing', () => {
    const { boxes: b2, top: t2 } = lay(LIST);
    const o = b2.filter(b => b.id !== 'b');
    const f = (p: ValuePlace) => (p === 2 ? 2 : p === 'legacy' ? 1 : 0);
    for (const t of [-500, 43, 127, 169, 225, 323, 407, 435, 533, 99999]) {
      expect(target(collapse(o, t2.b, t2.b + 2 * R), t, f)).toEqual(target(collapse(o, t2.b, t2.b + 2 * R), t));
    }
  });
});

describe('the edges', () => {
  const sp = (y: number) => edgeSpeed(y, 100, 700, 88, 14);
  it('nothing away from the edges', () => {
    expect(sp(188)).toBe(0);
    expect(sp(400)).toBe(0);
    expect(sp(612)).toBe(0);
  });
  it('up near the top, down near the bottom, faster nearer the edge, never past the most', () => {
    expect(sp(187)).toBeLessThan(0);
    expect(sp(613)).toBeGreaterThan(0);
    expect(Math.abs(sp(110))).toBeGreaterThan(Math.abs(sp(170)));
    expect(sp(690)).toBeGreaterThan(sp(630));
    expect(sp(100)).toBe(-14);
    expect(sp(40)).toBe(-14);
    expect(sp(800)).toBe(14);
  });
  it('a short list splits its height between the two bands', () => {
    expect(edgeSpeed(150, 100, 200, 88, 14)).toBe(0);
    expect(edgeSpeed(149, 100, 200, 88, 14)).toBeLessThan(0);
    expect(edgeSpeed(0, 0, 0, 88, 14)).toBe(0);
  });
});

const v = (id: string, over: Partial<Value> = {}): Value =>
  ({ id, createdAt: 1, updatedAt: 1, status: 'held', word: id, champions: [], revisions: [], ...over });
const T = (over: Partial<Tiers> = {}): Tiers => ({ first: [], second: [], third: [], resting: [], legacy: [], ...over });

describe('carrying', () => {
  const t = T({ second: [v('a'), v('b'), v('c')], legacy: [v('l', { status: 'legacy' })] });
  it('takes the row from its place and puts it at the target, the others in order', () => {
    const ids = (x: Tiers) => [x.first, x.second, x.third, x.resting, x.legacy].map(r => r.map(y => y.id).join(''));
    expect(ids(carry(t, 'b', { to: 1, index: 0 }))).toEqual(['b', 'ac', '', '', 'l']);
    expect(ids(carry(t, 'b', { to: 2, index: 2 }))).toEqual(['', 'acb', '', '', 'l']);
    expect(ids(carry(t, 'a', { to: 'legacy', index: 1 }))).toEqual(['', 'bc', '', '', 'la']);
    expect(ids(carry(t, 'l', { to: 3, index: 9 }))).toEqual(['', 'abc', 'l', '', '']);
    expect(carry(t, 'nobody', { to: 1, index: 0 })).toBe(t);
  });
  it('knows where a value is', () => {
    expect(whereIs(t, 'c')).toEqual({ to: 2, index: 2 });
    expect(whereIs(t, 'l')).toEqual({ to: 'legacy', index: 0 });
    expect(whereIs(t, 'x')).toBeNull();
    expect(same({ to: 2, index: 1 }, { to: 2, index: 1 })).toBe(true);
    expect(same({ to: 2, index: 1 }, { to: 3, index: 1 })).toBe(false);
  });
});

describe('the slots while a row is lifted', () => {
  const shape = (x: Tiers, folded: Parameters<typeof slots>[1], lifted: string) =>
    slots(x, folded, lifted).map(s => (s.kind === 'row' ? `${s.place}:${s.value.id}${s.infold ? '^' : ''}` : s.kind === 'heading' && s.folded ? `${s.key}~` : s.key));
  it('every place keeps its fold; every open place ends in its landing rule; both shelves show, empty or not', () => {
    expect(shape(T({ second: [v('a')] }), {}, 'a')).toEqual(['heading-1', 'land-1', 'heading-2', '2:a', 'land-2', 'heading-3', 'land-3', 'heading-resting~', 'heading-legacy~']);
    expect(shape(T({ second: [v('a')] }), { resting: false, legacy: false }, 'a').slice(-4)).toEqual(['heading-resting', 'land-resting', 'heading-legacy', 'land-legacy']);
  });
  it('an open shelf\'s landing rule is at its foot, as a tier\'s', () => {
    expect(shape(T({ first: [v('a')], legacy: [v('l')] }), { legacy: false }, 'a').slice(-3)).toEqual(['heading-legacy', 'legacy:l', 'land-legacy']);
  });
  it('a folded place is its heading alone, rows or none, unless the lifted row rides there: then that row alone', () => {
    const t = T({ first: [v('a')], second: [v('x'), v('y')] });
    expect(shape(t, { '2': true }, 'a')).toEqual(['heading-1', '1:a', 'land-1', 'heading-2~', 'heading-3', 'land-3', 'heading-resting~', 'heading-legacy~']);
    // a carried to Second's foot (drag.ts carry), Second folded
    const c = T({ second: [v('x'), v('y'), v('a')] });
    expect(shape(c, { '2': true }, 'a')).toEqual(['heading-1', 'land-1', 'heading-2~', '2:a^', 'heading-3', 'land-3', 'heading-resting~', 'heading-legacy~']);
    // every place folded and the row riding on Legacy
    const all = { '1': true, '2': true, '3': true, resting: true, legacy: true };
    expect(shape(T({ legacy: [v('a')] }), all, 'a')).toEqual(['heading-1~', 'heading-2~', 'heading-3~', 'heading-resting~', 'heading-legacy~', 'legacy:a^']);
  });
  it('the keys stay unique', () => {
    const keys = slots(T({ first: [v('a')], resting: [v('r')], legacy: [v('l')] }), { resting: false }, 'a').map(x => x.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
