# FlowState Be: edit, delete, and a defined self

Date: 2026-11-10. Status: planned and built the same day (packages S1 to S4). Tommy's ask: "i want to be able to edit the words of paradoxes in the 'be' section and delete paradoxes entirely. same goes for the goals within that section. to make this more useful, we should be seeking ways to make this whole section highlight a well defined sense of self, so do some research on the best ui/ux experiences for identity formation and consider how exclusion could play a role."

`DESIGN.md` stays the standard and `PLAN.md` the architecture. This file records what Be does today, the research, what is built, what is refused, and the packages.

## 1. What is there today (read at main 82e899a)

- **Editing exists and hides.** A small "Edit" word in the corner of an open spread opens the paradox sheet; a tap on a goal opens the goal sheet. Nothing on the words themselves says they can be changed.
- **Nothing can be deleted.** A goal can only be archived, and no screen shows or restores an archived goal. A paradox can only be set resting or retired.
- **The aspect lines never show.** "What living this side looks like" is written in the sheet and read nowhere.
- **Be opens on a list of pairs.** It says what is being balanced. It does not say who is doing the balancing.
- **The shadow word is already exclusion.** "thoughtful (obsessive)" names the version of a pole he does not want to be.

## 2. The research, and what it rules in and out

Read 2026-11-10; citations checked at abstract level. S is well supported, M mixed, P popular with thin evidence.

| Finding | Strength | What it means here |
|---|---|---|
| Self-concept clarity is self-beliefs held confidently, consistently, stably; it goes with low rumination; curious reflection helps and threat-driven reflection hurts (Campbell 1996; Trapnell and Campbell 1999) | S | Few statements, in his words, that stay put. No evaluation of them. |
| Commitment is not enough: identity firms by identifying with a commitment and exploring it in depth; standing re-weighing of alternatives ("ruminative exploration") goes with weaker commitment (Crocetti, Rubini and Meeus 2008; Luyckx) | S | Depth on a few. Reconsidering is possible and never prompted. |
| Paradox mindset: accepting a tension, not resolving it (Miron-Spektor 2018) | S, workplace | The self line holds both poles. Nothing ranks one pole over the other. |
| A wanted self works best balanced by a feared self in the same domain (Oyserman and Markus 1990); distance from the undesired self predicts life satisfaction better than closeness to the ideal, and the undesired self is concrete (Ogilvie 1987) | S | Exclusion belongs beside a commitment, concrete, never alone. The shadow word already has this shape. |
| Values affirmation: writing why a value matters, in one's own words, lowers defensiveness (Cohen and Sherman 2014) | S | The self line is written by him, never suggested. |
| Card sorts narrow by discarding to a top five to ten (Miller 2001) | M | A small cap on what is held. |
| More facets is not better (Rafaeli-Mor and Steinberg 2002) | M | The same cap. |
| Avoidance goals ("avoid X") predict lower and falling wellbeing (Elliot, Sheldon and Church 1997) | S | A refusal is not a goal: no cadence, no check, nothing due. |
| Suppression rebounds (Wenzlaff and Wegner 2000) | S | Refusals are off the daily view: inside a folded spread, and gone in Still. |
| "Not" identities about people and groups drift to contempt (Zhong 2008) | S | The field asks for what he does not do. |
| Scores and streaks on identity statements (Fabulous, Atoms, Reflectly) | product read | Refused already by rule 15. |
| Creed pages and "manual of me": one page, first person, revised rarely | product read | The top of Be. |

**The rule taken from it:** exclusion helps when it is decided once, named concretely, attached to a positive commitment, about behaviour, and then out of sight.

## 3. What is built

### 3.1 Edit the words where they are

On an open spread the two pole words and the middle word are buttons: a tap opens the paradox sheet with the caret in that field. The "Edit" word stays. A goal already opens on a tap. Edits to the poles and the middle keep their struck revisions (rule 10).

### 3.2 Delete, entirely

- **A paradox.** The paradox sheet ends on a Delete row: a second tap on the same row within four seconds (rule 8, the council line's pattern). It removes the paradox, its goals, its leans and its refusals in one write, and any page's link to it. It is not kept anywhere. Resting and retired stay as the reversible ways to put one down.
- **Fixed on the way (2026-11-10).** A paradox now saves on its two words; the aspects may wait: the seeded thoughtful and reactive has no aspects, so every edit to it was silently dropped (`canSaveParadox`).
- **A goal.** The goal sheet's Archive becomes Delete, the same two taps. The goal is removed; its balance stays and shows its dashed slot again; a goal that followed it follows nothing. Goals archived before today stay archived and unseen (no screen ever showed them); a backup still carries them.

### 3.3 Who: the top of Be

Be opens on his own lines, one per held paradox, in the order of the list, in ink on the page's rules: the creed. Each line is a new optional field on the paradox, written in the paradox sheet under the print label "Both" (placeholder "Both, in a sentence"). A paradox with no line yet shows its three words, the middle left out when it has none: the seeded paradoxes have no current middle word (both of selfless and selfish's middles are struck revisions), so their fallback lines are "selfless · selfish" and "thoughtful (obsessive) · reactive". A tap on a line opens that paradox's spread below. The app writes none of it. Still shows the lines and nothing else of Be's states.

### 3.4 Exclusion, three ways

