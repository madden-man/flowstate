# FlowState: architecture plan

"Who to Be, How to Flow." A personal journal that installs on an iPhone, keeps every byte on the phone, and is modelled on the pocket notebook started 2026-11-04. The notebook is the spec: its pages are the screens.

Date: 2026-11-07. Status: packages 0 to 8 built, 2026-11-07; the 2026-11-08 review and the v2 plan (page as editor, Questions behind a ? tab, upright spread, seed pages removed) are in `PLAN-V2.md`, built and deployed 2026-11-08; the v3 plan (playlists under ♪, the pull shows earlier pages) is `PLAN-V3.md`, not built (repo github.com/madden-man/flowstate, public; site flowstate-journal.netlify.app). Section 11's six assumptions all stand (Tommy, 2026-11-07). Decided: iPhone, PIN lock, name FlowState, no model ever voices an archetype, sounds are okay, Spotify tie-in wanted. The design standard is `DESIGN.md` (enforced by `script/design-lint.mjs`); the live design walkthrough is `design/walkthrough.html` on `design/tokens.css`.

---

## 1. What the notebook does (and the app must keep)

| Notebook practice | Page in the notebook | App feature |
|---|---|---|
| Manifesto | "I determine my core. I choose how to flow." | Lock screen text |
| Three principles | paradox defines a value; words classify, scenarios show flow; everything stays mutable | Paradox form, action items, revision history |
| Dated free entries | 11/5/26, "All this, and I'm reduced to simple journaling" | Journal tab: entries, the primary writing surface |
| Question storming | one question per page, answer below, sometimes "[space to answer left]" | Journal tab, Questions section: a list of open questions to answer; secondary, never the default |
| Answers in a wiser second person | "stand tall, young one", "Your journey is carrying you closer" | Any message can be spoken by a voice |
| Paradox spread | "selfless" in one corner, "selfish" in the opposite, items along the diagonal, arrows between them | Be tab: the spread, rendered as drawn |
| "Fill both" | Selfless: vegetable chopping in Evergreen. Selfish: something that gives breathing room | Items under each pole with a cadence |
| Three-word form | Selfless, compassionate self-awareness, Selfish | Optional middle word or scenario on a paradox |
| Colour-coded pantheon | Black Skeptic, Blue Mystic, Green Architect, Red Warrior, Purple Meaning Maker, Brown Engineer, and the deep shadows | Voices: the seed set, editable, light/deep pairs |
| Conversations between voices | "write conversations between them that lead to deeper understanding and reconciliation" | Council tab |
| Linked questions | "Related...", "Smaller version... same answer as last" | Page links |
| Crossed-out words kept | the Blue line, "Sojourner/Wanderer" struck through | Revisions kept, never silently overwritten |

## 2. Principles

- **Local only, and offline first.** No server, no accounts, no analytics, no network after the first load. Every built file, fonts included, is precached by the service worker; fonts are self-hosted so nothing loads from Google at runtime. The app must open and work in airplane mode, and package 0 is not done until that is shown on the phone.
- **The data is the product.** Export and import from day one.
- **Mutable by design.** Principle 3 in the notebook: identities and flow states must stay mutable. Every paradox and voice keeps its revision history; nothing is final and nothing is lost.
- **No model voices.** The council is you talking to you. There is no setting for this; it is simply not built.
- **Small.** One person, one phone, a few thousand pages over years.

## 3. Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite + TypeScript | Same as the other `~/dev` apps |
| UI | Preact + `@preact/signals` | Tiny; signals suit the chat composer and the spread |
| Routing | `preact-iso` hash router | Hash routes survive standalone mode and deep links |
| Storage | IndexedDB via Dexie 4 | Typed tables, versioned migrations, `liveQuery` |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest, precache, update prompt |
| Crypto | WebCrypto (PBKDF2 + AES-GCM) | Built in, works in Safari standalone |
| Tests | Vitest + `fake-indexeddb`; one Playwright smoke | Data layer tested without a browser |
| Hosting | Netlify site `flowstate-journal` (flowstate.netlify.app was taken), https://flowstate-journal.netlify.app/ (registered as the Spotify redirect URI by Tommy, 2026-11-07); `netlify deploy --build --prod` | Static files only, same recipe as japan-trip |

