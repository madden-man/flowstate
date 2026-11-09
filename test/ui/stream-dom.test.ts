// @vitest-environment jsdom
// parts/Stream's one loop (PLAN-MOTION.md M5 item 7): it runs while the page is seen and stops on unmount, with no
// loop left behind; it reads --stream when the light changes, never inside a frame; under --stream 0 it does not run.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { Stream, running } from '../../src/ui/parts/Stream';
import { pacesOf } from '../../src/model/pace';
import { SEED_FLOWS } from '../../src/db/seed-flows';
import { still } from '../../src/ui/light';

let frames: Map<number, FrameRequestCallback>;
let next = 1;
beforeEach(() => {
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { const id = next++; frames.set(id, cb); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.documentElement.style.removeProperty('--stream'); still.value = null; });

/** Runs the frames waiting now, at time t. */
const runFrames = (t: number) => { const due = [...frames]; frames.clear(); for (const [, cb] of due) cb(t); };
const panic = SEED_FLOWS[0];

describe('parts/Stream', () => {
  it('draws its motes at once, runs one loop, and leaves none when the page goes', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    act(() => { render(h(Stream, { diagram: 'ring', paces: pacesOf(panic), at: 0 }), root); });
    await Promise.resolve();
    const lines = root.querySelectorAll('.fl-stream line');
    expect(lines.length).toBeGreaterThan(29);
    expect(lines.length).toBeLessThanOrEqual(90);
    // the first paint is already the stream, before any frame
    expect([...lines].filter(l => Number(l.getAttribute('opacity')) > 0).length).toBeGreaterThan(20);
    expect(running.loops).toBe(1);
    expect(frames.size).toBe(1);
    const x = lines[0].getAttribute('x2');
    runFrames(16); runFrames(32); runFrames(48);
    expect(lines[0].getAttribute('x2')).not.toBe(x);
    expect(frames.size).toBe(1);

    // no style read inside a frame
    const cs = vi.spyOn(window, 'getComputedStyle');
    runFrames(64); runFrames(80);
    expect(cs).not.toHaveBeenCalled();

    act(() => { render(null, root); });
    expect(running.loops).toBe(0);
    expect(frames.size).toBe(0);
    root.remove();
  });

  it('reads --stream when the light changes; at 0 it stops and hides, and starts again after', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    act(() => { render(h(Stream, { diagram: 'valley', paces: pacesOf(SEED_FLOWS[1]), at: 0 }), root); });
    await Promise.resolve();
    expect(running.loops).toBe(1);
    const svg = root.querySelector<SVGSVGElement>('.fl-stream svg')!;
    document.documentElement.style.setProperty('--stream', '0');
    still.value = { since: Date.now() };
    await Promise.resolve(); await Promise.resolve();
    expect(svg.dataset.stream).toBe('0');
    expect(running.loops).toBe(0);
    expect(frames.size).toBe(0);
    expect(svg.querySelector('g')!.style.display).toBe('none');
    document.documentElement.style.setProperty('--stream', '.4');
    still.value = null;
    await Promise.resolve(); await Promise.resolve();
    expect(svg.dataset.stream).toBe('0.4');
    expect(running.loops).toBe(1);
    act(() => { render(null, root); });
    expect(running.loops).toBe(0);
    root.remove();
  });

  it('stops while the document is hidden', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    act(() => { render(h(Stream, { diagram: 'ring', paces: pacesOf(panic), at: 2 }), root); });
    await Promise.resolve();
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(running.loops).toBe(0);
    vis.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(running.loops).toBe(1);
    act(() => { render(null, root); });
    expect(running.loops).toBe(0);
    root.remove();
  });

  it('a landing sends out one ring, never a pile of them', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const props = { diagram: 'ring' as const, paces: pacesOf(panic), at: 1 };
    act(() => { render(h(Stream, { ...props, landing: { k: 1, seq: 1 } }), root); });
    await Promise.resolve();
    act(() => { render(h(Stream, { ...props, at: 2, landing: { k: 2, seq: 2 } }), root); });
    await Promise.resolve();
    expect(root.querySelectorAll('.fl-ripple').length).toBe(1);
    act(() => { render(null, root); });
    root.remove();
  });
});
