# Build brief: the mountain

For the agent who builds it. Written 2026-11-11 from the planning session with Tommy.

**Built (2026-11-11, on `mountain-plan`, not merged to `main`, not deployed):** R0 (PR #62), R1 (#64), R2 (#65), R3 (#63) and R5 (this walkthrough and the standard). **R4, books and art, was built 2026-11-12** on the tasks branch (`tasks-shelf`, a PR against `acts-plan`), where PLAN-TASKS.md section 8 put it: Book and Art are written lines on a sign's shelf, added through the small sheet the shelf's plus raises (`ui/flow/chakra/SignShelf.tsx`) and offered in the step sheet's pick editor (`LINE_KINDS`, `ui/flow/On.tsx`); nothing is seeded and the schema did not move. The walkthrough is `design/mountain/` (the real app; `npm run walkthrough:mountain`), the standard DESIGN.md rule 34.

## 1. The job

Turn FlowState's Flow tab from a list into one drawing: a mountain in pen and ink, a stream of motes running down it through seven signs to a sea, a Depression meter for the whole mountain, a gate at each sign, and a page per sign that shows how that part of him gets blocked and what unblocks it.

Read, in this order:

1. `CLAUDE.md` (the repo's eight rules) and `DESIGN.md` (the design standard; every rule is lint or review).
2. `PLAN-MOUNTAIN.md` (this branch). **Its pass 6 block overrides pass 5, and pass 5 overrides anything older in the file.** Pass 6 is the look: a night plate, the water as the only light, the arrival.
3. `design/mountain/`: since R5 the walkthrough of the built mountain, the real app in eleven steps. The proposal mock it replaced (pen on cream, plain JS) is in git history before R5; its geometry and maths live on in `parts/cycle/river.ts`, `parts/Sign` and `model/mountain.ts`.

## 2. What Tommy decided, in his words

| He said | So |
|---|---|
| "i want the top seven flows to be chakras along a stream... a mountain with particles (a stream) running down it, along seven stops which are tappable... a depression meter for the overall mountain which controls how strong the flow of particles is" | The Flow tab is the mountain. Meter `d` and a gate `b` per stop; maths in plan section 4 (`s = 1 - 0.8d`, `p = 1 - 0.85b`, cumulative downstream, pooling above a part-closed stop). |
| "instead of having the names of the flows, those diagrams should just be used to show how things get blocked" | A stop's page holds the old flows' drawings, unnamed. Pairing in plan section 6. |
| the overview and copy on a flow page "wasn't helpful" | Said paragraphs, "Usually", wise lines, "Last time" leave the page (kept in the data). Safety lines stay. |
| "make it go to an ocean, with a meditate circle in there... more mountainy/nature inspired" and "put energize also at the end, as part of the ocean - there may be more circles like that" | The stream ends in a sea that sways on the breath; Meditate and Energize float there as circles, with room for up to five. |
| "rather than using the hindu names, use the character + part of body/soul (heart chakra for instance)" | Names are Crown, Third eye, Throat, Heart, Solar plexus, Sacral, Root. "Heart" on the mountain, "Heart chakra" in the page header. Never a Sanskrit word. |
| of a sun on an arc in the sky: "what is this doing here" | No sun. Nothing in the drawing that stands for nothing. |
| "draw the mountain in a more dramatic and visceral way" | A horn in heavy ink with a face in shadow, crags, an arete, gullies, lesser horns behind, spindrift, a black treeline, sea cliffs. `land()` in the mock. |
| "make the stream a bit less symmetrical, think about what the chakras represent and fit them accordingly" | An uneven course; each stop placed by meaning (table below). |
| "i don't want it to be explicitly based on the hindu chakras, but i do want them to have cute symbols" | No lotuses, petals, element shapes, seed letters or "Meru" anywhere in the app. Seven small drawn signs. Plan section 2 is background reading only. |

## 3. The seven stops

Summit to foot. Hue is the voice formula's angle (DESIGN.md rule 3). Positions are in the mock's 328 by 476 box (`STOPS` in `mountain.js`).

| Stop | Sign | Hue | At | For | Where on the mountain, and why | Drawing under it (old flow) |
|---|---|---|---|---|---|---|
| Crown | crown | 305 | 172, 80 | letting go, sleep | just under the summit, in the snow the water starts as | the clock (3 a.m.) |
| Third eye | eye | 275 | 138, 112 | seeing clearly | a ledge out on the lit side, with a view | the coil (Replay) |
| Throat | speech bubble | 250 | 180, 152 | speech | tight against the arete, at the narrows where the water is loudest | the mountain with a fork (Fight) |
| Heart | heart | 150 | 112, 222 | love and grief | the long swing out to a tarn, where water rests | the valley (Depress) |
| Solar plexus | sun | 95 | 216, 272 | will and worth | the far flank, a fire kept on the side in shadow | the fork (Shame) |
| Sacral | drop | 55 | 148, 316 | feeling | a short drop to a pool low on the lit side | the stairs (Shutdown) |
| Root | sprout | 25 | 198, 360 | feeling safe | the foot, in the trees, where the mountain meets the ground | the ring (Panic) and the curve (What if) |

A sign is full of its colour when open; as its gate closes it empties to an outline and draws in to 70 percent. In Still every sign is open and print grey. The sign paths are `SIGNS` in the mock. They are drawn paths in the app's own code: no icon library, no emoji (DESIGN.md rule 7, lint DL7).

Energize, the ninth flow, is not a blockage: it is a circle in the sea beside Meditate.

## 4. Packages

From plan section 10, with pass 5 applied. One PR each, in a worktree of its own.

| | Package | Holds | After |
|---|---|---|---|
| R0 | Data and maths | `readings` table, `flows.chakra`, the schema bump, `model/mountain.ts` (the maths of section 4, with tests), `PickKind` gains `book` and `art` | |
| R1 | The mountain | `parts/Sign`, `cycle/river.ts` (the uneven course), the land in ink, the sea and its breath, the circles, `ui/flow/Mountain.tsx` in place of the list in `ui/flow/Flow.tsx`, taps with travel (rule 28), Still, night | R0 |
| R2 | The weather and the gates | the meter with snow and cloud, the gates and emptying signs, writes on release, dashed when stale, ticks, Reduce Motion | R1 |
| R3 | The stop's page | plan section 6: the large sign, the drawings grouped under it, names and copy gone, the rest list, routes `#/flow/c/:chakra`, hand-offs, the step sheet | R0, beside R1 |
| R4 | Books and art | the two new kinds where picks are shown, the pick editor (built 2026-11-12 on the sign's shelf, PLAN-TASKS.md section 4) | R0 |
| R5 | Walkthrough and standard | `design/mountain` rebuilt from the real app (as `design/energize` is), DESIGN.md's new rule and the rule 7 amendment, the old flows walkthroughs marked as history | all |

## 5. Things that will bite

- **The walk is landing first.** Branch `walk` (worktree `~/dev/flowstate-walk`, PR open the same day) turns a step's rows into a strip of cards walked one at a time (`ui/flow/Tips.tsx`, `model/walk.ts`, DESIGN.md rule 33 there), puts what to do above what the page says, inlines the On picks on a card (`OnCard`, no On sheet any more), trims the seed tips (`db/seed/walk.ts`, pass `walkOnce`), and adds a short list of the flow at rest. R3 and R4 touch the same files: build them on main after `walk` merges, keep the cards, and number the mountain's DESIGN.md rule after the walk's. Plan section 6's "rows, as now" means the cards. Its "one list of up to six at rest" should start from the walk's short list (`shortList`), not a second mechanism.
- **Schema.** The values build (PLAN-VALUES.md, PR #59) reached main first as schema 6, so the mountain is schema 7 (`MOUNTAIN_VERSION` in `src/db/schema.ts`, layered on the values' `STORES_V6`; renumbered when main was merged into this branch, 2026-11-11). Tommy's phone runs 6. Never deploy a dist built from an older tree than the schema on Tommy's phone.
- **Nothing on his phone is rewritten.** Flow rows, ids, steps, episodes and `#/flow/:id` routes stay; `flows.chakra` is added. The door, Right now and hand-offs must keep working.
- **Safety lines stay** on every page they are on: 988 (with its Call and Text links from the walk), the doctor lines, the hand-offs.
- **Still** (rule 13): no meter, no gates, no hues, no snow line, no numbers.
- **The door** (the ring without the PIN) keeps its own list; the mountain shows what he set, so it is behind the PIN.
- **No model-written text, no network outside `src/music/`, no modal dialogs, no em dashes** in anything written for Tommy. A gate's percent is a state he sets, not a count (rule 15).

## 6. How work is done here

- One worktree per package beside the main checkout (`~/dev/flowstate-<name>`), branched from `origin/main`, `node_modules` symlinked from `~/dev/flowstate/node_modules`. **Stage files by name; never `git add -A`** in a worktree (it once tracked the symlink and wiped the main checkout's packages).
- Before every commit and in every PR body: `npm test` (design lint, tokens check, vitest, typecheck), `PORT=42xx npm run e2e` (a port of your own, so parallel worktrees do not collide), `node script/design-lint.mjs src design`, and `node ~/.claude/hooks/artifact-lint.mjs` on any walkthrough page you touch. Paste the PASS lines.
- Every screen is reviewed in Day, Night and Still, with screenshots.
- Each package PR is reviewed against PLAN-MOUNTAIN.md and DESIGN.md, and its findings posted as a PR comment, before merge.
- Deploy only from `~/dev/flowstate` (the Netlify link lives there, untracked): `netlify deploy --prod --dir <dist>`, then `curl` the live bundle to confirm. A deploy run inside a worktree silently creates a stray site.
- The repo `madden-man/flowstate` is public. Merge and deploy when Tommy says to; he has not yet said so for the mountain.

## 7. Choices the builders made, for Tommy to overturn

Gathered from the four package PRs (#62 to #65) and their review rounds. Each is a default, not a decision.

1. The pairing of drawings to signs is section 6's (3 a.m. Crown, Replay Third eye, Fight Throat, Depress Heart, Shame Solar plexus, Shutdown Sacral, Panic and What if Root); Energize is a circle in the sea. Rainbow hues on the signs.
2. Readings are sealed under the PIN (`value`; `of` and `at` stay clear for the index), and the mountain is behind the PIN; the door keeps its own list.
3. His own step lines and the note to the next one leave the stop's page (they are kept, and Right now still reads his lines).
4. The 988 and doctor lines show at rest on a stop's page as well as on their step; hand-offs only on the step they leave from. A hand-off to a drawing on the same page reads "the drawing above" or "below".
5. Right and up shut every gate, on the mountain and on the page, so the same key shuts both; a gate whose name is to its right no longer shuts toward the stream (plan section 5).
6. A plain tap on a gate or the meter writes nothing; a reading is written once on release. A fully open gate rests as a faint dash. A reading older than a day is dashed until touched. A ticked row does not ease a gate.
7. Snow falls only while the meter rises, and for a 1.6 second settle after it (each flake lives 3.5 to 6 seconds, so the air is still within about 8); a heavy day already set, or opened at once, has none. The snow line comes down from 86 to 212 box units as the meter goes from clear to the heaviest, and mist gathers from its first touch. No number on the meter; a gate's grey percent while above zero.
8. A change travels at about 110 units a second, about 5.5 seconds from spring to sea; the arrival takes 4.2 seconds, once per unlock.
9. Meditate's "last sat" date and Energize's three names left the Flow tab (both on their own pages); an open Energize ride puts the dot on its circle.
10. Root's second drawing (What if) is folded small until tapped; whatever is in front, live or opened stays open.
11. The rest list drops near-identical rows and keeps one row per helper. The places on each stop's page, and all the weather, are the builders' drawings inside pass 6's list.
12. New tick names `meter` and `gate`, at the two ends only (rule 19). No sound on the mountain.
13. The plate's colours (R0): a deep indigo night by Day (`--plate` #0C0C22 under a `--plate-sky` of #06041A) and by Night (#060618), a cool-neutral near-black in Still (#07080B); the shadow face `--plate-deep` darker still; the water's light `--glow` a warm bone. The lanterns take their own lightness on the plate (`--plate-voice-l` 74%, `--plate-voice-c` .12), not the paper's.
14. By Day the plate is a print set inside the page's column (`--plate-inset` the gutter, no feather), the cream page round it; by Night and in Still it runs to the screen's edges and feathers into the page (36px). The box is the same size in every light, so nothing jumps at sunset (DESIGN.md rule 34).
15. The plate is rounded up to whole rules, so Right now and "+ flow" sit on the page's rules under it; the spare height is sky.
16. A shut gate's pool fills over about two seconds (0.45 a second), and a surge is what the pool held times how far it was opened. Under Reduce Motion nothing travels, pools or surges: the reading is drawn at once.
17. Each gate lies wholly under its sign's 44px link, never over it; the Crown's link is lifted over the Throat and the Root's over Energize's circle to make room, the lift given back as padding so the sign stays on its stop. A gate's touch target is 44px tall.
18. The rest list on a stop's page leaves out rows that mean something only on their own step or with a live episode (Journal, Timer, Person, Predict, Five), as well as near-duplicates.
19. The arrival's head, the kindling rings, the embers, fireflies and every place's weather are the builders' inventions inside pass 6's list. (2026-11-12, Tommy: the head, the surge fronts, the rings, the flares, the glints and the spring's pulse are gone; the water is one calm, continuous stream, DESIGN.md rule 34.)

A question for Tommy, not a regression: the What if drawing's seeded record ("didn't happen, nine in ten", with its faint checks) still shows in Still, as it has since F6; rule 15 hides only his own stamps there. Should "nine in ten" leave in Still as a count?

Still open with no default: which books and art go under which sign (none seeded; R4 is built, so he writes them from a shelf's plus), and which circles join Meditate and Energize in the sea.

## 8. Only the iPhone can say

None of these was checked on a phone: whether a sideways drag on a gate fights Safari's back swipe near the left edge; the frame rate with two full-plate canvases (one screen-blended, about 260 motes) under the plate's mask, at night and during a drag or the arrival; whether `@property` (the sign filling, the plate's feather) and CSS `round()` (the plate on whole rules) behave on his iOS; the `meter` and `gate` ticks under a dragging thumb; whether the compact gates are easy to catch; whether the swaying sea reads as calm or busy, the falling snow as snow and not stars, and the lanterns as bright enough at night; how the sign's travel into its page looks (headless screenshots do not capture view transitions).

## 9. How this build is run (2026-11-11 evening)

- Package PRs target `mountain-plan` (draft PR #60 becomes the build), not `main`. Nothing merges to `main` and nothing deploys until Tommy says so.
- R0 now also holds `parts/Sign` and the plate tokens, so R1 and R3 run side by side after it. R2 follows R1. R5 is last.
- `walk` has not merged (it is uncommitted work in `~/dev/flowstate-walk`, another session's). So R3 builds the stop's page as new files beside `FlowPage.tsx` and uses `Tips` through its existing props, touching the walk's files as little as it can; R4's sheet and pick editor wait for the walk (since built on the sign's shelf, 2026-11-12, once the tasks plan dropped the walk's card strip). R0 still widens `PickKind`.
- The values build (`be-values-plan`) took schema 6 and reached `main` first. The mountain's bump is one small block in `schema.ts`, so it was renumbered to 7 in one place when `main` was merged in.
- Ports for e2e: R0 4260, R1 4261, R2 4262, R3 4263, R5 4265.
