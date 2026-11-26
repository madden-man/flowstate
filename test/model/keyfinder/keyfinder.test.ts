// Copied from Music Companion (tests/unit/keyfinder.test.ts at 5f6e05c), PLAN-WORLDS.md section 6: the key finder's
// known-answer tests, the fixtures made in memory (./fixtures.ts) and the one test of its renderer file dropped.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readWav } from './wav';
import { spectrumDb } from './fft';
import {
  CADENCE,
  MINOR_LOOP,
  DWELL_SECONDS,
  midiHz,
  SAMPLE_RATE,
  chordTone,
  progression,
  fixture,
} from './fixtures';
import { encodeWav } from './gen-wav';
import {
  CHROMA_NOISE_DB,
  KeyAccumulator,
  MIN_CONFIDENCE,
  PITCH_CLASSES,
  UPDATE_SECONDS,
  chordName,
  chordTemplates,
  chroma,
  findChord,
  findKey,
  isSilent,
  keyAt,
  keyOfSpectra,
  keyProfiles,
  namedKey,
  numeralIn,
  soundsLike,
  variation,
} from '../../../src/model/keyfinder';
import type { KeyReading } from '../../../src/model/keyfinder';

/**
 * The key finder (SPEC 5.5, FQ-9 to FQ-14, section 7 key finder answers),
 * checked against the generated fixtures decoded with a tiny wav reader and
 * a plain FFT, so no Web Audio is needed.
 */

const N = 8192;
const HOP = 4096;

/** Every spectrum of `samples`, `N` long and `HOP` apart, with its start time. */
function* spectra(samples: Float32Array, sampleRate = SAMPLE_RATE) {
  for (let off = 0; off + N <= samples.length; off += HOP) {
    yield { db: spectrumDb(samples, N, off), time: (off + N) / sampleRate };
  }
}

function keyOfSamples(samples: Float32Array, sampleRate = SAMPLE_RATE, tuningHz = 440) {
  return keyOfSpectra(
    [...spectra(samples, sampleRate)].map((s) => s.db),
    sampleRate,
    N,
    tuningHz,
  );
}

const name = (k: { tonic: string; mode: string }) => `${k.tonic} ${k.mode}`;

/** Readings over a recording, frame by frame, as the live tracker would see them. */
function readings(samples: Float32Array, opts: { chordWindowSeconds?: number } = {}) {
  const acc = new KeyAccumulator(opts);
  const out: KeyReading[] = [];
  for (const s of spectra(samples))
    if (acc.push(s.db, SAMPLE_RATE, N, s.time)) out.push(acc.reading());
  return { acc, out };
}

/** A seeded random generator (mulberry32), so noise tests can run many seeds. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Consecutive repeats removed. */
const collapse = <T>(xs: T[]) => xs.filter((x, i) => i === 0 || x !== xs[i - 1]);

/** A flat spectrum at `db` with `peaks` (Hz to dB) set on their nearest bins. */
function spectrumWith(peaks: [number, number][], db = -160): Float32Array {
  const out = new Float32Array(N / 2).fill(db);
  for (const [hz, level] of peaks) out[Math.round((hz * N) / SAMPLE_RATE)] = level;
  return out;
}

