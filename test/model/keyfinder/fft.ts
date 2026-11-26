// Copied from Music Companion (tests/helpers/fft.ts at 5f6e05c) with the key finder (PLAN-WORLDS.md section 6).
/**
 * A plain radix-2 FFT for the key finder tests (SPEC 8), so chroma can be
 * checked from decoded samples without Web Audio. `spectrumDb` windows one
 * block with a Blackman window and answers magnitude over N in dB per bin,
 * the scale an AnalyserNode reports.
 */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0)
    throw new Error('The FFT size must be a power of two.');
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const half = len / 2;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + half;
        const tr = re[b]! * wr - im[b]! * wi;
        const ti = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
      }
    }
  }
}

const windows = new Map<number, Float64Array>();

function blackman(n: number): Float64Array {
  let w = windows.get(n);
  if (!w) {
    w = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const x = i / n;
      w[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * x) + 0.08 * Math.cos(4 * Math.PI * x);
    }
    windows.set(n, w);
  }
  return w;
}

/** dB per bin (`size / 2` long) of `size` samples from `offset`, zero padded past the end. */
export function spectrumDb(samples: ArrayLike<number>, size: number, offset = 0): Float32Array {
  const w = blackman(size);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < size; i++) re[i] = (samples[offset + i] ?? 0) * w[i]!;
  fft(re, im);
  const out = new Float32Array(size / 2);
  for (let k = 0; k < out.length; k++) {
    const mag = Math.hypot(re[k]!, im[k]!) / size;
    out[k] = mag > 0 ? Math.max(-160, 20 * Math.log10(mag)) : -160;
  }
  return out;
}
