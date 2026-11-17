// @vitest-environment jsdom
// The question that always shows (PLAN-SIGN-LINES.md section 5, L2; DESIGN.md rule 37): one fixed grounding question a
// sign (model/acts.ts GROUND_ASKS), first in the questions block over whatever the deck gives, with no Resolve, never in
// the deck sheet, never rewritable, never on the ? tab. A tap writes it on today's page as a wise line, once a day.
// Through the door it is print on the sign's page; in Still it leaves with the block.
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { act } from 'preact/test-utils';
vi.mock('../../src/ui/parts/Haptic', () => ({ tick: () => {} }));
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { loadSettings } from '../../src/ui/settings';
import { GROUND_ASKS, STARTER_ASKS, STARTER_DECK, deckOf, resolveAsk, setDeck, starterAskId } from '../../src/model/acts';
import { CHAKRA_IDS } from '../../src/model/mountain';
import { messagesOf, questions, todayLinked } from '../../src/model/pages';
import { gate } from '../../src/ui/lock/pin';
import { still } from '../../src/ui/light';
import { HashLocation } from '../../src/ui/route';
import { pageCarry } from '../../src/ui/flow/chakra/carry';
import { Asks, ROOM_KEY } from '../../src/ui/flow/chakra/Asks';

const css = document.createElement('style');
css.textContent = readFileSync('src/ui/parts/parts.css', 'utf8') + readFileSync('src/ui/flow/chakra/Asks.css', 'utf8');
document.head.append(css);

// the plan's drafts, verbatim (PLAN-SIGN-LINES.md section 5)
const DRAFTS = {
  crown: 'Breathe out slower than you breathed in. What can you set down for that long?',
  'third-eye': 'Look at the farthest thing you can see. What is actually in front of you?',
  throat: 'Say it once, out loud, to the room. What is the sentence?',
  heart: 'Hand on your chest for three breaths. What is it holding?',
  'solar-plexus': 'Stand up and drop your shoulders. What can your hands finish in ten minutes?',
  sacral: 'Find where the feeling sits. Does it move when you breathe into it?',
  root: 'Feel your feet on the floor. What are five things you can see?',
};
const HEART = GROUND_ASKS.heart;

let root: HTMLElement | null = null;
const settle = async (ms = 30) => { await act(async () => { await new Promise(r => setTimeout(r, ms)); }); };
const until = (check: () => Promise<void> | void) => vi.waitFor(async () => { await settle(10); await check(); }, { timeout: 4000 });
async function draw(node: VNode<any>, read = true): Promise<HTMLElement> {
  const el = document.createElement('div');
  root = el;
  document.body.append(el);
  await act(() => { render(h(HashLocation, null, node), el); });
  if (read) await until(() => { expect(el.querySelector('[data-asks]')).not.toBeNull(); });
  return el;
}
const block = () => root!.querySelector<HTMLElement>('[data-asks]')!;
const ground = () => block().querySelector<HTMLButtonElement>('button.ck-ground');
const deckTexts = () => [...block().querySelectorAll('.ck-ask')].map(b => b.textContent);
const sheet = () => document.querySelector<HTMLElement>('[data-sheet="Heart asks"]');