describe('FQ-9 chroma', () => {
  test('FQ-9 SPEC-7 a 440 Hz sine alone gives an A pitch class', () => {
    const { sampleRate, samples } = fixture('tone.wav');
    const c = chroma(spectrumDb(samples, N, sampleRate), sampleRate, N);
    const loudest = c.indexOf(Math.max(...c));
    expect(PITCH_CLASSES[loudest]).toBe('A');
    for (let i = 0; i < 12; i++) if (i !== 9) expect(c[i]).toBeLessThan(c[9]! * 0.01);
  });

  test('FQ-9 folds 60 Hz to 5 kHz into 12 bins and halves the weight per octave above 2 kHz', () => {
    // A5 (880 Hz) at full weight; A7 (3520 Hz) is 0.82 octave over 2 kHz, so weighs 2000/3520.
    const low = chroma(spectrumWith([[880, -20]]), SAMPLE_RATE, N);
    const high = chroma(spectrumWith([[3520, -20]]), SAMPLE_RATE, N);
    const binHz = (hz: number) => (Math.round((hz * N) / SAMPLE_RATE) * SAMPLE_RATE) / N;
    expect(PITCH_CLASSES[low.indexOf(Math.max(...low))]).toBe('A');
    expect(high[9]! / low[9]!).toBeCloseTo(2000 / binHz(3520), 6);
    // One octave over 2 kHz halves it: B6 at 1975.5 Hz against B7 at 3951 Hz.
    const b6 = chroma(spectrumWith([[1975.5, -20]]), SAMPLE_RATE, N);
    const b7 = chroma(spectrumWith([[3951, -20]]), SAMPLE_RATE, N);
    expect(b7[11]! / b6[11]!).toBeCloseTo(0.5, 1);
    // Up to 2 kHz the weight is flat: A3 and A5 count the same.
    const a3 = chroma(spectrumWith([[220, -20]]), SAMPLE_RATE, N);
    expect(a3[9]! / low[9]!).toBeCloseTo(1, 6);
    // Outside 60 Hz to 5 kHz nothing counts.
    for (const hz of [40, 55, 5200, 8000]) {
      expect(isSilent(chroma(spectrumWith([[hz, -20]]), SAMPLE_RATE, N))).toBe(true);
    }
  });

  test('FQ-9 white noise folds to an even chroma, since each pitch class is divided by its share of the bins', () => {
    const flat = chroma(new Float32Array(N / 2).fill(-40), SAMPLE_RATE, N);
    for (const v of flat) expect(v).toBeCloseTo(flat[0]!, 9);
    expect(findKey(flat).confidence).toBe(0);
  });

  test('FQ-9 bins under the noise floor add nothing', () => {
    const hiss = new Float32Array(N / 2).fill(CHROMA_NOISE_DB - 1);
    expect(isSilent(chroma(hiss, SAMPLE_RATE, N))).toBe(true);
    expect(chroma(hiss, SAMPLE_RATE, N).every((v) => v === 0)).toBe(true);
  });
});

