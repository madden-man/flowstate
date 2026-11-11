// @vitest-environment jsdom
// In the place (PLAN-TASKS.md T2): each in-place touch drawn in its material, what it keeps and what it does not, and
// the water's answer (section 5): a share of the pool above the sign let go as one surge, the gate asking, the
// mountain owed its surge once, and nothing in Still, through the door or under Reduce Motion.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { LocationProvider } from 'preact-iso';
import { freshDB } from '../db/helpers';
import { lock, setKey } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { Touches } from '../../src/ui/flow/chakra/Touches';
import { onTouchDone, type TouchDone } from '../../src/ui/flow/chakra/touch';
import {
  SHARE, FLOOR, POOL_FILL, aboveOf, answer, asking, asks, forgetSurges, letGo, owedNow, pooledAt, refill, settle, surge, takeOwed,
} from '../../src/ui/flow/chakra/surge';
import { clearedAfter, RANGES } from '../../src/ui/flow/chakra/handlers/placeThirdEye';
import { stirAfter, stoneOf } from '../../src/ui/flow/chakra/handlers/placeHeart';
import { STONES } from '../../src/ui/flow/chakra/handlers/placeRoot';
import { marksOf, basicsToday, writeMark } from '../../src/model/acts';
import { reach, spring, type ChakraId } from '../../src/model/mountain';
import { still } from '../../src/ui/light';
import { Water } from '../../src/ui/flow/mountain/water';

const reading = (value: number) => ({ id: 'r', at: Date.now(), of: 'heart' as const, value });
const readingsWith = (gates: Partial<Record<ChakraId, number>>, d = 0) => async () => ({
  mountain: d ? { ...reading(d), of: 'mountain' as const } : undefined,
  gates: Object.fromEntries(Object.entries(gates).map(([k, v]) => [k, { ...reading(v!), of: k as ChakraId }])),
});

describe('the surge maths (section 5)', () => {
  it('a gate part shut pools what it holds back; a touch lets SHARE of it go, nothing under the floor', () => {
    expect(pooledAt(0.5, 0.8)).toBeCloseTo(0.4);
    expect(pooledAt(0, 1)).toBe(0);
    expect(pooledAt(2, 1)).toBe(1);
    expect(letGo(0.4)).toBeCloseTo(0.4 * SHARE);
    expect(letGo(FLOOR / SHARE / 2)).toBe(0);
    expect(letGo(Number.NaN)).toBe(0);
  });

  it('the pool fills again toward what the gate holds, as R2 fills it', () => {
    expect(refill(0.2, 0.5, 0)).toBe(0.2);
    expect(refill(0.2, 0.5, 1)).toBeCloseTo(0.5 - 0.3 * Math.exp(-POOL_FILL));
    expect(refill(0.2, 0.5, 60)).toBeCloseTo(0.5, 5);
  });

  it('what reaches a sign is the spring through every gate above it', () => {
    expect(aboveOf('crown', 0.5, [0.9])).toBeCloseTo(spring(0.5));
    const g = [0.2, 0.4, 0, 0, 0, 0, 0];
    expect(aboveOf('throat', 0.1, g)).toBeCloseTo(reach(0.1, g)[1]);
  });

  it('the mountain lets a sign\'s pool go as one surge from it, and the pool fills again; Still lets nothing go', () => {
    const w = new Water();
    const gates = [0, 0, 0, 0.6, 0, 0, 0];
    w.feed(0, gates, true);
    const full = w.pooled[3];
    expect(full).toBeCloseTo(0.6);
    const out = w.release(3, SHARE);
    expect(out).toBeCloseTo(full * SHARE);
    expect(w.pooled[3]).toBeCloseTo(full * (1 - SHARE));
    expect(Array.from(w.surgeAmp).some(a => a > 0)).toBe(true);
    for (let k = 0; k < 120; k++) w.step(1 / 30);
    expect(w.pooled[3]).toBeGreaterThan(full * (1 - SHARE) + 0.05);
    expect(w.release(0, SHARE)).toBe(0);
    w.plain = true;
    expect(w.release(3, SHARE)).toBe(0);
  });
});

