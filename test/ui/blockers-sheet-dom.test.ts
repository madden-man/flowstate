// @vitest-environment jsdom
// The Blockers sheet (PLAN-BLOCKERS.md K4, walkthrough steps 5 and 6; flow/chakra/BlockersSheet.tsx): a long press on a
// row raises "Root blockers", every flow listed under the sign, struck ones too; a tap strikes one off with a drawn
// stroke and a tap puts it back; "also <Sign>" and "draft" only in the sheet; "+ blocker" opens New flow with the sign
// chosen; a sign with every blocker struck shows the word and "+ blocker" only; the six drafts and the three second
// listings under their signs; in all three lights, with no long press and no sheet in Still.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { act } from 'preact/test-utils';
vi.mock('../../src/ui/parts/Haptic', () => ({ tick: () => {} }));
import { freshDB } from '../db/helpers';
import { ensureSeeded, seedBlockersOnce } from '../../src/db/seed';
import { loadSettings, settings } from '../../src/ui/settings';
import { gate } from '../../src/ui/lock/pin';
import { still } from '../../src/ui/light';
import { HashLocation } from '../../src/ui/route';
import { flows } from '../../src/model/flows';
import { CHAKRA_IDS, blockersOf, strikeOff, type ChakraId } from '../../src/model/mountain';
import { lastSign } from '../../src/ui/flow/chakra/Blockers';
import { SignBlockers, blockerTag } from '../../src/ui/flow/chakra/BlockersSheet';
import { HOLD_MS } from '../../src/ui/parts/Hold';

let root: HTMLElement | undefined;
const settle = async (ms = 30) => { await act(async () => { await new Promise(r => setTimeout(r, ms)); }); };
const until = (check: () => Promise<void> | void) => vi.waitFor(async () => { await settle(10); await check(); }, { timeout: 4000 });
async function draw(node: VNode<any>) {
  const el = document.createElement('div');
  root = el;
  document.body.append(el);
  await act(() => { render(h(HashLocation, null, node), el); });
  await until(() => { expect(el.querySelector('[data-blockers]:not([data-wait])')).not.toBeNull(); });
  return el;
}
const rows = () => [...root!.querySelectorAll<HTMLAnchorElement>('[data-blockers] .bk-row')];
const names = () => rows().map(r => (r.querySelector('.fs-list-line') ?? r).textContent);
const picks = () => [...document.querySelectorAll<HTMLButtonElement>('[data-blockers-sheet] .bk-pick')];
const pick = (id: string) => document.querySelector<HTMLButtonElement>(`[data-blockers-sheet] .bk-pick[data-flow="${id}"]`)!;
const sheet = () => document.querySelector<HTMLElement>('[data-blockers-sheet]');

async function longPress(el: Element) {
  vi.useFakeTimers();
  try {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 1, clientY: 1 }));
    vi.advanceTimersByTime(HOLD_MS + 50);
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  } finally { vi.useRealTimers(); }
  await settle();
}
const tap = async (el: Element) => { await act(() => { (el as HTMLElement).click(); }); await settle(); };

beforeEach(async () => {
  await freshDB();
  await ensureSeeded(0);
  await loadSettings();
  await seedBlockersOnce();
  gate.value = null;
  still.value = null;
  lastSign.value = null;
  localStorage.clear();
  location.hash = '#/flow/c/root';
});
afterEach(() => { if (root) { render(null, root); root.remove(); root = undefined; } still.value = null; });

describe('what the sheet says a row is', () => {
  it('its home when listed a second time, "draft" for a candidate, nothing for its own', () => {
    expect(blockerTag({ chakra: 'crown' }, 'root')).toBe('also Crown');
    expect(blockerTag({ chakra: 'crown' }, 'crown')).toBe('');
    expect(blockerTag({ chakra: 'heart', draft: true }, 'heart')).toBe('draft');
    expect(blockerTag({ chakra: 'heart', draft: true }, 'root')).toBe('also Heart · draft');
    expect(blockerTag({}, 'root')).toBe('');
  });
});

describe('the candidates, sign by sign (step 6)', () => {
  it('the six drafts and the three second listings stand under their signs', async () => {
    const under: Record<string, string[]> = {};
    for (const c of CHAKRA_IDS) under[c] = (await blockersOf(c)).map(b => b.flow.id);
    expect(under.crown).toEqual(['replay', 'night', 'gripping']);
    expect(under.root).toEqual(['panic', 'whatif', 'night']);
    const set = (c: ChakraId) => new Set(under[c]);
    expect(set('third-eye')).toEqual(new Set(['replay', 'whatif', 'cant-choose']));
    expect(set('throat')).toEqual(new Set(['fight', 'swallowed-it']));
    expect(set('heart')).toEqual(new Set(['depress', 'missing-someone']));
    expect(set('solar-plexus')).toEqual(new Set(['shame', 'cant-start']));
    expect(set('sacral')).toEqual(new Set(['shutdown', 'numbing']));
    expect((await flows()).filter(f => f.draft).map(f => f.id).sort())
      .toEqual(['cant-choose', 'cant-start', 'gripping', 'missing-someone', 'numbing', 'swallowed-it']);
  });
});

