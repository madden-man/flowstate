// The walkthrough drives the one live app from outside the frame: it posts { step, light } and the app is put in
// that step's state with its own functions and routes (a hash, a pinned light, Still, the music sheet, the lock,
// the dot on a step), from whatever state the last step or Tommy's own taps left. Driving a step twice is the same
// as once. When the app has drawn it posts { ready }; after each step, { driven }.
import { openSheet, dataVersion } from '../../../src/ui/sheets';
import { settings, saveSettings } from '../../../src/ui/settings';
import { enterStill, leaveStill, still } from '../../../src/ui/light';
import { choosePin, tryPin, relock, gateState } from '../../../src/ui/lock/pin';
import { tapMusic, openPlaylist, playNote } from '../../../src/ui/music/state';
import { liveEpisode, currentStepId, moveDot } from '../../../src/model/flows';
import { MASTER_ID } from './net';

/** The PIN the walkthrough's first step asks for. Written once, with few PBKDF2 rounds so the demo answers at once. */
export const PIN = '3569';
const PIN_ROUNDS = 2_000;

export type Light = 'day' | 'night' | 'still';
export type Step = 'keys' | 'press' | 'tabs' | 'open' | 'sheet' | 'album' | 'still' | 'stream' | 'nine' | 'dot' | 'hold' | 'quiet';

/** Each step's light as designed (the relight control's first choice). */
export const DESIGNED: Record<Step, Light> = {
  keys: 'day', press: 'day', tabs: 'day', open: 'day', sheet: 'day', album: 'day',
  still: 'night', stream: 'night', nine: 'night', dot: 'night', hold: 'night', quiet: 'still',
};

const frames = (n = 2) => new Promise<void>(r => { const f = (k: number) => (k ? requestAnimationFrame(() => f(k - 1)) : r()); f(n); });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Goes to a route by the hash, as a tab or a row does; waits for the page to be up when it changed. */
async function go(path: string): Promise<void> {
  if (location.hash === `#${path}`) return;
  location.hash = path;
  await wait(450);
  await frames();
}

let pinSet = false;
async function open(): Promise<void> {
  if (gateState() === 'locked') await tryPin(PIN);
}

async function light(l: Light): Promise<void> {
  const pin = l === 'still' ? 'night' : l;
  if (settings.peek().light !== pin) await saveSettings({ light: pin });
  if (l === 'still') enterStill();
  else if (still.peek()) leaveStill();
}

/** The dot of a flow on a step (by id), or back on rest; nothing written when it is already there. */
async function dot(flowId: string, stepId: string | 'rest'): Promise<void> {
  const live = await liveEpisode(flowId);
  const here = live ? currentStepId(live) : 'rest';
  if (here === stepId) return;
  await moveDot(flowId, [], stepId);
  dataVersion.value++;
}

async function drive(step: Step, l: Light): Promise<void> {
  await open();
  openSheet.value = null;
  openPlaylist.value = null;
  playNote.value = null;
  await light(l);
  switch (step) {
    case 'keys':
      if (!pinSet) { await choosePin(PIN, PIN_ROUNDS); pinSet = true; }
      // the page under the lock answers the light first (the journal writes which kept line it echoes), then the
      // key leaves, then the route: no page is left writing while it is locked
      await wait(500);
      relock();
      await go('/journal');
      return;
    case 'press':
      // a flow's step at rest: its tips are drawn checks that only draw (PLAN-FLOWS.md 3.7), so each visit starts
      // unchecked (Be's checks left with the spread, PLAN-VALUES.md C6)
      await dot('panic', 'rest');
      await go('/flow/panic/1');
      return;
    case 'tabs': case 'sheet': case 'still':
      await go('/journal');
      return;
    case 'open':
      await go('/flow');
      return;
    case 'album':
      await go('/journal');
      tapMusic();
      await frames();
      openPlaylist.value = MASTER_ID;
      return;
    case 'stream': case 'nine':
      await dot('panic', 'rest');
      await go('/flow/panic');
      return;
    case 'dot': case 'hold':
      await dot('panic', 'panic-2');
      await go('/flow/panic/2');
      return;
    case 'quiet':
      await dot('panic', 'panic-3');
      await go('/flow/panic/3');
      return;
  }
}

/** One of the nine flows, from the buttons beside the phone: its page, at rest. */
async function flow(id: string): Promise<void> {
  await open();
  openSheet.value = null;
  await dot(id, 'rest');
  await go(`/flow/${id}`);
}

const post = (msg: object) => { try { parent.postMessage({ fs: true, ...msg }, '*'); } catch { /* no parent */ } };

export function startDriver(): void {
  let queue: Promise<void> = Promise.resolve();
  addEventListener('message', e => {
    if (e.source !== parent || !e.data || typeof e.data !== 'object' || !e.data.fs) return;
    const d = e.data as { step?: Step; light?: Light | 'design'; flow?: string };
    queue = queue.then(async () => {
      try {
        if (d.flow) await flow(d.flow);
        else if (d.step && d.step in DESIGNED) {
          await drive(d.step, !d.light || d.light === 'design' ? DESIGNED[d.step] : d.light);
        }
        post({ driven: d.step ?? d.flow });
      } catch (err) {
        console.warn('walkthrough: could not drive', d, err);
        post({ driven: d.step ?? d.flow, failed: true });
      }
    });
  });
}

/** Posts ready once the app has drawn: its frame or its threshold is in the page, and two frames have passed. */
export async function whenDrawn(): Promise<void> {
  for (let k = 0; k < 200 && !document.querySelector('.fs-app, [data-threshold]'); k++) await wait(25);
  await frames();
  post({ ready: true });
}
