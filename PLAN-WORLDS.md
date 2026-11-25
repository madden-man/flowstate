# FlowState Worlds: don a world, and the notebook becomes the book's

Date: 2026-11-25. Status: planned, not built. The walkthrough is `design/worlds/index.html` (`node script/build-worlds-walkthrough.mjs`): the phone screens are the app's own page parts and CSS, set with what this plan would show. Packages are W0 to W8 (W for world). Three repos: FlowState, Novel Companion, Music Companion.

Tommy's ask: "we should have a 'creative mode' for flowstate where i don the world and the other sections are reimagined for that novel. for example, i might select east winds creative mode, and then i can journal about the book, host councils with all the characters, answer questions in the questions section, and define some of the larger messages/themes in the 'be' section via the existing values configuration. this would all be parallel to my personal journaling." And: "everything should go to the bible, not just kept lines, though i want it to be integrated into novel companion rather than just thrown in there like a journal entry."

`PLAN.md` stays the architecture and `DESIGN.md` the standard. This plan adds two new screens on the phone: the shelf of notebooks that Flow becomes (section 4) and the song page (section 6). Everything else is the Journal, the Council, the Questions and Be as they are, on a second notebook.

## 1. Decisions taken (Tommy, 2026-11-25)

| # | Decision |
|---|---|
| 1 | A world is worn, not tagged: East Winds has its own pages, councils, questions and Be, parallel to the personal ones. |
| 2 | Worlds are chosen in the Flow tab, and choosing one is what the tab is for (decision 14). |
| 3 | The app reopens in the world it was left in. |
| 4 | What goes to the bible from a world: councils whole, questions and their answers, and from the Journal only the lines he keeps ("instead of porting over entire journal entries, let's just include 'kept' lines. councils are sent over wholesale still."). It follows the phone afterwards: an edit, a delete, or a line no longer kept reaches the bible's copy. |
| 5 | Every clear fact in what crosses (a kept line, a council about the story) is offered to the bible as a change. |
| 6 | A council is either in the story or about the story. It defaults to about. |
| 7 | Be works in a world (themes as values, characters as champions) but maps to nothing in Novel Companion. |
| 8 | There is a Songbook world for songs that belong to no novel. |
| 9 | Research takes questions for the book. |
| 10 | The inbox bridge is the way across. |
| 11 | In a council his own lines are plain ink, the Ink chip as built. There is no voice named for him. |
| 12 | An in-story council offers no facts: dialogue is not canon. |
| 13 | Be in a world has no copy but the backup file, and that is fine. |
| 14 | Flow is made plain. "instead of keeping the whole mountain, let's greatly simplify the flow section. focus it around the world picker, and make that really dynamic and a cool ui. meditate, energize, and research should still show." And: "this means removing all the animations and the chakras and all the prompts and music album picks and all." |
| 15 | A world is worn with a year. Every page and council takes it. It is its own setting on the phone, separate from Novel Companion's story year, and it goes to the bible with every page. |
| 16 | Every notebook, his own included, can wear up to five album covers he picks through the Spotify tie-in, or a drawing he uploads. Neither is required, and the app never draws one for him: with neither, the cover is plain paper in its hue. |
| 18 | A kept line goes to the bridge with the chips and context it needs to be understood on its own. |
| 17 | The shelf answers the hand: the lamp takes the hue of the cover in front, a tick as it lands, and the covers lean with the phone. |

## 2. What this breaks, and what it keeps

