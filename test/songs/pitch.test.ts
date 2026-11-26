// What a take knows (PLAN-WORLDS.md section 6, W6), on synthesised tones with known answers: the pitch line reads a sine
// at 220 Hz as A3, a scale sung note by note reads its key, and the key is absent when too little is sung or the key
// finder is unsure. Tap tempo reads beats a minute from the taps.
import { describe, it, expect } from 'vitest';
import { FRAME_S, KEY_MIN_FRAMES, frameOf, keyOfLine, midiOf, noteName, pitchLine, yin } from '../../src/model/pitch';
import { bpmOf, runOf, GAP_MS } from '../../src/model/tempo';

const RATE = 16000;
const sine = (hz: number, seconds: number, level = 0.4, rate = RATE) => {
  const x = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < x.length; i++) x[i] = level * Math.sin((2 * Math.PI * hz * i) / rate);
  return x;
};
/** A hum: a sine with its second and third harmonics, as a voice has, note after note (MIDI numbers). */
const hum = (notes: number[], each = 0.4, rate = RATE) => {
  const parts = notes.map(m => {
    const f = 440 * 2 ** ((m - 69) / 12), x = new Float32Array(Math.round(each * rate));
    for (let i = 0; i < x.length; i++) { const w = (2 * Math.PI * f * i) / rate; x[i] = 0.3 * Math.sin(w) + 0.12 * Math.sin(2 * w) + 0.06 * Math.sin(3 * w); }
    return x;
  });
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

describe('the pitch line', () => {
  it('a sine at 220 Hz reads A3, within a few cents, frame after frame', () => {
    const line = pitchLine(sine(220, 1), RATE);
    expect(line.length).toBeGreaterThan(10);
    for (const m of line) { expect(m).toBeGreaterThan(56.95); expect(m).toBeLessThan(57.05); }
    expect(noteName(line[5])).toBe('A3');
    expect(noteName(midiOf(440))).toBe('A4');
  });
  it('reads the fundamental of a hum with harmonics, and other notes too (C4, E4, G4 at 48 kHz)', () => {
    for (const [m, name] of [[60, 'C4'], [64, 'E4'], [67, 'G4']] as const) {
      const line = pitchLine(hum([m], 0.6, 48000), 48000);
      expect(noteName(line[Math.floor(line.length / 2)]), name).toBe(name);
    }
  });
  it('silence and noise are no pitch: 0 in the line, null from a frame', () => {
    expect(pitchLine(new Float32Array(RATE), RATE).every(m => m === 0)).toBe(true);
    let seed = 7;
    const noise = Float32Array.from({ length: RATE }, () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - 0.5) * 0.6; });
    const line = pitchLine(noise, RATE);
    expect(line.filter(m => m > 0).length / line.length).toBeLessThan(0.2);
    expect(yin(new Float32Array(4000), 0, RATE)).toBeNull();
    expect(frameOf(null)).toBe(0);
    expect(frameOf(220)).toBe(57);
  });
  it('one frame every FRAME_S: a second is twenty frames, give or take a window', () => {
    expect(FRAME_S).toBe(0.05);
    expect(pitchLine(sine(220, 2), RATE).length).toBeGreaterThanOrEqual(38);
  });
});

describe('the key guess (Music Companion\'s key finder over the line)', () => {
  const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
  const NAT_MINOR = [0, 2, 3, 5, 7, 8, 10, 12];
  const scale = (tonic: number, steps: number[]) => pitchLine(hum([...steps, ...[...steps].reverse()].map(s => tonic + s), 0.25), RATE);
  it('a C major scale reads C major; G major reads G major', () => {
    expect(keyOfLine(scale(60, MAJOR))).toBe('C major');
    expect(keyOfLine(scale(55, MAJOR))).toBe('G major');
  });
  it('a tune that dwells on G, B flat and D reads G minor', () => {
    const tune = [55, 58, 62, 58, 55, 62, 60, 58, 57, 55, 58, 62, 67, 62, 58, 55].map(m => m);
    expect(keyOfLine(pitchLine(hum(tune, 0.3), RATE))).toBe('G minor');
  });
  it('absent when too little is sung, or on one note alone (the key finder is unsure)', () => {
    expect(keyOfLine(scale(60, MAJOR).slice(0, KEY_MIN_FRAMES - 1).map(() => 60))).toBeUndefined();
    expect(keyOfLine(Array(200).fill(57))).toBeUndefined();
    expect(keyOfLine([])).toBeUndefined();
    expect(keyOfLine(Array(200).fill(0))).toBeUndefined();
  });
  it('a natural minor scale on A names A minor or its relative C major, never anything else', () => {
    expect(['A minor', 'C major']).toContain(keyOfLine(scale(57, NAT_MINOR)));
  });
});

describe('tap tempo', () => {
  const taps = (bpm: number, n: number, from = 1000) => Array.from({ length: n }, (_, i) => from + (i * 60000) / bpm);
  it('reads beats a minute from the taps, from the second tap on', () => {
    expect(bpmOf([])).toBeUndefined();
    expect(bpmOf([1000])).toBeUndefined();
    expect(bpmOf(taps(96, 2))).toBe(96);
    expect(bpmOf(taps(120, 8))).toBe(120);
  });
  it('a stray tap does not move it (the median), and a pause starts again', () => {
    const t = taps(90, 6);
    t.splice(3, 0, t[2] + 100);
    expect(bpmOf(t)).toBe(90);
    const later = [...taps(60, 4), ...taps(140, 4, 10000 + GAP_MS)];
    expect(runOf(later)).toHaveLength(4);
    expect(bpmOf(later)).toBe(140);
  });
  it('stays within 30 and 300', () => {
    expect(bpmOf([0, 10])).toBe(300);
    expect(bpmOf([0, 1900])).toBe(32);
  });
});
