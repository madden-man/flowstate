# W8 handoff (deleted by W8's last commit)

Branch `worlds-w8` from `worlds-w6` at 714c2f2. Draft PR to `worlds-w6`. No deploy, no artifact published.

## Plan

One recorded chain, one set of example data (East Winds: Siyuan, Dawn Li, Sydney, 2071; the grey coat):

1. `node script/chain-desktops.mjs down`: Novel Companion and Music Companion, each a throwaway `cp -Rc` clone under the scratch dir, built there, run through their own Playwright Electron harness on the local test database. A bible "East Winds" is seeded with fixed ids, and Songbook with one Mac song; what each app publishes (registry rows and pockets) is saved to `test/fixtures/chain/down.json`.
2. `node script/snap-chain-phone.mjs`: the phone build against the real bridge handler (`netlify/lib/bridge.ts`) on the fake driver, seeded with that `down.json`. The phone's outbox sends; what the function stored in `bridge_up` and `bridge_clips` is saved to `test/fixtures/chain/up.json` (+ clips). The phone screens are captured in the same run.
3. `node script/chain-desktops.mjs screens`: the same apps again, the recorded documents written into their test `bridge_up`/`bridge_clips`, the window focused to pull, each screen captured as DOM with the app's CSS.
4. `node script/build-world-walkthroughs.mjs`: `design/wear-a-world.html` and `design/songs.html`.

## State

- Not started beyond this note.
- Coordinator: W6 is getting review fixes on the song page. Capture the Songs phone steps last, after `git merge origin/worlds-w6` once it moves past 714c2f2.