describe('the water answers a touch done', () => {
  beforeEach(async () => { await freshDB(); forgetSurges(); still.value = null; });
  afterEach(() => { still.value = null; vi.unstubAllGlobals(); });
  const done = (chakra: ChakraId, touch = 'x'): TouchDone => ({ chakra, touch, at: 1 });

  it('a part-shut gate lets a share of its pool go: the plate surges, the gate asks, the mountain is owed it once', async () => {
    const s = await answer(done('heart', 'grieve'), readingsWith({ heart: 0.5 }));
    expect(s).toEqual({ chakra: 'heart', amp: expect.closeTo(0.5 * SHARE, 5), at: 1 });
    expect(surge.value).toEqual(s);
    expect(asks('heart')).toBe(true);
    expect(asking.value.has('root')).toBe(false);
    expect(owedNow()).toEqual(['heart']);
    await answer(done('heart'), readingsWith({ heart: 0.5 }));
    expect(owedNow()).toEqual(['heart']);
    expect(takeOwed()).toEqual(['heart']);
    expect(takeOwed()).toEqual([]);
    settle('heart');
    expect(asks('heart')).toBe(false);
  });

  it('what reaches the sign counts: a shut gate above starves the pool below it', async () => {
    const s = await answer(done('sacral'), readingsWith({ crown: 1, sacral: 0.8 }, 0.5));
    const gates = [1, 0, 0, 0, 0, 0.8, 0];
    expect(s!.amp).toBeCloseTo(0.8 * reach(0.5, gates)[4] * SHARE, 5);
  });

  it('an open gate holds nothing back: no surge, no asking, nothing owed', async () => {
    expect(await answer(done('root'), readingsWith({}))).toBeNull();
    expect(surge.value).toBeNull();
    expect(asks('root')).toBe(false);
    expect(owedNow()).toEqual([]);
  });

  it('in Still nothing surges and nothing asks', async () => {
    still.value = { since: Date.now() };
    expect(await answer(done('heart'), readingsWith({ heart: 1 }))).toBeNull();
    expect(asks('heart')).toBe(false);
    expect(owedNow()).toEqual([]);
  });

  it('under Reduce Motion nothing travels, but the gate still asks', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
    expect(await answer(done('heart'), readingsWith({ heart: 1 }))).toBeNull();
    expect(surge.value).toBeNull();
    expect(owedNow()).toEqual([]);
    expect(asks('heart')).toBe(true);
  });

  it('through the door (the journal locked) nothing surges', async () => {
    const salt = randomSalt();
    await setKey(await deriveKey('2580', salt, 1000), { salt, iterations: 1000 });
    lock();
    expect(await answer(done('root', 'five'), readingsWith({ root: 1 }))).toBeNull();
    expect(owedNow()).toEqual([]);
  });

  it('hangs off onTouchDone, so a touch from another package surges too', async () => {
    const seen: string[] = [];
    const off = onTouchDone(d => seen.push(d.touch));
    const { markDone } = await import('../../src/ui/flow/chakra/touch');
    markDone('throat', 'send');
    off();
    expect(seen).toEqual(['send']);
  });
});

// ---- the touches, drawn ----

