# The bridge (PLAN-WORLDS.md section 5, W2; one shared database since 2026-11-25)

One Netlify function, `bridge`, on the FlowState site. The phone reaches it same origin at `/.netlify/functions/bridge`, only from `src/bridge/`, and only once a bridge token is pasted in Settings and a world is worn. It is the only thing on the web that holds the Atlas string.

- Function: `netlify/functions/bridge.mts` (the driver and the environment), `netlify/lib/bridge.ts` (the handler, tested against a fake driver in `test/bridge/function.test.ts`).
- Protocol: `src/bridge/protocol.ts`, shared by the phone and the function, so every limit and allow-list is written once.

## What it may touch

One database, `flowstate_bridge` (`BRIDGE_DB` in `src/bridge/protocol.ts`; Tommy, 2026-11-25: one shared database), and in it only these four collections:

| Collection | Written by | The function | Read by |
|---|---|---|---|
| `bridge_worlds` | the desktop apps: Novel Companion a row a bible, Music Companion Songbook's | reads (the registry) | the function |
| `bridge_down` | the desktop apps, each its own worlds' pockets | reads (a world's pocket) | the function |
| `bridge_up` | the function | reads and writes (envelopes) | Novel Companion: its own worlds' `pages`, `messages`, `inquiries` and `songs` (a stub on each character a song names). Music Companion: `songs` and `takes` from every world. |
| `bridge_clips` | the function | reads and writes (a take's audio, W6) | Music Companion, every clip, any world; it removes a clip once pulled |

`coll()` in the handler refuses any other database (Novel Companion's `novel_companion` and Music Companion's `music_companion` included: neither is reachable through the function) and any other collection name. A world is a `bridge_worlds` row with a kind it knows (`novel` or `songs`); its kind says which app writes its pocket and no longer picks a database. An unknown world is refused (`404`), and nothing is read or written for it. Every stored envelope carries its `world` and `table`, which is how each app finds its own: a song written in East Winds is one row in `bridge_up`, read by Music Companion whole and by Novel Companion for its stub.

## The protocol

Every request: `Authorization: Bearer <BRIDGE_TOKEN>`. A missing or wrong token, or none set on the site, is `401` and nothing is read or written (compared in constant time over SHA-256 digests). Every answer: `cache-control: no-store`.

| Request | Answer |
|---|---|
| `GET ?op=worlds` | `{ worlds: [{ id, name, kind }] }` from the one registry |
| `GET ?op=pocket&world=<id>&stamp=<s>` | `{ world, stamp, unchanged: true }` when the phone's stamp is the pocket's; else `{ world, stamp, pocket }`; `404` for no world or no pocket yet |
| `POST ?op=up`, body `{ world, envelopes }` | `{ acks }`, one an envelope, in order |
| `POST ?op=clip&world=<id>&take=<id>&rev=<n>`, body the audio, `content-type: audio/*` | `{ take, result }`; stored in `bridge_clips` as `{ _id: "<world>:<take>", world, take, rev, type, bytes, audio, at }` |

**Envelope:** `{ world, table, id, rev, deleted?, row? }`. `table` is one of `pages`, `messages`, `inquiries`, `songs`, `takes`; `id` matches `[A-Za-z0-9._:-]{1,120}`; `rev` a positive whole number; `row.id` equals `id`; a delete carries no row. Stored in `bridge_up` as `{ _id: "<world>:<table>:<id>", world, table, id, rev, deleted, row, at }`.

**Ack:** `{ table, id, rev, result, reason? }`. `stored`: written. `same`: that rev was already there (a resend after a lost answer); nothing rewritten. `older`: a newer rev is there; this one dropped. `refused`: a check failed (`reason` names it); nothing written. The first three let the phone clear its outbox entry; a refused one waits.

**Limits:** 64 KiB a row, 200 envelopes a batch, 1 MiB a body, 4 MiB a clip. A send as the app is hidden keeps its body under 60 KiB (the keepalive budget is 64 KiB for every keepalive request in flight).

**What a row holds** (`src/bridge/up.ts`, only the fields named there leave the phone): a council or question page (`id, kind, title, state, createdAt, updatedAt, answeredAt, resolvedByTap, seats, reading, chips, asked, year`); a council or question line (`id, pageId, at, updatedAt, voiceId, text, replyTo, kept, wise, paper`); a kept journal line alone (`id, at, updatedAt, text, wise, kept, kind: "kept", date, year, chips`: never its page, its title or its other lines); a question researched (`id, askedAt, question, state, pageId` and the picked papers' public record); a song (`id, createdAt, updatedAt, title, lyric, sections, key, bpm, characterIds`); a take without its audio.

**How a question reads in the rows** (W4; no new table, only the page and line rows above):

- Answered on the phone ("This answers it"): the question's page row with `state: "answered"` and `answeredAt`, and a line row with `pageId` the question's id, `wise: true` and `text` the decision. With more than one wise line, the newest by `at` is the decision.
- Resolved on the phone (the word Resolve): `state: "answered"` and `resolvedByTap: true`; there may be no wise line (decided, no words).
- Taken back: the same page again with `state: "open"`. That is also how the phone reopens a question the bible decided: "Not the answer" on the bible's own decision line sends the page open and nothing else.
- Asked on the phone: a page row with `kind: "question"`, `state: "open"`, an id the bible does not have (a UUID), `title` the question and `year` the year worn.
- The bible's own decision line (`d:<questionId>`) came down and is never sent back, whatever is written to it on the phone.
- Down, the newer change wins: a question in the pocket sets the page's state only when its `changedAt` is at or after the page's own `updatedAt` on the phone (down writes `updatedAt` to that `changedAt`). So a pocket still saying decided after he took the decision back changes nothing until the bible changes the question again. Whenever the pocket sets a page answered, the decision line is wise again; whenever it reopens one, the line stays but is no longer wise.
- A council carries `reading` (`"in"` or `"about"`, absent is about). On a page or a kept line, `year` is the story year; `null` means the whole book; absent means no year is known (written before the world's first pocket). A kept line carries `chips`. A question researched carries `pageId` on the inquiry and `asked.inquiryId` on the page.

**The pocket** (`flowstate_bridge.bridge_down`, `{ _id: <worldId>, stamp, pocket }`, written by Novel Companion in W3 for each bible and Music Companion in W7 for Songbook): for a novel `{ kind: "novel", characters: [{ id, fullName, firstName, chineseName?, familyColour?, born?, died? }], places, chapters, events, storyYear?, span?, questions: [{ id, question, state: "open" | "decided", decision?, changedAt }] }`; for Songbook `{ kind: "songs", songs: [{ id, title }] }`. The registry row (`flowstate_bridge.bridge_worlds`): `{ _id: <worldId>, name, kind }`, kind `novel` or `songs`. World ids are unique across both apps (one collection).

## Songs, takes and clips (W6; what Music Companion reads, W7)

**Titles.** Songbook's pocket titles begin with Music Companion's work date (`"2026-11-25 The grey coat"`); the phone shows them without it, and a song written on from the pocket goes up titled without it (Music Companion drops a leading date on a title sent up, and keeps its own).

**A song row** (`table: "songs"`, `SongRow` in protocol.ts): `{ id, createdAt, updatedAt, title, lyric, sections, key?, bpm?, characterIds?, lyricAt?, lyricFrom? }`. `lyric` is the whole lyric, lines separated by `\n`; a blank line starts a section. `sections` is `[{ line, name }]`, `line` the 0-based index in `lyric.split("\n")` of a section's first line and `name` one of `Verse`, `Chorus`, `Bridge`; an unnamed section is not listed. `key` is unused so far (a take carries its own). `bpm` is the tempo he tapped, a whole number from 30 to 300. `characterIds` only in a novel world, ids from that bible's pocket.

**Lyrics both ways (added after W7's review; the one shape change, additive).** Every time here is epoch milliseconds, as every time on the phone's rows is.

- Songbook's pocket carries each Mac song's lyric: `songs: [{ id, title, lyric?, lyricAt? }]`, `lyricAt` the Mac's time of the lyric's last change. A song opened on the phone from the pocket starts with the pocket's lyric (never empty unless the Mac's is) and remembers that `lyricAt` as its `lyricFrom`.
- A song row's `lyricAt` is when the lyric itself last changed on the phone (absent if he never edited it there); `lyricFrom` is the pocket `lyricAt` his text started from (absent if it started from nothing: a song born on the phone). A rename, the key, the tempo, the sections' names and the chips never move either.
- A later pocket with a newer `lyricAt` than the song's `lyricFrom` replaces the phone's lyric only if the phone has no unsent lyric edit (a `lyricAt` of its own while the row still waits to go up); taken, `lyricFrom` becomes the pocket's `lyricAt` and the phone's own `lyricAt` is cleared. What he typed is never overwritten; what came down is never sent back.
- The phone always sends `lyricAt` and `lyricFrom` as epoch milliseconds (Music Companion also accepts ISO). `lyricFrom` is exactly the pocket `lyricAt` value the phone's text started from, copied, never rounded or re-read.
- **Section lines.** The pocket `lyric` is the Mac's text, its sections written as `[Name]` lines inside it, and the Mac rebuilds such lines from a phone row's `sections` (each a `[Name]` line above the line it starts on). On the phone a pocket lyric is read with each exact `[Name]` line (brackets, the name trimmed, nothing else on the line) taken out of the text and kept as that line's section name; any name survives, not only Verse, Chorus and Bridge, and a name at the very end stands past the last line. So a pocket lyric sent back unedited rebuilds to the identical Mac text (`test/songs/songs.test.ts`, the round trip). A line such as ` [aside]` or `[ aside ]`, which the Mac would not write back the same, stays as text.
- Music Companion applies a phone lyric only when its `lyricAt` is newer than its own and its `lyricFrom` matches its current text's time (or its lyric is empty); otherwise it adds the phone's text once under a `[From the phone]` section. It also takes a phone edit as an edit of its current text when the Mac still holds exactly the phone text it last took, so a run of phone edits on a song born on the phone needs no pocket read in between (Music Companion `worlds-w7` 95ab373; nothing for the phone to do).

**A take row** (`table: "takes"`), without its audio: `{ id, songId?, at, seconds, audioType, pitch, key?, bpm?, lineId?, lineText? }`.

- `songId` absent: a loose hum. A loose hum given a title becomes a song: a new song row, and the take sent again with `songId`.
- `at` is when it was recorded (epoch ms). `seconds` its length, to a tenth, at most 180.
- `pitch`: one number every 0.05 s, evenly over `seconds`: a MIDI note number (69 is A4, 57 is A3) to two decimals, `0` where no pitch was heard. Three minutes is 3600 numbers.
- `key`: print such as `"G minor"` or `"F# major"` (tonic as Music Companion's key finder spells it, then `major` or `minor`); absent when the key finder's confidence was under 0.15 or less than two seconds was sung.
- **`lineText` is the pinned line's text, and Music Companion prefers it over `lineId`.** `lineId` is the 0-based index of the lyric line the take is pinned to, in `lyric.split("\n")`, written as a decimal string** (`"0"` is the first line), as the song stood when this take row was sent. `lineText` is that line's text at the same moment, so a reader can show the line without the lyric, and can find it again if the lyric it holds is newer or older than the take (the index can be stale against a different lyric version; the text is the safer key). The phone keeps both current: when lines come or go above a pinned take, the take is re-pinned and sent again. Both absent: loose on its song.
- `audioType` is the clip's type, parameters dropped: see below.

**Ids.** A song's and a take's id made on the phone is a UUID from `crypto.randomUUID()` (36 characters, `[0-9a-f-]`), so it always matches Music Companion's file-name rule `[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}`. A song first made on the Mac keeps the id its pocket gave it: written on from the phone, it goes up under that id, never a new one. **A song or take keeps its id for life.** A song moved to another world (W6, "Move to") arrives under the new world with the same ids, its takes too; the old world sends a delete for each. **The same id arriving under another world is the same song moved: Music Companion must not read the delete under the old world as the song's end** (order of arrival is not guaranteed). The revs settle it: the phone deletes the old copy first and then writes the song and every take under the new world again, so **every envelope of a move under the new world has a rev newer than every delete under the old**; take the newest rev across worlds for an id. A song is gone only when it is deleted under the world that sent it last (the newest rev for its id, across every world, is a delete).

**Clips** are always written to disk on the Mac before they are removed from Atlas, even when their take has since been deleted. `POST ?op=clip&world=<id>&take=<id>&rev=<take.at>`, sent only after the take's row was acknowledged, once (the phone marks it; a take moved to another world is not sent again if its clip already went, and one still owing goes under the new world). The body is the bytes as `MediaRecorder` made them; the `content-type` header is the recorder's type and the function stores it without parameters as `type`:

- The phone asks the recorder for `audio/mp4;codecs=mp4a.40.2` (AAC in MP4) first, then `audio/mp4`, then `audio/webm;codecs=opus`, then `audio/webm`, and sends the type it got with its parameters dropped.
- **iPhone (Safari, the installed app): `audio/mp4`, AAC.** File it as `.m4a`. Not yet confirmed on Tommy's phone (W0's findings are unanswered); Safari 14.1 and later record AAC in MP4.
- **Chromium: `audio/mp4`** as well, seen in the e2e on HeadlessChrome 158 (it reports `audio/mp4`, `audio/mp4;codecs=mp4a.40.2` and `audio/webm;codecs=opus` all supported, so the phone's first choice, AAC, is what it records). An older Chromium (before about 126) records no MP4 and sends `audio/webm` (Opus): file that as `.webm`.
- Anything else `audio/*` is possible from another browser; take the extension from `type`, never assume `.m4a`.

## Setting it up (not run; Tommy's to do on the site and in Atlas)

1. In Atlas, the custom role and user below.
2. On the site, for functions only: `BRIDGE_MONGODB_URI` (that user's connection string) and `BRIDGE_TOKEN` (`openssl rand -hex 32`).
3. Deploy as usual. Paste the token into Settings, World, on the phone.

## A custom role for the one Atlas user (UNVERIFIED)

Atlas custom roles take privileges on a database and a named collection. The function needs only these, all in `flowstate_bridge`, and it never deletes (Music Companion removes a clip after pulling it, with its own user):

| Resource | Actions |
|---|---|
| `flowstate_bridge.bridge_worlds` | `FIND` |
| `flowstate_bridge.bridge_down` | `FIND` |
| `flowstate_bridge.bridge_up` | `FIND`, `INSERT`, `UPDATE` |
| `flowstate_bridge.bridge_clips` | `FIND`, `INSERT`, `UPDATE` |

With the Atlas CLI (syntax from its documentation as I know it; not run, and not checked against this project's Atlas):

```
atlas customDbRoles create flowstateBridge \
  --privilege 'FIND@flowstate_bridge.bridge_worlds,FIND@flowstate_bridge.bridge_down' \
  --privilege 'FIND@flowstate_bridge.bridge_up,INSERT@flowstate_bridge.bridge_up,UPDATE@flowstate_bridge.bridge_up' \
  --privilege 'FIND@flowstate_bridge.bridge_clips,INSERT@flowstate_bridge.bridge_clips,UPDATE@flowstate_bridge.bridge_clips'
atlas dbusers create --username flowstate-bridge --password '<generated>' --role flowstateBridge
```

Or in the Atlas UI: Database Access, Custom Roles, Add New Custom Role, one Collection Actions row a line of the table above, then a database user with only that role.

The desktop apps' own Atlas users need read and write on `flowstate_bridge`'s collections besides their own database: each writes its registry rows and pockets (`bridge_worlds`, `bridge_down`) and reads `bridge_up`; Music Companion also reads and removes `bridge_clips`.

To check it once made (nothing here has been checked): with the function's string, a `find` on `novel_companion.characters` and an `insert` into `flowstate_bridge.bridge_worlds` must both fail with "not authorized", and an `insert` into `flowstate_bridge.bridge_up` must pass.

## Not verified

- The custom role above, and that Atlas accepts it as written; that the desktop apps' own users have been given `flowstate_bridge`.
- A real MongoDB: every test runs against `test/bridge/fake-mongo.ts`. The duplicate key code (11000) on a guarded insert, the `$lt` guarded update and the driver's bundling on Netlify (`external_node_modules = ["mongodb"]`) are as documented, not run.
- The phone: a keepalive send as iOS hides the installed app (W0), and the function's request limit for clips.
