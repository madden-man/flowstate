// Copied unchanged from Music Companion (src/shared/domain/keyfinder.ts at 6897f34), PLAN-WORLDS.md section 6: the key finder is
// pure TypeScript and travels as it is, so a hum's key guess on the phone and on the Mac come from the same math. Edit it
// there first and copy it again; nothing below this header is FlowState's own.
/**
 * SPEC 5.5, FQ-9 to FQ-14: the key finder's math, pure. No Web Audio here;
 * callers hand in the magnitudes an AnalyserNode produced (dB per bin, as
 * `magnitudesDb` in spectrum.ts mirrors) and get back a 12-bin chroma, the
 * overall key with its candidates and confidence, and the current chord with
 * its roman numeral in that key.
 */
import { circleKey, diatonicTriads, keyOf, pitchClass } from './theory';
import type { KeyRef, Mode } from './theory';

/** FQ-9: bins between these frequencies count toward the chroma. */
export const CHROMA_MIN_HZ = 60;
export const CHROMA_MAX_HZ = 5000;
/** FQ-9: above this the weight halves per octave, so overtones do not swamp the fundamentals. */
export const CHROMA_ROLLOFF_HZ = 2000;
/** A bin quieter than this (dB) is room hiss and adds nothing. */
export const CHROMA_NOISE_DB = -90;
/** FQ-13: the default reference tuning, A4 in Hz. */
export const DEFAULT_TUNING_HZ = 440;
/** FQ-14: a chroma whose loudest pitch class is under this counts as silence. */
export const SILENCE_FLOOR = 1e-3;
/** FQ-10: recordings longer than this (seconds) or larger (bytes) are not analyzed offline. */
export const MAX_ANALYZE_SECONDS = 20 * 60;
export const MAX_ANALYZE_BYTES = 200 * 1000 * 1000;
/** FQ-14: the confidence a key needs before the panel names it. */
export const MIN_CONFIDENCE = 0.15;
/** FQ-14: once named, a key stays named while it is first and its confidence holds at this or more. */
export const HOLD_CONFIDENCE = 0.08;
/**
 * FQ-14: a chroma whose coefficient of variation (spread over mean) is under
 * this is noise. Noise measures 0.01 to 0.02, chords under loud noise 0.3,
 * clean chords 0.8 and up.
 */
export const NOISE_VARIATION = 0.1;

/** Pitch class names for display when no key says how to spell them. */
export const PITCH_CLASSES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Pitch class and weight of every bin that counts, per sample rate, FFT size and tuning. */
interface BinMap {
  from: number;
  pcs: Uint8Array;
  weights: Float64Array;
  /** Per pitch class, the total weight of its bins: what a flat spectrum adds. */
  share: Float64Array;
}

const binMaps = new Map<string, BinMap>();

function binMap(sampleRate: number, fftSize: number, tuningHz: number, bins: number): BinMap {
  const id = `${sampleRate} ${fftSize} ${tuningHz} ${bins}`;
  let map = binMaps.get(id);
  if (map) return map;
  const width = sampleRate / fftSize;
  const from = Math.max(1, Math.ceil(CHROMA_MIN_HZ / width));
  const to = Math.min(bins - 1, Math.floor(CHROMA_MAX_HZ / width));
  const count = Math.max(0, to - from + 1);
  map = {
    from,
    pcs: new Uint8Array(count),
    weights: new Float64Array(count),
    share: new Float64Array(12),
  };
  for (let j = 0; j < count; j += 1) {
    const hz = (from + j) * width;
    const pc = mod12(Math.round(12 * Math.log2(hz / tuningHz)) + 9);
    const weight = hz <= CHROMA_ROLLOFF_HZ ? 1 : CHROMA_ROLLOFF_HZ / hz;
    map.pcs[j] = pc;
    map.weights[j] = weight;
    map.share[pc] = (map.share[pc] ?? 0) + weight;
  }
  // Scaled so the shares average 1: a pitch class with more bins counts each a little less.
  const mean = map.share.reduce((a, b) => a + b, 0) / 12;
  for (let pc = 0; pc < 12; pc += 1) map.share[pc] = mean > 0 ? (map.share[pc] ?? 0) / mean : 1;
  if (binMaps.size > 16) binMaps.clear();
  binMaps.set(id, map);
  return map;
}

