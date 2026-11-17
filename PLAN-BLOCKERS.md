# FlowState: blockers and questions under each sign

Date: 2026-11-17. Status: plan only, nothing built. Packages are K0 to K6. Tommy's ask: "make a plan for flowstate to 1) resolve questions via tap/some ui/ux, 2) add questions to ponder under each chakra, 3) set up common blockers under each chakra which will open up to a flow diagram (you can resurrect a few of the old ones, and then we'll choose from among them - but make the ui really good on the chakra page, like just show "blockers" and then each relevant flow, and then i'll decide what stays".

`PLAN.md` stays the architecture, `DESIGN.md` the standard, `PLAN-MOUNTAIN.md` and `PLAN-TASKS.md` the sign's page this builds on. The walkthrough is `design/blockers/index.html`. Each screen is a photograph of the real app (main 9489558) with the proposed pieces drawn in by `design/blockers/capture.mjs` and `proposed.css`; K6 replaces it with a walkthrough that runs the built app.

**Revised the same evening after a UI/UX audit** (Tommy: "write in your fixes"). Section 11 lists what changed and why. The walkthrough's screens were photographed before the audit: steps 1 to 3 and 6 still hold; the others show the first draft (a ring where the word Resolve now stands, the Resolved fold on the page, the live dot alone, nothing in Still) and are owed a recapture against section 3 before anyone builds from them.

Not in this plan: the one line and "x vs. y" pair per sign, which is `PLAN-SIGN-LINES.md` (branch `sign-lines-plan`). It sits between the plate and the gate; this plan starts at the gate. The pair's second word (fear, under Root) is what the Blockers rows are instances of, so the two read as one thought: the pair, the gate, what shuts it. That plan also gives each sign one fixed grounding question that always shows, first in the questions block and over the three from the deck (its section 5): it is never in the deck or its sheet, never resolves and is never on the ? tab, so `Asks.tsx` here draws the deck's three under it and counts its rules into the block's held height.

## 1. What is there today (main 9489558, schema 9)

- **A sign's page** (`ui/flow/ChakraPage.tsx`) runs: the plate with its touch words, the gloss ("Root · feeling safe"), the gate, the shelf of five covers, three questions (rule 37, merged today as #94), the printed safety lines.
- **The eight old flows still exist, with every step and tip**, each under one sign (`SEED_CHAKRAS`): 3 a.m. under Crown, Replay under Third eye, Fight under Throat, Depress under Heart, Shame under Solar plexus, Shutdown under Sacral, Panic and What if under Root. Their drawings left the sign's page on 2026-11-11 ("remove the old ones"). The code that draws them is intact: `parts/Cycle`, nine shapes under `parts/cycle/`, and `FlowPage`, which today only Energize and unplaced flows reach.
- **Nothing on a sign's page says which flows sit under it.** A flow shows only when it is "in front" (a live episode, Right now, a hand-off), as a line of step words with rows under it.
- **A sign's three questions** are three strings on its shelf row (`signShelves.asks`). A tap writes the question on today's journal page. There is no way to say one is done, and no fourth question.
- **A question on the ? tab** is resolved only by holding a line on its page and choosing "This answers it" (`answerWith`). Nothing on the list or the page shows that this exists.

## 2. Decisions and assumptions

Decision 1 is Tommy's (2026-11-17). The rest are not his yet; all are for him to overturn.

