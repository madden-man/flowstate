# FlowState: the tasks become the water

Planned 2026-11-11 at Tommy's ask: "revamp each of the tasks in flowstate flows ... more cohesive with the chakras and more interactive with the energy flow, only showing buttons or info when there is a clear interactive thing in the app (music album, game, etc., which can be separated out) ... more immersive with the mountain animation/drawings."

Nothing is built. Walkthrough: `design/tasks/index.html` (nine steps, the seven real places with the proposed touches drawn over them), published private at https://claude.ai/artifact/8XBwpvXuXCWPKeWVo3XMJf.

## 1. What is wrong today

A stop's page is a drawing with a checklist under it. The plate at the top is the place on the mountain; under it sit a gate slider, step words and rows with checkboxes. The rows do not touch the drawing: a ticked row moves no water, and most rows are advice the app can do nothing about ("No alcohol tonight", "Keep the routine that worked"). Of about 115 seeded rows, about 45 carry a helper the app acts on. The picks (albums, shows, films, games) hang off single rows on fifteen steps.

## 2. The idea

1. **The place is the page.** The plate grows from 220 to about 350 and holds everything he touches. The paper under it keeps only what must be printed: the sign's one line, the gate, the shelf, the safety lines.
2. **A task is a touch on the water.** Seven touches, each one a helper the app already has, drawn where the stream runs through that place. No checkboxes on a stop's page.
3. **A row the app cannot act on leaves the page.** It stays in the data and in the step sheet, where he can give it a touch to bring it back.
4. **What to put on is its own shelf.** Covers and written lines on the bank under the place, one shelf per sign, not a row among the tasks.
5. **A touch moves the water.** Done, it sends a surge from the pool above the sign down the course, here and then on the mountain. It never writes the gate: that stays what he says is true.

## 3. The seven touches

| Touch | Helper today | What he does | Word on the plate |
|---|---|---|---|
| Breathe (Hold) | `ring` | a thumb held on the water; it slows on the out-breath, and each breath lets a pulse through | Breathe, or Hold on a pool |
| Dim | `still` | a tap on the lantern lowers it; the app enters Still | Dim |
| Name it | new `name`; `five` and `prediction` are forms of it | one rule appears on the water; his words are carried off, kept sealed on the episode | Name it, Reword, Five |
| Away | `timer`, new `away` | says when he is back; the place dims and the water pools until he returns | Away, Back at 7:40 |
| Reach | `person`, `calendar` (from the walk) | a bubble to a person, or one thing with a time into Calendar | Reach, Say it, One small thing |
| Sit | `sit` | follows the stream down to Meditate's circle | Sit |
| Write | `journal` | today's page, linked to the episode | Write |

Rules for all of them:

- A touch shows as one or two print words beside the water, never a sentence. Lit once done (live episode), drawn only at rest.
- At most four touches on a step. A step with none shows the place and the gate, nothing else.
- Away is the one home for things done off the phone (cold water, a window, tea, a shower, a walk). The dimmed place prints at most three of those words, his order. Nothing else off the phone shows.
- Wise lines (the italic second person) stay off the stop's page, as built in R3.
- The words he writes on the water are his; the app writes none (CLAUDE.md rule 6).

## 4. Each sign has its own material

One vocabulary, seven places. The same touch is drawn in what the place is made of, so the page reads as that part of him and not as a list.

