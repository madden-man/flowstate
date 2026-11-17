// @vitest-environment jsdom
// Resolve on a journal line (PLAN-BLOCKERS.md K2, section 3 step 11; journal/PageView.tsx): on a page linked to a
// sign, a wise line whose words are an open question of that sign's deck carries Resolve at its right. A tap resolves
// the question in the deck (resolveAsk) and the line goes grey with the check, staying so until the page is left; a
// tap on the check takes it back. A plain line, a wise line that is not one of the deck, a question already resolved
// when the page opened and a page with no sign carry none. Gone in Still.
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';

const feel = vi.hoisted(() => ({ ticks: [] as string[] }));
vi.mock('../../src/ui/parts/Haptic', () => ({ tick: (n: string) => { feel.ticks.push(n); } }));

import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { loadSettings } from '../../src/ui/settings';
import { HashLocation } from '../../src/ui/route';
import { still } from '../../src/ui/light';
import { gate } from '../../src/ui/lock/pin';
import { PageView } from '../../src/ui/journal/PageView';
import { STARTER_DECK, deckOf, resolveAsk, starterAskId } from '../../src/model/acts';
import { askInJournal } from '../../src/model/into';
import { todayLinked, writeLine } from '../../src/model/pages';

const css = document.createElement('style');
css.textContent = readFileSync('src/ui/parts/parts.css', 'utf8');
document.head.append(css);

const HEART = STARTER_DECK.heart;
let root: HTMLElement;
const wait = (ms = 0) => new Promise(r => setTimeout(r, ms));
const settle = async () => { for (let i = 0; i < 25; i++) await act(async () => { await wait(2); }); };
const lineOf = (text: string) => [...root.querySelectorAll<HTMLElement>('.fs-msg')].find(m => m.querySelector('p')?.textContent === text)!;
const resolveOf = (text: string) => lineOf(text)?.querySelector<HTMLButtonElement>('.fs-resolve') ?? null;
const mount = async () => { await act(() => { render(h(HashLocation, null, h(PageView, { section: 'journal' })), root); }); await settle(); };

beforeEach(async () => {
  Element.prototype.scrollIntoView ??= () => undefined;
  await freshDB();
  await ensureSeeded(7);
  await loadSettings();
  gate.value = null;
  still.value = null;
  feel.ticks = [];
  localStorage.clear();
  document.documentElement.dataset.light = 'day';
  location.hash = '#/journal';
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(async () => { await act(() => { render(null, root); }); root.remove(); document.documentElement.dataset.light = 'day'; });

describe('Resolve on a journal line (step 11)', () => {
  it('a sign\'s open question as a wise line carries Resolve; a tap resolves it in the deck, grey with the check', async () => {
    await askInJournal('heart', HEART[1]);
    const page = await todayLinked({ sign: { chakra: 'heart' } });
    await writeLine(page, undefined, { text: 'Mostly the move.' });
    await writeLine(page, undefined, { text: 'Not a question of the deck?', wise: true });
    await mount();
    const r = resolveOf(HEART[1])!;
    expect(r).not.toBeNull();
    expect(r.textContent).toBe('Resolve');
    expect(r.getAttribute('aria-checked')).toBe('false');
    expect(resolveOf('Mostly the move.')).toBeNull();
    expect(resolveOf('Not a question of the deck?')).toBeNull();

    await act(() => { r.click(); });
    await settle();
    expect(feel.ticks).toEqual(['check']);
    expect((await deckOf('heart')).resolved.map(q => q.id)).toEqual([starterAskId('heart', 1)]);
    // the line stays, grey, with the check where the word was; the tap did not open the line for writing
    expect(lineOf(HEART[1]).classList.contains('fs-resolved')).toBe(true);
    expect(resolveOf(HEART[1])!.getAttribute('aria-checked')).toBe('true');
    expect(root.querySelector('.fs-msg.fs-wise textarea')).toBeNull();

    // the check takes it back
    await act(() => { resolveOf(HEART[1])!.click(); });
    await settle();
    expect((await deckOf('heart')).resolved).toEqual([]);
    expect(lineOf(HEART[1]).classList.contains('fs-resolved')).toBe(false);
  });

  it('a question resolved before the page opened, and a page with no sign, carry none', async () => {
    await askInJournal('heart', HEART[0]);
    await resolveAsk('heart', starterAskId('heart', 0), true);
    await mount();
    expect(lineOf(HEART[0])).toBeTruthy();
    expect(resolveOf(HEART[0])).toBeNull();

    await act(() => { render(null, root); });
    await freshDB();
    await ensureSeeded(7);
    await writeLine(undefined, undefined, { text: HEART[2], wise: true });
    await mount();
    expect(lineOf(HEART[2])).toBeTruthy();
    expect(resolveOf(HEART[2])).toBeNull();
  });

  it('Still: Resolve leaves and the line is ink again', async () => {
    await askInJournal('heart', HEART[1]);
    await mount();
    await act(() => { resolveOf(HEART[1])!.click(); });
    await settle();
    document.documentElement.dataset.light = 'still';
    expect(getComputedStyle(resolveOf(HEART[1])!).display).toBe('none');
  });
});
