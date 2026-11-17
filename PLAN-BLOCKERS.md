# FlowState: blockers and questions under each sign

Date: 2026-11-17. Status: plan only, nothing built. Packages are K0 to K6. Tommy's ask: "make a plan for flowstate to 1) resolve questions via tap/some ui/ux, 2) add questions to ponder under each chakra, 3) set up common blockers under each chakra which will open up to a flow diagram (you can resurrect a few of the old ones, and then we'll choose from among them - but make the ui really good on the chakra page, like just show "blockers" and then each relevant flow, and then i'll decide what stays".

`PLAN.md` stays the architecture, `DESIGN.md` the standard, `PLAN-MOUNTAIN.md` and `PLAN-TASKS.md` the sign's page this builds on. The walkthrough is `design/blockers/index.html`: fourteen steps. Each screen is a photograph of the real app (main 9489558) with the proposed pieces drawn in by `design/blockers/capture.mjs` and `proposed.css`; K6 replaces it with a walkthrough that runs the built app.

Not in this plan: the one-line blurb and "x vs. y" pair per sign. Tommy asked for it mid-session and then took it back ("cancel that - i'll do that separate"). Nothing here sits between the gloss line and the gate, so it has room.

## 1. What is there today (main 9489558, schema 9)

- **A sign's page** (`ui/flow/ChakraPage.tsx`) runs: the plate with its touch words, the gloss ("Root · feeling safe"), the gate, the shelf of five covers, three questions (rule 37, merged today as #94), the printed safety lines.
- **The eight old flows still exist, with every step and tip**, each under one sign (`SEED_CHAKRAS`): 3 a.m. under Crown, Replay under Third eye, Fight under Throat, Depress under Heart, Shame under Solar plexus, Shutdown under Sacral, Panic and What if under Root. Their drawings left the sign's page on 2026-11-11 ("remove the old ones"). The code that draws them is intact: `parts/Cycle`, nine shapes under `parts/cycle/`, and `FlowPage`, which today only Energize and unplaced flows reach.
- **Nothing on a sign's page says which flows sit under it.** A flow shows only when it is "in front" (a live episode, Right now, a hand-off), as a line of step words with rows under it.
- **A sign's three questions** are three strings on its shelf row (`signShelves.asks`). A tap writes the question on today's journal page. There is no way to say one is done, and no fourth question.
- **A question on the ? tab** is resolved only by holding a line on its page and choosing "This answers it" (`answerWith`). Nothing on the list or the page shows that this exists.

## 2. Decisions and assumptions

None of these is Tommy's yet; all are mine for him to overturn.

1. **One gesture resolves a question everywhere: a tap on its ring.** An open ring at the right end of the question's first rule, a thumb wide. A tap draws a dot in it; a tap on a filled ring takes it back. The ring is one of the app's own drawn marks (rule 7). Not a checkbox at the left: Tommy called checklists stale on 2026-11-11.
2. **"Resolved" is the word**, his own. On the ? tab the label "Answered" becomes "Resolved". "This answers it" stays and does the same thing, and also marks the line.
3. **Resolving needs no answer.** A question can be resolved with nothing written under it.
4. **A sign holds a deck of questions and shows three.** The deck starts at seven: the three there today and four more. Resolve one and the next comes up. This is my reading of "add questions to ponder", given that three already exist.
5. **A tap on a question's words still opens today's journal page** (his ask of this morning). The ring follows the question onto that page, so it can be resolved where it was answered.
6. **Blockers is a print word and a list of rows**, directly under the gate, over the shelf. The gate says how shut the sign is; the rows under it say what shuts it. Each row is the Flow list's own row: the name, its step words in print, its small drawing at the right. Nothing else.
7. **A tap on a row opens the flow's old page**: the drawing large, the step words on it, a tap on a word reading that step. The way back is the sign.
8. **A flow in front leaves the sign's page.** The step words line and the rows under it go; a live episode, Right now, hand-offs and the door land on the flow's own page instead. The sign's page becomes one thing at rest, always.
9. **A flow can sit under more than one sign.** "Each relevant flow": 3 a.m. also fits Root, Replay also fits Crown, What if also fits Third eye.
10. **He decides what stays in the app, not in a document.** Every candidate ships; Edit on Blockers strikes one off a sign (a drawn stroke, rule 10) and a tap puts it back. A struck flow is kept whole and is still reached by hand-offs and the door.
11. **Six new candidates ship as a name, a shape and step words** (section 4). Their said lines and tips are written only for the ones he keeps (K5).
12. **Still shows none of it**: no Blockers, no questions, no rings, no Resolved (rule 13). Through the door: none of it, as today.
13. **Nothing is counted** (rule 15): no "2 of 7", no number of blockers, no tally of resolved. Resolved rows carry a date.
14. **No schema bump.** Every new field is optional and unindexed; main stays at 9.

