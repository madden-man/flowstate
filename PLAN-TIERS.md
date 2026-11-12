# FlowState Be: values in tiers (First, Second, Third, Legacy)

Date: 2026-11-12. Status: plan, not built. Packages are B0 to B3 (B for Be). Tommy's ask: "make a plan for how the values in 'be' can be grouped into tiers: first, second, third, and 'legacy' (values i used to hold). it should be easy to drag and drop between these tiers, and consider if there is any other ui/ux enhancement to add as well."

`PLAN.md` stays the architecture, `DESIGN.md` the standard, `PLAN-VALUES.md` the Be this builds on. The walkthrough is `design/tiers/index.html`: nine steps, drawn from `tokens.css` and `parts.css` with example data. B3 rebuilds it from the real app, as `design/values/` is.

## 1. What is there today (main eefe2be)

- **Be is one flat list of held values**, in his order, under "I determine my core." (`ui/be/Be.tsx`). A value is `held` or `resting`; resting ones sit behind the word "Resting" at the foot.
- **A long press lifts a row** and it rides under the finger (`useLongPress`, `--t-hold`), but only among rows of its own kind: held among held, resting among resting. Held to Resting is a trip into the value sheet (Edit, Status, Done).
- **The drag has three limits** that tiers would hit at once: the page does not scroll while a row is lifted (`touchmove` is held), open values stay open under the lifted row, and there is nowhere to drop into an empty group.
- **Order is one number** (`Value.order`, clear), written by `moveValue`. `held()` feeds the Champions segment, "Who sits?" and the Spoke for chips.
- **Still** shows every held word and nothing else.

## 2. Decisions and assumptions

Each is my default, his to overturn (section 8 lists the ones worth a look).

1. **Three tiers of held values, and Legacy.** First, Second and Third are all held: they have champions, councils and Spoke for chips. Legacy is "values I used to hold": kept, dated, out of the council's way.
2. **Legacy takes Resting's place.** One shelf below the held values, not two. Everything resting today reads as Legacy with no data change (section 4).
3. **Today's held values start in Second.** Nothing is ranked for him. First and Third open empty, each with a dashed landing rule (rule 11's mark for something owed), so the first thing to do is carry what comes first up.
4. **First holds three.** A fourth carried in is never refused: the last of First steps down to the head of Second, and he sees it step while he is still holding. Second and Third hold any number.
5. **The tier is said by the heading and the size of the word**, never by a number, a colour or a badge (rule 15). First at `--fs-manifesto`, Second at `--fs-title`, Third at `--fs-ink`. No new token.
6. **Long press stays the lift** (rule 8). What changes is everything after it.
7. **A new value lands at the foot of Second.** The value sheet loses its Status row and is words only.
8. **A shadow has no tier of its own**; it goes where its value goes.

## 3. The shape (one line per walkthrough step)

1. **My values start in the middle.** The list after the update: FIRST over a dashed rule, SECOND over today's values, THIRD over a dashed rule, the word Legacy.
2. **Hold one to lift it.** The lifted row; every open value has folded; each tier shows its landing rule and Legacy has opened one.
3. **Carry it over a heading.** The row above SECOND's heading, under FIRST: a tick as it crosses, another as it lands.
4. **The order they matter in.** The sorted list: three sizes of word, champions' rules beside each.
5. **First holds three.** A fourth carried into First; its last value has stepped down to the head of Second.
6. **Or tap where it belongs.** An open value: "First · Second · Third · Legacy" under its looks line, the one it is in pressed, and "First since 11 / 12 / 26".
7. **Let one go.** A row carried to the foot and held over Legacy's landing rule.
8. **Legacy keeps what I used to hold.** Legacy open: the words in print grey, each with the dates it was held; any of them lifts and comes back.
9. **In Still, only what comes first.** The core line and First's words.

## 4. Data (no schema bump; main stays at 7)

```ts
export type Tier = 1 | 2 | 3;
// on Value, both clear (fields.ts), both optional, neither indexed
tier?: Tier;                                   // absent reads as 2; ignored while status is 'resting'
tierLog?: { at: Millis; to: Tier | 'legacy' }[];   // one entry a day at most, the day's last
```

- **`status` stays `'held' | 'resting'` in the store.** Legacy is the word on the screen for `resting`. No upgrade pass, no backup conversion, and no race with `acts-plan` (schema 8, unmerged). The code names it once: `export const LEGACY = 'resting'`.
- **No Dexie version**: the fields are optional and unindexed (`values: 'id'`). B0 checks that `db/backup.ts` carries unknown clear fields both ways; a version 7 file without them imports as all Second.
- **Order** stays one sequence across every value. The list sorts by status, then tier, then `order`.
- **`tierLog`** gives the two dated lines and nothing else: "First since 11 / 12 / 26" on an open value, "11 / 7 / 26 to 11 / 12 / 26" on a Legacy row. A value with no log shows its `createdAt` as the start and no end. Dates, never a length or a count (rule 15).