## 4. Data model (Dexie tables)

One idea unifies the writing: a **page** is anything you write, and every piece of text on it is a **message** spoken by a voice (or by plain you). A question page is a page whose title is the question. A council conversation is a page where several voices speak. A dated entry is a page with no title. The notebook already works this way; the app just names it.

```ts
// settings, single row id = 'app'
{ id, light: 'sky'|'day'|'night', place?: { lat, lon, name }, stillAfterMidnight: 'offer'|'never',
  sounds, haptics, lock: { enabled, salt, verifier, relockAfterMin }, lastBackupAt,
  spotify?: { tokens, connectedAt } }   // DESIGN.md §4, §6, PLAN §8.1

// voices: the pantheon, seeded from the notebook, fully editable
{ id, name, aka: string[], colour, shade: 'light'|'deep', twinId?,
  starred, order, archived, revisions: [{ at, name, aka, colour }] }
// twinId pairs a light voice with its deep shadow (Explorer <-> Sojourner)
// starred = "most helpful to write" (Black, Blue, Red, Green in the notebook)

// pages: everything written
{ id, kind: 'question'|'entry'|'council', createdAt, updatedAt,
  title?,                     // the question, for kind 'question'
  state: 'open'|'answered'|'revisited',
  tags, paradoxIds, linkedPageIds,   // "Related...", "Smaller version..."
  music?: { albumUri, album, artist, coverId } }   // what was playing when the page was written (§8.1)

// messages: the text on a page, in order
{ id, pageId, at, voiceId?, text, replyTo?, kept }
// voiceId null = plain ink. A question's answer is one or more messages.
// kept = "keep close" (long press): feeds the echo and Still (§8). No seed pages (V5): the manifesto is threshold copy.

// paradoxes: the Be tab
{ id, createdAt, updatedAt, status: 'active'|'resting'|'retired',
  poleA: { value, aspect, shadow? },   // 'selfless', what living this side looks like; shadow = its overindulged form
  poleB: { value, aspect, shadow? },   // 'selfish'. The notebook writes "thoughtful (obsessive)": the pole carries its own shadow word
  middle?: { word?, scenario? },   // 'compassionate self-awareness', or a specific scene
  revisions: [{ at, poleA, poleB, middle }] }

// items: what sits on the spread. "Fill both."
{ id, paradoxId, pole: 'a'|'b', pairId?, text, lean: -1..1, cadence?: 'daily'|'weekly'|'monthly'|'yearly'|'once',
  nextTo?, doneLog: [{ at }], order }
// pole = which page the goal sits on; pairId links a goal to the goal that balances it on the other pole
// ("fill both"). lean is the goal's weight: its height on the page, -1 top to +1 bottom; a pair shares a lean by default.

// leans: where you are between the poles over time
{ id, paradoxId, at, lean, note }

// backups: log only
{ id, at, bytes, encrypted }

// albums: the music sheet, filled once from the playlist when Spotify is connected (§8.1)
{ albumUri, album, artist, order, firstTrackUri, cover: Blob }
```

Indexes: `pages` by `createdAt`, `state`, `kind`, `*tags`, `*paradoxIds`; `messages` by `[pageId+at]`; `items` by `paradoxId`; `leans` by `[paradoxId+at]`.

Search is in memory over decrypted text; at one person's volume it is instant.

### Seed voices (from the notebook, 2026-11-06)

