// @vitest-environment jsdom
// A sign's shelf (PLAN-TASKS.md section 4, T5; flow/chakra/SignShelf.tsx) and the ♪ sheet's Signs segment
// (ui/music/Signs.tsx). An album is a tile: its cover when one is kept, else empty with its title on it, never a
// written row; with no account a tap opens it in Spotify. The page's plus is always there and raises the small sheet
// that writes a book, a piece of art or another line (Mountain R4); connected, its "+ album" goes on to the ♪ sheet and
// the chosen cover lands at the shelf's end. The room a shelf took is kept for the next first paint. A long press
// lifts, a tap places, keys move and take off; locked, nothing; Still, no editing.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { act } from 'preact/test-utils';
const ticks: string[] = [];
vi.mock('../../src/ui/parts/Haptic', () => ({ tick: (k: string) => { ticks.push(k); } }));
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { store, setKey, lock, unlock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { loadSettings, saveSettings } from '../../src/ui/settings';
import { STARTERS, addPick, shelf } from '../../src/model/acts';
import { CHAKRAS } from '../../src/model/mountain';
import { albumUriOf } from '../../src/db/seed/picks';
import { gate } from '../../src/ui/lock/pin';
import { still } from '../../src/ui/light';
import { openSheet } from '../../src/ui/sheets';
import { choosing, musicSegment, wake } from '../../src/ui/music/state';
import { SignShelf, Shelf, SHELF_KINDS, placeAt, moved, roomOf, keepRoom } from '../../src/ui/flow/chakra/SignShelf';
import { KIND_WORD, LINE_KINDS } from '../../src/ui/flow/On';
import { Signs } from '../../src/ui/music/Signs';
import { HOLD_MS } from '../../src/ui/parts/Hold';

let root: HTMLElement;
const settle = async (ms = 30) => { await act(async () => { await new Promise(r => setTimeout(r, ms)); }); };
/** Draws, and waits until each shelf has read itself (shelves: how many; none while locked). */
async function draw(node: VNode<any>, shelves = 1) {
  root = document.createElement('div');
  document.body.append(root);
  await act(() => { render(node, root); });
  await vi.waitFor(async () => { await settle(10); expect(root.querySelectorAll('[data-shelf]')).toHaveLength(shelves); }, { timeout: 4000 });
  await settle();
  return root;
}
/** Keeps a cover for each album, as the ♪ grid's reads would have. */
async function keepCovers(uris: string[]) {
  for (const albumUri of uris) await store.put('albums', { albumUri, album: albumUri, artist: 'X', cover: new Uint8Array([1, 2, 3]).buffer, coverType: 'image/jpeg', coverAt: Date.now() });
}
/** Waits for a write to be kept and read back. */
const until = (check: () => Promise<void> | void) => vi.waitFor(async () => { await settle(10); await check(); }, { timeout: 4000 });
const crownUris = () => STARTERS.crown.map(p => albumUriOf(p)!);

beforeEach(async () => {
  ticks.length = 0;
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
  await freshDB();
  await ensureSeeded(0);
  await loadSettings();
  gate.value = null;
  still.value = null;
  choosing.value = null;
  openSheet.value = null;
  localStorage.clear();
});
afterEach(() => { render(null, root); root.remove(); });

describe('the shelf on a sign (T5)', () => {
  it('its starters as empty tiles with their titles on them while no cover is kept, as covers once they are, wordless, in his order', async () => {
    let el = await draw(h(SignShelf, { chakra: 'crown' }));
    expect([...el.querySelectorAll<HTMLElement>('.fs-tile')].map(t => t.dataset.album)).toEqual(crownUris());
    expect(el.querySelectorAll('.ck-shelf-cover.blank')).toHaveLength(3);
    expect(el.querySelectorAll('.fs-tile img')).toHaveLength(0);
    expect([...el.querySelectorAll('.ck-shelf-name')].map(s => s.textContent)).toEqual(STARTERS.crown.map(p => p.title));
    // the title is print over the tile and leaves in Still; the tile itself names the album to a reader
    expect([...el.querySelectorAll('.ck-shelf-name')].every(n => n.classList.contains('fs-notstill') && n.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(el.querySelector('.fs-tile')!.getAttribute('aria-label')).toBe(`${STARTERS.crown[0].title}, ${STARTERS.crown[0].by}`);
    expect(el.querySelector('.ck-shelf-lines')).toBeNull();
    render(null, root); root.remove();
    await keepCovers(crownUris());
    el = await draw(h(SignShelf, { chakra: 'crown' }));
    const tiles = [...el.querySelectorAll<HTMLElement>('.fs-tile')];
    expect(tiles.map(t => t.dataset.album)).toEqual(crownUris());
    expect(el.querySelectorAll('.fs-tile img')).toHaveLength(3);
    expect(el.querySelectorAll('.ck-shelf-cover.blank')).toHaveLength(0);
    // covers are wordless: nothing is written in the row but the plus
    expect(el.querySelector('.ck-shelf-covers')!.textContent).toBe('+');
    expect(el.querySelector('.ck-shelf-lines')).toBeNull();
  });

  it('with no account a tap on a tile opens its album in Spotify and plays nothing from here', async () => {
    const went: string[] = [];
    const open = wake.open;
    wake.open = href => { went.push(href); };
    try {
      const el = await draw(h(SignShelf, { chakra: 'crown' }));
      await act(() => { el.querySelector<HTMLElement>('.fs-tile')!.click(); });
      expect(went).toEqual([`spotify:album:${STARTERS.crown[0].albumId}`]);
      expect(ticks).toEqual(['album']);
    } finally { wake.open = open; }
  });

  it('before it is read the page\'s shelf holds one row, or the room it took last time; a small row holds none', async () => {
    expect(roomOf('crown')).toEqual({ rows: 1, lines: 0 });
    keepRoom('crown', { rows: 2, lines: 3 });
    expect(roomOf('crown')).toEqual({ rows: 2, lines: 3 });
    expect(roomOf('heart')).toEqual({ rows: 1, lines: 0 });
    localStorage.setItem('fs-shelf-room', '{"crown":{"rows":"x","lines":-1}}');
    expect(roomOf('crown')).toEqual({ rows: 1, lines: 0 });
    localStorage.setItem('fs-shelf-room', 'not json');
    expect(roomOf('crown')).toEqual({ rows: 1, lines: 0 });
    keepRoom('crown', { rows: 2, lines: 3 });
    // the first draw, before any read
    root = document.createElement('div');
    document.body.append(root);
    await act(() => { render(h(SignShelf, { chakra: 'crown' }), root); });
    const wait = root.querySelector<HTMLElement>('.ck-shelf.wait')!;
    expect(wait.style.getPropertyValue('--ck-rows')).toBe('2');
    expect(wait.style.getPropertyValue('--ck-lines')).toBe('3');
    expect(wait.getAttribute('aria-hidden')).toBe('true');
    await until(() => { expect(root.querySelector('[data-shelf]')).not.toBeNull(); });
    // read: the room it takes now is what is kept (three tiles and the plus on one row, no lines)
    expect(root.querySelector('.ck-shelf.wait')).toBeNull();
    expect(roomOf('crown')).toEqual({ rows: 1, lines: 0 });
    await addPick('crown', { kind: 'art', title: 'The Great Wave' });
    render(null, root); root.remove();
    await draw(h(SignShelf, { chakra: 'crown' }));
    expect(roomOf('crown')).toEqual({ rows: 1, lines: 1 });
    render(null, root); root.remove();
    root = document.createElement('div');
    document.body.append(root);
    await act(() => { render(h(Shelf, { chakra: 'heart', small: true }), root); });
    expect(root.querySelector('.ck-shelf.small')).not.toBeNull();
    expect(root.querySelector('.ck-shelf.wait')).toBeNull();
    await until(() => { expect(root.querySelector('[data-shelf]')).not.toBeNull(); });
  });

  it('shows, films and books follow the covers as lines with their kind word', async () => {
    await keepCovers(crownUris());
    await addPick('crown', { kind: 'book', title: 'The Snow Leopard' });
    const el = await draw(h(SignShelf, { chakra: 'crown' }));
    expect(el.querySelectorAll('.fs-tile')).toHaveLength(3);
    expect(el.querySelector('.ck-shelf-line')!.textContent).toBe('The Snow Leopard Book');
  });

  it('the plus with no account raises the small sheet: a title under Book or Art is a line at the shelf\'s end (R4)', async () => {
    const el = await draw(h(SignShelf, { chakra: 'heart' }));
    const sheet = () => root.querySelector<HTMLElement>('[data-sheet="On the shelf"]');
    expect(sheet()).toBeNull();
    await act(() => { el.querySelector<HTMLElement>('.ck-shelf-plus')!.click(); });
    expect(ticks).toEqual(['sheet']);
    expect(openSheet.value).toBeNull();
    expect([...sheet()!.querySelectorAll('.fs-opt')].map(b => b.textContent)).toEqual(['Book', 'Art', 'Show', 'Film', 'Switch', 'Phone']);
    expect(sheet()!.querySelector('.fs-opt[aria-pressed="true"]')!.textContent).toBe('Book');
    // every written kind the step sheet's editor has, and a word for each
    expect([...SHELF_KINDS].sort()).toEqual([...LINE_KINDS].sort());
    expect(LINE_KINDS.slice().sort()).toEqual(Object.keys(KIND_WORD).filter(k => k !== 'album').sort());
    // no account, so no album to choose
    expect(sheet()!.querySelector('.fs-chip.add')).toBeNull();
    const add = () => [...sheet()!.querySelectorAll<HTMLElement>('.fs-word')].find(b => b.textContent === 'Add')!;
    // nothing written, nothing added
    expect(add().getAttribute('aria-disabled')).toBe('true');
    await act(() => { add().click(); });
    expect((await shelf('heart')).map(p => p.title)).toEqual(STARTERS.heart.map(p => p.title));
    const write = async (text: string) => {
      const input = sheet()!.querySelector<HTMLInputElement>('input.fs-input')!;
      input.value = text;
      await act(() => { input.dispatchEvent(new Event('input', { bubbles: true })); });
    };
    await write('  The Snow Leopard ');
    await act(() => { add().click(); });
    await until(async () => { expect((await shelf('heart')).at(-1)).toMatchObject({ kind: 'book', title: 'The Snow Leopard' }); });
    await until(() => { expect([...el.querySelectorAll('.ck-shelf-line')].map(l => l.textContent)).toEqual(['The Snow Leopard Book']); });
    // again, as art, by the keyboard's Enter
    await act(() => { el.querySelector<HTMLElement>('.ck-shelf-plus')!.click(); });
    expect(sheet()!.querySelector<HTMLInputElement>('input.fs-input')!.value).toBe('');
    await act(() => { [...sheet()!.querySelectorAll<HTMLElement>('.fs-opt')].find(b => b.textContent === 'Art')!.click(); });
    await write('The Great Wave');
    await act(() => { sheet()!.querySelector('input.fs-input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    await until(async () => { expect((await shelf('heart')).slice(3).map(p => [p.kind, p.title])).toEqual([['book', 'The Snow Leopard'], ['art', 'The Great Wave']]); });
    await until(() => { expect([...el.querySelectorAll('.ck-shelf-line')].map(l => l.textContent)).toEqual(['The Snow Leopard Book', 'The Great Wave Art']); });
    // every rise starts on Book, whatever was chosen last
    await act(() => { el.querySelector<HTMLElement>('.ck-shelf-plus')!.click(); });
    expect(sheet()!.querySelector('.fs-opt[aria-pressed="true"]')!.textContent).toBe('Book');
    // a line is taken off as a cover is: Delete on it
    await act(() => { el.querySelector<HTMLElement>('.ck-shelf-line')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); });
    await until(async () => { expect((await shelf('heart')).slice(3).map(p => p.title)).toEqual(['The Great Wave']); });
  });

  it('connected, the sheet\'s "+ album" raises the ♪ sheet to choose from, and the cover chosen goes on the end', async () => {
    await saveSettings({ spotify: { connectedAt: 1, tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 600_000, name: 'T' } } });
    musicSegment.value = 'signs';
    const el = await draw(h(SignShelf, { chakra: 'heart' }));
    await act(() => { el.querySelector<HTMLElement>('.ck-shelf-plus')!.click(); });
    expect(openSheet.value).toBeNull();
    await act(() => { root.querySelector<HTMLElement>('[data-sheet="On the shelf"] .fs-chip.add')!.click(); });
    expect(openSheet.value).toBe('music');
    expect(choosing.value).not.toBeNull();
    expect(musicSegment.value).toBe('signs');
    await act(() => { choosing.value!({ albumUri: 'spotify:album:Takk', album: 'Takk...', artist: 'Sigur Rós' } as never); });
    await until(async () => { expect((await shelf('heart')).map(p => p.title)).toEqual([...STARTERS.heart.map(p => p.title), 'Takk...']); });
    const kept = await shelf('heart');
    expect(kept.at(-1)!.albumId).toBe('Takk');
    expect(ticks).toContain('album');
  });

  it('a small row\'s plus is only there connected, and goes straight to the ♪ sheet', async () => {
    let el = await draw(h(Shelf, { chakra: 'heart', small: true }));
    expect(el.querySelector('.ck-shelf-plus')).toBeNull();
    expect(el.querySelectorAll('.fs-tile')).toHaveLength(3);
    expect(el.querySelector('.ck-shelf-name')).toBeNull();
    render(null, root); root.remove();
    await saveSettings({ spotify: { connectedAt: 1, tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 600_000, name: 'T' } } });
    el = await draw(h(Shelf, { chakra: 'heart', small: true }));
    await act(() => { el.querySelector<HTMLElement>('.ck-shelf-plus')!.click(); });
    expect(openSheet.value).toBe('music');
    expect(choosing.value).not.toBeNull();
    expect(root.querySelector('[data-sheet="On the shelf"]')).toBeNull();
  });

  it('keys: Alt and an arrow moves a cover along the covers, Delete takes it off; each a drop', async () => {
    await keepCovers(crownUris());
    const el = await draw(h(SignShelf, { chakra: 'crown' }));
    const first = el.querySelector<HTMLElement>('.fs-tile')!;
    await act(() => { first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true })); });
    const ids = STARTERS.crown.map(p => p.id);
    await until(async () => { expect((await shelf('crown')).map(p => p.id)).toEqual([ids[1], ids[0], ids[2]]); });
    const last = [...el.querySelectorAll<HTMLElement>('.fs-tile')].at(-1)!;
    await act(() => { last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); });
    await until(async () => { expect((await shelf('crown')).map(p => p.id)).toEqual([ids[1], ids[0]]); });
    await vi.waitFor(async () => { await settle(); expect(el.querySelectorAll('.fs-tile')).toHaveLength(2); });
    expect(ticks.filter(t => t === 'drop')).toHaveLength(2);
  });

  it('a long press lifts without playing; a tap on another puts it in that place; the struck place takes it off', async () => {
    await keepCovers(crownUris());
    const el = await draw(h(SignShelf, { chakra: 'crown' }));
    const ids = STARTERS.crown.map(p => p.id);
    const cell = (id: string) => el.querySelector<HTMLElement>(`[data-pick="${id}"]`)!;
    const press = async (id: string) => {
      const t = cell(id).querySelector<HTMLElement>('.fs-tile')!;
      await act(() => { t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, button: 0 })); });
      await settle(HOLD_MS + 40);
      await act(() => { dispatchEvent(new PointerEvent('pointerup', { clientX: 10, clientY: 10 })); });
      await act(() => { t.click(); });
    };
    await press(ids[0]);
    expect(cell(ids[0]).classList.contains('lift')).toBe(true);
    expect(ticks).not.toContain('album');
    expect(el.querySelector('.ck-shelf-off')).not.toBeNull();
    await act(() => { cell(ids[2]).querySelector<HTMLElement>('.fs-tile')!.click(); });
    await until(async () => { expect((await shelf('crown')).map(p => p.id)).toEqual([ids[1], ids[2], ids[0]]); });
    expect(el.querySelector('.lift')).toBeNull();
    await press(ids[1]);
    await act(() => { el.querySelector<HTMLElement>('.ck-shelf-off')!.click(); });
    await until(async () => { expect((await shelf('crown')).map(p => p.id)).toEqual([ids[2], ids[0]]); });
  });

  it('locked (the door): no shelf at all, never an empty one; open again, his shelf', async () => {
    const salt = randomSalt();
    const key = await deriveKey('2580', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    lock();
    gate.value = 'locked';
    let el = await draw(h(SignShelf, { chakra: 'root' }), 0);
    expect(el.innerHTML).toBe('');
    render(null, root); root.remove();
    expect(await unlock(key)).toBe(true);
    gate.value = 'open';
    el = await draw(h(SignShelf, { chakra: 'root' }));
    expect(el.querySelectorAll('.fs-tile')).toHaveLength(3);
  });

  it('Still: no plus and nothing lifts or moves; the lines leave with the light', async () => {
    await saveSettings({ spotify: { connectedAt: 1, tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 600_000, name: 'T' } } });
    still.value = { since: Date.now() };
    await addPick('sacral', { kind: 'book', title: 'The Snow Leopard' });
    const el = await draw(h(SignShelf, { chakra: 'sacral' }));
    expect(el.querySelector('.ck-shelf-plus')).toBeNull();
    expect(root.querySelector('[data-sheet="On the shelf"]')).toBeNull();
    expect(el.querySelector('.ck-shelf-lines')!.classList.contains('fs-notstill')).toBe(true);
    // the empty tiles stay, as covers do
    expect(el.querySelectorAll('.fs-tile')).toHaveLength(3);
    const line = el.querySelector<HTMLElement>('.ck-shelf-line')!;
    await act(() => { line.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); });
    await act(() => { el.querySelector<HTMLElement>('.fs-tile')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); });
    await settle(100);
    expect(await shelf('sacral')).toHaveLength(4);
  });

  it('places by the nearest of its kind, after it past its middle', () => {
    const box = (left: number) => ({ left, top: 0, width: 60, height: 60 });
    const others = [{ index: 0, box: box(0) }, { index: 1, box: box(70) }];
    expect(placeAt(others, 10, 30, 'x', 2)).toBe(0);
    expect(placeAt(others, 50, 30, 'x', 2)).toBe(1);
    expect(placeAt(others, 120, 30, 'x', 2)).toBe(2);
    expect(placeAt([], 0, 0, 'x', 3)).toBe(3);
    const p = (id: string) => ({ id, kind: 'show' as const, title: id });
    expect(moved([p('a'), p('b'), p('c')], 'a', 2).map(x => x.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('the Signs segment (T5)', () => {
  it('seven rows summit to foot, each name on its hue opening its page, each with its shelf', async () => {
    openSheet.value = 'music';
    const el = await draw(h(Signs, {}), 7);
    const rows = [...el.querySelectorAll<HTMLElement>('.ck-sign-row')];
    expect(rows.map(r => r.querySelector('.ck-sign-name')!.textContent)).toEqual(CHAKRAS.map(c => c.name));
    expect(rows.map(r => r.style.getPropertyValue('--h'))).toEqual(CHAKRAS.map(c => String(c.hue)));
    expect(rows.map(r => r.querySelector('a')!.getAttribute('href'))).toEqual(CHAKRAS.map(c => `#/flow/c/${c.id}`));
    expect(rows.every(r => r.querySelectorAll('.fs-tile').length === 3 && !r.querySelector('.ck-shelf-line'))).toBe(true);
    await act(() => { rows[3].querySelector<HTMLElement>('a')!.click(); });
    expect(openSheet.value).toBeNull();
  });
});
