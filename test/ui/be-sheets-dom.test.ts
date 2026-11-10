// @vitest-environment jsdom
// The Be sheets (PLAN-SELF.md S2), mounted on their own: five held puts a note on a new paradox (which then lands
// resting) and makes "active" inert on a resting one, with no HeldError; Both rides the draft and saves on close;
// Delete on the paradox sheet and the goal sheet asks once more on the same row, and one tap deletes nothing.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';
import { freshDB } from '../db/helpers';
import { store } from '../../src/db/fields';
import { seedParadoxes } from '../../src/db/seed';
import type { Paradox } from '../../src/db/schema';
import { HELD, spreads } from '../../src/model/paradox';

vi.mock('../../src/ui/parts/Haptic', () => ({ tick: () => {} }));

const { ParadoxSheet } = await import('../../src/ui/be/ParadoxSheet');
const { GoalSheet } = await import('../../src/ui/be/GoalSheet');
const { beData, openParadox, openGoal, closeBeSheet } = await import('../../src/ui/be/state');
const { openSheet } = await import('../../src/ui/sheets');

let host: HTMLElement;
const settle = async (n = 8) => { for (let k = 0; k < n; k++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };
const $ = <E extends Element = HTMLElement>(sel: string) => host.querySelector<E>(sel);
const $$ = (sel: string) => [...host.querySelectorAll<HTMLElement>(sel)];
const byText = (sel: string, text: string) => $$(sel).find(e => e.textContent?.startsWith(text));
const click = async (el: Element) => { await act(() => { (el as HTMLElement).click(); }); await settle(); };
const type = async (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
  await act(() => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); });
};

const extra = (n: number, status: Paradox['status'] = 'active'): Paradox => ({
  id: `px-${n}`, createdAt: n, updatedAt: n, status, poleA: { value: `a${n}`, aspect: 'x' }, poleB: { value: `b${n}`, aspect: 'y' }, revisions: [],
});

async function load(more: Paradox[] = []) {
  const { paradoxes, items } = seedParadoxes();
  await store.many({ paradoxes: [...paradoxes, ...more], items });
  beData.value = await spreads();
}
async function mount() {
  await act(() => { render(h('div', null, h(ParadoxSheet, null), h(GoalSheet, null)), host); });
  await settle();
}

beforeEach(async () => {
  await freshDB();
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(async () => {
  await act(() => { render(null, host); });
  host.remove();
  openSheet.value = null;
  beData.value = [];
});

describe('five are held', () => {
  it('a new paradox past the five says it rests, and lands resting', async () => {
    await load([1, 2, 3].map(n => extra(n)));
    expect(beData.value.filter(s => s.paradox.status === 'active')).toHaveLength(HELD);
    openParadox({});
    await mount();
    expect(byText('.fs-note', 'Five are held. This one rests until one of them does.')).toBeTruthy();
    const [aV, aAsp] = [$<HTMLInputElement>('[aria-label="Top: value"]')!, $<HTMLTextAreaElement>('[aria-label="Top: aspect"]')!];
    const [bV, bAsp] = [$<HTMLInputElement>('[aria-label="Bottom: value"]')!, $<HTMLTextAreaElement>('[aria-label="Bottom: aspect"]')!];
    await type(aV, 'bold'); await type(aAsp, 'say it'); await type(bV, 'careful'); await type(bAsp, 'check it');
    await type($<HTMLTextAreaElement>('[aria-label="Both, in a sentence"]')!, 'I say it once I have checked it');
    await act(() => { closeBeSheet(); });
    await settle();
    const made = (await store.all('paradoxes')).find(p => p.poleA.value === 'bold')!;
    expect(made.status).toBe('resting');
    expect(made.creed).toBe('I say it once I have checked it');
  });

  it('a resting paradox cannot be made active while five are held, and nothing throws', async () => {
    await load([...[1, 2, 3].map(n => extra(n)), extra(4, 'resting')]);
    openParadox({ paradoxId: 'px-4' });
    await mount();
    const active = byText('.fs-opt', 'active')!;
    expect(active.getAttribute('aria-disabled')).toBe('true');
    expect(byText('.fs-note', 'Five are held. Rest one first.')).toBeTruthy();
    await click(active);
    expect(active.getAttribute('aria-pressed')).toBe('false');
    await act(() => { closeBeSheet(); });
    await settle();
    expect((await store.get('paradoxes', 'px-4'))!.status).toBe('resting');
  });

  it('under five, active is a plain option and no note shows', async () => {
    await load([extra(4, 'resting')]);
    openParadox({ paradoxId: 'px-4' });
    await mount();
    expect(byText('.fs-opt', 'active')!.hasAttribute('aria-disabled')).toBe(false);
    expect($$('.fs-note').some(n => n.textContent?.includes('are held'))).toBe(false);
  });
});

describe('Delete, two taps', () => {
  it('one tap on the paradox sheet deletes nothing; the second deletes the paradox and its goals', async () => {
    await load();
    openParadox({ paradoxId: 'px-thoughtful-reactive' });
    await mount();
    await click(byText('.fs-delete', 'Delete')!);
    expect($('.fs-delete')!.classList.contains('armed')).toBe(true);
    expect($('.fs-delete span')!.textContent).toBe('Delete it');
    expect(await store.get('paradoxes', 'px-thoughtful-reactive')).toBeTruthy();
    await click($('.fs-delete')!);
    expect(await store.get('paradoxes', 'px-thoughtful-reactive')).toBeUndefined();
    expect((await store.all('items')).some(i => i.paradoxId === 'px-thoughtful-reactive')).toBe(false);
    expect(openSheet.value).toBe(null);
  });

  it('the goal sheet has Delete, not Archive, and only that goal goes', async () => {
    await load();
    openGoal({ paradoxId: 'px-selfless-selfish', goalId: 'it-volunteer' });
    await mount();
    expect(byText('button', 'Archive')).toBeUndefined();
    await click(byText('.fs-delete', 'Delete')!);
    expect(await store.get('items', 'it-volunteer')).toBeTruthy();
    await click($('.fs-delete')!);
    expect(await store.get('items', 'it-volunteer')).toBeUndefined();
    const balance = (await store.get('items', 'it-breathing-room'))!;
    expect(balance.pairId).toBeUndefined();
    expect(openSheet.value).toBe(null);
  });
});