| Colour | Light voice | Deep twin (shadow) |
|---|---|---|
| Black | Skeptic (Thinker, Philosopher) ★ | |
| Blue | Mystic (Healer, Feeler) ★ | Phantom / Ghost |
| Green | Architect / King ★ | Workaholic / Hoarder |
| Red | Warrior (Poet) ★ | |
| Purple | Meaning Maker (Romantic) | Victim |
| Brown | Engineer | |
| Orange | Explorer / Adventurer | Sojourner / Ranger |
| Pink | Sensualist | Addict |
| Yellow | Joker | |

★ = starred, shown first in the chip row. The notebook calls this "a running list of types" and the app treats it the same way: the pantheon is data, never code.

### Seed paradoxes (from the notebook, 2026-11-06)

| Pole A (top-left) | Pole B (bottom-right) | Middle | Items along the diagonal, A to B |
|---|---|---|---|
| selfless | selfish | "compassionate self-awareness" (v1), "balance self with others, fill all needs" (v2, "closer... but still too vague") | find volunteer opportunities near Evergreen → remind yourself, through metrics, that you matter by helping others; when something useful is created, share it with the world → write for its own sake, not worrying whether it is commercially viable or edifying; find something nice for yourself which gives you life / breathing room |
| thoughtful (shadow: obsessive) | reactive | | journaling, asking Claude, asking a friend, giving feedback |

Both versions of the first middle are kept as revisions, struck through, as drawn.

### Voices are mutable, always

- **Add from where you write.** The last chip in every council chip row is "+ voice". Tapping it opens a small sheet: name, aka words, a colour wheel (not a fixed palette), light or deep, and an optional twin. The new voice can speak on the very next message.
- **Voices screen** (reached from Settings and from a long press on any chip): the full list grouped by hue, light beside its deep twin. Rename, recolour, re-pair, star, reorder, archive, restore. Archived voices keep their messages and their colour; they just leave the chip row.
- **History.** Every edit pushes the old name and colour onto the voice's `revisions`, so a renamed voice still reads correctly on old pages and the crossed-out names are visible, as in the notebook.
- **Colour is enforced unique enough.** The picker warns when a new colour sits too close to an active voice's hue, so bubbles stay tellable apart.
- **Optional seeds.** A "more voices" list in the Voices screen offers Jung's named figures (Self, Shadow, Persona, Anima/Animus, Wise Old One, Child, Trickster) and the familiar twelve as one-tap additions, each with a suggested colour. None are active until added.

## 5. Screens (bottom tabs: Journal, Council, Be, Flow)

1. **Journal.** The primary surface. One tap opens a blank dated entry; writing about what is bothering you is the default act, with no choice to make first. Entries list newest first with their date, mood and tags. Every message has a speaker chip, default plain ink, so a line can be spoken by the Mystic when that helps. An entry carries a state (raw, revisited, integrated) and a "revisit" action adds a later reading beneath the original.
   **Questions** is a section inside Journal, reached by a segment control, not a tab. It lists open questions first ("space to answer left"), then answered ones. Tap one to answer it; the answer is messages, so a voice can speak it. "Ask a question" is a secondary button on the Journal screen, and an entry can be turned into a question after the fact. Links between pages ("Smaller version of...") sit at the bottom of each.
   The page header carries the moon (Still, §8) at the left and "No." plus the date at the right. Above a new page the **echo** may sit: one of your own kept lines ("Same answer as last"), tap to link, swipe away. Long press any message for the sheet: Keep close, Reply, Speak as…, Turn to answer, Link a page, Take to the council. **Turn to answer** makes the entry a question and opens the answer frame beneath, set in italic as the wiser second person.
