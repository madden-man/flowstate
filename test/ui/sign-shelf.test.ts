// @vitest-environment jsdom
// A sign's shelf (PLAN-TASKS.md section 4, T5; flow/chakra/SignShelf.tsx) and the ♪ sheet's Signs segment
// (ui/music/Signs.tsx). Covers only when kept, else written lines; the plus only connected, and the chosen cover lands
// at the shelf's end; a long press lifts, a tap places, keys move and take off; locked, nothing; Still, no editing.
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
import { choosing, musicSegment } from '../../src/ui/music/state';
import { SignShelf, placeAt, moved } from '../../src/ui/flow/chakra/SignShelf';
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
});
afterEach(() => { render(null, root); root.remove(); });

describe('the shelf on a sign (T5)', () => {
  it('its starters as written lines while no cover is kept, as covers once they are, wordless, in his order', async () => {
    let el = await draw(h(SignShelf, { chakra: 'crown' }));
    expect(el.querySelectorAll('.fs-tile')).toHaveLength(0);
    expect([...el.querySelectorAll('.ck-shelf-line span')].map(s => s.textContent)).toEqual(STARTERS.crown.map(p => p.title));
    expect(el.querySelector('.ck-shelf-line small')!.textContent).toBe('Album');
    render(null, root); root.remove();
    await keepCovers(crownUris());
    el = await draw(h(SignShelf, { chakra: 'crown' }));
    const tiles = [...el.querySelectorAll<HTMLElement>('.fs-tile')];
    expect(tiles.map(t => t.dataset.album)).toEqual(crownUris());
    expect(el.querySelector('.ck-shelf-covers')!.textContent).toBe('');
    expect(el.querySelector('.ck-shelf-lines')).toBeNull();
  });

  it('shows, films and books follow the covers as lines with their kind word', async () => {
    await keepCovers(crownUris());
    await addPick('crown', { kind: 'book', title: 'The Snow Leopard' });
    const el = await draw(h(SignShelf, { chakra: 'crown' }));
    expect(el.querySelectorAll('.fs-tile')).toHaveLength(3);
    expect(el.querySelector('.ck-shelf-line')!.textContent).toBe('The Snow Leopard Book');
  });

  it('the plus only when connected; it raises the ♪ sheet to choose from, and the cover chosen goes on the end', async () => {
    let el = await draw(h(SignShelf, { chakra: 'heart' }));
    expect(el.querySelector('.ck-shelf-plus')).toBeNull();
    render(null, root); root.remove();
    await saveSettings({ spotify: { connectedAt: 1, tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 600_000, name: 'T' } } });
    musicSegment.value = 'signs';
    el = await draw(h(SignShelf, { chakra: 'heart' }));
    await act(() => { el.querySelector<HTMLElement>('.ck-shelf-plus')!.click(); });
    expect(openSheet.value).toBe('music');
    expect(choosing.value).not.toBeNull();
    expect(musicSegment.value).toBe('signs');
    await act(() => { choosing.value!({ albumUri: 'spotify:album:Takk', album: 'Takk...', artist: 'Sigur Rós' } as never); });
    await until(async () => { expect((await shelf('heart')).map(p => p.title)).toEqual([...STARTERS.heart.map(p => p.title), 'Takk...']); });
    const kept = await shelf('heart');
    expect(kept.at(-1)!.albumId).toBe('Takk');
    expect(ticks).toContain('album');
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
    expect(el.querySelectorAll('.ck-shelf-line')).toHaveLength(3);
  });

  it('Still: no plus and nothing lifts or moves; the lines leave with the light', async () => {
    await saveSettings({ spotify: { connectedAt: 1, tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 600_000, name: 'T' } } });
    still.value = { since: Date.now() };
    const el = await draw(h(SignShelf, { chakra: 'sacral' }));
    expect(el.querySelector('.ck-shelf-plus')).toBeNull();
    expect(el.querySelector('.ck-shelf-lines')!.classList.contains('fs-notstill')).toBe(true);
    const line = el.querySelector<HTMLElement>('.ck-shelf-line')!;
    await act(() => { line.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); });
    await settle(100);
    expect(await shelf('sacral')).toHaveLength(3);
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
    expect(rows.every(r => r.querySelectorAll('.ck-shelf-line').length === 3)).toBe(true);
    await act(() => { rows[3].querySelector<HTMLElement>('a')!.click(); });
    expect(openSheet.value).toBeNull();
  });
});
