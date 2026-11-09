// Meditate (PLAN-MEDITATE.md, S1 and S2) at #/flow/meditate: one circle and a gentle sound. Not a flow: no steps, no
// dot, no episode, no tips. At rest the page is the circle breathing with "begin" in print, and under it the sound chips
// (Rain, Ocean, Forest, Bowl, Quiet; kept in settings.sitSound), the Minutes chips (Open, 5, 10, 20; kept in
// settings.sitMinutes) and "Last sat · 11 / 8 · ocean". A tap on the circle begins a sit: that tap is the gesture the
// iPhone needs before any sound, the header, the tabs, the rules, the lamp and every word fade on one --t-light (the
// light itself never changes), and the screen is kept awake. With minutes chosen the page carries data-ending and the
// circle draws itself once round in ink on the sit's own clock; when it is round one bell closes it (sitEnd, which
// follows the Sounds switch like every bell) and the sound goes out over an out-breath. A tap on the circle ends any
// sit. The page hidden, the route changed or the PIN lock come down (each takes the page away or unmounts it) ends the
// sit and stops the sound. A sit of a minute or more is written when it ends (model/sits.ts), and the page comes back
// as the page after it: "Sat · 12 minutes · rain" and "Write it down", today's journal page linked to the sit. One
// ended inside its first minute writes nothing and the page goes back to rest. Leaving the page forgets the after.
// In Still the page is the circle and the sound chips only: a sit begun there is open, nothing about the last one
// shows and there is no after, but the sit is still written. Nothing here adds sits up (rule 15).
//
// S3. From a flow: a Sit tip's row (./Tips.tsx) puts the live episode and the tip in sitFrom and opens this page,
// which takes them once as it mounts and clears them; every sit of a minute or more on that visit is written with the
// episode, and the tip is ticked on it (model/sits.ts keepSit). Coming here any other way carries nothing.
// Through the door (doorOnly, the journal locked): the circle, the chips and a sit with its sound all work, nothing
// that reads the locked journal shows (no "last sat", no page after, no journal row), the chips choose for this visit
// only, and a sit of a minute or more is held in memory (./door.ts doorSits) for the PIN to write. Any sit that ends
// while the journal is locked (the lock come down over the page) is held the same way.
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Page } from '../parts/Page';
import { Circle } from '../parts/Circle';
import { tick } from '../parts/Haptic';
import { bell, scape, SIT_SOUNDS, OUT_S, type Scape, type SitSound } from '../parts/Sound';
import { settings, saveSettings } from '../settings';
import { light } from '../light';
import { shortDate } from '../date';
import { useWakeLock } from './breath';
import type { Read } from '../../db/fields';
import type { Sit, SitMinutes } from '../../db/schema';
import { keepSit, lastSit, linkSitToday, minutesWords, satMinutes, sitOf, SIT_LENGTHS, type SitFrom } from '../../model/sits';
import { keyState } from '../../db/fields';
import { askPin, doorSits } from './door';

/** A sit is on: the frame (app.tsx) puts data-sitting on .fs-app, and the header, the tabs and the lamp leave. */
export const sitting = signal(false);

/** A Sit tip's row sent this page here (S3): the episode and the tip, taken once by the page as it mounts. */
export const sitFrom = signal<SitFrom | null>(null);

const WORDS: Record<SitSound, string> = { rain: 'Rain', ocean: 'Ocean', forest: 'Forest', bowl: 'Bowl', quiet: 'Quiet' };
const LENGTH_WORDS: Record<SitMinutes, string> = { 0: 'Open', 5: '5', 10: '10', 20: '20' };

type Clock = { t0: number; now: () => number };
const wall = (): Clock => { const now = () => performance.now() / 1000; return { t0: now(), now }; };

/** A sit on: its clock, when it began, its sound, and its length (0 is open). */
type Run = { clock: Clock; startedAt: number; sound: SitSound; minutes: SitMinutes };

