#!/usr/bin/env node
// Builds the Research walkthrough (PLAN-RESEARCH.md Q6) into ONE directory, ready to publish as an artifact:
//   design/research/dist/  index.html, walk.css, walk.js, tokens.css  (the page and its chrome)
//                          app.html, app.js, app.css                  (the real app, one classic script, built from src)
// Publish these seven, each served under its own name beside the page (index.html is the page; the other six go in
// `files` as walk.css, walk.js, tokens.css, app.html, app.js, app.css). About 1.3 MB in all, nearly all app.js: the app,
// fake-indexeddb, the Anthropic SDK (bundled, never called) and the two recorded runs (design/research/src/recorded.ts).
// dist/ is ignored by git and skipped by design-lint, as design/motion/dist is (the bundled app holds the app's own
// AudioContext). Then the artifact lint runs on the page and check-dist on the directory.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'design/research');
const out = path.join(src, 'dist');
const run = (cmd, args) => { try { execFileSync(cmd, args, { cwd: root, stdio: 'inherit' }); } catch { process.exit(1); } };

run(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '-c', path.join(src, 'vite.config.ts'), '--logLevel', 'warn']);
for (const f of ['index.html', 'walk.css', 'walk.js', 'app.html']) fs.copyFileSync(path.join(src, f), path.join(out, f));
fs.copyFileSync(path.join(root, 'design/tokens.css'), path.join(out, 'tokens.css'));

const lint = path.join(os.homedir(), '.claude/hooks/artifact-lint.mjs');
if (fs.existsSync(lint)) run(process.execPath, [lint, path.join(out, 'index.html')]);
else console.log('artifact-lint not found at ~/.claude/hooks: skipped');
run(process.execPath, [path.join(root, 'script/check-dist.mjs'), out]);
console.log(`built ${path.relative(root, out)}/: ${fs.readdirSync(out).join(', ')}`);

// The SDK carries a raw U+FFFD inside a template literal (its replacement for a lone surrogate). The artifact host
// refuses a file with that character in it, so it is written as its escape: the same string when the script runs.
{
  const js = path.join(out, 'app.js');
  const text = fs.readFileSync(js, 'utf8');
  if (text.includes('�')) fs.writeFileSync(js, text.replaceAll('�', '\\uFFFD'));
}