1. **Five are held.** At most five paradoxes are active (`HELD = 5`; the number is judgement, inside the card sort's five to ten). A sixth is saved resting, and the sheet says so in a note: "Five are held. This one rests until one of them does." Making a sixth active is inert until another rests. Choosing what to hold is choosing what not to.
2. **Not me.** Under an open spread, after the goals and before Today: up to three refusals for that paradox, each one line in his words (placeholder "I don't ..."), added with "+ Not me", edited on a tap, deleted by emptying the line. They belong to the paradox (deleted with it), have no cadence and no check, are hidden in Still, and are never on the list or in the creed.
3. **The shadow.** Kept as it is, a bracketed word beside its pole on the open spread; its field's placeholder becomes "This side, overdone".

### 3.5 Refused

- **Forced ranking of paradoxes or poles.** It contradicts holding both and invites re-ranking loops. Order is by drag, as today.
- **A standing "Not me" page across paradoxes.** A bare list of negatives is a rumination cue.
- **Prompted reviews, balance meters, pole counts.** Rules 15 and 16.
- **A closing line or a "Was me" shelf on delete.** Tommy asked for delete to be entire. Retired is the kept form.

## 4. Data (no Dexie version bump)

Two optional fields on `Paradox`, unindexed, so older rows simply have none (the pattern of `order`):

```ts
export type Refusal = { id: string; text: string; at: Millis };
Paradox.creed?: string;        // sealed
Paradox.refusals?: Refusal[];  // sealed
```

Model, all in `src/model/paradox.ts`:

```ts
ParadoxDraft gains creed?: string           // saved plainly; not a revision
export const HELD = 5;
export const REFUSALS = 3;
canHold(all: Pick<Paradox,'id'|'status'>[], id?: string): boolean   // true when fewer than HELD others are active
createParadox(d)                             // lands 'resting' when HELD are active
saveParadox(p, d, status)                    // throws HeldError when status goes active and HELD others are
deleteParadox(id): Promise<void>             // paradox + its items + its leans, one transaction; pages.paradoxIds scrubbed
deleteGoal(id): Promise<void>                // row removed; its pair's pairId cleared; any nextTo pointing at it cleared
addRefusal(paradoxId, text): Promise<Refusal | undefined>   // undefined when empty or REFUSALS reached
saveRefusal(paradoxId, id, text): Promise<void>             // empty text removes it
who(): Promise<{ paradox: Read<Paradox>; line: string; own: boolean }[]>  // active, byParadoxOrder; creed, else threeWords; own = a creed is written
```

Writes that must land together go through `store.many(writes, drops)` in `src/db/fields.ts`: the rows written and then the primary keys dropped, in one transaction (`deleteParadox`, `deleteGoal`). `sameCreed(p, d)` says the draft leaves the creed as it is, so the sheet's dirty check and `saveParadox` treat the creed apart from `sameVersion` (the creed is written over, never a revision).

Backup exports and imports the new fields as part of the paradox row; a file without them imports as before.

## 5. Packages

| # | What | Owns |
|---|---|---|
| S1 | Data and model: section 4, sealing in `fields.ts`, unit tests, backup test | `src/db/schema.ts`, `src/db/fields.ts`, `src/model/paradox.ts`, `test/model`, `test/db` |
| S2 | Edit and delete on the sheets: tappable words on the spread, the sheet's focus target, the Both field, the held note, Delete on both sheets | `src/ui/parts/Spread.tsx`, `src/ui/be/ParadoxSheet.tsx`, `src/ui/be/GoalSheet.tsx`, `src/ui/be/state.ts`, `test/e2e/be-edit.spec.ts` |
| S3 | Who and Not me: the creed at the top of Be, the refusals under a spread | `src/ui/be/Be.tsx`, new `src/ui/be/Who.tsx`, `src/ui/be/NotMe.tsx`, `test/e2e/be-who.spec.ts` |
| S4 | `DESIGN.md` rule 11 and 13 wording, the walkthrough steps from the real app, the full run | `DESIGN.md`, `design/` |

S1 first; S2 and S3 side by side on it; S4 after both.

The walkthrough is its own artifact, "FlowState Be: who, in his words": `design/be/` (the page, its driver and seed under `design/be/src`), built by `npm run walkthrough:be` (`script/build-be-walkthrough.mjs`) into `design/be/dist/`, the directory to publish, and checked by `test/e2e/walkthrough-be.spec.ts`. Ten steps, each the real app loaded afresh with its own example data. `design/walkthrough.html` is at its 300-word budget, so it gains no steps.

## 6. Open, for Tommy to overturn

1. Five held. Three would match Energize; seven is the top of the range.
2. Delete replaces Archive on a goal, and goals already archived stay unseen.
3. Three refusals per paradox, under the spread and not on a page of their own.
4. A paradox with no Both line shows its three words in the creed, not a blank.
5. Not built, worth a later look: a dated "when I held both" line per paradox (narrative identity: agency in a concrete scene).

## 7. Only the iPhone can say

The caret landing in the tapped field with the keyboard up; the two-tap Delete under a thumb; the creed's line height against the page rules in each light. From the builders:

- The keyboard rising when the caret lands in a tapped pole or middle word's field, and in a Not me line (`useKeyboardFit` keeps the line in view; headless Chrome has no keyboard).
- The 28px Not me lines and the word-wide pole buttons as tap targets: a thumb on the right line, and a pole word not taken for the spread's drag.
- The inert dashed "active" option in each light, when five are held: it should read as unavailable, not as chosen.
