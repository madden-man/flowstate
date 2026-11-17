// @vitest-environment jsdom
// What blocks a sign (PLAN-BLOCKERS.md K3; flow/chakra/Blockers.tsx): the print word, then a row for each flow listed
// under the sign, two rules a row, the name, whole step words joined by " · ", the small drawing; a live one first with
// its step in ink and the dot on its drawing; in Still the word and the names only, in stored order; the room held
// before the read; not mounted through the door; the way back from a flow's page reads the sign it was opened from.
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
import { moveDot } from '../../src/model/flows';
import { seededBlockerCount, strikeOff } from '../../src/model/mountain';
import { Blockers, backSignOf, blockersRoomOf, lastSign } from '../../src/ui/flow/chakra/Blockers';
import { nowRows } from '../../src/model/door';
import { flows } from '../../src/model/flows';

let root: HTMLElement;
const settle = async (ms = 30) => { await act(async () => { await new Promise(r => setTimeout(r, ms)); }); };
const until = (check: () => Promise<void> | void) => vi.waitFor(async () => { await settle(10); await check(); }, { timeout: 4000 });
async function draw(node: VNode<any>, read = true) {
  root = document.createElement('div');
  document.body.append(root);
  await act(() => { render(h(HashLocation, null, node), root); });
  if (read) await until(() => { expect(root.querySelector('[data-blockers]:not([data-wait])')).not.toBeNull(); });
  return root;
}
const rows = () => [...root.querySelectorAll<HTMLAnchorElement>('[data-blockers] .bk-row')];
const names = () => rows().map(r => (r.querySelector('.fs-list-line') ?? r).textContent);
const lightTo = (l: 'day' | 'night') => { settings.value = { ...settings.value, light: l }; };

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
afterEach(() => { render(null, root); root.remove(); still.value = null; });

describe('Blockers on a sign\'s page', () => {
  for (const l of ['day', 'night'] as const) {
    it(`${l}: the word, then a row per flow under the sign, with whole step words and the small drawing`, async () => {
      lightTo(l);
      await draw(h(Blockers, { chakra: 'root' }));
      const block = root.querySelector('[data-blockers]')!;
      expect(block.firstElementChild!.textContent).toBe('Blockers');
      expect(block.firstElementChild!.classList.contains('fs-month')).toBe(true);
      // Panic and What if are Root's own; 3 a.m. is listed a second time
      expect(names()).toEqual(['Panic', 'What if', '3 a.m.']);
      const panic = rows()[0];
      expect(panic.getAttribute('href')).toBe('#/flow/panic');
      expect(panic.classList.contains('fl-flow')).toBe(true);
      // the step words, each whole in its own span, joined by " · "
      const words = [...panic.querySelectorAll('.bk-words .bk-word')].map(w => w.textContent);
      expect(words).toEqual(['Overstimulated', ' · The wave', ' · Settling', ' · Under the skin']);
      expect(panic.querySelector('.bk-words')!.textContent).toBe('Overstimulated · The wave · Settling · Under the skin');
      // the small drawing, at rest: no dot
      expect(panic.querySelector('.fl-mini[data-travel="fs-drawing"] .fs-cycle.small')).not.toBeNull();
      expect(panic.querySelector('.fs-cycle-dot')).toBeNull();
      expect(panic.querySelector('.bk-now')).toBeNull();
      // nothing counted (rule 15); the small drawings' own marks are drawn, not printed (parts.css hides their text)
      const printed = block.cloneNode(true) as HTMLElement;
      printed.querySelectorAll('svg').forEach(s => s.remove());
      expect(printed.textContent!.replace('3 a.m.', '')).not.toMatch(/\d/);
    });
  }

  it('a draft is a row like any other: its name and its step words', async () => {
    await draw(h(Blockers, { chakra: 'heart' }));
    expect(names()).toEqual(['Depress', 'Missing someone']);
    const draft = rows()[1];
    expect(draft.hasAttribute('data-draft')).toBe(true);
    expect(draft.querySelector('.bk-words')!.textContent).toBe('A reminder · The wave · Aching · Easing');
    // nothing on the row says it is a draft (only K4's sheet does)
    expect(draft.textContent).not.toMatch(/draft/i);
  });

  it('a live one comes first and prints the step he is on in ink, with the dot on its drawing', async () => {
    await moveDot('whatif', [], 'whatif-2');
    await draw(h(Blockers, { chakra: 'root' }));
    expect(names()).toEqual(['What if', 'Panic', '3 a.m.']);
    const live = rows()[0];
    expect(live.dataset.live).toBe('true');
    expect(live.querySelector('.bk-words')).toBeNull();
    const now = live.querySelector('.bk-now')!;
    expect(now.textContent).toBe((await flows()).find(f => f.id === 'whatif')!.steps[1].name);
    expect(live.querySelector('.fs-cycle-dot')).not.toBeNull();
    expect(live.querySelector('.fs-cycle')!.getAttribute('data-at')).toBe('2');
    // the others stay at rest
    expect(rows()[1].querySelector('.fs-cycle-dot')).toBeNull();
  });

  it('Still: the word and the names only, in stored order, no drawing, no step words, no dot', async () => {
    await moveDot('whatif', [], 'whatif-2');
    still.value = { since: Date.now() };
    await draw(h(Blockers, { chakra: 'root' }));
    expect(root.querySelector('[data-blockers] .fs-month')!.textContent).toBe('Blockers');
    expect(rows().map(r => r.textContent)).toEqual(['Panic', 'What if', '3 a.m.']);
    expect(rows().every(r => r.classList.contains('bk-name'))).toBe(true);
    expect(root.querySelector('[data-blockers] .fs-cycle, [data-blockers] .bk-words, [data-blockers] .bk-now, [data-blockers] [data-live]')).toBeNull();
    expect(rows()[1].getAttribute('href')).toBe('#/flow/whatif');
  });

  it('a flow struck off the sign leaves its rows', async () => {
    await strikeOff('night', 'root', true);
    await draw(h(Blockers, { chakra: 'root' }));
    expect(names()).toEqual(['Panic', 'What if']);
  });

  it('holds its room before the read: the seeded rows, then the rows it took last time', async () => {
    expect(seededBlockerCount('root')).toBe(3);
    expect(seededBlockerCount('throat')).toBe(2);
    await draw(h(Blockers, { chakra: 'root' }), false);
    const waiting = root.querySelector<HTMLElement>('[data-blockers][data-wait]');
    expect(waiting).not.toBeNull();
    expect(waiting!.style.getPropertyValue('--bk-rows')).toBe('3');
    expect(waiting!.textContent).toBe('Blockers');
    await until(() => { expect(root.querySelector('[data-blockers]:not([data-wait])')).not.toBeNull(); });
    render(null, root); root.remove();
    // one struck: the next first paint holds two
    await strikeOff('night', 'root', true);
    await draw(h(Blockers, { chakra: 'root' }));
    expect(blockersRoomOf('root')).toBe(2);
  });

  it('locked: the room held, no rows', async () => {
    gate.value = 'locked';
    await draw(h(Blockers, { chakra: 'root' }), false);
    await settle();
    expect(root.querySelector('[data-blockers][data-wait]')).not.toBeNull();
    expect(rows()).toHaveLength(0);
  });

  it('a long press calls onHold with the row\'s flow, and a tap does not (the seam for K4)', async () => {
    const held: string[] = [];
    await draw(h(Blockers, { chakra: 'root', onHold: (f: { id: string }) => held.push(f.id) }));
    vi.useFakeTimers();
    try {
      const r = rows()[1];
      r.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 1, clientY: 1 }));
      vi.advanceTimersByTime(600);
      r.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    } finally { vi.useRealTimers(); }
    expect(held).toEqual(['whatif']);
  });
});

