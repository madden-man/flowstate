// Sound, only here (DESIGN.md rule 21): a few bells synthesised with Web Audio, no files.
// Never uninvited: every call comes from the user's own tap, and the Settings switch silences all of it.
// Web Audio already follows the ring/silent switch on iPhone.
import { settings } from '../settings';

export type BellName = 'unlock' | 'settle' | 'keep' | 'leanLow' | 'leanHigh' | 'album';

let ac: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ac) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC(); } catch { return null; }
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

/** A struck bell: a sine with one inharmonic partial, a fast attack and a long exponential fall. */
function strike(a: AudioContext, freq: number, seconds: number, gain: number) {
  const t = a.currentTime;
  const out = a.createGain();
  out.connect(a.destination);
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(gain, t + 0.012);
  out.gain.exponentialRampToValueAtTime(0.0008, t + seconds);
  const partial = a.createGain();
  partial.gain.value = 0.18;
  partial.connect(out);
  for (const [f, dest] of [[freq, out], [freq * 2.76, partial]] as const) {
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(dest);
    o.start(t);
    o.stop(t + seconds);
  }
}

/** The long low tone on settling into Still: a falling sine, three seconds. */
function settleTone(a: AudioContext) {
  const t = a.currentTime;
  const o = a.createOscillator();
  const v = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(82, t + 3);
  o.connect(v);
  v.connect(a.destination);
  v.gain.setValueAtTime(0, t);
  v.gain.linearRampToValueAtTime(0.16, t + 0.4);
  v.gain.exponentialRampToValueAtTime(0.0008, t + 3.2);
  o.start(t);
  o.stop(t + 3.3);
}

const BELLS: Record<BellName, (a: AudioContext) => void> = {
  unlock: a => strike(a, 880, 1.8, 0.16),
  settle: settleTone,
  keep: a => strike(a, 988, 0.9, 0.07),
  leanLow: a => strike(a, 440, 0.5, 0.05),
  leanHigh: a => strike(a, 587, 0.5, 0.05),
  album: a => strike(a, 660, 0.6, 0.06),
};

export function bell(name: BellName): void {
  if (!settings.value.sounds) return;
  const a = ctx();
  if (a) BELLS[name](a);
}
