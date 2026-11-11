// @vitest-environment jsdom
// parts/Sign (PLAN-MOUNTAIN.md pass 6, R0): one inline SVG per sign, drawn paths only, the gate's state on the element
// for tests and for the CSS, and the parts a parent styles (pathLength 1 for a pen-order draw).
import { describe, it, expect, afterEach } from 'vitest';
import { h, render } from 'preact';
import { Sign, SIGN_PATHS, signScale } from '../../src/ui/parts/Sign';
import { CHAKRAS } from '../../src/model/mountain';

let root: HTMLElement;
afterEach(() => { render(null, root); root.remove(); });
const draw = (props: Parameters<typeof Sign>[0]) => {
  root = document.createElement('div');
  document.body.append(root);
  render(h(Sign, props), root);
  return root.querySelector('svg.fs-sign') as SVGSVGElement;
};

describe('parts/Sign', () => {
  it('draws each of the seven from its own paths, every part pathLength 1', () => {
    for (const c of CHAKRAS) {
      const svg = draw({ kind: c.sign, hue: c.hue, closed: 0, size: 'small' });
      expect(svg.dataset.sign).toBe(c.sign);
      expect(svg.querySelector('.fs-sign-body')!.getAttribute('d')).toBe(SIGN_PATHS[c.sign].body);
      const line = svg.querySelector('.fs-sign-line');
      expect(line?.getAttribute('d')).toBe(SIGN_PATHS[c.sign].line);
      for (const p of svg.querySelectorAll('path')) expect(p.getAttribute('pathLength')).toBe('1');
      expect(svg.style.getPropertyValue('--sh')).toBe(String(c.hue));
      render(null, root); root.remove();
    }
  });
  it('says how closed it is, and draws in to 70 percent when shut', () => {
    const svg = draw({ kind: 'heart', hue: 150, closed: 1, size: 'large' });
    expect(svg.dataset.closed).toBe('1.00');
    expect(svg.dataset.size).toBe('large');
    expect(svg.querySelector('.fs-sign-g')!.getAttribute('transform')).toBe('scale(0.700)');
    expect(signScale(0)).toBe(1);
    expect(signScale(0.5)).toBeCloseTo(0.85);
  });
  it('clamps closed, and in Still is open whatever the gate says', () => {
    expect(draw({ kind: 'sun', hue: 95, closed: 3, size: 'small' }).dataset.closed).toBe('1.00');
    render(null, root); root.remove();
    const still = draw({ kind: 'sun', hue: 95, closed: 0.8, size: 'small', still: true });
    expect(still.dataset.closed).toBe('0.00');
    expect(still.hasAttribute('data-still')).toBe(true);
    expect(still.querySelector('.fs-sign-g')!.getAttribute('transform')).toBe('scale(1.000)');
  });
  it('is a drawing, hidden from the screen reader, with no text, emoji or image in it', () => {
    const svg = draw({ kind: 'sprout', hue: 25, closed: 0.2, size: 'small' });
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.textContent).toBe('');
    expect(svg.querySelector('image, use, text')).toBeNull();
  });
});
