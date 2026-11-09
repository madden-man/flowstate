# FlowState: the motion pass

Tommy, 2026-11-09: "consider how to use animations to make the whole app scratch the itch: really feel good and satisfying when clicking buttons, tapping around. Also think about how we might use animations to make the flow diagrams more immersive and interesting: maybe particles flowing along in a steady stream, showing different velocities depending on the specific flow." Then: "specifically, I want there to be some kind of UI/UX feeling when an album is tapped in the music section, and any transitions going between pages is a plus too."

This is the plan every motion package is built and reviewed against. `DESIGN.md` is the standard; this pass added its rules 26 to 31 and amended 15, 18 and 19. Where this plan and `DESIGN.md` disagree, `DESIGN.md` wins and the plan is wrong.

## 1. What "satisfying" means here

The app is calm on purpose (rule 18: never a bounce or spring; rule 15: no confetti). So the satisfaction cannot come from things that wobble or celebrate. It comes from five things, each a rule now:

| | Rule | What the thumb feels |
|---|---|---|
| 1 | **Press** (26): down is instant, up is eased | The page answers the touch itself, not the click 100ms later. This one change does most of the work. |
| 2 | **Drawn, not shown** (27) | A check, a ring, a mark appears the way a pen would make it. |
| 3 | **The same thing stays the same thing** (28) | What I tapped travels to where it now lives. |
| 4 | **The paper stays, the ink turns** (29) | Pages change like a notebook, not like an app. |
| 5 | **The stream** (30) | A flow's drawing is alive, and its pace tells the truth about each step. |

And one guard: **motion answers, it never asks** (31). Every animation starts from a touch or the sky, runs once and ends still. Nothing delays a tap. Still slows all of it (its tokens already do) and Reduce Motion stops all of it.

Pairing: where a tick or a bell already fires (rules 19 and 21), the motion lands with it. One new tick: `album`, a cover chosen.

## 2. What is already in main (M0, this PR)

- Tokens in `design/tokens.css` and `src/ui/tokens.css`: `--t-draw`, `--t-hold`, `--t-orbit`, `--ease-settle`, `--press`, `--stream` (per light, zero under Reduce Motion).
- `src/ui/parts/Press.ts`: `startPress()` runs once from `main.tsx` and puts `data-down` on the pressed control (`button, a, [role=button], [role=checkbox], [data-press]`). Packages only write CSS for `[data-down]`.
- `src/ui/parts/Turn.ts`: `turn(kind, update, { vars, ready })` runs one named view transition (`html[data-turn="kind"]`), or just runs `update` where there is none. `canTurn()` says which.
- `TickName` has `album`.
- `src/ui/parts/parts.css` ends with one empty section per package (M1 to M5). **A package writes its CSS only inside its own section**, so five packages merge without conflicts. `design/parts.css` is a copy (`npm run tokens:check`).
- Reference code, written to be lifted: `design/motion/motion.css` (the CSS for every package, as designed) and `design/motion/src/stream.ts` (the stream engine). They are a first draft, not a contract: fix what is wrong with them.

## 3. Packages

All five build from main in parallel. Each: its own worktree and branch, `npm test` green, `PORT=42xx npm run e2e` green, both lints PASS, all three lights checked, Reduce Motion checked, a PR against main with the PASS lines in its body.

### M1. Press and drawn marks (`motion-m1-press`, port 4211)

Every control gives under the thumb, and marks are drawn.

1. **Press states**, in the M1 section, for every pressable part except the music sheet's (M3): `.fs-key` (the seam fills, the digit sits 1px down), `.fs-word`, `.fs-tab` (ink colour, 1px down), `.fs-chip`, `.fs-opt`, rows (`.fs-row`, `.fs-list-row`, `.fs-crow`, `.fs-link`, `.fl-flow`, `.fs-dichotomy`: a 6% ink wash that eases out over `--t-page`), `.fs-moon` (the moon gives), `.fs-new`, `.fs-addgoal`, `.fl-mid.holdable`, `.fl-shape`, the step words on a drawing (`.fs-cycle-word`). Going down: `transition: none`. Coming back: `--t-ui`. Remove the old `:active` rules these replace. Walk every screen and sheet; nothing tappable is left dead.
2. **The check**: the box gives (`scale: .86`) while down; the ink draws over `--t-draw` and lands heavy, lifting light (`fs-pen` in the reference); unchecking lifts over `--t-ui`.
3. **The PIN**: a dot fills like a blot (`fs-blot`, `--ease-settle`); delete empties the last one over `--t-ui`.
4. **The unlock**: on the right PIN the keypad and the words fade over `--t-ui`, the ring opens outward as a thin circle over `--t-light` (a non-scaling stroke, never a thick band) and the page is there under it. The bell and tick stay where they are. A wrong PIN: the dots empty right to left, one `--t-ui` apart; no shake. The cold-load breath (no PIN) is unchanged.
5. **The hold**: a long press fills. The lift (2px, the tile shadow) grows over `--t-hold` from the moment of touch instead of snapping on at the end, so the hold is felt building; letting go early drops it over `--t-ui`. `HOLD_MS` and `--t-hold` are the same 500ms: assert it in a unit test.
6. `test/e2e/reduced-motion.spec.ts` covers the new marks.

