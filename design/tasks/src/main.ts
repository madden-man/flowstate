// The tasks walkthrough's app (PLAN-TASKS.md T6): the real FlowState, booted through its own src/main.tsx, as
// design/mountain's is. The day is pinned first (design/values' clock, Wednesday 11 / 11), storage lives in memory
// (design/motion's fakes, before any of the app's modules so Dexie finds it), the network is refused (design/energize's
// net) and the PWA layer is stubbed at build time (vite.config.ts). Each step loads this page afresh (walk.js), so it
// starts from the step's own state: the gates, the person, the shelves and the lock are written through the app's own
// model just before the first render (./seed, ./driver), and the step's touches are made once the page has shown it.
import '../../values/src/clock';
import '../../motion/src/fakes';
import { installNet } from '../../energize/src/net';
import { seedDemo } from './seed';
import { setUp, startDriver, whenDrawn } from './driver';
import '../../../src/main';

installNet();
(globalThis as { fsBeforeRender?: () => Promise<void> }).fsBeforeRender = async () => {
  await seedDemo();
  await setUp();
  startDriver();
  void whenDrawn();
};
