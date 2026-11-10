// The Energize walkthrough's app: the real FlowState, booted through its own src/main.tsx, as design/motion's is. The
// day is pinned first (./clock), storage lives in memory (design/motion's fakes, before any of the app's modules so
// Dexie finds it), the network is refused (./net) and the PWA layer is stubbed at build time (vite.config.ts). Each
// step loads this page afresh (walk.js), so it starts from the step's own state: the example data and the step's
// setup are written through the app's own model just before the first render (./seed, ./driver), and the step's
// taps are made once the page has shown it.
import './clock';
import '../../motion/src/fakes';
import { installNet } from './net';
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