1. **Two kinds of question on a sign** (Tommy, 2026-11-17: "one question should always show for each chakra... a grounding practice"; "other questions are resolvable"). The one fixed grounding question (PLAN-SIGN-LINES.md section 5) is a practice: it always shows and never resolves. Every other question, a sign's deck and the ? tab's alike, can be finished, so it can be resolved.
2. **One gesture resolves a question everywhere: a tap on a word.** The print word "Resolve" at the right end of the question's first rule, a thumb wide, like Edit and Done. Tapped, the app's drawn check (rule 27) is drawn in its place and the question goes to print grey; a tap on the check takes it back. No new glyph: not a ring (the ring is the way out of Still and the breath on a flow, and a circle with a dot reads as a radio button), not a box at the left (Tommy called checklists stale on 2026-11-11).
3. **"Resolved" is the word**, his own. On the ? tab the label "Answered" becomes "Resolved". "This answers it" stays and does the same thing, and also marks the line. On the ? tab a resolved row prints the day asked and the day resolved, and one date when they are the same day.
4. **Resolving needs no answer.** A question can be resolved with nothing written under it.
5. **A sign holds a deck of questions and shows three.** The deck starts at seven: the three there today and four more. This is my reading of "add questions to ponder", given that three already exist.
6. **Resolve one and the next comes up, without the page moving.** A tap on a question's words still opens today's journal page (his ask of this morning), and "Resolve" follows the question onto that page, so it can be resolved where it was answered. On the sign's page a resolved question stays in its place, in print grey with its check, until he leaves the page; when he comes back the next in the deck stands there. The block is three questions at every moment, so it holds its height and the safety lines under it never move.
7. **Resolved questions live in the sheet, not on the page.** Edit raises the deck sheet: the open questions on their rules, then the word Resolved and each resolved question with its date and its check, where a tap on the check brings it back. No "Resolved" word on the page: on Heart and Root it would stand directly over the 988 line and read as its heading, and a fold opened there would push that line away.
8. **Blockers is a print word and a list of rows**, directly under the gate, over the shelf. The gate says how shut the sign is; the rows under it say what shuts it. Each row is the Flow list's own row and nothing else: the name, its step words in print, its small drawing at the right. A row is exactly two rules high and draws no border of its own (the page's rules are its lines, rule 5). The step words are whole words only: as many as fit, never one cut in the middle.
9. **A tap on a row opens the flow's old page**: the drawing large, the step words on it, a tap on a word reading that step. The way back is the sign.
10. **A flow in front leaves the sign's page.** The step words line and the rows under it go; a live episode, Right now, hand-offs and the door land on the flow's own page instead. The sign's page becomes one thing at rest, always.
11. **A running blocker says where he is, in words.** Its row comes first, and in place of the step words it prints the step he is on, in ink ("The wave"), with the dot on its small drawing. A dot alone is too quiet to find in a bad minute.
12. **A flow can sit under more than one sign.** "Each relevant flow": 3 a.m. also fits Root, Replay also fits Crown, What if also fits Third eye. On a sign's page a second listing looks like any other row; nothing says "also here".
13. **He decides what stays in the app, not in a document.** Every candidate ships. A long press on a blocker row (rule 8: long press means pick up) raises the sheet "Root blockers": a tap on a row there strikes it off the sign (a drawn stroke, rule 10), a tap on a struck row puts it back, and "+ blocker" is the last line. Only in that sheet does a row say what it is: a second listing names its home ("also Crown"), a new candidate says "draft". No second Edit on the page (rule 37: one Edit on the screen). A struck flow is kept whole and is still reached by hand-offs and the door.
14. **Six new candidates ship as a name, a shape and step words** (section 4). Their said lines and tips are written only for the ones he keeps (K5).
15. **Still shows the names.** Still is the light for the hard parts, so the way to Panic stays on Root: the word Blockers and each name, at one size, with no drawing, no step words, no dot and no live order, as Energize's three are their names only (rule 13). The questions leave in Still as today (rule 37), and so do "Resolve", the check and the Resolved rows wherever they are. Through the door: none of it, as today.
16. **Nothing is counted** (rule 15): no "2 of 7", no number of blockers, no tally of resolved. Resolved rows carry a date.
17. **No schema bump.** Every new field is optional and unindexed; main stays at 9.

## 3. The shape (one line per walkthrough step)

1. **Each sign names what blocks it.** Root's page: the gate, the word Blockers, rows for Panic, What if and 3 a.m., then the shelf.
2. **A tap opens its drawing.** Panic's page: the ring, large, with its four step words; the header's way back reads Root.
3. **I walk it as before.** "The wave" tapped: its line, its said paragraph, its first row.
4. **One that is running says where I am.** Root's page with an episode open: Panic first, "The wave" in ink under its name, the dot on its small drawing.
5. **I decide what stays.** A long press on a row: the sheet "Root blockers", the three rows, 3 a.m. struck and marked "also Crown", "+ blocker".
6. **The candidates, sign by sign.** All seven lists on one sheet: what has its steps, what is listed a second time, what is new.
7. **Questions to ponder, under the shelf.** Three questions on their rules, the print word Resolve at the right of each.
8. **A tap on the word resolves one.** The first in print grey with the drawn check, still in its place; the block the same height.
9. **Next time, the next one is there.** The same page on coming back: the fourth question where the first was.
10. **Edit holds the whole deck, and what I resolved.** The sheet: every open question on its rules, whole, a blank rule, then Resolved with two dated questions and their checks.
11. **Or resolve it where I answered it.** Today's journal page: the question in italic with Resolve at its right, his answer under it.
12. **The same word on the ? tab.** The list: two open questions with Resolve, one under Resolved with the check.
13. **And on a question's own page.** Resolve beside the title.
14. **In Still, the names.** Root's page in Still: the plate, the gloss, Blockers and three names, the shelf, the 988 line.

