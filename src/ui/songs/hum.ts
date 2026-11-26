// Hold to hum (PLAN-WORLDS.md section 6, W6): one act under the thumb. The hold itself asks for the microphone (the
// iPhone asks only from a gesture), records with MediaRecorder, and reads the pitch every FRAME_S from parts/Sound's
// listen() so the line is drawn as it is sung (rule 27). Lifting stops it; so does a cancelled hold (pointercancel, the
// capture lost, the page hidden) and the three-minute cap. A hold lifted before the microphone opened makes no take.
//
// The microphone and the recorder are parts/Sound's (record(), DESIGN.md rule 21, lint DL20): AAC in MP4 at 96 kbps where
// the browser records it (Safari on the iPhone; Chromium 126 and later), else WebM with Opus. Its type, parameters
// dropped, travels with the take (audioType) and is the clip's content type: audio/mp4 or audio/webm.
import { record } from '../parts/Sound';
import { FRAME_S, TAKE_MAX_S, frameLength, frameOf, keyOfLine, yin } from '../../model/pitch';

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
  const rec = await record();
  const ear = rec.ear;
  const pitch: number[] = [];
  const t0 = performance.now();
  let timer: ReturnType<typeof setInterval> | undefined;
  if (ear) {
    const need = frameLength(ear.rate);
    timer = setInterval(() => {
      const x = ear.read();
      pitch.push(frameOf(x.length >= need ? yin(x, x.length - need, ear.rate) : null));
      onFrame(pitch);
    }, FRAME_S * 1000);
  }
  let stopping: Promise<Hummed | null> | null = null;
  const stop = () => {
    if (stopping) return stopping;
    clearInterval(timer);
    clearTimeout(capTimer);
    const seconds = Math.min(TAKE_MAX_S, (performance.now() - t0) / 1000);
    stopping = rec.stop().then(r => (r ? { audio: r.audio, audioType: r.type, seconds: Math.round(seconds * 10) / 10, pitch: [...pitch], key: keyOfLine(pitch) } : null));
    return stopping;
  };
  const capTimer = setTimeout(() => { onCap?.(); void stop(); }, TAKE_MAX_S * 1000);
  return { stop };
}
