// Writes test/songs/fixtures/mac-lyrics.json by running Music Companion's REAL code (src/shared/domain/sketches.ts in a
// Music Companion checkout, W7) against rows made by the phone's REAL model (src/model/songs.ts), so the phone's tests
// can hold the phone to what the Mac actually does without a copy of the Mac's merge. Skipped unless MC_REPO is set:
//
//   MC_REPO=$HOME/dev/mc-worlds-w7 npx vitest run test/songs/mac-lyrics.gen.test.ts
//
// Generated 2026-11-25 against mc-worlds-w7 at 95ab373. Re-run it whenever either side's lyric rules change.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { macScenarios } from './mac-scenarios';

const MC = process.env.MC_REPO;

it.skipIf(!MC)('writes the Music Companion known answers', async () => {
  const mc = await import(/* @vite-ignore */ `${MC}/src/shared/domain/sketches.ts`);
  const out = macScenarios(mc);
  writeFileSync(new URL('./fixtures/mac-lyrics.json', import.meta.url), `${JSON.stringify(out, null, 2)}\n`);
});
