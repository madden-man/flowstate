// A take on the song page (PLAN-WORLDS.md section 6, W6): its pitch line, one stroke rising and falling with the pitch,
// left to right as a pen would (rule 27), drawn as it is sung while the thumb holds; then, in print beside it, the key
// guess (absent when the key finder is unsure) and its length. A tap on the line plays it, a second tap stops it. In
// Still (rule 13) the line alone: no key, no length.
import { useState } from 'preact/hooks';
import type { Take } from '../../db/schema';
import { play, stopPlaying } from '../parts/Sound';

const W = 300, H = 56, PAD = 4;
/** Frames the live line is laid out over before it starts to close up: ten seconds, so a short hum is drawn as wide as
 *  it was long and never stretched. */
const LIVE_FRAMES = 200;

/** The path of a pitch line, x by frame, y by pitch (the take's own range, at least seven semitones tall, so a hum on one
 *  note is a level line and not a scribble). A frame with no pitch lifts the pen. live: laid out over LIVE_FRAMES at
 *  least, growing rightward as frames come. */
export function pitchPath(pitch: readonly number[], live = false): string {
  const voiced = pitch.filter(m => m > 0);
  if (!voiced.length) return '';
  let lo = Math.min(...voiced), hi = Math.max(...voiced);
  if (hi - lo < 7) { const mid = (hi + lo) / 2; lo = mid - 3.5; hi = mid + 3.5; }
  const span = Math.max(live ? LIVE_FRAMES : 1, pitch.length - 1);
  const x = (i: number) => (PAD + ((W - 2 * PAD) * i) / span).toFixed(1);
  const y = (m: number) => (H - PAD - ((H - 2 * PAD) * (m - lo)) / (hi - lo)).toFixed(1);
  let d = '', pen = false;
  pitch.forEach((m, i) => {
    if (!(m > 0)) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(i)} ${y(m)} `;
    pen = true;
  });
  return d.trim();
}

const length = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export function PitchSvg({ pitch, live }: { pitch: readonly number[]; live?: boolean }) {
  return (
    <svg class="wd-pitch" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d={pitchPath(pitch, live)} />
    </svg>
  );
}

/** A take as it stands under its line (or loose at the foot of the song). */
/** Why a take's audio stays on the phone, in print under it (the review of PR 112: never silence). */
const ASIDE_LINE = { size: 'Too long to carry; it stays on this phone.', refused: 'It could not be carried; it stays on this phone.' } as const;

export function TakeLine({ take }: { take: Pick<Take, 'id' | 'pitch' | 'key' | 'seconds' | 'audio' | 'clip'> }) {
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    if (playing) { stopPlaying(); setPlaying(false); return; }
    setPlaying(true);
    void play(take.audio).finally(() => setPlaying(false));
  };
  const aside = take.clip?.aside;
  return (
    <>
    <button type="button" class="wd-take" data-take={take.id} data-playing={playing ? '' : undefined}
      aria-label={playing ? 'Stop this hum' : 'Play this hum'} onClick={toggle}>
      <PitchSvg pitch={take.pitch} />
      <small class="fs-notstill">{[take.key, length(take.seconds)].filter(Boolean).join(' · ')}</small>
    </button>
    {aside && <p class="fs-quiet sg-aside fs-notstill">{ASIDE_LINE[aside]}</p>}
    </>
  );
}
