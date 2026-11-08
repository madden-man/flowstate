# FlowState v3: playlists under ♪, earlier pages under the pull

Date: 2026-11-08. Status: built, merged and deployed 2026-11-08 (PR #17 V6, PR #16 V7, main 4b59990, live at https://flowstate-journal.netlify.app; the walkthrough artifact T8HMcrmXhHUBiTx2TCKjVV republished). Section 7 still waits on Tommy. Tommy's ask: "1) showing multiple playlists to choose from when clicking music icon (master, for the poems and the prose, staging, candidate, and others, where the album covers are shown in the order of the first song from the album), 2) when the app is dragged down, it shouldn't go to dark mode, it should show earlier notes/conversations". `PLAN.md` stays the architecture, `PLAN-V2.md` the journal-first review; this file records what is there today, what changes, and the two build packages.

## 1. What is there today (main 076dcd0, 219 vitest, 10 Playwright specs)

**Music.** One playlist is baked in: `PLAYLIST_ID` in `src/music/spotify.ts` ("For the Poems and the Prose"). `readPlaylistItems` pages `/playlists/{id}/items` at 50 a page; `groupAlbums` keeps each album in the order its first track appears, with that first track's URI. `covers.ts` writes the albums into one `albums` table keyed by `albumUri` with `order` (its place in the one playlist) and the cover Blob; `shelf()` is "every album with order >= 0". `tapMusic` opens the `music` sheet, titled with the hardcoded name, a grid of tiles; `play` sends `context_uri: spotify:playlist:<the one id>` with the album's first track as offset. Settings has Music (connect) and Refresh playlist. The order Tommy asks for (albums by their first song) is already what `groupAlbums` does; what is missing is the list of playlists and the shelf per playlist.

**The pull.** `parts/Blind.tsx` on every `parts/Page`: a downward drag that starts on a scroller at its top moves the page with the finger; above it hangs `.fs-blind`, a panel in Still's light with the ring; past 80px `settle()` enters Still (one tick, the low tone). The moon in the header also enters Still. DESIGN.md rule 13 ("Still is one gesture from anywhere: pull the page down or tap the moon") and rule 20 ("the blind follows the drag") describe it; `test/e2e/still.spec.ts` and the blind section of `journey.spec.ts` test it; walkthrough step 22 "Pull the page down" shows it.

**Earlier pages** already have a screen: `JournalPages` at `#/journal/pages` (entries and councils by month, newest first, search on the first rule), reached by the header word Pages. "Conversations" are council pages; `pagesList()` in `src/model/pages.ts` returns both kinds with the voices who spoke.

## 2. Decisions and assumptions

Tommy decided (2026-11-08): several playlists under ♪, chosen from his own; the pull no longer enters Still, it shows earlier notes and conversations. The moon stays the way into Still.

Assumed, say so if wrong:

- **Which playlists show.** Spotify is the source of the names, nothing is hardcoded: the app reads `GET /me/playlists` (unchanged by the February 2026 Development Mode migration; only other users' playlists went) and Tommy ticks the ones he wants under ♪ in Settings. "For the Poems and the Prose" is ticked by the upgrade so nothing changes until he ticks more. TommysThoughts calls the big one "master (ii)" and has a "pre-approved"; whatever they are named on Spotify is what shows.
- **♪ opens on the list of playlists**, every time, the one playing marked. Opening straight on the last playlist would save a tap but hide the choice he asked for.
- **Letting go past the line leaves a drawer open**, not a navigation: the last few pages stay hanging above today's page until a row is tapped, the page is pulled back up, or a tab changes. The whole list is one more tap (an "All pages" row at the bottom, the existing Pages screen). The drag already previews the rows, which is the point of a pull.
- **In Still the pull does nothing**, as the moon does nothing in Still: Still is today only (rule 13), and the page list is hidden there already.

## 3. The shape (one line per walkthrough step)

1. **Pull the page down.** Today's page follows the finger; above it, in the same light, the last pages hang like cards on a rail: date in print grey, who spoke if it was a council, the first line in serif. (Replaces step 22; moves to sit after "Pages".)
2. **Let go past the line.** The rail stays: six pages, newest first, the one you are on left out; "All pages" is the last row and goes to `#/journal/pages`. Tap a row and that page opens; tap the page beneath, pull up, or change tab and the rail goes back up.
3. **Still is the moon.** Step 23 "Still" keeps its screen; its line becomes "Tap the moon." The ring is still the exit; rule 13 loses the pull.
4. **Choose a playlist.** ♪ opens a sheet titled Playlists: each ticked playlist is a row, its name in serif on the rule and a strip of its first six covers beneath (first-song order), the one playing carrying a small cover beside its name. No account: ♪ still deep-links to the Poems playlist, as now.
5. **Put on an album.** Tap a name and the sheet shows that playlist's grid, every album in first-song order, the sheet title now its name and the word Playlists at the head to go back. A tap plays the playlist from that album's first track, on that playlist's `context_uri`, and runs on. (Existing step 26, retitled.)
6. **Your playlists (Settings).** The Music row gains Playlists under it: a sheet listing every playlist the account owns, newest first as Spotify lists them, a drawn check (parts/Check) per row; ticking one reads it at once ("reading master (ii)" as the quiet line), unticking keeps its covers. "Read again" at the bottom re-reads the ticked ones; a playlist whose `snapshot_id` has not moved is skipped. Replaces the Refresh playlist row.

## 4. Package V6: the pull shows earlier pages

One PR. Files: `src/ui/parts/Blind.tsx` becomes `src/ui/parts/Pull.tsx` (the gesture is kept as is: touch events, DECIDE_PX, PROMPT_MS, `free()`, the 80px commit, the click swallow); the panel becomes `EarlierRail` in `src/ui/parts/Earlier.tsx`; `Page.tsx` mounts both; `parts.css` restyles `.fs-blind` as `.fs-earlier` in the current light (no `data-light="still"` on the panel); `src/ui/still.ts` loses nothing (`settle` stays for the moon).

- **Data.** `earlierPages(exceptId, limit = 6)` in `src/model/pages.ts`, built on `pagesList()`: entries and councils, newest first, the open page left out. Read when the pull arms (the rows are ready before the finger has moved 8px) and again on `dataVersion`.
- **The rail.** Rows reuse `.fs-list-row` (date, council spokes, first line) so the Pages screen and the rail look the same; the last row is the word All pages. The rail is as tall as its rows (at most 45% of the page, the current drag cap) and the page's `translateY` on commit equals the rail's height, so the rows sit exactly where the drag left them. Open state is a signal `earlierOpen`; a tab change (`openSheet` already closes on tab change; mirror it), a row tap, a tap on the page below, or an upward drag past 40px closes it.
- **Still.** `start()` returns early when `still.peek()` is set, as now; the rail is never shown in Still.
- **Haptics and sound.** No tick on commit (rule 19 lists the ticks; opening a list is not one), no bell. The settling tick and the low tone stay with the moon.
- **Design docs.** DESIGN.md rule 13: "Still is a tap on the moon, from anywhere." Rule 20: "the rail of earlier pages follows the drag." PLAN.md section 8 bullet "Still" edited the same way. `docs/walkthrough.html`: steps 1 to 3 above; the lint must stay under 300 words.
- **Tests.** `still.spec.ts`: enter Still by the moon instead of the pull, keep every other assertion (the light, the kept line, leaving changes nothing). `journey.spec.ts` blind section: the same swap. New `earlier.spec.ts`: two pages written on earlier days, the CDP touch drag from `still.spec.ts`, the rail shows both rows with the newest first and today's page absent, letting go short of 80px puts the page back, letting go past it leaves the rail, tapping a row opens that page, pulling up closes it, and in Still the drag moves nothing. Unit: `earlierPages` order and exclusion.

Done when: pulling any page down shows earlier pages in the current light and never changes the light; Still is reached by the moon only; all e2e specs green; the walkthrough's pull step shows the rail.

## 5. Package V7: playlists under ♪

One PR, or two agents on the model/UI seam (sections 5.1 and 5.2 against 5.3 and 5.4) in worktrees merged together, as V1 to V5 were.

### 5.1 Data (schema version 2)

- New table `playlists`: `{ id, name, uri, order, snapshotId, total, chosen, readAt?, coverUrl? }`, key `id`, index `order`. `order` is the position in `/me/playlists`.
- New table `shelves`: `{ playlistId, albumUri, order, firstTrackUri }`, key `[playlistId+albumUri]`, index `playlistId`. One row per album per playlist, `order` its first-song position in that playlist.
- `albums` keeps `albumUri`, `album`, `artist`, `cover`: one cover per album however many playlists hold it. Its `order` and `firstTrackUri` fields stay on old rows and are no longer read.
- `SCHEMA_VERSION` 2 with a Dexie `upgrade`: every `albums` row with `order >= 0` becomes a `shelves` row for playlist `0T6Gzc2hN81u3vGC5IJZ9a`, and a `playlists` row for it is written with `chosen: true` and the known name, so the shelf is there before the first read. `TABLES` gains both names (the backup and import walk `TABLES`; check `src/db/backup` round-trips Blobs for the new rows as it does for `albums`).
- `shelf(playlistId)` replaces `shelf()`; `keepCover` and `pagesWithAlbum` are unchanged (a page still remembers an album, not a playlist).

### 5.2 Spotify (`src/music/spotify.ts`, `covers.ts`, still the only fetching code)

- `readMyPlaylists(t)`: `GET /me/playlists?limit=50`, following `next`, `fields` asking for `id,name,uri,snapshot_id,images,owner(id)` and the count under both `items(total)` and `tracks(total)` (the February 2026 rename; read whichever came, as `item ?? track` is read today). Only playlists the account owns are kept (items of others are refused anyway).
- `playlistItemsPath(id)` replaces the `PLAYLIST_PATH` constant; `readPlaylistItems(t, id)`. `groupAlbums` unchanged. `playBody(playlistUri, firstTrackUri)`; `playFromAlbum(t, playlistUri, album)`.
- `storeShelf(playlistId, albums, ...)` replaces `storeAlbums`: `shelves` rows for that playlist written at once (tiles appear before any cover), albums missing from the new read removed from that playlist's shelf only, covers fetched four at a time as now, each written as it lands.
- **Big playlists.** The master is likely a few thousand tracks: 40 or more item pages and hundreds of albums. Three guards: a playlist is re-read only when its `snapshot_id` changed or Tommy taps Read again; playlists are read one after another, never in parallel; a `429` stops the read and keeps `Retry-After` in `readNote` ("Spotify asks for a pause, about 4 minutes"), never retried in a loop (the TommysThoughts 24-hour throttle of 2026-11-05 came from looping). Covers at 300px run about 25 KB each; 500 albums are about 12 MB in IndexedDB, within the persisted budget, but tiles below the fold fetch their cover only when scrolled near (an IntersectionObserver on the grid, rows of four), so the first read of a huge playlist does not pull every cover at once.
- No new scope: `playlist-read-private` already covers `/me/playlists`; nobody has to reconnect.

### 5.3 State and the ♪ sheets (`src/ui/music/`)

- `state.ts`: `playlists` signal (chosen ones, in order), `shelfOf(playlistId)`, `openPlaylist` signal (which grid the sheet shows, `null` for the list), `readPlaylists()` (the `/me/playlists` read, on connect and from Settings), `refreshChosen()`. `tapMusic` resets `openPlaylist` to `null`. `play(playlist, row)`.
- `MusicSheet.tsx`: two screens in the one `music` sheet. List: a row per chosen playlist, serif name, strip of its first six covers (from the shelf, offline), the playing playlist's name with the small cover beside it; no counts in Still (rule 13: "14 albums" shows in day and night only, if at all; the plan shows none). Grid: as today, titled with the playlist's name, the word Playlists at the sheet head to go back; `aria-pressed` on the playing album. Sheet title changes in `--t-ui`.
- With no account, `tapMusic` keeps deep-linking to the Poems playlist.

### 5.4 Settings

- `MusicRows.tsx`: Refresh playlist goes; a Playlists row (connected only) opens a `playlists` sheet (new `SheetName`). The sheet lists every owned playlist with a drawn check; ticking writes `chosen` and reads that playlist at once; the quiet line names what is being read; Read again at the bottom. One plain line for a refused read, never an alert.
- The first read after connecting reads `/me/playlists` and then the chosen ones (the Poems playlist from the upgrade).

### 5.5 Docs and tests

- `docs/SPOTIFY.md`: a Playlists section (the `/me/playlists` read, ownership, snapshot skip, the throttle rule); PLAN.md 8.1 pointed here.
- `design/walkthrough.html`: steps 4 to 6 above (the old music step becomes step 5); covers stay inline data URIs; lint under 300 words.
- Unit: `groupAlbums` unchanged; `readMyPlaylists` paging and the `items ?? tracks` count; `storeShelf` writing rows before covers, removing an album from one playlist's shelf only, keeping the cover; the Dexie upgrade from a version 1 database with ordered albums; snapshot skip; the 429 stop. E2e `music.spec.ts`: stub `/me/playlists` with three playlists and two of them chosen, the list shows two names with cover strips, tapping one shows its grid in first-song order, a tile tap sends that playlist's `context_uri`, the Settings sheet ticks the third and its grid appears.

Done when: ♪ lists the chosen playlists with covers, each grid is in first-song order and plays on its own playlist, Settings chooses from Spotify's list, a version 1 database upgrades with its covers kept, lints and tests green.

## 6. Order

V6 first (small, no schema change, removes a rule the walkthrough still shows), then V7. Each PR: `npm test`, `npm run e2e`, screenshots in all three lights, walkthrough steps from the real components, the two lint PASS lines in the body, no em dashes. Deploy from `~/dev/flowstate` only (`npm run build`, then `netlify deploy --prod --dir dist`), then republish the walkthrough artifact T8HMcrmXhHUBiTx2TCKjVV.

## 7. Open for Tommy (defaults in section 2 stand until answered)

1. Chosen playlists in Settings, or every playlist the account owns under ♪ with no choosing?
2. ♪ opens on the list every time, or on the last playlist played with Playlists one tap back?
3. The pull leaves a six-page rail open, or lands on the full Pages screen?

## 8. V8 fixes (2026-11-08, from Tommy's use on the phone)

- **Council and the keyboard.** The composer was lifted by padding, so iOS scrolled the page up and the conversation left the screen. The Council now uses the Journal's fit (`src/ui/parts/Keyboard.ts`, shared): the app takes the visible height above the keyboard, and the chat column stays pinned to its newest line whenever it shrinks, unless scrolled back to read.
- **master (ii) under ♪.** The API reads it fine (122 pages, 879 albums, about 32 seconds). It never showed because only Poems was ever ticked, and the playlist list was only read from Settings. Now the playlists Tommy named (Poems, master (ii), staging, candidate; ids in `src/music/poems.ts`) are ticked once each, and an untick stays (`spotify.ticked`). The first ♪ of a session also reads the list and any chosen playlist whose snapshot moved. This answers 7.1: chosen playlists, with his named ones chosen for him.
- **Be is a list.** A row per paradox, its two poles facing across a short seam; a tap opens the spread under its row, a second tap closes it; `#/be/:id` opens that one. DESIGN.md rule 11 says so.

## 9. V9: the cover cache and a tile that plays (2026-11-08)

- **Covers** are kept as bytes with a fetch date, and fetched again only after 30 days; a stale one shows until its fresh one lands (`src/music/covers.ts` `COVER_MAX_AGE`, `isFresh`). Blobs in IndexedDB are not trusted on iOS.
- **A tile plays** the album's first song within the chosen playlist even when Spotify is idle (found by `/me/player/devices` and played by `device_id`) or not running (opened, then played on coming back); shuffle goes off; a song refused by uri is tried by its place. docs/SPOTIFY.md, Playing.

## 10. V10: names for the voices (2026-11-08)

Tommy: "make room for me to name each of the voices (the roles, like architect, king, etc. should show on tap)". A voice keeps its role in `name` and gains an optional `given` name (clear, like the role, so chips draw before unlock). `voiceLabel` (the given name, else the role) is what every chip, speaker line, placeholder and list shows; the voice sheet has Name then Role; a tap on the name above a line (`parts/Speaker.tsx`) shows "GUS · ARCHITECT" without replying; the Voices screen shows the role beside the other words a voice goes by. A name change goes onto revisions like any rename.

## 11. V11: council lines can be edited and deleted (2026-11-08)

Long press a council line: **Edit** turns it into a field where it stands (Return or leaving keeps the words, Escape puts them back, an emptied line goes) and **Delete** asks on the same row with a second tap, never a dialog. `editMessage` keeps an earlier day's text as the Journal's `revise` does; `deleteMessage` leaves a reply its own words and drops the quote.
