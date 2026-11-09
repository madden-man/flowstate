// Sound, only here (DESIGN.md rule 21): a few bells synthesised with Web Audio, no files.
// Never uninvited: every call comes from the user's own tap, and the Settings switch silences all of it.
// Web Audio already follows the ring/silent switch on iPhone. The one exception is a sit's scape (below): it is media,
// begun by the tap on the circle, and with "Sit sounds with the ringer off" on it plays with the switch off.
import { settings } from '../settings';
import type { SitSound } from '../../db/schema';

export type BellName = 'unlock' | 'settle' | 'keep' | 'leanLow' | 'leanHigh' | 'album' | 'breathIn' | 'breathOut' | 'sitEnd';

let ac: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ac) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC(); } catch { return null; }
  }
  // 'suspended' before the first tap, and on the iPhone 'interrupted' after a call or a lock: both wake the same way
  if (ac.state !== 'running') void ac.resume().catch(() => undefined);
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

/** The breath tone (F2, PLAN-FLOWS.md 3.7 "Breathe with eyes shut"): a soft sine that rises through the in-breath and
 *  falls through the out-breath, so the phone can go face down and the breath still has a pacer. Quiet, no attack. */
function breathTone(a: AudioContext, from: number, to: number, seconds: number) {
  const t = a.currentTime;
  const o = a.createOscillator();
  const v = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + seconds);
  o.connect(v);
  v.connect(a.destination);
  v.gain.setValueAtTime(0, t);
  v.gain.linearRampToValueAtTime(0.05, t + 0.6);
  v.gain.setValueAtTime(0.05, t + seconds - 0.8);
  v.gain.linearRampToValueAtTime(0, t + seconds - 0.05);
  o.start(t);
  o.stop(t + seconds);
}

const BELLS: Record<BellName, (a: AudioContext) => void> = {
  unlock: a => strike(a, 880, 1.8, 0.16),
  settle: settleTone,
  keep: a => strike(a, 988, 0.9, 0.07),
  leanLow: a => strike(a, 440, 0.5, 0.05),
  leanHigh: a => strike(a, 587, 0.5, 0.05),
  album: a => strike(a, 660, 0.6, 0.06),
  breathIn: a => breathTone(a, 196, 294, 4),
  breathOut: a => breathTone(a, 294, 196, 6),
  // the one bell that closes a sit with an end (PLAN-MEDITATE.md 3.1, S2): the unlock bell's shape, lower and longer
  sitEnd: a => strike(a, 528, 4, 0.16),
};

/** The breath tone has its own switch under Sounds, off by default, and follows it (rule 21). */
const BREATH: BellName[] = ['breathIn', 'breathOut'];

export function bell(name: BellName): void {
  if (!settings.value.sounds) return;
  if (BREATH.includes(name) && !settings.value.breathTone) return;
  const a = ctx();
  if (a) BELLS[name](a);
}

// ---- the scapes (PLAN-MEDITATE.md 3.1, S1): rain, the ocean, a forest and a bowl, for a sit on the Meditate page ----
//
// Each is built from looped noise buffers (white, pink, brown; six seconds, the tail folded into the head so the loop
// has no seam), sine oscillators, and gains moved by slow curves. Every node hangs off one bus, so ending is one fade
// and one disconnect. design/meditate/meditate.js is the audition engine these were ported from; the graphs and levels
// are the same. A scape is begun only by the tap on the circle (rule 21), fades in over an in-breath and out over the
// seconds it is given. It does not follow the Sounds switch: the Quiet chip is its switch (a sit is media, PLAN section 2).

export type ScapeName = 'rain' | 'ocean' | 'forest' | 'bowl';
export type { SitSound };
export const SIT_SOUNDS: readonly SitSound[] = ['rain', 'ocean', 'forest', 'bowl', 'quiet'];

/** The breath of rule 18, in seconds: four in, six out. The ocean's waves and the bowl are struck on it. */
export const IN_S = 4, OUT_S = 6, BREATH_S = IN_S + OUT_S;

