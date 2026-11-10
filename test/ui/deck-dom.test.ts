// @vitest-environment jsdom
// The deck sheet (PLAN-ENERGIZE.md X3), mounted on its own (Fixations.tsx, X2, renders it on the page): from a card, the
// title and its since line, the deck rows with "last on" or "never on", a tap on a row is the swap; from a deck chip,
// the three to replace; Finished instead empties the slot; Deal me one lights a row, never an excluded one, and writes
// nothing; "+ fixation" puts one on deck and in no slot; Edit renames, recolours and moves the since date; the dates
// carry fs-notstill so Still hides them; a locked row shows nothing; a swap asks for one tick and the rising fifth.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';
import fs from 'node:fs';
import { freshDB } from '../db/helpers';
import { store, setKey, lock, unlock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { seedFixations } from '../../src/db/seed';
import { three, deck, fixationById, openStint } from '../../src/model/fixations';
import type { FlowDB } from '../../src/db/schema';

const ticks: string[] = [];
const bells: string[] = [];
vi.mock('../../src/ui/parts/Haptic', () => ({ tick: (n: string) => { ticks.push(n); } }));
vi.mock('../../src/ui/parts/Sound', () => ({ bell: (n: string) => { bells.push(n); } }));

const { DeckSheet, freeHue, slotName } = await import('../../src/ui/flow/DeckSheet');

const day = (m: number, d: number) => new Date(2026, m - 1, d).getTime();
let db: FlowDB;
let host: HTMLElement;

/** The seed (FlowState, East Winds, Japan Trip on; Jazz piano, Conduit, Learning Chinese, Studying philosophy on
 *  deck), with Jazz piano on once before, off 10 / 22. */
async function seeded() {
  const rows = seedFixations(day(11, 1));
  const jazz = rows.find(r => r.id === 'fx-jazz-piano')!;
  jazz.stints = [{ from: day(10, 1), to: day(10, 22), slot: 2 }];
  await store.bulkPut('fixations', rows);
}

const settle = async (n = 6) => { for (let k = 0; k < n; k++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };
type Open = { slot: number } | { id: string } | null;
let changed: ({ slot: number; hue: number } | undefined)[] = [];
let closed = 0;
async function mount(open: Open) {
  changed = [];
  closed = 0;
  await act(() => {
    render(h(DeckSheet, { open, onClose: () => { closed++; }, onChanged: l => { changed.push(l); } }), host);
  });
  await settle();
}
const $ = <E extends Element = HTMLElement>(sel: string) => host.querySelector<E>(sel);
const $$ = (sel: string) => [...host.querySelectorAll<HTMLElement>(sel)];
const rowNames = () => $$('.fx-deckrow b').map(b => b.textContent);
const byText = (sel: string, text: string) => $$(sel).find(e => e.textContent === text)!;
const click = async (el: Element) => { await act(() => { (el as HTMLElement).click(); }); await settle(); };
const type = async (el: HTMLInputElement, v: string) => { await act(() => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }); };

beforeEach(async () => {
  db = await freshDB();
  await seeded();
  ticks.length = 0;
  bells.length = 0;
  host = document.createElement('div');
  document.body.appendChild(host);
  delete document.documentElement.dataset.light;
});
afterEach(async () => {
  await act(() => { render(null, host); });
  host.remove();
});

describe('the deck sheet from a card', () => {
  it('is titled with the card, says since when, and lists the deck with its print lines', async () => {
    await mount({ slot: 2 });
    expect($('.fs-sheet-title h2')!.textContent).toBe('Japan Trip');
    expect($('.fx-sheet')!.hasAttribute('data-hue')).toBe(true);
    expect($('.fx-sheet')!.style.getPropertyValue('--vc')).toMatch(/^oklch\(var\(--voice-l\)/);
    expect($('.fx-since')!.textContent).toBe('On since 10 / 28');
    expect(rowNames()).toEqual(['Jazz piano', 'Conduit', 'Learning Chinese', 'Studying philosophy']);
    expect($$('.fx-deckrow small').map(s => s.textContent)).toEqual(['last on 10 / 22', 'never on', 'never on', 'never on']);
    expect($('.fx-fate span')!.textContent).toBe('Japan Trip goes back on deck.');
    expect(byText('.fx-acts .fs-chip', 'Deal me one')).toBeTruthy();
    expect(byText('.fx-acts .fs-chip', '+ fixation')).toBeTruthy();
  });

  it('a tap on a row is the swap: it lands in the slot, the one there goes on deck, and the sheet closes', async () => {
    await mount({ slot: 2 });
    await click(byText('.fx-deckrow', 'Jazz pianolast on 10 / 22'));
    const t = await three();
    expect(t[2]!.name).toBe('Jazz piano');
    expect((await deck()).map(f => f.name)).toContain('Japan Trip');
    const jazz = (await fixationById('fx-jazz-piano'))!;
    expect(changed).toEqual([{ slot: 2, hue: jazz.hue }]);
    expect(closed).toBe(1);
    // one tick and the rising fifth, inside the tap
    expect(ticks).toEqual(['swap']);
    expect(bells).toEqual(['swap']);
  });

  it('Finished instead retires the card: its slot is left empty and it is not on deck', async () => {
    await mount({ slot: 1 });
    await click(byText('.fx-fate .fs-word', 'Finished instead'));
    expect((await three())[1]).toBeUndefined();
    expect((await deck()).map(f => f.id)).not.toContain('fx-east-winds');
    expect((await fixationById('fx-east-winds'))!.finishedAt).toBeTypeOf('number');
    expect(changed).toEqual([undefined]);
    expect(closed).toBe(1);
  });

  it('an empty slot is titled Empty, has no since line, no fate line and no Edit', async () => {
    await mount({ slot: 1 });
    await click(byText('.fx-fate .fs-word', 'Finished instead'));
    await mount(null);
    await mount({ slot: 1 });
    expect($('.fs-sheet-title h2')!.textContent).toBe('Empty');
    expect($('.fx-sheet')!.hasAttribute('data-hue')).toBe(false);
    expect($('.fx-since')).toBeNull();
    expect($('.fx-fate')).toBeNull();
    expect($$('.fs-sheet-words .fs-word').map(w => w.textContent)).toEqual(['Done']);
    await click(byText('.fx-deckrow', 'Conduitnever on'));
    expect((await three())[1]!.name).toBe('Conduit');
  });

  it('Deal me one lights one row, never the one excluded, writes nothing, and riffles the rows', async () => {
    const before = JSON.stringify(await db.fixations.toArray());
    await mount({ slot: 0 });
    const chip = byText('.fx-acts .fs-chip', 'Deal me one');
    const seen: string[] = [];
    for (let k = 0; k < 8; k++) {
      await click(chip);
      const lit = $$('.fx-deckrow[data-dealt]');
      expect(lit).toHaveLength(1);
      const id = lit[0].dataset.fx!;
      // never the last one dealt
      if (seen.length) expect(id).not.toBe(seen.at(-1));
      seen.push(id);
      expect($('.fx-deck')!.hasAttribute('data-riffle')).toBe(true);
    }
    expect(ticks).toEqual(Array(8).fill('deal'));
    expect(bells).toEqual([]);
    expect(JSON.stringify(await db.fixations.toArray())).toBe(before);
    expect(changed).toEqual([]);
    // a tap on the lit row is the swap
    const lit = $$('.fx-deckrow[data-dealt]')[0];
    await click(lit);
    expect((await three())[0]!.id).toBe(lit.dataset.fx);
  });

  it('never deals the one just taken off in this sheet session', async () => {
    await mount({ slot: 0 });
    await click(byText('.fx-deckrow', 'Conduitnever on'));
    expect((await deck()).map(f => f.id)).toContain('fx-flowstate');
    await mount(null);
    await mount({ slot: 1 });
    const chip = byText('.fx-acts .fs-chip', 'Deal me one');
    for (let k = 0; k < 12; k++) {
      await click(chip);
      expect($$('.fx-deckrow[data-dealt]')[0].dataset.fx).not.toBe('fx-flowstate');
    }
  });

  it('"+ fixation" asks for a name and a colour in the same sheet, and puts it on deck, in no slot', async () => {
    await mount({ slot: 2 });
    await click(byText('.fx-acts .fs-chip', '+ fixation'));
    expect($$('.fs-sheet')).toHaveLength(1);
    expect($('.fs-sheet-title h2')!.textContent).toBe('New fixation');
    expect($('.fx-new .fs-wheel')).toBeTruthy();
    const save = byText('.fs-sheet-words .fs-word', 'On deck');
    expect(save.getAttribute('aria-disabled')).toBe('true');
    await type($<HTMLInputElement>('.fx-new .fs-input')!, 'Film photography');
    expect($('.fs-sheet-title h2')!.textContent).toBe('Film photography');
    await click(byText('.fs-sheet-words .fs-word', 'On deck'));
    expect(rowNames().at(-1)).toBe('Film photography');
    expect($$('.fx-deckrow small').at(-1)!.textContent).toBe('never on');
    expect((await deck()).map(f => f.name)).toContain('Film photography');
    expect((await three()).map(f => f?.name)).toEqual(['FlowState', 'East Winds', 'Japan Trip']);
    expect(changed).toEqual([undefined]);
    expect(closed).toBe(0);
  });

  it('Edit renames, recolours and moves the since date of the card', async () => {
    await mount({ slot: 0 });
    await click(byText('.fs-sheet-words .fs-word', 'Edit'));
    const [name, since] = $$('.fx-edit .fs-input') as HTMLInputElement[];
    expect(name.value).toBe('FlowState');
    expect(since.type).toBe('date');
    expect(since.value).toBe('2026-11-07');
    await type(name, 'FlowState, the journal');
    await type(since, '2026-11-05');
    const wheel = $('.fx-edit .fs-wheel')!;
    const was = (await fixationById('fx-flowstate'))!.hue;
    await act(() => { wheel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    // back to the deck keeps it all
    await click($('.fs-sheet-back')!);
    const f = (await fixationById('fx-flowstate'))!;
    expect(f.name).toBe('FlowState, the journal');
    expect(f.hue).toBe((was + 5) % 360);
    expect(openStint(f)!.from).toBe(day(11, 5));
    expect($('.fs-sheet-title h2')!.textContent).toBe('FlowState, the journal');
    expect($('.fx-since')!.textContent).toBe('On since 11 / 5');
    expect(changed).toEqual([undefined]);
  });
});

describe('the deck sheet from a deck chip', () => {
  it('asks which of the three it replaces, an empty slot reading Empty, and a tap is the swap', async () => {
    await mount({ slot: 1 });
    await click(byText('.fx-fate .fs-word', 'Finished instead'));
    await mount(null);
    await mount({ id: 'fx-learning-chinese' });
    expect($('.fs-sheet-title h2')!.textContent).toBe('Learning Chinese');
    expect(rowNames()).toEqual(['FlowState', 'Empty', 'Japan Trip']);
    expect($('.fx-deckrow.empty')).toBeTruthy();
    expect($('.fx-fate')).toBeNull();
    expect(byText('.fx-deckrow', 'FlowStatesince 11 / 7')).toBeTruthy();
    await click(byText('.fx-deckrow', 'Japan Tripsince 10 / 28'));
    const t = await three();
    expect(t[2]!.name).toBe('Learning Chinese');
    expect((await deck()).map(f => f.name)).toContain('Japan Trip');
    expect(changed).toEqual([{ slot: 2, hue: t[2]!.hue }]);
    expect(closed).toBe(1);
    expect(ticks).toEqual(['swap']);
    expect(bells).toEqual(['swap']);
  });
});

describe('the deck sheet in Still and locked', () => {
  it('every date on the sheet carries fs-notstill, which Still hides', async () => {
    document.documentElement.dataset.light = 'still';
    await mount({ slot: 2 });
    expect($('.fx-label')!.classList.contains('fs-notstill')).toBe(true);
    for (const s of $$('.fx-deckrow small')) expect(s.classList.contains('fs-notstill')).toBe(true);
    await click(byText('.fs-sheet-words .fs-word', 'Edit'));
    expect($('.fx-edit input[type="date"]')!.closest('.fs-notstill')).toBeTruthy();
    const css = fs.readFileSync('src/ui/parts/parts.css', 'utf8');
    expect(css).toMatch(/\[data-light="still"\] \.fs-notstill[^{]*\{ display: none; \}/);
  });

  it('a card read locked opens nothing', async () => {
    const salt = randomSalt();
    const key = await deriveKey('2580', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    lock();
    await mount({ slot: 0 });
    expect(host.innerHTML).toBe('');
    await mount(null);
    await mount({ id: 'fx-conduit' });
    expect(host.innerHTML).toBe('');
    await unlock(key);
  });

  it('a deck row read locked shows nothing, on the deck or among the three', async () => {
    // a row whose name is sealed, read with no key in memory, comes back marked locked (db/fields.ts)
    const sealed = { v: 1 as const, iv: 'aaaa', ct: 'bbbb' };
    await db.fixations.put({ id: 'fx-sealed', name: '', hue: 40, createdAt: day(11, 2), stints: [], sealed });
    await mount({ slot: 2 });
    expect(rowNames()).toEqual(['Jazz piano', 'Conduit', 'Learning Chinese', 'Studying philosophy']);
    expect($$('.fx-deckrow').map(r => r.dataset.fx)).not.toContain('fx-sealed');
    await mount(null);
    await db.fixations.put({ id: 'fx-sealed-on', name: '', hue: 80, createdAt: day(11, 2), stints: [{ from: day(11, 1), slot: 0 }], sealed });
    await db.fixations.update('fx-flowstate', { stints: [{ from: day(11, 7), to: day(11, 8), slot: 0 }] });
    await mount({ id: 'fx-conduit' });
    expect(rowNames()).toEqual(['East Winds', 'Japan Trip']);
  });
});

describe('the deck sheet, small parts', () => {
  it('starts "+ fixation" on the hue furthest from every hue in use', () => {
    expect(freeHue([])).toBe(250);
    expect(freeHue([0])).toBe(180);
    expect(freeHue([0, 180])).toBe(90);
  });
  it('names the travel fx-slot-<slot>, for the card to share', () => {
    expect(slotName(2)).toBe('fx-slot-2');
    const src = fs.readFileSync('src/ui/flow/DeckSheet.tsx', 'utf8');
    expect(src).toMatch(/view-transition-name/);
    expect(src).toMatch(/\[data-fx-slot="\$\{into\}"\]/);
  });
});
