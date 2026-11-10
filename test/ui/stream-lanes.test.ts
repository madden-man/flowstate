// @vitest-environment jsdom
// The stream in three hues (PLAN-ENERGIZE.md X2, DESIGN.md rule 30 amended): laneOf shares the water evenly across
// three lanes side by side; given hues the layer classes each line by its lane (an empty slot's lane none: ink) and
// a landing with a hue rings in it; without hues every flow's layer is as it was, no class and no style anywhere.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { Stream } from '../../src/ui/parts/Stream';
import { laneOf, LANES } from '../../src/ui/parts/cycle/stream';
import { pacesOf } from '../../src/model/pace';
import { SEED_FLOWS } from '../../src/db/seed-flows';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); });

const energize = SEED_FLOWS.find(f => f.id === 'energize')!;

describe('laneOf', () => {
  it('cuts the triangle of places into three equal shares, the negative side first', () => {
    expect(LANES).toBe(3);
    const counts = [0, 0, 0];
    // off = r + r - 1 over a fine grid of draws
    for (let i = 0; i < 400; i++) for (let j = 0; j < 400; j++) counts[laneOf((i + 0.5) / 400 + (j + 0.5) / 400 - 1)]++;
    for (const c of counts) expect(c / 160000).toBeCloseTo(1 / 3, 2);
    expect(laneOf(-1)).toBe(0);
    expect(laneOf(0)).toBe(1);
    expect(laneOf(1)).toBe(2);
    expect(laneOf(0.5, 1)).toBe(0);
  });
});

function mount(props: Parameters<typeof Stream>[0]) {
  const root = document.createElement('div');
  document.body.append(root);
  act(() => { render(h(Stream, props), root); });
  return root;
}

describe('parts/Stream lanes', () => {
  it('every flow without hues: no class on any line and no style on the layer', () => {
    for (const f of SEED_FLOWS) {
      const root = mount({ diagram: f.diagram, paces: pacesOf(f), at: 0 });
      expect(root.querySelector('.fl-stream line[class]')).toBeNull();
      expect(root.querySelector('.fl-stream svg')!.getAttribute('style')).toBeNull();
      act(() => { render(null, root); }); root.remove();
    }
  });

  it('with hues each line takes its lane; an empty slot\'s lane stays ink; a hued landing rings in its colour', () => {
    const root = mount({ diagram: energize.diagram, paces: pacesOf(energize), at: 0, hues: [250, null, 25] });
    const svg = root.querySelector<SVGSVGElement>('.fl-stream svg')!;
    expect(svg.style.getPropertyValue('--fx0')).toBe('oklch(var(--voice-l) calc(var(--voice-c) * 1) 250)');
    expect(svg.style.getPropertyValue('--fx1')).toBe('');
    expect(svg.style.getPropertyValue('--fx2')).toBe('oklch(var(--voice-l) calc(var(--voice-c) * 1) 25)');
    const lines = [...root.querySelectorAll('.fl-stream line')];
    const h0 = lines.filter(l => l.getAttribute('class') === 'h0').length, h2 = lines.filter(l => l.getAttribute('class') === 'h2').length;
    expect(h0).toBeGreaterThan(lines.length / 6);
    expect(h2).toBeGreaterThan(lines.length / 6);
    expect(root.querySelector('.fl-stream line.h1')).toBeNull();
    expect(lines.filter(l => !l.hasAttribute('class')).length).toBeGreaterThan(lines.length / 6);

    act(() => { render(h(Stream, { diagram: energize.diagram, paces: pacesOf(energize), at: 0, hues: [250, null, 25], landing: { k: 0, seq: 1, hue: 305 } }), root); });
    const ring = root.querySelector<SVGCircleElement>('.fl-ripple')!;
    expect(ring.getAttribute('class')).toBe('fl-ripple fl-ripple-hue');
    expect(ring.style.getPropertyValue('--fxr')).toBe('oklch(var(--voice-l) calc(var(--voice-c) * 1) 305)');

    // the hues taken away: back to ink, nothing left behind
    act(() => { render(h(Stream, { diagram: energize.diagram, paces: pacesOf(energize), at: 0, landing: { k: 0, seq: 2 } }), root); });
    expect(root.querySelector('.fl-stream line[class]')).toBeNull();
    expect(svg.style.getPropertyValue('--fx0')).toBe('');
    expect(root.querySelector('.fl-ripple')!.getAttribute('class')).toBe('fl-ripple');
    act(() => { render(null, root); }); root.remove();
  });
});
