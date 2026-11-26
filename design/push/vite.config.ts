// Builds the Sunday question walkthrough's live app (design/push/src/main.ts, which boots src/main.tsx) as ONE classic
// script and one stylesheet, as design/blockers/vite.config.ts does and for the same reason: the artifact host serves
// the page from an opaque origin, where a module script (fetched with CORS) may not load. The seams are the motion
// walkthrough's own (no service worker, no persist(), an awaited hook before the first render, no location.origin), and
// one more for the push rows: the artifact host has no service worker and no PushManager, so Settings would draw no
// push controls at all. The seam lets the step say which state the real PushRows draws (off, on, held in Safari), and
// what a tap on Notify me does (design/push/src/ios.ts draws iOS's own question over the page).
// Run through script/build-push-walkthrough.mjs, which also copies the page and its files beside it.
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Swaps one exact piece of a file's code, and fails the build if it has moved. */
const swap = (code: string, from: string, to: string, what: string) => {
  const out = code.replace(from, to);
  if (out === code) throw new Error(`walkthrough: ${what} not found`);
  return out;
};

/** The build-time seams, so nothing under src/ changes for the demo. */
const seams = (): Plugin => ({
  name: 'flowstate-push-walkthrough-seams',
  enforce: 'pre',
  resolveId(source) {
    if (source === 'virtual:pwa-register') return here('../motion/src/pwa-register.ts');
    if (/(^|\/)pwa\/persist$/.test(source)) return here('../motion/src/persist.ts');
    return null;
  },
  transform(code, id) {
    if (id.endsWith('/src/main.tsx')) {
      return swap(code, 'render(<App />', 'await (globalThis as { fsBeforeRender?: () => Promise<void> }).fsBeforeRender?.();\n  render(<App />', 'main.tsx render call');
    }
    if (id.endsWith('/src/ui/route.tsx')) return code.replaceAll('location.origin', "'flowstate:/'");
    // the push rows: the step's own state, last arrival and taps (design/push/src/driver.ts sets globalThis.fsPush)
    if (id.endsWith('/src/ui/settings/PushRows.tsx')) {
      const g = '(globalThis as { fsPush?: import(\'../../../design/push/src/demo\').DemoPush }).fsPush';
      let out = swap(code, 'void pushState().then(setState)', `void (${g}?.state() ?? pushState()).then(setState)`, 'PushRows pushState');
      out = swap(out, 'void readLastArrived().then(setArrived)', `void (${g}?.arrived() ?? readLastArrived()).then(setArrived)`, 'PushRows readLastArrived');
      out = swap(out, 'const r = await turnOn();', `const r = await (${g}?.turnOn() ?? turnOn());`, 'PushRows turnOn');
      out = swap(out, 'setState(await turnOff());', `setState(await (${g}?.turnOff() ?? turnOff()));`, 'PushRows turnOff');
      return swap(out, 'try { setNote(await sendNow()); }', `try { setNote(await (${g}?.send() ?? sendNow())); }`, 'PushRows sendNow');
    }
    return null;
  },
});

export default defineConfig({
  root: here('.'),
  plugins: [seams(), preact()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    target: 'es2022',
    outDir: here('./dist'),
    emptyOutDir: true,
    sourcemap: false,
    copyPublicDir: false,
    minify: true,
    cssCodeSplit: false,
    lib: { entry: here('./src/main.ts'), formats: ['iife'], name: 'FlowStatePush', fileName: () => 'app.js', cssFileName: 'app' },
  },
});