Not M1: tabs' mark (M2), tiles and playlists (M3), the moon's light change (M4).

### M2. Turns (`motion-m2-turns`, port 4212)

Going between pages.

1. **The mark under the tab**: one drawn ink stroke under the current tab word (and under the ?), which slides to the tapped tab over `--t-page` with `--ease-settle`. It is placed without animation on first render and on resize. The tab bar itself never moves.
2. **Tab to tab**: the ink turns toward the side the new tab is on (`TABS` order), about 18px, out over `--t-ui` and in over `--t-page`. The header's left words (moon, Settings, ♪), the rules and the tab bar stay where they are; the header's right side cross-fades. Use `parts/Turn` with `view-transition-name`s so only the ink is animated; the route changes at once and nothing waits on the turn.
3. **A row into its page, and back** (`open` and `close` turns): the Flow list to a flow's page, where the row's small drawing travels and grows into the page's drawing and the flow's name travels to the header (set the `view-transition-name` on the tapped row only); Pages to a page; Questions to a question; a council row to its council. Back (the header word, a swipe, the browser's back) is the same turn reversed. Pages that read from the database before they can draw pass `ready` so the turn does not show an empty page.
4. **Be**: a row opening its spread grows down from the row over `--t-page` (rule 11's "measure after display" still holds: lay out, then reveal), and closes the same way.
5. No turn on first load, on a deep link, on an import's re-read (`dataVersion`), or when the lock comes down. A second tap during a turn skips it and goes.
6. e2e: every route still works with `startViewTransition` deleted; Reduce Motion: no turn runs.

### M3. Music (`motion-m3-music`, port 4213)

The album tap is the centre of this package: Tommy asked for it by name.

1. **An album tapped** (`MusicSheet.tsx` Tile):
   - *Down*: the cover gives (`scale(var(--press))`, its shadow gone), at once.
   - *Up*: where the thumb was, a soft ring goes out across the cover (`fs-tile-drop`); the other covers hush to 45% for one `--t-page` and come back; `tick('album')` beside the existing `bell('album')`, both inside the tap.
   - *When Spotify says it is playing* (`playing` becomes this album; not before: a refusal draws nothing and its note says why): a ring is drawn round the cover in one stroke over `--t-draw`, replacing today's outline, while the ring round the album that was playing is lifted; and a copy of the cover travels from the tile to the small cover beside the ♪ in the page header (`--ease-settle`, about `--t-page` plus `--t-ui`), where it lands (from 1.3 to 1, no overshoot). If the sheet hides the header, it travels to the sheet's top edge and fades there.
   - *While it plays*: a bead walks the ring once every `--t-orbit`. None in Still, none under Reduce Motion, and it stops when the sheet closes.
   - Tapping the album that is already playing: down, the drop, the bell and tick; no second flight.
2. **A playlist into its covers**: tapping a playlist row, the six covers of its strip travel to the first six places of the grid and the rest rise in row by row (30ms a row, eight rows at most, then all at once). "Playlists" (back) fades the grid and brings the list back; the strip does not need to travel home.
3. **The sheet under the thumb** (`parts/Sheet.tsx`, so every sheet gains it): the scrim's darkness follows the drag; a flick down (faster than about 0.5px/ms) puts the sheet away even short of the 80px line; let go short and slow, it settles back over `--t-page` with `--ease-settle`. Opening: the sheet rises as now, and on the music sheet the rows rise in behind it (30ms apart).
4. **The small cover by the ♪** lands whenever a new album is written onto the page, not only from a tap.
5. `test/ui/feel.test.ts`: `album` joins the tick table (`src/ui/music/`). `test/e2e/music.spec.ts`: a tapped tile gets its ring only once playing; a refusal draws none.

### M4. Still from the moon (`motion-m4-still`, port 4214)

1. **Into Still**: a tap on the moon runs `turn('still', ...)` with the moon's centre and the distance to the farthest corner as vars; the dark opens from the moon as a circle over `--t-light`. The colour transitions that normally cross-fade the light are off for the length of the turn (the circle is the change; both at once would smear). The settle tone and tick are unchanged and still inside the tap.
2. **Out of Still**: a tap on the ring runs `turn('wake', ...)`: Still closes back into the ring over `--t-light`. Rule 13 holds: leaving is silent.
3. Sunrise, sunset, and the Settings pin stay rule 12's one breath: no circle. The "Dim the page" helper on a flow's tip (the Still helper) opens the circle from the moon, as if the moon had been tapped.
4. Where there are no view transitions: today's cross-fade, unchanged.
5. `test/e2e/still.spec.ts` still passes untouched; add: the light is Still at once after the tap (the turn never delays the change), and Reduce Motion runs no turn.

### M5. The stream (`motion-m5-stream`, port 4215)

A flow's drawing runs like water. Start from `design/motion/src/stream.ts` (move it to `src/ui/parts/cycle/stream.ts`, split the pure parts from the DOM so they can be tested).

1. **The layer**: `parts/Stream`, an SVG behind `parts/Cycle` and above the ghost rings in `.fl-drawing`, same viewBox, `pointer-events: none`. The step marks and words sit above it. It knows no shape: it reads `Shape.at`, `slotT`, `restT`.
2. **Pace**: a number per step, 1 is a walk. `src/model/pace.ts` holds the seeded flows' paces by step id (the table in the reference, to be tuned), plus each flow's rest pace; a step with none is 1. Nothing is written to the database in this package, so the flows already seeded on his phone get their paces too. The motes move at the pace of the step they are passing, eased between steps; because the same motes pass every point, they thin where it is fast and pool where it is slow. A fast mote is a short streak, a slow one a dot.
3. **Each flow's own water** (what a shape may add, declared on the shape, `Shape.stream?`):
   - Panic, the ring: quick through The wave, pooling in Settling, thin on the dotted way back.
   - Depress, the valley: slow, and slow water hangs a little below the line; a few brighter motes take "one small thing" up.
   - Energize, the arc: quickening up to The tip, lifting off the line; most land, a few take the crash and come back.
   - Fight, the mountain: fast up the climb, slow down the long slope; "say it" runs longer and slower beside "leave".
   - What if, the curve: building up the climb, the fastest water in the app straight down the drop, then nearly still on the flat.
   - Replay, the coil: quicker with each turn inward, then calm along the exit.
   - 3 a.m., the clock: it moves in ticks, a second apart.
   - Shutdown, the stairs: quick off the first tread, nearly stopped on "frozen", picking up through the thaw.
   - Shame, the fork: "hide" and "hit back" carry a little water that fades out; the road back carries on.
   - A flow Tommy made: every step at 1 until he says otherwise (no editor in this package).
4. **Where I am**: at rest the whole stream shows, a little quieter. With the dot on a step, what is behind it fades to 20% and the water runs on from the dot. When the dot lands on a detent, a ring goes out from it (one, over twice `--t-page`) and the water near it is pushed on for a moment. The existing tick is unchanged.
5. **Hold the ring**: while a thumb holds the middle (`breath.held`), the stream gathers on the in-breath and lets go on the out-breath, and its calm falls a little with each breath (never below 45%), coming back slowly after the thumb lifts.
6. **Lights**: `--stream` scales speed and how many motes show (Day 1, Night .85, Still .4). Reduce Motion (`--stream: 0`): no stream at all. The list's small drawings do not run.
7. **Cost**: one `requestAnimationFrame` loop per open flow page, only while the drawing is on screen and the page is visible; at most about ninety lines; no layout read inside the frame (read `--stream` when the light changes, not every frame).
8. Limits: the fastest water (the drop on What if) stays near a hundred drawing units a second; nothing flashes, nothing strobes; the peak of a flow is quick but never frantic. This is the page he opens in a panic: if in doubt, slower.
9. Tests: the pace function (eased between detents, wraps on the ring, never below the floor), the steady-state fill (more motes where it is slow), Reduce Motion and Still in e2e, and that a flow page still works with the layer removed.

### M6. The walkthrough (after M1 to M5 are merged)

`design/motion/index.html`: twelve steps from the real components (the keys, a check, the tabs, a flow opening, the sheet, an album tapped, Still from the moon, the stream on Panic, each flow's pace, the dot, hold, Still and Reduce Motion), live, one sentence each, passing the artifact lint; published as the motion pass's artifact. `design/motion/motion.css` goes when the page runs on `parts.css`.

## 4. Review (every PR, before merge)

1. `npm test`, `PORT=42xx npm run e2e`, `node script/design-lint.mjs src design`: all green, PASS lines in the PR body.
2. Against this plan: every numbered item of the package is there, and nothing outside it.
3. Against `DESIGN.md`: tokens only (no duration, colour or easing literal, in CSS or in a JS `animate()` call: read the token); no bounce, spring or overshoot anywhere; rules 26 to 31; no new tick or bell beyond `album`.
4. Three lights, by screenshot. Still is slower and has less. Night is not brighter than before.
5. Reduce Motion: nothing moves and everything still works.
6. Nothing waits: the route, the check, the play request and the light change happen at the tap; the motion runs alongside.
7. Feel, frame by frame where a screenshot cannot tell: record the interaction (Playwright video or a burst of screenshots) and look for a snap, a flash, a double animation, or anything that reads as a celebration.

## 5. Open questions for Tommy

1. Paces are a first tuning by eye from the said lines. They want his hands on them; an editor for a step's pace is not in this plan.
2. The bead on the playing album: wanted, or is the drawn ring enough?
3. Should the list's small drawing run for the one flow with a live episode?
4. Keys on the PIN pad do not tick (rule 19 lists unlock only). A tick per key is one line if he wants it.
