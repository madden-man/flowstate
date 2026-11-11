# FlowState: the mountain (the Flow tab as seven stops on one stream)

Planned 2026-11-11 at Tommy's ask. Nothing here is built. The proposal walkthrough is `design/mountain/index.html` (a live mock: the meter and the gates drag, the water answers).

His words: "rather than being in a list, i want the top seven flows to be chakras along a stream... a mountain with particles (a stream) running down it, along seven stops which are tappable... a depression meter for the overall mountain which controls how strong the flow of particles is, and then at each chakra i can control what % blockage there is, and see the particles flowing faster or slower based on that, to represent the way that energy gets lost when i'm depressed/anxious/etc. keep the steps and visualizations for each of the named flows, but instead of having an overview and a bunch of copy (which wasn't helpful), just show the diagram and any steps to take which might help unblock the chakra (including the shows/books/games/art)."

## 1. What changes, in one screen each

| Screen | Today | After |
|---|---|---|
| Flow tab (`ui/flow/Flow.tsx`) | A list: Right now, Meditate, nine flows, + flow | The mountain: a meter, one stream, seven stops, Energize in the sky, Meditate as the lake; a short list under it for what is not a stop |
| A flow's page (`ui/flow/FlowPage.tsx`) | Drawing, his line, the said paragraph, "Usually", wise lines, rows, last time, what helped, notes | Drawing, its gate, rows to do (the On row among them), safety print lines. Nothing to read |
| On sheet (`ui/flow/On.tsx`) | Albums, shows, films, Switch and phone games | The same, plus books and art |

Everything else stays: the nine drawings and their water (`parts/Cycle`, `parts/Stream`), the dot and episodes, hold the ring, the clock, ghost rings and stamps (they are drawings), hand-offs, the door, Right now, Meditate's page, Energize's page.

## 2. The seven stops

Water runs downhill, so the crown is the summit and the root is the foot. Each flow sits where the tradition puts its block (fear at the root, shame at the solar plexus, grief at the heart, and so on). This mapping is my proposal; question 1.

| Stop, summit to foot | Flow | Chakra | Blocked by | Hue (voice formula, rule 3) |
|---|---|---|---|---|
| 1 | 3 a.m. | Crown | the mind that will not let go | `--h-purple` 305 |
| 2 | Replay | Third eye | the story on repeat | `--h-indigo` 275 (new token) |
| 3 | Fight | Throat | what gets said, or cannot be | `--h-blue` 250 |
| 4 | Depress | Heart | grief | `--h-green` 150 |
| 5 | Shame | Solar plexus | shame | `--h-yellow` 95 |
| 6 | Shutdown | Sacral | going numb | `--h-orange` 55 |
| 7 | Panic | Root | fear | `--h-red` 25 |

The stop is a drawn ring in its hue on the stream, the flow's name in the hand beside it, on the outside of its bend. The chakra's word is not printed (he knows them; question 2). The stream is ink (rule 30); only the rings carry colour, and in Still they are ink too.

Where the rest go:

- **Energize** is the arc in the sky over the summit, its own small drawing (`cycle/arc.ts`), with its name. A tap opens its page, unchanged (the three fixations).
- **Meditate** is the lake at the foot: the stream ends in the circle (`CircleMark`). A tap opens the circle, and the lake travels into the page's circle (rule 28, the travel S1 left undone).
- **Right now, What if, any flow he made, + flow** are rows on the rules under the mountain, as they are today. What if is not one of the seven and keeps its row and its page.
- **The door** (the ring without the PIN) keeps its own list: the mountain shows what he set, so it stays behind the PIN.

## 3. The water

One model, pure and tested (`model/mountain.ts`), drawn by the engine the flows already use.

- **The meter** `d` from 0 to 1 is the whole mountain: the spring gives `s = 1 - 0.8 d`.
- **A gate** `b` from 0 to 1 at each stop lets through `p = 1 - 0.85 b`. Neither ever reaches zero: something always gets through.
- **What runs below stop i** is `q(i) = s × p(1) × ... × p(i)`. A gate high on the mountain starves everything below it; that is the picture he asked for (energy lost upstream is not there downstream).
- **What he sees in each stretch:** the share of motes showing is `0.15 + 0.85 q`, their pace `0.3 + 1.2 q` (fast water is a dash, slow a dot, as now), and the channel line under them is drawn `1 + 2.5 q` px wide, so the picture still says it with Reduce Motion on, when no mote runs.
- **Above a part-closed gate** the water pools: over the last 26 units it slows by up to `0.75 b` and spreads wider. The motes a gate turns back fade into the ground there. Nothing flashes: every share and pace is eased.
- **The lake** takes what arrives: its ripple goes out at a rate set by `q(7)`.
- **An open episode** puts the flow's dot on its stop with the halo, as the list's small drawing carried the dot.
- **Still** (rule 13, no states): no meter, no gates, no hues, no numbers; the names and the water in ink at `--stream` .4, every stretch the same.
- One `requestAnimationFrame` loop, only while on screen and visible, at most about 140 lines (the flows cap at ninety on a drawing a third the length).

## 4. The controls

