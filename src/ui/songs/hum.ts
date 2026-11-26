// Hold to hum (PLAN-WORLDS.md section 6, W6): one act under the thumb. The hold itself asks for the microphone (the
// iPhone asks only from a gesture), records with MediaRecorder, and reads the pitch every FRAME_S from parts/Sound's
// listen() so the line is drawn as it is sung (rule 27). Lifting stops it; so does a cancelled hold (pointercancel, the
// capture lost, the page hidden) and the three-minute cap. A hold lifted before the microphone opened makes no take.
//
// The audio is kept as the recorder made it: AAC in MP4 where the browser records it (Safari on the iPhone; Chromium 126
// and later), else WebM with Opus. Its type, parameters dropped, travels with the take (audioType) and is the clip's
// content type: audio/mp4 or audio/webm.
import { listen, micSession, type Listening } from '../parts/Sound';
import { FRAME_S, TAKE_MAX_S, frameLength, frameOf, keyOfLine, yin } from '../../model/pitch';

/** The recorder's types, in the order asked for: AAC in MP4 first, named so (what Music Companion files as .m4a; Chromium
 *  records MP4 too since about version 126 and may choose Opus for it unless AAC is named), then any MP4, then WebM. */
export const TYPES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

export function chooseType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return TYPES.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } });
}

/** What a finished hum hands back. */
export type Hummed = { audio: ArrayBuffer; audioType: string; seconds: number; pitch: number[]; key?: string };

/** One hum under way. */
export type Humming = {
  /** Ends the take; resolves with it, or null when there was nothing (no microphone, nothing recorded). */
  stop: () => Promise<Hummed | null>;
};

type Opts = { onFrame: (pitch: readonly number[]) => void; onCap?: () => void };

/** Asks for the microphone and starts a take. Rejects when the microphone is refused or missing. */
export async function startHum({ onFrame, onCap }: Opts): Promise<Humming> {
  // the iPhone records under 'play-and-record', named before the microphone is asked for; given back however it ends
  const release = micSession();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) { release(); throw e; }
  const type = chooseType();
  let rec: MediaRecorder;
  try { rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined); }
  catch (e) { stream.getTracks().forEach(t => t.stop()); release(); throw e; }
  const chunks: Blob[] = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const ear: Listening | null = listen(stream);
  const pitch: number[] = [];
  const t0 = performance.now();
  let timer: ReturnType<typeof setInterval> | undefined;
  let capTimer: ReturnType<typeof setTimeout> | undefined;
  if (ear) {
    const need = frameLength(ear.rate);
    timer = setInterval(() => {
      const x = ear.read();
      pitch.push(frameOf(x.length >= need ? yin(x, x.length - need, ear.rate) : null));
      onFrame(pitch);
    }, FRAME_S * 1000);
  }
  rec.start(1000);
  let stopping: Promise<Hummed | null> | null = null;
  const stop = () => {
    if (stopping) return stopping;
    stopping = new Promise<Hummed | null>(resolve => {
      clearInterval(timer);
      clearTimeout(capTimer);
      const seconds = Math.min(TAKE_MAX_S, (performance.now() - t0) / 1000);
      const done = async () => {
        stream.getTracks().forEach(t => t.stop());
        ear?.close();
        release();
        const blob = new Blob(chunks, { type: rec.mimeType || type || 'audio/mp4' });
        if (!blob.size) return resolve(null);
        const audio = await blob.arrayBuffer();
        const audioType = (rec.mimeType || type || 'audio/mp4').split(';')[0].trim();
        resolve({ audio, audioType, seconds: Math.round(seconds * 10) / 10, pitch: [...pitch], key: keyOfLine(pitch) });
      };
      if (rec.state === 'inactive') { void done(); return; }
      rec.onstop = () => void done();
      try { rec.stop(); } catch { void done(); }
    });
    return stopping;
  };
  capTimer = setTimeout(() => { onCap?.(); void stop(); }, TAKE_MAX_S * 1000);
  return { stop };
}
