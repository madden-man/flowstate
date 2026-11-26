// The push half of the walkthrough's app. The artifact host has no service worker and no PushManager, so the real
// PushRows (src/ui/settings/PushRows.tsx) would draw nothing; vite.config.ts's seam asks globalThis.fsPush first. The
// state, the last arrival and the taps are the step's own; everything drawn is still PushRowsView. A tap on Notify me
// raises iOS's own question over the page (drawn here: the system's, not the app's), and its answer is the switch's.
import { pushArrived, type PushState, type PushWhy, type TurnOn } from '../../../src/push/push';
import './ios.css';

export type DemoPush = {
  state(): Promise<PushState>;
  arrived(): Promise<number | null>;
  turnOn(): Promise<TurnOn>;
  turnOff(): Promise<'off'>;
  send(): Promise<'sent' | PushWhy>;
};

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** iOS's permission alert for a home-screen app (iOS 16.4 and later), over the page, until a button is tapped. */
export function askIOS(): Promise<boolean> {
  return new Promise(resolve => {
    const scrim = document.createElement('div');
    scrim.className = 'ios-scrim';
    scrim.dataset.ios = 'permission';
    scrim.innerHTML = '<div class="ios-alert" role="alertdialog" aria-labelledby="ios-t" aria-describedby="ios-m">'
      + '<div class="ios-alert-text"><b id="ios-t">“FlowState” Would Like to Send You Notifications</b>'
      + '<p id="ios-m">Notifications may include alerts, sounds, and icon badges. These can be configured in Settings.</p></div>'
      + '<div class="ios-alert-buttons"><button type="button" data-ios-no>Don’t Allow</button><button type="button" data-ios-yes>Allow</button></div>'
      + '</div>';
    const done = (yes: boolean) => { scrim.remove(); resolve(yes); };
    scrim.querySelector('[data-ios-no]')!.addEventListener('click', () => done(false));
    scrim.querySelector('[data-ios-yes]')!.addEventListener('click', () => done(true));
    document.body.appendChild(scrim);
  });
}

/** A demo push for the step: starts in state, last arrived at arrivedAt. */
export function demoPush(start: PushState, arrivedAt: number | null): DemoPush {
  let state = start;
  let arrived = arrivedAt;
  return {
    state: async () => state,
    arrived: async () => (state === 'on' ? arrived : null),
    async turnOn() {
      state = (await askIOS()) ? 'on' : 'denied';
      return { state };
    },
    async turnOff() { state = 'off'; return 'off'; },
    async send() {
      await wait(700);
      // the worker's knock as the push lands: the row reads Last arrived again
      arrived = Date.now();
      pushArrived.value++;
      return 'sent';
    },
  };
}
