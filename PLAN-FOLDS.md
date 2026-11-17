# FlowState Be: places that fold

Date: 2026-11-17. Status: built 2026-11-17, G0 to G3 on branch `be-folds-plan` (section 10 says where the build differs from this plan). Packages are G0 to G3. Tommy's ask: "look at the 'be' section tiers and make a plan to design them in a more interesting/cohesive way, also make each tier collapsible, and retain the ability to drag values from one tier to another. show me an artifact before we build."

`PLAN.md` stays the architecture, `DESIGN.md` the standard, `PLAN-TIERS.md` the list this redraws. The walkthrough is `design/folds/index.html`, ten steps, built from the real app (`npm run walkthrough:folds`, into `design/folds/dist`), on `design/tiers/`'s shell, seed and touch driver; the proposal's hand-drawn mock is gone.

## 1. What is there today (main 0236779)

- **Five places drawn two ways.** First, Second and Third are print headings over rows. Resting and Legacy are grey words that open. Only the shelves fold, and they look like links, not like the tiers above them.
- **The tiers barely differ.** The word's size is the only mark: 24px, 22px, 17px. First and Second read as the same. Every row takes two rules whatever its tier, so the list is long and even.
- **The headings look like the core line.** "I DETERMINE MY CORE.", "FIRST", "SECOND" are the same print at the same weight, one under another.
- **A tier cannot be put away.** With many values the list runs off the page, and a carry from Third to First crosses everything between.
- **A lift opens both shelves**, wanted or not, and the list jumps.

## 2. The design

One sentence: every place is a word and a pen stroke, and a tap on the word folds the place into one line of its own words.

1. **One heading for all five.** The place's word in print, then a stroke drawn out to the page's edge (rule 27). The five words keep one width, so every stroke starts on the same line down the page.
2. **The stroke's weight says the place.** First 3px, Second 2px, Third 1px, all ink; Resting 1px dashed and Legacy 1px dotted, both print grey. Dashed already means "owed, waiting" (rule 11); dotted is new and means "was".
3. **Size and room fall together.** First's word at 28px (`--fs-first`, the one new token) on two rules; Second at `--fs-title` on two rules; Third and the shelves at `--fs-ink` on one rule, as a dense index is (rule 5).
4. **Folded, a place is one line.** The stroke lifts and the place's words are written in its place, in list order, with a middle dot between, cut with an ellipsis. Never a count (rule 15). Folded places sit on consecutive rules, so all five folded are five lines: the whole of him on one screen.
5. **The fold is his and is kept.** `Settings.beFolded`. Resting and Legacy start folded (as today); the three tiers start open.
6. **Nothing else on the page changes.** The open value, the five words on it, champions, Said, the value sheet, Champions segment and Still are as built.

## 3. The shape (one line per walkthrough step)

1. **Five places, one drawing.** The sorted list: three strokes of falling weight, Resting and Legacy folded with their words.
2. **Tap a heading to fold it.** Second folded: "SECOND presence · patience".
3. **Fold them all to see the whole of me.** Five lines.
4. **Hold one to lift it.** A row lifted: open places end in a landing rule; a folded place's own line goes dashed.
5. **Carry it into an open tier.** The row riding between First's rows, at First's size.
6. **Or over a folded line.** The row over folded Second: its word, in italic, at the end of the run.
7. **It lands and the line stays folded.** Second's run one word longer; Third, now empty, keeps its dashed rule.
8. **Tap a word to open it.** An open value, the rest folded.
9. **Resting and Legacy fold the same way.** Both open: the dashed and dotted strokes, grey rows, Legacy's dates.
10. **In Still, only what comes first.** Unchanged.

## 4. Data (no schema bump)

```ts
// on Settings, clear, optional
beFolded?: Partial<Record<'1' | '2' | '3' | 'resting' | 'legacy', boolean>>;   // absent: tiers open, shelves folded
```

`Settings` is one clear row with optional fields already (`place`, `lock.digits`), so this needs no Dexie version. G0 checks that a backup carries it both ways and that a file without it imports as the default.

## 5. The fold and the drag

| What | How | Rule |
|---|---|---|
| Fold | The heading is a button (`aria-expanded`, a `--hit` tall target). The rows go through the existing `Fold` part over `--t-page`; the run is written over `--t-draw`; opening, the stroke is drawn over `--t-draw`. No tick, no sound: rule 19's list is not extended. | 26, 27 |
| Fold with a value open | The open value folds with its place and is shut when the place opens again. | |
| Lift | As today: long press, open values fold. New: **places keep their fold**. The shelves no longer spring open; a folded place's line turns dashed, the mark for somewhere to land. | 8, 11, 20 |
| Open place | `drag.ts` unchanged: `collapse`, `target`, `carry`, the `tier` tick on crossing. | 19 |
| Folded place | Two additions to `target`: a finger on a folded heading's line is in that place; and the gap under a folded heading is that place's foot (today it is the head). While it rides there the lifted row is the only row drawn under the heading, and its word shows in italic at the end of the run. | 20 |
| Drop | `placeValue(id, to, index)` and the `drop` tick, as today. A drop never changes a fold: on a folded line the row goes into the run. | 18 |
| Five words | A tap on one of the five words on an open value carries it to the foot of that place, as today, and opens that place if it was folded (the row is open and must be seen to land, rule 28). | 28 |
| Deep link | `#/be/:id` opens the place its value is in, for that visit, without writing `beFolded`. | |
| Empty places | An empty tier, open or folded, shows its heading; open, its dashed landing rule. An empty shelf shows only while a value is lifted, as today. | 11 |

