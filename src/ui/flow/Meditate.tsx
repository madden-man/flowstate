// Meditate (PLAN-MEDITATE.md, S1) at #/flow/meditate: one circle and a gentle sound. Not a flow: no steps, no dot, no
// episode, no tips. At rest the page is the circle breathing with "begin" in print, and the sound chips under it (Rain,
// Ocean, Forest, Bowl, Quiet; the choice kept in settings.sitSound). A tap on the circle begins a sit: that tap is the
// gesture the iPhone needs before any sound, the header, the tabs, the rules, the lamp and every word fade on one
// --t-light (the light itself never changes), and the screen is kept awake. A tap on the circle ends it, and the sound
// goes out over an out-breath. The page hidden, the route changed or the PIN lock come down (each takes the page away
// or unmounts it) ends the sit and stops the sound. In Still the page is the same: the circle and the chips.
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Page } from '../parts/Page';
import { Circle } from '../parts/Circle';
import { tick } from '../parts/Haptic';
import { scape, SIT_SOUNDS, OUT_S, type Scape, type SitSound } from '../parts/Sound';
import { settings, saveSettings } from '../settings';
import { useWakeLock } from './breath';

/** A sit is on: the frame (app.tsx) puts data-sitting on .fs-app, and the header, the tabs and the lamp leave. */
export const sitting = signal(false);

const WORDS: Record<SitSound, string> = { rain: 'Rain', ocean: 'Ocean', forest: 'Forest', bowl: 'Bowl', quiet: 'Quiet' };

type Clock = { t0: number; now: () => number };
const wall = (): Clock => { const now = () => performance.now() / 1000; return { t0: now(), now }; };

export function Meditate() {
  const sound: SitSound = settings.value.sitSound ?? 'rain';
  const [clock, setClock] = useState<Clock | null>(null);
  const live = useRef<Scape | null>(null);
  const on = clock !== null;

  /** Ends the sit: the sound fades over `seconds`, the page comes back. */
  const end = (seconds = OUT_S) => {
    const s = live.current;
    live.current = null;
    s?.end(seconds);
    sitting.value = false;
    setClock(null);
  };
  const begin = () => {
    // the tap itself: the sound starts inside it (rule 21), or the circle alone for Quiet or where there is no Web Audio
    const s = scape(sound);
    live.current = s;
    sitting.value = true;
    setClock(s ? { t0: s.t0, now: s.now } : wall());
  };
  const tap = () => { tick('sit'); if (on) end(); else begin(); };

  // the page hidden (the phone locked, another app): the sit ends where it was (listening from the render that sits)
  useLayoutEffect(() => {
    if (!on) return;
    const seen = () => { if (document.visibilityState !== 'visible') end(); };
    document.addEventListener('visibilitychange', seen);
    return () => document.removeEventListener('visibilitychange', seen);
  }, [on]);
  // the page goes (a route change, the PIN lock over everything): the sound with it
  useEffect(() => () => { live.current?.end(OUT_S); live.current = null; sitting.value = false; }, []);
  // the screen stays lit for the length of the sit (PLAN-MEDITATE.md 3.2: a locked iPhone may stop a page's sound)
  useWakeLock(on);

  return (
    <Page label="Meditate" back={{ word: 'Flow', href: '#/flow' }} keepSettings>
      <div class="fs-sheetof fs-rules md-page" data-state={on ? 'sitting' : 'rest'} data-sound={sound} data-playing={on ? 'true' : undefined}>
        <Circle sitting={on} clock={clock} word="begin" label={on ? 'End the sit' : 'Begin'} onTap={tap} />
        <div class="md-quiet" aria-hidden={on ? 'true' : undefined}>
          <div class="fs-chips fs-chips-wrap md-sounds" role="group" aria-label="Sound">
            {SIT_SOUNDS.map(name => (
              <button key={name} type="button" class="fs-chip" data-sound={name} aria-pressed={sound === name}
                tabIndex={on ? -1 : undefined}
                onClick={() => { if (sound !== name) void saveSettings({ sitSound: name }); }}>{WORDS[name]}</button>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
}