describe('the way back from a flow\'s page', () => {
  it('reads the sign it was opened from when that sign lists it, else its own sign, else none', () => {
    const night = { chakra: 'crown' as const, alsoUnder: ['root' as const] };
    expect(backSignOf(night)).toBe('crown');
    lastSign.value = 'root';
    expect(backSignOf(night)).toBe('root');
    expect(backSignOf({ chakra: 'throat' })).toBe('throat');
    expect(backSignOf({})).toBeNull();
  });
});

describe('the drafts stay out of Right now', () => {
  it('a draft\'s steps with only their names are no rows; a written one is', async () => {
    const fs = await flows();
    const ids = new Set(nowRows(fs).map(r => r.flowId));
    expect(ids.has('gripping')).toBe(false);
    expect(ids.has('missing-someone')).toBe(false);
    expect(ids.has('panic')).toBe(true);
    const g = fs.find(f => f.id === 'gripping')!;
    const written = { ...g, steps: g.steps.map((s, i) => (i === 1 ? { ...s, line: 'Again, a new plan.' } : s)) };
    expect(nowRows([written]).map(r => r.step)).toEqual([2]);
  });
});

describe('through the door', () => {
  it('a sign\'s page without the PIN has no Blockers', async () => {
    const { DoorChakraPage } = await import('../../src/ui/flow/ChakraPage');
    await draw(h(DoorChakraPage, { chakra: 'root' }), false);
    await settle();
    expect(root.querySelector('.ck-page[data-door]')).not.toBeNull();
    expect(root.querySelector('[data-blockers], .bk-row')).toBeNull();
  });
});

describe('the first open of a journal', () => {
  it('holds the room until the blockers pass has run, so the list never draws short and grows', async () => {
    const { dataVersion } = await import('../../src/ui/sheets');
    await freshDB();
    await ensureSeeded(0);
    await loadSettings();
    await draw(h(Blockers, { chakra: 'heart' }), false);
    await settle(400);
    // Depress alone is there, but the list waits for its draft
    expect(root.querySelector('[data-blockers][data-wait]')).not.toBeNull();
    expect(rows()).toHaveLength(0);
    await seedBlockersOnce();
    await act(() => { dataVersion.value++; });
    await until(() => { expect(names()).toEqual(['Depress', 'Missing someone']); });
  });
});
