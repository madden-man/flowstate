# FlowState v2: a journal first

Date: 2026-11-08. Status: built and deployed 2026-11-08; the next round (playlists under ♪, the pull shows earlier pages) is `PLAN-V3.md` (PRs #11 V5, #12 V3, #13 V4, #14 V1, #15 V2, all merged to main; live at https://flowstate-journal.netlify.app; the walkthrough artifact T8HMcrmXhHUBiTx2TCKjVV republished from design/walkthrough.html). The proposal walkthrough is `design/v2/index.html` (published at https://claude.ai/artifact/U2BU6omFPRKqWJcpeFY7cq, shared with anyone who has the link). `PLAN.md` stays the architecture; this file records the 2026-11-08 review and what Tommy decided.

Tommy's ask: "make it a more cohesive and easy experience. I want it to be intuitive to jump in there and start writing, and I want the council chatroom to be a little easier too. Mostly the questions / entries / organization of everything made it harder to just use it as a journal."

## 1. What the review found (main d77b9d8, 219 vitest green, live site = dist)

1. **The page is not the editor.** Writing happens in a bottom chat-style composer; Return "sends" a line up into a read-only column. Empty, the composer has no placeholder, so a fresh page gives no hint where to write.
2. **Six bands of chrome around the ink.** Header, the Entries / Questions / Earlier / Search row, the Mood plus raw / revisited / integrated row, the echo, the chip row, the install-hint quiet line, then the tabs.
3. **Turn to answer swallows the day.** `turnToAnswer` converts today's entry page into the question, so every other paragraph of the day moves with it and today's page goes blank again (reproduced in the build).
4. **Three places for one thing.** Questions, Earlier and Search are separate screens; council pages are in none of them.
5. **Council needs a chip tap per message.** `nextSpeaker` keeps the tapped chip until another is tapped, so a two-voice exchange is tap, type, tap, type across about fifteen chips.
6. **Dawn and dusk look broken for 40 minutes.** `light.ts` stretches `--t-light` to the whole fade, so the page background crossfades slowly while chips, sheets, rules and the quiet line (no transition on those properties) snap to the new light. Confirmed by screenshot at 06:42 local on 2026-11-08.
7. Smaller: `No.` counts every page kind, so numbers jump; the Earlier list shows entries only; the install hint is the loudest element on the screen in Safari.

## 2. Decisions (Tommy, 2026-11-08)

- Seed **pages** go (the manifesto entry `pg-manifesto`, the models question `pg-models`). Seed **voices stay**, and the two spreads were not named, so they stay too. On his phone a one-time pass removes the two seed pages only if they were never written on; every voice he added or renamed survives. No "Start over" wipe (it would take the voices).
- The **Be spread goes vertical**: pole words on the top and bottom rules, a vertical seam, pairs on one row, dashed slot for a missing balance. Diagonal and rotated corner tags go.
- **"[space to answer left]" leaves the app entirely** (Questions list row in `Journal.tsx`, question page in `PageView.tsx`). The cursor is the only prompt; an answer is whatever is written under the question.
- **Questions are their own section**, reached by a **?** glyph as the **third tab**: Journal · Council · ? · Be · Flow. A mark, not a fifth word, so DESIGN.md rule 7's four words stand; the glyph is set in the serif a size larger, like ♪ in the header. A header placement was weighed and passed on (the header already carries four things; a section belongs in the bar).

Open, not yet decided: dropping Mood and the raw / revisited / integrated entry states from the UI (the plan assumes yes; `page.state` stays for questions, open / answered).

## 3. The shape (one line per walkthrough step)

1. Open on today's page, caret on the first rule; header (moon, Pages, Settings, ♪, No., Date) and the tabs only.
2. Return makes the next paragraph; paragraphs sit on the rules and autosave. Each paragraph is still one `messages` row; the page column is the editor (`writeLine` unchanged, debounced per block).
3. A margin dot marks the current paragraph; tap it and chips step out for that line only (Ink, starred voices, more), then step back. The next Return is ink again.
4. Long press offers five things: Keep close, Speak as, Ask this, Take to the council, Link a page. Reply leaves the journal; Turn to answer becomes Ask this.
5. Ask this: `askThis(page, line)` makes a new question page titled by the line, linked both ways; the line stays on the day's page with an "Asked" link beneath. The day stays whole.
6. Questions (the ? tab): open questions first as serif titles, answered below in print grey with the date answered; New question at the bottom.
7. A question page: Previous and Next (and a horizontal swipe) walk the open questions; "2 of 3 open" in the header, hidden in Still. Writing is plain ink; hold a line, "This answers it" turns it italic (`wise`) and moves the question under Answered. Nothing else marks state.
8. Pages (header word in Journal): entries and councils by month, newest first, search on the first rule. Replaces `/earlier` and the Search sheet. Not offered in Still.
9. Write on any earlier page; a later-day paragraph gets the `fs-dated` marker. No Revisit button; an edit on a later day keeps the old text in `revisions`.
10. A council starts by seating voices (`page.seats`); only they get chips. Take to the council opens this screen with the line as "About". The Council tab is the list with New council always at the bottom; the composer leaves the list.
11. Turns: `nextSpeaker` is round-robin over the seats after each send; a chip tap overrides for one message; Ink is always one tap. Tap a message to reply (quote above the composer); long press keeps Keep close, Speak as, Link. The lamp is unchanged.
12. The spread upright (section 2). `lean` still maps to height, so dragging and `dropGoal` are unchanged; the middle word sits on the seam; versions stay struck through under Edit.
13. Seed: `ensureSeeded` writes settings, voices and the two paradoxes only; `seedManifesto`, `seedModels` and the `ADDITIONS` entry go; the one-time cleanup above. The threshold manifesto is copy, not data, and stays.

Also in the build: the light changes at sunrise and sunset in one `--t-light` breath (the 40-minute stretch goes); `No.` counts entries only.

## 4. Build packages (one PR each, same rules as PLAN.md section 10)

| # | Package | Done when |
|---|---|---|
| V1 | Page as editor | Composer and standing chip row gone; blocks editable in place; Return adds a block; margin dot + inline chips; mood / state rows gone; header carries Pages; dawn fade fix; `No.` counts entries |
| V2 | Questions | ? third tab; list (open, answered); question page with Previous / Next and swipe; This answers it; Ask this replaces Turn to answer; placeholder removed everywhere; Pages screen replaces Earlier + Search |
| V3 | Council | Seats screen; round-robin turns; tap to reply; New council pinned on the list |
| V4 | Be upright | Vertical spread, pairs on rows, slot, seam word |
| V5 | Seed | Seed pages removed from `seed.ts`; one-time cleanup of untouched `pg-manifesto` / `pg-models`; tests and walkthrough updated |

Every PR: `npm test`, `npm run e2e`, three-lights screenshots, `design/walkthrough.html` steps updated from the real components, lints PASS pasted in the body, no em dashes.
