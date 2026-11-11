// @vitest-environment jsdom
// parts/Gate (PLAN-MOUNTAIN.md section 5, R3): a slider from open to shut, live under the finger, committed once on
// release or a key, the percent in print while above zero, dashed while stale until touched, gone in Still.
import { describe, it, expect, afterEach } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
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

  it('commits once per key, a twentieth at a time, Home and End to the ends', () => {
    const got: number[] = [], live: number[] = [];
    const g = draw({ value: 0.5, hue: 25, onCommit: v => got.push(v), onInput: v => live.push(v) });
    const s = g.querySelector('[role="slider"]') as HTMLElement;
    act(() => { s.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    act(() => { s.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); });
    act(() => { s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); });
    expect(got).toEqual([0.55, 1, 0]);
    expect(live).toEqual([0.55, 1, 0]);
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
});
