# FlowState Be: values, shadows and champions

Date: 2026-11-11. Status: planned, not built. Packages are C0 to C6 (C for champion). Tommy's ask: "make a plan to entirely rework the 'be' section of flow state. rather than having goals within paradoxes, i want the main page to be a list of values that comprise the overall identity i want to build, and only when clicking on that value does its 'shadow' value show (to create a lesser paradox). then, rather than having a graph with goals and all, i want those values to be 'championed' by various council members, and i want it to be really easy to be flexible with it (council members can have more than one value, values can have more than one council member, etc). consider how to make it both fun and useful, so that during council sessions a given voice can say 'i'm fighting for XYZ value'."

`PLAN.md` stays the architecture and `DESIGN.md` the standard. The proposal walkthrough is `design/values/index.html`: eleven steps of mocked screens on the real `tokens.css` and `parts.css`. C6 rebuilds it from the real app.

## 1. What is there today (main 2a33dec)

- **Be is a list of paradoxes.** A row is two poles facing across a seam ("selfless | selfish"). A tap opens the spread: two facing pages of goals at the height of their lean, pairs tied across the seam, dashed slots for a missing balance, arrows, then the checks due today and the lean slider (`ui/be/Be.tsx`, `parts/Spread`, `ui/be/Due.tsx`, `model/paradox.ts`, `model/flow.ts`).
- **The shadow exists, as a bracket.** `Pole.shadow` is the word beside a pole ("thoughtful (obsessive)"). The aspect lines ("what living this side looks like") are written and shown nowhere.
- **The council knows nothing about Be.** A voice has a role, a given name, a colour and a deep twin. A line carries a `voiceId`. `Page.paradoxIds` exists and is always empty.
- **PR #58 is open and unmerged** (`be-self`, PLAN-SELF.md): edit in place, delete entire with tombstones, the creed, five held, Not me. It refines the screen this plan replaces. Section 8 says what is taken from it.

## 2. Decisions and assumptions

Decided by Tommy (2026-11-11): Be's main page is a list of values; a value's shadow shows only when the value is tapped; goals and the graph go; values are championed by council voices, many to many; a voice can say in a council what it is fighting for; it should be fun and useful.

Assumed for the build, each one small to overturn (section 9 asks the ones that matter):

- **A value is one word of his, and so is its shadow.** The app does not say whether the shadow is the opposite ("selfless | selfish") or the value overdone ("thoughtful | obsessive"). Whatever pulls against it. A value may have no shadow yet.
- **The list is the identity.** Be opens on the values alone, large, in his order, under the notebook's own line "I determine my core." No shadows, no states, nothing to do.
- **A tap opens the value where it stands.** The word moves left, the seam is drawn, the shadow is written across it: the list row becomes today's dichotomy row. Under it: what living it looks like (the aspect line, shown at last), who fights for it, who pulls for the shadow, what was said for it, and "Call a council".
- **A champion is a voice on a side.** Any voice can fight for a value; any voice can pull for its shadow. Deep twins are offered first for the shadow (Workaholic for "rigidity" when Architect fights for "discipline"), because the notebook already draws the shadow of a voice that way. Nothing is assigned by the app.
- **Many to many, by taps.** From a value: "+ champion" opens every voice as a chip, tap to toggle. From a voice: every value as a chip, tap to toggle. In a council: "+ value" on the speaking voice's row. Three doors, one link.
- **A champion may say why.** Each champion row under a value is drawn as that voice's line (its 3px rule and wash) and holds one optional sentence of his: what fighting for this means to that voice. This is where the goals' intent goes: not a task with a cadence, a stance in a voice.
- **"For" is a label, not a sentence.** In a council the speaking voice's values sit as small chips above the composer ("for honesty"). A tap arms one for the next line; the line is printed "WARRIOR · FOR HONESTY". The app prints his word in the stationery sans; it never writes the line (rule 16).
- **A value keeps what was said for it.** Lines spoken for a value show under it, newest first, each a way back to its council. That is the use: the value is not a claim, it is a record of the times a part of him stood up for it.
- **A council can be called on a value.** It opens with the value's champions seated, and the shadow's across from them, and "About" naming the value.
- **Goals, leans and checks leave the app, not the phone.** Their tables stay in the database and in every backup; nothing reads them. Nothing is deleted by the upgrade.
- **No counts.** No "times fought for", no tallies per voice, no ranking of values or champions (rules 15 and 16).

## 3. The shape (one line per walkthrough step)

