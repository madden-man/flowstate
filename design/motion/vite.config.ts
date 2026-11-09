// Builds the walkthrough's live app (design/motion/src/main.ts, which boots src/main.tsx) as ONE classic script and
// one stylesheet: the artifact host serves the page from an opaque origin, where a module script (fetched with CORS)
// may not load. Run through script/build-motion-walkthrough.mjs, which also copies the page and its files beside it.
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** The build-time seams, so nothing under src/ changes for the demo. */
const seams = (): Plugin => ({
  name: 'flowstate-walkthrough-seams',
  enforce: 'pre',
  resolveId(source) {
    // no service worker, no update check, no persist() (the host refuses them; the demo keeps nothing)
    if (source === 'virtual:pwa-register') return here('./src/pwa-register.ts');
    if (/(^|\/)pwa\/persist$/.test(source)) return here('./src/persist.ts');
    return null;
  },
  transform(code, id) {
    // the example data is written after the app has seeded itself and before it first draws
    if (id.endsWith('/src/main.tsx')) {
      const out = code.replace('render(<App />', 'await (globalThis as { fsBeforeRender?: () => Promise<void> }).fsBeforeRender?.();\n  render(<App />');
      if (out === code) throw new Error('walkthrough: main.tsx render call not found');
      return out;
    }
    // an opaque origin's location.origin is "null", which no URL takes as a base; the routes only read the path and query
    if (id.endsWith('/src/ui/route.tsx')) return code.replaceAll('location.origin', "'flowstate:/'");
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
    lib: { entry: here('./src/main.ts'), formats: ['iife'], name: 'FlowStateWalkthrough', fileName: () => 'app.js', cssFileName: 'app' },
  },
});