## 3. The shape (one line per walkthrough step)

1. **Each sign names what blocks it.** Root's page: the gate, the word Blockers, rows for Panic, What if and 3 a.m., then the shelf.
2. **A tap opens its drawing.** Panic's page: the ring, large, with its four step words; the header's way back reads Root.
3. **I walk it as before.** "The wave" tapped: its line, its said paragraph, its first row.
4. **One that is running shows where I am.** Root's page with an episode open: Panic first, the dot on its small drawing.
5. **I decide what stays.** The sheet "Root blockers": the three rows, 3 a.m. struck, "+ blocker".
6. **The candidates, sign by sign.** All seven lists on one sheet: what has its steps, what is listed a second time, what is new.
7. **Questions to ponder, under the shelf.** Three questions, each with an open ring at the right.
8. **A tap on the ring resolves one.** The first ring filled, its words in print grey, a fourth question under the three.
9. **Resolved keeps them, dated.** The word Resolved opened: two resolved questions with their dates and filled rings.
10. **Edit holds the whole deck.** The sheet: every open question on its rule, a blank rule last.
11. **Or resolve it where I answered it.** Today's journal page: the question in italic with its ring, his answer under it.
12. **The same ring on the ? tab.** The list: two open questions with rings, one under Resolved.
13. **And on a question's own page.** The ring beside the title.
14. **In Still, none of it.** Root's page in Still: the plate, the gloss, the shelf, the 988 line.

## 4. The candidates

Drawings are the nine shapes that exist; no new shape is needed. "Has its steps" means seeded today with every step and tip.

| Sign | Has its steps | Also here | New (name · shape · step words) |
|---|---|---|---|
| Crown · letting go | 3 a.m. (clock) | Replay | Gripping · ring · Planning, Re-planning, Checking, Tighter |
| Third eye · seeing clearly | Replay (coil) | What if | Can't choose · fork · Two doors, More research, Asking everyone, Neither |
| Throat · speech | Fight (mountain) | | Swallowed it · stairs · Almost said, Let it pass, Rehearsing, Resenting |
| Heart · love and grief | Depress (valley) | | Missing someone · curve · A reminder, The wave, Aching, Easing |
| Solar plexus · will and worth | Shame (fork) | | Can't start · valley · Should, Putting off, Dread, One small piece |
| Sacral · feeling | Shutdown (stairs) | | Numbing · coil · Restless, Reaching, Scrolling, Hollow |
| Root · feeling safe | Panic (ring), What if (curve) | 3 a.m. | |

Seventeen rows: eight old, three second listings, six new. The names, shapes and step words of the new six are mine.

## 5. Data (no schema bump; main stays at 9)

