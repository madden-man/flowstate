// The blockers walkthrough's app (PLAN-BLOCKERS.md K6): the real FlowState, booted through its own src/main.tsx, as
// design/tasks' is. The day is pinned first (./clock, Tuesday 11 / 17), storage lives in memory (design/motion's
// fakes, before any of the app's modules so Dexie finds it), the network is refused (design/energize's net) and the
// PWA layer is stubbed at build time (vite.config.ts). Each step loads this page afresh (walk.js), so it starts from
// the step's own state: the seed passes, the step's episode, questions and lock are written through the app's own
// model just before the first render (./seed, ./driver), and the step's touches are made once the page has shown it.
import './clock';
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