let root: HTMLElement | undefined;
const draw = (chakra: ChakraId, door = false) => {
  root = document.createElement('div');
  root.className = 'ck-plate';
  document.body.append(root);
  act(() => { render(h(LocationProvider, null, h(Touches, { chakra, door })), root!); });
  return root;
};
const touch = (id: string) => act(() => { root!.querySelector<HTMLButtonElement>(`.ck-touch[data-touch="${id}"]`)!.click(); });
const type = (input: HTMLInputElement, text: string) => act(() => { input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); });
const enter = (input: HTMLInputElement) => act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
const rules = () => [...root!.querySelectorAll<HTMLInputElement>('.ck-stage .pl-input')];
const settleAll = async () => { for (let k = 0; k < 6; k++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };

describe('the touches in the place', () => {
  let got: TouchDone[] = [];
  let off: () => void;
  beforeEach(async () => { await freshDB(); forgetSurges(); got = []; off = onTouchDone(d => got.push(d)); });
  afterEach(() => { off(); if (root) { render(null, root); root.remove(); root = undefined; } vi.useRealTimers(); });

  it('Crown, Let go: one rule on the snow; the words lift off and are not kept', async () => {
    draw('crown');
    touch('let-go');
    const [rule] = rules();
    expect(rule.getAttribute('aria-label')).toBe('Let go');
    expect(rule.placeholder).toBe('');
    type(rule, 'needing to know how it ends');
    enter(rule);
    await settleAll();
    expect(rule.value).toBe('');
    expect(root!.querySelector('.pl-letgo')!.textContent).toBe('needing to know how it ends');
    expect(await marksOf('crown')).toEqual([]);
    expect(got.map(d => `${d.chakra}/${d.touch}`)).toEqual(['crown/let-go']);
  });

  it('an empty line keeps nothing and is not a touch done', async () => {
    draw('throat');
    touch('say-it-here');
    const [rule] = rules();
    type(rule, '   ');
    enter(rule);
    await settleAll();
    expect(await marksOf('throat')).toEqual([]);
    expect(got).toEqual([]);
  });

  it('Throat, Say it here: the sentence goes over the fall, kept as a mark', async () => {
    draw('throat');
    touch('say-it-here');
    const [rule] = rules();
    type(rule, "I didn't like how we left it.");
    enter(rule);
    await settleAll();
    expect((await marksOf('throat', 'say-it-here')).map(m => m.text)).toEqual(["I didn't like how we left it."]);
    expect(root!.querySelectorAll('.pl-fall .pl-ch').length).toBe(29);
    expect(got.map(d => d.touch)).toEqual(['say-it-here']);
  });

  it('Heart, Grieve: the name sinks and stays as a stone, drawn from stones() on every visit', async () => {
    await writeMark('heart', 'grieve', 'Nana');
    draw('heart');
    touch('grieve');
    await settleAll();
    expect(root!.querySelectorAll('[data-stone]').length).toBe(1);
    const [rule] = rules();
    type(rule, 'Grandpa Joe');
    enter(rule);
    await settleAll();
    expect((await marksOf('heart', 'grieve')).map(m => m.text)).toEqual(['Nana', 'Grandpa Joe']);
    expect(root!.querySelectorAll('[data-stone]').length).toBe(2);
    // no number is printed anywhere near them
    expect(root!.querySelector('.ck-stage')!.textContent).not.toMatch(/\d/);
    expect(got.map(d => d.touch)).toEqual(['grieve']);
  });

  it('a stone lies in the same place every visit, on the tarn\'s bed', () => {
    expect(stoneOf('a')).toEqual(stoneOf('a'));
    for (const id of ['a', 'b', 'c', 'zz']) {
      const s = stoneOf(id);
      expect(s.x).toBeGreaterThan(110); expect(s.x).toBeLessThan(230);
      expect(s.y).toBeGreaterThan(170); expect(s.y).toBeLessThan(208);
    }
  });

  it('Solar plexus, Reword: two rules; the verdict struck, the deed kept as one mark', async () => {
    draw('solar-plexus');
    touch('reword');
    const [verdict] = rules();
    type(verdict, 'I am lazy');
    enter(verdict);
    const deed = rules()[1];
    expect(deed.getAttribute('aria-label')).toBe('Reword, the deed');
    type(deed, "I didn't send the invoice");
    enter(deed);
    await settleAll();
    const [m] = await marksOf('solar-plexus', 'reword');
    expect(m.text).toBe("I didn't send the invoice");
    expect(m.struck).toBe('I am lazy');
    expect(root!.querySelector('[data-verdict] .pl-strike')).not.toBeNull();
    expect(root!.querySelector('[data-deed]')!.textContent).toBe("I didn't send the invoice");
    expect(got.map(d => d.touch)).toEqual(['reword']);
  });

  it('Sacral, Feel: one word, no spaces taken; it rings out on the pool and floats there, kept', async () => {
    draw('sacral');
    touch('feel');
    const [rule] = rules();
    act(() => { rule.value = 'rest less'; rule.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(rule.value).toBe('restless');
    enter(rule);
    await settleAll();
    expect((await marksOf('sacral', 'feel')).map(m => m.text)).toEqual(['restless']);
    expect(root!.querySelector('[data-afloat]')!.textContent).toBe('restless');
    expect(root!.querySelectorAll('.pl-ripple').length).toBe(3);
  });

  it('Root, Five: five stepping stones, each lit as he names one; done at the fifth; nothing written', async () => {
    draw('root');
    touch('five');
    expect(root!.querySelectorAll('[data-stepping]').length).toBe(STONES.length);
    for (const [k, w] of ['lamp', 'window', 'mug', 'door', 'my hands'].entries()) {
      expect(got).toEqual([]);
      const [rule] = rules();
      type(rule, w);
      enter(rule);
      await settleAll();
      expect(root!.querySelectorAll('[data-stepping][data-lit]').length).toBe(k + 1);
    }
    expect(rules()).toEqual([]);
    expect([...root!.querySelectorAll('[data-named]')].map(e => e.textContent)).toEqual(['lamp', 'window', 'mug', 'door', 'my hands']);
    expect(got.map(d => d.touch)).toEqual(['five']);
    expect(await marksOf('root')).toEqual([]);
  });

  it('Root, Five works through the door and writes nothing', async () => {
    draw('root', true);
    touch('five');
    const [rule] = rules();
    type(rule, 'lamp');
    enter(rule);
    await settleAll();
    expect(root!.querySelectorAll('[data-stepping][data-lit]').length).toBe(1);
  });

  it('Root, Basics: four lanterns in the firs; a tap lights one for today, a second puts it out', async () => {
    draw('root');
    touch('basics');
    await settleAll();
    const lanterns = [...root!.querySelectorAll<HTMLButtonElement>('.pl-lantern')];
    expect(lanterns.map(b => b.textContent)).toEqual(['ate', 'slept', 'water', 'outside']);
    expect(lanterns.every(b => b.getAttribute('aria-pressed') === 'false')).toBe(true);
    act(() => lanterns[0].click());
    await settleAll();
    expect(lanterns[0].getAttribute('aria-pressed')).toBe('true');
    expect(await basicsToday()).toEqual(['ate']);
    act(() => lanterns[2].click());
    await settleAll();
    expect(await basicsToday()).toEqual(['ate', 'water']);
    act(() => lanterns[0].click());
    await settleAll();
    expect(await basicsToday()).toEqual(['water']);
    // the first lit in a showing is the touch done, once
    expect(got.map(d => d.touch)).toEqual(['basics']);
  });

  it('a held touch: the thumb down runs the breath; lifted after a whole breath, it is done (Breathe)', async () => {
    vi.useFakeTimers();
    draw('root');
    touch('breathe');
    const surface = root!.querySelector<HTMLElement>('.ck-stage .pl-thumb')!;
    expect(surface.getAttribute('aria-label')).toBe('the ring');
    act(() => { surface.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); });
    expect(surface.getAttribute('aria-pressed')).toBe('true');
    act(() => { vi.advanceTimersByTime(4_000); });
    expect(root!.querySelectorAll('.pl-ripple').length).toBe(1);
    act(() => { vi.advanceTimersByTime(6_100); });
    act(() => { surface.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); });
    expect(surface.getAttribute('aria-pressed')).toBe('false');
    expect(got.map(d => d.touch)).toEqual(['breathe']);
  });

  it('a thumb lifted before a whole breath is not done (Look far); a key held does the same as a thumb', () => {
    vi.useFakeTimers();
    draw('third-eye');
    touch('look-far');
    const surface = root!.querySelector<HTMLElement>('.ck-stage .pl-thumb')!;
    act(() => { surface.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); });
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(root!.querySelectorAll('.pl-mist[data-clear]').length).toBe(1);
    act(() => { surface.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true })); });
    expect(got).toEqual([]);
  });

  it('Look far clears the ranges one a breath, nearest first, and is done when the view is clear', () => {
    expect(clearedAfter(0)).toBe(0);
    expect(clearedAfter(2)).toBe(2);
    expect(clearedAfter(9)).toBe(RANGES.length);
    vi.useFakeTimers();
    draw('third-eye');
    touch('look-far');
    const surface = root!.querySelector<HTMLElement>('.ck-stage .pl-thumb')!;
    act(() => { surface.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); });
    act(() => { vi.advanceTimersByTime(5_000); });
    // the nearest range (the last) clears first
    expect([...root!.querySelectorAll<SVGElement>('.pl-mist[data-clear]')].map(e => e.dataset.range)).toEqual(['4']);
    for (let k = 0; k < 4; k++) act(() => { vi.advanceTimersByTime(10_000); });
    expect(root!.querySelectorAll('.pl-mist[data-clear]').length).toBe(RANGES.length);
    expect(got.map(d => d.touch)).toEqual(['look-far']);
  });

  it('Heart, Hold: the reflection is stirred on the tap and steadies over three out-breaths; through the door too', () => {
    expect(stirAfter(0)).toBe(1);
    expect(stirAfter(3)).toBe(0);
    draw('heart', true);
    touch('hold');
    expect(root!.hasAttribute('data-pl-waver')).toBe(true);
    expect(root!.querySelector('#pl-waver')).not.toBeNull();
    touch('hold');
    expect(root!.hasAttribute('data-pl-waver')).toBe(false);
  });

  it('Sacral, Hold: a ring goes out on each out-breath under the thumb', () => {
    vi.useFakeTimers();
    draw('sacral');
    touch('hold');
    const surface = root!.querySelector<HTMLElement>('.ck-stage .pl-thumb')!;
    act(() => { surface.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); });
    act(() => { vi.advanceTimersByTime(4_000); });
    expect(root!.querySelectorAll('.pl-ripple').length).toBe(1);
    const first = root!.querySelector('.pl-ripple')!;
    act(() => { vi.advanceTimersByTime(10_000); });
    // the first has gone out across the pool; the next out-breath sent another
    expect(root!.querySelectorAll('.pl-ripple').length).toBe(1);
    expect(root!.querySelector('.pl-ripple')).not.toBe(first);
    act(() => { surface.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); });
    expect(got.map(d => d.touch)).toEqual(['hold']);
  });

  it('every in-place touch has its own drawing; the touches that leave the place have none here', async () => {
    const { handlerFor } = await import('../../src/ui/flow/chakra/touch');
    const { touchesOf } = await import('../../src/model/acts');
    const { CHAKRA_IDS } = await import('../../src/model/mountain');
    for (const c of CHAKRA_IDS) {
      for (const t of touchesOf(c)) {
        if (t.kind === 'place') expect(handlerFor(c, t)?.View, `${c} ${t.id}`).toBeDefined();
      }
    }
  });
});