describe('the Blockers sheet', () => {
  for (const l of ['day', 'night'] as const) {
    it(`${l}: a long press raises "Root blockers": every row, "also Crown" on 3 a.m., "+ blocker" last`, async () => {
      settings.value = { ...settings.value, light: l };
      await draw(h(SignBlockers, { chakra: 'root' }));
      expect(sheet()).toBeNull();
      await longPress(rows()[2]);
      await until(() => { expect(picks()).toHaveLength(3); });
      expect(document.querySelector('.fs-sheet')!.getAttribute('data-sheet')).toBe('Root blockers');
      expect(picks().map(p => p.querySelector('.bk-pick-name')!.textContent)).toEqual(['Panic', 'What if', '3 a.m.']);
      expect(picks().map(p => p.querySelector('.bk-tag')?.textContent ?? '')).toEqual(['', '', 'also Crown']);
      const add = sheet()!.lastElementChild!;
      expect(add.textContent).toBe('+ blocker');
      // the long press did not open the flow
      expect(location.hash).toBe('#/flow/c/root');
      // nothing on the page's rows says also or draft
      expect(root!.querySelector('[data-blockers]')!.textContent).not.toMatch(/also|draft/i);
    });
  }

  it('a draft says "draft" in the sheet, and a second listing of Crown\'s says its home', async () => {
    await draw(h(SignBlockers, { chakra: 'crown' }));
    await longPress(rows()[0]);
    await until(() => { expect(picks()).toHaveLength(3); });
    expect(picks().map(p => [p.dataset.flow, p.querySelector('.bk-tag')?.textContent ?? ''])).toEqual([
      ['replay', 'also Third eye'], ['night', ''], ['gripping', 'draft'],
    ]);
  });

  it('a tap strikes one off with a drawn stroke and the page loses its row; a tap puts it back', async () => {
    await draw(h(SignBlockers, { chakra: 'root' }));
    await longPress(rows()[0]);
    await until(() => { expect(picks()).toHaveLength(3); });
    await tap(pick('night'));
    await until(async () => { expect((await flows()).find(f => f.id === 'night')!.offSigns).toEqual(['root']); });
    const struck = pick('night');
    expect(struck.getAttribute('aria-pressed')).toBe('true');
    expect(struck.hasAttribute('data-struck')).toBe(true);
    const s = struck.querySelector('s.fs-struck.bk-drawn')!;
    expect(s.textContent).toBe('3 a.m.');
    expect(s.querySelector('svg.fs-struck-line path')).not.toBeNull();
    // still listed in the sheet, in its place; gone from the page
    expect(picks().map(p => p.dataset.flow)).toEqual(['panic', 'whatif', 'night']);
    await until(() => { expect(names()).toEqual(['Panic', 'What if']); });
    // the flow is kept whole
    expect((await flows()).find(f => f.id === 'night')!.steps.length).toBeGreaterThan(0);

    await tap(pick('night'));
    await until(async () => { expect((await flows()).find(f => f.id === 'night')!.offSigns).toBeUndefined(); });
    expect(pick('night').getAttribute('aria-pressed')).toBe('false');
    // the stroke lifts (over --t-ui, zero here), then is gone
    await until(() => { expect(pick('night').querySelector('s')).toBeNull(); });
    await until(() => { expect(names()).toEqual(['Panic', 'What if', '3 a.m.']); });
    // struck off Root it stays under Crown
    await strikeOff('night', 'root', true);
    expect((await blockersOf('crown')).map(b => b.flow.id)).toContain('night');
  });

  it('a sign with every blocker struck shows the word and "+ blocker" only; it raises the sheet to put one back', async () => {
    await strikeOff('fight', 'throat', true);
    await strikeOff('swallowed-it', 'throat', true);
    await draw(h(SignBlockers, { chakra: 'throat' }));
    const block = root!.querySelector('[data-blockers]')!;
    expect(rows()).toHaveLength(0);
    expect([...block.children].map(c => c.textContent)).toEqual(['Blockers', '+ blocker']);
    await tap(block.querySelector('.bk-add button')!);
    await until(() => { expect(picks()).toHaveLength(2); });
    expect(picks().every(p => p.getAttribute('aria-pressed') === 'true')).toBe(true);
    // already struck when it rose: no stroke drawn again
    expect(document.querySelector('[data-blockers-sheet] .bk-drawn')).toBeNull();
    await tap(pick('fight'));
    await until(() => { expect(names()).toEqual(['Fight']); });
    expect(root!.querySelector('.bk-add')).toBeNull();
  });

  it('"+ blocker" opens New flow with the sign already chosen', async () => {
    await draw(h(SignBlockers, { chakra: 'heart' }));
    await longPress(rows()[0]);
    await until(() => { expect(picks()).toHaveLength(2); });
    await tap(sheet()!.querySelector('.bk-sheet-add button')!);
    await until(() => { expect(document.querySelector('.fs-sheet[data-sheet="New flow"]')).not.toBeNull(); });
    const chosen = [...document.querySelectorAll<HTMLButtonElement>('.fl-signs .fl-signpick')].filter(b => b.getAttribute('aria-pressed') === 'true');
    expect(chosen.map(b => b.getAttribute('aria-label'))).toEqual(['Heart']);
  });

  it('Still: the names only, a long press opens nothing, no "+ blocker"', async () => {
    still.value = { since: Date.now() };
    await strikeOff('fight', 'throat', true);
    await draw(h(SignBlockers, { chakra: 'root' }));
    expect(rows().every(r => r.classList.contains('bk-name'))).toBe(true);
    await longPress(rows()[0]);
    expect(sheet()).toBeNull();
    render(null, root!); root!.remove();
    await strikeOff('swallowed-it', 'throat', true);
    await draw(h(SignBlockers, { chakra: 'throat' }));
    // the foot is there but gone with the light (fs-notstill)
    expect(root!.querySelector('.bk-add')!.classList.contains('fs-notstill')).toBe(true);
  });

  it('a sheet up as the light turns to Still goes down', async () => {
    await draw(h(SignBlockers, { chakra: 'root' }));
    await longPress(rows()[0]);
    await until(() => { expect(picks()).toHaveLength(3); });
    await act(() => { still.value = { since: Date.now() }; });
    await until(() => { expect(sheet()).toBeNull(); });
  });
});