/**
 * FQ-9: fold one spectrum (dB per bin, `fftSize / 2` long) into 12 pitch
 * classes, C at index 0. Each bin from 60 Hz to 5 kHz adds its linear
 * magnitude to the nearest pitch class, measured from A4 = `tuningHz`; the
 * weight is 1 up to 2 kHz and halves per octave above it. Bins under the
 * noise floor add nothing. Each pitch class is then divided by its share of
 * the bins, so a flat spectrum (white noise) folds to a flat chroma.
 */
export function chroma(
  magnitudesDb: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
  tuningHz = DEFAULT_TUNING_HZ,
  out: Float64Array = new Float64Array(12),
): Float64Array {
  out.fill(0);
  const map = binMap(sampleRate, fftSize, tuningHz, magnitudesDb.length);
  for (let j = 0; j < map.pcs.length; j += 1) {
    const db = magnitudesDb[map.from + j] ?? -Infinity;
    if (!(db > CHROMA_NOISE_DB)) continue;
    const pc = map.pcs[j] ?? 0;
    out[pc] = (out[pc] ?? 0) + (map.weights[j] ?? 0) * 10 ** (db / 20);
  }
  for (let pc = 0; pc < 12; pc += 1) out[pc] = (out[pc] ?? 0) / (map.share[pc] || 1);
  return out;
}

/** The coefficient of variation of a chroma: its standard deviation over its mean (0 when empty). */
export function variation(c: ArrayLike<number>): number {
  let mean = 0;
  for (let i = 0; i < 12; i += 1) mean += c[i] ?? 0;
  mean /= 12;
  if (!(mean > 0)) return 0;
  let sq = 0;
  for (let i = 0; i < 12; i += 1) sq += ((c[i] ?? 0) - mean) ** 2;
  return Math.sqrt(sq / 12) / mean;
}

/** FQ-14: true when the chroma is too even to hold a pitch (noise, or nothing). */
export function isNoise(c: ArrayLike<number>): boolean {
  return variation(c) < NOISE_VARIATION;
}

/** FQ-14: true when no pitch class rises above `floor`. */
export function isSilent(c: ArrayLike<number>, floor = SILENCE_FLOOR): boolean {
  for (let i = 0; i < 12; i += 1) if ((c[i] ?? 0) > floor) return false;
  return true;
}

/** FQ-10: the Krumhansl-Schmuckler key profiles, from the tonic up by semitone. */
export const keyProfiles: Readonly<Record<Mode, readonly number[]>> = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
};

export interface KeyCandidate extends KeyRef {
  /** Pitch class of the tonic, C 0. */
  pc: number;
  /** Pearson correlation of the chroma with this key's profile, -1 to 1. */
  score: number;
}

export interface KeyEstimate {
  /** All 24 keys, best first. */
  candidates: KeyCandidate[];
  /**
   * The relative gap between the first and second candidate, 0 to 1: how much
   * of the second's distance from a perfect match (a score of 1) the first
   * closes. Equal scores give 0; a first that matches perfectly gives 1.
   */
  confidence: number;
  /** The chroma's coefficient of variation; under NOISE_VARIATION it is noise (FQ-14). */
  variation: number;
}

