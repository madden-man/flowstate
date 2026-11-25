// Copied from Music Companion (scripts/make-fixtures.ts at 5f6e05c), its file writing replaced by fixture() below.
import { encodeWav, fadeEnds, logSweep, sine } from './gen-wav';
import { readWav } from './wav';

/**
 * Writes the generated audio fixtures (never recorded):
 * - fixtures/audio/tone.wav: 4 s of 440 Hz, 48 kHz mono 16 bit.
 * - fixtures/audio/sweep.wav: 3 s logarithmic sweep from 30 Hz to 16 kHz.
 * - fixtures/audio/c-major-cadence.wav: C F G C triads, 2 s each (M6b).
 * - fixtures/audio/a-minor-loop.wav: Am F C G triads, 2 s each (M6b). The same
 *   notes as C major, so it names C major or A minor first with the other close.
 * - fixtures/audio/a-minor-dwell.wav: the loop dwelling on Am, 5 s, then F, C and
 *   G for 1 s each (M6b), which names A minor first.
 * - fixtures/audio/c-major-outside.wav: C F G C then Bb, 2 s each (M6b): one
 *   chord outside the key.
 * - fixtures/audio/silence.wav: 2 s of silence (M6b).
 */
export const SAMPLE_RATE = 48_000;

/** The frequency of MIDI note `midi` with A4 (69) at `a4` Hz. */
export function midiHz(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/**
 * One chord for `seconds`: every note a sine with its second and third
 * harmonics at half and a third of its level, faded at both ends.
 */
export function chordTone(
  notes: readonly number[],
  seconds: number,
  sampleRate = SAMPLE_RATE,
  a4 = 440,
  level = 0.14,
): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (const midi of notes) {
    const f = midiHz(midi, a4);
    for (const [h, gain] of [
      [1, 1],
      [2, 1 / 2],
      [3, 1 / 3],
    ] as const) {
      const w = (2 * Math.PI * f * h) / sampleRate;
      for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) + level * gain * Math.sin(w * i);
    }
  }
  return fadeEnds(out, sampleRate, 0.02);
}

/** Chords one after another, each `seconds` long (one length for all, or one per chord). */
export function progression(
  chords: readonly (readonly number[])[],
  seconds: number | readonly number[] = 2,
  sampleRate = SAMPLE_RATE,
  a4 = 440,
): Float32Array {
  const parts = chords.map((c, i) =>
    chordTone(c, typeof seconds === 'number' ? seconds : (seconds[i] ?? 2), sampleRate, a4),
  );
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Root position triads around middle C, as MIDI notes. */
export const TRIADS = {
  C: [60, 64, 67],
  F: [65, 69, 72],
  G: [67, 71, 74],
  Am: [57, 60, 64],
  Bb: [58, 62, 65],
} as const;

export const CADENCE = [TRIADS.C, TRIADS.F, TRIADS.G, TRIADS.C] as const;
export const MINOR_LOOP = [TRIADS.Am, TRIADS.F, TRIADS.C, TRIADS.G] as const;
export const DWELL_SECONDS = [5, 1, 1, 1] as const;
export const OUTSIDE = [TRIADS.C, TRIADS.F, TRIADS.G, TRIADS.C, TRIADS.Bb] as const;

/** FlowState keeps no audio files: each fixture is made in memory as the script would write it, through the same 16 bit
 *  WAV encoding and the copied reader, so the known answers are the same numbers Music Companion's tests read. */
const MADE: Record<string, () => Float32Array> = {
  'tone.wav': () => sine(440, 4, SAMPLE_RATE),
  'sweep.wav': () => logSweep(30, 16_000, 3, SAMPLE_RATE),
  'c-major-cadence.wav': () => progression(CADENCE),
  'a-minor-loop.wav': () => progression(MINOR_LOOP),
  'a-minor-dwell.wav': () => progression(MINOR_LOOP, DWELL_SECONDS),
  'c-major-outside.wav': () => progression(OUTSIDE),
  'silence.wav': () => new Float32Array(2 * SAMPLE_RATE),
};
const cache = new Map<string, ReturnType<typeof readWav>>();
export function fixture(name: string) {
  let w = cache.get(name);
  if (!w) { w = readWav(new Uint8Array(encodeWav(MADE[name]!(), SAMPLE_RATE))); cache.set(name, w); }
  return w;
}
