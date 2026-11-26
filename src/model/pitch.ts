// What a take knows (PLAN-WORLDS.md section 6, W6): its pitch line and a key guess, pure, no Web Audio. The pitch is
// read frame by frame with YIN (de Cheveigne and Kawahara 2002: difference function, cumulative mean normalised
// difference, absolute threshold, parabolic interpolation), lifted from the W0 spike's probe (worlds-w0-spike
// src/spike/pitch.ts), which never merges. The key is Music Companion's key finder (./keyfinder.ts, copied unchanged),
// fed a chroma built from the voiced frames of the line: a hum is one voice, so each frame adds its pitch class.
//
// The stored line (Take.pitch, and the row that goes up): one number a frame, FRAME_S apart, evenly over the take's
// seconds; a MIDI note number (69 is A4, 57 is A3) to two decimals, and 0 where no pitch was heard.
import { findKey, namedKey, PITCH_CLASSES } from './keyfinder';

/** Seconds between frames of a pitch line (20 a second; three minutes is 3600 numbers, about 20 KB of a row). */
export const FRAME_S = 0.05;
/** A take is capped at three minutes (PLAN-WORLDS.md section 12, question 7). */
export const TAKE_MAX_S = 180;

export type PitchOptions = { minHz?: number; maxHz?: number; threshold?: number; minRms?: number };
const DEFAULTS: Required<PitchOptions> = { minHz: 70, maxHz: 1000, threshold: 0.15, minRms: 0.01 };

/** The samples one frame needs: the integration window plus the longest lag. */
export function frameLength(sampleRate: number, o: PitchOptions = {}): number {
  const tauMax = Math.ceil(sampleRate / (o.minHz ?? DEFAULTS.minHz));
  return tauMax * 2;
}

/** One frame's pitch in Hz, or null where it is unvoiced (too quiet, or no period found). */
export function yin(x: ArrayLike<number>, start: number, sampleRate: number, o: PitchOptions = {}): number | null {
  const { minHz, maxHz, threshold, minRms } = { ...DEFAULTS, ...o };
  const tauMax = Math.ceil(sampleRate / minHz);
  const W = tauMax;
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  if (start + W + tauMax > x.length) return null;
  let energy = 0;
  for (let j = 0; j < W; j++) energy += x[start + j] * x[start + j];
  if (Math.sqrt(energy / W) < minRms) return null;
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) { const diff = x[start + j] - x[start + tau + j]; s += diff * diff; }
    d[tau] = s;
  }
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) { running += d[tau]; cmnd[tau] = running === 0 ? 1 : (d[tau] * tau) / running; }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = cmnd[tau - 1], b = cmnd[tau], c = cmnd[tau + 1];
    const den = a + c - 2 * b;
    if (den !== 0) better = tau + (a - c) / (2 * den);
  }
  return sampleRate / better;
}

export const midiOf = (hz: number) => 69 + 12 * Math.log2(hz / 440);
/** A frame of the stored line: the MIDI note to two decimals, or 0 for no pitch. */
export const frameOf = (hz: number | null) => (hz === null || !(hz > 0) ? 0 : Math.round(midiOf(hz) * 100) / 100);

/** The note a MIDI number names, spelled with the key finder's plain names: 57 is A3, 69 is A4. */
export function noteName(midi: number): string {
  const n = Math.round(midi);
  return `${PITCH_CLASSES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}

/** The pitch line of a whole recording, one frame every FRAME_S (for tests and any offline pass). */
export function pitchLine(x: ArrayLike<number>, sampleRate: number, o: PitchOptions = {}): number[] {
  const len = frameLength(sampleRate, o), hop = Math.max(1, Math.round(FRAME_S * sampleRate));
  const out: number[] = [];
  for (let s = 0; s + len <= x.length; s += hop) out.push(frameOf(yin(x, s, sampleRate, o)));
  return out;
}

/** How many voiced frames a key guess needs: two seconds of singing. Less, and nothing is guessed. */
export const KEY_MIN_FRAMES = Math.round(2 / FRAME_S);

/** The key a pitch line sounds in, as print ("G minor"), or undefined when too little was sung or the key finder's
 *  confidence is low (keyfinder.ts namedKey: under 0.15, or an even chroma). Each voiced frame adds one to its pitch
 *  class, so a held note counts for as long as it is held. */
export function keyOfLine(line: readonly number[]): string | undefined {
  const chroma = new Float64Array(12);
  let voiced = 0;
  for (const m of line) {
    if (!(m > 0)) continue;
    chroma[((Math.round(m) % 12) + 12) % 12] += 1;
    voiced++;
  }
  if (voiced < KEY_MIN_FRAMES) return undefined;
  const k = namedKey(findKey(chroma), false);
  return k ? `${k.tonic} ${k.mode}` : undefined;
}
