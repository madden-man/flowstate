# Worlds build: where it stands and how to carry on

Written 2026-11-25 for whoever builds next. `PLAN-WORLDS.md` is the plan; this file is the state of the build and the places where the plan no longer matches the repos. Read both before starting.

## Hold

Tommy released W5 and W6 on 2026-11-25 ("ok start w5 and w6"). W7 and W8 wait for his word. Nothing here is on any `main`, and nothing is deployed ("don't deploy anything").

## State

| Package | Repo | Where | State |
|---|---|---|---|
| W0 spike | flowstate | draft PR #106, `worlds-w0-spike` | Never merges. Its phone findings (plan section 13) are unanswered. |
| WF, W1, W2, W4 | flowstate | merged into `worlds-plan` (draft PR #103), head 9be7b95 | Built. W4 was reviewed by a fresh reviewer and its seven findings fixed. W1 was merged unaudited. |
| W3 | NovelCompanion | draft PR #1, `worlds-w3`, head 8bd74b8 | Built as A55, migration 015. Reviewed, seven findings fixed. The fixes have not had a second review. |
| W5 | NovelCompanion | draft PR #2, stacked on `worlds-w3` | Built as A56, reviewed, the review's fixes in. Not merged. |
| W6 | flowstate | draft PR #112, `worlds-w6`, base `worlds-plan` | Songs built: the song page, sections (any Mac `[Name]` round-trips), hold to hum, the pitch line, the key guess, tap tempo, loose hums, the Character chip, Songbook, clips, the move between worlds, lyrics both ways. Taken over mid-stride, audited, fixes in (see the PR). Needs its fresh reviewer. Not merged. |
| W7 | MusicCompanion | draft PR #1, `worlds-w7` | Built, reviewed, the review's fixes in (head 95ab373). Not merged. `~/dev/MusicCompanion` has an uncommitted `package-lock.json` change that is not ours; leave it. |
| W8 | flowstate | not started | See "Walkthroughs" below. |

Worktrees on this Mac: `~/dev/flowstate-worlds` (`worlds-plan`), `~/dev/nc-worlds-w3` (`worlds-w3`). The `flowstate-w0` to `flowstate-w4` and `flowstate-wf` worktrees are merged and can go.

Checks as last run:

- flowstate `worlds-plan` at 9be7b95: `npm test` PASS (1046 unit tests, lints, typecheck). E2E: see the line at the foot of this file.
- NovelCompanion `worlds-w3` at 8bd74b8: lint and typecheck clean, unit 848, integration 343, e2e 298 passed, 2 failed, 38 not run. The two failures (`backstory.spec.ts` SM-9 "a click on an empty spot", `tree.spec.ts` SM-1 "the character page") fail the same way on `main` at db286e5, by the builder's run; the 38 are the rest of those two serial files. The reviewer did not re-check that.

Decided since the plan (Tommy, 2026-11-25), and written into `docs/BRIDGE.md`:

- **One shared database**, `flowstate_bridge`, holds `bridge_worlds`, `bridge_down`, `bridge_up` and `bridge_clips`; the function reaches nothing else. Novel Companion reads its own worlds' pages, messages, inquiries and songs; Music Companion reads songs and takes from every world, and every clip.
- **A song moves between worlds** from the song page (never a loose hum, never to or from his own pages): same ids for life; the destination written whole and checked before the source is deleted; the new world's revs newer than the old world's deletes; a clip already delivered never sent again; a novel's characters tucked on the phone and restored on moving back, for those that bible still has; the old world's outbox drains when it is not worn.
- **Lyrics both ways**: Songbook's pocket carries `lyric` and `lyricAt` a song; a song row carries `lyricAt` (the lyric's own last change on the phone) and `lyricFrom` (exactly the pocket `lyricAt` it started from). A newer pocket never overwrites an unsent edit, and is read again once the edit has gone up. The Mac's `[Name]` section lines round-trip to the identical text.
- **A take** carries `lineText` beside `lineId`; ids are UUIDs; the pitch line is MIDI note numbers, 0 for no pitch.

## Rules that are easy to get wrong

- **Never push NovelCompanion `main`.** A push there rebuilds and reinstalls Tommy's app and migrates the real East Winds bible. Branches and draft PRs only; push with `NC_AUTO_INSTALL=0`. Never run `npm run dev` or the packaged app from a build branch: the keychain holds the Atlas string. Tests use the repo's local replica set.
- NovelCompanion's own `~/dev/NovelCompanion` checkout is far behind `origin/main`. Cut worktrees from `origin/main` or from `worlds-w3`, and clone `node_modules` with `cp -Rc` (from `~/dev/nc-worlds-w3`). If Electron's binary is missing: `node node_modules/electron/install.js`.
- flowstate: PRs go to `worlds-plan`, not `main`. Clone `node_modules` with `cp -Rc`; stage files by name, never `git add -A`. Port 4173 is often taken: `PORT=<free> npm run e2e`. Drags are tested with CDP touch events, not `page.mouse`.
- Each package gets a fresh reviewer who is given the code and the spec, not the builder's account (NovelCompanion SPEC section 9). Both reviews this round found real defects the builders' green suites had missed.
- No em dashes in anything Tommy reads.

## Where the plan is stale (NovelCompanion moved under it)