- **Depression** is one drawn rule above the summit, the word in print at its left, the mark dragged like the lean slider (`parts/LeanSlider`'s hand). The water answers under the finger (rule 20) and the reading is written on release.
- **A gate** is a short rule under each stop's name with a mark on it: drag it sideways to close the gate. The drag is horizontal, so the page still scrolls. The ring fills with its hue as the gate closes, and the percent prints in grey at the rule's end while it is above zero ("70%"), in Day and Night only.
- **A tap** on a stop's ring or name opens its flow; the stop's ring travels to the page (rule 28).
- **The same gate** sits on the flow's page under the drawing, and the drawing's own water thins and slows with it (the step paces of `model/pace.ts` times the gate's `p`).
- Nothing moves a gate but his finger. Ticking a row does not open it; he says how blocked he is (question 4).
- A reading older than a day is drawn dashed until he touches it, so Monday's 70% does not pass for today's (question 5).
- Ticks (rule 19, amended): the mark landing on closed and on open, nothing between. No sound.

## 5. A flow's page, stripped

Top to bottom: the drawing with its water, dot and clock; the gate; the rows; the print safety lines; Edit.

**Rows.** With the dot on a step, or a step word tapped: that step's rows, as now (checks, helper words, the On row). At rest: one list of up to six, what he ticked in past episodes first (his own evidence, today's "What helped"), then the flow's On row, then seed order. The On row at rest gathers the picks of every step of the flow.

**Leaves the page (kept in the data, shown nowhere on it):** the flow's line and rest line, each step's said paragraph, "Usually", the words under the clock, wise lines, "Last time", "What helped" as a sentence, the note to the next one and its ask (question 3). The step sheet still edits rows; its said and usual fields go.

**Stays because it is safety, not copy:** the 988 line, the doctor lines, the hand-offs. 3 a.m.'s rest line (the doctor caution) moves to a print line on its first step, as Energize's did in X5.

**Right now** still reads his own step lines; it is the one place they show.

## 6. Books and art

`PickKind` gains `book` and `art`; both are written lines with their kind word, like a show. The On sheet keeps its rule (at most three covers and three lines; Still keeps covers only). No titles are seeded by me: every pick is his (rule 16), so until he names them the step sheet's pick editor (P2) is where they are written, and Shame, which has no picks at all, gets its first there (question 6).

## 7. Data

- New table `readings`: `{ id, at, of, value }`, `of` being `'mountain'` or a flow id, `value` 0 to 1, written on release, never edited. The newest per `of` is what the mountain draws; the history is kept for a later drawing and shown nowhere now.
- **Schema bump.** Main is schema 5. PLAN-VALUES.md (draft PR #59) also plans a bump to 6; whichever merges second takes 7 and rebases its migration. Never deploy a dist built from an older tree.
- `settings.stops`: the seven flow ids in order, so a stop can be swapped without a migration.
- `PickKind` widens in place (no migration).
- Backup and merge import carry `readings` like `sits`.

## 8. DESIGN.md

- New rule 33, **the mountain**: the Flow tab is one drawing; seven rings in the chakra hues by the voice formula; the water ink; what the meter and gates do; Still shows names and ink only.
- Rule 15: a gate's percent is a state he sets, not a count of anything; it prints only beside its mark and leaves in Still.
- Rule 19: the gate's two end ticks. Rule 30: the mountain's water, and a flow's water times its gate.
- Rule 7 holds: no new icon; the stops are rings, the arc and the circle are the flows' own drawings.
- `tokens.css`: `--h-indigo` (the mountain's third eye).

## 9. Packages

| | Package | Holds | After |
|---|---|---|---|
| R0 | Data and maths | `readings`, schema bump, `settings.stops`, `model/mountain.ts` (`q`, shares, paces) with tests, `PickKind` book and art | |
| R1 | The mountain | `cycle/river.ts` (the long shape), `Stream` reading shares, `ui/flow/Mountain.tsx` in place of the list, stops tap through with travel, the arc and the lake, the rows under it, Still | R0 |
| R2 | The meter and the gates | both controls on the mountain, writes on release, dashed when stale, ticks, Reduce Motion | R1 |
| R3 | The page, stripped | section 5; the gate on the page and the drawing's water times it; the rest list; the On row at rest; 3 a.m.'s print line; step sheet fields | R0, beside R1 |
| R4 | Books and art | the On sheet's two kinds, the pick editor | R0 |
| R5 | Walkthrough and standard | `design/mountain` rebuilt from the real app, DESIGN.md rules, the old flows walkthroughs marked as history | all |

Each PR: `npm test`, `PORT=42xx npm run e2e`, both lints, three-light screenshots, review against this file and DESIGN.md.

## 10. Open questions

1. **The order.** Mine is by what blocks each chakra (section 2). His list read panic, depress, fight, replay, shutdown, shame, 3 a.m.; if that was root to crown, it is a one-line change in `settings.stops`.
2. **Chakra words.** Print "Root", "Heart" under the names, or the flow names alone (my default)?
3. **His own words.** The step lines and the notes to the next one are his, not the page's. They leave the page with the rest by default; say if they should stay.
4. **Should a ticked row ease the gate?** Default no.
5. **Stale readings.** Dashed after a day (default), or left as set?
6. **Books and art.** Which titles, and for which stops? Shame and Shutdown's "Far away" have nothing to put on yet.
7. **The meter's word.** "Depression" (his), with no words at the ends. A number beside it, or the mark alone (default)?
8. **What if.** A row under the mountain (default), or should it take a stop?

## 11. Only the iPhone can say

Whether a sideways drag on a gate fights Safari's back swipe near the left edge (the left-hand stops sit inside the gutter to avoid it); the frame rate of about 140 moving lines in Night; the two ticks under a dragging thumb.
