# FlowState: what each sign is for (one italic line, its struggle, and the one question that always shows)

Planned 2026-11-17 at Tommy's ask. Not built. Two packages (section 7). It sits beside PLAN-BLOCKERS.md (branch `blockers-plan`), which is a separate plan and does not touch the same lines of the page or `CHAKRAS`.

Revised the same evening after a UI/UX audit (Tommy: "write in your fixes, and use the shorter second person blurbs"). The last section lists what changed.

## 1. The ask

"also write a brief overview of the core desire and issue of each chakra, in italics. one line blurb, make it apply more generally and specify after the blurb what the core struggle is in particular (x vs. y), drawn"

Read as three things on a sign's page:

1. **One italic line**: what this place in a person wants, and what gets in its way. General: true of anyone, not a description of his own flows.
2. **The struggle as a pair**: "Safety vs. fear".
3. **Drawn**: the pair is a small drawing, not only words (my reading, question 1).

A second ask the same evening, for the same page:

"one question should always show for each chakra, write what that is, the others are editable but this is a grounding practice / etc that isn't from the ? tab"

Read as: each sign has one fixed question that is always on its page. It is a practice to do where he is, not a question to ponder; it is not his to rewrite, it never resolves, and it is never a row on the ? tab. The other questions (the three of rule 37, the deck of PLAN-BLOCKERS.md) stay editable and are untouched. Section 5.

## 2. The copy

Starters, his to rewrite (section 3). In the wiser second person, the app's italic voice (rule 17): "you" is still true of anyone, and it is how the notebook already speaks to him.

| Sign | The line (italic) | The struggle |
|---|---|---|
| Crown | *You want to rest in something larger. You keep a hand on everything.* | Letting go vs. holding on |
| Third eye | *You want to see what is true. The old story speaks first.* | Seeing vs. the story |
| Throat | *You want to be heard as you are. Saying it risks the answer.* | Saying it vs. swallowing it |
| Heart | *You want to love and be loved. What you love can be lost.* | Opening vs. guarding |
| Solar plexus | *You want to act and to matter. One failure reads like a verdict.* | Will vs. shame |
| Sacral | *You want to feel alive. Feeling lets the pain in too.* | Feeling vs. numbing |
| Root | *You want to be safe. The alarm rings when nothing is wrong.* | Safety vs. fear |

Rules for the copy: two short sentences, the want and then what is in its way; 70 characters at most, so it sits on two rules at 390pt and never three (a true single line is about 40 characters, too short to hold both halves); no advice, no "you should"; no Sanskrit, lotus, petal, element or seed letter (lint DL22); no em dashes. The pair is what he wants on the left and what works against it on the right, the same kind of word on both sides, three words at most a side. Heart is "Opening vs. guarding": grief is not what works against love (the gloss says "love and grief", together); guarding is.

## 3. Where it sits

A sign's page today, under the plate (`src/ui/flow/ChakraPage.tsx`, `.ck-gloss` at line 227): the gloss ("Root · feeling safe"), the gate, the shelf, the three questions, the safety lines.

After this plan: **the pair, the line**, the gate, then everything as now. PLAN-BLOCKERS.md puts its Blockers rows under the gate, so the page reads as one thought from the top: the pair, the line, how shut the gate is, what shuts it. The pair's right-hand word (fear) is what Root's blockers (Panic, What if, 3 a.m.) are instances of.

- **The pair takes the gloss's rule.** "Root · feeling safe" and "Safety vs. fear" say the same thing twice, and the header already prints "Root chakra". The `gloss` field stays in `CHAKRAS` for the mountain; the sign's page prints the pair where the gloss was.
- The line is ink in italic serif on the page's rules, two rules, and ends on a blank rule (DESIGN.md rule 5), so the gate below never sits against text.
- The block holds its height from first paint (one rule of the pair, two of the line, one blank), as the shelf and the questions do, so the gate never moves.
- **His to rewrite.** The line is a starter like the editable questions: the sheet that Edit raises (rule 37; PLAN-BLOCKERS.md makes it the deck sheet) carries the sign's line on its first rule, and a rule left empty puts the starter back. The pair is fixed print.
- Not on the page through the door (`ChakraPage.tsx` line 111): that page is for a bad minute and carries as few words as it can.
- Nothing here is tappable, counted or animated on its own. Reduce Motion has nothing to stop.

## 4. The pair, drawn