- A50 to A54 and migrations 012 to 014 were already taken. **W3 is A55 and migration 015; W5 is A56.**
- A52 removed status, provenance, source notes, tags and links between entries. A53 removed saved briefs and session logs. A39 had already removed voice notes.
- So, for **W5**, read the plan's section 7 like this:
  - **File it** (Tommy, 2026-11-25: "i never cared for the 'status idea' thing in novel companion anyway. either make a new way to file things, or simply file it as a new fact in novel companion when needed."): a drafted fact is filed as a plain new entry in the section the router picks, by the capture box's own Route A filing (CR-6), one undo step a group. No status, no source note.
  - **Provenance "researched"**: gone. A kept line from a research page is offered like any other. (My reading; Tommy has not ruled.)
  - **"A page goes into a Claude brief only when he ticks it"**: there are no briefs. Notebook pages show in a "From the notebook" group on Relevant to Session for him to read. (My reading.)
  - **In-story lines "under Voice"**: there is no Voice field any more. Default I proposed and Tommy has not answered: a list on the character drawn from the notebook pages themselves, by story year; the other choice is moments of kind Voice.
- `notebookPages` is not an entry collection (plan section 13 asked). Every entry collection is editable by the write path, the IPC channels and Claude proposals, so it sits outside them, written only by `Repository.applyNotebook`, never an undo step. Trashed notebook pages have no Restore: they come back when the phone sends them again.
- World id is the bible id with `_` written as `-`. Decided questions go down only if changed after the bible was first published to the bridge (`bridge.since` in the bible's `meta`).

## The contract, as it stands after W3 and W4

`docs/BRIDGE.md` and `src/bridge/protocol.ts` are the contract; neither package changed a shape. Since 2026-11-25 (Tommy) the four `bridge_` collections live in one shared database, `flowstate_bridge`, not inside `novel_companion` and `music_companion`; the function reaches no other database, and each app reads `bridge_up` by `world` and `table` (W6, flowstate PR #112). What each side now relies on:

- **Year.** A number is that year. `null` is "The whole book". An absent `year` is no year known (a page written before the first pocket). Both sides read it so.
- **Questions going up.** "This answers it": the question page with `state: "answered"` and `answeredAt`, and a line with `wise: true` whose text is the decision (several wise lines: the newest by `at`). Resolve: `state: "answered"`, `resolvedByTap: true`, maybe no wise line. Taken back: the page again with `state: "open"`. Asked on the phone: a question page with an id the bible does not know. W5 writes these into the bible's open questions; W3 only files the thread.
- **The bible's own decision line** on the phone is `d:<questionId>`. It never goes up.
- **Newer change wins** on a question: the pocket's `changedAt` against the page's `updatedAt`. A bible that reopens a question reopens it on the phone.
- **Councils** carry `reading` (`in` or `about`; absent is about) and `year`. A speaker is `c:<characterId>`, his ink, or another voice (a paper's line, kept with its side). W3 stores the three apart.
- Nothing ever clears `bridge_up`; the desktop reads every row for its world on each pull and skips pages whose signature has not moved. Fine at this size; worth a look before real use.

## Open with Tommy

- The four W5 readings above (provenance, briefs, Voice; File it is decided).
- W4's choices: Research this shows only in a world, at the foot beside Previous and Next; the chips under a journal page appear once it has a word; a council's year is the year worn or The whole book; "In the story" is not offered until a year is worn; seats print full names, conversation chips first names; no haptic tick on the dial.
- From W1 and W2, still open: "+ flow" went with the mountain, so there is no way to make a flow; the Settings World row has Replace and Remove beside Carry now. (The outbox draining only for the world worn is closed by W6: every carry drains every registered world's outbox, worn or not, while some world is worn.)
- Plan section 12's seven questions and section 13's phone checks (W0).
- Not verified anywhere: a real round trip through the deployed function and a real MongoDB; the Atlas custom role; whether the desktop apps' own Atlas users have been given `flowstate_bridge` (the one shared database since 2026-11-25; docs/BRIDGE.md); the dial and the header's year under a real thumb.

## Walkthroughs

- `design/walkthrough.html` (main) is at exactly 300 words outside its mocks, the limit. Adding a step means cutting or splitting.
- W4 added a second one, `design/in-a-world.html` (seven steps from the real app, `script/snap-world-sections.mjs`). It is not published as an artifact. The main walkthrough does not link forward to it. A shelf screen captured at night reads grey when relit to day.
- The plan-stage walkthrough `design/worlds/index.html` is artifact https://claude.ai/artifact/2QN4NwCPZtECWfT1aNBVfu (private). W8 replaces it with two from the real app.

## Next, in order, once Tommy says go

1. W5 on NovelCompanion, stacked on `worlds-w3` (brief it with the readings above and W3's `docs/briefs/W3-HANDOFF.md`).
2. W6 on flowstate from `worlds-plan`, with W7 on MusicCompanion. W6 and W7 share only the song, take and clip shapes in `docs/BRIDGE.md`.
3. W8.
4. Before any of it reaches a `main`: Tommy sets up Atlas and the site (BRIDGE.md, "Setting it up"), W0's phone checks, and schema 10's rule holds: once on main, never deploy a dist built from an older tree.

---

E2E on `worlds-plan` at 9be7b95 (the merge): 126 passed, 1 failed. The failure was `test/e2e/worlds.spec.ts` "the shelf slides under a thumb and settles one cover at a time", a flake that W1's runs also hit. The cause, measured on the W6 branch: CDP stamps each touch when it is dispatched, so on a loaded machine Chromium's velocity tracker read the lift as a fling the wrong way and the shelf snapped back (a lift past halfway returned to the first cover). It failed 7 times in 20 repeats. Fixed on `worlds-w6` (flowstate draft PR #112): the test's thumb stamps every touch 16 ms apart and waits on the shelf's own `data-settled`. `Shelf.tsx` no longer settles while a finger is on the shelf, which was a real bug of its own (a pause mid-slide ticked and lit the lamp under the held thumb), and a new e2e covers that. W5, W6 and W7 are all in progress on draft PRs: NovelCompanion #2, flowstate #112, MusicCompanion #1.
