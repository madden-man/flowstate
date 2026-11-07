// @vitest-environment jsdom
// The relock timer (fake timers) and the keypad (letters under the digits, dots, delete, a hardware keyboard).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, h } from 'preact';
import { act } from 'preact/test-utils';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { keyState } from '../../src/db/fields';
import { loadSettings, settings } from '../../src/ui/settings';
import { choosePin, gate } from '../../src/ui/lock/pin';
import { startRelock } from '../../src/ui/lock/relock';
import { Keypad } from '../../src/ui/parts/Keypad';

const setVisibility = (v: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('relock', () => {
  let stop: () => void = () => {};
  beforeEach(async () => {
    await freshDB();
    await ensureSeeded();
    await loadSettings();
    await choosePin('3569', 1000);
    gate.value = null;
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    stop = startRelock(window);
  });
  afterEach(() => { stop(); vi.useRealTimers(); setVisibility('visible'); });

  it('locks after relockAfterMin in the background (default 5)', () => {
    setVisibility('hidden');
    vi.advanceTimersByTime(4 * 60_000);
    expect(keyState()).toBe('open');
    vi.advanceTimersByTime(60_000);
    expect(keyState()).toBe('locked');
  });

  it('coming back before the interval keeps it open; after it, locks on return even if no timer fired', () => {
    setVisibility('hidden');
    vi.advanceTimersByTime(2 * 60_000);
    setVisibility('visible');
    vi.advanceTimersByTime(10 * 60_000);
    expect(keyState()).toBe('open');
    // the phone froze the timer: only the clock moved
    setVisibility('hidden');
    vi.setSystemTime(Date.now() + 6 * 60_000); // the clock moves; the timer never fires
    setVisibility('visible');
    expect(keyState()).toBe('locked');
  });

  it('Immediately locks as soon as the app is hidden', () => {
    settings.value = { ...settings.value, lock: { ...settings.value.lock, relockAfterMin: 0 } };
    setVisibility('hidden');
    expect(keyState()).toBe('locked');
  });

  it('a page restored from the back-forward cache checks the stored moment', () => {
    window.dispatchEvent(new Event('pagehide'));
    vi.setSystemTime(Date.now() + 5 * 60_000);
    const e = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(e, 'persisted', { value: true });
    window.dispatchEvent(e);
    expect(keyState()).toBe('locked');
  });
});

describe('the keypad', () => {
  let root: HTMLDivElement;
  beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); });
  afterEach(() => { render(null, root); root.remove(); });

  function mount(digits?: number) {
    let value = '';
    const seen: string[] = [];
    const draw = () => render(h(Keypad, { label: 'PIN', value, digits, onInput: (v: string) => { value = v; seen.push(v); draw(); } }), root);
    act(draw);
    return { seen, get value() { return value; } };
  }

  it('shows 1 to 9 then 0 with the letters under the digits, and a delete word', () => {
    mount(4);
    const keys = [...root.querySelectorAll('.fs-key')].map(k => k.getAttribute('aria-label'));
    expect(keys).toEqual(['1', '2 ABC', '3 DEF', '4 GHI', '5 JKL', '6 MNO', '7 PQRS', '8 TUV', '9 WXYZ', '0']);
    expect(root.querySelector('.fs-key-word')!.textContent).toBe('delete');
    expect(root.querySelectorAll('.fs-dots i')).toHaveLength(4);
  });

  it('fills dots without echoing digits, deletes, and stops at the PIN length', () => {
    const k = mount(4);
    const key = (d: string) => [...root.querySelectorAll<HTMLButtonElement>('.fs-key')].find(b => b.querySelector('b')!.textContent === d)!;
    act(() => { key('3').click(); key('5').click(); });
    expect(root.querySelectorAll('.fs-dots i.on')).toHaveLength(2);
    expect(root.textContent).not.toContain('35');
    act(() => { root.querySelector<HTMLButtonElement>('.fs-key-word')!.click(); });
    expect(k.value).toBe('3');
    act(() => { key('5').click(); key('6').click(); key('9').click(); key('1').click(); });
    expect(k.value).toBe('3569');
  });

  it('types from a hardware keyboard, letters as their digits', () => {
    const k = mount(4);
    act(() => { for (const c of 'FLo') dispatchEvent(new KeyboardEvent('keydown', { key: c })); });
    expect(k.value).toBe('356');
    act(() => { dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' })); });
    expect(k.value).toBe('35');
    act(() => { dispatchEvent(new KeyboardEvent('keydown', { key: '6' })); dispatchEvent(new KeyboardEvent('keydown', { key: 'w' })); });
    expect(k.value).toBe('3569');
  });
});
