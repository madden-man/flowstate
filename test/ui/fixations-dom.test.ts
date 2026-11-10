// @vitest-environment jsdom
// The three (PLAN-ENERGIZE.md X2): three cards in slot order with the since line and its span, an empty slot dashed,
// the deck as chips and What stuck; Still keeps the names only; through the door the page at rest is the drawing
// alone; a tap on a card or a chip opens X3's sheet on the slot or the fixation; a landing redraws the card fresh and
// is passed up for the ring; the Flow list row names the three.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { LocationProvider } from 'preact-iso';
import type { Fixation } from '../../src/db/schema';
import type { Read } from '../../src/db/fields';
import { store } from '../../src/db/fields';
import { ensureSeeded, seedFixationsOnce, seedFlowsOnce } from '../../src/db/seed';
import { still } from '../../src/ui/light';
import { freshDB } from '../db/helpers';

const sheet = vi.hoisted(() => ({ calls: [] as { open: unknown; onClose: () => void; onChanged: (l?: { slot: number; hue: number }) => void }[] }));
vi.mock('../../src/ui/flow/DeckSheet', () => ({
  DeckSheet: (props: (typeof sheet.calls)[number]) => { sheet.calls.push(props); return null; },
}));

import { Fixations, namesOf, huesOf } from '../../src/ui/flow/Fixations';
import { FlowPage } from '../../src/ui/flow/FlowPage';
import { Flow } from '../../src/ui/flow/Flow';

const day = (m: number, d: number) => new Date(2026, m - 1, d).getTime();
const NOW = new Date(2026, 10, 10, 9, 30).getTime();
const fx = (id: string, name: string, hue: number, extra: Partial<Fixation> = {}): Read<Fixation> =>
  ({ id, name, hue, createdAt: day(1, 1), stints: [], ...extra }) as Read<Fixation>;
const FLOWSTATE = fx('a', 'FlowState', 250, { stints: [{ from: day(11, 7), slot: 0 }] });
const EAST = fx('b', 'East Winds', 150, { stints: [{ from: day(8, 20), slot: 1 }] });
const JAPAN = fx('c', 'Japan Trip', 25, { stints: [{ from: day(10, 28), slot: 2 }] });
const DECK = [fx('d', 'Jazz piano', 305), fx('e', 'Conduit', 60)];

let root: HTMLElement;
beforeEach(() => { sheet.calls = []; root = document.createElement('div'); document.body.append(root); });
afterEach(() => { act(() => { render(null, root); }); root.remove(); still.value = null; });