export function Meditate({ doorOnly }: { doorOnly?: boolean }) {
  const { route } = useLocation();
  // through the door nothing is written, so the chips choose for this visit only
  const [pick, setPick] = useState<{ sound?: SitSound; minutes?: SitMinutes }>({});
  const sound: SitSound = pick.sound ?? settings.value.sitSound ?? 'rain';
  const still = light.value === 'still';
  const minutes: SitMinutes = pick.minutes ?? settings.value.sitMinutes ?? 0;
  const choose = (p: { sitSound: SitSound } | { sitMinutes: SitMinutes }) => {
    if (!doorOnly) { void saveSettings(p); return; }
    setPick(was => ('sitSound' in p ? { ...was, sound: p.sitSound } : { ...was, minutes: p.sitMinutes }));
  };
  // where a Sit tip sent this visit from (taken once, then cleared); through the door no episode is carried
  const [from] = useState<SitFrom | null>(() => { const f = sitFrom.value; sitFrom.value = null; return doorOnly ? null : f; });
  const [run, setRun] = useState<Run | null>(null);
  /** The sit just ended, while the page is the page after it. */
  const [after, setAfter] = useState<Sit | null>(null);
  const [last, setLast] = useState<Read<Sit> | undefined>(undefined);
  const live = useRef<Scape | null>(null);
  const running = useRef<Run | null>(null);
  /** The last sit's write, so "Write it down" links a row that is there. */
  const writing = useRef<Promise<unknown>>(Promise.resolve());
  const on = run !== null;

  useEffect(() => {
    // "last sat" reads the journal, so through the door it stays behind the PIN
    if (doorOnly) return;
    let here = true;
    void lastSit().then(s => { if (here) setLast(s); }).catch(() => undefined);
    return () => { here = false; };
  }, []);

  /** Ends the sit and the sound (it fades over `seconds`), and writes the sit if it ran a minute or more. */
  const finish = (seconds: number): Sit | null => {
    const r = running.current;
    running.current = null;
    const s = live.current;
    live.current = null;
    s?.end(seconds);
    sitting.value = false;
    const row = r && sitOf(r.startedAt, Date.now(), r.sound, r.minutes, from ?? undefined);
    if (!row) return null;
    // locked (through the door, or the PIN came down over the page): held for the PIN to write (./door.ts)
    if (keyState() === 'locked') doorSits.value = [...doorSits.value, { sit: row, from: from ?? undefined }];
    else writing.current = keepSit(row, from ?? undefined).catch(() => undefined);
    return row;
  };
  /** Ends the sit; the page comes back as the page after it, or at rest for one under a minute or in Still. */
  const end = (seconds = OUT_S) => {
    const row = finish(seconds);
    setRun(null);
    // through the door there is no page after: it leads to the journal
    setAfter(row && light.value !== 'still' && !doorOnly ? row : null);
    if (row && !doorOnly) setLast(row);
  };
  const begin = () => {
    // the tap itself: the sound starts inside it (rule 21), or the circle alone for Quiet or where there is no Web Audio
    const s = scape(sound);
    live.current = s;
    sitting.value = true;
    // in Still a sit is always open (rule 13), whatever the chips said before
    const r: Run = { clock: s ? { t0: s.t0, now: s.now } : wall(), startedAt: Date.now(), sound, minutes: still ? 0 : minutes };
    running.current = r;
    setRun(r);
    setAfter(null);
  };
  const tap = () => { tick('sit'); if (on) end(); else begin(); };
  /** The circle is round: one bell closes the sit, and the sound goes out over an out-breath. */
  const closed = () => { if (!running.current) return; bell('sitEnd'); end(OUT_S); };
  const writeItDown = async () => {
    if (!after) return;
    await writing.current;
    if (await linkSitToday(after.id).catch(() => undefined)) route('/journal');
  };

  // the page hidden (the phone locked, another app): the sit ends where it was (listening from the render that sits)
  useLayoutEffect(() => {
    if (!on) return;
    const seen = () => { if (document.visibilityState !== 'visible') end(); };
    document.addEventListener('visibilitychange', seen);
    return () => document.removeEventListener('visibilitychange', seen);
  }, [on]);
  // the page goes (a route change, the PIN lock over everything): the sound with it, and the sit is written
  useEffect(() => () => { finish(OUT_S); }, []);
  // the screen stays lit for the length of the sit (PLAN-MEDITATE.md 3.2: a locked iPhone may stop a page's sound)
  useWakeLock(on);

  const showAfter = !on && after !== null && !still;
  const state = on ? 'sitting' : showAfter ? 'after' : 'rest';
  const rest = state === 'rest';
  return (
    <Page label="Meditate" back={{ word: 'Flow', href: '#/flow' }} keepSettings door={doorOnly ? { ask: askPin } : undefined}>
      <div class="fs-sheetof fs-rules md-page" data-state={state} data-sound={sound} data-playing={on ? 'true' : undefined}
        data-ending={run?.minutes ? 'true' : undefined}>
        <Circle sitting={on} clock={run?.clock} word="begin" label={on ? 'End the sit' : 'Begin'} onTap={tap}
          length={run?.minutes ? run.minutes * 60 : 0} onClose={closed} />
        <div class="md-foot">
          <div class="md-quiet" aria-hidden={rest ? undefined : 'true'}>
            <div class="fs-chips fs-chips-wrap md-sounds" role="group" aria-label="Sound">
              {SIT_SOUNDS.map(name => (
                <button key={name} type="button" class="fs-chip" data-sound={name} aria-pressed={sound === name}
                  tabIndex={rest ? undefined : -1}
                  onClick={() => { if (sound !== name) choose({ sitSound: name }); }}>{WORDS[name]}</button>
              ))}
            </div>
            <div class="fs-chips fs-chips-wrap md-lengths fs-notstill" role="group" aria-label="Minutes">
              {SIT_LENGTHS.map(n => (
                <button key={n} type="button" class="fs-chip" data-minutes={n} aria-pressed={minutes === n}
                  tabIndex={rest ? undefined : -1}
                  onClick={() => { if (minutes !== n) choose({ sitMinutes: n }); }}>{LENGTH_WORDS[n]}</button>
              ))}
            </div>
            {last && !doorOnly && <p class="fl-last fs-notstill">Last sat · {shortDate(new Date(last.startedAt))} · {last.sound}</p>}
          </div>
          <div class="md-after" aria-hidden={showAfter ? undefined : 'true'}>
            {after && <p class="fl-last fs-notstill">Sat · {minutesWords(satMinutes(after))} · {after.sound}</p>}
            {after && (
              <a class="fs-row fs-list-row" href="#/journal" tabIndex={showAfter ? undefined : -1}
                onClick={e => { e.preventDefault(); void writeItDown(); }}>
                <span class="fs-list-line">Write it down</span>
                <small class="fs-list-meta">Today's page</small>
              </a>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