function correlation(x: ArrayLike<number>, y: readonly number[], shift: number): number {
  let mx = 0;
  let my = 0;
  for (let i = 0; i < 12; i += 1) {
    mx += x[i] ?? 0;
    my += y[i] ?? 0;
  }
  mx /= 12;
  my /= 12;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < 12; i += 1) {
    const dx = (x[mod12(i + shift)] ?? 0) - mx;
    const dy = (y[i] ?? 0) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  // An even chroma (to rounding) correlates with nothing.
  if (!(sxx > 1e-12 * Math.max(1e-30, mx * mx)) || !(syy > 0)) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

/** The circle's spelling of the key on pitch class `pc`: F# major, Eb minor, Bb major. */
export function keyAt(pc: number, mode: Mode): KeyRef {
  const majorPc = mode === 'major' ? pc : mod12(pc + 3);
  return circleKey(mod12(majorPc * 7), mode);
}

/**
 * FQ-10: correlate the chroma with the 24 key profiles. The confidence is
 * the gap between the first and second scores relative to the second's
 * distance from 1, so an even chroma (every score 0) has none.
 */
export function findKey(c: ArrayLike<number>): KeyEstimate {
  const candidates: KeyCandidate[] = [];
  for (const mode of ['major', 'minor'] as const) {
    for (let pc = 0; pc < 12; pc += 1) {
      candidates.push({ ...keyAt(pc, mode), pc, score: correlation(c, keyProfiles[mode], pc) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const first = candidates[0]?.score ?? 0;
  const second = candidates[1]?.score ?? 0;
  const confidence =
    first > 0 ? Math.min(1, Math.max(0, (first - second) / Math.max(1e-9, 1 - second))) : 0;
  return { candidates, confidence, variation: variation(c) };
}

export type ChordQuality = 'major' | 'minor' | 'diminished' | 'dominant7';

export interface ChordTemplate {
  root: number;
  quality: ChordQuality;
  /** 1 on each chord tone, 0 elsewhere, indexed by pitch class. */
  template: readonly number[];
}

const QUALITY_STEPS: Record<ChordQuality, readonly number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  dominant7: [0, 4, 7, 10],
};

/** FQ-11: the 48 templates, major, minor, diminished and dominant seventh on every root. */
export const chordTemplates: readonly ChordTemplate[] = (
  ['major', 'minor', 'diminished', 'dominant7'] as const
).flatMap((quality) =>
  Array.from({ length: 12 }, (_, root) => {
    const template = Array<number>(12).fill(0);
    for (const s of QUALITY_STEPS[quality]) template[mod12(root + s)] = 1;
    return { root, quality, template };
  }),
);

export interface ChordMatch {
  root: number;
  quality: ChordQuality;
  /** Cosine similarity of the chroma with the template, 0 to 1. */
  score: number;
}

/**
 * FQ-11: a match under this is no chord. One pitch class alone matches six
 * triads at 0.58 and a note rich in harmonics up to 0.75; the cadence triads
 * score 0.96 and up.
 */
export const CHORD_MIN_SCORE = 0.85;

/**
 * FQ-11: the template closest to the chroma (cosine similarity), or null on
 * silence or when nothing matches well enough.
 */
export function findChord(c: ArrayLike<number>, floor = SILENCE_FLOOR): ChordMatch | null {
  if (isSilent(c, floor)) return null;
  let norm = 0;
  for (let i = 0; i < 12; i += 1) norm += (c[i] ?? 0) ** 2;
  norm = Math.sqrt(norm);
  let best: ChordMatch | null = null;
  for (const t of chordTemplates) {
    let dot = 0;
    let tn = 0;
    for (let i = 0; i < 12; i += 1) {
      dot += (c[i] ?? 0) * (t.template[i] ?? 0);
      tn += t.template[i] ?? 0;
    }
    const score = dot / (norm * Math.sqrt(tn));
    if (!best || score > best.score + 1e-9) best = { root: t.root, quality: t.quality, score };
  }
  return best && best.score >= CHORD_MIN_SCORE ? best : null;
}

const SUFFIX: Record<ChordQuality, string> = {
  major: '',
  minor: 'm',
  diminished: 'dim',
  dominant7: '7',
};

/** The diatonic chords of a key, as root pitch class, quality and numeral. */
function diatonic(
  key: KeyRef,
): { pc: number; quality: ChordQuality; numeral: string; root: string }[] {
  const out = diatonicTriads(key).map((t) => ({
    pc: pitchClass(t.chord.root),
    quality: t.chord.quality as ChordQuality,
    numeral: t.numeral,
    root: t.chord.root,
  }));
  // The dominant seventh on V (the harmonic V in minor), and in minor the raised leading tone triad.
  const fifth = keyOf(key.tonic, key.mode).scale[4] as string;
  out.push({ pc: pitchClass(fifth), quality: 'dominant7', numeral: 'V7', root: fifth });
  if (key.mode === 'minor') {
    const pc = mod12(pitchClass(key.tonic) + 11);
    const seventh = keyOf(key.tonic, 'major').scale[6] as string;
    out.push({ pc, quality: 'diminished', numeral: 'vii°', root: seventh });
  }
  return out;
}

/**
 * FQ-11: the roman numeral of `chord` in `key` (I, IV, V, vi, vii°, V7; in
 * minor i, ii°, III, iv, v, V, VI, VII, vii°), or null when the chord is
 * outside the key.
 */
export function numeralIn(chord: Pick<ChordMatch, 'root' | 'quality'>, key: KeyRef): string | null {
  const hit = diatonic(key).find((d) => d.pc === chord.root && d.quality === chord.quality);
  return hit?.numeral ?? null;
}

/**
 * The chord's name, its root spelled as `key` spells it when the root is in
 * the key, else with the plain names (C, Db, F#, Bb).
 */
export function chordName(
  chord: Pick<ChordMatch, 'root' | 'quality'>,
  key?: KeyRef | null,
): string {
  let root: string = PITCH_CLASSES[mod12(chord.root)] ?? 'C';
  if (key) {
    const scale = keyOf(key.tonic, key.mode).scale;
    const spelled =
      scale.find((n) => pitchClass(n) === chord.root) ??
      diatonic(key).find((d) => d.pc === chord.root)?.root;
    if (spelled) root = spelled;
  }
  return `${root}${SUFFIX[chord.quality]}`;
}

/** Add `c` times `weight` into `into`. */
export function addChroma(into: Float64Array, c: ArrayLike<number>, weight = 1): Float64Array {
  for (let i = 0; i < 12; i += 1) into[i] = (into[i] ?? 0) + weight * (c[i] ?? 0);
  return into;
}

/**
 * FQ-14: the overall key as the panel shows it, or null while it says
 * "Listening". Silence and noise (an even chroma) name nothing. A key is
 * named once its confidence passes 15 percent; after that it stays named
 * while it is still the first candidate (`previous`) and its confidence
 * holds at 8 percent or more, so one chord leaning elsewhere does not blank
 * the panel.
 */
export function namedKey(
  estimate: KeyEstimate,
  silent: boolean,
  previous: KeyRef | null = null,
): KeyCandidate | null {
  const first = estimate.candidates[0];
  if (silent || !first || estimate.variation < NOISE_VARIATION) return null;
  if (estimate.confidence >= MIN_CONFIDENCE) return first;
  const holds =
    estimate.confidence >= HOLD_CONFIDENCE &&
    previous?.tonic === first.tonic &&
    previous.mode === first.mode;
  return holds ? first : null;
}

/** The relative key: C major and A minor, spelled as the circle shows it. */
export function relativeOf(key: KeyRef): KeyRef {
  const pc = pitchClass(key.tonic);
  return key.mode === 'major' ? keyAt(mod12(pc + 9), 'minor') : keyAt(mod12(pc + 3), 'major');
}

/**
 * FQ-10: the panel's key line, "Sounds like C major", with "(or its relative
 * A minor)" when the relative key is among the first three candidates.
 */
export function soundsLike(key: KeyRef, estimate: KeyEstimate | null): string {
  const rel = relativeOf(key);
  const near = estimate?.candidates
    .slice(0, 3)
    .some((c) => c.mode === rel.mode && c.pc === pitchClass(rel.tonic));
  const name = `${key.tonic} ${key.mode}`;
  return near
    ? `Sounds like ${name} (or its relative ${rel.tonic} ${rel.mode})`
    : `Sounds like ${name}`;
}

/** FQ-10: the overall estimate is published this often, in seconds of frame time. */
export const UPDATE_SECONDS = 0.5;
/** FQ-11: the default current chord window, in seconds. */
export const DEFAULT_CHORD_WINDOW_SECONDS = 1.5;
/** The longest gap one frame may stand for, so a stalled page does not outweigh the rest. */
const MAX_FRAME_SECONDS = 0.25;
const FIRST_FRAME_SECONDS = 1 / 60;

/** What the key panel shows, as of the last update. */
export interface KeyReading {
  /** The overall estimate over everything heard since the last reset, or null before any sound. */
  estimate: KeyEstimate | null;
  /** The key the panel names, or null while it says "Listening" (FQ-14). */
  key: KeyCandidate | null;
  /** The current chord over the chord window, or null. */
  chord: ChordMatch | null;
  /** The chord's numeral in `key`, or null when there is no key or the chord is outside it. */
  numeral: string | null;
  /** True when nothing rose above the noise floor in the chord window. */
  silent: boolean;
  /** The 12-bin chroma of the chord window, C first, for display. */
  window: number[];
  /** Frame time of this reading, in seconds. */
  time: number;
}

export const EMPTY_READING: KeyReading = {
  estimate: null,
  key: null,
  chord: null,
  numeral: null,
  silent: true,
  window: Array<number>(12).fill(0),
  time: 0,
};

export interface AccumulatorOptions {
  chordWindowSeconds: number;
  tuningHz: number;
}

/**
 * FQ-10 and FQ-11, pure: accumulates the chroma of a stream of spectra.
 * Every frame adds to the overall chroma (weighted by how long it stood) and
 * to the chord window; every half second of frame time the reading is
 * worked out again. Driven by frame timestamps only, never a timer.
 */
export class KeyAccumulator {
  private opts: AccumulatorOptions;
  private total = new Float64Array(12);
  private recent: { time: number; chroma: Float64Array }[] = [];
  private lastTime: number | null = null;
  private lastUpdate: number | null = null;
  private current: KeyReading = EMPTY_READING;

  constructor(opts: Partial<AccumulatorOptions> = {}) {
    this.opts = {
      chordWindowSeconds: opts.chordWindowSeconds ?? DEFAULT_CHORD_WINDOW_SECONDS,
      tuningHz: opts.tuningHz ?? DEFAULT_TUNING_HZ,
    };
  }

  get options(): AccumulatorOptions {
    return this.opts;
  }

  /** A new tuning starts over, since every pitch class moves; a new window applies from now. */
  configure(patch: Partial<AccumulatorOptions>): void {
    const tuningChanged = patch.tuningHz !== undefined && patch.tuningHz !== this.opts.tuningHz;
    this.opts = { ...this.opts, ...patch };
    if (tuningChanged) this.reset();
  }

  /** FQ-10: start the accumulation over. */
  reset(): void {
    this.total = new Float64Array(12);
    this.recent = [];
    this.lastTime = null;
    this.lastUpdate = null;
    this.current = EMPTY_READING;
  }

  reading(): KeyReading {
    return this.current;
  }

  /**
   * Add one spectrum (dB per bin) heard at frame time `time` seconds. Returns
   * true when this frame produced a new reading. Time running backwards (a
   * new source) starts over.
   */
  push(
    magnitudesDb: ArrayLike<number>,
    sampleRate: number,
    fftSize: number,
    time: number,
  ): boolean {
    if (this.lastTime !== null && time < this.lastTime) this.reset();
    const c = chroma(magnitudesDb, sampleRate, fftSize, this.opts.tuningHz);
    // The first frame stands for one display frame; the rest for the time since the one before.
    const dt =
      this.lastTime === null
        ? FIRST_FRAME_SECONDS
        : Math.min(MAX_FRAME_SECONDS, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    addChroma(this.total, c, dt);
    this.recent.push({ time, chroma: c });
    const from = time - this.opts.chordWindowSeconds;
    while (this.recent.length > 1 && (this.recent[0]?.time ?? time) < from) this.recent.shift();
    if (this.lastUpdate !== null && time - this.lastUpdate < UPDATE_SECONDS) return false;
    this.lastUpdate = time;
    this.current = this.compute(time);
    return true;
  }

  private compute(time: number): KeyReading {
    const window = new Float64Array(12);
    for (const r of this.recent) addChroma(window, r.chroma, 1 / this.recent.length);
    // Silence or noise in the chord window shows "Listening" (FQ-14).
    const silent = isSilent(window) || isNoise(window);
    const heard = this.total.some((v) => v > 0);
    const estimate = heard ? findKey(this.total) : null;
    const key = estimate ? namedKey(estimate, silent, this.current.key) : null;
    const chord = silent ? null : findChord(window);
    return {
      estimate,
      key,
      chord,
      numeral: chord && key ? numeralIn(chord, key) : null,
      silent,
      window: Array.from(window),
      time,
    };
  }
}

/**
 * FQ-10, offline: the overall key from a running chroma total over `frames`
 * spectra. Silence and noise give a zero confidence.
 */
export function keyOfChroma(
  total: ArrayLike<number>,
  frames: number,
): KeyEstimate & { silent: boolean; noise: boolean } {
  const mean = Array.from({ length: 12 }, (_, i) => (frames > 0 ? (total[i] ?? 0) / frames : 0));
  const silent = isSilent(mean);
  const estimate = findKey(total);
  const noise = estimate.variation < NOISE_VARIATION;
  return { ...estimate, confidence: silent || noise ? 0 : estimate.confidence, silent, noise };
}

/** FQ-10, offline: the overall key of a whole recording, from its spectra one hop apart. */
export function keyOfSpectra(
  spectra: Iterable<ArrayLike<number>>,
  sampleRate: number,
  fftSize: number,
  tuningHz = DEFAULT_TUNING_HZ,
): KeyEstimate & { silent: boolean; noise: boolean } {
  const total = new Float64Array(12);
  const scratch = new Float64Array(12);
  let frames = 0;
  for (const s of spectra) {
    addChroma(total, chroma(s, sampleRate, fftSize, tuningHz, scratch));
    frames += 1;
  }
  return keyOfChroma(total, frames);
}
