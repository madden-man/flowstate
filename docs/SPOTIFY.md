# Spotify in FlowState: setup

How "tap an album, it plays on the phone" works, what Tommy sets once in the Spotify dashboard, and what is reused from tommysthoughts.com. Companion to `PLAN.md` §8.1. The code: `src/music/spotify.ts` (the Web API calls), `src/music/connect.ts` (the sign-in and token upkeep), `src/music/covers.ts` (the album shelf), `src/model/music.ts` (a page's album), `src/ui/music/` (the ♪ line, the sheets, the Settings rows).

## What is reused from tommysthoughts.com, and what is not

tommysthoughts.com keeps three Spotify values in Netlify for its server functions: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REFRESH_TOKEN`.

| Value | Reused in FlowState? | Why |
|---|---|---|
| Client id | No. FlowState has its own Spotify app, client id `a4ee189148b042dc8bfda38b9aed4cd2` (Tommy, 2026-11-07), in `src/music/spotify.ts` | A client id is public by design; PKCE needs nothing else, and a separate app keeps the two sites apart |
| Client secret | No | FlowState has no server; anything in its JavaScript is readable by anyone |
| Refresh token | No | Same reason, and it carries playlist-write scopes |

## One-time steps in the Spotify dashboard (Tommy)

The FlowState app at https://developer.spotify.com/dashboard needs:

1. **Redirect URIs.** `https://flowstate-journal.netlify.app/` (with the trailing slash; the app sends exactly that) is registered, plus the same without the slash. **For local dev add `http://127.0.0.1:5173/`.** Spotify refuses `http://localhost`, so the app will not start a sign-in from `localhost` at all; Settings says "Open the app at 127.0.0.1 to connect" instead.
2. **Premium.** Since February 2026 every development-mode app needs its owner on Spotify Premium, and the play call needs Premium on the signed-in account. Without it Settings still connects and the grid still draws, but a tapped cover says "Playing from here needs Spotify Premium".
3. **User Management.** Development mode: only the owner and listed accounts can sign in. Tommy is the owner; nothing to add.

## Connecting (Settings, "Music")

1. Tap **Music: Connect Spotify**. The app makes a PKCE verifier and a random state, keeps them in `sessionStorage` (with a copy in `localStorage`, in case iOS hands the return to a fresh web view of the installed app), and goes to `accounts.spotify.com/authorize` with `response_type=code`, `code_challenge_method=S256`, the four scopes below and `redirect_uri` = the app's own origin plus `/`.
2. Spotify sends the phone back to `https://flowstate-journal.netlify.app/?code=…&state=…`. On load the app reads the code, cleans the URL at once with `history.replaceState` (back to the screen Connect was tapped on), checks the state, and trades the code at `/api/token` with the verifier. No secret is sent.
3. The tokens and the account name are written to `settings.spotify.tokens` through the store, so they are sealed with the PIN key like every other secret field. Settings opens again and reads "Connected as …"; the playlists are read straight away (below).
4. If something goes wrong, Settings shows one plain line under the row, never an alert:
   - declined on Spotify's page: "Not connected: the sign-in was declined";
   - a state that does not match, or a code Spotify will not trade: "Not connected: Spotify refused the sign-in";
   - **a redirect Spotify rejects** (an address not in the dashboard): Spotify shows its own error page and never comes back. When the app comes to the front again with the sign-in still pending and no code, Settings says "Spotify did not send you back: add <this address> to the app's redirect URIs";
   - the journal locked mid-way: "Unlock the journal, then connect again".
5. The access token is refreshed before it runs out (30 s early), once more on a 401, one refresh at a time (Spotify may rotate the refresh token). A refused refresh (`invalid_grant`) disconnects and Settings says "Spotify ended the session: connect again".

**Disconnect** in the same row removes the tokens. The kept covers stay, so old pages still show theirs.

## Scopes

```
user-modify-playback-state   start an album on the phone
user-read-playback-state     know which device is active
user-read-currently-playing  the now-playing poll that writes page.music
playlist-read-private        /me/playlists, and a private playlist's items
```

V7 added no scope: `playlist-read-private` already covers `/me/playlists`, so nobody has to connect again.

## Playlists (V7)

- **The list.** On connect and from **Settings, Playlists, Read again**, the app reads `GET /me` (the account id) and then `GET /me/playlists?limit=50`, following `next`, asking for `id,name,uri,snapshot_id,images,owner(id)` and the count under both `items(total)` and `tracks(total)` (February 2026 renamed the key; whichever came is read). Unchanged by the February 2026 Development Mode migration. Each kept playlist is a row in the `playlists` table, in Spotify's order.
- **Ownership.** Only playlists whose `owner.id` is the signed-in account's id are kept: since February 2026 the items of anyone else's playlist are refused anyway. Nothing is hardcoded; whatever a playlist is named on Spotify is what shows.
- **Choosing.** The **Your playlists** sheet lists every owned playlist with a drawn check. The very first list ticks "For the Poems and the Prose", as the version 2 upgrade does for a journal that already had its covers, so nothing changes until Tommy ticks more. Ticking one reads it at once (the quiet line says "reading master (ii)"); unticking keeps its covers. ♪ opens on the list of the ticked ones.
- **A playlist's shelf.** `GET /playlists/{id}/items`, 50 a page, following `next` (February 2026 renamed `/tracks` to `/items` and each entry's `track` to `item`; both are read). Episodes and removed tracks are skipped. Tracks are grouped by album in the order each album first appears, each keeping its first track; that is the `shelves` table, one row per album per playlist. One cover per album is kept as a Blob in the `albums` table however many playlists hold it, so the grids draw offline. An album that leaves a playlist leaves that playlist's shelf only; its cover stays.
- **Snapshot skip.** A playlist is read again only when its `snapshot_id` in the list has moved since its shelf was read, or it was never read. Read again reads the list first, so an unchanged playlist costs one list entry, not forty pages.
- **The throttle rule.** Playlists are read one after another, never in parallel. A `429` stops the read there and Settings says "Spotify asks for a pause, about 4 minutes" from its `Retry-After`; nothing asks again by itself, and a tap before the pause has passed only repeats the line (the TommysThoughts 24-hour throttle of 2026-11-05 came from a loop). A playlist Spotify refuses for another reason is one plain line and the next one is read.
- **Covers for a big playlist.** A read fetches the first fifteen covers, four at a time (the list's strip of six and the grid's first screen). A tile below the fold fetches its own cover when it is scrolled near, never more than four at once, and keeps it.

