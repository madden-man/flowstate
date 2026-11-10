// @vitest-environment jsdom
// What stuck (PLAN-ENERGIZE.md X4): the rows longest held first with their print lines (on since, last on, finished),
// one ribbon a stint, open in its hue and closed in print, the months and now on the axis; nothing ever on is the
// page and one print line; Still is the names alone; a row read locked shows no name; through the door the route is
// the keypad's (doorPasses).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { LocationProvider } from 'preact-iso';
import type { Fixation } from '../../src/db/schema';
import { store } from '../../src/db/fields';
import { ensureSeeded, seedFixationsOnce, seedFlowsOnce } from '../../src/db/seed';
import { doorPasses } from '../../src/model/door';
import { still } from '../../src/ui/light';
import { freshDB } from '../db/helpers';

const lockedIds = vi.hoisted(() => ({ ids: new Set<string>() }));
vi.mock('../../src/model/fixations', async real => {
  const m = await real<typeof import('../../src/model/fixations')>();
  return {
    ...m,
    ribbons: async (now?: number) => (await m.ribbons(now)).map(r => (lockedIds.ids.has(r.fixation.id)
      ? { ...r, fixation: { ...r.fixation, name: '', locked: true as const } } : r)),
  };
});

import { Stuck } from '../../src/ui/flow/Stuck';

const day = (m: number, d: number, hr = 0) => new Date(2026, m - 1, d, hr).getTime();
const NOW = new Date(2026, 10, 10, 9, 30).getTime();
const fx = (id: string, name: string, hue: number, stints: Fixation['stints'], extra: Partial<Fixation> = {}): Fixation =>
  ({ id, name, hue, createdAt: day(1, 1), stints, updatedAt: day(1, 1), ...extra });

let root: HTMLElement;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  lockedIds.ids.clear();
  await freshDB();
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => { act(() => { render(null, root); }); root.remove(); still.value = null; vi.useRealTimers(); });

const flush = async () => { for (let i = 0; i < 30; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };
const texts = (sel: string) => [...root.querySelectorAll(sel)].map(e => e.textContent);
const show = async () => { act(() => { render(h(LocationProvider, null, h(Stuck, null)), root); }); await flush(); };

const RICH = [
  fx('east', 'East Winds', 150, [{ from: day(8, 20), slot: 1 }]),
  fx('jazz', 'Jazz piano', 305, [{ from: day(9, 2), to: day(9, 20), slot: 2 }, { from: day(10, 1), to: day(10, 22), slot: 2 }]),
  fx('chin', 'Learning Chinese', 340, [{ from: day(8, 3), to: day(8, 24), slot: 0 }], { finishedAt: day(8, 24) }),
  fx('once', 'Darts', 90, [{ from: day(10, 5, 10), to: day(10, 5, 12), slot: 0 }]),
  fx('never', 'Conduit', 60, []),
];

describe('What stuck', () => {
  it('draws the seeded three longest held first, on since, in their hues', async () => {
    await ensureSeeded(); await seedFlowsOnce(); await seedFixationsOnce();
    await show();
    expect(texts('.fx-rib-name > span')).toEqual(['East Winds', 'Japan Trip', 'FlowState']);
    expect(texts('.fx-rib-name .fx-meta')).toEqual(['on since 8 / 20', 'on since 10 / 28', 'on since 11 / 7']);
    expect(root.querySelectorAll('.fx-track i.on')).toHaveLength(3);
    expect(texts('.fx-axis span')).toEqual(['Aug', 'Sep', 'Oct', 'now']);
    expect(root.querySelector('.fs-hdr')!.textContent).toContain('What stuck');
    const back = [...root.querySelectorAll('.fs-hdr a.fs-word')].find(a => a.getAttribute('href') === '#/flow/energize')!;
    expect(back.textContent).toBe('Energize');
    // never on, never drawn: the deck's four are not here
    expect(root.textContent).not.toMatch(/Jazz piano|Conduit/);
  });

  it('every stint a ribbon, open in its hue, closed in print; last on and finished; no number but the dates', async () => {
    await store.bulkPut('fixations', RICH);
    await show();
    expect(texts('.fx-rib-name > span')).toEqual(['East Winds', 'Jazz piano', 'Learning Chinese', 'Darts']);
    expect(texts('.fx-rib-name .fx-meta')).toEqual(['on since 8 / 20', 'last on 10 / 22', 'finished 8 / 24', 'last on 10 / 5']);
    const ribs = [...root.querySelectorAll('.fx-rib')];
    expect(ribs.map(r => r.querySelectorAll('.fx-track i').length)).toEqual([1, 2, 1, 1]);
    expect(ribs.map(r => r.querySelectorAll('.fx-track i.on').length)).toEqual([1, 0, 0, 0]);
    expect((ribs[0] as HTMLElement).style.getPropertyValue('--vc')).toBe('oklch(var(--voice-l) calc(var(--voice-c) * 1) 150)');
    // the same-day stint keeps its place with almost no length; the stroke makes it a dot
    const dot = ribs[3].querySelector<HTMLElement>('.fx-track i')!;
    expect(parseFloat(dot.style.getPropertyValue('--w'))).toBeLessThan(0.2);
    expect(texts('.fx-axis span')).toEqual(['Aug', 'Sep', 'Oct', 'now']);
    // rule 15: the drawing prints no number anywhere but the print lines' dates
    const drawing = [...root.querySelectorAll('.fx-track, .fx-axis')].map(e => e.textContent).join(' ');
    expect(drawing).not.toMatch(/\d/);
    expect(root.querySelector('.fx-stuck')!.textContent).not.toMatch(/days|weeks|months|total/);
  });

  it('nothing ever on: the page and one print line', async () => {
    await store.bulkPut('fixations', [fx('never', 'Conduit', 60, [])]);
    await show();
    expect(texts('.fx-stuck > *')).toEqual(['Nothing has been on yet.']);
    expect(root.querySelector('.fx-axis, .fx-rib')).toBeNull();
  });

  it('in Still the names only, in order: no ribbons, no dates, no axis', async () => {
    await store.bulkPut('fixations', RICH);
    still.value = { since: Date.now() };
    await show();
    expect(texts('.fx-rib-name > span')).toEqual(['East Winds', 'Jazz piano', 'Learning Chinese', 'Darts']);
    expect(root.querySelector('.fx-axis, .fx-track, .fx-meta')).toBeNull();
    expect(root.querySelector('.fx-stuck')!.textContent).not.toMatch(/\d|since|last on|finished|now/);
  });

  it('a row read locked shows no name, and the door does not let the page through', async () => {
    await store.bulkPut('fixations', RICH);
    lockedIds.ids.add('jazz');
    await show();
    expect(texts('.fx-rib-name > span')).toEqual(['East Winds', 'Learning Chinese', 'Darts']);
    expect(root.querySelectorAll('.fx-rib')).toHaveLength(3);
    expect(doorPasses('/flow/energize/stuck', true)).toBe(false);
  });
});