2. **Council.** Council pages only. Inside one: a chat column, each message tinted by its voice, a chip row above the composer with the starred voices first and "+ voice" last. The chip you tap is who speaks next. Long press a message to reply to it. A council page can be opened from a question page ("take this to the council"), which links the two.
3. **Be.** One card per paradox, drawn like the notebook spread: pole A's tag in the top-left corner, pole B's in the bottom-right, the diagonal between them, and two facing pages: pole A's goals on the left page, pole B's on the right, each at the height of its lean; drawn arrows between goals that follow one another, dotted links across the seam between a goal and its balance. The optional middle word or scenario sits on the seam. **The primary act is "+ Goal"**: a sheet with one field per pole and a cadence row. Save both and the pair lands linked at the same height; save one side and a dashed slot appears at the same height on the other page ("and on the selfish side?") and stays until it is filled. New paradox is a form that will not save until both values and both aspects are written.
4. **Flow.** Today: items due by cadence, each a checkbox that writes to its done log. A lean slider per active paradox, one drag a week is plenty. Below that, look back: entries still raw, questions still open, paradoxes with no lean this month, voices that have not spoken in a while, and the lean line per paradox over time. Motion is the point; there are no streaks.
5. **Settings** (sheet). Light (Follow the sky / Day / Night), location for sunrise, Still after midnight (Offer / Never), kept lines, sounds, haptics, music (Spotify connect), Voices screen, PIN, export, import, storage health, install hint.
6. **Still** is a light, not a screen (§8 and DESIGN.md §4): tap the moon (pulling a page down shows earlier pages, V6); the ring at the top breathes and is the exit.
7. **Music sheet** (♪ in the page header, §8.1): album covers from the playlist; tap one and the playlist plays from that album's first song, on into the next album.

Deep links: `#/journal/:id`, `#/journal/questions`, `#/council/:id`, `#/be/:id`, `#/flow`.

## 6. The paradox rule

- A paradox cannot be saved with one pole. Both `value` and both `aspect` fields must be non-empty.
- The middle is optional, and the notebook's own doubt is the reason: "that third word is hard to come by". A specific scenario is offered as the alternative, per principle 1.
- Antonym suggestions come from a small local list and are offered, never filled in. The opposite has to be yours.
- Editing a paradox pushes the old version onto `revisions`; the card has a "versions" link that shows them struck through, as in the notebook.
- Items under a pole are the action plan. Cadence is optional; "once" items are goals, recurring items are practices.
- **Goals come in pairs.** Most goals are added with the goal that balances them on the other pole (Tommy, 2026-11-07), so the add sheet always offers both fields and the spread keeps a dashed slot open for a missing balance. A goal can be saved alone; it just stays visibly unbalanced. Flow lists the open slots under "look back".

## 7. Lock, storage, backup

