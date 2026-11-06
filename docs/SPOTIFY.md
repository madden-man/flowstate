# Spotify in FlowState: setup

How "tap an album, it plays on the phone" works, and what is reused from tommysthoughts.com. Companion to `PLAN.md` §8.1 and `src/music/spotify.ts`.

## What is reused from tommysthoughts.com, and what is not

tommysthoughts.com keeps three Spotify values in Netlify for its server functions: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REFRESH_TOKEN` (refresh-token grant in `server/_shared/spotify.js`).

| Value | Reused in FlowState? | Why |
|---|---|---|
| Client id | No. FlowState has its own Spotify app, client id `a4ee189148b042dc8bfda38b9aed4cd2` (Tommy, 2026-11-07), baked into `src/music/spotify.ts` | A client id is public by design; PKCE needs nothing else, and a separate app keeps the two sites' settings apart |
| Client secret | No | FlowState has no server; anything in its JavaScript is readable by anyone who opens the site |
| Refresh token | No | Same reason, and it carries playlist-write scopes, so leaking it would hand over the account |

FlowState signs in once on the phone with Authorization Code + PKCE and keeps its own refresh token in the `settings` row, encrypted with the PIN key like every other text field. The secret and the tommysthoughts token never leave Netlify.

## One-time steps in the Spotify dashboard (Tommy)

The FlowState app at https://developer.spotify.com/dashboard needs:

1. **Redirect URIs.** Tommy registered `https://flowstate.netlify.app/` on 2026-11-07, but that Netlify name was already taken by someone else, so the site is `flowstate-journal`. **Still to do: add `https://flowstate-journal.netlify.app/` as a redirect URI in the dashboard.** The app calls `redirectUri()` from that origin with the trailing slash. For local dev add `http://127.0.0.1:5173/` as well; Spotify no longer accepts `http://localhost`, only the loopback IP.
2. **User Management.** The app is in development mode, so only its owner's account and listed accounts can sign in. The owner is allowed automatically; nothing to add unless a second account should play.
3. **Web API** ticked under the app's APIs (set when the app was created). No client secret is ever copied anywhere.

Nothing else changes; the tommysthoughts functions keep working.

## Scopes FlowState asks for

```
user-modify-playback-state   start an album on the phone
user-read-playback-state     know which device is active, and what is playing
user-read-currently-playing  the now-playing poll that writes page.music
playlist-read-private        read the thinking playlist if it is ever made private
```

Playback control needs Spotify Premium on the signed-in account.

## How a tap plays the playlist from an album

1. The album sheet is built from `GET /playlists/0T6Gzc2hN81u3vGC5IJZ9a/tracks`, paged, grouped by album in first-appearance order. Covers are stored as blobs in Dexie, so the grid draws offline.
2. Tap a cover: `PUT /me/player/play` with `{ context_uri: "spotify:playlist:0T6Gzc2hN81u3vGC5IJZ9a", offset: { uri: <that album's first track> } }`. The context is the playlist, not the album, so when the album ends Spotify carries on into the next album in "For the Poems and the Prose" (Tommy, 2026-11-07).
3. If Spotify answers 404 `NO_ACTIVE_DEVICE` (the Spotify app has been closed for a while), FlowState opens `spotify:playlist:0T6Gzc2hN81u3vGC5IJZ9a` as a link, which wakes the Spotify app on the playlist, and retries the play call after a moment.
4. While a page is open, `GET /me/player/currently-playing` runs every 20 s and writes the album onto the page.

## Local test before package 0 exists

```
cd ~/dev/flowstate && npx vite --host 127.0.0.1 --port 5173
```

Open it on the phone over the same Wi-Fi is not possible with a loopback redirect, so test the sign-in on the Mac first, then on the phone once the Netlify URL is registered.