describe('FQ-10 overall key', () => {
  test('FQ-10 the 24 Krumhansl-Schmuckler profiles score every key, best first, spelled as the circle', () => {
    expect(keyProfiles.major[0]).toBe(6.35);
    expect(keyProfiles.minor[3]).toBe(5.38);
    const { samples } = fixture('c-major-cadence.wav');
    const k = keyOfSamples(samples);
    expect(k.candidates).toHaveLength(24);
    for (let i = 1; i < 24; i++)
      expect(k.candidates[i - 1]!.score).toBeGreaterThanOrEqual(k.candidates[i]!.score);
    expect(new Set(k.candidates.map(name)).size).toBe(24);
    expect(keyAt(6, 'major')).toEqual({ tonic: 'F#', mode: 'major' });
    expect(keyAt(1, 'major')).toEqual({ tonic: 'Db', mode: 'major' });
    expect(keyAt(10, 'major')).toEqual({ tonic: 'Bb', mode: 'major' });
    expect(keyAt(3, 'minor')).toEqual({ tonic: 'D#', mode: 'minor' });
    expect(keyAt(1, 'minor')).toEqual({ tonic: 'C#', mode: 'minor' });
  });

  test('FQ-10 SPEC-7 c-major-cadence.wav resolves to C major with confidence over 30 percent', () => {
    const { sampleRate, samples } = fixture('c-major-cadence.wav');
    expect(sampleRate).toBe(48_000);
    expect(samples.length).toBe(8 * 48_000);
    const k = keyOfSamples(samples, sampleRate);
    expect(name(k.candidates[0]!)).toBe('C major');
    expect(k.confidence).toBeGreaterThan(0.3);
    expect(k.silent).toBe(false);
  });

  test('FQ-10 SPEC-7 a-minor-loop.wav (2 s each) names C major or A minor first with the other in the top three', () => {
    const { sampleRate, samples } = fixture('a-minor-loop.wav');
    expect(samples.length).toBe(8 * 48_000);
    const k = keyOfSamples(samples, sampleRate);
    const top = k.candidates.slice(0, 3).map(name);
    expect(['C major', 'A minor']).toContain(top[0]);
    expect(top).toContain(top[0] === 'C major' ? 'A minor' : 'C major');
  });

  test('FQ-10 SPEC-7 a-minor-dwell.wav, the loop dwelling on Am, names A minor first and C major second', () => {
    const { sampleRate, samples } = fixture('a-minor-dwell.wav');
    expect(samples.length).toBe(8 * 48_000);
    const k = keyOfSamples(samples, sampleRate);
    expect(name(k.candidates[0]!)).toBe('A minor');
    expect(name(k.candidates[1]!)).toBe('C major');
    expect(k.confidence).toBeGreaterThan(MIN_CONFIDENCE);
  });

  test('FQ-10 the key line adds the relative key when it is in the top three: "Sounds like C major (or its relative A minor)"', () => {
    const { samples } = fixture('a-minor-loop.wav');
    const k = keyOfSamples(samples);
    const first = k.candidates[0]!;
    expect(soundsLike(first, k)).toBe(
      first.mode === 'major'
        ? 'Sounds like C major (or its relative A minor)'
        : 'Sounds like A minor (or its relative C major)',
    );
    // The cadence keeps A minor out of its top three.
    const cadence = keyOfSamples(fixture('c-major-cadence.wav').samples);
    expect(cadence.candidates.slice(0, 3).map(name)).not.toContain('A minor');
    expect(soundsLike(cadence.candidates[0]!, cadence)).toBe('Sounds like C major');
    expect(soundsLike({ tonic: 'Eb', mode: 'major' }, null)).toBe('Sounds like Eb major');
  });

  test('FQ-10 SPEC-7 a chroma of all equal values gives zero confidence', () => {
    expect(findKey(new Float64Array(12).fill(1)).confidence).toBe(0);
    expect(findKey(new Float64Array(12)).confidence).toBe(0);
  });

  test('FQ-10 confidence is the relative gap between the first and second candidate', () => {
    const { samples } = fixture('c-major-cadence.wav');
    const k = keyOfSamples(samples);
    const [a, b] = k.candidates;
    expect(k.confidence).toBeCloseTo((a!.score - b!.score) / (1 - b!.score), 9);
  });

  test('FQ-10 the live estimate updates every half second of frame time and Reset starts over', () => {
    const { samples } = fixture('c-major-cadence.wav');
    const { acc, out } = readings(samples);
    const times = out.map((r) => r.time);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(UPDATE_SECONDS);
      expect(times[i]! - times[i - 1]!).toBeLessThan(UPDATE_SECONDS + HOP / SAMPLE_RATE);
    }
    expect(out.length).toBeGreaterThanOrEqual(14);
    const last = out.at(-1)!;
    expect(last.key && name(last.key)).toBe('C major');
    acc.reset();
    expect(acc.reading().estimate).toBeNull();
    expect(acc.reading().key).toBeNull();
    // Time running backwards (a new source) starts over too.
    acc.push(spectrumDb(samples, N, 0), SAMPLE_RATE, N, 5);
    acc.push(spectrumDb(samples, N, 0), SAMPLE_RATE, N, 1);
    expect(acc.reading().time).toBe(1);
  });

  test('FQ-10 a bridge toward the relative minor shows as A minor climbing the candidates', () => {
    const verse = progression(CADENCE);
    const bridge = progression(MINOR_LOOP, DWELL_SECONDS);
    // Two verses of the cadence, then the minor loop twice as a bridge.
    const song = new Float32Array(verse.length * 2 + bridge.length * 2);
    song.set(verse, 0);
    song.set(verse, verse.length);
    song.set(bridge, verse.length * 2);
    song.set(bridge, verse.length * 2 + bridge.length);
    const { out } = readings(song);
    const rank = (r: KeyReading) => r.estimate!.candidates.findIndex((c) => name(c) === 'A minor');
    const lead = (r: KeyReading) =>
      r.estimate!.candidates[0]!.score -
      r.estimate!.candidates.find((c) => name(c) === 'A minor')!.score;
    const endOfVerses = out.filter((r) => r.time <= 16).at(-1)!;
    const end = out.at(-1)!;
    expect(name(end.estimate!.candidates[0]!)).toBe('C major');
    const bridgeReadings = out.filter((r) => r.time > 16);
    expect(rank(endOfVerses)).toBeGreaterThan(1);
    expect(Math.min(...bridgeReadings.map(rank))).toBeLessThan(rank(endOfVerses));
    expect(lead(end)).toBeLessThan(lead(endOfVerses) * 0.7);
  });
});