- **PIN lock.** A phone keypad with letters under the digits, so a word works as a PIN (the notebook's choice spells on the keypad). The PIN is set on first run and never stored; a verifier hash plus a random salt are. The key for encryption is derived from the PIN with PBKDF2-SHA256 at a high iteration count. Text fields (`text`, `aspect`, `scenario`, `note`) are AES-GCM encrypted per record; ids, dates, tags, colours and voice names stay clear so lists render before unlock. The key drops out of memory after `relockAfterMin` in the background.
- **Honest limit.** A short PIN is a curtain, not a vault. Anyone with the phone unlocked and a copy of the app's storage could brute-force it. It keeps the journal shut to a glance and to anyone scrolling the phone. Face ID via WebAuthn is a possible later step, not planned now.
- **Lock screen** shows "Who to Be, How to Flow" and the manifesto's two lines.
- **Persistence.** `navigator.storage.persist()` on first run; the result shows in Settings. An installed home-screen app is exempt from Safari's seven-day eviction, so the install hint (Share, Add to Home Screen) appears until the app detects standalone mode.
- **Export** = one JSON file (all tables, schema version, exported-at), encrypted with the same key when the lock is on, handed to the share sheet so it can go to Files, iCloud Drive or AirDrop. Settings nags gently when `lastBackupAt` is older than two weeks.
- **Import** = pick a file, validate the schema version, migrate if older, then replace or merge (merge keys on id, newest `updatedAt` wins).

## 8. Design: the lights

The standard is `DESIGN.md` (25 numbered rules, each marked lint or review) and the reference is the live walkthrough `design/walkthrough.html` on `design/tokens.css`, which package 0 ships unchanged as `src/ui/tokens.css`. This section is the summary.

The notebook names three needs and the app answers each with a light:

| Light | When | What it is for (the notebook's words) | Page / ink |
|---|---|---|---|
| Day | sunrise to sunset | "an enormous amount of potential energy... use it in all seriousness": crisp ink, the Flow tab's checks | #F6F1E4 / #2A2724, pale blue rules |
| Night | sunset to sunrise | "listen to the quiet voices within": a lamp in the corner, voices glowing | #1B1D26 / #D8D2C3 |
| Still | chosen, never automatic | "boiling in my own soup... wait out the truly hard parts, they never last forever": settle, not solve | #0F1016 / #A19B8E, about 6.5:1 |

- **The sky, not a setting.** `ui/light.ts` computes sunrise and sunset from a stored place (asked once in Settings; fallback 07:00 to 19:00; no network) and changes the light at sunrise and sunset in one `--t-light` breath (V5; the 40-minute stretch left chips and sheets in the old light). Settings can pin Day or Night. Research: illuminance raises arousal while colour temperature barely moves it, so Still lowers luminance and stays cool-neutral.
- **Still** is a tap on the moon, from anywhere (V6, PLAN-V3.md section 4: pulling the page down shows the rail of earlier pages instead, never changes the light, and does nothing in Still). In Still: counts, states, page numbers, look-back and the page list vanish (today only); deep twins leave the chip row; a breathing ring (4s in, 6s out) replaces the moon and is the exit; one kept line sits at the top; after twelve minutes of typing the ring asks once, "Enough for now?" (Close the page files it raw). Leaving Still (ring, or the next sunrise) changes no data.
- **Your own words, never generated.** Kept lines (`messages.kept`) are the echo above a new page and the line Still shows; a fresh journal has none until something is kept (V5). Turn to answer opens the wiser second person beneath a question; distanced self-talk lowers rumination over time (Kross and Ayduk), and the notebook already does it ("stand tall, young one").
- **Type.** Ink is `ui-serif` (New York on iPhone), stationery labels `ui-sans-serif`; nothing is downloaded, which settles the self-hosted-font point in §2. Line height equals rule spacing: 17 on 28 by day, 18 on 33 in Still.
- **Voices are formulas.** A voice stores a hue; `oklch(var(--voice-l) var(--voice-c) hue)` takes lightness and chroma from the light. Deep twins: lightness -17%, chroma × .6, a doubled left rule. Messages: 3px rule plus a 10% wash (0% in Still). The council's lamp takes the last speaker's colour.
- **Motion** is slow and never bounces: `--t-ui` 180ms, `--t-page` 400ms, `--t-light` 1200ms, `--t-breath` 10s; zero under reduced motion. Sheets rise; nothing is a modal dialog. Tabs are words; no icons beyond the moon, the ring, the drawn arrow and the drawn check. No streaks, badges, confetti or counts on tabs.
- **Touch.** iPhone Safari has no `navigator.vibrate`; `parts/Haptic` uses the hidden `<input type="checkbox" switch>` under a tappable target, which fires the Taptic Engine on a direct tap (iOS 17.4+, one tick from 26.5; silent mode may mute it; degrades to nothing). Ticks: unlock, tab change, a check, an item dropped on the diagonal, lean detents, entering Still, keep close, a sheet opening. The rest of the tactility is physics: items ride the diagonal under the finger, the lean clicks into three detents, the rail of earlier pages follows the drag, long press lifts an item.
- **Sound** (Tommy, 2026-11-07: sounds are okay). `parts/Sound` synthesises a few bells with Web Audio, no files: a bell on unlock, a long low tone on settling, a soft bell on keep close, the lean's two ends, a short bell on choosing an album. Never uninvited; a Settings switch; Web Audio already follows the ring switch.

### 8.1 Music: "For the Poems and the Prose; May They Dance Forever"

Tommy's thinking playlist (`spotify:playlist:0T6Gzc2hN81u3vGC5IJZ9a`, by Thomas Madden; whole-album runs of Lena Raine, CLANN, Sigur Rós, S. Carey, brillion., Flight Facilities and more; Tommy pasted the full track list into chat on 2026-11-07). He does not care song by song: he wants to start at whichever album sounds soothing.

- **Album covers, not a track list.** The ♪ line in the page header opens a sheet of album covers from the playlist, every album, in playlist order, scrolling, no titles needed. Tap a cover: the playlist starts at that album's first track on the phone's Spotify and runs on from there. The playing album shows as a small cover beside ♪.
- **Two tiers.** Without an account the ♪ line deep-links to the playlist in Spotify and shows no tiles. Connected (opt-in; Authorization Code with PKCE, no server; the app sits in Spotify development mode with Tommy as its one allowed user; Premium is needed for playback control) the app reads the playlist once (`GET /playlists/{id}/tracks`, paged), groups tracks by album keeping first appearance order, stores covers as blobs in the `albums` table so the grid works offline, and plays with `PUT /me/player/play` `{ context_uri: playlistUri, offset: { uri: firstTrackUri } }`, so the playlist keeps going after the album (Tommy, 2026-11-07). Now-playing is polled every 20s while a page is open and written to `page.music`, so a page remembers its album and "Pages with this album" works later.
- **The one network exception.** Principle 1 stays: `src/music/` is the only code allowed to `fetch`, and the design lint enforces it. Credentials and dashboard steps: `docs/SPOTIFY.md`. Off by default; nothing else changes when it is off. Since V7 ♪ lists the playlists Tommy ticks in Settings, each with its own shelf, and the reads are guarded for big playlists: `docs/SPOTIFY.md`, "Playlists".
- **Not planned.** The Web Playback SDK (field reports on iOS Safari conflict, and it stops when the page is backgrounded). The phone's Spotify plays; FlowState only points it.
- **Still and music.** Still never starts or stops music.

## 9. Code layout

```
src/
  app.tsx            routes + tab bar
  db/
    schema.ts        Dexie tables, versions, migrations
    crypto.ts        PIN key derivation, field encrypt/decrypt
    backup.ts        export/import/merge
    seed.ts          voices from the notebook, antonym list
  model/
    paradox.ts       two-pole validation, lean maths, revisions
    pages.ts         kinds, open/answered/revisited, links
    council.ts       message ops, speaker selection
    flow.ts          cadence, due items, look-back queries
  ui/
    tokens.css       copied unchanged from design/tokens.css (DESIGN.md §2)
    light.ts         the sky: sunrise/sunset from the stored place, one-breath turn, Still state (the pull and the rail of earlier pages are parts/Pull and parts/Earlier, V6)
    journal/ questions/ council/ be/ flow/ voices/ settings/ lock/
    parts/           Page, Chip, VoiceRule, CornerTag, Spread, Arrow, Strike, LeanSlider, Keypad, Sheet,
                     Moon, Ring, Echo, Sound (Web Audio bells), Haptic (the switch trick)
  music/
    spotify.ts       PKCE sign-in, playlist read, album grouping, play, now-playing poll (the only fetch)
    covers.ts        cover blobs in Dexie
  pwa/
    install.ts       persist(), install hints, update toast
script/
  design-lint.mjs    DESIGN.md's lint half; runs in npm test and the pre-commit hook
design/
  tokens.css walkthrough.html   the design reference (live, interactive)
test/
  db/ model/         Vitest with fake-indexeddb
  e2e/install.spec   Playwright, one smoke
```

## 10. Build order

One PR per package. Every package: `node script/design-lint.mjs src design` and the artifact lint print PASS (pasted in the PR body), its steps are added to `design/walkthrough.html` from the real components, and the new screens are reviewed in all three lights (CLAUDE.md in this repo).

| # | Package | Done when |
|---|---|---|
| 0 | Scaffold | Vite + Preact + Dexie schema + manifest + worker; `db/crypto.ts` and the encrypt-on-write path for every text field from day one (stored plain until a PIN is set, encrypted on the spot after; Tommy, 2026-11-07), so no later migration touches real entries; installs on the phone, opens and writes in airplane mode, survives a reload offline; `tokens.css` and the three lights wired (`data-light` on html, `light.ts` sky, Settings pin); design lint in `npm test` and a pre-commit hook; export/import round-trips an empty DB |
| 1 | Journal | Dated entries with mood, tags, autosave, raw/revisited/integrated; speaker chips on messages; Questions section (list, answer, open/answered); Turn to answer; long-press sheet with Keep close; page links; search; honours all three lights |
| 2 | Council | Seeded voices with light/deep pairs; Voices screen and "+ voice" chip (add, recolour, twin, archive, revisions); council pages; tinted chat with the lamp; reply; open a council from a question |
| 3 | Be | Two-pole form with the save gate (plus the optional pole shadow); the spread as two facing pages with corner tags, drawn arrows, pair links and goals draggable by height; "+ Goal" sheet with paired fields, cadence and open balance slots; middle word/scenario; revisions struck through; both seed paradoxes |
| 4 | Flow | Cadence items with done logs and the drawn check; lean slider with detents; look back (open pages, quiet paradoxes, quiet voices, lean lines) |
| 5 | Still | The blind gesture and the moon; the ring; counts, states, look-back and deep twins hidden; the echo and kept lines; "Enough for now?"; lifts at sunrise; Sound and Haptic parts with the listed ticks and bells |
| 6 | Lock | Keypad PIN with letters, PIN set and change (the crypto layer is already in from package 0), relock timer, encrypted export, manifesto threshold with the breath |
| 7 | Music | Spotify PKCE connect, playlist read, album grid with cached covers, play from the first track, now-playing on the page, "Pages with this album", Settings rows |
| 8 | Polish | Install hints, backup nag, storage health, reduced-motion pass, a three-lights review of every screen |

Packages 1 to 3 are independent after 0 and can run in parallel worktrees. 5 needs 1 to 4; 7 needs 1.

## 11. Open questions for Tommy

1. Should the plain-ink answers (the "young one" voice) have a name of their own in the chip row, or stay unlabelled? Plain ink is assumed.
2. Should cadence items ("vegetable chopping in Evergreen") be checkable with a done log, or stay prose under the pole? Checkable is assumed, following "daily, weekly, monthly, yearly goals/tasks".
3. Resolved: the "IVG section" is the dated 11/6 section of the notebook ("Follow up answer in 11/6 section: color coded journaling might give voice to new minds within"). It is the pantheon and three-word pages, already in the plan; no extra section.
4. The role-model list (Grumpa, Isaac, Alison, Myself) reads as a page, not a feature. Assumed to live as a question page unless you want a "Models" screen. (V5, 2026-11-08: seed pages go; Tommy writes it himself.)
5. The sky needs a place. Assumed: you type a town once in Settings (Evergreen) and the app keeps a latitude and longitude for it; no location permission is asked for.
6. Still's "Enough for now?" after twelve minutes of typing: keep, change the minutes, or drop it? Kept at twelve, once per session.
7. Deep twins leave the chip row in Still (you can still reach them from the Voices screen). Assumed yes.
8. Resolved 2026-11-07: FlowState has its own Spotify app (client id `a4ee189148b042dc8bfda38b9aed4cd2`, redirect `https://flowstate-journal.netlify.app/`) and signs in with PKCE; tommysthoughts.com's secret and refresh token stay in Netlify and never enter the PWA. Module written at `src/music/spotify.ts` with tests; setup and the two dashboard steps you still own (redirect URI, Premium) are in `docs/SPOTIFY.md`.