The app already has the drawing: `parts/Sign` is a lantern that is full of its hue when open and a cold outline drawn in to 70 percent when closed. So the pair is the sign twice, small, on one rule:

```
  [sign, lit]  Safety     vs.     fear  [sign, emptied]
```

- Left: the sign open (`closed` 0), its word in ink. Right: the sign closed (`closed` 1), its word in print grey. "vs." between them in print sans.
- Both are fixed. They do not follow the gate: the large sign on the plate already shows today's reading, and this is what the two ends mean, not where he is.
- A new part, `parts/Versus`, takes a sign kind, a hue and the two words. Tokens only; sizes from the print line's height. No new drawing code, no canvas, no filter.
- **Still**: hues and gate states leave (rules 13 and 34), so the two signs would look the same. In Still the signs leave and the words stay: "Safety vs. fear" in print, the line under it unchanged. The block keeps its height.
- Day, Night and Still all reviewed with the walkthrough's relight control.

The other drawing the app already owns is Be's seam (rule 11): a value and its shadow written across a drawn line, the shadow in italic. It is not used here because italic on the right-hand word would give italic a second meaning in this block. If "drawn" meant something else (question 1), this section falls back to words only and the rest of the plan stands.

## 5. The question that always shows

One per sign, fixed print. Each is a small thing to do with the body or the room, then a question whose answer is in front of him. Second person, italic serif, the app's own asking voice (rule 17), so this one needs no new use of italic. Mine to draft, his to change before the build; after it they are code, not settings.

| Sign | Always shows | The practice in it |
|---|---|---|
| Crown | *Breathe out slower than you breathed in. What can you set down for that long?* | a long breath out |
| Third eye | *Look at the farthest thing you can see. What is actually in front of you?* | the eyes off the story and onto the room |
| Throat | *Say it once, out loud, to the room. What is the sentence?* | the voice used |
| Heart | *Hand on your chest for three breaths. What is it holding?* | touch and breath |
| Solar plexus | *Stand up and drop your shoulders. What can your hands finish in ten minutes?* | posture, then one small act |
| Sacral | *Find where the feeling sits. Does it move when you breathe into it?* | a body scan of one place |
| Root | *Feel your feet on the floor. What are five things you can see?* | feet, then five things seen |

