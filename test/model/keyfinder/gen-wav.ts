// Copied from Music Companion (scripts/wav.ts at 5f6e05c) with the key finder (PLAN-WORLDS.md section 6).
/**
 * A pure WAV writer: mono, 16 bit PCM, little endian. No dependencies, so the
 * fixture script and the tests share it. Samples are floats in -1 to 1 and
 * are clipped to that range.
 */
export function encodeWav(samples: Float32Array | number[], sampleRate: number): Buffer {
  const count = samples.length;
  const dataBytes = count * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < count; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  return buf;
}

/** A short linear fade at both ends, so a generated tone starts and stops without a click. */
export function fadeEnds(samples: Float32Array, sampleRate: number, seconds = 0.01): Float32Array {
  const n = Math.min(Math.floor(sampleRate * seconds), Math.floor(samples.length / 2));
  for (let i = 0; i < n; i++) {
    const g = i / n;
    samples[i] = (samples[i] ?? 0) * g;
    const j = samples.length - 1 - i;
    samples[j] = (samples[j] ?? 0) * g;
  }
  return samples;
}

/** A sine at `hz` for `seconds`. */
export function sine(
  hz: number,
  seconds: number,
  sampleRate: number,
  amplitude = 0.5,
): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < out.length; i++)
    out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / sampleRate);
  return fadeEnds(out, sampleRate);
}

/** A logarithmic (exponential) sine sweep from `f0` to `f1` Hz over `seconds`. */
export function logSweep(
  f0: number,
  f1: number,
  seconds: number,
  sampleRate: number,
  amplitude = 0.5,
): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  const k = Math.log(f1 / f0);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    const phase = ((2 * Math.PI * f0 * seconds) / k) * (Math.exp((t / seconds) * k) - 1);
    out[i] = amplitude * Math.sin(phase);
  }
  return fadeEnds(out, sampleRate);
}

/** The header fields and samples of a 16 bit PCM WAV written by `encodeWav`. */
export function decodeWav(buf: Buffer): {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  samples: Float32Array;
} {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a WAV file.');
  }
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  const dataBytes = buf.readUInt32LE(40);
  const samples = new Float32Array(dataBytes / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = buf.readInt16LE(44 + i * 2) / 0x8000;
  return { sampleRate, channels, bitsPerSample, samples };
}
