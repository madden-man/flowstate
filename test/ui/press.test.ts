// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startPress } from '../../src/ui/parts/Press';
import { turn } from '../../src/ui/parts/Turn';

const fire = (el: Element, type: string, at = { x: 0, y: 0 }) => {
  const e = new Event(type, { bubbles: true }) as Event & { clientX: number; clientY: number; button: number };
  e.clientX = at.x; e.clientY = at.y; e.button = 0;
  el.dispatchEvent(e);
};

describe('parts/Press: down is instant, up is eased', () => {
  let stop = () => {};
  afterEach(() => { stop(); document.body.innerHTML = ''; });

  it('marks the control under the thumb at pointerdown and lifts it at up', () => {
    document.body.innerHTML = '<button class="fs-word"><b>Done</b></button>';
    stop = startPress();
    const b = document.querySelector('button')!;
    fire(b.querySelector('b')!, 'pointerdown');
    expect(b.hasAttribute('data-down')).toBe(true);
    fire(b, 'pointerup');
    expect(b.hasAttribute('data-down')).toBe(false);
  });
  it('lifts when the touch becomes a scroll, or the finger wanders', () => {
    document.body.innerHTML = '<a class="fs-row">Panic</a><a class="fs-row">Depress</a>';
    stop = startPress();
    const [a, b] = [...document.querySelectorAll('a')];
    fire(a, 'pointerdown');
    fire(a, 'pointercancel');
    expect(a.hasAttribute('data-down')).toBe(false);
    fire(b, 'pointerdown', { x: 10, y: 10 });
    fire(b, 'pointermove', { x: 12, y: 14 });
    expect(b.hasAttribute('data-down')).toBe(true);
    fire(b, 'pointermove', { x: 10, y: 40 });
    expect(b.hasAttribute('data-down')).toBe(false);
  });
  it('leaves an inert or disabled control alone, and anything that is not a control', () => {
    document.body.innerHTML = '<button disabled>a</button><button class="inert">b</button><button aria-disabled="true">c</button><p>d</p>';
    stop = startPress();
    for (const el of document.body.children) { fire(el, 'pointerdown'); expect(el.hasAttribute('data-down')).toBe(false); }
  });
  it('a re-render that rewrites the class does not lift it', () => {
    document.body.innerHTML = '<button class="fs-check">a</button>';
    stop = startPress();
    const b = document.querySelector('button')!;
    fire(b, 'pointerdown');
    b.className = 'fs-check done';
    expect(b.hasAttribute('data-down')).toBe(true);
  });
});

describe('parts/Turn: a nicety on top of a change that works without it', () => {
  it('with no view transitions, the change just happens', async () => {
    const update = vi.fn();
    await turn('still', update, { vars: { '--vt-x': '10px' } });
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.turn).toBeUndefined();
  });
  it('names the turn for its length, sets its vars, and clears both after', async () => {
    let done = () => {};
    const seen: string[] = [];
    (document as unknown as { startViewTransition: unknown }).startViewTransition = (update: () => Promise<void>) => {
      const finished = update().then(() => new Promise<void>(r => { done = r; }));
      return { finished, skipTransition() {} };
    };
    const p = turn('open', () => { seen.push(document.documentElement.dataset.turn ?? ''); }, { vars: { '--vt-x': '10px' } });
    await new Promise(r => setTimeout(r, 5));
    expect(seen).toEqual(['open']);
    expect(document.documentElement.style.getPropertyValue('--vt-x')).toBe('10px');
    done();
    await p;
    expect(document.documentElement.dataset.turn).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--vt-x')).toBe('');
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  });
});
