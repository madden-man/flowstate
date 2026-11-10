# FlowState Energize: three fixations and a deck

Date: 2026-11-10. Status: building from main 686787f with Opus agents (Tommy, 2026-11-10: "build with opus agents"); section 7's unanswered questions are built on their stated assumptions. Packages are X1 to X6 (X for fixation: E is the eyes plan's letter). Tommy's ask: "make a plan to rework the energize flow. keep the diagram with the particle animation, but everything below should change to be focused on my latest fixations: FlowState being one, East Winds being another (my book), and Japan Trip being the third. Then, set it up so that I can click any of those and replace it with a fixation that's 'on deck' (there will be a ton..jazz piano, conduit, learning chinese, studying philosophy, etc). this will give us tracking as to what fixations stick around, and also help me to find new things to do when i get bored of something. make it all very fun and energetic, since i want this to inspire me and get me going."

`PLAN.md` stays the architecture, `PLAN-FLOWS.md` the Flow tab, `PLAN-MOTION.md` how things move. The proposal walkthrough is `design/energize/index.html`: nine phones, the first four live (tap a card, tap a deck row, Deal me one).

## 1. What is there today (main a63e37b)

- **Energize** is one of nine seeded flows (`src/db/seed/energize.ts`): the landing arc (`parts/cycle/arc.ts`) with five steps (Spark, Build, Locked in, The tip, Landing or the crash), a dot that is dragged to start an episode, and the stream behind it (`parts/Stream`, paces in `model/pace.ts`, DESIGN.md rule 30).
- **Below the drawing at rest**: the flow's `restLine` ("Highs most days for a week without needing sleep: talk to your doctor."), "Last time", "What helped", carried notes, "+ step".
- **Below the drawing on a step**: the said paragraph, "Usually", and the tip rows (a timer at Locked in, the landing rows at The tip and Landing, a hand-off to Depress).
- **The picks** (PLAN-PICKS.md 3.3, merged as PR #50, main 686787f): two "on" rows on Energize, at Locked in and Landing. They sit on tip rows, so section 2's choice to keep the step rows keeps them.
- Nothing in the app knows what Tommy is working on. The page is about the shape of a high, not what the high is for.

## 2. Decisions and assumptions

Decided by Tommy (2026-11-10): the drawing and its stream stay; everything below becomes his fixations; the first three are FlowState, East Winds and Japan Trip; a tap on one replaces it from a deck; the deck starts with jazz piano, Conduit, learning Chinese and studying philosophy and will grow; what sticks is tracked; the page should be fun and energetic. Later the same day: no louder than this plan (no bounce, no confetti, no exception to rules 15 and 18), and the first three start on FlowState 11 / 7, Japan Trip 10 / 28, East Winds 8 / 20.

Assumed for the build, say so if wrong (each is one small change to overturn):

- **Three slots, always.** The page at rest is the arc and three cards. An emptied slot is a dashed slot (rule 11's own), not a shorter list.
- **A fixation is a name and a colour.** The colour is a hue angle, chosen on the voices' wheel (`parts/HueWheel`), so it follows the light the way a voice does (rule 3).
- **A tap opens the deck; a tap on a deck row is the swap.** No confirm step. The one taken off goes back on deck; "Finished instead" retires it (East Winds, the day the book is done). Nothing is ever deleted.
- **It works the other way too.** A tap on a deck chip on the page opens the same sheet asking which of the three it replaces.
- **Deal me one** is the answer to "bored, and no idea": the deck riffles and one row is lit. It is a suggestion; a tap takes it, another deal picks again. Random, never the one just taken off, never the last one dealt.
- **What sticks is a stint.** Each time a fixation is on, one `{ from, to }` is kept. The card says "Since 11 / 7 · 4 days"; the deck says "last on 10 / 22" or "never on"; **What stuck** draws every stint as a ribbon across the months, longest held first.
- **A span is not a streak.** It does not count days done, has no day to miss and nothing to break. It is a duration in words, like a flow's "last time", and it leaves in Still. Rule 15 gets one sentence saying so.
- **The step rows stay, the paragraphs go.** At rest the page is only the three. On a step (the dot is riding) the page shows the one fixation being ridden and then today's rows: the timer, the landing rows, the picks. The said and "Usually" paragraphs are dropped; the `usualShort` line already sits by the drawing. This is the one place the plan keeps something under the drawing, because the landing rows are the guard on a high. Question 1.
- **The doctor line moves to The tip.** It is a printed line under that step's rows, in every light, instead of on the rest page.
- **Spark it** ties the drawing to the three: the word on a fixation's sheet puts the dot on Spark and names the ride. The water runs in that one colour until the dot is back at rest. Dragging the dot without it still works and names nothing.
- **Next.** Each card may hold one line of his own: the next small step. It is the Spark row "One task, and its next small step" made into a place to write it. Never generated, never required.
- **Energetic means colour, size and speed, inside the standard.** See section 4. No bounce, no confetti, no badges: rules 15 and 18 hold. Decided: no louder.
- **Names are private.** Sealed like a flow's steps. Through the door without the PIN the page is the drawing alone.

## 3. The shape (one line per walkthrough step)

`design/energize/index.html`, nine steps, on `energize.css` and `energize.js` with copies of `tokens.css`, `parts.css`, `flows.css` and `flows.js`. The phones are built from the app's own rendered Energize page.

1. **Energize is what I am into right now.** The arc with three colours in the water; FlowState, East Winds, Japan Trip under it; the deck peeking as chips; "What stuck".
2. **I tap the one I am done with.** The sheet: its name, "Spark it", the deck rows, "Deal me one", "+ fixation", "Finished instead".
3. **Jazz piano takes its place.** The name lands in the slot, its stroke is drawn, a ring goes out on the arc, the water takes the new colour; Japan Trip is on deck.
4. **Bored, and no idea what is next.** Deal me one, at night: the rows riffle and one is lit.
5. **A new obsession goes on deck.** A name and the hue wheel.
6. **Spark it, and the arc is that one.** Locked in on East Winds: one colour in the water, the card with its Next line, then the timer row as today.
7. **What stuck.** Ribbons from August to now.
8. **The Flow list names the three.** Energize's meta line is the three names.
9. **In Still, only the names.**

## 4. Fun and energetic, against DESIGN.md

The standard was written for a page opened in a panic: slow, no counts, nothing asking for attention. This is the one page meant to wind him up, and Day is already defined as "an enormous amount of potential energy... wish to use it in all seriousness". So the plan turns up what the standard already has, and adds one rule (32) that says Energize is the page where it is turned up.

| Where the energy comes from | How | Rule |
|---|---|---|
| Colour | Each fixation's hue on its card (3px rule, wash at `--tint`, as a voice's line) and in one lane of the water. The only flow whose stream is not ink. | 3, 9; 30 amended |
| Size | Names at `--fs-manifesto`, the largest type in the app, each over a drawn stroke. | 5 |
| Speed | Energize's rest pace goes from 0.6 to 1.1 (`model/pace.ts`): the water is already moving when the page opens. | 30 |
| The swap | The deck row travels to the slot (`parts/Turn`, `--ease-settle`), the stroke draws over `--t-draw`, the stream's own landing ring goes out in the new colour and pushes the water on. | 27, 28, 30 |
| The deal | The deck rows arrive one after another over `--t-page`, a riffle, and one is lit. Runs once, from a tap. | 31 |
| Touch | One tick on a swap and one on a deal (`parts/Haptic`, two new sites). | 19 amended |
| Sound | A rising fifth on a swap, G to D, the two ends of the breath tone (`parts/Sound`), behind Sounds. | 21 amended |

What stays banned: bounce, spring and overshoot (18); confetti, badges, streak words (15, lint DL14); anything looping to draw the eye beyond the stream (31); generated text (16): every name and every Next line is his.

Rules touched: 13 (in Still the three are names only), 15 (a span is a duration, not a streak; the ribbons are a drawing), 19, 21, 30 (the hues; a ride runs in one), new 32 (Energize is the loud page, and what loud means). Tokens: none new expected.

## 5. Data (schema version 5)

- **`fixations`** (new table, index `id`): `{ id, name, hue, createdAt, stints: { from, to?, slot }[], next?, finishedAt?, sealed? }`. On = the last stint has no `to`. `name` and `next` are sealed in `fields.ts`; `hue`, the stints and the dates stay clear so the lock screen's door can draw nothing from them and the list can sort without the key.
- **`episodes`** gains optional `fixationId` (clear, an id): set by Spark it.
- **`model/fixations.ts`**: `three()`, `deck()` (longest waiting first), `swap(slot, id)` in one transaction, `finish(id)`, `add(name, hue)`, `deal(exclude)`, `spanWords(from, now)` (reusing `model/flows.ts` `spanWords`), `ribbons()`. `FIXATION_FLOW = 'energize'`: keyed by flow id in code, as `model/pace.ts` keys paces, so nothing is rewritten in the flow already on his phone.
- **Seed** (`seedFixationsOnce`, recorded in `settings.cleaned` as `'fixations'`): FlowState (blue), East Winds (green) and Japan Trip (red) on, from 2026-11-07, 2026-08-20 and 2026-10-28 (decided); Jazz piano, Conduit, Learning Chinese and Studying philosophy on deck.
- **`SCHEMA_VERSION` 5**, `TABLES` gains `fixations`, `backup.ts` exports and imports it; a version 4 file imports with none. The upgrade writes nothing (it cannot seal). After X1 merges, no dist built from an older tree may be deployed.
- The Energize flow row, its steps, tips, episodes and notes are not changed or deleted. The one write to it: the doctor line added once as a print tip on `energize-4`, and `restLine` cleared, in the same one-time pass.
- Routes: `#/flow/energize` (the three), `#/flow/energize/:step` (the ride), `#/flow/energize/stuck`, matched before `:step`.

## 6. Build packages (one PR each, PLAN.md section 10 rules)

| # | Package | Done when |
|---|---|---|
| X1 | Data | The table, schema 5, sealing, backup round trip, the seed pass, `model/fixations.ts` with unit tests for swap, finish, deal and spans across a month end. No UI. |
| X2 | The three | `ui/flow/Fixations.tsx` under the drawing at rest on Energize; the cards, the dashed slot, the deck chips; the stream's lanes take the three hues (`parts/Stream` and `cycle/stream.ts` gain a lane colour, ink everywhere else); rest pace 1.1; the Flow list meta line; Still; the door shows the drawing alone. Rules 30 and 32 written. |
| X3 | The deck | The sheet both ways, the swap with its travel, stroke, ring, tick and bell; "+ fixation" with the wheel; Deal me one; Finished instead; Edit (rename, recolour, the since date). Rules 19 and 21 amended. |
| X4 | What stuck | The ribbons page, months on the axis, longest held first, finished ones marked in print; nothing in Still. Rule 15's sentence. |
| X5 | Spark it | The sheet's word, `episodes.fixationId`, the one-colour ride, the Next line, the step page as section 2 says (one card, then the rows), the doctor line moved. |
| X6 | The walkthrough | `design/energize/index.html` rebuilt from the real components, the artifact republished. |

Order: X1, then X2 and X3 in parallel (X3 against X2's card markup), then X4 and X5 in parallel, then X6. Every PR: `npm test`, `npm run e2e`, three-lights screenshots, both lints PASS in the body, no em dashes.

iPhone-only checks: the tick on a swap; the fifth with the ringer on and off; the stream's three colours at night on the real screen; whether 1.1 at rest reads as lively or as nervous.

## 7. Open questions for Tommy

1. **The step rows.** Keep them under the ridden fixation on a step (assumed: they are the guard on a high, and the picks rows sit on them), or should every step be the three cards and nothing else?
2. **The doctor line** on The tip instead of the rest page: fine?
3. **Three slots**, fixed (assumed), or two to four?
4. Decided 2026-11-10: FlowState 11 / 7, Japan Trip 10 / 28, East Winds 8 / 20.
5. **The deck's first cards.** The four you named are seeded. From your folders I would add, on your word only: Semper Dulce, Novel Companion, Darts, Nala's Minions, the blog, Tommy's Shuffle, Woodshed, Light of Braxis. Which, and what else?
6. Decided 2026-11-10: no louder. Rules 15 and 18 hold on Energize as everywhere.
7. **The span in words** ("4 days", "12 weeks"): keep, or dates only if it starts to feel like a score?
8. **Deal me one**: plain random (assumed), or weighted toward the ones that have never been on?
9. **Finished**: one word for both "done" and "dropped for good", or two?

## 8. Artifact

`design/energize/index.html`, published 2026-11-10 as https://claude.ai/artifact/BB33Xy1uQpZDtmm82z8RLz (slug 52621571-c546-4fdf-b920-d160cd1b28ef), private until shared, from the seven files in `design/energize/`. Steps 1 to 4 are live. The stream in the phones is a small stand-in written for the page (`energize.js`), not `parts/Stream`; X6 replaces it with the real one.
