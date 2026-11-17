// Builds the blockers walkthrough's live app (design/blockers/src/main.ts, which boots src/main.tsx) as ONE classic
// script and one stylesheet, as design/tasks/vite.config.ts does and for the same reason: the artifact host serves the
// page from an opaque origin, where a module script (fetched with CORS) may not load. The seams are the motion
// walkthrough's own (no service worker, no persist(), an awaited hook before the first render, no location.origin), and
// design/tasks' cover seam, so Root's five starter covers are files beside app.html.
// Run through script/build-blockers-walkthrough.mjs, which also copies the page and its files beside it.
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** The build-time seams, so nothing under src/ changes for the demo. */
const seams = (): Plugin => ({
  name: 'flowstate-blockers-walkthrough-seams',
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
    // design/tasks' cover seam: a kept cover is shown from its own file beside app.html, not an object URL of bytes
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
    lib: { entry: here('./src/main.ts'), formats: ['iife'], name: 'FlowStateBlockers', fileName: () => 'app.js', cssFileName: 'app' },
  },
});
