// W0 spike (PLAN-WORLDS.md section 13): a small YIN pitch detector, pure TypeScript, no dependency.
// de Cheveigne and Kawahara, "YIN, a fundamental frequency estimator for speech and music" (2002):
// difference function, cumulative mean normalised difference, absolute threshold, parabolic interpolation.
// The spike decodes a hum at 16 kHz and runs this over it frame by frame; W6 takes it over if it reads well.

export interface PitchOptions {
  /** lowest pitch looked for, Hz (a low male hum is about 80) */
  minHz?: number;
  /** highest pitch looked for, Hz */
  maxHz?: number;
  /** YIN's absolute threshold on the normalised difference */
  threshold?: number;
  /** a frame quieter than this root mean square is unvoiced */
  minRms?: number;
}

const DEFAULTS: Required<PitchOptions> = { minHz: 70, maxHz: 1000, threshold: 0.15, minRms: 0.01 };

/** The samples one frame needs: the integration window plus the longest lag. */
export const frameLength = (sampleRate: number, o: PitchOptions = {}) => {
  const { minHz } = { ...DEFAULTS, ...o };
  const tauMax = Math.ceil(sampleRate / minHz);
  return { window: tauMax, tauMax, length: tauMax * 2 };
};

/** One frame's pitch in Hz, or null when it is unvoiced. `x` must hold at least frameLength(sampleRate).length samples
 *  from `start`. */
export function yin(x: Float32Array, start: number, sampleRate: number, o: PitchOptions = {}): number | null {
  const { minHz, maxHz, threshold, minRms } = { ...DEFAULTS, ...o };
  const { window: W, tauMax } = frameLength(sampleRate, { minHz });
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  if (start + W + tauMax > x.length) return null;
  let energy = 0;
  for (let j = 0; j < W; j++) energy += x[start + j] * x[start + j];
  if (Math.sqrt(energy / W) < minRms) return null;

  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    const o2 = start + tau;
    for (let j = 0; j < W; j++) {
      const diff = x[start + j] - x[o2 + j];
      s += diff * diff;
    }
    d[tau] = s;
  }
  // cumulative mean normalised difference
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running === 0 ? 1 : (d[tau] * tau) / running;
  }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // parabolic interpolation round the dip
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = cmnd[tau - 1], b = cmnd[tau], c = cmnd[tau + 1];
    const den = a + c - 2 * b;
    if (den !== 0) better = tau + (a - c) / (2 * den);
  }
  return sampleRate / better;
}

export interface Track {
  /** seconds between frames */
  hop: number;
  /** Hz a frame, null where unvoiced */
  hz: (number | null)[];
}

/** The pitch of a whole take, one value every `hopSeconds`. */
export function pitchTrack(x: Float32Array, sampleRate: number, hopSeconds = 0.02, o: PitchOptions = {}): Track {
  const { length } = frameLength(sampleRate, o);
  const hop = Math.max(1, Math.round(hopSeconds * sampleRate));
  const hz: (number | null)[] = [];
  for (let start = 0; start + length <= x.length; start += hop) hz.push(yin(x, start, sampleRate, o));
  return { hop: hop / sampleRate, hz };
}

export const midiOf = (hz: number) => 69 + 12 * Math.log2(hz / 440);
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (midi: number) => {
  const n = Math.round(midi);
  return `${NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
};

/** Voiced share and the range sung, from the 5th to the 95th percentile so one stray frame does not set it. */
export function summarise(t: Track) {
  const voiced = t.hz.filter((h): h is number => h !== null).map(midiOf).sort((a, b) => a - b);
  const pct = t.hz.length ? voiced.length / t.hz.length : 0;
  if (!voiced.length) return { voicedPct: 0, low: null, high: null };
  const at = (q: number) => voiced[Math.min(voiced.length - 1, Math.max(0, Math.round(q * (voiced.length - 1))))];
  return { voicedPct: pct, low: noteName(at(0.05)), high: noteName(at(0.95)) };
}
