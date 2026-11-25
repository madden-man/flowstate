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
import { store } from '../../src/db/fields';
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
    const other = { id: 'eastwinds', name: 'East Winds', sub: 'A novel', colour: { hue: 250 } };
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
