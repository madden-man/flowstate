# W6 (Songs): handoff

Branch `worlds-w6` from `worlds-plan` (9be7b95, plus the WORLDS-HANDOFF docs commit merged in). Draft PR against `worlds-plan`. Nothing deployed.

## Done

- **One shared database (Tommy, 2026-11-25):** the function reaches only `flowstate_bridge` (`BRIDGE_DB`) and its four collections; `novel_companion` and `music_companion` are unreachable through it. Tests, docs/BRIDGE.md, PLAN-WORLDS.md sections 2 and 5 and WORLDS-HANDOFF updated. Nothing on the phone changed.
- The key finder (`src/model/keyfinder.ts`, `theory.ts`) copied unchanged with its 30 known-answer tests (`test/model/keyfinder/`, fixtures made in memory). Committed.

- Nothing of Songs itself yet. Only reading and design notes so far (below).
- The flake job from the coordinator, `test/e2e/worlds.spec.ts` "the shelf slides under a thumb and settles one cover at a time" (126 passed, 1 failed on `worlds-plan` at 9be7b95), is fixed in code but **not yet proven** (see Half done).

## Done: the shelf flake (commit after cbd82db)

- Cause 1, the drag: CDP stamps each touch at dispatch; under load Chromium's velocity tracker read the lift as a fling the wrong way and the snap went back (a lift at 125 px of a 220 px step returned to the first cover; one at 244 px nearest East Winds returned to Songbook). Test fix: every touch carries its own timestamp 16 ms apart, and a slide rests 300 ms before it lifts (no fling), 160 px instead of 140; the wait is on the shelf's own `data-settled`.
- Cause 2, the read: "the one beside it is smaller and fainter" read the side cover's opacity while it was still easing into place as the page came up (it read 1). The test now polls the covers' computed look until they rest. Forcing the first placement with no transition was tried and changed which cover a W4 test opened on, so it was left as built.
- App fix: `Shelf.tsx` never settles under a held finger (a pause over 120 ms used to tick and light the lamp under the thumb). Fingers are heard on the document (a touch begun during a page turn lands on `<html>` and still slides the shelf), counting only touches begun on the shelf or the page itself. New e2e: "nothing settles under a held finger".
- Proof: `--repeat-each 20` on both tests, 4 workers: 40 passed. worlds, world-sections and flow-shelf specs: 17 passed. Before: 7 of 20 failed.

## Songs: built so far (committed, unit-tested; no e2e, walkthrough or screenshots yet)

- Model: `src/model/pitch.ts` (YIN, the stored line, the key guess over Music Companion's key finder), `tempo.ts` (Tap tempo), `songs.ts` (lines, sections named by chips, takes kept on their line, loose hums, the list tolerant of Songbook's pocket), `move.ts` (a song moved between worlds, safe to stop halfway; `settleMoves`).
- fields.ts: `into(world)` (a world's notebook written worn or not, with its outbox), `worldsOnPhone`, `handedWorld`; a take's `lineText` sealed with its audio.
- Bridge, phone side: `postClip` in net.ts (still the one fetcher), `src/bridge/clips.ts` (a clip after its row is acknowledged, rev = take.at, marked through writeDown). `carry.ts` drains every registered world on the phone, worn or not, and their clips.
- UI: `src/ui/songs/` (Songs list, song page, loose hums, Hold to hum with pointer capture, Move to sheet, Whose song sheet), routes in app.tsx (a world's only), Songs rows under a novel and Songbook in Flow.tsx; `parts/Sound` listen() and play(); DESIGN.md rule 21 sentence.
- Tests: test/songs (29), feel and shelf-dom updated. `npm test`: 1104 passed.

## Not started

- e2e (hold with CDP touches and a stubbed microphone, the move sheet, his notebook offering none), `design/songs.html` walkthrough from the real app, three-lights screenshots, docs/BRIDGE.md rules for W7 (lineId, ids as file names, content types, a song keeps its id for life), the full e2e run, the PR body.

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
