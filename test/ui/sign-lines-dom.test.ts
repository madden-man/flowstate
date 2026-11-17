// @vitest-environment jsdom
// What each sign is for (PLAN-SIGN-LINES.md L1): parts/Versus in all three lights (the sign lit and the sign emptied
// beside the two words; in Still the signs leave and the words stay, in print); the block on a sign's page (the pair,
// then the italic line, four rules held from first paint, his rewrite once read, empty and still holding its room when
// locked); and the line's rule at the head of the questions' Edit sheet, kept as he leaves it, an emptied rule putting
// the starter back.
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { act } from 'preact/test-utils';
vi.mock('../../src/ui/parts/Haptic', () => ({ tick: () => undefined }));
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { setKey, lock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { loadSettings } from '../../src/ui/settings';
import { CHAKRAS, chakraOf } from '../../src/model/mountain';
import { STARTER_ASKS, asksOf, lineOf, setLine } from '../../src/model/acts';
import { gate } from '../../src/ui/lock/pin';
import { still } from '../../src/ui/light';
import { HashLocation } from '../../src/ui/route';
import { Versus } from '../../src/ui/parts/Versus';
import { SignFor } from '../../src/ui/flow/ChakraPage';
import { shelfVersion } from '../../src/ui/flow/chakra/SignShelf';
import { Asks } from '../../src/ui/flow/chakra/Asks';

// the app's own stylesheets, so "gone in Still" is the CSS saying so
const css = document.createElement('style');
css.textContent = readFileSync('src/ui/parts/parts.css', 'utf8') + readFileSync('src/ui/flow/chakra/chakra.css', 'utf8');
document.head.append(css);

const LIGHTS = ['day', 'night', 'still'] as const;
let root: HTMLElement;
const settle = async (ms = 30) => { await act(async () => { await new Promise(r => setTimeout(r, ms)); }); };
const until = (check: () => Promise<void> | void) => vi.waitFor(async () => { await settle(10); await check(); }, { timeout: 4000 });
async function draw(node: VNode<any>) {
  root = document.createElement('div');
  document.body.append(root);
  await act(() => { render(h(HashLocation, null, node), root); });
  return root;
}
const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];

beforeEach(async () => {
  await freshDB();
  await ensureSeeded(0);
  await loadSettings();
  gate.value = null;
  still.value = null;
  localStorage.clear();
  document.documentElement.dataset.light = 'day';
  location.hash = '#/flow/c/root';
});
afterEach(() => { render(null, root); root.remove(); still.value = null; document.documentElement.dataset.light = 'day'; });

describe('parts/Versus', () => {
  it('the sign lit, the want, "vs.", what works against it, the sign emptied: on one rule, nothing tappable', async () => {
    await draw(h(Versus, { kind: 'sprout', hue: 25, words: ['Safety', 'fear'] }));
    const p = $('p.fs-versus')!;
    expect(p.textContent).toBe('Safetyvs.fear');
    expect([...p.children].map(e => e.className)).toEqual([
      'fs-versus-sign fs-notstill', 'fs-versus-want', 'fs-versus-vs', 'fs-versus-against', 'fs-versus-sign fs-notstill',
    ]);
    const signs = $$<SVGSVGElement>('svg.fs-sign');
    expect(signs.map(s => [s.dataset.sign, s.dataset.closed, s.dataset.size])).toEqual([['sprout', '0.00', 'small'], ['sprout', '1.00', 'small']]);
    expect(signs.every(s => s.style.getPropertyValue('--sh') === '25')).toBe(true);
    expect($$('button, a, input, [tabindex]')).toHaveLength(0);
  });
  it('draws every sign\'s pair from CHAKRAS', async () => {
    for (const c of CHAKRAS) {
      await draw(h(Versus, { kind: c.sign, hue: c.hue, words: c.versus }));
      expect($('.fs-versus-want')!.textContent).toBe(c.versus[0]);
      expect($('.fs-versus-against')!.textContent).toBe(c.versus[1]);
      expect($$('svg.fs-sign').map(s => s.dataset.sign)).toEqual([c.sign, c.sign]);
      render(null, root); root.remove();
    }
    root = document.createElement('div');
  });
  for (const l of LIGHTS) {
    it(`in ${l}: ${l === 'still' ? 'the signs leave, the words stay on the rule, all in print' : 'both signs show, the want in ink and the other in print'}`, async () => {
      document.documentElement.dataset.light = l;
      await draw(h(Versus, { kind: 'heart', hue: 150, words: ['Opening', 'guarding'] }));
      for (const s of $$('.fs-versus-sign')) expect(getComputedStyle(s).display === 'none').toBe(l === 'still');
      for (const w of $$('.fs-versus-want, .fs-versus-vs, .fs-versus-against')) expect(getComputedStyle(w).display).not.toBe('none');
      // the colours are tokens (jsdom resolves no var()): ink for the want, print for the rest, and Still prints the want
      const all = readFileSync('src/ui/parts/parts.css', 'utf8');
      expect(all).toMatch(/\.fs-versus-want \{ color: var\(--ink\); \}/);
      expect(all).toMatch(/\.fs-versus-against \{ color: var\(--print\); \}/);
      expect(all).toMatch(/\[data-light="still"\] \.fs-versus-want \{ color: var\(--print\); \}/);
      expect(document.documentElement.matches('[data-light="still"]')).toBe(l === 'still');
    });
  }
  it('its CSS is tokens only, one rule tall, with no filter and nothing moving', () => {
    const all = readFileSync('src/ui/parts/parts.css', 'utf8');
    const part = all.slice(all.indexOf('/* ==== L1: parts/Versus'), all.indexOf('/* ==== L1 ends ==== */'));
    const rules = part.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rules).toMatch(/\.fs-versus \{[^}]*height: var\(--lh-ink\)/);
    expect(rules).not.toMatch(/filter|drop-shadow|animation|transition|#[0-9a-f]{3}|oklch\(\s*\d/i);
  });
});

