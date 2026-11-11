// @vitest-environment jsdom
// parts/Gate (PLAN-MOUNTAIN.md section 5, R3): a slider from open to shut, live under the finger, committed once on
// release or a key, the percent in print while above zero, dashed while stale until touched, gone in Still.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
const ticks: string[] = [];
vi.mock('../../src/ui/parts/Haptic', () => ({ tick: (k: string) => { ticks.push(k); } }));
import { Gate, gateWords, snapGate } from '../../src/ui/parts/Gate';

let root: HTMLElement;
afterEach(() => { render(null, root); root.remove(); });
const draw = (props: Parameters<typeof Gate>[0]) => {
  root = document.createElement('div');
  document.body.append(root);
  render(h(Gate, props), root);
  return root.querySelector('.fs-gate') as HTMLElement;
};

describe('parts/Gate', () => {
  it('is a slider named for its sign, its percent printed only above zero, and leaves in Still', () => {
    const g = draw({ value: 0.35, hue: 150, label: 'Heart', onCommit: () => {} });
    const s = g.querySelector('[role="slider"]')!;
    expect(s.getAttribute('aria-label')).toBe('Heart gate');
    expect(s.getAttribute('aria-valuenow')).toBe('35');
    expect(g.querySelector('.fs-gate-pct')!.textContent).toBe('35%');
    expect(g.classList.contains('fs-notstill')).toBe(true);
    render(h(Gate, { value: 0, hue: 150, onCommit: () => {} }), root);
    expect(root.querySelector('.fs-gate-pct')!.textContent).toBe('');
  });

  it('moves live on each key and commits once, on key up: a held arrow writes one reading', () => {
    const got: number[] = [], live: number[] = [];
    const g = draw({ value: 0.5, hue: 25, onCommit: v => got.push(v), onInput: v => live.push(v) });
    const s = g.querySelector('[role="slider"]') as HTMLElement;
    const key = (type: string, k: string) => act(() => { s.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true })); });
    // held: the browser repeats keydown, one keyup at the end
    for (let i = 0; i < 6; i++) key('keydown', 'ArrowRight');
    expect(got).toEqual([]);
    expect(live.at(-1)).toBe(0.8);
    key('keyup', 'ArrowRight');
    expect(got).toEqual([0.8]);
    key('keydown', 'End'); key('keyup', 'End');
    key('keydown', 'Home'); key('keyup', 'Home');
    expect(got).toEqual([0.8, 1, 0]);
  });

  it('commits keys still pending when it loses focus', () => {
    const got: number[] = [];
    const g = draw({ value: 0.2, hue: 25, onCommit: v => got.push(v) });
    const s = g.querySelector('[role="slider"]') as HTMLElement;
    act(() => { s.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
    act(() => { s.dispatchEvent(new FocusEvent('blur')); });
    expect(got).toEqual([0.15]);
  });

  it('is dashed while stale, until touched', () => {
    const g = draw({ value: 0.2, hue: 25, stale: true, onCommit: () => {} });
    expect(g.hasAttribute('data-stale')).toBe(true);
    act(() => { g.querySelector('[role="slider"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
    expect(root.querySelector('.fs-gate')!.hasAttribute('data-stale')).toBe(false);
  });

  it('snaps near the ends to the ends, and words the percent', () => {
    expect(snapGate(0.02)).toBe(0);
    expect(snapGate(0.98)).toBe(1);
    expect(snapGate(0.4)).toBe(0.4);
    expect(gateWords(0.704)).toBe('70%');
    expect(gateWords(0)).toBe('');
  });

  describe('a touch', () => {
    const rule = (g: HTMLElement) => {
      const r = g.querySelector('[role="slider"]') as HTMLElement;
      r.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 40, right: 200, bottom: 40, x: 0, y: 0, toJSON: () => ({}) });
      r.setPointerCapture = () => {};
      return r;
    };
    const ptr = (el: HTMLElement, type: string, x: number, y: number) =>
      act(() => { el.dispatchEvent(new PointerEvent(type, { pointerId: 3, clientX: x, clientY: y, bubbles: true, button: 0 })); });
    const shown = () => root.querySelector('[role="slider"]')!.getAttribute('aria-valuenow');

    it('does not move the mark on touch down, and a plain tap writes nothing', () => {
      const got: number[] = [], live: number[] = [];
      const r = rule(draw({ value: 0.3, hue: 25, onCommit: v => got.push(v), onInput: v => live.push(v) }));
      ptr(r, 'pointerdown', 190, 20);
      expect(shown()).toBe('30');
      ptr(r, 'pointermove', 193, 21);
      ptr(r, 'pointerup', 193, 21);
      expect(shown()).toBe('30');
      expect(got).toEqual([]);
      expect(live).toEqual([]);
    });

    it('lets a touch that goes down first be the scroll: nothing moves, ticks, or is written, and a cancel changes nothing', () => {
      ticks.length = 0;
      const got: number[] = [], live: number[] = [];
      let cancelled = 0;
      const r = rule(draw({ value: 0, hue: 25, onCommit: v => got.push(v), onInput: v => live.push(v), onCancel: () => cancelled++ }));
      // within a thumb of the open end, where the old gate ticked on touch down
      ptr(r, 'pointerdown', 2, 20);
      ptr(r, 'pointermove', 4, 40);
      ptr(r, 'pointermove', 6, 90);
      ptr(r, 'pointercancel', 6, 90);
      expect(shown()).toBe('0');
      expect(got).toEqual([]);
      expect(live).toEqual([]);
      expect(ticks).toEqual([]);
      expect(cancelled).toBe(0);
    });

    it('a sideways drag moves the mark by its travel past the slop, and commits once on release', () => {
      const got: number[] = [], live: number[] = [];
      const r = rule(draw({ value: 0.2, hue: 25, onCommit: v => got.push(v), onInput: v => live.push(v) }));
      ptr(r, 'pointerdown', 150, 20);
      ptr(r, 'pointermove', 160, 21); // taken here, at 0.2: no jump to the finger at 0.8
      expect(live).toEqual([0.2]);
      ptr(r, 'pointermove', 200, 22);
      expect(live.at(-1)).toBeCloseTo(0.4);
      expect(got).toEqual([]);
      ptr(r, 'pointerup', 200, 22);
      expect(got.length).toBe(1);
      expect(got[0]).toBeCloseTo(0.4);
    });

    it('a cancel after the mark was taken goes back to the value before the touch, unwritten', () => {
      const got: number[] = [], live: number[] = [];
      let cancelled = 0;
      const r = rule(draw({ value: 0.2, hue: 25, onCommit: v => got.push(v), onInput: v => live.push(v), onCancel: () => cancelled++ }));
      ptr(r, 'pointerdown', 50, 20);
      ptr(r, 'pointermove', 60, 20);
      ptr(r, 'pointermove', 120, 20);
      expect(shown()).toBe('50');
      ptr(r, 'pointercancel', 120, 20);
      expect(shown()).toBe('20');
      expect(cancelled).toBe(1);
      expect(got).toEqual([]);
    });

    it('takes no touch and no key while disabled (the journal is locked)', () => {
      const got: number[] = [], live: number[] = [];
      const g = draw({ value: 0.2, hue: 25, disabled: true, onCommit: v => got.push(v), onInput: v => live.push(v) });
      const r = rule(g);
      ptr(r, 'pointerdown', 50, 20);
      ptr(r, 'pointermove', 120, 20);
      ptr(r, 'pointerup', 120, 20);
      act(() => { r.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); });
      act(() => { r.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', bubbles: true })); });
      expect(got).toEqual([]);
      expect(live).toEqual([]);
      expect(r.getAttribute('tabindex')).toBe('-1');
    });
  });
});