| Rule today | After this plan |
|---|---|
| "No server" (PLAN.md section 2; netlify.toml "static files only") | Broken, once. One Netlify function, `bridge`, on the FlowState site. It is the only thing on the web that holds the Atlas string. PLAN-RESEARCH.md kept this rule; this plan cannot, because a phone cannot reach MongoDB itself. |
| "No network outside `src/music/` and `src/research/`" (CLAUDE.md rule 6, DESIGN.md rule 22, lint DL21, `check-dist`) | A third fenced place, `src/bridge/`, opt-in: nothing is sent until a bridge token is pasted in Settings and a world is donned. The requests are same origin (`/.netlify/functions/bridge`), so `check-dist` gains no host. |
| "Nothing of Tommy's stored anywhere but the phone" | Kept for the personal notebook, by construction (section 3). A world's pages are stored in Atlas in the clear, as the bible already is. |
| "No model-written text anywhere" | Kept. Every council line is his. Nothing a model writes is shown on the phone. |
| Novel Companion ARCH-8, Music Companion ARCH-2: one database each, never another | Kept. The bridge's collections live inside `novel_companion` and `music_companion`, prefixed `bridge_`. |
| Novel Companion: every entry is written through the one write path | Kept. The function writes only `bridge_` collections. Novel Companion itself files what arrives. |

## 3. The core move: a world is a second notebook

`openDB(name)` already takes a name, `fields.init(target)` already points every read and write at a database, and no screen imports the schema. So a world is a second Dexie database with the same schema and the same PIN key.

- **Names.** `flowstate` is the personal notebook, unchanged. A world is `flowstate-w-<worldId>` (`flowstate-w-eastwinds`, `flowstate-w-songbook`).
- **Home and book.** `fields.ts` keeps two handles: `home` (always the personal database) and `book` (the notebook being worn; the same as home when none is). Tables read and write `book`. `don(worldId)` and `doff()` swap `book` without dropping the key, unlike `init`.
- **The settings row splits.** These stay on home's row whatever is worn: the lock, the light and place, sounds and haptics, the Spotify tokens, the Research key, the PWA fields, and three new ones: `world` (the one worn, for reopening), `bridge` (the token, sealed, and the two cursors) and `worlds` (the registry as last fetched). These are the book's own: `seededAt`, `cleaned`, `deleted`, `echo`, `beFolded`, `lastBackupAt`.
- **No leak by construction.** `src/bridge/` is handed a world's database and never `home`. A test opens the personal notebook, writes in every table, and asserts the outbox is empty and no request is made.
- **Seeds.** A world notebook seeds nothing: no pantheon, no paradoxes, no flows. Its voices and questions come from the bible (section 5).
- **What is empty in a world.** The flows, episodes, sits and fixations tables exist and stay empty. Meditate, Energize and Right now are reached only from My own pages.
- **The door.** The ring under the lock's keypad (PLAN-FLOWS.md 3.7) always opens the personal Right now, whatever is worn (question 1).
- **Backup.** Export and import act on the notebook worn, and the file's name says which. Be in a world has no other copy (decision 7), so the backup is its only one.

## 4. The shape on the phone

