# The bridge (PLAN-WORLDS.md section 5, W2)

One Netlify function, `bridge`, on the FlowState site. The phone reaches it same origin at `/.netlify/functions/bridge`, only from `src/bridge/`, and only once a bridge token is pasted in Settings and a world is worn. It is the only thing on the web that holds the Atlas string.

- Function: `netlify/functions/bridge.mts` (the driver and the environment), `netlify/lib/bridge.ts` (the handler, tested against a fake driver in `test/bridge/function.test.ts`).
- Protocol: `src/bridge/protocol.ts`, shared by the phone and the function, so every limit and allow-list is written once.

## What it may touch

The two databases `novel_companion` and `music_companion`, and in them only:

| Collection | In | Written by | The function |
|---|---|---|---|
| `bridge_worlds` | both | the desktop apps | reads (the registry) |
| `bridge_down` | both | the desktop apps | reads (a world's pocket) |
| `bridge_up` | both | the function | reads and writes (envelopes) |
| `bridge_clips` | `music_companion` | the function | reads and writes (a hum's audio, W6) |

`coll()` in the handler refuses any other database, any name without the `bridge_` prefix, and clips anywhere but `music_companion`. A world lives in the database whose `bridge_worlds` holds it with a kind that belongs there (`novel` in `novel_companion`, `songs` in `music_companion`); a row with the wrong kind for its database is no world, and an id claimed by both is refused. An envelope is only ever written to its world's own database.

## The protocol

Every request: `Authorization: Bearer <BRIDGE_TOKEN>`. A missing or wrong token, or none set on the site, is `401` and nothing is read or written (compared in constant time over SHA-256 digests). Every answer: `cache-control: no-store`.

| Request | Answer |
|---|---|
| `GET ?op=worlds` | `{ worlds: [{ id, name, kind }] }` from both registries |
| `GET ?op=pocket&world=<id>&stamp=<s>` | `{ world, stamp, unchanged: true }` when the phone's stamp is the pocket's; else `{ world, stamp, pocket }`; `404` for no world or no pocket yet |
| `POST ?op=up`, body `{ world, envelopes }` | `{ acks }`, one an envelope, in order |
| `POST ?op=clip&world=<id>&take=<id>&rev=<n>`, body the audio, `content-type: audio/*` | `{ take, result }` (W6 sends these; the shape and the guard are built) |

**Envelope:** `{ world, table, id, rev, deleted?, row? }`. `table` is one of `pages`, `messages`, `inquiries`, `songs`, `takes`; `id` matches `[A-Za-z0-9._:-]{1,120}`; `rev` a positive whole number; `row.id` equals `id`; a delete carries no row. Stored in `bridge_up` as `{ _id: "<world>:<table>:<id>", world, table, id, rev, deleted, row, at }`.

**Ack:** `{ table, id, rev, result, reason? }`. `stored`: written. `same`: that rev was already there (a resend after a lost answer); nothing rewritten. `older`: a newer rev is there; this one dropped. `refused`: a check failed (`reason` names it); nothing written. The first three let the phone clear its outbox entry; a refused one waits.

**Limits:** 64 KiB a row, 200 envelopes a batch, 1 MiB a body, 4 MiB a clip. A send as the app is hidden keeps its body under 60 KiB (the keepalive budget is 64 KiB for every keepalive request in flight).

**What a row holds** (`src/bridge/up.ts`, only the fields named there leave the phone): a council or question page (`id, kind, title, state, createdAt, updatedAt, answeredAt, resolvedByTap, seats, reading, chips, asked, year`); a council or question line (`id, pageId, at, updatedAt, voiceId, text, replyTo, kept, wise, paper`); a kept journal line alone (`id, at, updatedAt, text, wise, kept, kind: "kept", date, year, chips`: never its page, its title or its other lines); a question researched (`id, askedAt, question, state, pageId` and the picked papers' public record); a song (`id, createdAt, updatedAt, title, lyric, sections, key, bpm, characterIds`); a take without its audio.

**The pocket** (`bridge_down`, `{ _id: <worldId>, stamp, pocket }`, written by Novel Companion in W3 and Music Companion in W7): for a novel `{ kind: "novel", characters: [{ id, fullName, firstName, chineseName?, familyColour?, born?, died? }], places, chapters, events, storyYear?, span?, questions: [{ id, question, state: "open" | "decided", decision?, changedAt }] }`; for Songbook `{ kind: "songs", songs: [{ id, title }] }`. The registry row: `{ _id: <worldId>, name, kind }`.

## Setting it up (not run; Tommy's to do on the site and in Atlas)

1. In Atlas, the custom role and user below.
2. On the site, for functions only: `BRIDGE_MONGODB_URI` (that user's connection string) and `BRIDGE_TOKEN` (`openssl rand -hex 32`).
3. Deploy as usual. Paste the token into Settings, World, on the phone.

## A custom role for the one Atlas user (UNVERIFIED)

Plan section 13 asks whether one Atlas user can be limited to the `bridge_` collections of two databases. Atlas custom roles take privileges on a database and a named collection; they do not take a prefix, so each collection is named. The function needs only these actions (it never deletes, and the desktop apps write `bridge_worlds` and `bridge_down` with their own users):

| Resource | Actions |
|---|---|
| `novel_companion.bridge_worlds`, `music_companion.bridge_worlds` | `FIND` |
| `novel_companion.bridge_down`, `music_companion.bridge_down` | `FIND` |
| `novel_companion.bridge_up`, `music_companion.bridge_up` | `FIND`, `INSERT`, `UPDATE` |
| `music_companion.bridge_clips` | `FIND`, `INSERT`, `UPDATE` |

With the Atlas CLI (syntax from its documentation as I know it; not run, and not checked against this project's Atlas):

```
atlas customDbRoles create flowstateBridge \
  --privilege 'FIND@novel_companion.bridge_worlds,FIND@music_companion.bridge_worlds' \
  --privilege 'FIND@novel_companion.bridge_down,FIND@music_companion.bridge_down' \
  --privilege 'FIND@novel_companion.bridge_up,INSERT@novel_companion.bridge_up,UPDATE@novel_companion.bridge_up' \
  --privilege 'FIND@music_companion.bridge_up,INSERT@music_companion.bridge_up,UPDATE@music_companion.bridge_up' \
  --privilege 'FIND@music_companion.bridge_clips,INSERT@music_companion.bridge_clips,UPDATE@music_companion.bridge_clips'
atlas dbusers create --username flowstate-bridge --password '<generated>' --role flowstateBridge
```

Or in the Atlas UI: Database Access, Custom Roles, Add New Custom Role, one Collection Actions row a line of the table above, then a database user with only that role.

To check it once made (nothing here has been checked): with that user's string, a `find` on `novel_companion.characters` and an `insert` into `novel_companion.bridge_worlds` must both fail with "not authorized", and an `insert` into `music_companion.bridge_up` must pass. Novel Companion and Music Companion read `bridge_up` and write `bridge_worlds` and `bridge_down` with their own users (W3, W7).

## Not verified

- The custom role above, and that Atlas accepts it as written.
- A real MongoDB: every test runs against `test/bridge/fake-mongo.ts`. The duplicate key code (11000) on a guarded insert, the `$lt` guarded update and the driver's bundling on Netlify (`external_node_modules = ["mongodb"]`) are as documented, not run.
- The phone: a keepalive send as iOS hides the installed app (W0), and the function's request limit for clips.