describe('the block on a sign\'s page', () => {
  it('the pair, then the starter line in italic, four rules held from first paint', async () => {
    await draw(h(SignFor, { chakra: 'root' }));
    const block = $('.ck-for[data-for="root"]')!;
    expect(block.firstElementChild!.matches('p.fs-versus.ck-pair')).toBe(true);
    // before the read: the room, no words in the line
    expect($('.ck-for-line')!.textContent).toBe('');
    await until(() => { expect($('.ck-for[data-read]')).not.toBeNull(); });
    expect($('.ck-for-line')!.textContent).toBe(chakraOf('root').line);
    expect($('.ck-for-line')!.classList.contains('fs-wise')).toBe(true);
    const sheet = readFileSync('src/ui/flow/chakra/chakra.css', 'utf8');
    expect(sheet).toMatch(/\.ck-for \{ height: calc\(var\(--lh-ink\) \* 4\); overflow: hidden; \}/);
    expect(sheet).toMatch(/\.ck-for-line \{[^}]*-webkit-line-clamp: 2/);
  });
  it('his rewrite once read, and again when the sheet writes one', async () => {
    await setLine('root', 'You want ground. The floor is there.', 1);
    await draw(h(SignFor, { chakra: 'root' }));
    await until(() => { expect($('.ck-for-line')!.textContent).toBe('You want ground. The floor is there.'); });
    await setLine('root', '', 2);
    await act(() => { shelfVersion.value++; });
    await until(() => { expect($('.ck-for-line')!.textContent).toBe(chakraOf('root').line); });
  });
  for (const l of LIGHTS) {
    it(`in ${l}: the line stays, and the pair's words`, async () => {
      document.documentElement.dataset.light = l;
      await draw(h(SignFor, { chakra: 'heart' }));
      await until(() => { expect($('.ck-for-line')!.textContent).toBe(chakraOf('heart').line); });
      expect(getComputedStyle($('.ck-for-line')!).display).not.toBe('none');
      expect(getComputedStyle($('.ck-pair')!).display).not.toBe('none');
      expect($$('.ck-pair .fs-versus-sign').every(s => (getComputedStyle(s).display === 'none') === (l === 'still'))).toBe(true);
    });
  }
  it('locked: the pair and the room, no line', async () => {
    await setLine('root', 'You want ground. Grandpa held it.', 1);
    const salt = randomSalt();
    await setKey(await deriveKey('2580', salt, 1000), { salt, iterations: 1000 });
    lock();
    gate.value = 'locked';
    await draw(h(SignFor, { chakra: 'root' }));
    await until(() => { expect($('.ck-for[data-read]')).not.toBeNull(); });
    expect($('.ck-for-line')!.textContent).toBe('');
    expect($('.ck-pair')!.textContent).toBe('Safetyvs.fear');
  });
});

describe('the line\'s rule in the Edit sheet', () => {
  const sheet = () => document.querySelector<HTMLElement>('[data-sheet="Root asks"]');
  const lineRule = () => sheet()!.querySelector<HTMLTextAreaElement>('textarea[data-rule="line"]')!;
  const openSheet = async () => {
    await draw(h(Asks, { chakra: 'root' }));
    await until(() => { expect($('[data-asks]')).not.toBeNull(); });
    await act(() => { $('.ck-asks-edit .fs-word')!.click(); });
    await until(() => { expect(sheet()?.querySelector('.ck-deck')).not.toBeNull(); });
  };
  const write = async (text: string) => {
    await act(() => {
      const el = lineRule();
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      // Preact listens for onBlur as focusout
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    await settle(40);
  };

  it('stands first, before the open questions, in italic, holding the line as it reads', async () => {
    await openSheet();
    const rules = [...sheet()!.querySelectorAll<HTMLTextAreaElement>('textarea')];
    expect(rules[0]).toBe(lineRule());
    expect(lineRule().value).toBe(chakraOf('root').line);
    expect(lineRule().classList.contains('fs-wise')).toBe(true);
    expect(lineRule().closest('.ck-deck')).toBeNull();
    expect([...sheet()!.querySelectorAll<HTMLTextAreaElement>('.ck-deck textarea')].map(t => t.value).slice(0, 3)).toEqual([...STARTER_ASKS.root]);
  });
  it('kept as he leaves it; the deck is not touched; an emptied rule puts the starter back', async () => {
    await openSheet();
    await write('  You want ground.\n The floor is there. ');
    await until(async () => { expect(await lineOf('root')).toBe('You want ground. The floor is there.'); });
    expect(await asksOf('root')).toEqual([...STARTER_ASKS.root]);
    await write('');
    await until(async () => { expect(lineRule().value).toBe(chakraOf('root').line); });
    expect(await lineOf('root')).toBe(chakraOf('root').line);
  });
  it('Return goes on to the first question', async () => {
    await openSheet();
    lineRule().focus();
    await act(() => { lineRule().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
    expect(document.activeElement).toBe(sheet()!.querySelector('.ck-deck textarea'));
  });
});