| Sign | For | Old flow under it | Lead touch | What the place does in answer |
|---|---|---|---|---|
| Crown | letting go, sleep | 3 a.m. | Dim | the lantern lowers, Still spreads, snow lifts off the cornice as spindrift |
| Third eye | seeing clearly | Replay | Name it | the line drifts out over the ledge; the far ranges come clear |
| Throat | speech | Fight | Reach + Away as one ("Say it") | the bubble leaves; the fall holds at the lip until the return time, then drops |
| Heart | love and grief | Depress | Reach ("One small thing") | a stone lands in the tarn, rings go out, the reflection steadies |
| Solar plexus | will and worth | Shame | Name it, two rules ("Reword") | the struck verdict goes to the fire as embers; the deed stays written |
| Sacral | feeling | Shutdown | Hold | a ring out from the thumb on every out-breath |
| Root | feeling safe | Panic, What if | Breathe, Five | five stones across the stream; fireflies gather at the crossing |
| the sea | | Energize, Meditate | Sit, Spark it | unchanged circles; Energize's rows take the same touches on its own page |

At rest (no episode) a sign shows its lead touch only, so the place can be rehearsed calm. It writes nothing.

## 5. The water answers

- **Pool and surge.** R2's maths stands (`model/mountain.ts`). With the gate part shut, water pools above the sign. A touch done releases a share of the pool as one surge (about two seconds), then the pool fills again because the reading has not changed.
- **The gate asks without words.** After a surge the gate's handle goes dashed (the stale state R2 already has) until he sets it or leaves it.
- **Open gate.** No pool, so a touch sends one brighter head down the course.
- **On the mountain.** The first return to `#/flow` in the same unlock shows the surge travel from that sign to the sea, once (rule 31).
- **Steps are reaches.** The step in front is named once on the plate in print. Moving on runs the head to the next reach. (This sits on the step words line the mountain-fixes branch is adding; see section 9.)
- **Hand-offs follow the water.** "The Fight flow" is a small sign and its name; a tap travels to that sign's page (rule 28).
- **Still:** touches work, no hue, no pool, no surge, slow water. **Reduce Motion:** marks light at once, nothing travels.
- **Never:** a tally of touches, a streak, a reading written for him, sound he did not ask for.

## 6. The shelf

- One shelf per sign, under the gate: albums as wordless covers (a tap plays, as now), then shows, films, games, books and art as written lines with their kind.
- It gathers every pick on the sign's steps. With a step in front, that step's picks come first; last time's pick first among those (`lastOn`).
- No shelf where nothing is seeded (Solar plexus today).
- The On row, the On sheet and the ♪ row leave the task list. `episodes.on` and "what helped" keep working.
- Books and art (R4 of the mountain, never built) land here.

## 7. Every seeded row

Touch, Shelf, Printed (safety, stays in every light), Hand-off, or Off (leaves the page, kept in the step sheet).

**Root: Panic**

| Step | Row | Becomes |
|---|---|---|
| Overstimulated | Less coming in | Dim |
| | Earplugs, or one quiet album | Shelf |
| | Out longer than in | Breathe |
| | Cold water on your wrists and face | Away |
| | Name it: too much in, not danger | Name it |
| The wave | Breathe with the ring | Breathe |
| | Cold water on your face | Away |
| | Tense, then let go on the out-breath | Breathe |
| Settling | Five things you can see | Five |
| | Walk to a window; make tea; go back for a minute | Away |
| | Shake out your hands | Off |
| | One person, written when calm | Reach |
| Under the skin | Water, then food; a warm shower; a slow walk | Away |
| | An album, or the TV | Shelf |
| | Sit with the rain | Sit |
| | Write it down, later | Write |
| | If it stays heavy for days | Hand-off to Heart |

**Root: What if**

| Step | Row | Becomes |
|---|---|---|
| Something's coming | Write the worry as a prediction | Name it (a stone left to check) |
| | Put the worry off to a set time | Reach (Calendar) |
| What if | "What can I do, step by step?" | Name it |
| | Worry at the set time, then stop | Off |
| | Sit with the rain | Sit |
| Night before | Out longer than in | Breathe |
| | A film you know the ending of | Shelf |
| | Expect the feeling; same wake time | Off |
| | If it tips into panic | Hand-off (the other steps here) |
| The thing | One line: what's actually happening | Name it |
| It was fine | Mark it against the prediction | Name it (the stamp) |
| | The film you saved for after | Shelf |

