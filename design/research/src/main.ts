// The Research walkthrough's app (PLAN-RESEARCH.md Q6): the real FlowState, booted through its own src/main.tsx, as
// design/tiers's is. The day is pinned first (./clock), storage lives in memory (design/motion's fakes, before any of
// the app's modules so Dexie finds it), the network is refused (design/energize's net), the PWA layer is stubbed at
// build time (vite.config.ts), and the run's API and indexes are the recordings (./recorded): no key is checked and
// nothing is sent. Each step loads this page afresh (walk.js), so it starts from the step's own state: the key and the
// questions are written through the app's own model just before the first render (./seed), and the step's taps are
// made once the page has shown it (./driver).
import './clock';
import '../../motion/src/fakes';
import { installNet } from '../../energize/src/net';
import { installRecorded } from './recorded';
import { setUp, startDriver, whenDrawn } from './driver';
import '../../../src/main';

installNet();
installRecorded();
// Settings asks the browser whether storage is kept (src/pwa/install.ts storageHealth); a sandboxed frame refuses the
// question with an uncaught rejection. The demo keeps nothing (design/motion/src/fakes.ts), so there is nothing to ask.
try { Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true }); } catch { /* left as it is */ }
(globalThis as { fsBeforeRender?: () => Promise<void> }).fsBeforeRender = async () => {
  await setUp();
  startDriver();
  void whenDrawn();
};