/** A sit's sound. t0 is when its first breath begins, on now()'s clock; the circle breathes on that clock. */
export type Scape = { t0: number; now: () => number; end: (seconds: number) => void };

type Noise = 'white' | 'pink' | 'brown';
const noises = new WeakMap<BaseAudioContext, Partial<Record<Noise, AudioBuffer>>>();

/** Six seconds of noise, made once per context, the last quarter second folded into the first so the loop has no click. */
export function noiseBuffer(a: BaseAudioContext, kind: Noise): AudioBuffer {
  const made = noises.get(a) ?? {};
  noises.set(a, made);
  const have = made[kind];
  if (have) return have;
  const sr = a.sampleRate, n = sr * 6, fold = Math.floor(sr * 0.25), buf = a.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const g = new Float32Array(n + fold);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n + fold; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') g[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        g[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; g[i] = last * 3.5; }
    }
    const d = buf.getChannelData(ch);
    for (let j = 0; j < n; j++) {
      if (j < fold) { const x = j / fold; d[j] = g[j] * x + g[n + j] * (1 - x); } else d[j] = g[j];
    }
  }
  made[kind] = buf;
  return buf;
}

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
function curve(n: number, fn: (x: number) => number): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = fn(i / (n - 1));
  return c;
}

/** One sit's graph on a context: the bus, what it started, and the look-ahead timers. */
export class Sit {
  readonly t0: number;
  readonly bus: GainNode;
  private loops: ReturnType<typeof setInterval>[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  constructor(readonly a: BaseAudioContext, dest: AudioNode) {
    this.t0 = a.currentTime + 0.08;
    this.bus = a.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(dest);
  }
  noise(kind: Noise, to: AudioNode): AudioBufferSourceNode {
    const s = this.a.createBufferSource();
    s.buffer = noiseBuffer(this.a, kind);
    s.loop = true;
    s.connect(to);
    s.start(this.t0, Math.random() * 5);
    this.sources.push(s);
    return s;
  }
  filter(type: BiquadFilterType, freq: number, q: number, to: AudioNode): BiquadFilterNode {
    const f = this.a.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    if (q) f.Q.value = q;
    f.connect(to);
    return f;
  }
  gain(v: number, to: AudioNode): GainNode {
    const g = this.a.createGain();
    g.gain.value = v;
    g.connect(to);
    return g;
  }
  pan(v: number, to: AudioNode): AudioNode {
    if (!this.a.createStereoPanner) return to;
    const p = this.a.createStereoPanner();
    p.pan.value = v;
    p.connect(to);
    return p;
  }
  /** A slow sine that leans a gain up and down (a breeze, a shower thickening). */
  lean(param: AudioParam, hz: number, depth: number): void {
    const o = this.a.createOscillator(), g = this.a.createGain();
    o.frequency.value = hz; g.gain.value = depth;
    o.connect(g); g.connect(param); o.start(this.t0);
    this.sources.push(o);
  }
  /** Calls fn(time) for t0, t0 + period, ... kept a little ahead of the clock; on an offline context, the whole render. */
  every(period: number, fn: (t: number) => void): void {
    const a = this.a;
    let next = this.t0;
    const fill = (until: number) => { while (next < until) { fn(next); next += period; } };
    if (typeof (a as OfflineAudioContext).startRendering === 'function') { fill((a as OfflineAudioContext).length / a.sampleRate); return; }
    const lead = Math.max(2, period * 0.25);
    fill(a.currentTime + lead);
    this.loops.push(setInterval(() => fill(a.currentTime + lead), 400));
  }
  fadeIn(seconds: number, level: number): void {
    const g = this.bus.gain;
    g.setValueAtTime(0, this.t0);
    g.linearRampToValueAtTime(level, this.t0 + seconds);
  }
  /** The look-ahead stops at once; the bus falls to nothing over `seconds`, then everything is stopped and let go. */
  end(seconds: number, then?: () => void): void {
    const t = this.a.currentTime, g = this.bus.gain;
    this.loops.forEach(clearInterval);
    this.loops = [];
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(0, t, Math.max(seconds, 0.01) / 4);
    setTimeout(() => {
      for (const s of this.sources) { try { s.stop(); } catch { /* already stopped */ } }
      try { this.bus.disconnect(); } catch { /* gone */ }
      then?.();
    }, seconds * 1000 + 200);
  }
  /** How many look-ahead timers are running (for the tests). */
  get timers(): number { return this.loops.length; }
}

/** One sounding note: a sine with a little second harmonic, a soft envelope, a glide if `to` differs. */
function note(s: Sit, out: AudioNode, t: number, from: number, to: number, seconds: number, level: number) {
  const a = s.a, v = a.createGain();
  v.connect(out);
  v.gain.setValueAtTime(0, t);
  v.gain.linearRampToValueAtTime(level, t + Math.min(0.03, seconds * 0.3));
  v.gain.setValueAtTime(level, t + seconds * 0.6);
  v.gain.linearRampToValueAtTime(0, t + seconds);
  for (const [h, lv] of [[1, 1], [2, 0.12]]) {
    const o = a.createOscillator(), hv = a.createGain();
    hv.gain.value = lv; o.type = 'sine';
    o.frequency.setValueAtTime(from * h, t);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to * h, t + seconds);
    o.connect(hv); hv.connect(v); o.start(t); o.stop(t + seconds + 0.02);
  }
}

