// W0 spike (PLAN-WORLDS.md section 10 row W0, section 13): one screen, five probes, results as text, one copy button.
// Reached at #/spike only (main.tsx renders it instead of the app, before the lock and the database). Never merges.
import { useEffect, useRef, useState } from 'preact/hooks';
import { pitchTrack, summarise, midiOf, noteName, type Track } from './pitch';
import { checkArrived, send, sendOnHide, KEEPALIVE_LIMIT, type Trip } from './net';
import { load, update, type Kept } from './store';
import './spike.css';

const MIMES = [
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4;codecs=opus',
  'audio/aac',
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/wav',
];
const MB = 1024 * 1024;
// Netlify, "Configuration for functions", Default deployment options: buffered request payload 6 MB; a binary body is
// base64 encoded, so binary is effectively 4.5 MB (https://docs.netlify.com/build/functions/configuration/).
const LIMIT = 6 * MB;
const THREE_MIN = 180;
const PITCH_RATE = 16000;

const supported = () => (typeof MediaRecorder === 'undefined' ? [] : MIMES.filter(m => MediaRecorder.isTypeSupported(m)));
const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function micState(): Promise<string> {
  try {
    const p = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return p.state;
  } catch (e) {
    return `no query (${String(e).slice(0, 60)})`;
  }
}

type Orientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/** Listen for a moment without asking: on iOS, events only come if the permission is already held. */
function motionWithoutAsking(ms = 1500): Promise<string> {
  return new Promise(res => {
    if (typeof DeviceOrientationEvent === 'undefined') return res('no DeviceOrientationEvent');
    const on = (e: DeviceOrientationEvent) => {
      if (e.beta === null && e.gamma === null) return;
      removeEventListener('deviceorientation', on);
      res('yes, events came without asking');
    };
    addEventListener('deviceorientation', on);
    setTimeout(() => { removeEventListener('deviceorientation', on); res('no events without asking'); }, ms);
  });
}

/** Decode at 16 kHz, mono. A context that refuses 16 kHz decodes at 48 kHz and is averaged down. */
async function decode(buf: ArrayBuffer): Promise<{ x: Float32Array; rate: number; note: string }> {
  try {
    const ctx = new OfflineAudioContext(1, 1, PITCH_RATE);
    const a = await ctx.decodeAudioData(buf.slice(0));
    return { x: a.getChannelData(0), rate: a.sampleRate, note: `decoded at ${a.sampleRate} Hz, ${a.duration.toFixed(2)} s` };
  } catch (first) {
    const ctx = new OfflineAudioContext(1, 1, 48000);
    const a = await ctx.decodeAudioData(buf.slice(0));
    const f = Math.max(1, Math.round(a.sampleRate / PITCH_RATE));
    const src = a.getChannelData(0), x = new Float32Array(Math.floor(src.length / f));
    for (let i = 0; i < x.length; i++) { let s = 0; for (let j = 0; j < f; j++) s += src[i * f + j]; x[i] = s / f; }
    return { x, rate: a.sampleRate / f, note: `16 kHz refused (${String(first).slice(0, 60)}); decoded at ${a.sampleRate} Hz, averaged by ${f}` };
  }
}

interface Take {
  mime: string;
  asked: string;
  seconds: number;
  bytes: number;
  getUserMediaMs: number;
  track: string;
  blob: Blob;
  liftedEarly: boolean;
}

