// @vitest-environment jsdom
// A sign's questions (DESIGN.md rule 37; PLAN-BLOCKERS.md K2; flow/chakra/Asks.tsx): the first three open questions of
// the deck on the rules in italic, each a tap that writes the question on today's page as a wise line, with Resolve at
// its right. One resolved stays in its slot, grey with the check, until the page is left; on return the next in the
// deck stands in that slot. The block holds its room before the read and with every question resolved. Edit raises the
// deck sheet: every open question on a wrapping rule, a blank rule that adds one, an emptied rule that removes one, a
// deck under three filled back from the starters, then Resolved with dates and checks that bring one back. Locked,
// nothing; Still, the block leaves with the light.
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { act } from 'preact/test-utils';
const ticks: string[] = [];
vi.mock('../../src/ui/parts/Haptic', () => ({ tick: (k: string) => { ticks.push(k); } }));
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { setKey, lock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { loadSettings } from '../../src/ui/settings';
import { STARTER_ASKS, STARTER_DECK, deckOf, resolveAsk, setDeck, starterAskId } from '../../src/model/acts';
import { messagesOf, todayLinked } from '../../src/model/pages';
import { gate } from '../../src/ui/lock/pin';
import { still } from '../../src/ui/light';
import { HashLocation } from '../../src/ui/route';
import { pageCarry } from '../../src/ui/flow/chakra/carry';
import { notebookDate } from '../../src/ui/date';
import { Asks, asksRoomOf, slotsAfter, slotIdsOf } from '../../src/ui/flow/chakra/Asks';

// the app's own stylesheets, so "gone in Still" is the CSS saying so
const css = document.createElement('style');
css.textContent = readFileSync('src/ui/parts/parts.css', 'utf8') + readFileSync('src/ui/flow/chakra/Asks.css', 'utf8');
document.head.append(css);

const HEART = STARTER_DECK.heart;
let root: HTMLElement;
const settle = async (ms = 30) => { await act(async () => { await new Promise(r => setTimeout(r, ms)); }); };
const until = (check: () => Promise<void> | void) => vi.waitFor(async () => { await settle(10); await check(); }, { timeout: 4000 });
async function draw(node: VNode<any>, read = true) {
  root = document.createElement('div');
  document.body.append(root);
  await act(() => { render(h(HashLocation, null, node), root); });
  if (read) await until(() => { expect(root.querySelector('[data-asks]')).not.toBeNull(); });
  return root;
}
async function again() {
  render(null, root); root.remove();
  return draw(h(Asks, { chakra: 'heart' }));
}
const lines = () => [...root.querySelectorAll<HTMLButtonElement>('[data-asks] .ck-ask')];
const texts = () => lines().map(b => b.textContent);
const rows = () => [...root.querySelectorAll<HTMLElement>('[data-asks] .ck-ask-row')];
const resolves = () => [...root.querySelectorAll<HTMLButtonElement>('[data-asks] .fs-resolve')];
const sheet = () => document.querySelector<HTMLElement>('[data-sheet="Heart asks"]');
const rules = () => [...sheet()!.querySelectorAll<HTMLTextAreaElement>('.ck-deck textarea')];
const openSheet = async () => {
  await act(() => { root.querySelector<HTMLElement>('.ck-asks-edit .fs-word')!.click(); });
  await until(() => { expect(sheet()?.querySelector('.ck-deck')).not.toBeNull(); });
};
const write = async (i: number, text: string) => {
  await act(() => {
    const el = rules()[i];
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur'));
  });
  await settle(40);
};
const done = async () => {
  await act(() => { [...sheet()!.querySelectorAll<HTMLButtonElement>('.fs-word')].find(b => b.textContent === 'Done')!.click(); });
  await settle(40);
};

beforeEach(async () => {
  ticks.length = 0;
  await freshDB();
  await ensureSeeded(0);
  await loadSettings();
  gate.value = null;
  still.value = null;
  pageCarry.value = null;
  localStorage.clear();
  document.documentElement.dataset.light = 'day';
  location.hash = '#/flow/c/heart';
});
afterEach(() => { render(null, root); root.remove(); });

describe('a sign\'s questions on its page (rule 37, K2)', () => {
  it('three, the first three of the deck, italic, each with Resolve at its right, no number, then Edit', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    expect(texts()).toEqual([...STARTER_ASKS.heart]);
    expect(lines().every(b => b.classList.contains('fs-wise'))).toBe(true);
    expect(resolves()).toHaveLength(3);
    expect(resolves().every(r => r.getAttribute('aria-checked') === 'false' && r.textContent === 'Resolve')).toBe(true);
    // Resolve is beside the words, never inside the tap that opens the journal
    expect(rows().every(r => r.querySelector('.ck-ask .fs-resolve') === null)).toBe(true);
    const block = root.querySelector('[data-asks]')!;
    expect(block.classList.contains('fs-notstill')).toBe(true);
    expect(block.querySelector('.ck-asks-edit .fs-word')!.textContent).toBe('Edit');
    expect(block.textContent!.replace(/\?/g, '')).not.toMatch(/\d/);
  });

  it('a tap on the words writes the question on today\'s page as a wise line, once a day, and opens the journal on it', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    pageCarry.value = { tail: 'Dear ' };
    await act(() => { lines()[1].click(); });
    await until(() => { expect(location.hash).toBe('#/journal'); });
    expect(pageCarry.value).toBeNull();
    const page = await todayLinked({ sign: { chakra: 'heart' } });
    let ms = await messagesOf(page.id);
    expect(ms.map(m => [m.text, m.wise])).toEqual([[HEART[1], true]]);
    location.hash = '#/flow/c/heart';
    await settle();
    await act(() => { lines()[1].click(); });
    await until(() => { expect(location.hash).toBe('#/journal'); });
    ms = await messagesOf(page.id);
    expect(ms).toHaveLength(1);
    expect(ticks).toEqual([]);
  });

  it('a tap on Resolve resolves it with the tick; it keeps its slot, grey with the check, and the block stays three', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    await act(() => { resolves()[0].click(); });
    await settle(40);
    expect(ticks).toEqual(['check']);
    expect(location.hash).toBe('#/flow/c/heart');
    expect(texts()).toEqual([HEART[0], HEART[1], HEART[2]]);
    expect(rows()[0].classList.contains('done')).toBe(true);
    expect(resolves()[0].getAttribute('aria-checked')).toBe('true');
    expect(rows().slice(1).some(r => r.classList.contains('done'))).toBe(false);
    const deck = await deckOf('heart');
    expect(deck.resolved.map(q => q.id)).toEqual([starterAskId('heart', 0)]);
    // a tap on the check takes it back, still in its slot
    await act(() => { resolves()[0].click(); });
    await settle(40);
    expect(rows()[0].classList.contains('done')).toBe(false);
    expect((await deckOf('heart')).resolved).toEqual([]);
    expect(texts()).toEqual([HEART[0], HEART[1], HEART[2]]);
  });

  it('on return, the next in the deck stands in the slot of the one resolved', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    await act(() => { resolves()[0].click(); });
    await settle(40);
    await again();
    expect(texts()).toEqual([HEART[3], HEART[1], HEART[2]]);
    expect(rows().some(r => r.classList.contains('done'))).toBe(false);
    // the middle one next: the fifth stands there, the fourth keeps the first slot
    await act(() => { resolves()[1].click(); });
    await settle(40);
    expect(texts()).toEqual([HEART[3], HEART[1], HEART[2]]);
    await again();
    expect(texts()).toEqual([HEART[3], HEART[4], HEART[2]]);
    expect(slotIdsOf('heart')).toEqual([3, 4, 2].map(i => starterAskId('heart', i)));
  });

  it('slotsAfter: the first three open, each in its slot, a resolved one held while the page is up', () => {
    const q = (i: number, r?: number) => ({ id: `q${i}`, text: `Q${i}?`, ...(r ? { resolvedAt: r } : {}) });
    const deck = { open: [q(2), q(3), q(4), q(5)], resolved: [q(1, 9)] };
    expect(slotsAfter([], deck).map(x => x.id)).toEqual(['q2', 'q3', 'q4']);
    expect(slotsAfter([], deck, ['q1', 'q2', 'q3']).map(x => x.id)).toEqual(['q4', 'q2', 'q3']);
    expect(slotsAfter([q(1, 9), q(2), q(3)], deck).map(x => x.id)).toEqual(['q1', 'q2', 'q3']);
    // a slot never shows a question past the first three open
    expect(slotsAfter([], deck, ['q5', 'q2', 'q3']).map(x => x.id)).toEqual(['q4', 'q2', 'q3']);
  });

  it('holds its height from the read through a resolve: the same rows, the same words, the same room', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    const before = root.querySelector('[data-asks]')!.innerHTML.replace(/ (done|inked)/g, '').replace(/aria-checked="\w+"/g, '');
    await act(() => { resolves()[2].click(); });
    await settle(40);
    const after = root.querySelector('[data-asks]')!.innerHTML.replace(/ (done|inked)/g, '').replace(/aria-checked="\w+"/g, '');
    expect(after).toBe(before);
    expect(root.querySelector('[data-asks]')!.classList.contains('short')).toBe(false);
  });

  it('with every question resolved, what is left, in the room it took', async () => {
    localStorage.setItem('fs-asks-room-2', JSON.stringify({ heart: 8 }));
    const now = Date.now();
    for (let i = 0; i < 6; i++) await resolveAsk('heart', starterAskId('heart', i), true, now);
    await draw(h(Asks, { chakra: 'heart' }));
    expect(texts()).toEqual([HEART[6]]);
    const block = root.querySelector<HTMLElement>('[data-asks]')!;
    expect(block.classList.contains('short')).toBe(true);
    expect(block.style.getPropertyValue('--ck-ask-rules')).toBe('8');
    await resolveAsk('heart', starterAskId('heart', 6), true, now);
    await again();
    expect(lines()).toHaveLength(0);
    expect(root.querySelector('[data-asks]')!.classList.contains('short')).toBe(true);
    expect(root.querySelector('.ck-asks-edit .fs-word')).not.toBeNull();
  });

  it('with a flow\'s Edit on the page, the questions stay and their Edit leaves', async () => {
    await draw(h(Asks, { chakra: 'heart', edit: false }));
    expect(lines()).toHaveLength(3);
    expect(resolves()).toHaveLength(3);
    expect(root.querySelector('.ck-asks-edit')).toBeNull();
  });

  it('holds its room before the read: the starters unseen the first time, then the rules it took', async () => {
    expect(asksRoomOf('heart')).toBeNull();
    await draw(h(Asks, { chakra: 'heart' }), false);
    const wait = root.querySelector<HTMLElement>('.ck-asks.wait');
    expect(wait?.getAttribute('aria-hidden')).toBe('true');
    expect([...wait!.querySelectorAll('.ck-ask')].map(b => b.textContent)).toEqual([...STARTER_ASKS.heart]);
    expect(wait!.querySelectorAll('.fs-resolve')).toHaveLength(0);
    render(null, root); root.remove();
    localStorage.setItem('fs-asks-room-2', JSON.stringify({ heart: 7 }));
    expect(asksRoomOf('heart')).toBe(7);
    await draw(h(Asks, { chakra: 'heart' }), false);
    const held = root.querySelector<HTMLElement>('.ck-asks.wait')!;
    expect(held.style.getPropertyValue('--ck-ask-rules')).toBe('7');
    expect(held.querySelectorAll('.ck-ask')).toHaveLength(0);
    localStorage.setItem('fs-asks-room-2', JSON.stringify({ heart: 'x' }));
    expect(asksRoomOf('heart')).toBeNull();
  });

  it('locked (the door): nothing at all', async () => {
    const salt = randomSalt();
    await setKey(await deriveKey('2580', salt, 1000), { salt, iterations: 1000 });
    lock();
    gate.value = 'locked';
    await draw(h(Asks, { chakra: 'heart' }), false);
    await settle(60);
    expect(root.innerHTML).toBe('');
  });

  it('Still: the questions, Resolve and the check leave with the light, and a sheet open as it turns goes down', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    await act(() => { resolves()[0].click(); });
    await openSheet();
    await act(() => { still.value = { since: Date.now() }; document.documentElement.dataset.light = 'still'; });
    await settle(600);
    expect(sheet()).toBeNull();
    const block = root.querySelector<HTMLElement>('[data-asks]')!;
    expect(getComputedStyle(block).display).toBe('none');
    expect(resolves().every(r => r.classList.contains('fs-notstill'))).toBe(true);
  });
});