## 4. The candidates

Drawings are the nine shapes that exist. "Has its steps" means seeded today with every step and tip.

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

**The six new shapes are stand-ins.** Each borrows a drawing that already means another flow (the ring is Panic, the cliff curve is What if), so while they are drafts a shape no longer names its flow, and one is wrong on its face: Missing someone on What if's curve, which builds and drops off a cliff, where missing someone swells and eases. K5 gives every candidate he keeps a shape that is its own, a new one under `parts/cycle/` where none of the nine fits; none ships final on a borrowed drawing.

## 5. Data (no schema bump; main stays at 9)

```ts
// Flow (clear, optional, unindexed)
alsoUnder?: ChakraId[];   // signs that list it besides flow.chakra
offSigns?: ChakraId[];    // signs he struck it off; the flow is kept
draft?: true;             // a new candidate with step words only (section 4), until K5 writes it

// signShelves row (sealed with picks and asks)
deck?: { id: string; text: string; resolvedAt?: Millis }[];

// Page, kind 'question' (clear)
resolvedByTap?: true;     // resolved by the word, so unmarking a wise line does not reopen it
```

- **`deck`** absent reads as the starters: `STARTER_DECK[chakra]` (seven), with his rewritten `asks[i]` laid over the first three. The first write (a resolve, an edit) stores the deck whole; `asks` is then ignored and left as it was.
- **The three that show**: the first three with no `resolvedAt`, read once when the page opens. One resolved while the page is up keeps its slot until the page is left.
- **`model/acts.ts`**: `deckOf(chakra)` gives `{ open, resolved }`; `resolveAsk(chakra, id, on)`; `setDeck(chakra, texts)` for the sheet (a rule emptied removes that question, the blank last rule adds one, and an open deck left under three is filled back up from the starters not yet resolved, which keeps rule 37's "a rule left empty puts its starter back"; with every question resolved the block shows what is left and keeps its room). `asksOf` stays as `deckOf().open.slice(0, 3)` texts, so `askInJournal` and its tests hold.
- **`model/pages.ts`**: `resolveQuestion(id, on)` sets `state`, `answeredAt` and `resolvedByTap`. `answerWith` reopens a question when its last wise line is unmarked only if `resolvedByTap` is not set.
- **`model/mountain.ts`**: `blockersOf(chakra)` gives the flows whose `chakra` or `alsoUnder` names the sign and whose `offSigns` does not, live ones first, then list order. `flowsUnder` stays for the safety lines.
- **Seeds**: `alsoUnder` for the three second listings is added to stored flows by a one-time pass (as `seedPicksOnce` does), not a Dexie version. The six new flows are seeded by the same pass with `draft: true`.
- **Backup**: K0 checks that `db/backup.ts` carries the new fields both ways and that a schema 9 file without them imports unchanged.

## 6. The starter deck (the four added to each sign; mine, for Tommy to strike or rewrite)

The first three of each sign are today's `STARTER_ASKS`, unchanged. All are in the wiser second person (rule 17). Each asks one thing and fits one rule at 390pt where it can (rule 37: the starters are short; long prompts feel heavy under stress), and none at Root invites him to picture the worst.

- **Crown**: What are you trying to control that will not be controlled? · What would you do tomorrow if this never settled? · What is finished, even if it is not perfect? · What happens if you stop watching it?
- **Third eye**: What would change your mind? · What are you not looking at? · What will this look like in a year? · Which story about this have you told the longest?
- **Throat**: What are you rehearsing instead of saying? · What is the kindest true version? · Where did you say yes and mean no? · What do you need to hear?
- **Heart**: Who has been kind to you lately? · What are you grieving that you have not named? · What would you forgive, if it cost nothing? · Where are you holding love back?
- **Solar plexus**: What is putting it off protecting you from? · What would enough look like today? · What have you done that the critic never counts? · What would you try if no one were keeping score?
- **Sacral**: What did you enjoy this week, in the body? · What do you reach for when you do not want to feel? · What feeling keeps coming back? · What would feel good that is also good for you?
- **Root**: Where in the body is it quiet? · What is happening, apart from the fear? · Who or what is solid right now? · What does the alarm want you to do?

## 7. The pieces

- **`parts/Resolve.tsx`** (the word and the check): a button `--hit` wide and one rule tall at the right of a question's first rule, the print word "Resolve"; resolved, the drawn check in ink in its place, drawn over `--t-draw` (rule 27) with the check's tick (rule 19, site `check`), lifted over `--t-ui` when taken back. `role="checkbox"`, labelled "Resolved". Press as rule 26. `fs-notstill`. Used on a sign's three, the journal line, the ? tab and the question page: one gesture everywhere.
- **`ui/flow/chakra/Blockers.tsx`**: the print word "Blockers" on its own rule (`.fs-month`), then `.fl-flow` rows on the page's rules: two rules a row, no border, name at `--fs-title`, whole step words joined by " · " in print on one line (a live row: its current step in ink instead), `Cycle small` at the right with the dot when live. A long press on a row raises the sheet of walkthrough step 5. Holds its room before the read, as the shelf and the questions do, so the lines under it never move. In Still: the word and the names at `--fs-ink`, one rule each, in stored order. Not mounted through the door. A sign with every blocker struck shows the word and "+ blocker" only.
- **`ui/flow/chakra/Asks.tsx`**: each question becomes a row of its words (the tap into the journal, unchanged) and "Resolve" at the right of its first rule. A resolved question stays where it is, in print grey with the check, until the page is left; nothing is added under the three, so the block's height does not change. The sheet lists the open deck, each question wrapping on its rules so all of it can be read while it is rewritten, a blank rule, then the print word Resolved (only when there is one) and the resolved questions, each with its date and its check.
- **`ui/flow/ChakraPage.tsx`**: `FlowRoute` sends `#/flow/:id` and `#/flow/:id/:step` to `FlowPage` for every flow; the page loses `front`, `.ck-steps`, the rows, `FromRow`, the step sheet and the second Edit. Safety lines at rest are unchanged and nothing above them grows.
- **`ui/flow/FlowPage.tsx`**: the way back is the sign it was opened from (the route's last sign, else `flow.chakra`, else Flow). A `draft` flow shows its drawing and step words, and "+ step" rows where its tips would be.
- **`ui/journal/PageView.tsx`**: a wise line on a page linked to a sign, whose words are an open question in that sign's deck, carries "Resolve" at its right. On a question page it sits at the right of the title.
- **`ui/questions/Questions.tsx`**: "Resolve" on every open row, the check on every resolved one; the label reads "Resolved"; one date when asked and resolved fall on the same day.
- **`DESIGN.md`**: rule 34 is amended where this reverses it (a flow under a sign has its own page again, with its drawing, ghost rings, stamps and hold the ring; the sign's page carries the small drawings in its Blockers rows and no large one; the `.ck-steps` line goes); rule 35 adds Blockers to the paper foot and drops the flow in front; rule 37 becomes a deck of which three show, each with "Resolve", the resolved ones kept dated in the Edit sheet, the block still holding its height (its "no mark for a question asked" stays: a question asked is not marked, one he resolves is); rule 13 gains Blockers' names in Still; a new rule 38 for Blockers (a word, rows on the rules, the live step in ink, no count, struck not deleted, long press for the sheet) and for "Resolve" (a word, then the drawn check; never on the fixed grounding question). Rule 7 is untouched: no new mark.

## 8. Packages

| | What | Depends on |
|---|---|---|
| K0 | Data and models: the fields of section 5, `deckOf`, `resolveAsk`, `setDeck`, `resolveQuestion`, `blockersOf`, the one-time seed pass, backup check. Unit tests. | |
| K1 | "Resolve" on the ? tab and the question page (`parts/Resolve`, steps 12 and 13). | K0 |
| K2 | The deck on a sign's page: Resolve on the three, the next one on return, the deck sheet with wrapping rules and its Resolved list, Resolve on the journal line (steps 7 to 11); e2e that the block and the safety lines do not move. | K0, K1 |
| K3 | Blockers on a sign's page and the flow's own page back under it (steps 1 to 4, 14): `Blockers.tsx` on the rules, the live step, the names in Still, `FlowRoute`, the travel, the back word; e2e for the door, Right now, hand-offs and a live episode landing on the flow's page. | K0 |
| K4 | The Blockers sheet by long press: strike, put back, "+ blocker", the "also" and "draft" words (step 5). The six drafts and three second listings visible (step 6). | K3 |
| K5 | After Tommy chooses: said lines, tips, safety lines and a shape of its own for each new flow he kept, in the register of `PLAN-FLOWS-WORDS.md`; the rest removed from the seed. | K4, his choices |
| K6 | The walkthrough rebuilt from the real app (`npm run walkthrough:blockers`), `DESIGN.md` rules, the artifact republished. | K1 to K4 |

K1 and K3 can run at once; K2 and K3 both touch `ChakraPage.tsx` (K2 only through `Asks`), so K3 merges first.

## 9. Open questions

1. Does resolving on a sign also file the question on the ? tab under Resolved? Planned: no, the sign keeps its own, in its sheet.
2. "Resolve" as a word and the drawn check, or a mark of its own?
3. Seven a sign to start: enough, or more?
4. Blockers under the gate and over the shelf, or under the questions?
5. The step words on a blocker's row: keep, or the name and drawing alone?
6. Second listings (3 a.m. under Root, Replay under Crown, What if under Third eye): keep the idea?
7. Which of the six new candidates are worth writing steps and a shape for?
8. Should a struck blocker also leave Right now and the door's list? Planned: no.
9. The ? tab header prints "2 of 3 open" on a question page today, which is a count; leave or drop while here?
10. Blockers' names in Still (decision 15): right, or should Still stay bare?

## 10. Checks only the iPhone can make

"Resolve" under a thumb beside a wrapped question; the tick on resolve; a long press on a blocker row against the page's scroll; the small drawing travelling to the large one from a row low on the page; the Blockers rows' height with a long name at 390pt.

## 11. What the audit changed (2026-11-17)

| Was | Now | Why |
|---|---|---|
| One ring resolved every question, grounding practices among them | Every question resolves except the one fixed grounding question a sign (PLAN-SIGN-LINES.md) | A grounding question is a practice, not a task. Tommy, 2026-11-17: one always shows, "other questions are resolvable" |
| A Resolved fold on the sign's page, the block growing by a question | Resolved kept in the Edit sheet; a resolved question holds its slot until the page is left | "RESOLVED" printed directly over the 988 line read as its heading; the fold and the fourth question pushed the safety lines down (rule 37: nothing under it moves) |
| A ring with a dot | The word "Resolve", then the drawn check | The ring is already the way out of Still and the breath; a dotted circle reads as a radio button; the journal page has a small circle at the left of an answer |
| A live blocker differed by a 6px dot | Its current step in ink, first in the list | It has to be found in a bad minute |
| Still showed no blockers | Still shows their names | Still is the light for the hard parts; Panic should not vanish from Root, least of all mid-episode |
| "Also here" and "new" on the page's rows | Only in the sheet, as "also Crown" and "draft" | Reviewer's words; on the page they say nothing |
| Rows with their own borders, step words cut mid-word | Rows on the page's rules, whole words | Double lines against the rules (rule 5); "SETTLIN…" |
| Edit at the foot of Blockers | A long press on a row | Rule 37 keeps one Edit on the screen; rule 8 gives long press this meaning |
| New candidates final on borrowed shapes | Borrowed shapes are stand-ins until K5 | A shape should name one flow; Missing someone does not move like What if |
| Deck sheet rows cut at the edge; emptying a rule undefined against rule 37 | Rules wrap; a deck under three refills from the starters | He could not read a question he was rewriting |
| Rule 34 not listed for change | Listed | It says the drawings left the sign's page and hold the ring stays off a flow with a sign; this reverses both |
| Two-part and worst-case questions in the deck | One thing each; Root's reworded | Short starters (rule 37); "the worst that is actually likely" invites the spiral at Root |
| The ? list printed the date twice | Once when both are the same day | "11 / 17 / 26 · 11 / 17 / 26" |
