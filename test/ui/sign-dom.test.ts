// @vitest-environment jsdom
// parts/Sign (PLAN-MOUNTAIN.md pass 6, R0): one inline SVG per sign, drawn paths only, the gate's state on the element
// for tests and for the CSS, and the parts a parent styles (pathLength 1 for a pen-order draw).
import { describe, it, expect, afterEach } from 'vitest';
import { h, render } from 'preact';
import fs from 'node:fs';
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
    // the gate goes inline as --gate only; --closed and the scale are the CSS's, so Still can pin them
    expect(svg.style.getPropertyValue('--gate')).toBe('1');
    expect(svg.style.getPropertyValue('--closed')).toBe('');
    expect(signScale(1)).toBeCloseTo(0.7);
    expect(signScale(0)).toBe(1);
    expect(signScale(0.5)).toBeCloseTo(0.85);
  });
  it('clamps closed, and in Still is open whatever the gate says', () => {
    expect(draw({ kind: 'sun', hue: 95, closed: 3, size: 'small' }).dataset.closed).toBe('1.00');
    render(null, root); root.remove();
    const still = draw({ kind: 'sun', hue: 95, closed: 0.8, size: 'small', still: true });
    expect(still.dataset.closed).toBe('0.00');
    expect(still.hasAttribute('data-still')).toBe(true);
    expect(still.style.getPropertyValue('--gate')).toBe('0');
  });
  it('a sign on the plate says so, for the plate prop; an .on-plate ancestor does the same in CSS', () => {
    expect(draw({ kind: 'eye', hue: 275, closed: 0, size: 'small', plate: true }).hasAttribute('data-plate')).toBe(true);
    render(null, root); root.remove();
    expect(draw({ kind: 'eye', hue: 275, closed: 0, size: 'small' }).hasAttribute('data-plate')).toBe(false);
  });
  it('its CSS draws in pen order (no non-scaling-stroke), adds no filter, and lets Still win over the gate', () => {
    const css = fs.readFileSync('src/ui/parts/parts.css', 'utf8');
    const part = css.slice(css.indexOf('/* ---- R0: parts/Sign'), css.indexOf('/* ---- R0 ends ---- */'));
    const rules = part.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rules).not.toMatch(/vector-effect|non-scaling-stroke|filter|drop-shadow/);
    expect(rules).toMatch(/--closed: var\(--gate, 0\)/);
    expect(rules).toMatch(/\[data-light="still"\] \.fs-sign\.fs-sign, \.fs-sign\.fs-sign\[data-still\] \{ --closed: 0;/);
    expect(rules).toMatch(/\.on-plate \.fs-sign, \.fs-sign\[data-plate\]/);
  });
  it('is a drawing, hidden from the screen reader, with no text, emoji or image in it', () => {
    const svg = draw({ kind: 'sprout', hue: 25, closed: 0.2, size: 'small' });
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.textContent).toBe('');
    expect(svg.querySelector('image, use, text')).toBeNull();
  });
});
