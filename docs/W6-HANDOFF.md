# W6 (Songs): handoff for whoever takes it over

Branch `worlds-w6` in `~/dev/flowstate-w6`, cut from `worlds-plan` (9be7b95, plus the WORLDS-HANDOFF docs commit merged in). Draft PR #112 against `worlds-plan`. Nothing is merged and nothing is deployed. Typecheck is clean (`npm run typecheck`) at the commit carrying this file.

## Every coordinator instruction, and where it stands

| Instruction | State |
|---|---|
| Shelf flake (`worlds.spec.ts` "settles one cover at a time"): find the cause, make it deterministic, prove it with `--repeat-each 20` | **Done**, commit bd6d5ed. 40 of 40 passed (that test and the new "nothing settles under a held finger", 20 each, 4 workers). The worlds, world-sections and flow-shelf specs: 17 passed. |
| A test for "no settle while a finger is on the shelf" | **Done**: `worlds.spec.ts` "nothing settles under a held finger: no tick, no lamp, no cover in front until the thumb lifts". |
| Correct WORLDS-HANDOFF's last paragraph (126 passed and 1 failed at 9be7b95; W5, W6 and W7 on draft PRs NovelCompanion #2, flowstate #112, MusicCompanion #1) | **Done**, cbd82db. The State table above that paragraph still says W5, W6 and W7 are "not started"; I did not touch it. |
| One shared database, `flowstate_bridge` (function, protocol constant, fake driver, tests, BRIDGE.md, PLAN-WORLDS sections 2 and 5, WORLDS-HANDOFF) | **Done and pushed**, cbd82db. CLAUDE.md rule 6 names no database, so it is unchanged. |
| Songs in full (the original brief) | **Built and tested**, apart from the gaps under "Not done". |
| Move a song between worlds | **Built and tested** (unit tests and e2e). |
| W7 questions: what `lineId` is, take ids as file names, the clip's content type | **Answered in BRIDGE.md.** `lineText` was added to the take row (up.ts allow-list) beside `lineId`. |
| W7's six points (lineId and lineText, id regex, content type, revs on a move, pocket titles with a date, pitch as MIDI with 0) | **Done**: fcc21d2 and eb7c55a, plus BRIDGE.md. |
| Lyric clock (`lyricAt`, `lyricFrom`) and the pocket's lyric | **Done**, d1dfdcc. `SongRow` and `PocketSong` are in protocol.ts; up.ts allows both fields. |
| `[Name]` section lines round trip | **Done**, ef34c1b. |
| The final full e2e with every change, and the PR body | **Not done**: see below. |

## Built, and the tests that cover it

- **The key finder.** Copied unchanged from MusicCompanion 5f6e05c into `src/model/keyfinder.ts` and `theory.ts`. `test/model/keyfinder/` holds its 30 known-answer tests, with fixtures made in memory (`fixtures.ts`, `gen-wav.ts`, `wav.ts`, `fft.ts`).
- **Pitch, key and tempo**, `src/model/pitch.ts` and `tempo.ts`. Covered by `test/songs/pitch.test.ts`:
  - "a sine at 220 Hz reads A3"
  - "a C major scale reads C major; G major reads G major"
  - "a tune that dwells on G, B flat and D reads G minor"
  - "absent when too little is sung, or on one note alone"
  - the tap tempo tests
- **The song model**, `src/model/songs.ts`: sections, `follow` (a take stays on its line), loose hums, `songList` tolerant of the pocket, `withLyric` and the `lyricAt` clock, `songFromPocket`, `fromMacLyric` and `toMacLyric`. Covered by `test/songs/songs.test.ts` (20 tests):
  - "what goes up: the song..., a pinned take and a loose hum"
  - "a clip goes only after its take's row is acknowledged"
  - "a newer pocket never overwrites an unsent edit..."
  - "opened from the pocket and sent up unedited, the row rebuilds to the Mac's text exactly"
- **The move**, `src/model/move.ts`. In this order: the destination written whole, checked, the source deleted, then the destination rewritten so its revs are newer than the deletes; `settleMoves` finishes a stopped move. Covered by `test/songs/move.test.ts` (7 tests):
  - "a stop between the halves leaves it in both, never neither"
  - "what goes up: deletes under the old world, rows under the new"
  - "Dawn Li is tucked..."
  - "carrying drains every world on the phone the registry knows, worn or not"
- **fields.ts.** `into(world)` writes to a world's notebook whether it is worn or not, with its outbox. Also new: `worldsOnPhone`, `handedWorld`, and a take's `lineText` sealed with its audio.
- **Bridge, phone side.**
  - net.ts `postClip` goes through the same single `fetcher`, as the fence test requires.
  - `src/bridge/clips.ts` sends a clip after its row is acknowledged, with rev = `take.at`, and marks it through `writeDown`.
  - `down.ts` `lyricsFrom` brings Songbook's pocket lyrics into songs the phone holds.
  - `carry.ts` `carryOthers` drains every registered world's outbox and clips, worn or not. This also closes the open item "the outbox drains only for the world worn".
