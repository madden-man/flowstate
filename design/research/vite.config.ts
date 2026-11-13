// Builds the Research walkthrough's live app (design/research/src/main.ts, which boots src/main.tsx) as ONE classic
// script and one stylesheet, as design/motion/vite.config.ts does and for the same reason: the artifact host serves the
// page from an opaque origin, where a module script (fetched with CORS) may not load. The seams are the motion
// walkthrough's own (no service worker, no persist(), an awaited hook before the first render, no location.origin).
// Run through script/build-research-walkthrough.mjs, which also copies the page and its files beside it.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const FIXTURES = here('../../test/fixtures/research/');
const RECORDED = 'virtual:research-recorded';

/** The saved index responses the recorded runs search, cut to the records the runs file (each record whole, in its
 *  place). The agents' replies are recorded, so what the searches return beyond those changes nothing on the page,
 *  and the bundle carries no record nothing shows. */
function recordedBodies(): Record<string, string> {
  const filed = new Set<string>();
  for (const run of fs.readdirSync(FIXTURES).filter(f => /^run-.*\.json$/.test(f))) {
    const r = JSON.parse(fs.readFileSync(FIXTURES + run, 'utf8')) as { turns: Record<string, { content: { type: string; name?: string; input?: { id?: string } }[] }[]> };
    for (const turns of Object.values(r.turns)) for (const t of turns) for (const b of t.content) {
      if (b.type === 'tool_use' && b.name === 'file' && b.input?.id) filed.add(b.input.id);
    }
  }
  const isFiled = (doi: unknown) => typeof doi === 'string' && filed.has(`doi:${doi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').toLowerCase()}`);
  const out: Record<string, string> = {};
  for (const f of ['europepmc-tier1.json', 'europepmc-tier2.json', 'openalex-tier1.json', 'openalex-tier2.json']) {
    const body = JSON.parse(fs.readFileSync(FIXTURES + f, 'utf8'));
    if (body.resultList?.result) body.resultList.result = body.resultList.result.filter((r: { doi?: string }) => isFiled(r.doi));
    if (body.results) body.results = body.results.filter((w: { doi?: string }) => isFiled(w.doi));
    out[f] = JSON.stringify(body);
  }
  return out;
}

/** The build-time seams, so nothing under src/ changes for the demo. */
const seams = (): Plugin => ({
  name: 'flowstate-research-walkthrough-seams',
  enforce: 'pre',
  resolveId(source) {
    if (source === 'virtual:pwa-register') return here('../motion/src/pwa-register.ts');
    if (/(^|\/)pwa\/persist$/.test(source)) return here('../motion/src/persist.ts');
    if (source === RECORDED) return `\0${RECORDED}`;
    return null;
  },
  load(id) {
    return id === `\0${RECORDED}` ? `export default ${JSON.stringify(recordedBodies())};` : null;
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
    lib: { entry: here('./src/main.ts'), formats: ['iife'], name: 'FlowStateResearch', fileName: () => 'app.js', cssFileName: 'app' },
  },
});
