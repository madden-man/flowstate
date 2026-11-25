// The Sunday question walkthrough's app (PLAN-PUSH.md N4): the real FlowState, booted through its own src/main.tsx, as
// design/blockers' is. The step's moment is pinned first (./clock), storage lives in memory (design/motion's fakes,
// before any of the app's modules so Dexie finds it), the network is refused (design/energize's net) and the PWA layer
// is stubbed at build time (vite.config.ts). The home-screen app is said to be standalone, except on the Safari step.
// Each step loads this page afresh (walk.js), so it starts from the step's own state, written through the app's own
// model just before the first render (./driver).
import './clock';
import '../../motion/src/fakes';
import { installNet } from '../../energize/src/net';
import { setUp, standalone, startDriver, whenDrawn } from './driver';
import '../../../src/main';

installNet();
// the installed app, opened from the Home Screen (pwa/hints.ts isStandalone reads navigator.standalone)
// Settings' Storage row asks the browser how the data is kept; a sandboxed frame throws on it, so the demo answers
// (kept, a few megabytes: example data)
try {
  Object.defineProperty(navigator, 'storage', {
    value: { persisted: async () => true, estimate: async () => ({ usage: 3_400_000, quota: 2_000_000_000 }) },
    configurable: true,
  });
} catch { /* the row shows nothing */ }
if (standalone) { try { Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }); } catch { /* Safari's look */ } }
(globalThis as { fsBeforeRender?: () => Promise<void> }).fsBeforeRender = async () => {
  await setUp();
  startDriver();
  void whenDrawn();
};