```ts
// Flow (clear, optional, unindexed)
alsoUnder?: ChakraId[];   // signs that list it besides flow.chakra
offSigns?: ChakraId[];    // signs he struck it off; the flow is kept
draft?: true;             // a new candidate with step words only (section 4), until K5 writes it

// signShelves row (sealed with picks and asks)
deck?: { id: string; text: string; resolvedAt?: Millis }[];

// Page, kind 'question' (clear)
resolvedByTap?: true;     // resolved by the ring, so unmarking a wise line does not reopen it
```

- **`deck`** absent reads as the starters: `STARTER_DECK[chakra]` (seven), with his rewritten `asks[i]` laid over the first three. The first write (a resolve, an edit) stores the deck whole; `asks` is then ignored and left as it was. The three that show are the first three with no `resolvedAt`.
- **`model/acts.ts`**: `deckOf(chakra)` gives `{ open, resolved }`; `resolveAsk(chakra, id, on)`; `setDeck(chakra, texts)` for the sheet (a rule emptied removes that question; the blank last rule adds one). `asksOf` stays as `deckOf().open.slice(0, 3)` texts, so `askInJournal` and its tests hold.
- **`model/pages.ts`**: `resolveQuestion(id, on)` sets `state`, `answeredAt` and `resolvedByTap`. `answerWith` reopens a question when its last wise line is unmarked only if `resolvedByTap` is not set.
- **`model/mountain.ts`**: `blockersOf(chakra)` gives the flows whose `chakra` or `alsoUnder` names the sign and whose `offSigns` does not, live ones first, then list order. `flowsUnder` stays for the safety lines.
- **Seeds**: `alsoUnder` for the three second listings is added to stored flows by a one-time pass (as `seedPicksOnce` does), not a Dexie version. The six new flows are seeded by the same pass with `draft: true`.
- **Backup**: K0 checks that `db/backup.ts` carries the new fields both ways and that a schema 9 file without them imports unchanged.

## 6. The starter deck (the four added to each sign; mine, for Tommy to strike or rewrite)

The first three of each sign are today's `STARTER_ASKS`, unchanged. All are in the wiser second person (rule 17).

- **Crown**: What are you trying to control that will not be controlled? · What would you do tomorrow if this never settled? · What is finished, even if it is not perfect? · What are you afraid happens if you stop watching it?
- **Third eye**: What would change your mind? · What are you not looking at? · What will this look like in a year? · Which story about this have you told the longest?
- **Throat**: What are you rehearsing instead of saying? · What is the kindest true version? · Where did you say yes and mean no? · What do you need to hear, and from whom?
- **Heart**: Who has been kind to you lately? · What are you grieving that you have not named? · What would you forgive, if it cost nothing? · Where are you holding love back?
- **Solar plexus**: What are you putting off, and what is that protecting you from? · What would enough look like today? · What have you done that the critic never counts? · What would you try if no one were keeping score?
- **Sacral**: What did you enjoy this week, in the body? · What do you reach for when you do not want to feel? · What feeling keeps coming back? · What would feel good that is also good for you?
- **Root**: Where in the body does it feel least safe, and where most? · What is the worst that is actually likely? · Who or what is solid right now? · What does the alarm want you to do, and what do you want to do?

## 7. The pieces

