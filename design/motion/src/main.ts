// The walkthrough's app: the real FlowState, booted through its own src/main.tsx, with three things put under it
// first. Storage lives in memory (./fakes, imported before any of the app's modules so Dexie finds it), the network
// is answered from fixtures (./net), and the PWA layer is stubbed at build time (vite.config.ts aliases). Example
// data is written through the app's own model once the app has seeded itself, just before its first render (the
// build adds one awaited hook in front of main.tsx's render call), and the driver then takes the walkthrough's steps.
import './fakes';
import { installNet } from './net';
import { seedDemo } from './seed';
import { startDriver, whenDrawn } from './driver';
// the app itself: its boot starts now and waits on the database, so the lines below run before it can draw
import '../../../src/main';

installNet();
(globalThis as { fsBeforeRender?: () => Promise<void> }).fsBeforeRender = async () => {
  await seedDemo();
  startDriver();
  void whenDrawn();
};