- **Flow is the shelf.** The mountain is gone (section 4.1). The Flow tab is one view: a shelf of notebooks across the top, and under it what the notebook in front has to offer.
- **The shelf.** Each notebook is a cover: "My own pages" first, then East Winds, then Songbook. A cover carries the notebook's name in the serif and one hue on its spine. The covers slide sideways under the thumb and settle one at a time in the middle, the ones beside it smaller and fainter. The one being worn says "Open" in print.
- **What a cover wears.** Plain paper in its hue; or up to five album covers; or a drawing he uploads from Photos or Files. The albums sit as a band across the top of the cover, the first one chosen the largest and the rest beside it; one album fills the band. The drawing is kept in that notebook, sealed, and is in its backup; it never leaves the phone.
- **Choosing the albums.** Hold a cover and a sheet rises, "East Winds wears". It shows the tiles of the playlists he has ticked under ♪, from the covers already cached, so it works offline once they are read. A tap ticks a tile and the others quieten (the album grid's own hush); a sixth tap does nothing and one line says "Five at most." The order tapped is the order worn. Below the tiles, two rows: "Upload a drawing" and "Plain paper". Not connected to Spotify: the sheet says so and offers Connect, as the ♪ sheet does. This is the picking the signs' shelves had, kept for the notebooks.
- **The year on the cover.** A novel's cover carries a dial along its foot: the bible's timeline from its first year to its last, each character a thin line from birth to death in their colour, and one upright stroke at the year worn. Dragging the dial moves the year before stepping in.
- **Under the shelf**, for the cover in front: who is alive that year and how old, in print; one open question from the bible, "Waiting"; the last line written in that notebook, in the quiet italic with its date; then that notebook's rows. My own pages: Meditate, Energize and Research as three drawn circles in a row, and Right now. East Winds: Songs and Research. Songbook: Songs.
- **Lamp, tick and tilt.** When a cover settles in front, the lamp takes its hue by the same mix the council uses for its last speaker (`--lamp-voice`, none by day), and one `check` tick sounds through `parts/Haptic`. The covers lean a few degrees with the phone's own tilt. Nothing moves unless the hand or the phone does. Reduce Motion: no lean. Still: no hue, no lifelines' colour, no lean.
- **Donning.** A tap on the cover in front, on the waiting question, or on any of its rows puts that notebook on: the cover opens as a page turns (rule 29), with the soft bell through `parts/Sound`, and the Journal, the question or the row tapped is there. Sliding only looks; nothing is worn until a tap.
- **The year worn.** The header prints "East Winds · 2071" over the date on every tab. A tap on the year raises the same dial as a sheet, with the bible's chapters and world events marked on it. A new page or council takes the year worn; the Year chip changes one page alone.
- **Ages at the council.** The seats screen prints each character's age that year ("Dawn Li, 9"); one not yet born or already dead is dimmed and can still be seated. A council about the story may be set in "The whole book" instead of a year; an in-story council always has a year.
- **Knowing where you are.** The notebook header prints the world's name and its year over the date on every tab. Nothing else changes: the same paper, the same three lights, the same tabs in the same places.
- **Reopening.** The app opens in the world left. The lock screen prints the world's name under the manifesto line so the keypad says which notebook it opens.
- **Journal.** Pages as today, and they stay on the phone. A line he keeps (hold a line, "Keep close", as built) is what goes to the bible; the small "kept" mark on the line is the only sign.
- **A kept line stands alone.** It goes with its page's date, the year worn, and chips of its own. The phone fills those chips itself at the moment of keeping: the page's chips, plus any character or place the page names in its other lines, found on the phone from the bible's lists. So "She keeps it for a year" arrives saying Dawn Li, 2071. The sheet shows the chips and he can change them. No other line of the page leaves the phone. Under the page, where the council keeps its voice chips, three chips: Character, Place, Year. They are filled from the bible's lists and say what the page is about. They are optional; names in the text are found anyway (section 7).
- **Council.** The voices are the bible's characters (section 5). The seats screen "Who sits?" gains one choice in print, two words: "About the story" and "In the story", About chosen. It can be changed later, and the bible follows. His own lines are plain ink (the Ink chip, which takes no turn); the bible reads an ink line as his.
- **Questions.** The bible's open questions are the list. "This answers it" and Resolve decide the question in the bible. A question asked on the phone is a new open question there.
- **Be.** Starts empty. Values, tiers, shadows and champions work as built, with the characters as the voices a champion can be. Nothing leaves the phone.
- **Research.** The page as built, reached from the notebook's rows under the shelf. A question page gains one word at its foot, "Research this", which carries the question to the Research page and keeps the link.
- **The ♪ line.** As built. Its shelves are per notebook, so a world's playlists are its own.
- **Still** (rule 13): as built, in every world. No count of pages carried, questions open or facts offered anywhere (rule 15).

### 4.1 What leaves Flow

Taken out of the app's screens: the mountain and its drawing, the stream and the gates, the seven signs and their pages, the readings, the questions and albums under each sign, the touches on the water (marks and days), and every animation that belonged to them. Meditate, Energize and Research keep their own pages unchanged; only the way in changes, from circles in the sea to circles under the shelf.

- **Data.** Nothing is deleted. The tables (`readings`, `signShelves`, `marks`, `days`, `flows.chakra`) stay in the schema and in backups, unread. Removing them is a later, separate choice.
- **The flows and the door** (Panic, the valley and the rest, PLAN-FLOWS.md): question 1. Built on its default, Right now stays as one row under My own pages and the ring under the lock's keypad still opens it.
- **The ♪ line** keeps its playlists and shelves; only the picks under the signs go.
- **Rules.** DESIGN.md's rules for the mountain and the signs (34 and its neighbours) and lint DL22 are retired with the code, in the same PR.

## 5. The bridge

One Netlify function, `netlify/functions/bridge.mts`, with the MongoDB driver. Two environment values: `BRIDGE_MONGODB_URI` (an Atlas user that can read and write only the `bridge_` collections of the two databases) and `BRIDGE_TOKEN`. The phone sends the token as a bearer; without it the function answers 401 and touches nothing.

| Collection | In | Written by | Holds |
|---|---|---|---|
| `bridge_worlds` | both databases | the desktop apps | One row a world: id, name, kind (`novel` or `songs`). Novel Companion writes one a bible; Music Companion writes Songbook. |
| `bridge_down` | both | the desktop apps | The pocket: what the phone needs to wear the world. One row a world, with a version stamp. |
| `bridge_up` | both | the function | Envelopes from the phone: `{ world, table, id, rev, deleted?, row }`. Newest `rev` for an id wins. |
| `bridge_clips` | `music_companion` | the function | A hum's audio as binary, until Music Companion has pulled it to disk, then removed. |

**The pocket for a novel:** characters (id, full name, first name, Chinese name, family colour, the years born and died), places (id, name, community), chapters (id, title, story year), world events (id, title, year), the story year (the phone's year starts from it once) and the timeline's ends, and every open question (id, question, state, decision, last changed). **For Songbook:** song ids and titles.

**On the phone, `src/bridge/`:**

- **Outbox.** A new table. The one write path in `fields.ts` adds `{ table, id }` to it on every put and delete, only when `book` is a world and only for what travels: a council page and its messages; a question page and its messages; a journal message while it is kept (with its page's date, the year, and the line's own chips, decision 18; never the page or its other lines); `inquiries`, `songs`, `takes`. A line no longer kept goes up as a delete. Values, voices and the music tables never enter it.
- **Up.** Sent in batches when a write settles, when the app is hidden (`fetch` with `keepalive`), and on opening. A row leaves the outbox when the function acknowledges it. Offline, the outbox waits. Rows are unsealed to send, so nothing goes up while the app is locked.
- **Down.** The pocket is fetched on donning and on opening, if its version stamp moved.
- **Voices from characters.** One voice a character: id `c:<characterId>`, name the full name, given the first name, hue from the family colour, light, no twin. A character renamed in the bible is renamed here; one deleted there is archived here, so old councils still read.
- **Questions from the bible.** One question page an open question, the page's id the question's id. Decided in the bible: the page moves under Answered with the decision as its wise line. Decided on the phone: section 7.
- **Settings.** A World row: paste the token, "Carried" with the time of the last send, and one word, "Carry now".
- The service worker never caches or falls back for `/.netlify/functions/*`.

## 6. Songs: lyrics and melody

In any world, Flow's Songs row lists that world's songs. In Songbook it is the first thing.

- **A song page** is ruled paper with the title at the title size and the lyric below, one line a rule. A blank rule starts a section; a section's name (Verse, Chorus, Bridge) is print in the margin, chosen from chips. A line's syllable count is not shown (rule 15).
- **Hum.** One act under the thumb: hold to record, lift to stop. The take is drawn as it is sung: a single line rising and falling with the pitch, left to right as a pen would (rule 27). A take can be pinned to the lyric line the caret is on, or left loose on the song.
- **What the take knows.** The pitch line, a key guess (Music Companion's `keyfinder.ts` is pure TypeScript and is copied in, with its known-answer tests), and a tempo if he taps one. The guess is print, and absent when the confidence is low.
- **Loose hums.** Songs has one row above the list, "Hum", for a melody with no song yet. It becomes a song when it is given a title.
- **In a novel world**, a song takes the Character chip, so a theme can belong to someone.
- **Data.** `songs`: `{ id, createdAt, updatedAt, title, lyric, sections, key?, bpm?, characterIds? }`, title and lyric sealed. `takes`: `{ id, songId?, at, seconds, audio (blob), pitch (number[]), key?, bpm?, lineId? }`, the audio sealed like everything private. A take is capped at three minutes.

## 7. Novel Companion: how it becomes part of the bible

Nothing arrives as a loose journal entry. A journal page never arrives at all: only its kept lines do, each on its own. Councils and question threads arrive whole. What arrives lands in two layers.

**Layer one: it lands as written, attached to what it is about.** No approval; it is his writing and contradicts nothing.

- A new entry collection, `notebookPages`, written through the one write path, read-only on the desktop because it follows the phone (every field a system field). Its id is the phone page's id. It holds the kind (kept line, council, question thread, research; a kept line is a row of one line, its id the line's id), the council's reading, the title, the date, the story year (or none for the whole book), the lines (id, speaker's character id or none for ink, text, wise, kept), and the chips.
- A bridge service in main pulls `bridge_up` when a bible opens, when the window comes to the front, and every ten minutes. Each line goes through the Capture Router's free stages (CR-1 to CR-4: parse, resolve names, score) against the bible's `RouterIndex`. The page is linked to every character, place, chapter and year its chips and its text name.
- Each character, place and chapter screen gains a Notebook list: date and first line, captioned by kind and story year. A kept line is its own row and is all there is to read; a council or thread opens across the screen (the A49 pattern). Search finds them.
- Relevant to Session gains a "From the notebook" group: pages whose cast, place or year match the section being written. They are for him to read. A page goes into a Claude brief only when he ticks it (SB-9).
- **Follows the phone.** A newer `rev` replaces the row and its links are read again. A deleted council or thread, or a line no longer kept, goes to the trash (ED-5).

**Layer two: every clear fact is offered.**

- A line the router sends on Route A (CR-5) is drafted as a bible change. The drafts wait in a tray, "From the notebook", grouped by the day's kept lines or by council, each as the ED-7 diff with its chips, as the capture box shows them (CR-6).
- "File it" writes a group's ticked drafts as one undo step, status idea, source note "From the notebook, <date>." Nothing is written before File it.
- A line that needs judgment (Route B or C) waits as a card with "Send to Claude". Nothing is sent, and nothing is spent, until he presses it.
- A draft dismissed stays dismissed. Its key is the line's id and the text it had, so an edited line is offered again and an untouched one never is.
- When a line changes on the phone, its unfiled drafts are redrawn. A change already filed stays; it is the bible's now.

**By kind:**

| From the phone | In Novel Companion |
|---|---|
| Kept journal line | Layers one and two, the line alone. Unkept on the phone: it leaves the bible, and its unfiled drafts go with it. |
| Journal page, the rest | Stays on the phone. |
| Council, about the story | Layers one and two. Attached to the question, chapter or characters it names. Nothing is recorded as a character's voice. |
| Council, in the story | Layer one. Each character's lines are listed on that character under Voice, by story year from the Year chip. No facts are offered from dialogue (decision 12). |
| Question and its answer | The open question itself, written directly as one undo step: the wise line fills Decision and sets Decided. Taking the answer back reopens it. The thread is a notebook page linked to the question. |
| Research | A notebook page linked to the question it was asked from: each paper's title, journal, year, side and DOI. A line kept on a page written with "Write about it" is offered with provenance researched. |
| Song | A stub on each character it names: the title, and that it lives in Music Companion. |

## 8. Music Companion: sketches

- The bridge service pulls song and take envelopes from its own `bridge_up`. A take's audio is fetched from `bridge_clips`, written to `audio/sketches/<take id>.m4a` beside the songs' recordings, and removed from Atlas, so the rule that no audio stays in Atlas holds.
- A new collection, `sketches`: `{ _id, songId?, recordedAt, seconds, pitch, key?, bpm?, lineText?, world? }`. A song keeps its one recording; it gains a list of sketches under it. Loose hums are their own list.
- A phone song becomes a `songs` row. Its title is given the work date in front, as the title rule requires. Lyrics follow the newest edit on either side (question 5).

## 9. Data (FlowState schema version 10)

- New tables in every notebook: `outbox` (`++n, [table+id]`), `songs` (`id, updatedAt`), `takes` (`id, songId, at`).
- `Page` gains `reading?: 'in' | 'about'` (absent is about), `chips?: { characterIds, placeIds, year }` and `asked?: { inquiryId }` on a question page. `Inquiry` gains `pageId?`. All optional and unindexed.
- A world notebook's own settings row gains `year?` (the year worn) and `cover?: { albums: string[] } | { drawing: Blob }` (at most five album URIs, in the order worn; the drawing sealed). The personal notebook's row has `cover` too.
- `Message` gains `chips?: { characterIds, placeIds }` on a kept line in a world, set at keeping.
- `Page` gains `year?: number | null` (null is the whole book), set from the year worn when the page is made.
- `Settings` gains `world?`, `worlds?` and `bridge?: { token, upAt, downAt, pocket }` on home's row, the token sealed.
- `SCHEMA_VERSION` 10. The upgrade writes nothing. **Once this is on main, never deploy a dist built from an older tree.**
- Routes: `#/flow/songs`, `#/flow/songs/:id`, `#/flow/hum`. `#/flow` is the shelf, opening on the cover of the notebook worn. `#/flow/c/:chakra` and the sign routes are removed.
- Novel Companion: schema 12, migration 012 (the `notebookPages` collection and its indexes), amendments A50 and A51 to SPEC.md. Music Companion: the `sketches` collection and a SPEC section.

## 10. Build packages (one PR each)

| # | Repo | Package | Done when |
|---|---|---|---|
| W0 | FlowState | The spike, on the phone | On a branch deploy, from the installed Home Screen app: a hum recorded with `MediaRecorder`, its size and format; a pitch line drawn from it; one round trip to a function with a token; a send with `keepalive` as the app is hidden; the phone's tilt read after the one permission tap iOS asks for. Findings written into section 12. Nothing merges. |
| WF | FlowState | Flow made plain | Section 4.1: the mountain, the signs and everything under them out of the routes, the code, the lints and the main walkthrough; the shelf with one cover, My own pages, and its circles and Right now beneath; Meditate, Energize and Research reached from it. Tests for the removed screens go with them. No schema change. |
| W1 | FlowState | Two notebooks | Home and book in `fields.ts`; `don` and `doff`; the settings split; the other covers on the shelf, sliding and settling, with the lamp, the tick and the lean; the sheet that picks a cover's albums (up to five, from the ♪ playlists' cached tiles) or takes a drawing; the last line and the rows under each; the header's name; reopening in the world left; no seeds in a world; the door stays personal; backup per notebook. Works with no bridge, on a fixture registry. The no-leak test of section 3. |
| W2 | FlowState | The bridge and its fence | The function, its token check and its four collections; `src/bridge/` with the outbox, up and down; DL21 and `check-dist` amended; the Settings World row; schema 10. Tests on a stubbed function. E2E: with no token, nothing leaves the origin anywhere in the app. |
| W3 | Novel Companion | The pocket and the notebook (A50) | The registry row and the pocket published on open and on change; the bridge service; `notebookPages` and migration 012; kept lines, councils and threads land, link, follow the phone and trash; the Notebook list on character, place and chapter; the page across the screen; search. |
| W4 | FlowState | The sections in a world | The year worn: the dial on the cover and as a sheet from the header, the stamp on each page, ages and dimming on the seats screen, "The whole book"; a kept line's own chips, filled on the phone from the page; the waiting question under the cover; voices from characters; questions both ways; the council's reading on the seats screen; the three chips; Research from a question. |
| W5 | Novel Companion | Facts and questions (A51) | The "From the notebook" tray; drafts grouped by page; File it as one undo step; dismissed stays dismissed; Route B and C cards wait; questions written directly; in-story lines under Voice; the Relevant to Session group; research provenance. |
| W6 | FlowState | Songs | The song page, sections, hold to hum, the pitch line, the key guess, tap tempo, loose hums, the Character chip, the Songbook world. |
| W7 | Music Companion | Sketches | The registry row and pocket; the bridge service; clips pulled to disk and removed from Atlas; `sketches`; phone songs as songs; the stub sent on for Novel Companion. |
| W8 | FlowState | The walkthroughs | Two, each the real app on recorded bridge fixtures: "Wear a world" (don, write, council, answer, see it in the bible) and "Songs" (hum, lyric, find it on the Mac). The last step of the first links to the first of the second. |

