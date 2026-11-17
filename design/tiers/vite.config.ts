// Builds the Be walkthroughs' live app (design/tiers/src/main.ts here, design/folds/src/main.ts through walkthroughConfig; each boots src/main.tsx) as ONE classic
// script and one stylesheet, as design/motion/vite.config.ts does and for the same reason: the artifact host serves the
// page from an opaque origin, where a module script (fetched with CORS) may not load. The seams are the motion
// walkthrough's own (no service worker, no persist(), an awaited hook before the first render, no location.origin).
// Run through script/build-tiers-walkthrough.mjs, which also copies the page and its files beside it.
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** The build-time seams, so nothing under src/ changes for the demo. */
const seams = (): Plugin => ({
  name: 'flowstate-tiers-walkthrough-seams',
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
    return null;
  },
});

/** The walkthrough's build for the directory at root (its src/main.ts), as one classic script named name; design/folds
 *  builds through this too. */
export const walkthroughConfig = (root: string, name: string) => defineConfig({
  root,
  plugins: [seams(), preact()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    target: 'es2022',
    outDir: `${root}/dist`,
    emptyOutDir: true,
    sourcemap: false,
    copyPublicDir: false,
    minify: true,
    cssCodeSplit: false,
    lib: { entry: `${root}/src/main.ts`, formats: ['iife'], name, fileName: () => 'app.js', cssFileName: 'app' },
  },
});

export default walkthroughConfig(here('.').replace(/\/$/, ''), 'FlowStateTiers');