**Sacral: Shutdown**

| Step | Row | Becomes |
|---|---|---|
| Too much | Name it: my body pulled a brake | Name it |
| Stuck | Feet on the floor; feel the chair | Hold |
| Far away | A trusted voice, or someone's eyes | Reach |
| | Slow the breath | Hold |
| Thawing | An album, or the TV | Shelf |
| | Rest, with nothing to finish | Off |

**Solar plexus: Shame**

| Step | Row | Becomes |
|---|---|---|
| Seen | Name it: shame | Name it |
| I'm worthless | Reword "I am bad" as "I did a bad thing" | Reword |
| | Talk the way you'd talk to a friend | Off |
| Hide or hit back | Notice the pull to hide or hit back | Off |
| | If it's hot | Hand-off to Throat |
| I did a thing | One specific repair | Reword (the second rule) |
| | Own it in short phrases | Off |

**Heart: Depress**

| Step | Row | Becomes |
|---|---|---|
| Sliding | One thing to look forward to on the calendar | Reach (Calendar) |
| | Same wake time; daylight early; no alcohol | Off |
| Pulling in | One small thing, with a time on it | Reach (Calendar) |
| | Message one person | Reach |
| | Smallest next step; out of bed; the small version | Off |
| Head won't stop | Ask how: what happened, one thing now | Name it |
| | Eight minutes of something absorbing | Shelf |
| | Write it down once, then one action | Write |
| | Talk to yourself as "you" | Off |
| The bottom | Music you choose | Shelf |
| | One tiny thing; eat, drink water | Away |
| | The 988 line | Printed, with Call and Text |
| A little light | A walk, any length | Shelf (one album is one walk) |
| | Say what lifted, on today's page | Write |
| | Do again what lifted you | Off |
| Climbing out | Keep putting good things on the calendar | Reach (Calendar) |
| | Keep the routine; go easy | Off |

**Throat: Fight**

| Step | Row | Becomes |
|---|---|---|
| Trigger | Name it: "I'm angry" | Name it |
| | The fact in one line, the story in another | Name it, two rules |
| | Swap "always"; is this the mood talking | Off |
| | If the heat shows up most days | Hand-off to Heart |
| Climb | Out longer than in | Breathe |
| | Cold water on your face | Away |
| | Check your pulse; stop, step back; break word | Off |
| Flooded | Say "I'm going, back at 7:40"; tell them | Say it (Reach + Away) |
| | Walk, music, a shower, slow breathing | Breathe |
| | One album: that's the twenty minutes | Shelf |
| | No texts, no venting, not yet | Off |
| Said it, or left | all three | Off |
| Cooling | If you catch the replay, distract on purpose | Shelf |
| | Write it later, from a distance | Write |
| | Look at it once from the side | Off |
| Repair | Between fights, the friendship | Shelf |
| | "Can I take that back?"; "I'm sorry" | Reach (the bubble holds his words) |

**Third eye: Replay**

| Step | Row | Becomes |
|---|---|---|
| That stung | Name it: this is the replay | Name it |
| Why did I | "How", not "why" | Name it |
| Heavier | Eight minutes of something absorbing; an album | Shelf |
| | Talk to yourself by your name | Off |
| How, not why | Write what happened, and what next time | Write |

**Crown: 3 a.m.**

| Step | Row | Becomes |
|---|---|---|
| Awake again; What time is it | Turn the clock away; leave it turned | Dim |
| Lying there | Out longer than in | Breathe |
| | Up after about twenty minutes | Away |
| Up | Something dull in dim light | Shelf |
| | Back to bed when sleepy | Off |
| Same alarm | both | Off |

**The sea: Energize** (its own page, same touches)

