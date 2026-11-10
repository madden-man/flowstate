// The sit's scapes (PLAN-MEDITATE.md 3.1, S1), built on a fake context: every node is recorded with what it was
// connected to and every automation call on its params, so the graph can be read without a sound card.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildScape, Sit, BREATH_S, IN_S, WAVE_POINTS, type ScapeName } from '../../src/ui/parts/Sound';
import { defaultSettings } from '../../src/db/seed';

type Call = [string, ...unknown[]];
class FakeParam {
  value: number;
  calls: Call[] = [];
  constructor(v = 0) { this.value = v; }
  setValueAtTime(...a: unknown[]) { this.calls.push(['setValueAtTime', ...a]); return this; }
  linearRampToValueAtTime(...a: unknown[]) { this.calls.push(['linearRampToValueAtTime', ...a]); return this; }
  exponentialRampToValueAtTime(...a: unknown[]) { this.calls.push(['exponentialRampToValueAtTime', ...a]); return this; }
  setTargetAtTime(...a: unknown[]) { this.calls.push(['setTargetAtTime', ...a]); return this; }
  setValueCurveAtTime(...a: unknown[]) { this.calls.push(['setValueCurveAtTime', ...a]); return this; }
  cancelScheduledValues(...a: unknown[]) { this.calls.push(['cancelScheduledValues', ...a]); return this; }
}
class FakeNode {
  out: unknown[] = [];
  started: unknown[] | null = null;
  stopped = 0;
  constructor(readonly kind: string, params: string[] = []) { for (const p of params) (this as Record<string, unknown>)[p] = new FakeParam(); }
  connect(to: unknown) { this.out.push(to); return to; }
  disconnect() { this.out = []; }
  start(...a: unknown[]) { this.started = a; }
  stop() { this.stopped++; }
}
class FakeContext {
  sampleRate = 3000;
  currentTime = 0;
  destination = new FakeNode('destination');
  nodes: FakeNode[] = [];
  private make(kind: string, params: string[] = []) { const n = new FakeNode(kind, params); this.nodes.push(n); return n; }
  createGain() { const g = this.make('gain', ['gain']); (g as unknown as { gain: FakeParam }).gain.value = 1; return g; }
  createBufferSource() { return this.make('buffer'); }
  createBiquadFilter() { return this.make('filter', ['frequency', 'Q']); }
  createOscillator() { return this.make('oscillator', ['frequency']); }
  createStereoPanner() { return this.make('panner', ['pan']); }
  createConvolver() { return this.make('convolver'); }
  createBuffer(channels: number, length: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { length, getChannelData: (c: number) => data[c] };
  }
}
const fake = () => new FakeContext();
const asCtx = (f: FakeContext) => f as unknown as BaseAudioContext;

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('the scapes, on a fake context', () => {
  beforeEach(() => vi.useFakeTimers());

  it.each(['rain', 'ocean', 'forest', 'bowl'] as ScapeName[])('%s builds a graph that ends at the destination', name => {
    const f = fake();
    const s = buildScape(asCtx(f), name)!;
    expect(s).toBeInstanceOf(Sit);
    expect(f.nodes.length).toBeGreaterThanOrEqual(name === 'bowl' ? 6 : 10);
    // the bus goes to the destination; it starts silent and fades in from t0
    const bus = s.bus as unknown as FakeNode & { gain: FakeParam };
    expect(bus.out).toEqual([f.destination]);
    expect(bus.gain.calls[0]).toEqual(['setValueAtTime', 0, s.t0]);
    expect(bus.gain.calls[1][0]).toBe('linearRampToValueAtTime');
    const fadeIn = (bus.gain.calls[1][2] as number) - s.t0;
    expect(fadeIn).toBeCloseTo(name === 'bowl' ? 0.3 : IN_S, 5);
    // every node reaches the bus (or a param on the way there)
    const reaches = (n: unknown, seen = new Set<unknown>()): boolean => {
      if (n === bus) return true;
      if (seen.has(n)) return false;
      seen.add(n);
      const outs = n instanceof FakeNode ? n.out : [];
      if (n instanceof FakeParam) return true;
      return outs.some(o => reaches(o, seen));
    };
    const loose = f.nodes.filter(n => n !== bus && !reaches(n));
    expect(loose.map(n => n.kind)).toEqual([]);
    s.end(0);
  });

  it('rain and the ocean run looped noise from t0', () => {
    for (const name of ['rain', 'ocean'] as const) {
      const f = fake();
      const s = buildScape(asCtx(f), name)!;
      const loops = f.nodes.filter(n => n.kind === 'buffer' && (n as unknown as { loop?: boolean }).loop);
      expect(loops.length, name).toBe(3);
      for (const l of loops) expect(l.started![0]).toBe(s.t0);
      s.end(0);
    }
  });

  it('quiet makes no nodes at all', () => {
    const f = fake();
    expect(buildScape(asCtx(f), 'quiet')).toBeNull();
    expect(f.nodes).toEqual([]);
  });

  it("the ocean's waves start on the breath and peak four seconds in", () => {
    const f = fake();
    const s = buildScape(asCtx(f), 'ocean')!;
    f.currentTime = BREATH_S * 3;
    vi.advanceTimersByTime(400);
    const curves = f.nodes.flatMap(n => Object.values(n).filter((p): p is FakeParam => p instanceof FakeParam))
      .flatMap(p => p.calls.filter(c => c[0] === 'setValueCurveAtTime'));
    expect(curves.length).toBeGreaterThanOrEqual(3 * 4); // three curves a wave, the waves of the look-ahead
    for (const [, c, start, seconds] of curves as [string, Float32Array, number, number][]) {
      const k = (start - s.t0) / BREATH_S;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9);
      expect(c.length).toBe(WAVE_POINTS);
      expect(seconds).toBeCloseTo(BREATH_S, 1);
    }
    // the surf (its level starts at .14, its tone at 260 Hz) is highest at the end of the in-breath
    const surf = (curves as [string, Float32Array, number, number][]).filter(([, c]) => Math.abs(c[0] - 0.14) < 1e-6 || Math.abs(c[0] - 260) < 1e-3);
    expect(surf.length).toBe(2 * 4);
    for (const [, c, , seconds] of surf) {
      const top = c.indexOf(Math.max(...c));
      expect((top / (c.length - 1)) * seconds).toBeCloseTo(IN_S, 1);
    }
    s.end(0);
  });

  it('the bowl is struck as an in-breath begins: G, then D a breath later', () => {
    const f = fake();
    const s = buildScape(asCtx(f), 'bowl')!;
    const oscs = f.nodes.filter(n => n.kind === 'oscillator') as unknown as (FakeNode & { frequency: FakeParam })[];
    const at = (hz: number) => oscs.filter(o => Math.abs(o.frequency.value - hz) < 0.5).map(o => o.started![0] as number);
    expect(at(196 - 0.35)[0]).toBeCloseTo(s.t0 + 0.05, 6);
    expect(at(293.66 - 0.35)[0]).toBeCloseTo(s.t0 + BREATH_S + 0.05, 6);
    s.end(0);
  });

  it('end() stops the look-ahead timers at once and lets the graph go after the fade', () => {
    const f = fake();
    const s = buildScape(asCtx(f), 'rain')!;
    expect(s.timers).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    const before = f.nodes.length;
    vi.advanceTimersByTime(800);
    f.currentTime = 5;
    vi.advanceTimersByTime(400);
    expect(f.nodes.length).toBeGreaterThan(before); // drops kept coming
    s.end(6);
    expect(s.timers).toBe(0);
    const bus = s.bus as unknown as FakeNode & { gain: FakeParam };
    expect(bus.gain.calls.at(-1)).toEqual(['setTargetAtTime', 0, 5, 1.5]);
    const after = f.nodes.length;
    f.currentTime = 20;
    vi.advanceTimersByTime(6_200);
    expect(f.nodes.length).toBe(after); // no more drops
    expect(bus.out).toEqual([]);
    expect(f.nodes.filter(n => n.kind === 'buffer' && (n as unknown as { loop?: boolean }).loop).every(n => n.stopped > 0)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('scape(): a context of its own, and the ringer', () => {
  let made: FakeContext[] = [];
  // a fresh module each time, so each test meets parts/Sound before its one AudioContext is made
  let scape: typeof import('../../src/ui/parts/Sound').scape;
  let bell: typeof import('../../src/ui/parts/Sound').bell;
  let settings: typeof import('../../src/ui/settings').settings;
  type Made = FakeContext & { state: string; resumed: number; closed: number; heard: (() => void)[] };
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    made = [];
    class AC extends FakeContext {
      state = 'running'; resumed = 0; closed = 0; heard: (() => void)[] = [];
      resume() { this.resumed++; return Promise.resolve(); }
      close() { this.closed++; this.state = 'closed'; return Promise.resolve(); }
      addEventListener(_: string, fn: () => void) { this.heard.push(fn); }
      removeEventListener(_: string, fn: () => void) { this.heard = this.heard.filter(f => f !== fn); }
      constructor() { super(); made.push(this); }
    }
    vi.stubGlobal('window', { AudioContext: AC });
    ({ scape, bell } = await import('../../src/ui/parts/Sound'));
    ({ settings } = await import('../../src/ui/settings'));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const session = () => {
    const s = { type: 'auto' };
    vi.stubGlobal('navigator', { audioSession: s });
    return s;
  };

  it('quiet makes no context and no nodes, and keeps the wall clock', () => {
    const s = session();
    const q = scape('quiet')!;
    expect(made).toHaveLength(0);
    expect(typeof q.now()).toBe('number');
    expect(q.now()).toBeGreaterThanOrEqual(q.t0);
    expect(s.type).toBe('auto');
  });

  it('with the setting on, a sit plays as media and gives the session back once it has faded', () => {
    settings.value = { ...defaultSettings(0), sitThroughSilent: true };
    const s = session();
    const sit = scape('rain')!;
    expect(s.type).toBe('playback');
    expect(sit.now()).toBe(made[0].currentTime);
    sit.end(6);
    expect(s.type).toBe('playback');
    vi.advanceTimersByTime(6_200);
    expect(s.type).toBe('auto');
  });

  it('with the setting off, the session is never touched', () => {
    settings.value = { ...defaultSettings(0), sitThroughSilent: false };
    const s = session();
    s.type = 'ambient';
    const sit = scape('ocean')!;
    expect(s.type).toBe('ambient');
    sit.end(6);
    vi.advanceTimersByTime(6_200);
    expect(s.type).toBe('ambient');
  });

  it('a scape does not follow the Sounds switch (the Quiet chip is its switch), and every sit has a context of its own, closed once it has faded', () => {
    settings.value = { ...defaultSettings(0), sounds: false };
    session();
    const a = scape('forest')!;
    expect(made).toHaveLength(1);
    expect(made[0].nodes.length).toBeGreaterThan(0);
    const b = scape('bowl')!; // a new sit ends the one before it, on a new context
    expect(made).toHaveLength(2);
    expect((made[0] as Made).closed).toBe(0);
    vi.advanceTimersByTime(6_400);
    expect((made[0] as Made).closed).toBe(1);
    a.end(0); b.end(0);
    vi.advanceTimersByTime(400);
    expect((made[1] as Made).closed).toBe(1);
  });

  it('a sit never plays on the bells\' context, which the iPhone may have left silent', () => {
    settings.value = { ...defaultSettings(0), sounds: true };
    session();
    bell('keep');
    expect(made).toHaveLength(1);
    const sit = scape('rain')!;
    expect(made).toHaveLength(2);
    expect(sit.now()).toBe(made[1].currentTime);
    // the closing bell rings on the sit's context, which is awake
    const before = made[1].nodes.length;
    bell('sitEnd');
    expect(made[1].nodes.length).toBeGreaterThan(before);
    sit.end(6);
    vi.advanceTimersByTime(6_400);
    // afterwards the bells are back on their own
    const own = made[0].nodes.length;
    bell('keep');
    expect(made[0].nodes.length).toBeGreaterThan(own);
  });

  it('interrupted mid-sit, the context is woken again while the page is in front, and not once the sit has ended', () => {
    session();
    vi.stubGlobal('document', { visibilityState: 'visible' });
    const sit = scape('ocean')!;
    const c = made[0] as Made;
    c.state = 'interrupted';
    c.heard.forEach(fn => fn());
    expect(c.resumed).toBe(1);
    sit.end(0);
    expect(c.heard).toHaveLength(0);
    vi.advanceTimersByTime(400);
  });

  it('a newer sit keeps the session when the older one finishes fading', () => {
    settings.value = { ...defaultSettings(0), sitThroughSilent: true };
    const s = session();
    const a = scape('rain')!;
    a.end(6);
    const b = scape('ocean')!;
    vi.advanceTimersByTime(6_200);
    expect(s.type).toBe('playback');
    b.end(6);
    vi.advanceTimersByTime(6_200);
    expect(s.type).toBe('auto');
  });
});

describe('the closing bell (S2)', () => {
  let made: FakeContext[] = [];
  let bell: typeof import('../../src/ui/parts/Sound').bell;
  let settings: typeof import('../../src/ui/settings').settings;
  beforeEach(async () => {
    vi.resetModules();
    made = [];
    class AC extends FakeContext { state = 'running'; resume() { return Promise.resolve(); } constructor() { super(); made.push(this); } }
    vi.stubGlobal('window', { AudioContext: AC });
    ({ bell } = await import('../../src/ui/parts/Sound'));
    ({ settings } = await import('../../src/ui/settings'));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('follows the Sounds switch: off, nothing is made', () => {
    settings.value = { ...defaultSettings(0), sounds: false };
    bell('sitEnd');
    expect(made).toHaveLength(0);
  });
  it('on, it is struck at 528 Hz and rings down over four seconds', () => {
    settings.value = { ...defaultSettings(0), sounds: true };
    bell('sitEnd');
    const oscs = made[0].nodes.filter(n => n.kind === 'oscillator') as unknown as { frequency: FakeParam }[];
    expect(oscs[0].frequency.value).toBe(528);
    const out = made[0].nodes.find(n => n.kind === 'gain') as unknown as { gain: FakeParam };
    expect(out.gain.calls.at(-1)).toEqual(['exponentialRampToValueAtTime', 0.0008, 4]);
  });
});

describe('settings', () => {
  it('a new journal sits with the rain, heard with the ringer off', () => {
    const d = defaultSettings(0);
    expect(d.sitSound).toBe('rain');
    expect(d.sitThroughSilent).toBe(true);
  });
});