Folding is also the answer to the long carry: fold what lies between and First and Third are two lines apart.

## 6. Code

- `ui/be/tiers.ts`: the `shelf` slot kind goes; `heading` takes any `ValuePlace` and a `folded` flag; `slots(t, folded, lifting)` emits, for a folded place, the heading alone (plus the lifted row when it rides there). `runOf(rows)` gives the folded line's words.
- `ui/be/drag.ts`: `Box` gains `folded?: boolean`; `target` takes the pointer's y for the finger test and the foot case. Pure, vitest as today.
- `ui/be/Be.tsx`: `shelf` state becomes `folded` read from `settings` and written through `saveSettings`; the heading button; the `Fold` part wraps a place's rows; the `setShelf(...true)` calls on drop go.
- `parts.css`: the proposal's stylesheet moves in (done; the proposal file is gone), replacing `.fs-be-tier` and `.fs-be-shelf`. `tokens.css` (both copies): `--fs-first: 28px`, with its comment.
- `DESIGN.md` rule 11 rewritten (the stroke and the fold join the heading and the size as what says the place; the shelves are headings); rule 20 (a lift keeps the folds); rule 13 unchanged.

## 7. Build packages (one PR each, PLAN.md section 10 rules)

| | Package | Holds | Needs |
|---|---|---|---|
| G0 | The kept fold | `Settings.beFolded`, its default, backup round trip. Vitest only. | |
| G1 | The drawing | The five headings and strokes, `--fs-first`, one-rule rows for Third and the shelves, the fold and its run, `slots` reworked, the five words opening a folded place, the deep link. Dragging still works among open places. | G0 |
| G2 | The drag | `target`'s two folded cases, the dashed folded line, the lifted row under a folded heading with its word in the run, no shelf springing open. Playwright with pointer events, as `test/e2e/be-drag.spec.ts`. | G1 |
| G3 | The rules and the walkthrough | DESIGN.md rules 11 and 20; `design/folds/` rebuilt from the real app (the `design/tiers/` driver) and `design/tiers/`, `design/values/` steps redrawn; dead shelf code out. | G2 |

Tests: vitest for `slots` (every fold combination, lifting or not), `runOf`, `target` (finger on a folded line, the foot under it, from above and from below) and the settings default; Playwright for fold, unfold, kept across a reload, carry onto a folded line, carry past one, the five words into a folded place, and Still, in the three lights.

## 8. Defaults taken, Tommy's to overturn

1. **First at 28px** needs a token. Without it First stays 24px and only the stroke and Third's one rule carry the difference.
2. **The stroke's weight as a mark.** Rule 11 says the tier is its heading and its size, "never a number, a colour, a badge". A stroke is none of those, but it is a third mark and the rule is rewritten to allow it.
3. **Third and shelf rows on one rule** (28px tall, under a `--hit`). Pages and councils already do this.
4. **No fold-all control.** Five taps fold everything. A tap on the core line could do it in one; left out as a hidden gesture.
5. **No tick on a fold.**
6. **A lift no longer opens the shelves.** To drop into the middle of Legacy, open Legacy first; onto its folded line lands at its foot.
7. **The folded run is at one size** (`--fs-ink`) for every place, grey for the shelves.

Considered, left out: a chevron or caret on the heading (rule 7: no new glyph; the stroke and the run say open and folded); a count beside a folded heading (rule 15); a colour per tier; springing a folded place open under a held row (the list would move under the finger); indenting the tiers as a stair (it spends width a long word needs).

## 9. Only the iPhone can say

- Whether a folded line under a held finger is easy to hit: it is one rule tall, and the lifted row sits just under it.
- The one-rule rows in Third: two neighbours' hit areas overlap.
- A long First word at 28px beside four champions' rules on a narrow screen.
- The fold over `--t-page` with eight or more rows: whether it reads as a fold or a jump.
- The three stroke weights in Night and Still's soft contrast (Still shows none of this, but Night must tell 3px from 2px).

## 10. As built (G3, 2026-11-17)

Where the build differs from the plan above:

- **A fade, not the Fold part.** The list stays one flat keyed run so the drag can swap a row past a heading, so a place's rows are not wrapped in `Fold`: opening, they fade in over `--t-page` (`.unfold`); folding, they go at once, as a lift folds an open value. The stroke and the run are drawn over `--t-draw` on the tapped heading only (`.drawn`).
- **The shelves' landing rule is at the foot.** Lifted, an open Resting or Legacy ends in its landing rule as the tiers do (it was at the head when a lift opened them); a folded one is its own line.
- **The long press.** `useLongPress` (`ui/council/state.ts`) forgets the click it would swallow on any new pointerdown, so a heading tap right after a drag is answered.
- **No rocking.** A row swaps past a heading exactly as past a row, at half the other's height each way, and a finger on a folded line (`fingerOn`) holds that place while the row is drawn under the line, so a still finger never sees the row rock between two places. `aim` puts the finger test and `target(boxes, top, feet)` together; `slots(t, folded, lifted)` takes the lifted id.
- **Held under its line.** A row riding in a folded place is held in its slot just under the line, whatever the finger's grab (G3: where the list could not scroll at the lift the row is put down from the finger and hung over the next line).
- **The walkthroughs.** `design/tiers/` is kept and updated (its shelf steps hold the row on Resting's and Legacy's folded lines, Legacy opens by its heading); `design/folds/` reuses its seed, clock, touch driver, `walk.js`, `walk.css` and build config.
