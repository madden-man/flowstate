// W0 spike: the YIN detector against synthesised tones and sweeps (PLAN-WORLDS.md section 13).
import { describe, expect, it } from 'vitest';
import { frameLength, midiOf, pitchTrack, summarise, yin } from '../../src/spike/pitch';

const SR = 16000;
const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

const tone = (hz: number, seconds: number, amp = 0.5) => {
  const x = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * hz * i) / SR);
  return x;
};

/** An exponential sweep from f0 to f1 over `seconds`, and its frequency at any sample. */
const sweep = (f0: number, f1: number, seconds: number) => {
  const n = Math.round(seconds * SR), k = f1 / f0, T = seconds;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = 0.5 * Math.sin(((2 * Math.PI * f0 * T) / Math.log(k)) * (Math.pow(k, t / T) - 1));
  }
  return { x, at: (i: number) => f0 * Math.pow(k, i / SR / T) };
};

describe('yin', () => {
  it.each([82.41, 110, 220, 261.63, 440, 659.25, 880])('reads a steady %s Hz within 5 cents', hz => {
    const x = tone(hz, 0.5);
    const got = yin(x, 1000, SR);
    expect(got).not.toBeNull();
    expect(Math.abs(cents(got!, hz))).toBeLessThan(5);
  });

  it('reads a tone with its octave and fifth above as its fundamental', () => {
    const a = tone(196, 0.5), b = tone(392, 0.5, 0.3), c = tone(588, 0.5, 0.2);
    const x = a.map((v, i) => v + b[i] + c[i]);
    expect(Math.abs(cents(yin(x, 1000, SR)!, 196))).toBeLessThan(5);
  });

  it('calls silence unvoiced', () => {
    expect(yin(new Float32Array(SR), 0, SR)).toBeNull();
  });

  it('calls most of white noise unvoiced', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    const x = new Float32Array(SR).map(() => 0.3 * rnd());
    const t = pitchTrack(x, SR);
    expect(t.hz.filter(h => h !== null).length / t.hz.length).toBeLessThan(0.1);
  });
});

describe('pitchTrack on sweeps', () => {
  it.each([
    [110, 880],
    [880, 110],
    [150, 300],
  ])('follows a sweep from %s to %s Hz within 30 cents on nine frames in ten', (f0, f1) => {
    const { x, at } = sweep(f0, f1, 2);
    const t = pitchTrack(x, SR, 0.02);
    const { window } = frameLength(SR);
    const hop = Math.round(0.02 * SR);
    let good = 0;
    t.hz.forEach((h, n) => {
      const centre = n * hop + window / 2;
      if (h !== null && Math.abs(cents(h, at(centre))) < 30) good++;
    });
    expect(good / t.hz.length).toBeGreaterThan(0.9);
  });

  it('gives the voiced share and the range sung', () => {
    const { x } = sweep(220, 440, 1);
    const both = new Float32Array(x.length * 2);
    both.set(x, 0); // a second of sweep, then a second of silence
    const s = summarise(pitchTrack(both, SR));
    expect(s.voicedPct).toBeGreaterThan(0.4);
    expect(s.voicedPct).toBeLessThan(0.6);
    expect(s.low).toMatch(/^(A3|A#3)$/);
    expect(s.high).toMatch(/^(G#4|A4)$/);
    expect(Math.round(midiOf(440))).toBe(69);
  });
});
