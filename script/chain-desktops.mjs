#!/usr/bin/env node
// W8's chain on the two desktop apps (PLAN-WORLDS.md W8, docs/W8 walkthroughs). Each app runs from a throwaway clone
// (`cp -Rc`, built there), never its own checkout, through its own Playwright Electron harness on its local test
// database, hidden: nothing here touches real data, a keychain or Atlas. The spec that drives each is in script/chain/.
//
//   node script/chain-desktops.mjs down      what each app publishes for the phone: test/fixtures/chain/down-*.json
//   node script/chain-desktops.mjs screens   the phone's recorded envelopes pulled, each screen captured into .chain/
//
// Env: NC_SRC (default ~/dev/nc-worlds-w3), MC_SRC (default ~/dev/mc-worlds-w7), CHAIN_CLONES (where the clones go,
// default <tmp>/flowstate-chain), ONLY=nc|mc. A clone is made once; delete it to take a newer checkout.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phase = process.argv[2];
if (phase !== 'down' && phase !== 'screens') { console.error('usage: chain-desktops.mjs down|screens'); process.exit(64); }
const fix = path.join(root, 'test/fixtures/chain');
const out = path.join(root, '.chain');
mkdirSync(fix, { recursive: true });
mkdirSync(out, { recursive: true });
const clones = process.env.CHAIN_CLONES ?? path.join(os.tmpdir(), 'flowstate-chain');
mkdirSync(clones, { recursive: true });

const APPS = {
  nc: { src: process.env.NC_SRC ?? path.join(os.homedir(), 'dev/nc-worlds-w3'), spec: 'nc.spec.ts', env: {} },
  // Music Companion's tests must never take the focus
  mc: { src: process.env.MC_SRC ?? path.join(os.homedir(), 'dev/mc-worlds-w7'), spec: 'mc.spec.ts', env: { MUSIC_COMPANION_HIDDEN: '1' } },
};

for (const [name, a] of Object.entries(APPS)) {
  if (process.env.ONLY && process.env.ONLY !== name) continue;
  const dir = path.join(clones, name);
  if (!existsSync(dir)) {
    execFileSync('cp', ['-Rc', a.src, dir]);
    execFileSync('npm', ['run', 'build'], { cwd: dir, stdio: 'inherit' });
  }
  copyFileSync(path.join(root, 'script/chain', a.spec), path.join(dir, 'tests/e2e/chain.spec.ts'));
  copyFileSync(path.join(root, 'script/chain/capture.ts'), path.join(dir, 'tests/e2e/chainCapture.ts'));
  console.log(`${name}: ${phase}`);
  execFileSync('npx', ['playwright', 'test', 'tests/e2e/chain.spec.ts', '--workers=1'], {
    cwd: dir, stdio: 'inherit',
    env: { ...process.env, ...a.env, CHAIN_PHASE: phase, CHAIN_FIX: fix, CHAIN_OUT: out },
  });
}