/** A struck bowl: three partials, each a pair of sines 0.7 Hz apart so it shimmers as it rings down. */
function bowlStrike(s: Sit, out: AudioNode, t: number, freq: number, level: number) {
  const a = s.a;
  for (const [ratio, lv, ring] of [[1, 1, 20], [2.71, 0.4, 14], [4.95, 0.14, 8]]) {
    const v = a.createGain();
    v.connect(out);
    v.gain.setValueAtTime(0, t);
    v.gain.linearRampToValueAtTime(level * lv, t + 0.04);
    v.gain.exponentialRampToValueAtTime(level * lv * 0.02, t + ring - 0.5);
    v.gain.linearRampToValueAtTime(0, t + ring);
    for (const d of [-0.35, 0.35]) {
      const o = a.createOscillator();
      o.type = 'sine'; o.frequency.value = freq * ratio + d;
      o.connect(v); o.start(t); o.stop(t + ring + 0.1);
    }
  }
}

/** The ocean's wave curves, one breath long: points a curve has, and where its peak falls (the end of the in-breath). */
export const WAVE_POINTS = 256;
const PEAK = IN_S / BREATH_S;

const SCAPES: Record<ScapeName, (s: Sit) => void> = {
  // Rain: a steady bed, the low body of it on a roof, the patter thickening and thinning, and single drops close by.
  rain(s) {
    const bed = s.gain(0.5, s.bus);
    s.noise('pink', s.filter('highpass', 500, 0, s.filter('lowpass', 7000, 0, bed)));
    s.noise('brown', s.filter('lowpass', 400, 0, s.gain(0.3, s.bus)));
    const patter = s.gain(0.11, s.bus);
    s.noise('white', s.filter('bandpass', 3200, 0.6, patter));
    s.lean(patter.gain, 0.07, 0.04); s.lean(bed.gain, 0.045, 0.1);
    const white = noiseBuffer(s.a, 'white');
    s.every(1, t => {
      for (let k = 0, n = 9 + Math.floor(Math.random() * 8); k < n; k++) {
        const at = t + Math.random(), len = rnd(0.012, 0.05), v = s.a.createGain(), src = s.a.createBufferSource();
        src.buffer = white;
        v.gain.setValueAtTime(0, at); v.gain.linearRampToValueAtTime(rnd(0.05, 0.22), at + 0.002);
        v.gain.exponentialRampToValueAtTime(0.0003, at + len);
        const f = s.filter('bandpass', rnd(1400, 6000), 2.5, v);
        v.connect(s.pan(rnd(-0.9, 0.9), s.bus));
        src.connect(f); src.start(at, Math.random() * 5, len + 0.02);
      }
    });
    s.fadeIn(IN_S, 0.85);
  },
  // Ocean: one wave a breath. It gathers for four seconds, breaks, and draws back down the sand for six, on the same
  // clock as the circle. Under it the sea far out, which never stops.
  ocean(s) {
    s.noise('brown', s.filter('lowpass', 140, 0, s.gain(0.5, s.bus)));
    const surfGain = s.gain(0.14, s.bus), surfTone = s.filter('lowpass', 260, 0, surfGain);
    s.noise('brown', surfTone);
    const foamGain = s.gain(0.01, s.bus);
    s.noise('pink', s.filter('highpass', 2200, 0, foamGain));
    s.every(BREATH_S, t => {
      const size = rnd(0.8, 1.1);
      surfGain.gain.setValueCurveAtTime(curve(WAVE_POINTS, x =>
        x < PEAK ? 0.14 + 0.86 * size * Math.pow(x / PEAK, 2.2) : 0.14 + 0.86 * size * Math.pow(1 - (x - PEAK) / (1 - PEAK), 1.8)), t, BREATH_S - 0.02);
      surfTone.frequency.setValueCurveAtTime(curve(WAVE_POINTS, x =>
        x < PEAK ? 260 + 1700 * size * Math.pow(x / PEAK, 2) : 260 + 1700 * size * Math.pow(1 - (x - PEAK) / (1 - PEAK), 1.4)), t, BREATH_S - 0.02);
      foamGain.gain.setValueCurveAtTime(curve(WAVE_POINTS, x => {
        const from = PEAK - 0.08;
        if (x < from) return 0.01;
        const y = (x - from) / (1 - from);
        return 0.01 + 0.3 * size * Math.min(1, y * 7) * Math.pow(1 - y, 2.4);
      }), t, BREATH_S - 0.02);
    });
    s.fadeIn(IN_S, 0.7);
  },
  // Forest: moving air, leaves, and a few birds a long way off in a little room of trees. The calls are plain tones
  // (a two-note whistle, a warble, a trill, a dove, a far "tseep"), each from its own place, never on a beat.
  forest(s) {
    const air = s.gain(0.5, s.bus);
    s.noise('pink', s.filter('bandpass', 600, 0.4, air)); s.lean(air.gain, 0.05, 0.2);
    const leaves = s.gain(0.06, s.bus);
    s.noise('white', s.filter('highpass', 4200, 0, leaves)); s.lean(leaves.gain, 0.08, 0.03);
    // the trees: a short burst of fading noise used as a room
    const a = s.a, len = Math.floor(a.sampleRate * 1.8), ir = a.createBuffer(2, len, a.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const room = a.createConvolver();
    room.buffer = ir;
    room.connect(s.gain(1.1, s.bus));
    const place = () => {
      const far = Math.random(), p = s.pan(rnd(-0.8, 0.8), s.gain(2.2, s.bus)), g = a.createGain();
      g.gain.value = 1 - far * 0.65; g.connect(p); g.connect(room);
      return g;
    };
    const CALLS: ((t: number, to: AudioNode) => number)[] = [
      (t, to) => { note(s, to, t, 3900, 3900, 0.38, 0.05); note(s, to, t + 0.5, 3300, 3300, 0.44, 0.05); return 1; },
      (t, to) => {
        for (let k = 0, n = 5 + Math.floor(Math.random() * 4), at = t; k < n; k++) {
          const f = rnd(2600, 4400), l = rnd(0.07, 0.12);
          note(s, to, at, f, f * rnd(0.86, 1.16), l, 0.04); at += l + rnd(0.02, 0.07);
        }
        return 1.2;
      },
      (t, to) => {
        const f = rnd(4200, 5200);
        for (let k = 0, n = 10 + Math.floor(Math.random() * 7); k < n; k++) note(s, to, t + k * 0.055, k % 2 ? f * 1.12 : f, k % 2 ? f * 1.12 : f, 0.04, 0.028);
        return 1;
      },
      (t, to) => { note(s, to, t, 440, 560, 0.3, 0.07); for (const d of [0.5, 1.0, 1.5]) note(s, to, t + d, 480, 465, 0.32, 0.06); return 2.2; },
      (t, to) => { note(s, to, t, 6400, 5700, 0.07, 0.022); return 0.3; },
    ];
    let busyUntil = 0;
    s.every(1, t => {
      if (t < busyUntil || Math.random() > 0.42) return;
      const k = Math.random(), call = CALLS[k < 0.3 ? 0 : k < 0.6 ? 1 : k < 0.75 ? 2 : k < 0.87 ? 3 : 4];
      const at = t + Math.random();
      busyUntil = at + call(at, place()) + rnd(0.3, 2.5);
    });
    s.fadeIn(IN_S, 0.9);
  },
  // Bowl: one bowl on G struck as an in-breath begins, every other breath, and a second a fifth above (D) between them.
  // Its bus opens in a third of a second, not over the in-breath, so the first strike is heard as struck.
  bowl(s) {
    s.every(BREATH_S * 2, t => {
      bowlStrike(s, s.bus, t + 0.05, 196, 0.15);
      bowlStrike(s, s.bus, t + BREATH_S + 0.05, 293.66, 0.09);
    });
    s.fadeIn(0.3, 0.9);
  },
};

/** Builds a scape's graph on any context (a real one, an offline one, or a test's fake). Quiet builds nothing. */
export function buildScape(a: BaseAudioContext, name: SitSound, dest: AudioNode = a.destination): Sit | null {
  if (name === 'quiet') return null;
  const s = new Sit(a, dest);
  SCAPES[name](s);
  return s;
}

/** navigator.audioSession (Safari 16.4+): 'playback' makes the page's sound media, which the ringer switch does not mute. */
type AudioSessionNav = Navigator & { audioSession?: { type: string } };
function sessionType(type: 'playback' | 'auto'): void {
  try {
    const session = typeof navigator === 'undefined' ? undefined : (navigator as AudioSessionNav).audioSession;
    if (session) session.type = type;
  } catch { /* not on this phone */ }
}

const wallClock = () => performance.now() / 1000;
let playing: Sit | null = null;
/** The sit holding the 'playback' session, if one does: only it sets the session back when it has faded. */
let holding: Sit | null = null;
/** Once a sit has faded: the session goes back to 'auto', unless a newer sit holds it. */
const release = (s: Sit) => () => { if (holding === s) { holding = null; sessionType('auto'); } };

/**
 * Begins a sit's sound (only from the tap on the circle). Quiet makes no nodes and no AudioContext: the circle breathes
 * on the wall clock. Null where there is no Web Audio. A scape already playing is ended first. With
 * settings.sitThroughSilent on, the audio session is 'playback' for the sit and goes back to 'auto' once it has faded.
 */
export function scape(name: SitSound): Scape | null {
  playing?.end(OUT_S, release(playing));
  playing = null;
  if (name === 'quiet') { const t0 = wallClock(); return { t0, now: wallClock, end: () => undefined }; }
  // the session is named before the context is made or woken, so the first sound of a sit is already media
  const media = settings.value.sitThroughSilent ?? true;
  if (media) sessionType('playback');
  const a = ctx();
  if (!a) { if (media && !holding) sessionType('auto'); return null; }
  const s = buildScape(a, name)!;
  playing = s;
  if (media) holding = s;
  let ended = false;
  return {
    t0: s.t0,
    now: () => a.currentTime,
    end: seconds => {
      if (ended) return;
      ended = true;
      if (playing === s) playing = null;
      s.end(seconds, release(s));
    },
  };
}

