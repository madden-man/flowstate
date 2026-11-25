# W6 (Songs): handoff

Branch `worlds-w6` from `worlds-plan` (9be7b95, plus the WORLDS-HANDOFF docs commit merged in). Draft PR against `worlds-plan`. Nothing deployed.

## Done

- **One shared database (Tommy, 2026-11-25):** the function reaches only `flowstate_bridge` (`BRIDGE_DB`) and its four collections; `novel_companion` and `music_companion` are unreachable through it. Tests, docs/BRIDGE.md, PLAN-WORLDS.md sections 2 and 5 and WORLDS-HANDOFF updated. Nothing on the phone changed.
- The key finder (`src/model/keyfinder.ts`, `theory.ts`) copied unchanged with its 30 known-answer tests (`test/model/keyfinder/`, fixtures made in memory). Uncommitted until the next checkpoint.

- Nothing of Songs itself yet. Only reading and design notes so far (below).
- The flake job from the coordinator, `test/e2e/worlds.spec.ts` "the shelf slides under a thumb and settles one cover at a time" (126 passed, 1 failed on `worlds-plan` at 9be7b95), is fixed in code but **not yet proven** (see Half done).

## Half done: the shelf flake

- **Cause, measured** (20 repeats, 4 workers, scrollLeft logged at lift and at rest): Chromium's scroll snap read the lift as a fling the wrong way. A lift at 125 px (past halfway, 110 of a 220 px step) snapped back to the first cover, and a lift at 244 px (nearest East Winds at 220) went back to Songbook. CDP stamps each touch when it is dispatched, so on a loaded machine the gaps jitter and Chromium's velocity tracker misreads the direction. 7 of 20 failed before the fix. It was not scrollend versus the 120 ms fallback: the shelf reported the cover the browser actually stopped on every time.
- **Fix, uncommitted until this checkpoint:**
  - The test's thumb gives every touch its own timestamp, a steady 16 ms apart. The test then waits on the shelf's own `data-settled` attribute, not on sampled scrollLeft and sleeps.
  - `src/ui/flow/Shelf.tsx`: nothing settles while a finger is on the shelf. Before this, a pause over 120 ms mid-slide settled under the held thumb, with the tick and the lamp, which was a real bug of its own. On lift it settles after the carry-on or at once. `data-settled` names the cover at rest and is cleared on scroll.
- **Not yet done:** the `--repeat-each 20` proof run (it was running when the checkpoint was called; its result is not recorded), `npm test` and the lints on this change, and the correction to the last paragraph of `docs/WORLDS-HANDOFF.md` (record 126 passed, 1 failed, this test, and the fix).

## Not started (all of W6 proper)

Songs row and list, Hum row, song page (ruled, sections from chips), hold to hum, live pitch line, key guess, Tap tempo, Character chip, Songbook rows, clips after ack, tests, walkthrough `design/songs.html`, three-lights screenshots.

## Decisions and findings so far (for whoever resumes)

- **No schema bump needed.** W2 already created `songs`, `takes` and `outbox` in schema 10, and the sealing for both (`fields.ts` songSpec, takeSpec). The outbox middleware records songs and takes in a world only. `up.ts` builds song and take envelopes (the take without its audio).
- **Clip sender is missing.** `net.ts` has no `postClip`, but the function's `POST ?op=clip&world&take&rev` is built (`netlify/lib/bridge.ts`). Plan: add `postClip` in `src/bridge/net.ts` and a `src/bridge/clips.ts` that, after a drain, sends each take with no `clipped` mark and no outbox entry. Use rev = the take's `at` (constant, so a resend answers `same`), and mark `clipped` through `handed().writeDown` (no outbox, so the take does not go up again). Call it from `model/carry.ts` carryUp. A world only; his own notebook has no Songs row (plan section 4).
- **Live pitch:** `new AudioContext` and `<audio>` are banned outside `parts/Sound` (DL20). Put a mic analyser (`listen(stream)`) and take playback in `parts/Sound.ts`. Run YIN (lift from `origin/worlds-w0-spike:src/spike/pitch.ts`) on analyser frames about every 50 ms. Store `pitch` as MIDI note numbers to two decimals, 0 where unvoiced, evenly spaced over `seconds` (document this for W7).
- **Key finder:** copy `~/dev/MusicCompanion/src/shared/domain/keyfinder.ts` and `theory.ts` unchanged (source commit 6897f34). For a hum, build the chroma from voiced pitch frames, run `findKey`, and name a key only when `namedKey` allows it (confidence 0.15 or more, not noise). Its tests read WAV fixtures from MusicCompanion's `scripts/make-fixtures.ts`; port the generators into a test helper, or synthesise.
- **Songbook pocket songs** (`{ id, title }`) are listed with local songs; writing on one makes the local row with that id.
- **Design** to match: `design/worlds/index.html` step `song` (`.wd-sec`, `.wd-take`, `.wd-pitch`, chips "Dawn Li" and "Tap tempo", button "Hold to hum"). Proposed: in Still a take is its pitch line alone (no key, no time).
- E2E for the hum: stub `getUserMedia` with an oscillator's `MediaStreamDestination` stream (known pitch), and drive the hold with CDP touch events.

## How to resume

`cd ~/dev/flowstate-w6`. Run `PORT=4386 npx playwright test test/e2e/worlds.spec.ts -g "settles one cover at a time" --repeat-each 20 --workers 4`, then `npm test` and the two lints. Then correct `docs/WORLDS-HANDOFF.md`'s last paragraph, and start W6 from the notes above.

## Added scope since the first checkpoint

- Move a song to another world (Tommy, "sure, add it"): coordinator message of 2026-11-25; see the PR body when built.
- W7 asks: what `lineId` is, take ids as file names, the clip's real content type, written into docs/BRIDGE.md.
- Flake job: the shelf test still failed 2 of 40 after the touch fix, on "the one beside it is smaller and fainter" (side cover opacity read as 1). Being diagnosed.