describe('FQ-11 current chord', () => {
  test('FQ-11 templates cover major, minor, diminished and dominant seventh on all twelve roots', () => {
    expect(chordTemplates).toHaveLength(48);
    const g7 = chordTemplates.find((t) => t.root === 7 && t.quality === 'dominant7')!;
    expect(g7.template.flatMap((v, i) => (v ? [PITCH_CLASSES[i]] : []))).toEqual([
      'D',
      'F',
      'G',
      'B',
    ]);
    const bdim = chordTemplates.find((t) => t.root === 11 && t.quality === 'diminished')!;
    expect(bdim.template.flatMap((v, i) => (v ? [PITCH_CLASSES[i]] : []))).toEqual(['D', 'F', 'B']);
  });

  test('FQ-11 SPEC-7 the cadence chords read C, F, G, C and I, IV, V, I in C major', () => {
    const { samples } = fixture('c-major-cadence.wav');
    const key = { tonic: 'C', mode: 'major' } as const;
    const found = [0, 1, 2, 3].map((i) => {
      // The middle of each 2 s chord.
      const off = Math.round((i * 2 + 1) * SAMPLE_RATE) - N / 2;
      const chord = findChord(chroma(spectrumDb(samples, N, off), SAMPLE_RATE, N))!;
      return [chordName(chord, key), numeralIn(chord, key)];
    });
    expect(found).toEqual([
      ['C', 'I'],
      ['F', 'IV'],
      ['G', 'V'],
      ['C', 'I'],
    ]);
  });

  test('FQ-11 the live chord over a 1.5 s window moves I, IV, V, I while the key holds on C major', () => {
    const { samples } = fixture('c-major-cadence.wav');
    const { out } = readings(samples, { chordWindowSeconds: 1.5 });
    const named = out.filter((r) => r.key);
    expect(named.length).toBeGreaterThan(5);
    // Once the F has sounded, the key holds on C major to the end.
    const settled = out.filter((r) => r.time >= 3);
    expect(new Set(settled.map((r) => r.key && name(r.key)))).toEqual(new Set(['C major']));
    const numerals = collapse(named.map((r) => r.numeral).filter((n): n is string => n !== null));
    expect(numerals.join(' ')).toMatch(/I.*IV.*V.*I/);
    expect(collapse(out.map((r) => (r.chord ? chordName(r.chord) : '-')))).toEqual(
      expect.arrayContaining(['C', 'F', 'G']),
    );
  });

  test('FQ-11 numerals in major and minor keys, null outside the key', () => {
    const C = { tonic: 'C', mode: 'major' } as const;
    const Am = { tonic: 'A', mode: 'minor' } as const;
    expect(numeralIn({ root: 9, quality: 'minor' }, C)).toBe('vi');
    expect(numeralIn({ root: 11, quality: 'diminished' }, C)).toBe('vii°');
    expect(numeralIn({ root: 7, quality: 'dominant7' }, C)).toBe('V7');
    expect(numeralIn({ root: 10, quality: 'major' }, C)).toBeNull();
    expect(numeralIn({ root: 2, quality: 'major' }, C)).toBeNull();
    expect(numeralIn({ root: 9, quality: 'minor' }, Am)).toBe('i');
    expect(numeralIn({ root: 11, quality: 'diminished' }, Am)).toBe('ii°');
    expect(numeralIn({ root: 4, quality: 'minor' }, Am)).toBe('v');
    expect(numeralIn({ root: 4, quality: 'major' }, Am)).toBe('V');
    expect(numeralIn({ root: 4, quality: 'dominant7' }, Am)).toBe('V7');
    expect(numeralIn({ root: 8, quality: 'diminished' }, Am)).toBe('vii°');
    expect(numeralIn({ root: 5, quality: 'major' }, Am)).toBe('VI');
    expect(numeralIn({ root: 6, quality: 'major' }, Am)).toBeNull();
  });

  test('FQ-11 chord names follow the key spelling, and plain names outside it', () => {
    const Fs = { tonic: 'F#', mode: 'major' } as const;
    expect(chordName({ root: 5, quality: 'diminished' }, Fs)).toBe('E#dim');
    expect(chordName({ root: 3, quality: 'minor' }, Fs)).toBe('D#m');
    expect(chordName({ root: 8, quality: 'minor' }, { tonic: 'A', mode: 'minor' })).toBe('G#m');
    expect(chordName({ root: 10, quality: 'major' })).toBe('Bb');
    expect(chordName({ root: 6, quality: 'dominant7' })).toBe('F#7');
  });

  test('FQ-11 one note rich in harmonics names no chord', () => {
    // A3 with three harmonics, and E2 with eight (each a step quieter).
    for (const [midi, harmonics] of [
      [57, 3],
      [40, 8],
    ] as const) {
      const f = midiHz(midi);
      const note = new Float32Array(2 * SAMPLE_RATE).map((_, i) => {
        let v = 0;
        for (let h = 1; h <= harmonics; h++)
          v += (0.3 / h) * Math.sin((2 * Math.PI * f * h * i) / SAMPLE_RATE);
        return v;
      });
      expect(
        findChord(chroma(spectrumDb(note, N, SAMPLE_RATE / 2), SAMPLE_RATE, N)),
        `${midi}`,
      ).toBeNull();
    }
    // The cadence triads still clear the bar.
    const triad = chordTone([60, 64, 67], 2);
    expect(
      findChord(chroma(spectrumDb(triad, N, SAMPLE_RATE / 2), SAMPLE_RATE, N))?.score,
    ).toBeGreaterThan(0.95);
  });

  test('FQ-11 a single note names no chord', () => {
    const { sampleRate, samples } = fixture('tone.wav');
    expect(findChord(chroma(spectrumDb(samples, N, sampleRate), sampleRate, N))).toBeNull();
  });
});