- **UI** in `src/ui/songs/` (Songs.tsx, HumButton.tsx, Take.tsx, hum.ts, songs.css, plus `design/songs.css` kept equal by tokens:check):
  - routes in app.tsx, a world's only;
  - the Songs row in Flow.tsx;
  - `parts/Sound` `listen()` and `play()`;
  - a sentence in DESIGN.md rule 21;
  - Songs.tsx added to the sheet ticks in `test/ui/feel.test.ts`.
- **E2E**, `test/e2e/songs.spec.ts`: 5 tests, all passed at fcc21d2. They use CDP touches and a stubbed microphone (an oscillator playing a G minor tune):
  - a full song;
  - a cancelled hold;
  - a loose hum titled into a song;
  - Move to by touch on the sheet;
  - his own pages have no Songs.

  The Chromium clip type logged there was `audio/mp4`.
- **Walkthrough** `design/songs.html`: nine steps from `script/snap-songs.mjs`. artifact-lint PASS, 113 words. `SHOTS=<dir>` also writes PNGs of the live app. I looked at night, day and Still: the app is right. The walkthrough shell's night relight reads grey for these mocks, and for in-a-world's too; that is a shell quirk, not this screen.

## Written but not proven at the last commit

- **The last full e2e** (`PORT=4386 npm run e2e`, at 6e7b93b) gave **132 passed, 1 failed**. The failure was `worlds.spec.ts` "settles one cover at a time": its old expectation that East Winds has Research alone and Songbook has nothing. That expectation is updated in the commit carrying this file (`[/^Songs/, /^Research/]` and `[/^Songs/]`). The re-run was in progress when I stopped and **its result is not known**. check-dist did not run (it runs only after a green e2e).
- **songs.spec.ts after ef34c1b.** ef34c1b changed how section names are printed (every name, on any line). The e2e was not re-run after it.
- **`design/songs.html`** was snapped before d1dfdcc and ef34c1b. Its screens should look the same; re-snap anyway.
- **`npm test`** last passed at d1dfdcc with 1108 tests. ef34c1b ran only `test/songs` (36 passed) and typecheck.

## Not done

- The PR body. A draft is at `/private/tmp/claude-501/-Users-musicman-dev/affb8d52-a5a4-47e7-8dd6-d5f4ea089908/scratchpad/pr-body.md`; it may be gone after a reboot. It still needs the real e2e and unit numbers, the lint PASS lines, and lines for the lyric clock and the `[Name]` round trip. The PR's current body is the WIP checkpoint text.
- Deleting this file in the last commit, once the package is complete.
- The fresh reviewer.

## Decisions taken (Tommy may overturn)

- A section name is print on its own rule above the section, as the approved mock draws it; the plan says "in the margin".
- "New song" is a second row under Hum. An untitled song shows "No title yet".
- A take prints "G MINOR · 0:14". In Still the pitch line stands alone.
- Tapping a take plays it. Playback ignores the Sounds switch: it is his own voice, invited by the tap.
- Tap tempo sets the song's bpm, and each new take carries it.
- After Move to, the page returns to the old world's Songs list.
- A stopped move is finished when the destination world's Songs list is opened. It deletes the old copy even if it was edited in between; takes made there in between are carried over first.
- The recorder asks for `audio/mp4;codecs=mp4a.40.2` first.
- A pocket song with an unsent phone lyric edit is never overwritten. "Unsent" is read as: a phone `lyricAt` while the song still has an outbox entry.
- Songbook's pocket titles are shown without the work date.
- No schema version bump. All new fields are optional and unindexed:
  - `Song.lyricAt`, `lyricFrom`, `tucked` and `movedFrom`;
  - `Take.lineText` (sealed with the audio) and `clip`.

## Known shaky or wrong

- **Fast typing.** Typing straight after Enter can land in the old line before the new rule takes focus. The e2e waits for focus, and focus now moves in a layout effect, but a fast typist on a phone may still hit it.
- **Rule alignment.** Lyric lines under a take sit slightly off the rules (a take is two rules tall, but not exactly on the grid).
- **Chips row.** It overflows sideways on a phone ("72 BP" is cut), like the other chip rows.
- **The live pitch line** comes from a 4096-sample analyser window every 50 ms, under setInterval. It has not been heard against a real voice.
- **iOS audio session.** Not set to `play-and-record` while recording. Unverified on the iPhone.
- **Move and the pocket.** `songFor` does not filter restored characterIds against the destination's pocket (only the worn world's pocket is kept).
- **A novel's songs** do not take a pocket lyric: only Songbook's pocket carries songs.

## Only the iPhone can verify

- `MediaRecorder` and the microphone in the installed app, including whether it asks again on every open.
- That the recording is AAC in `audio/mp4`, a hum's real size, and that three minutes fits the 4 MiB clip limit.
- Holding a button with `touch-action: none` and pointer capture (no loupe, no selection).
- How well the pitch line and the key read a real hum.
- Playback with the ringer switch off.

## To resume

```
cd ~/dev/flowstate-w6
npm test && node script/design-lint.mjs src design
PORT=4386 npm run e2e
npm run build && node script/snap-songs.mjs && node ~/.claude/hooks/artifact-lint.mjs design/songs.html
node ~/.claude/hooks/artifact-lint.mjs design/walkthrough.html
```

Then write the PR body with real numbers and delete this file in the last commit. Stage by name. Never deploy, never merge.
