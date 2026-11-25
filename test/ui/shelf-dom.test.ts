// @vitest-environment jsdom
// Flow made plain (PLAN-WORLDS.md section 4, WF): the Flow tab is a shelf with one cover, My own pages, its name in the
// serif and "Open" in print; under it the last line written in the notebook with its date, then Meditate, Energize and
// Research as three circles, each a link to its own page, and Right now as a row. The last line is a journal entry's
// newest line with words, never a council's, a question's or a paper's title. Nothing of the mountain is drawn.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { LocationProvider } from 'preact-iso';
import { ensureSeeded } from '../../src/db/seed';
import { store, home, worn } from '../../src/db/fields';
import type { WorldEntry } from '../../src/db/schema';
import { wear } from '../../src/ui/notebook';
import { askTilt, lean, leanOf, resetTilt, LEAN_MAX } from '../../src/ui/flow/tilt';
import WORLDS from '../fixtures/worlds.json';
import { writeLine, askQuestion, lastLine } from '../../src/model/pages';
import { newCouncil, speak } from '../../src/model/council';
import { Flow } from '../../src/ui/flow/Flow';
import { Shelf } from '../../src/ui/flow/Shelf';
import { notebooks, OWN } from '../../src/model/notebooks';
import { freshDB } from '../db/helpers';

let root: HTMLElement;
beforeEach(async () => { await freshDB(); await ensureSeeded(); root = document.createElement('div'); document.body.append(root); });
afterEach(() => { act(() => { render(null, root); }); root.remove(); });

