// Copied from Music Companion (tests/helpers/wav.ts at 5f6e05c) with the key finder (PLAN-WORLDS.md section 6).
/**
 * A tiny WAV reader for the key finder tests (SPEC 8): 16 bit PCM, any
 * number of channels mixed to mono, chunks walked so extra chunks before
 * `data` are skipped. No Web Audio.
 */
export interface Wav {
  sampleRate: number;
  samples: Float32Array;
}

export function readWav(buf: Uint8Array): Wav {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const text = (at: number) => String.fromCharCode(...buf.subarray(at, at + 4));
  if (text(0) !== 'RIFF' || text(8) !== 'WAVE') throw new Error('Not a WAV file.');
  let channels = 1;
  let sampleRate = 0;
  let bits = 16;
  let at = 12;
  while (at + 8 <= buf.length) {
    const id = text(at);
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    if (id === 'fmt ') {
      if (view.getUint16(body, true) !== 1) throw new Error('Only PCM WAV files are read.');
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      if (bits !== 16) throw new Error('Only 16 bit WAV files are read.');
      const frames = Math.floor(Math.min(size, buf.length - body) / (2 * channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++)
          sum += view.getInt16(body + (i * channels + c) * 2, true);
        samples[i] = sum / channels / 0x8000;
      }
      return { sampleRate, samples };
    }
    at = body + size + (size % 2);
  }
  throw new Error('The WAV file has no data chunk.');
}