None repeats a starter in `STARTER_ASKS` or the deck in PLAN-BLOCKERS.md section 6 (Root's "What is true right here, in this room?" is the nearest; this one is the doing, that one the thinking).

**Where.** First in the questions block, under the shelf, over the editable ones. No heading (rule 37 allows none); it is told apart by what it lacks.

**How it differs from the others.**

| | The one that always shows | The others |
|---|---|---|
| Whose words | fixed print, the same on every phone | starters he can rewrite |
| In the Edit sheet | no | yes |
| Resolved (PLAN-BLOCKERS.md; Tommy: "other questions are resolvable") | never: no Resolve word beside it, it holds the first place every day | by the word Resolve at its right; it keeps its slot until the page is left, then the next in the deck stands there; kept dated in the Edit sheet |
| On the ? tab | never | never |
| A tap | opens today's page with it as a wise line, linked to the sign, as rule 37; written once a day | the same |
| Through the door | **shown** | not shown |
| Still | not shown (rule 13: Still never asks) | not shown |

**Through the door.** It holds no word of his, so it is safe on the locked page, and a grounding practice is what a bad minute is for. There it is print only: no tap, since the journal is locked.

**Room.** It takes its rules plus a blank rule (rule 5) and is counted into the block's held height, so nothing under it moves on first paint.

## 6. Design rules this touches

- **Rule 17** holds as written: italic serif is the wiser second person, and the line and the always question are both in it. No new use of italic. DESIGN.md gets a new rule: *A sign says what it is for: the pair it comes down to in the gloss's place, drawn as the sign lit and the sign emptied, and under it one italic line in the second person, a want and what is in its way, two rules at most. The line is a starter that is his to rewrite; the pair is fixed print. Never generated, never counted, the signs gone in Still, none of it through the door.*
- **Rule 35** names the gloss in the paper foot; it is amended to name the pair and the line there.
- **Rule 16** ("the app never writes a line for you") holds the way it does for the starter questions: seven fixed starters in the code, short, his to rewrite. Nothing is written at run time.
- **PLAN-MOUNTAIN.md pass 1** took the copy off these pages ("an overview and a bunch of copy... wasn't helpful"). This puts back two short sentences and one pair per sign, and the new rule caps it there.
- **Rule 37** ("a sign asks three questions") gains a sentence: *One more stands first and is not his: a fixed practice for that sign, never in the deck or its sheet, never resolved, never on the ? tab, shown through the door as print.* The count in its title becomes "a sign asks".
- **Lint**: a check that each `line` in `CHAKRAS` is at most 70 characters with no em dash, beside DL22.

## 7. Data and the build

No schema bump, no table.

- `Chakra` in `src/model/mountain.ts` gains `line: string` and `versus: readonly [string, string]`; the `stop(...)` helper takes them; tests assert all seven are set and inside the copy rules. `line` is the starter: the `signShelves` row gains an optional, sealed `line?: string` (his rewrite; absent or empty reads as the starter), with `lineOf(chakra)` and `setLine(chakra, text)` in `model/acts.ts` beside `asksOf`; backup carries it both ways.
- `GROUND_ASKS: Readonly<Record<ChakraId, string>>` in `src/model/acts.ts`, beside `STARTER_ASKS`. Not stored, not sealed, so the door can read it. It touches none of the editable questions' storage. PLAN-BLOCKERS.md (revised 2026-11-17, commit 734e2ae) reads the three from `deckOf(chakra).open`, resolves one with `resolveAsk` and replaces `setAsk` with `setDeck(chakra, texts)`, so L2 draws its row over whatever `deckOf` gives, never addresses a question by place, and carries no Resolve word (it is not in the deck). That plan keeps the block at three questions and its height; this row makes it one more, so L2 owns the change to the held height and to rule 37's wording.
- Two packages:

| | Package | What | Needs |
|---|---|---|---|
| L1 | The pair and the line | the seven starters and pairs, `lineOf` and `setLine`, the line's rule in the Edit sheet, `parts/Versus` with its CSS in `parts.css`, the block in `ChakraPage.tsx` and `chakra.css` in the gloss's place, the DESIGN.md rules, the lint check, vitest for the model and the part in all three lights, one e2e that the gate does not move when the block paints, a step in `design/walkthrough.html` built from the real page | nothing; rebases cleanly under or over PLAN-BLOCKERS.md, except the Edit sheet, which both touch (whichever lands second adds its rule to the other's sheet) |
| L2 | The question that always shows | `GROUND_ASKS`, the row at the head of `Asks.tsx` and on `DoorChakraPage`, the held height, rule 37's sentence, vitest (not in the sheet, not rewritable, written once a day), e2e through the door, a walkthrough step | beside L1; after PLAN-BLOCKERS.md's questions package if that lands first, since both edit `Asks.tsx` |

Both lints pass before the PR, per CLAUDE.md.

## 8. Questions for Tommy

1. **"drawn"**: is the sign lit beside the sign emptied the drawing you meant, or did you mean something else (the two sides as their own small pictures, or the pair drawn from the gloss)?
2. **The pair in the gloss's place**: right, or keep "Root · feeling safe" and print the pair under it?
3. **Through the door**: the pair and the line left off as drafted, or shown there too.
4. **The pairs**: Heart is now "Opening vs. guarding" (was "Love vs. grief"); Throat "Saying it vs. swallowing it"; Sacral "Feeling vs. numbing". Change any.
5. **Two italic blocks a page**: the line by the gate and the always question under the shelf are both second person italic. Far enough apart, or should the always question move up under the line (question 6)?
6. **The always question's place**: first among the questions under the shelf (as drafted), or up by the gate with the line and the pair.
7. **Its tap**: opens today's page like the others (as drafted), or does nothing because it is done in the body, not written.
8. **Through the door and in Still**: shown through the door and hidden in Still as drafted. Still is the one I am least sure of: a grounding line may be the thing Still wants.

## 9. What the audit changed (2026-11-17)

| Was | Now | Why |
|---|---|---|
| "Everyone wants to…", one sentence up to 25 words | "You want to…", two short sentences, 70 characters at most | The drafts ran three rules at 390pt against "one line"; seven lines on one formula read like a textbook; third person in italic broke rule 17 |
| A new rule giving italic a second use | Rule 17 as written | Second person needs no exception |
| Gloss, then the line, then the pair | The pair in the gloss's place, then the line | "Heart · love and grief" over "Love vs. grief" said it twice |
| Heart: Love vs. grief | Opening vs. guarding | Grief is not love's opponent |
| The line fixed print | A starter he can rewrite in the Edit sheet | As the starter questions are; the app's rule is that the words are his |
