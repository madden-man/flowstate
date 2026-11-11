# Build brief: the mountain

For the agent who builds it. Written 2026-11-11 from the planning session with Tommy. Nothing here is built yet.

## 1. The job

Turn FlowState's Flow tab from a list into one drawing: a mountain in pen and ink, a stream of motes running down it through seven signs to a sea, a Depression meter for the whole mountain, a gate at each sign, and a page per sign that shows how that part of him gets blocked and what unblocks it.

Read, in this order:

1. `CLAUDE.md` (the repo's eight rules) and `DESIGN.md` (the design standard; every rule is lint or review).
2. `PLAN-MOUNTAIN.md` (this branch). **Its pass 6 block overrides pass 5, and pass 5 overrides anything older in the file.** Pass 6 is the look: a night plate, the water as the only light, the arrival.
3. `design/mountain/` (this branch): `index.html` is the nine-step proposal walkthrough; `mountain.js` and `mountain.css` are a mock that runs. Open `design/mountain/index.html` from disk in a browser and drag the meter and the gates.

The mock is the reference for the geometry (the horn, the course, the stops, the signs) and the maths. It predates pass 6, so it is pen on a cream page: the look and the motion are pass 6's, not the mock's. It is plain JS written for a proposal; port its geometry and maths, not its code.

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
| R4 | Books and art | the two new kinds where picks are shown, the pick editor | R0 |
| R5 | Walkthrough and standard | `design/mountain` rebuilt from the real app (as `design/energize` is), DESIGN.md's new rule and the rule 7 amendment, the old flows walkthroughs marked as history | all |

## 5. Things that will bite

- **The walk is landing first.** Branch `walk` (worktree `~/dev/flowstate-walk`, PR open the same day) turns a step's rows into a strip of cards walked one at a time (`ui/flow/Tips.tsx`, `model/walk.ts`, DESIGN.md rule 33 there), puts what to do above what the page says, inlines the On picks on a card (`OnCard`, no On sheet any more), trims the seed tips (`db/seed/walk.ts`, pass `walkOnce`), and adds a short list of the flow at rest. R3 and R4 touch the same files: build them on main after `walk` merges, keep the cards, and number the mountain's DESIGN.md rule after the walk's. Plan section 6's "rows, as now" means the cards. Its "one list of up to six at rest" should start from the walk's short list (`shortList`), not a second mechanism.
- **Schema.** Main is schema 5. PLAN-VALUES.md (draft PR #59, worktrees `flowstate-c2`, `flowstate-c4`, `flowstate-values`) also plans 6. Whichever merges second rebases its migration. Never deploy a dist built from an older tree than the schema on Tommy's phone.
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

## 7. Still open (defaults are in the plan, section 11)

1. The pairing of drawings to stops, and what each stop is for.
2. Rainbow hues (default) or ink alone.
3. His own step lines and notes to the next one: leave the page with the copy (default) or stay.
4. Should a ticked row ease the gate (default no).
5. Stale readings dashed after a day (default) or left as set.
6. Books and art: which titles under which stop (none are seeded; every pick is his).
9. Which circles join Meditate and Energize in the sea.

Build to the defaults; list what you assumed in each PR body so Tommy can overturn it.

## 8. Only the iPhone can say

Whether a sideways drag on a gate fights Safari's back swipe near the left edge; the frame rate of about 150 moving lines over the inked land, at night especially; the two ticks under a dragging thumb; whether the swaying sea reads as calm or busy. Say in the PR that these were not checked.

## 9. How this build is run (2026-11-11 evening)

- Package PRs target `mountain-plan` (draft PR #60 becomes the build), not `main`. Nothing merges to `main` and nothing deploys until Tommy says so.
- R0 now also holds `parts/Sign` and the plate tokens, so R1 and R3 run side by side after it. R2 follows R1. R5 is last.
- `walk` has not merged (it is uncommitted work in `~/dev/flowstate-walk`, another session's). So R3 builds the stop's page as new files beside `FlowPage.tsx` and uses `Tips` through its existing props, touching the walk's files as little as it can; R4's sheet and pick editor wait for the walk. R0 still widens `PickKind`.
- The values build (`be-values-plan`) is taking schema 6 on its own branch at the same time. The mountain's bump is one small block in `schema.ts` so the second to reach `main` renumbers in one place.
- Ports for e2e: R0 4260, R1 4261, R2 4262, R3 4263, R5 4265.