beforeEach(async () => {
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
afterEach(() => { if (root) { render(null, root); root.remove(); root = null; } });

describe('GROUND_ASKS', () => {
  it('one a sign, the plan\'s drafts verbatim, fixed and frozen', () => {
    expect(Object.keys(GROUND_ASKS).sort()).toEqual([...CHAKRA_IDS].sort());
    expect({ ...GROUND_ASKS }).toEqual(DRAFTS);
    expect(Object.isFrozen(GROUND_ASKS)).toBe(true);
    expect(() => { (GROUND_ASKS as Record<string, string>).heart = 'Something else?'; }).toThrow();
    expect(GROUND_ASKS.heart).toBe(DRAFTS.heart);
  });

  it('never in the deck, never a starter, no em dash, no number', () => {
    for (const c of CHAKRA_IDS) {
      expect(STARTER_DECK[c]).not.toContain(GROUND_ASKS[c]);
      expect(STARTER_ASKS[c]).not.toContain(GROUND_ASKS[c]);
      expect(GROUND_ASKS[c]).not.toMatch(/[\u2014\u2013\d]/);
    }
  });

  it('not rewritable: a deck written whole, resolved or emptied leaves it as it was and never takes it in', async () => {
    await setDeck('heart', ['Who held you today?', 'What is heavy?', 'What was good?']);
    await resolveAsk('heart', starterAskId('heart', 4), true);
    const deck = await deckOf('heart');
    expect([...deck.open, ...deck.resolved].map(q => q.text)).not.toContain(HEART);
    expect(GROUND_ASKS.heart).toBe(DRAFTS.heart);
  });
});

describe('on a sign\'s page', () => {
  it('first in the block, over the deck\'s three, italic, with no Resolve and no field', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    const first = block().firstElementChild!;
    expect(first.getAttribute('data-ground')).toBe('heart');
    expect(ground()!.textContent).toBe(HEART);
    expect(ground()!.classList.contains('fs-wise')).toBe(true);
    expect(first.querySelector('.fs-resolve, textarea, input')).toBeNull();
    expect(first.classList.contains('ck-ask-row')).toBe(false);
    // the deck's three are drawn as before, each with its Resolve
    expect(deckTexts()).toEqual([...STARTER_ASKS.heart]);
    expect(block().querySelectorAll('.ck-ask-row .fs-resolve')).toHaveLength(3);
  });

  it('drawn over whatever the deck gives: a rewritten, resolved or emptied deck leaves it first and the same', async () => {
    await setDeck('heart', ['Who held you today?']);
    const now = Date.now();
    for (const q of (await deckOf('heart')).open) await resolveAsk('heart', q.id, true, now);
    expect((await deckOf('heart')).open).toEqual([]);
    await draw(h(Asks, { chakra: 'heart' }));
    expect(deckTexts()).toEqual([]);
    expect(block().firstElementChild!.getAttribute('data-ground')).toBe('heart');
    expect(ground()!.textContent).toBe(HEART);
  });

  it('never in the deck sheet', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    await act(() => { block().querySelector<HTMLElement>('.ck-asks-edit .fs-word')!.click(); });
    await until(() => { expect(sheet()?.querySelector('.ck-deck')).not.toBeNull(); });
    const rules = [...sheet()!.querySelectorAll<HTMLTextAreaElement>('.ck-deck textarea')].map(r => r.value);
    expect(rules).toEqual([...STARTER_DECK.heart, '']);
    expect(sheet()!.textContent).not.toContain(HEART);
    expect(sheet()!.querySelector('[data-ground]')).toBeNull();
  });

  it('a tap writes it on today\'s page as a wise line, once a day; it resolves nothing and is never on the ? tab', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    const before = await deckOf('heart');
    await act(() => { ground()!.click(); });
    await until(() => { expect(location.hash).toBe('#/journal'); });
    const page = await todayLinked({ sign: { chakra: 'heart' } });
    let ms = await messagesOf(page.id);
    expect(ms.map(m => [m.text, m.wise])).toEqual([[HEART, true]]);
    location.hash = '#/flow/c/heart';
    await settle();
    await act(() => { ground()!.click(); });
    await until(() => { expect(location.hash).toBe('#/journal'); });
    ms = await messagesOf(page.id);
    expect(ms).toHaveLength(1);
    expect(await questions()).toEqual([]);
    expect(await deckOf('heart')).toEqual(before);
  });

  it('counted into the room before the read: unseen with the starters the first time; an older room is not read', async () => {
    localStorage.setItem('fs-asks-room', JSON.stringify({ heart: 6 }));
    let el = await draw(h(Asks, { chakra: 'heart' }), false);
    const wait = el.querySelector<HTMLElement>('.ck-asks.wait')!;
    expect(wait.getAttribute('aria-hidden')).toBe('true');
    expect(wait.style.getPropertyValue('--ck-ask-rules')).toBe('');
    expect(wait.firstElementChild!.textContent).toBe(HEART);
    expect(wait.querySelectorAll('.ck-ask')).toHaveLength(3);
    render(null, el); el.remove();
    localStorage.setItem(ROOM_KEY, JSON.stringify({ heart: 9 }));
    el = await draw(h(Asks, { chakra: 'heart' }), false);
    const held = el.querySelector<HTMLElement>('.ck-asks.wait')!;
    expect(held.style.getPropertyValue('--ck-ask-rules')).toBe('9');
    expect(held.querySelector('[data-ground]')).toBeNull();
  });

  it('Still: it leaves with the block', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    await act(() => { still.value = { since: Date.now() }; document.documentElement.dataset.light = 'still'; });
    await settle(100);
    expect(getComputedStyle(block()).display).toBe('none');
  });
});

describe('through the door', () => {
  it('print on the sign\'s page: its words, no tap, none of the deck, gone in Still', async () => {
    const { DoorChakraPage } = await import('../../src/ui/flow/ChakraPage');
    const el = await draw(h(DoorChakraPage, { chakra: 'root' }), false);
    await settle();
    const p = el.querySelector<HTMLElement>('.ck-page[data-door] [data-ground="root"]')!;
    expect(p.tagName).toBe('P');
    expect(p.textContent).toBe(GROUND_ASKS.root);
    expect(p.classList.contains('fs-wise')).toBe(true);
    expect(p.classList.contains('fs-notstill')).toBe(true);
    expect(p.querySelector('button, a')).toBeNull();
    expect(el.querySelector('.ck-asks, .ck-ask, .fs-resolve')).toBeNull();
    for (const q of STARTER_ASKS.root) expect(el.textContent).not.toContain(q);
    // under the gloss, over the 988 line
    const order = [...el.querySelectorAll('.ck-gloss, [data-ground], .ck-safe')].map(e => e.className.split(' ')[0]);
    expect(order).toEqual(['ck-gloss', 'ck-ground', 'ck-safe']);
  });
});
