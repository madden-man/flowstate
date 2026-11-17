// @vitest-environment jsdom
// A sign's three questions (DESIGN.md rule 37; flow/chakra/Asks.tsx): the starters on the rules in italic, each a tap
// that writes the question on today's page as a wise line and opens the journal there; Edit raises a sheet whose rules
// rewrite them, an empty one putting its starter back. Locked, nothing; Still, the block leaves with the light; with a
// flow's Edit on the page, theirs leaves. The block holds its room before it has been read.
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
import { STARTER_ASKS, asksOf, setAsk } from '../../src/model/acts';
import { messagesOf, todayLinked } from '../../src/model/pages';
import { gate } from '../../src/ui/lock/pin';
import { still } from '../../src/ui/light';
import { HashLocation } from '../../src/ui/route';
import { pageCarry } from '../../src/ui/flow/chakra/carry';
import { Asks, asksRoomOf } from '../../src/ui/flow/chakra/Asks';

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
const lines = () => [...root.querySelectorAll<HTMLButtonElement>('[data-asks] .ck-ask')];
const sheet = () => document.querySelector<HTMLElement>('[data-sheet="Heart asks"]');

beforeEach(async () => {
  ticks.length = 0;
  await freshDB();
  await ensureSeeded(0);
  await loadSettings();
  gate.value = null;
  still.value = null;
  pageCarry.value = null;
  localStorage.clear();
  location.hash = '#/flow/c/heart';
});
afterEach(() => { render(null, root); root.remove(); });

describe('a sign\'s three questions (rule 37)', () => {
  it('the starters, three, italic, on their own buttons, with no number, then Edit', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    expect(lines().map(b => b.textContent)).toEqual([...STARTER_ASKS.heart]);
    expect(lines().every(b => b.classList.contains('fs-wise'))).toBe(true);
    const block = root.querySelector('[data-asks]')!;
    expect(block.classList.contains('fs-notstill')).toBe(true);
    expect(block.querySelector('.ck-asks-edit .fs-word')!.textContent).toBe('Edit');
    expect(block.textContent!.replace(/\?/g, '')).not.toMatch(/\d/);
  });

  it('a tap writes the question on today\'s page as a wise line, once a day, and opens the journal on it', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    pageCarry.value = { tail: 'Dear ' };
    await act(() => { lines()[1].click(); });
    await until(() => { expect(location.hash).toBe('#/journal'); });
    // no carry: the caret lands on the rule under the question, in his own ink
    expect(pageCarry.value).toBeNull();
    const page = await todayLinked({ sign: { chakra: 'heart' } });
    expect(page.sign).toEqual({ chakra: 'heart' });
    let ms = await messagesOf(page.id);
    expect(ms.map(m => [m.text, m.wise])).toEqual([[STARTER_ASKS.heart[1], true]]);
    // the same question again that day is not written twice
    location.hash = '#/flow/c/heart';
    await settle();
    await act(() => { lines()[1].click(); });
    await until(() => { expect(location.hash).toBe('#/journal'); });
    ms = await messagesOf(page.id);
    expect(ms).toHaveLength(1);
    // no tick on the carry (rule 19 lists none), and nothing counted on the block
    expect(ticks).toEqual([]);
  });

  it('Edit raises the sheet with the three on their rules; a rule rewritten is kept, an emptied one is its starter', async () => {
    await setAsk('heart', 2, 'Who held you today?');
    await draw(h(Asks, { chakra: 'heart' }));
    await act(() => { root.querySelector<HTMLElement>('.ck-asks-edit .fs-word')!.click(); });
    expect(ticks).toEqual(['sheet']);
    const inputs = () => [...sheet()!.querySelectorAll<HTMLInputElement>('input')];
    expect(inputs().map(i => i.value)).toEqual([STARTER_ASKS.heart[0], STARTER_ASKS.heart[1], 'Who held you today?']);
    expect(inputs().map(i => i.placeholder)).toEqual([...STARTER_ASKS.heart]);
    const write = async (i: number, text: string) => {
      await act(() => {
        const el = inputs()[i];
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new FocusEvent('blur'));
      });
    };
    await write(0, 'Who do you want to call?');
    await until(async () => { expect((await asksOf('heart'))[0]).toBe('Who do you want to call?'); });
    // emptied: the starter comes back, on the page and on the rule's placeholder
    await write(2, '');
    await until(async () => { expect(await asksOf('heart')).toEqual(['Who do you want to call?', STARTER_ASKS.heart[1], STARTER_ASKS.heart[2]]); });
    await until(() => { expect(lines().map(b => b.textContent)).toEqual(['Who do you want to call?', STARTER_ASKS.heart[1], STARTER_ASKS.heart[2]]); });
    // Done keeps what is on the rules, and the sheet goes down
    await write(1, 'What is light today?');
    await act(() => { [...sheet()!.querySelectorAll<HTMLButtonElement>('.fs-word')].find(b => b.textContent === 'Done')!.click(); });
    await until(async () => { expect((await asksOf('heart'))[1]).toBe('What is light today?'); });
  });

  it('with a flow\'s Edit on the page, the questions stay and their Edit leaves', async () => {
    await draw(h(Asks, { chakra: 'heart', edit: false }));
    expect(lines()).toHaveLength(3);
    expect(root.querySelector('.ck-asks-edit')).toBeNull();
  });

  it('holds its room before the read: the starters unseen the first time, then the rules it took', async () => {
    expect(asksRoomOf('heart')).toBeNull();
    await draw(h(Asks, { chakra: 'heart' }), false);
    const wait = root.querySelector<HTMLElement>('.ck-asks.wait');
    expect(wait?.getAttribute('aria-hidden')).toBe('true');
    expect([...wait!.querySelectorAll('.ck-ask')].map(b => b.textContent)).toEqual([...STARTER_ASKS.heart]);
    render(null, root); root.remove();
    localStorage.setItem('fs-asks-room', JSON.stringify({ heart: 7 }));
    expect(asksRoomOf('heart')).toBe(7);
    await draw(h(Asks, { chakra: 'heart' }), false);
    const held = root.querySelector<HTMLElement>('.ck-asks.wait')!;
    expect(held.style.getPropertyValue('--ck-ask-rules')).toBe('7');
    expect(held.querySelectorAll('.ck-ask')).toHaveLength(0);
    // nonsense kept is no room
    localStorage.setItem('fs-asks-room', JSON.stringify({ heart: 'x' }));
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

  it('Still: the block leaves with the light, and a sheet open as it turns goes down', async () => {
    await draw(h(Asks, { chakra: 'heart' }));
    await act(() => { root.querySelector<HTMLElement>('.ck-asks-edit .fs-word')!.click(); });
    expect(sheet()).not.toBeNull();
    await act(() => { still.value = { since: Date.now() }; });
    await settle(600);
    expect(sheet()).toBeNull();
    expect(root.querySelector('[data-asks]')!.classList.contains('fs-notstill')).toBe(true);
  });
});