- **`parts/Resolve.tsx`** (the ring): a button `--hit` wide and one rule tall at the right of a question's first rule; an open circle in print grey; resolved, a dot drawn in ink over `--t-draw` (rule 27) with the check's tick (rule 19, site `check`), lifted over `--t-ui` when taken back. `role="checkbox"`, labelled "Resolved". Press as rule 26.
- **`ui/flow/chakra/Blockers.tsx`**: the print word "Blockers" on its own rule (`.fs-month`), then `.fl-flow` rows (name at `--fs-title`, step words joined by " · " in print on one line, `Cycle small` at the right with the dot when live). Edit at the right of the last row raises the sheet of walkthrough step 5. Holds its room before the read, as the shelf and the questions do, so the lines under it never move. `fs-notstill`; not mounted through the door. A sign with every blocker struck shows the word and "+ blocker" only.
- **`ui/flow/chakra/Asks.tsx`**: each question becomes a row of its words (the tap into the journal, unchanged) and its ring. A resolved question stays where it is, in print grey, until the page is left; the next in the deck is drawn under the three at once. The foot rule carries "Resolved" at the left (shown only when there is one) and "Edit" at the right. Resolved opens the fold: each with its date and filled ring. The sheet lists the open deck on rules, a blank rule last.
- **`ui/flow/ChakraPage.tsx`**: `FlowRoute` sends `#/flow/:id` and `#/flow/:id/:step` to `FlowPage` for every flow; the page loses `front`, `.ck-steps`, the rows, `FromRow`, the step sheet and the second Edit. Safety lines at rest are unchanged.
- **`ui/flow/FlowPage.tsx`**: the way back is the sign it was opened from (the route's last sign, else `flow.chakra`, else Flow). A `draft` flow shows its drawing and step words, and "+ step" rows where its tips would be.
- **`ui/journal/PageView.tsx`**: a wise line on a page linked to a sign, whose words are an open question in that sign's deck, draws the ring at its right. On a question page the ring sits at the right of the title.
- **`ui/questions/Questions.tsx`**: a ring on every row; the label reads "Resolved".
- **`DESIGN.md`**: rule 7 lists the ring's dot among the drawn marks; rule 35 adds Blockers to the paper foot and drops the flow in front; rule 37 becomes a deck with rings and a Resolved fold; a new rule 38 for Blockers (a word, rows, no count, struck not deleted).

## 8. Packages

| | What | Depends on |
|---|---|---|
| K0 | Data and models: the fields of section 5, `deckOf`, `resolveAsk`, `setDeck`, `resolveQuestion`, `blockersOf`, the one-time seed pass, backup check. Unit tests. | |
| K1 | The ring on the ? tab and the question page (`parts/Resolve`, steps 12 and 13). | K0 |
| K2 | The deck on a sign's page: rings, the rise, the Resolved fold, the deck sheet, the ring on the journal page (steps 7 to 11). | K0, K1 |
| K3 | Blockers on a sign's page and the flow's own page back under it (steps 1 to 4): `Blockers.tsx`, `FlowRoute`, the travel, the back word; e2e for the door, Right now, hand-offs and a live episode landing on the flow's page. | K0 |
| K4 | The Blockers sheet: strike, put back, "+ blocker" (step 5). The six drafts and three second listings visible (step 6). | K3 |
| K5 | After Tommy chooses: said lines, tips and safety lines for the new flows he kept, in the register of `PLAN-FLOWS-WORDS.md`; the rest removed from the seed. | K4, his choices |
| K6 | The walkthrough rebuilt from the real app (`npm run walkthrough:blockers`), `DESIGN.md` rules, the artifact republished. | K1 to K4 |

K1 and K3 can run at once; K2 and K3 both touch `ChakraPage.tsx` (K2 only through `Asks`), so K3 merges first.

## 9. Open questions

1. Is "resolve questions" the ? tab's questions, the signs' questions, or both? This plan does both with one ring.
2. Does resolving on a sign also file the question on the ? tab under Resolved? Planned: no, the sign keeps its own.
3. Seven a sign to start: enough, or more?
4. Blockers under the gate and over the shelf, or under the questions?
5. The step words on a blocker's row: keep, or the name and drawing alone?
6. Second listings (3 a.m. under Root, Replay under Crown, What if under Third eye): keep the idea?
7. Which of the six new candidates are worth writing steps for?
8. Should a struck blocker also leave Right now and the door's list? Planned: no.
9. The ? tab header prints "2 of 3 open" on a question page today, which is a count; leave or drop while here?

## 10. Checks only the iPhone can make

The ring under a thumb beside a wrapped question; the tick on resolve; the small drawing travelling to the large one from a row low on the page; the Blockers rows' height with a long name at 390pt.