Order: W0 and WF; then W1 and W2 together; then W3; then W4 and W5 together; then W6 and W7 together; then W8. Every FlowState PR: `npm test`, `npm run e2e`, three-lights screenshots, both lints PASS in the body, its walkthrough steps, no em dashes. Each Novel Companion package gets an independent reviewer per its SPEC section 9.

## 11. Rules touched

- **CLAUDE.md rule 6 and DESIGN.md rule 22:** a third fenced place, `src/bridge/`, same origin only, opt-in by token.
- **PLAN.md section 2 and netlify.toml:** one function; the site is no longer static files only.
- **New rule 40, a world is worn (review):** the header names the world on every screen; nothing else marks it there, no new colour, no badge. On the shelf a cover takes one voice hue for its spine and no other; in Still the covers are paper and seam, no hue. The shelf moves only with the thumb, with the phone's own tilt, and when a cover opens; nothing on it breathes or drifts. The lamp takes the front cover's hue by the council's own mix, so by day there is none. The personal notebook and a world never show each other's pages.
- **Rule 15:** no count of pages carried, drafts waiting or questions open. **Rule 13:** Still as built. **Rule 27:** the pitch line is drawn as it is sung. **Rules for the mountain and the signs:** retired (section 4.1).
- **Tokens:** none new expected.

