// The folds walkthrough's app (PLAN-FOLDS.md G3): the real FlowState, booted through its own src/main.tsx, as
// design/tiers's is and with its pieces: the day pinned to 11 / 12 (design/tiers/src/clock), storage in memory
// (design/motion's fakes, before any of the app's modules so Dexie finds it), the network refused (design/energize's
// net) and the PWA layer stubbed at build time (design/tiers/vite.config.ts). Each step loads this page afresh, so it
// starts from the step's own state: the tiers walkthrough's example values sorted and the step's folds kept, written
// through the app's own model and settings just before the first render (./seed), and the step's taps and touches are
// made once the page has shown it (./driver).
import '../../tiers/src/clock';
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
