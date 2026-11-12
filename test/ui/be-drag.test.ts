// PLAN-TIERS.md B2: the drag's geometry (src/ui/be/drag.ts), with no browser. A list is laid out here as Be draws it
// while a row is lifted: each tier's heading (a rule's margin above it), its rows (two rules each) and its landing rule;
// then each shelf's word (a rule's margin above it), its landing rule and its rows.
import { describe, it, expect } from 'vitest';
import type { Value } from '../../src/db/schema';
import type { Tiers, ValuePlace } from '../../src/model/values';
import { carry, collapse, edgeSpeed, same, target, whereIs, type Box } from '../../src/ui/be/drag';
import { slots } from '../../src/ui/be/tiers';

const R = 28;
type Spec = { place: ValuePlace; rows: string[] };
/** The boxes of a lifted list: [place, row ids] in run order; rows are 2R, headings, words and rules R, with R above
 *  each heading and each shelf word. Returns the boxes and each row's top by id. */
function lay(specs: Spec[]): { boxes: (Box & { id?: string })[]; top: Record<string, number> } {
  const boxes: (Box & { id?: string })[] = [], top: Record<string, number> = {};
  let y = 0;
  const put = (b: Omit<Box, 'top' | 'bottom'> & { id?: string }, h: number) => { boxes.push({ ...b, top: y, bottom: y + h }); if (b.id) top[b.id] = y; y += h; };
  for (const s of specs) {
    y += R;
    if (typeof s.place === 'number') {
      put({ kind: 'heading', place: s.place }, R);
      for (const id of s.rows) put({ kind: 'row', place: s.place, id }, 2 * R);
      put({ kind: 'land', place: s.place }, R);
    } else {
      put({ kind: 'shelf', place: s.place }, R);
      put({ kind: 'land', place: s.place }, R);
      for (const id of s.rows) put({ kind: 'row', place: s.place, id }, 2 * R);
    }
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
//   heading-3 308..336, land-3 336..364, shelf-resting 392..420, land-resting 420..448,
//   shelf-legacy 476..504, land-legacy 504..532, l 532..588

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

  it('into each shelf: past its word, and over its landing rule, is the shelf\'s head', () => {
    expect(at(LIST, 'b', 405)).toEqual({ to: 3, index: 0 });
    expect(at(LIST, 'b', 407)).toEqual({ to: 'resting', index: 0 });
    expect(at(LIST, 'b', 435)).toEqual({ to: 'resting', index: 0 });
    expect(at(LIST, 'b', 489)).toEqual({ to: 'resting', index: 0 });
    expect(at(LIST, 'b', 491 + 2)).toEqual({ to: 'legacy', index: 0 });
    expect(at(LIST, 'b', 519)).toEqual({ to: 'legacy', index: 0 });
  });

  it('past the foot is the end of the last place', () => {
    expect(at(LIST, 'b', 561)).toEqual({ to: 'legacy', index: 1 });
    expect(at(LIST, 'b', 99999)).toEqual({ to: 'legacy', index: 1 });
    // with nothing on Legacy, past its rule is still Legacy's head
    const bare: Spec[] = [{ place: 1, rows: ['a'] }, { place: 2, rows: [] }, { place: 3, rows: [] }, { place: 'resting', rows: [] }, { place: 'legacy', rows: [] }];
    expect(at(bare, 'a', 99999)).toEqual({ to: 'legacy', index: 0 });
  });

  it('a row carried back from Legacy to a tier', () => {
    // l lifted: the run above it is as before, b among the rows
    const { boxes, top } = lay(LIST);
    const others = boxes.filter(x => x.id !== 'l');
    expect(top.l).toBe(588);
    expect(target(collapse(others, top.l, top.l + 2 * R), 588)).toEqual({ to: 'legacy', index: 0 });
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
  const shape = (x: Tiers, open = { resting: false, legacy: false }) => slots(x, open, true).map(s => (s.kind === 'row' ? `${s.place}:${s.value.id}` : s.key));
  it('every tier ends in its landing rule; both shelves show open, empty or not, each opening with one', () => {
    expect(shape(T({ second: [v('a')] }))).toEqual(['heading-1', 'land-1', 'heading-2', '2:a', 'land-2', 'heading-3', 'land-3', 'shelf-resting', 'land-resting', 'shelf-legacy', 'land-legacy']);
    const s = slots(T({ legacy: [v('l')] }), { resting: false, legacy: false }, true);
    expect(s.filter(x => x.kind === 'shelf').map(x => x.kind === 'shelf' && x.open)).toEqual([true, true]);
    expect(shape(T({ legacy: [v('l')] })).slice(-3)).toEqual(['shelf-legacy', 'land-legacy', 'legacy:l']);
  });
  it('the keys stay unique', () => {
    const keys = slots(T({ first: [v('a')], resting: [v('r')], legacy: [v('l')] }), { resting: true, legacy: false }, true).map(x => x.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