## Playing

- **No account:** the ♪ line in the page header opens `spotify:playlist:0T6Gzc2hN81u3vGC5IJZ9a`, which wakes the Spotify app on the playlist; if the page is still in front a moment later (no app), it opens `https://open.spotify.com/playlist/0T6Gzc2hN81u3vGC5IJZ9a`. Both are navigations, never fetches.
- **Connected:** ♪ opens the list of ticked playlists; a name opens its grid of covers, the word Playlists at the head goes back. A tap sends `PUT /me/player/play` with `{ context_uri: <that playlist's uri>, offset: { uri: <that album's first track> } }`, so the playlist runs on into the next album (Tommy, 2026-11-07). A short bell sounds. The phone's Spotify plays; FlowState only points it.
- **No active device** (404 `NO_ACTIVE_DEVICE`): the sheet says "Open Spotify on the phone first". The app does not leave to wake Spotify by itself.
- Offline, a tap says "No connection to Spotify" and nothing breaks.

## A page remembers its album

While a Journal entry, a question or a council page is open, in front and connected, `GET /me/player/currently-playing` runs every 20 s. The first album heard playing is written onto `page.music` (`albumUri`, `album`, `artist`, `coverId`) through the store, once; it never changes after. That page then shows the small cover beside ♪ in its header forever, offline, from the kept blob. **Hold the small cover** for "Pages with this album": every page that heard it, newest first (today only in Still). Still never starts or stops music.

## Local test

```
cd ~/dev/flowstate && npx vite --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/` (not `localhost`) on the Mac once `http://127.0.0.1:5173/` is in the dashboard. A loopback address cannot be reached from the phone, so test the phone on the Netlify site.