describe('FQ-13 reference tuning', () => {
  test('FQ-13 a cadence played at A4 = 450 Hz reads C major against 450 and one step up against 430', () => {
    const seconds = [2, 2, 2, 2];
    const parts = CADENCE.map((c, i) => chordTone(c, seconds[i]!, SAMPLE_RATE, 450));
    const samples = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    parts.forEach((p, i) => samples.set(p, i * p.length));
    expect(name(keyOfSamples(samples, SAMPLE_RATE, 450).candidates[0]!)).toBe('C major');
    expect(name(keyOfSamples(samples, SAMPLE_RATE, 440).candidates[0]!)).toBe('C major');
    // 450 over 430 is 79 cents, so every pitch class lands a semitone up.
    expect(name(keyOfSamples(samples, SAMPLE_RATE, 430).candidates[0]!)).toBe('Db major');
  });

  test('FQ-13 changing the tuning on the live tracker starts the accumulation over', () => {
    const { samples } = fixture('c-major-cadence.wav');
    const { acc } = readings(samples);
    expect(acc.reading().estimate).not.toBeNull();
    acc.configure({ chordWindowSeconds: 3 });
    expect(acc.reading().estimate).not.toBeNull();
    acc.configure({ tuningHz: 432 });
    expect(acc.reading().estimate).toBeNull();
    expect(acc.options).toEqual({ chordWindowSeconds: 3, tuningHz: 432 });
  });
});