const fmt = (b: number) => (b >= MB ? `${(b / MB).toFixed(2)} MB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);

export function Spike() {
  const [kept, setKept] = useState<Kept>(load);
  const refresh = () => setKept(load());
  const [env, setEnv] = useState({ standalone: standalone(), ua: navigator.userAgent, micOnOpen: '...', motionOnOpen: '...' });
  const [micAfter, setMicAfter] = useState('');
  const [mimePick, setMimePick] = useState('auto');
  const [take, setTake] = useState<Take | null>(null);
  const [humming, setHumming] = useState(false);
  const [humNote, setHumNote] = useState('');
  const [pitch, setPitch] = useState<{ track: Track; note: string; ms: number; voicedPct: number; low: string | null; high: string | null } | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [arrivedStore, setArrivedStore] = useState('');
  const [motion, setMotion] = useState({ asked: '', beta: null as number | null, gamma: null as number | null });
  const [copied, setCopied] = useState('');
  const rec = useRef<{ r?: MediaRecorder; stream?: MediaStream; down: boolean; t0: number; chunks: Blob[]; gum: number; early: boolean; asked: string }>({ down: false, t0: 0, chunks: [], gum: 0, early: false, asked: '' });

  // on open: the mic permission, whether tilt is already allowed, the open logged; keepalive sends wired
  useEffect(() => {
    void (async () => {
      const [mic, motionNow] = await Promise.all([micState(), motionWithoutAsking()]);
      setEnv(e => ({ ...e, micOnOpen: mic, motionOnOpen: motionNow }));
      update(k => k.opens.push({ at: new Date().toISOString(), mic, motion: motionNow, standalone: standalone() }));
      setArrivedStore(await checkArrived());
      refresh();
    })();
    const vis = () => {
      if (document.visibilityState === 'hidden') sendOnHide('visibilitychange');
      else void checkArrived().then(s => { setArrivedStore(s); refresh(); });
    };
    const hide = () => sendOnHide('pagehide');
    document.addEventListener('visibilitychange', vis);
    addEventListener('pagehide', hide);
    return () => { document.removeEventListener('visibilitychange', vis); removeEventListener('pagehide', hide); };
  }, []);

  // 1. Hum: hold to record, lift to stop
  const down = async (e: PointerEvent) => {
    e.preventDefault();
    const s = rec.current;
    if (s.down) return;
    s.down = true; s.early = false; s.chunks = [];
    setHumming(true);
    setHumNote('opening the mic');
    const t = performance.now();
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (err) {
      s.down = false; setHumming(false); setHumNote(`getUserMedia failed: ${String(err)}`);
      return;
    }
    s.gum = Math.round(performance.now() - t);
    s.asked = mimePick;
    const r = new MediaRecorder(s.stream, mimePick === 'auto' ? undefined : { mimeType: mimePick });
    s.r = r;
    r.ondataavailable = ev => { if (ev.data.size) s.chunks.push(ev.data); };
    r.onstart = () => { s.t0 = performance.now(); setHumNote('recording: lift to stop'); };
    r.onstop = () => {
      const seconds = (performance.now() - s.t0) / 1000;
      const blob = new Blob(s.chunks, { type: r.mimeType });
      const set = s.stream?.getAudioTracks()[0]?.getSettings();
      s.stream?.getTracks().forEach(tr => tr.stop());
      const tk: Take = {
        mime: r.mimeType || '(empty)', asked: s.asked, seconds, bytes: blob.size, getUserMediaMs: s.gum, blob, liftedEarly: s.early,
        track: set ? `${set.sampleRate ?? '?'} Hz, ${set.channelCount ?? '?'} ch` : '?',
      };
      setTake(tk);
      setHumNote('');
      void micState().then(setMicAfter);
      void analyse(tk);
    };
    r.start();
    // the thumb lifted while the mic was opening (a permission prompt, say): record a second so there is a take
    if (!s.down) { s.early = true; setTimeout(() => r.state === 'recording' && r.stop(), 1000); }
  };
  const up = () => {
    const s = rec.current;
    if (!s.down) return;
    s.down = false;
    setHumming(false);
    if (s.r && s.r.state === 'recording') s.r.stop();
  };

  // 2. Pitch line
  const analyse = async (tk: Take) => {
    setPitch(null);
    try {
      const t0 = performance.now();
      const { x, rate, note } = await decode(await tk.blob.arrayBuffer());
      const track = pitchTrack(x, rate, 0.02);
      const s = summarise(track);
      setPitch({ track, note, ms: Math.round(performance.now() - t0), ...s });
    } catch (err) {
      setPitch({ track: { hop: 0.02, hz: [] }, note: `decode failed: ${String(err)}`, ms: 0, voicedPct: 0, low: null, high: null });
    }
  };

  // 3. Round trip
  const trip = async (label: string, body: BodyInit, bytes: number, type: string) => {
    const t = await send(label, body, bytes, type, load().token);
    setTrips(ts => [...ts, t]);
  };
  const random = (n: number) => { const b = new Uint8Array(n); for (let i = 0; i < n; i += 65536) crypto.getRandomValues(b.subarray(i, Math.min(n, i + 65536))); return b; };

  // 5. Tilt
  useEffect(() => {
    if (!motion.asked) return;
    let raf = 0, last: DeviceOrientationEvent | null = null;
    const on = (e: DeviceOrientationEvent) => {
      last = e;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; setMotion(m => ({ ...m, beta: last!.beta, gamma: last!.gamma })); });
    };
    addEventListener('deviceorientation', on);
    return () => removeEventListener('deviceorientation', on);
  }, [motion.asked]);
  const allowMotion = async () => {
    const D = (typeof DeviceOrientationEvent === 'undefined' ? undefined : DeviceOrientationEvent) as Orientation | undefined;
    if (!D) return setMotion(m => ({ ...m, asked: 'no DeviceOrientationEvent' }));
    if (typeof D.requestPermission !== 'function') return setMotion(m => ({ ...m, asked: 'no requestPermission (not iOS): listening' }));
    try {
      const r = await D.requestPermission();
      if (r === 'granted') update(k => { k.motionGrantedAt = new Date().toISOString(); });
      refresh();
      setMotion(m => ({ ...m, asked: `requestPermission: ${r}` }));
    } catch (err) {
      setMotion(m => ({ ...m, asked: `requestPermission threw: ${String(err)}` }));
    }
  };

  const bps = take && take.seconds > 0 ? take.bytes / take.seconds : 0;
  const three = bps * THREE_MIN;
  const three64 = Math.ceil(three / 3) * 4;
  const lines: string[] = [];
  const L = (s: string) => lines.push(s);
  L('FlowState W0 spike findings');
  L(`at ${new Date().toISOString()}`);
  L(`standalone (Home Screen app): ${env.standalone ? 'yes' : 'no'}`);
  L(`service worker controls this page: ${typeof navigator.serviceWorker !== 'undefined' && navigator.serviceWorker.controller ? 'yes' : 'no'}`);
  L(`ua: ${env.ua}`);
  L('');
  L('1. Hum');
  L(`supported: ${supported().join(', ') || 'none'}`);
  L(`mic permission on open: ${env.micOnOpen}; after take: ${micAfter || '(no take yet)'}`);
  L(`earlier opens: ${kept.opens.slice(-6).map(o => `${o.at.slice(5, 16)} mic=${o.mic} tilt=${o.motion.startsWith('yes') ? 'yes' : 'no'}${o.standalone ? '' : ' (browser)'}`).join(' | ') || 'none'}`);
  if (take) {
    L(`asked: ${take.asked}; chosen: ${take.mime}; track: ${take.track}`);
    L(`getUserMedia took ${take.getUserMediaMs} ms${take.getUserMediaMs > 700 ? ' (slow: a prompt was probably shown)' : ''}${take.liftedEarly ? '; lifted before the mic opened' : ''}`);
    L(`seconds ${take.seconds.toFixed(2)}, bytes ${take.bytes}, bytes/s ${Math.round(bps)}`);
    L(`3 min projected: ${fmt(three)} raw, ${fmt(three64)} as base64; limit 6 MB buffered, so ${three64 <= LIMIT ? 'FITS' : 'DOES NOT FIT'} as one binary body`);
  } else L('no take yet');
  L('');
  L('2. Pitch line');
  if (pitch) {
    L(pitch.note);
    L(`frames ${pitch.track.hz.length}, voiced ${(pitch.voicedPct * 100).toFixed(0)}%, range ${pitch.low ?? '-'} to ${pitch.high ?? '-'}, decode+detect ${pitch.ms} ms`);
  } else L('no pitch yet');
  L('');
  L('3. Round trip');
  trips.forEach(t => L(`${t.label}: status ${t.status}, ${t.ms} ms, sent ${fmt(t.sentBytes)}, function received ${t.receivedBytes ?? '-'}${t.note ? `, ${t.note}` : ''}`));
  if (!trips.length) L('no trip yet');
  L('');
  L(`4. Keepalive on hide (body budget ${KEEPALIVE_LIMIT} B; store: ${arrivedStore || 'not asked yet'})`);
  kept.hides.slice(-10).forEach(h => L(`${h.at.slice(5, 19)} ${h.event} ${h.kind} ${h.bytes} B: sent; page saw ${h.seen ?? 'nothing'}; arrived ${h.arrived === undefined ? 'not asked' : h.arrived ?? 'NO'}`));
  if (!kept.hides.length) L(kept.token ? 'no hide yet: leave the app and come back' : 'paste the token first');
  L('');
  L('5. Tilt');
  L(`on open, without asking: ${env.motionOnOpen}; granted before at: ${kept.motionGrantedAt ?? 'never'}`);
  L(`${motion.asked || 'not asked this open'}; beta ${motion.beta?.toFixed(1) ?? '-'}, gamma ${motion.gamma?.toFixed(1) ?? '-'}`);
  const text = lines.join('\n');

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied('Copied.'); } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove();
      setCopied(ok ? 'Copied.' : `Copy failed: ${String(e)}`);
    }
  };

  return (
    <main class="spike">
      <h1>W0 spike</h1>
      <p class="spike-quiet">Throwaway. Five probes for PLAN-WORLDS.md section 13. Results are plain text below each.</p>

      <section>
        <h2>1. Hum</h2>
        <label class="spike-row">Format{' '}
          <select value={mimePick} onChange={e => setMimePick((e.target as HTMLSelectElement).value)}>
            <option value="auto">auto (let the phone choose)</option>
            {supported().map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <button class="spike-hold" data-on={humming || undefined} onPointerDown={e => void down(e)} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} onContextMenu={e => e.preventDefault()}>
          {humming ? 'Humming: lift to stop' : 'Hold to hum'}
        </button>
        {humNote && <p class="spike-quiet">{humNote}</p>}
      </section>

      <section>
        <h2>2. Pitch line</h2>
        {pitch && <PitchLine track={pitch.track} />}
      </section>

      <section>
        <h2>3. Round trip</h2>
        <label class="spike-row">Token{' '}
          <input type="password" autoComplete="off" value={kept.token} onInput={e => { const v = (e.target as HTMLInputElement).value; update(k => { k.token = v; }); refresh(); }} />
        </label>
        <div class="spike-buttons">
          <button onClick={() => { const b = JSON.stringify({ hello: 'flowstate', at: Date.now() }); void trip('JSON', b, b.length, 'application/json'); }}>Send</button>
          <button disabled={!take} onClick={() => take && void trip(`hum (${take.mime})`, take.blob, take.bytes, take.mime || 'application/octet-stream')}>Send hum</button>
          <button onClick={() => void trip('4 MB binary', random(4 * MB), 4 * MB, 'application/octet-stream')}>Send 4 MB</button>
          <button onClick={() => void trip('5 MB binary', random(5 * MB), 5 * MB, 'application/octet-stream')}>Send 5 MB</button>
        </div>
      </section>

      <section>
        <h2>4. Keepalive on hide</h2>
        <p class="spike-quiet">With a token pasted, leave the app (Home, or switch) and come back. Hides alternate a small and a near-limit body.</p>
      </section>

      <section>
        <h2>5. Tilt</h2>
        <button onClick={() => void allowMotion()}>Allow motion</button>
      </section>

      <section>
        <h2>Findings</h2>
        <button onClick={() => void copy()}>Copy findings</button> <span class="spike-quiet">{copied}</span>
        <pre class="spike-findings" data-findings>{text}</pre>
      </section>
    </main>
  );
}

function PitchLine({ track }: { track: Track }) {
  const voiced = track.hz.map(h => (h === null ? null : midiOf(h)));
  const vs = voiced.filter((m): m is number => m !== null);
  if (!vs.length) return <p class="spike-quiet">No voiced frames.</p>;
  const lo = Math.floor(Math.min(...vs)) - 2, hi = Math.ceil(Math.max(...vs)) + 2;
  const W = Math.max(1, voiced.length - 1), H = 120;
  const y = (m: number) => H - ((m - lo) / (hi - lo)) * H;
  let d = '', pen = false;
  voiced.forEach((m, i) => {
    if (m === null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${i} ${y(m).toFixed(1)} `;
    pen = true;
  });
  const cs: number[] = [];
  for (let m = Math.ceil(lo / 12) * 12; m <= hi; m += 12) cs.push(m);
  return (
    <svg class="spike-pitch" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" data-pitch-line>
      {cs.map(m => <line key={m} x1={0} x2={W} y1={y(m)} y2={y(m)} class="spike-c" vector-effect="non-scaling-stroke"><title>{noteName(m)}</title></line>)}
      <path d={d} class="spike-line" vector-effect="non-scaling-stroke" />
    </svg>
  );
}