## 12. Open questions (each built on its stated default unless Tommy says otherwise)

1. **The flows and the door.** Default: Right now stays as one row under My own pages, the flows stay reachable from it, and the lock screen's ring still opens it. The other choice is to take them out with the mountain.
2. **The old data** (readings, marks, days, sign shelves). Default: kept in the notebook and its backups, unread.
3. **A world's rows in Atlas, plain or sealed?** Default: plain, as the bible is. Sealing them needs a passphrase typed into the phone and both Macs.
4. **Notebook pages in Claude's briefs.** Default: only the ones he ticks.
5. **A lyric edited on the phone and on the Mac.** Default: the newest edit wins, and Music Companion's daily snapshot is the way back.
6. **Which bible questions come down.** Default: every open one, and any decided after the world was first donned.
7. **Where the albums come from.** Default: the playlists already ticked under ♪, no new Spotify request. The other choice adds a search box (Spotify's search needs no new permission).
8. **A hum's length.** Default: three minutes at most.

## 13. Not verified

- That the installed app can read the phone's tilt (iOS asks once, from a tap; W0). Without it the covers simply do not lean.

- That `MediaRecorder` and the microphone work in the installed Home Screen app on his iPhone without asking again on every open (W0).
- A hum's size, and that it fits a Netlify function's request limit (W0).
- That a send with `keepalive` completes when iOS hides the app (W0). The outbox is designed for the case where it does not.
- That a pitch line drawn from a phone hum is good enough to read a melody from (W0).
- That Novel Companion's field manifest can make a whole entry collection read-only (W3 confirms, or `notebookPages` is kept outside the entry collections with its own reader).
- How many of a real page's lines the router sends on Route A. Journal prose is looser than a Cmd+K line; the tray may run thin or noisy until the thresholds are tuned on real pages.
- That one Atlas user can be limited to the `bridge_` collections of two databases (a custom role; checked in W2).