describe('FQ-14 silence and noise', () => {
  test('FQ-14 SPEC-7 a 440 Hz sine alone says "Listening" for the key', () => {
    const { sampleRate, samples } = fixture('tone.wav');
    const k = keyOfSamples(samples, sampleRate);
    expect(k.confidence).toBeLessThan(MIN_CONFIDENCE);
    expect(namedKey(k, false)).toBeNull();
    const { out } = readings(samples);
    expect(out.length).toBeGreaterThan(3);
    for (const r of out) expect(r.key).toBeNull();
  });

  test('FQ-14 silence names no key and no chord', () => {
    const silence = new Float32Array(3 * SAMPLE_RATE);
    const k = keyOfSamples(silence);
    expect(k.silent).toBe(true);
    expect(k.confidence).toBe(0);
    const { out } = readings(silence);
    for (const r of out) {
      expect(r.silent).toBe(true);
      expect(r.key).toBeNull();
      expect(r.chord).toBeNull();
    }
    expect(findChord(new Float64Array(12))).toBeNull();
  });

  test('FQ-14 white noise names no key, offline or live, for every seed', () => {
    for (const seed of [1, 7, 42, 1234, 99_991, 2_026_1024]) {
      const rand = mulberry32(seed);
      const noise = new Float32Array(4 * SAMPLE_RATE).map(() => (rand() * 2 - 1) * 0.3);
      const k = keyOfSamples(noise);
      expect(k.silent, `seed ${seed}`).toBe(false);
      expect(k.noise, `seed ${seed}`).toBe(true);
      expect(k.variation, `seed ${seed}`).toBeLessThan(0.1);
      expect(k.confidence, `seed ${seed}`).toBe(0);
      const { out } = readings(noise);
      expect(out.length).toBeGreaterThan(5);
      for (const r of out) expect(r.key, `seed ${seed} at ${r.time}`).toBeNull();
    }
  });

  test('FQ-14 a chord under loud noise is still uneven enough to be heard as a chord', () => {
    const rand = mulberry32(5);
    const chord = chordTone([60, 64, 67], 4);
    const mixed = chord.map((v) => v + (rand() * 2 - 1) * 0.3);
    const k = keyOfSamples(mixed);
    expect(k.noise).toBe(false);
    expect(variation(chroma(spectrumDb(mixed, N, SAMPLE_RATE), SAMPLE_RATE, N))).toBeGreaterThan(
      0.1,
    );
  });

  test('FQ-14 the panel names a key only once confidence passes 15 percent and sound is heard', () => {
    const { samples } = fixture('c-major-cadence.wav');
    const k = keyOfSamples(samples);
    expect(namedKey(k, false)?.tonic).toBe('C');
    expect(namedKey(k, true)).toBeNull();
    expect(namedKey({ ...k, confidence: 0.149 }, false)).toBeNull();
    expect(namedKey({ ...k, confidence: 0.15 }, false)?.tonic).toBe('C');
  });

  test('FQ-14 once named, a key stays named while it is first and confidence holds at 8 percent, until silence', () => {
    const { samples } = fixture('c-major-cadence.wav');
    const k = keyOfSamples(samples);
    const low = { ...k, confidence: 0.08 };
    const C = { tonic: 'C', mode: 'major' } as const;
    expect(namedKey(low, false, C)?.tonic).toBe('C');
    expect(namedKey({ ...k, confidence: 0.079 }, false, C)).toBeNull();
    expect(namedKey({ ...k, confidence: 0.1 }, false, null)).toBeNull();
    expect(namedKey(low, false, { tonic: 'G', mode: 'major' })).toBeNull();
    expect(namedKey(low, true, C)).toBeNull();
    expect(namedKey({ ...k, confidence: 0 }, false, C)).toBeNull();
  });
});

describe('FQ-10 offline pass and fixtures', () => {
  test('FQ-10 the wav reader reads the fixtures the script writes, stereo mixed to mono', () => {
    const stereo = encodeWav([0.5, 0.5], 8000);
    // Rewrite as one stereo frame: channels 2, block align 4.
    stereo.writeUInt16LE(2, 22);
    stereo.writeUInt16LE(4, 32);
    stereo.writeUInt32LE(16_000 * 2, 28);
    const wav = readWav(stereo);
    expect(wav.sampleRate).toBe(8000);
    expect(wav.samples).toHaveLength(1);
    expect(wav.samples[0]).toBeCloseTo(0.5, 3);
  });

  test('FQ-10 the copied key finder uses no page timer and no clock', () => {
    const domain = readFileSync('src/model/keyfinder.ts', 'utf8');
    expect(domain).not.toMatch(/setTimeout|setInterval|requestAnimationFrame|Date\.now/);
  });
});