`model/values.ts`:

- `tiers(): Promise<{ first; second; third; legacy }>` for Be. `held()` stays, now in tier order, so Champions, "Who sits?" and the Spoke for chips follow without knowing about tiers. `resting()` becomes `legacy()`.
- `placeValue(id, to: Tier | 'legacy', index, now)`: one `store.tx` (every field it touches is clear): sets status and tier, appends to `tierLog`, renumbers `order` for the rows that moved, and when First would hold a fourth, moves its last to the head of Second in the same transaction. `FIRST_HOLDS = 3`. It replaces `moveValue`.
- `saveValue` drops its `status` argument.

## 5. The drag

The list becomes one run of slots: heading, rows, landing rule, for each tier, then Legacy. The geometry is a pure function (`ui/be/drag.ts`: slot rects and a pointer y in, `{ to, index }` out) so vitest covers it without a browser.

| What | How | Rule |
|---|---|---|
| Lift | Long press, as now. Every open value folds first, so each row is one height and the list is as short as it can be. | 8, 20 |
| Landing rules | While a row is lifted each tier ends in a dashed blank rule, and Legacy opens with one. An empty tier always has its rule, lifted or not. | 11 |
| Crossing | The row swaps past a heading as it does past a row. A new tick, `tier`, as it crosses. | 19 amended |
| Scroll | Within a thumb's height of the top or bottom edge the list scrolls under the lifted row, faster nearer the edge. | 20 |
| The step down | With First full, the row that will step down moves to the head of Second while he is still holding, and moves back if he carries on past. | 28 |
| Drop | `placeValue`, the `drop` tick, the word settles to its tier's size over `--t-ui`. A drop into Legacy leaves Legacy open. | 18, 19 |
| No drag | The four tier words on an open value (step 6): one tap, and the row travels to the foot of that tier through `parts/Turn`. This is also the keyboard and VoiceOver path. | 28 |

## 6. Other changes worth making with it

In the plan:

- **Fold on lift, scroll at the edges, landing rules** (above). These fix today's drag whether or not tiers ship.
- **The dated lines** from `tierLog`. Legacy is only "used to hold" if it says when.
- **Still shows First alone** (all held words, in tier order, when First is empty). "I determine my core" then has a core.
- **Champions, "Who sits?" and Spoke for chips in tier order**, Legacy left out of all three as Resting is today. Lines already spoken for a Legacy value keep their labels.
- **A Legacy row shows its dates where the champions' rules would be.** Its champions are kept, not drawn, and are back when it is.

Considered, left out:

- Numbers or ranks on rows, a colour per tier, a count beside a heading (rule 15).
- A pairwise "which matters more" sorter. It is the app asking; rule 31.
- An Undo word after a drop. The row is still on screen (Legacy stays open), and carrying it back is the undo.
- A swipe on a row to move it. Back is a swipe (rule 8).
- A cap on Second or Third.

## 7. Build packages (one PR each, PLAN.md section 10 rules)

| | Package | Holds | Needs |
|---|---|---|---|
| B0 | The model | `Tier`, `tierLog`, `tiers()`, `legacy()`, `placeValue` with the step down, `held()` in tier order, `saveValue` without status, backup round trip. Vitest only. | |
| B1 | The list | Headings, the three sizes, Legacy in Resting's place with its dated rows, the tier words and the "since" line on an open value, the sheet without Status, Still showing First. Dragging still works within a tier. | B0 |
| B2 | The drag | `ui/be/drag.ts`, fold on lift, landing rules, crossing a heading, edge scroll, the step down shown live, the `tier` tick. Playwright drives it with pointer events. | B1 |
| B3 | The rules and the walkthrough | DESIGN.md rules 11, 13, 19 and 20; `design/tiers/` rebuilt from the real app (the `design/values/` driver); `design/values/` steps 1, 2 and 11 redrawn; dead `moveValue` and Status code out. | B2 |

Tests: vitest for `placeValue` (every pair of tiers, the step down and its undo, same-day log collapse, a locked row, an import without tiers) and for `drag.ts`; Playwright for lift, cross, drop, the tap path and Still, in the three lights.

## 8. Open, for Tommy

1. **Legacy replaces Resting**, or both: a value put down for now, and a value that was me.
2. **First holds three**, or any number.
3. **Today's values start in Second**, or all in First to be carried down.
4. **Still shows First alone**, or every held word as now.
5. **Long press stays `--t-hold` (500ms)**, or a shorter hold on Be's rows only.
6. **A new value lands in Second**, or Third to earn its way up.

## 9. Only the iPhone can say

- Whether the list scrolls under a held thumb: iOS may not scroll a container while `touchmove` is prevented, in which case the scroll is driven by hand (`scrollTop` on a frame timer).
- The `tier` tick against the `drop` tick: two close together may read as one.
- Whether the step down out of First reads as his doing or the app's.
- Three sizes on a narrow screen with a long word and four champions' rules beside it.
