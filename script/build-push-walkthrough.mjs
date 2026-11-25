#!/usr/bin/env node
// Builds the Sunday question walkthrough (PLAN-PUSH.md N4) into ONE directory, ready to publish as an artifact:
//   design/push/dist/  index.html, walk.css, walk.js, tokens.css  (the page and its chrome)
//                       app.html, app.js, app.css                  (the real app, one classic script, built from src)
//                       icon.png                                    (the app's own icon, on the drawn lock screen)
// dist/ is ignored by git and skipped by design-lint, as design/blockers/dist is. Then the artifact lint runs on the
// page and check-dist on the app's files. The page itself links to PLAN-PUSH.md and docs/PUSH.md on GitHub from its
// "How this is built" tables (navigations, never fetched); check-dist names no such host, so the page is checked here
// instead: its only absolute URLs are those links.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'design/push');
const out = path.join(src, 'dist');
const run = (cmd, args) => { try { execFileSync(cmd, args, { cwd: root, stdio: 'inherit' }); } catch { process.exit(1); } };

run(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '-c', path.join(src, 'vite.config.ts'), '--logLevel', 'warn']);
for (const f of ['index.html', 'walk.css', 'walk.js', 'app.html']) fs.copyFileSync(path.join(src, f), path.join(out, f));
fs.copyFileSync(path.join(root, 'design/tokens.css'), path.join(out, 'tokens.css'));
fs.copyFileSync(path.join(root, 'public/apple-touch-icon.png'), path.join(out, 'icon.png'));

const lint = path.join(os.homedir(), '.claude/hooks/artifact-lint.mjs');
if (fs.existsSync(lint)) run(process.execPath, [lint, path.join(out, 'index.html')]);
else console.log('artifact-lint not found at ~/.claude/hooks: skipped');

// the page's own links: only the repo's documents on GitHub
const DOC = /^https:\/\/github\.com\/madden-man\/flowstate\/blob\/push-plan\/(PLAN-PUSH\.md|docs\/PUSH\.md)$/;
const page = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const stray = [...page.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)].map(m => m[0]).filter(u => !DOC.test(u));
if (stray.length) { console.error(`FAIL  index.html links outside the repo's docs: ${stray.join(', ')}`); process.exit(1); }
// check-dist on everything else (the app's bundle, its page, the chrome)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-push-dist-'));
for (const f of fs.readdirSync(out).filter(f => f !== 'index.html')) fs.copyFileSync(path.join(out, f), path.join(tmp, f));
run(process.execPath, [path.join(root, 'script/check-dist.mjs'), tmp]);
fs.rmSync(tmp, { recursive: true, force: true });

const files = fs.readdirSync(out);
const size = files.reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0);
console.log(`built ${path.relative(root, out)}/: ${files.length} files, ${(size / 1024).toFixed(0)} KB: ${files.join(', ')}`);
