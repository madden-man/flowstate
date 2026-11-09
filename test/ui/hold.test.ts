// @vitest-environment jsdom
// M1 (PLAN-MOTION.md): the hold fills over --t-hold and fires at HOLD_MS, so the two must be one length, in every
// light; the PIN's dots empty right to left on a miss; a check drawn by a thumb carries the pen's weight, one already
// there does not.
import fs from 'node:fs';
import { describe, it, expect, afterEach } from 'vitest';
import { render, h, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { HOLD_MS } from '../../src/ui/parts/Hold';
import { Keypad } from '../../src/ui/parts/Keypad';
import { Check } from '../../src/ui/parts/Check';

const holdIn = (file: string) => {
  const css = fs.readFileSync(file, 'utf8');
  const all = [...css.matchAll(/--t-hold:\s*([\d.]+)(ms|s)\b/g)].map(m => (m[2] === 's' ? Number(m[1]) * 1000 : Number(m[1])));
  return all.filter(ms => ms > 0);   // the reduced-motion block takes it to 0, with every other duration
};

describe('the hold', () => {
  it('HOLD_MS is --t-hold, and no light changes it', () => {
    for (const f of ['src/ui/tokens.css', 'design/tokens.css']) expect(holdIn(f)).toEqual([HOLD_MS]);
    expect(HOLD_MS).toBe(500);
  });
});

describe('the marks', () => {
  let host: HTMLElement;
  afterEach(() => { render(null, host); host.remove(); });
  const mount = (vnode: ComponentChild) => { host = document.createElement('div'); document.body.append(host); act(() => render(vnode, host)); };

  it('a miss empties the dots right to left, one place apart; a delete empties one at once', () => {
    const pad = (value: string) => h(Keypad, { label: 'PIN', value, onInput: () => {}, digits: 4 });
    mount(pad('356'));
    act(() => render(pad('35'), host));
    const k = () => [...host.querySelectorAll('.fs-dots i')].map(i => (i as HTMLElement).style.getPropertyValue('--k'));
    expect(k()).toEqual(['', '', '', '']);
    act(() => render(pad('3569'), host));
    act(() => render(pad(''), host));
    expect(k()).toEqual(['3', '2', '1', '0']);
  });

  it('the pen weight is on a check a thumb drew, not on one already there', () => {
    let checked = true;
    const box = () => h(Check, { checked, onChange: v => { checked = v; } }, 'write');
    mount(box());
    const b = host.querySelector('button')!;
    expect(b.className).toBe('fs-check done');
    act(() => b.click());
    act(() => render(box(), host));
    expect(b.className).toBe('fs-check');
    act(() => b.click());
    act(() => render(box(), host));
    expect(b.className).toBe('fs-check done inked');
  });
});