const flush = async () => { for (let i = 0; i < 30; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };
const texts = (sel: string) => [...root.querySelectorAll(sel)].map(e => e.textContent);

describe('Fixations', () => {
  it('shows the three in slot order, each with its since line and span, then the deck chips and What stuck', () => {
    act(() => { render(h(Fixations, { three: [FLOWSTATE, EAST, JAPAN], deck: DECK, now: NOW, onChanged: () => undefined }), root); });
    expect(texts('.fx-card .fx-name')).toEqual(['FlowState', 'East Winds', 'Japan Trip']);
    expect(texts('.fx-card .fx-meta')).toEqual(['Since 11 / 7 · 3 days', 'Since 8 / 20 · 12 weeks', 'Since 10 / 28 · 13 days']);
    expect(root.querySelectorAll('.fx-card .fx-under path')).toHaveLength(3);
    // the hue goes through the voices' formula, so the light sets its lightness and chroma (rule 3)
    expect((root.querySelector('.fx-card') as HTMLElement).style.getPropertyValue('--vc')).toBe('oklch(var(--voice-l) calc(var(--voice-c) * 1) 250)');
    expect(texts('.fx-deckpeek .fs-chip')).toEqual(['Jazz piano', 'Conduit']);
    expect(root.querySelector('.fx-foot a')!.getAttribute('href')).toBe('#/flow/energize/stuck');
    expect(root.textContent).not.toMatch(/talk to your doctor/);
  });

  it('draws an empty slot as a dashed slot in its place', () => {
    act(() => { render(h(Fixations, { three: [FLOWSTATE, undefined, JAPAN], deck: DECK, now: NOW, onChanged: () => undefined }), root); });
    const cards = root.querySelectorAll('.fx-card');
    expect(cards).toHaveLength(3);
    expect(cards[1].classList.contains('fx-empty')).toBe(true);
    expect(cards[1].querySelector('.fx-under')).toBeNull();
    expect(texts('.fx-card:not(.fx-empty) .fx-name')).toEqual(['FlowState', 'Japan Trip']);
  });

  it('in Still keeps the names only: no since line, no stroke, no deck, no foot', () => {
    still.value = { since: Date.now() };
    act(() => { render(h(Fixations, { three: [FLOWSTATE, EAST, JAPAN], deck: DECK, now: NOW, onChanged: () => undefined }), root); });
    expect(texts('.fx-card .fx-name')).toEqual(['FlowState', 'East Winds', 'Japan Trip']);
    expect(root.querySelector('.fx-meta')).toBeNull();
    expect(root.querySelector('.fx-under')).toBeNull();
    expect(root.querySelector('.fx-deckpeek')).toBeNull();
    expect(root.querySelector('.fx-foot')).toBeNull();
    expect(root.textContent).not.toMatch(/Since|days|weeks/);
  });

  it('a card opens the sheet on its slot, a chip on its fixation; closing clears it', () => {
    act(() => { render(h(Fixations, { three: [FLOWSTATE, undefined, JAPAN], deck: DECK, now: NOW, onChanged: () => undefined }), root); });
    expect(sheet.calls.at(-1)!.open).toBeNull();
    act(() => { (root.querySelectorAll('.fx-card')[2] as HTMLElement).click(); });
    expect(sheet.calls.at(-1)!.open).toEqual({ slot: 2 });
    act(() => { (root.querySelectorAll('.fx-card')[1] as HTMLElement).click(); });
    expect(sheet.calls.at(-1)!.open).toEqual({ slot: 1 });
    act(() => { (root.querySelectorAll('.fx-deckpeek .fs-chip')[1] as HTMLElement).click(); });
    expect(sheet.calls.at(-1)!.open).toEqual({ id: 'e' });
    act(() => { sheet.calls.at(-1)!.onClose(); });
    expect(sheet.calls.at(-1)!.open).toBeNull();
  });

  it('a landing is passed up and its card is drawn fresh once the page has the new rows', async () => {
    const onChanged = vi.fn(async () => undefined);
    act(() => { render(h(Fixations, { three: [FLOWSTATE, EAST, JAPAN], deck: DECK, now: NOW, onChanged }), root); });
    const before = root.querySelectorAll('.fx-card')[1];
    await act(async () => { sheet.calls.at(-1)!.onChanged({ slot: 1, hue: 305 }); });
    await flush();
    expect(onChanged).toHaveBeenCalledWith({ slot: 1, hue: 305 });
    const after = root.querySelectorAll('.fx-card')[1];
    expect(after.classList.contains('fresh')).toBe(true);
    // a new element, so its stroke is drawn again
    expect(after).not.toBe(before);
    await act(async () => { sheet.calls.at(-1)!.onChanged(); });
    expect(onChanged).toHaveBeenLastCalledWith(undefined);
  });

  it('names and hues for the list and the stream, in slot order, an empty slot skipped or ink', () => {
    expect(namesOf([FLOWSTATE, EAST, JAPAN])).toBe('FlowState · East Winds · Japan Trip');
    expect(namesOf([undefined, EAST, undefined])).toBe('East Winds');
    expect(namesOf([undefined, undefined, undefined])).toBeUndefined();
    expect(namesOf([{ ...FLOWSTATE, name: '', locked: true } as Read<Fixation>, undefined, undefined])).toBeUndefined();
    expect(huesOf([FLOWSTATE, undefined, JAPAN])).toEqual([250, null, 25]);
  });
});

describe('the Energize page and the Flow list, from the database', () => {
  beforeEach(async () => {
    await freshDB();
    await ensureSeeded();
    await seedFlowsOnce();
    await seedFixationsOnce();
  });
  const page = (props: { id: string; doorOnly?: boolean }) =>
    act(() => { render(h(LocationProvider, null, h(FlowPage, props)), root); });

  it('at rest shows the three and the deck in place of the rest page, and the stream in their hues', async () => {
    page({ id: 'energize' });
    await flush();
    expect(texts('.fx-card .fx-name')).toEqual(['FlowState', 'East Winds', 'Japan Trip']);
    expect(texts('.fx-deckpeek .fs-chip')).toEqual(['Jazz piano', 'Conduit', 'Learning Chinese', 'Studying philosophy']);
    expect(root.querySelector('.fl-print')).toBeNull();
    expect(root.textContent).not.toMatch(/talk to your doctor/);
    expect(root.querySelector('.fl-add')).toBeNull();
    const svg = root.querySelector<SVGSVGElement>('.fl-stream svg')!;
    expect(svg.style.getPropertyValue('--fx0')).toMatch(/^oklch\(var\(--voice-l\)/);
    expect(root.querySelectorAll('.fl-stream line.h0, .fl-stream line.h1, .fl-stream line.h2').length).toBeGreaterThan(20);
  });

  it('through the door is the drawing alone, its water in ink', async () => {
    page({ id: 'energize', doorOnly: true });
    await flush();
    expect(root.querySelector('.fl-drawing')).not.toBeNull();
    expect(root.querySelector('.fx-page, .fx-card, .fx-deckpeek')).toBeNull();
    expect(root.textContent).not.toMatch(/FlowState|East Winds|Japan Trip|Jazz piano/);
    expect(root.querySelector('.fl-stream line[class]')).toBeNull();
    expect(root.querySelector<SVGSVGElement>('.fl-stream svg')!.getAttribute('style')).toBeNull();
  });

  it('another flow keeps its rest page and its water in ink', async () => {
    page({ id: 'panic' });
    await flush();
    expect(root.querySelector('.fx-page')).toBeNull();
    expect(root.querySelector('.fl-stream line[class]')).toBeNull();
    expect(root.querySelector<SVGSVGElement>('.fl-stream svg')!.getAttribute('style')).toBeNull();
  });

  it('the Flow list names the three on Energize\'s row; the others keep their shape', async () => {
    act(() => { render(h(LocationProvider, null, h(Flow, null)), root); });
    await flush();
    const row = [...root.querySelectorAll('a.fl-flow')].find(a => a.querySelector('.fs-list-line')!.textContent === 'Energize')!;
    expect(row.querySelector('.fs-list-meta')!.textContent).toBe('FlowState · East Winds · Japan Trip');
    const fight = [...root.querySelectorAll('a.fl-flow')].find(a => a.querySelector('.fs-list-line')!.textContent === 'Fight')!;
    expect(fight.querySelector('.fs-list-meta')!.textContent).toBe('The mountain');
  });

  it('with the three emptied, the row keeps the shape\'s name', async () => {
    await store.bulkPut('fixations', (await store.all('fixations')).map(f => ({ ...f, finishedAt: 1, stints: f.stints.map(s => ({ ...s, to: 1 })) })));
    act(() => { render(h(LocationProvider, null, h(Flow, null)), root); });
    await flush();
    const row = [...root.querySelectorAll('a.fl-flow')].find(a => a.querySelector('.fs-list-line')!.textContent === 'Energize')!;
    expect(row.querySelector('.fs-list-meta')!.textContent).toBe('The landing arc');
  });
});