1. **Be is who I am building.** The list: "I determine my core.", then the values, each with its champions' colours as short rules; a value nobody fights for has a dashed one.
2. **A new value is a word, and what pulls against it.** The value sheet: Value, Shadow, What it looks like; Held or Resting; Delete.
3. **A tap shows its shadow.** "honesty | cruelty", the looks line, the champions as voiced lines, who pulls for the shadow.
4. **Anyone can take up a value.** The "+ champion" sheet: every voice a chip, pressed when it fights for this.
5. **Each voice, and what it fights for.** Be's second segment, "Champions": the pantheon with each voice's values under its name, deep twins with the shadows they pull for.
6. **A council sits around what is at stake.** "Who sits?" with a row of values: a tap on one seats its champions.
7. **Warrior says what he is fighting for.** The composer with "for honesty" armed; lines above printed "WARRIOR · FOR HONESTY".
8. **The shadow gets a voice too.** Night: Phantom, doubled rule, "PHANTOM · FOR CRUELTY".
9. **Hold a line to say what it was for.** The line sheet's new row, "Spoke for…", after the fact.
10. **The value keeps what was said for it.** The open value again, now with "Said for it" and "Call a council".
11. **In Still, only the words.**

## 4. Fun and useful, against DESIGN.md

| Where it comes from | How | Rule |
|---|---|---|
| Recruiting | A value with no champion shows a dashed rule on the list and a dashed row inside: "who fights for this?" The dashed slot is rule 11's own mark for something owed. | 11 rewritten |
| Colour | A value's row carries its champions' hues as `.fs-spoke` rules (the council list's mark); a champion's why is a voiced line. The list looks like who showed up. | 3, 9 |
| The declaration | Arming "for honesty" is one tap, a tick, and the label is drawn onto the line like a pen stroke. | 19 amended, 27 |
| Sides at the table | A council called on a value seats both sides, so the lesser paradox is argued by the voices that hold each end. | 9 |
| The record | "Said for it" under a value: the lines themselves, dated, no number. | 15 |
| The shadow, out of sight | Shadows never show on the list, in Still, or through the door: named once, beside its value, then put away. | 13 amended |

Rules touched: 9 (the "for" label beside a speaker), 11 (rewritten: Be is a list of values; the spread retires), 13 (Still: value words only; no shadows, champions, whys or dates), 15 (said-for lines are not a count), 19 (two tick sites: `champion`, a voice taking up or leaving a value; `for`, arming). No new tokens expected. Banned as everywhere: generated words, counts, streak words, bounce.

Why this shape, from the reading done for PLAN-SELF.md (2026-11-10, abstract level): a wanted self holds best when balanced by a feared self in the same domain (Oyserman and Markus 1990), so the shadow sits beside its value and nowhere else; suppression rebounds (Wenzlaff and Wegner 2000), so the shadow is off the daily view; values written in one's own words lower defensiveness (Cohen and Sherman 2014), so every word and every why is his; avoidance goals drag wellbeing down (Elliot, Sheldon and Church 1997), so a shadow has no check and no cadence; more facets is not better (Rafaeli-Mor and Steinberg 2002), so resting stays.

## 5. Data (schema version 6)

```ts
export type Champion = { voiceId: string; side: 'value' | 'shadow'; at: Millis; why?: string };
export type Value = {
  id: string; createdAt: Millis; updatedAt: Millis;
  status: 'held' | 'resting';
  word: string;            // sealed
  shadow?: string;         // sealed
  looks?: string;          // sealed: what living it looks like
  champions: Champion[];   // voiceId, side and at stay clear; why is sealed
  revisions: { at: Millis; word: string; shadow?: string }[];   // sealed; shown struck (rule 10)
  order?: number;
  fromParadoxId?: string;  // the paradox it was made from
  sealed?: Sealed;
};
Message.for?: { valueId: string; side: 'value' | 'shadow' };   // clear ids, like voiceId
Page.valueIds?: string[];                                       // a council called on a value
```

- **New table `values`** (index `id`), `SCHEMA_VERSION` 6, in `TABLES`, `SPECS` (`valueSpec`, the fixation spec's pattern) and `backup.ts`. A version 5 file imports with none and gets the migration below. The Dexie upgrade writes nothing (it cannot seal).
- **Champions live on the value row.** One write changes a link, a backup merge is a row merge, and "what does this voice fight for" is a scan of a short list. No join table.
- **`model/values.ts`**: `held()`, `resting()`, `createValue`, `saveValue` (revisions on a later day, as a line's), `moveValue`, `deleteValue` (two taps; lines keep their words and lose the label), `champion(valueId, voiceId, side)` and `unchampion`, `setWhy`, `fightsFor(voiceId)`, `byVoice()` for the Champions segment, `saidFor(valueId, limit)`, `speakFor(messageId, for | undefined)`, `callCouncil(valueId)`.
- **`model/council.ts`**: `speak` takes `for`; `newCouncil` takes `valueId` and seats its champions (value side first, then shadow side), skipping archived voices.
- **One-time pass `valuesFromParadoxesOnce`** (marked `'values'` in `settings.cleaned`; needs the journal open, like `seedFixationsOnce`): each paradox becomes one value, word from pole A, shadow from pole B, looks from pole A's aspect, `held` when it was active and `resting` otherwise, order kept. Pole A's old bracket word and pole B's aspect go into the value's first revision so nothing is lost. A fresh install seeds the same two values and no paradoxes.
- **`paradoxes`, `items`, `leans` stay**: in the schema, sealed as before, exported and imported by backup, read by nothing. `Page.paradoxIds` stays on old rows.
- **An archived voice** keeps its links and is not drawn; restored, it is a champion again.
- Routes: `#/be` (values), `#/be/:id` (that value open), `#/be/champions`, matched before `:id`.

## 6. Build packages (one PR each, PLAN.md section 10 rules)

| # | Package | Owns | Done when |
|---|---|---|---|
| C0 | Salvage from #58: `store.tx`, `store.unit`, `settings.deleted` tombstones and the import handling for them | `src/db/fields.ts`, `src/db/backup.ts`, their tests | A delete survives a merge import; #58 is closed with a pointer here |
| C1 | Data: section 5, the pass, the seed, backup, unit tests | `src/db/schema.ts`, `src/db/fields.ts`, `src/db/seed.ts`, `src/db/backup.ts`, new `src/model/values.ts`, `test/model`, `test/db` | A version 5 database opens as version 6 with one value per paradox and nothing lost |
| C2 | Be: the list, the open value, the value sheet, drag order, Resting, Still; the spread, goal sheet, checks and lean slider leave the UI | `src/ui/be/*`, `src/ui/parts/parts.css` (Be section), `test/e2e/be-values.spec.ts`; retires `be.spec.ts`, `be-checks.spec.ts` | Steps 1, 2, 3 and 11 run in the app |
| C3 | Champions: champion rows and whys under a value, "+ champion", the Champions segment, the values row on the voice sheet | new `src/ui/be/Champions.tsx`, `ChampionSheet.tsx`, `src/ui/council/VoiceSheet.tsx`, `test/e2e/champions.spec.ts` | Steps 4 and 5; a link made from either side shows on both |
| C4 | Council: the "for" chips above the composer, the label on a line, "Spoke for…" on the council and journal line sheets, values on "Who sits?" | `src/ui/council/*`, `src/ui/parts/Speaker.tsx`, `src/ui/journal/LineSheet.tsx`, `src/model/council.ts`, `test/e2e/council-for.spec.ts` | Steps 6 to 9 |
| C5 | The record: "Said for it" under a value, "Call a council", "About" on the council | `src/ui/be/Said.tsx`, `src/ui/council/Council.tsx` (About line only) | Step 10 |
| C6 | `DESIGN.md` rules 9, 11, 13, 15, 19; `design/values/` rebuilt from the real app (`npm run walkthrough:values`); Be's steps in `design/walkthrough.html`; dead code out (`parts/Spread`, `LeanSlider`, `GoalSheet`, `Due`, the goal half of `model/paradox.ts` and `model/flow.ts` that nothing imports) | `DESIGN.md`, `design/`, `script/` | Both lints PASS; the architecture test finds no orphan |

C0 then C1. C2 and C4 side by side on C1. C3 on C2. C5 on C2 and C4. C6 last. After C1 merges, no dist built from an older tree may be deployed (main becomes schema 6).

## 7. Tests

- Unit: the pass (two seeded paradoxes, one with a bracket word, one resting); champion and unchampion from both sides; a why kept across an edit; `fightsFor` and `byVoice` with archived voices; `speakFor` and `saidFor`; a deleted value against a merge import; a version 5 backup file.
- e2e: open and fold a value; the shadow absent from the list and from Still; toggle a champion on the value and see it on the voice; arm "for", send, see the label, reload, see it under the value; call a council from a value and find both sides seated.
- Existing specs that name paradoxes (`still`, `turns`, `earlier`, `install`) move to values in C2.

## 8. PR #58 (be-self)

Recommended: do not merge it. Its screen (the creed over paradoxes, Not me under a spread, the goal sheet's Delete) is replaced here. C0 carries its database work across, which this plan needs for delete. Its ideas land as follows: the creed is the list itself; Not me is the shadow; edit in place is the value sheet; five held is question 3. Its research table is quoted in section 4.

## 9. Open, for Tommy

1. **What a paradox becomes.** Planned: one value, pole A with pole B as its shadow ("selfless | selfish", "thoughtful | reactive", with "obsessive" kept as a struck revision). The other reading: both poles become values, each the other's shadow. Or start Be empty and write the values fresh.
2. **Goals.** Planned: gone from the app, kept in the database and backups. Say so if the cadenced ones (the daily and weekly checks) should live on somewhere.
3. **A cap on held values.** Planned: none; Resting is the way to put one down. #58 held five.
4. **The why line.** Planned: optional, one sentence per champion. Drop it and a champion is only a name.
5. **Shadow champions.** Planned: any voice may pull for a shadow, deep twins offered first. Simpler: only values have champions.
6. **Arming "for".** Planned: always a deliberate tap, even for a voice with one value.
7. **PR #58.** Planned: closed after C0.

## 10. Only the iPhone can say

The word's travel to the left as the shadow is written; the tick on arming "for"; whether two rows of chips above the keyboard leave enough of the conversation; the champion chips as thumb targets in the sheet; the list's type size against the page rules in each light.