| Step | Row | Becomes |
|---|---|---|
| Locked in | A timer, 25 to 50 minutes | Away (the timer) |
| | Park new ideas on the page | Write |
| | One wordless record | Shelf |
| The tip | Out longer than in | Breathe |
| | Write the extra ideas down | Write |
| Landing | Sit with the rain | Sit |
| | Tomorrow's list at bedtime | Write |
| | Eat something; a walk | Away |
| | In the crash: something easy on | Shelf |
| | If the crash runs on for days | Hand-off to Heart |
| all steps | every other row | Off |

The doctor and hypomania lines (flow rest lines) stay printed where they are.

## 8. Data

- `TipHelper` gains `name`, `away` and `calendar`. `Tip.rules?: 1 | 2` for Name it's second rule.
- `model/acts.ts`: `actOf(tip)` (the touch, or none), `shownActs(step, still)` (at most four), `leadAct(chakra)`, `shelfOf(flows, frontStep)`.
- Episode: `names?: { tipId, lines: string[] }[]`, sealed like `lines` and `prediction`. No new index. The builder checks `db/fields.ts`: if the sealed list is versioned this is schema 8 (main is 7).
- One pass on an existing journal, `actsOnce` (a word in `settings.cleaned`, as the walk did): sets the new helpers on seed rows he has not rewritten. It strikes nothing and deletes nothing; a row with no touch is simply not drawn on the page.
- The step sheet lists every row. Rows with no touch sit under "Off the page"; each row gets a touch picker.
- The door (no PIN) keeps its own list: Breathe, Dim and Sit only, as now.

## 9. What this sits on, and what it replaces

- **mountain-fixes** (another session, uncommitted on 2026-11-11): the old flows' drawings leave the stop's page and the steps become a line of words. This plan builds on that page.
- **The walk (PR #61, open):** its strip of cards is replaced by the touches. Kept from it: the `calendar` helper, the Call and Text links under 988, its audit as a starting point. Closing #61 is Tommy's call.
- **Mountain R4 (books and art):** folded into the shelf.
- **PLAN-WEATHER.md:** unchanged. Its bead on a lantern for the playing album lands on the shelf's sign.

## 10. Packages

| | Package | Holds | After |
|---|---|---|---|
| T0 | Data and audit | the helpers, `model/acts.ts` with tests, the seed changes of section 7, `actsOnce`, `names` on the episode, the step sheet's touch picker | mountain-fixes |
| T1 | The place is the page | the taller plate and its seven scenes, the step in front on the plate, the paper foot, rows off the stop's page | T0 |
| T2 | Breathe, Dim, Sit, Write | the hold on the water (from `Clock`), the lantern lowering, travel to the sea, marks lit and drawn, the surge and the dashed gate | T1 |
| T3 | Name it, Away, Reach | the rule on the water in seven materials, Five as stones, Reword's strike, the pool until the return time, the bubble, Calendar | T2 |
| T4 | The shelf | per sign, books and art, the pick editor, the On row and sheet retired | T1, beside T2 |
| T5 | The sea, the door, the mountain | Energize's page on the same touches, Right now, the surge arriving on the mountain | T3 |
| T6 | Walkthrough and standard | `design/tasks` rebuilt from the real app, the DESIGN.md rule, the artifact republished | all |

## 11. Questions for Tommy, each with the default taken

1. Things done off the phone: one Away touch that prints at most three of them (default), or gone from the page entirely?
2. A touch moves water but never the gate (default), or should each one ease the gate a notch?
3. One shelf per sign (default). Should the sea also get a circle holding every pick?
4. The words he writes on the water: kept on the episode and shown on the linked journal page (default), or let go for good?
5. The lead touch per sign in section 4, and the Off rows in section 7: any he wants back?
6. Close the walk (PR #61) once T0 has taken what it needs?

## 12. Only the iPhone can say

A thumb held on a canvas against Safari's scroll and back swipe; the keyboard over a rule drawn on the plate; frame rate with a taller plate; whether print words on dark rock are easy to hit; the surge read as relief and not as a reward.
