// Builds the tasks walkthrough's live app (design/tasks/src/main.ts, which boots src/main.tsx) as ONE classic
// script and one stylesheet, as design/energize/vite.config.ts does and for the same reason: the artifact host serves
// the page from an opaque origin, where a module script (fetched with CORS) may not load. The seams are the motion
// walkthrough's own (no service worker, no persist(), an awaited hook before the first render, no location.origin).
// One seam more than the mountain's: a kept cover is shown from its own file beside app.html (c-<sign>-<n>.jpg, copied
// by the build) instead of an object URL of bytes in memory, so the 21 starter covers stay separate image files.
// Run through script/build-tasks-walkthrough.mjs, which also copies the page and its files beside it.
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** The build-time seams, so nothing under src/ changes for the demo. */
const seams = (): Plugin => ({
  name: 'flowstate-tasks-walkthrough-seams',
  enforce: 'pre',
  resolveId(source) {
    if (source === 'virtual:pwa-register') return here('../motion/src/pwa-register.ts');
    if (/(^|\/)pwa\/persist$/.test(source)) return here('../motion/src/persist.ts');
    return null;
  },
  transform(code, id) {
    if (id.endsWith('/src/main.tsx')) {
      const out = code.replace('render(<App />', 'await (globalThis as { fsBeforeRender?: () => Promise<void> }).fsBeforeRender?.();\n  render(<App />');
      if (out === code) throw new Error('walkthrough: main.tsx render call not found');
      return out;
    }
    if (id.endsWith('/src/ui/route.tsx')) return code.replaceAll('location.origin', "'flowstate:/'");
    if (id.endsWith('/src/ui/music/state.ts')) {
      const out = code.replace('const url = URL.createObjectURL(blob);',
        'const url = (globalThis as { fsCoverUrl?: (uri: string) => string | undefined }).fsCoverUrl?.(row.albumUri) ?? URL.createObjectURL(blob);');
      if (out === code) throw new Error('walkthrough: the cover URL in music/state.ts not found');
      return out;
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
    lib: { entry: here('./src/main.ts'), formats: ['iife'], name: 'FlowStateTasks', fileName: () => 'app.js', cssFileName: 'app' },
  },
});