describe('the deck sheet (K2, step 10)', () => {
  it('every open question on a wrapping rule, whole, then a blank rule; nothing counted', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    await openSheet();
    expect(ticks).toEqual(['sheet']);
    expect(rules().map(r => r.value)).toEqual([...HEART, '']);
    // a rule is a wrapping field, not a one-line input, and set in italic as the questions are
    expect(rules().every(r => r.tagName === 'TEXTAREA' && r.classList.contains('fs-wise'))).toBe(true);
    expect(getComputedStyle(rules()[0]).whiteSpace).toBe('pre-wrap');
    expect(sheet()!.querySelector('.ck-deck-resolved')).toBeNull();
    expect(sheet()!.querySelector('.ck-asks-sheet')!.textContent!.replace(/\?/g, '')).not.toMatch(/\d/);
  });

  it('a rule rewritten is kept in its place; the blank rule adds one, and a new blank waits', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    await openSheet();
    await write(0, 'Who do you want to call?');
    await until(async () => { expect((await deckOf('heart')).open[0]).toEqual({ id: starterAskId('heart', 0), text: 'Who do you want to call?' }); });
    await until(() => { expect(texts()[0]).toBe('Who do you want to call?'); });
    await write(7, 'What would you say to them?');
    await until(async () => { expect((await deckOf('heart')).open.map(q => q.text).at(-1)).toBe('What would you say to them?'); });
    await until(() => { expect(rules().map(r => r.value).slice(-2)).toEqual(['What would you say to them?', '']); });
  });

  it('a rule emptied removes its question; a deck under three fills back up from the starters', async () => {
    await setDeck('heart', ['Who held you today?', 'What is heavy?']);
    // two of his, rewritten over the first two in their places, and the next starter not in it makes three again
    let open = (await deckOf('heart')).open.map(q => q.text);
    expect(open).toEqual(['Who held you today?', 'What is heavy?', HEART[2]]);
    await draw(h(Asks, { chakra: 'heart' }));
    await openSheet();
    expect(rules().map(r => r.value)).toEqual([...open, '']);
    await write(1, '');
    await until(async () => {
      open = (await deckOf('heart')).open.map(q => q.text);
      // the emptied rule's question is gone, and its starter comes back at the end (rule 37's "puts its starter back")
      expect(open).toEqual(['Who held you today?', HEART[2], HEART[1]]);
    });
    await until(() => { expect(rules().map(r => r.value)).toEqual([...open, '']); });
    await done();
    expect(sheet()).toBeNull();
    // on the page the starter stands back in the slot of the question it was (the same id), the rest in theirs
    await until(() => { expect(texts()).toEqual(['Who held you today?', HEART[1], HEART[2]]); });
  });

  it('Resolved, only when there is one: each resolved question with its date and its check; a tap brings it back', async () => {
    const day = new Date('2026-11-12T10:00:00').getTime();
    await resolveAsk('heart', starterAskId('heart', 1), true, day);
    await resolveAsk('heart', starterAskId('heart', 5), true, day + 86_400_000);
    await draw(h(Asks, { chakra: 'heart' }));
    await openSheet();
    const group = sheet()!.querySelector<HTMLElement>('.ck-deck-resolved')!;
    expect(group.querySelector('.fs-month')!.textContent).toBe('Resolved');
    const items = () => [...sheet()!.querySelectorAll<HTMLElement>('.ck-deck-done')];
    expect(items().map(r => r.querySelector('.ck-deck-text')!.textContent)).toEqual([HEART[1], HEART[5]]);
    expect(items().map(r => r.querySelector('.fs-list-meta')!.textContent)).toEqual([notebookDate(new Date(day)), notebookDate(new Date(day + 86_400_000))]);
    expect(items().every(r => r.querySelector('.fs-resolve')!.getAttribute('aria-checked') === 'true')).toBe(true);
    expect(rules().map(r => r.value)).not.toContain(HEART[1]);
    // the check brings it back, open again where it stood in the deck
    await act(() => { items()[0].querySelector<HTMLButtonElement>('.fs-resolve')!.click(); });
    await until(() => { expect(items()).toHaveLength(1); });
    expect(rules().map(r => r.value).slice(0, 3)).toEqual([HEART[0], HEART[1], HEART[2]]);
    expect((await deckOf('heart')).resolved.map(q => q.id)).toEqual([starterAskId('heart', 5)]);
    // the last one back: the word Resolved goes with it
    await act(() => { items()[0].querySelector<HTMLButtonElement>('.fs-resolve')!.click(); });
    await until(() => { expect(sheet()!.querySelector('.ck-deck-resolved')).toBeNull(); });
  });

  it('Return goes on to the next rule; on the blank rule, empty, it puts the sheet down', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    await openSheet();
    rules()[0].focus();
    await act(() => { rules()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(document.activeElement).toBe(rules()[1]);
    rules()[7].focus();
    await act(() => { rules()[7].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    await settle(600);
    expect(sheet()).toBeNull();
  });
});