const flush = async () => { for (let i = 0; i < 30; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };
const at = (d: number, h = 9) => new Date(2026, 10, d, h).getTime();

describe('lastLine', () => {
  it('is none on an empty notebook', async () => {
    expect(await lastLine()).toBeUndefined();
  });

  it('is the newest journal line with words, by when it was written, wherever it sits', async () => {
    const a = await writeLine(undefined, undefined, { text: 'The first page.' }, at(20));
    await writeLine(a!.page, undefined, { text: '   ' }, at(20, 10));
    await writeLine(undefined, undefined, { text: 'Then the answer is not a list of people. It is the pace.' }, at(24));
    // a line written later on the earlier page is the newest
    await writeLine(a!.page, undefined, { text: '  Back on the first page.\n' }, at(25));
    expect(await lastLine()).toEqual({ text: 'Back on the first page.', at: at(25) });
  });

  it('a council, a question and a paper\'s title are not the journal\'s', async () => {
    await writeLine(undefined, undefined, { text: 'Mine.' }, at(20));
    const c = await newCouncil({ now: at(21) });
    await speak(c.id, 'A council line.', { now: at(21) });
    const q = await askQuestion('A question?', at(22));
    await writeLine(q, undefined, { text: 'An answer.' }, at(22));
    const p = await writeLine(undefined, undefined, { text: 'A paper', paper: { paperId: 'x', side: 'for' } }, at(23));
    expect(p?.message?.paper).toBeTruthy();
    expect((await lastLine())?.text).toBe('Mine.');
  });
});

describe('the shelf', () => {
  it('has one cover today, his own, and takes a list so more drop in', () => {
    expect(notebooks()).toEqual([OWN]);
    const other = { id: 'eastwinds', name: 'East Winds', sub: 'A novel', colour: { hue: 250 }, world: 'eastwinds', kind: 'novel' as const };
    act(() => { render(h(Shelf, { books: [OWN, other], worn: OWN.id, front: OWN.id }), root); });
    const covers = [...root.querySelectorAll<HTMLAnchorElement>('.fl-cover')];
    expect(covers.map(c => c.querySelector('.fl-cover-name')!.textContent)).toEqual(['My own pages', 'East Winds']);
    // the one worn says Open; another says what it is
    expect(covers.map(c => c.querySelector('.fl-cover-foot')!.textContent)).toEqual(['Open', 'A novel']);
    expect(covers[0].getAttribute('aria-current')).toBe('true');
    expect(covers[0].hasAttribute('data-front')).toBe(true);
    expect(covers[1].hasAttribute('data-front')).toBe(false);
    // the hue on the spine is a voice's, by the formula (rule 3); his own is the black voice
    expect(covers[0].style.getPropertyValue('--wc')).toBe('var(--v-black)');
    expect(covers[1].style.getPropertyValue('--wc')).toBe('oklch(var(--voice-l) calc(var(--voice-c) * 1) 250)');
  });

  it('the Flow tab: the cover, the last line with its date, the three circles and Right now, and nothing of the mountain', async () => {
    await writeLine(undefined, undefined, { text: 'Then the answer is not a list of people.' }, at(24));
    act(() => { render(h(LocationProvider, null, h(Flow, null)), root); });
    await flush();
    const cover = root.querySelector<HTMLAnchorElement>('.fl-cover')!;
    expect(cover.textContent).toBe('My own pagesOpen');
    expect(cover.getAttribute('href')).toBe('#/journal');
    const last = root.querySelector('.fl-lastline')!;
    expect(last.querySelector('small')!.textContent).toBe('11 / 24 / 26');
    expect(last.textContent).toBe('11 / 24 / 26 Then the answer is not a list of people.');
    expect(last.classList.contains('fs-quiet')).toBe(true);
    const circles = [...root.querySelectorAll<HTMLAnchorElement>('a.fl-circle')];
    expect(circles.map(a => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Meditate', '#/flow/meditate'], ['Energize', '#/flow/energize'], ['Research', '#/flow/research'],
    ]);
    // what travels to each page (rule 28): the two circles, and Research's name
    expect(circles.map(a => a.querySelector('[data-travel]')!.getAttribute('data-travel'))).toEqual(['md-circle', 'fs-drawing', 'rs-name']);
    expect(circles[2].querySelector('[data-travel]')!.tagName).toBe('SPAN');
    const rows = [...root.querySelectorAll<HTMLAnchorElement>('a.fs-row')];
    expect(rows.map(a => a.getAttribute('href'))).toEqual(['#/flow/now']);
    expect(rows[0].querySelector('.fs-list-line')!.textContent).toBe('Right now');
    expect(root.querySelector('.mt-plate, .mt-stop, .mt-circle, [href^="#/flow/c/"]')).toBeNull();
    // no counts anywhere (rule 15)
    expect(root.textContent).not.toMatch(/\b\d+ (pages?|lines?|flows?)\b/);
  });

  it('with nothing written the last line keeps its rule, empty', async () => {
    act(() => { render(h(LocationProvider, null, h(Flow, null)), root); });
    await flush();
    const last = root.querySelector('.fl-lastline')!;
    expect(last.textContent).toBe('');
    expect(last.hasAttribute('data-read')).toBe(true);
    expect(await store.all('pages')).toEqual([]);
  });
});

describe('the worlds on the shelf (PLAN-WORLDS.md W1, on test/fixtures/worlds.json)', () => {
  it('his own first, then each world in the registry\'s order, each with its kind\'s line and a hue on its spine', () => {
    const books = notebooks(WORLDS as WorldEntry[]);
    expect(books.map(b => [b.id, b.name, b.sub, b.kind, b.world])).toEqual([
      ['own', 'My own pages', 'Who to Be, How to Flow', 'own', null],
      ['eastwinds', 'East Winds', 'A novel', 'novel', 'eastwinds'],
      ['songbook', 'Songbook', 'Songs of no book', 'songs', 'songbook'],
    ]);
    expect(books.map(b => b.colour.hue)).toEqual([null, 250, 55]);
    // a hue the registry gives is the one worn
    expect(notebooks([{ id: 'x', name: 'X', kind: 'novel', hue: 150 }])[1].colour.hue).toBe(150);
  });

  it('with a world worn: its cover says Open and stands in front, its last line and its rows beneath, the header names it', async () => {
    await home().settings.update('app', { worlds: WORLDS as WorldEntry[] });
    await writeLine(undefined, undefined, { text: 'Mine.' }, at(20));
    await wear('eastwinds');
    await writeLine(undefined, undefined, { text: 'Siyuan leaves in the spring.' }, at(24));
    act(() => { render(h(LocationProvider, null, h(Flow, null)), root); });
    await flush();
    const covers = [...root.querySelectorAll<HTMLAnchorElement>('.fl-cover')];
    expect(covers.map(c => c.dataset.book)).toEqual(['own', 'eastwinds', 'songbook']);
    expect(covers.map(c => c.querySelector('.fl-cover-foot')!.textContent)).toEqual(['Who to Be, How to Flow', 'Open', 'Songs of no book']);
    expect(root.querySelector('.fl-cover[data-front]')!.getAttribute('data-book')).toBe('eastwinds');
    expect(root.querySelector('.fl-lastline')!.textContent).toBe('11 / 24 / 26 Siyuan leaves in the spring.');
    expect([...root.querySelectorAll<HTMLAnchorElement>('.fl-under a')].map(a => a.getAttribute('href'))).toEqual(['#/flow/songs', '#/flow/research']);
    expect(root.querySelector('.fs-hdr-world')!.textContent).toBe('East Winds');
    expect(root.textContent).not.toContain('Mine.');
    await wear(null);
    expect(worn()).toBeNull();
  });
});

describe('the lean (ui/flow/tilt.ts)', () => {
  afterEach(() => { resetTilt(); delete (window as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent; });
  it('is a few degrees with the phone, never past the most', () => {
    expect(leanOf(0)).toBe(0);
    expect(leanOf(10)).toBe(2);
    expect(leanOf(-90)).toBe(-LEAN_MAX);
    expect(leanOf(90)).toBe(LEAN_MAX);
    expect(leanOf(null)).toBe(0);
    expect(leanOf(Number.NaN)).toBe(0);
  });
  it('asks once; no, an error or no such event and nothing leans', async () => {
    expect(await askTilt()).toBe(false);
    resetTilt();
    let asked = 0;
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = Object.assign(function () { /* */ }, { requestPermission: async () => { asked++; return 'denied'; } });
    expect(await askTilt()).toBe(false);
    expect(await askTilt()).toBe(false);
    expect(asked).toBe(1);
    resetTilt();
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = Object.assign(function () { /* */ }, { requestPermission: async () => { throw new Error('not from a tap'); } });
    expect(await askTilt()).toBe(false);
    const el = document.createElement('div');
    const stop = lean(el);
    dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 30 }));
    expect(el.style.getPropertyValue('--lean')).toBe('');
    stop();
  });
  it('granted, the shelf leans with the phone', async () => {
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = Object.assign(function () { /* */ }, { requestPermission: async () => 'granted' });
    const el = document.createElement('div');
    const stop = lean(el);
    expect(await askTilt()).toBe(true);
    dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 15 }));
    await new Promise(r => requestAnimationFrame(() => r(undefined)));
    expect(el.style.getPropertyValue('--lean')).toBe('3.00deg');
    stop();
    expect(el.style.getPropertyValue('--lean')).toBe('');
  });
});
