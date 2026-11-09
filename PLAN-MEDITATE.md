# FlowState Meditate: one circle and a gentle sound

Date: 2026-11-09. Status: planned; the build follows this file (section 6). Packages are S1 to S5 (S for sit): the motion pass building the same day owns M1 to M6. Tommy's ask: "i want there to be a 'meditate' section of the flowstate app under flows that's a little different from the others. in this one, it shows some kind of circle and plays very gentle, calming music (maybe rain or the ocean or birds in a forest, etc), something very simple and harmonious. check muse to see if there's any open integration paths for their headset (probably not, if not, that's fine)."

`PLAN.md` stays the architecture, `PLAN-FLOWS.md` the Flow tab and `PLAN-MOTION.md` how things move. This file records what is there today, the decisions, how the sound is made and what the iPhone does to it, the screens, the data, the build packages, and what is open on a Muse headset (section 7: nothing live on the iPhone, one path after the fact). The proposal walkthrough is `design/meditate/index.html`; its phone mocks play the four sounds, so it is also the audition (section 9).

## 1. What is there today (main 6bbbf24)

- **Flow** is a list: Right now, then nine flows (Panic to Shame), each a cycle with steps, a dot and episodes, then "+ flow". Routes `#/flow`, `#/flow/now`, `#/flow/:id`, `#/flow/:id/:step`.
- **The breath** already exists three times on one token (`--t-breath`, four seconds in, six out): the ring in the moon's place in Still, the ring on the threshold, and the halo under a held thumb on a flow's drawing (`ui/flow/breath.ts`, with ticks and an optional breath tone).
- **Sound** is `parts/Sound`: bells and two tones synthesised with Web Audio, no files (rule 21), every one from a tap, behind the Sounds switch. Web Audio on the iPhone is muted by the ringer switch by default.
- **The screen** can be kept awake: `useWakeLock` in `ui/flow/breath.ts` holds it at a flow's peak.
- **No network** after the first load (rule 22); the only exception is `src/music/` for Spotify, which plays in Spotify's own app.

- **The motion pass** (`PLAN-MOTION.md`, DESIGN.md rules 26 to 31) is on main as M0 and its packages M1 to M5 are being built in parallel: `parts/Press`, `parts/Turn`, the stream on a flow's drawing. Section 6 says how Meditate fits each rule.

Nothing in the app today makes a continuous sound, and nothing is a place to simply sit.

## 2. Decisions and assumptions

Decided by Tommy (2026-11-09): Meditate lives under Flow and is different from the flows; it shows a circle and plays something very gentle, simple and harmonious (rain, ocean, forest birds and the like); Muse only if a path is open.

Assumed for the build, say so if wrong (each is one small change to overturn):

- **It is not a flow.** No steps, no dot, no episode, no tips: a fixed row of the Flow list at `#/flow/meditate`, second, right under Right now. Right now is the row for the worst minute; Meditate is the row for an ordinary one.
- **The circle is the ring with nothing on it.** The same drawn circle as Panic's ring, without marks, arrows or the dotted way back, breathing on `--t-breath`. A tap on it begins the sit; a tap ends it. It is the only primary act on the page (rule 6).
- **Four sounds and Quiet, all synthesised.** Rain, Ocean, Forest, Bowl, and Quiet (the circle alone). No recordings: rule 21 holds as written, nothing is downloaded, and a generated sound never loops. The forest is the one that may sound drawn; section 3 says what happens then.
- **The sea breathes with the circle.** Ocean's wave gathers for four seconds and draws back for six, on the circle's own clock, so the sound paces the breath with eyes shut. Bowl is struck as an in-breath begins, every other breath. Rain and Forest keep no beat.
- **While sitting, everything else leaves.** The header, the tabs, the rules and every word fade on one `--t-light`; the light does not change (Still stays chosen, rule 13). The screen is kept awake.
- **A sit is open unless a length is chosen.** Open, 5, 10 or 20 minutes. With a length, the circle draws itself once round in ink and one bell closes it. No clock is shown while sitting.
- **A sit is media.** It plays with the ringer switch off, the way the ♪ does, behind a Settings switch ("Sit sounds with the ringer off", on). The Sounds switch keeps governing the bells, the closing bell included; the sit's own switch is the Quiet chip.
- **One row is kept per sit, and no arithmetic is done on it.** "Last sat 11 / 8" on the list row and the page, like a flow's "last time". No totals, no run of days, no minutes-this-week (rule 15). A sit ended inside its first minute writes nothing.
- **Nothing speaks.** No guidance, no prompts, no reminders, no generated text. The page has seven words on it.
- **Still.** In Still the page is the circle and the sound chips; a sit begun there is always open (no lengths, no stroke, no "last sat").

## 3. The sound

### 3.1 How each one is made (all in `parts/Sound`, no files)

Each is built from three sources: looped noise buffers (white, pink, brown; six seconds, the tail folded into the head so the loop has no click), sine oscillators, and gains moved by slow curves. `design/meditate/meditate.js` is the working reference; S1 ports it to TypeScript.

| Sound | What it is made of |
|---|---|
| **Rain** | Pink noise between 500 Hz and 7 kHz for the bed; brown noise under 400 Hz for the roof; a band of white noise around 3 kHz that thickens and thins on a slow sine; nine to sixteen single drops a second, each a 12 to 50 ms burst of band-passed noise at its own pitch and place in the stereo field. |
| **Ocean** | Brown noise under 140 Hz for the sea far out, always there; a surf layer whose level and low-pass (260 Hz to about 2 kHz) rise over the in-breath and fall over the out-breath; foam (pink noise above 2.2 kHz) that arrives just after the break and thins down the sand. Each wave is 80 to 110 percent of the last. |
| **Forest** | Pink noise in a wide band around 600 Hz for moving air and a thin hiss above 4.2 kHz for leaves, each leaning on its own slow sine; bird calls as plain tones with soft envelopes (a two-note whistle, a warble, a trill, a dove's four notes, a far "tseep"), each given a place, a distance and a room made from a generated impulse; about one call every two or three seconds, never on a beat. |
| **Bowl** | A struck bowl of three partials (1, 2.71 and 4.95 times the fundamental), each a pair of sines 0.7 Hz apart so it shimmers as it rings down over 8 to 20 seconds; one bowl on G (196 Hz) as an in-breath begins, every other breath, and a second a fifth above (D, 294 Hz) on the breath between. G and D are the two ends of the existing breath tone. |

Measured offline (30 seconds each, headless Chrome): RMS between -25 and -21 dBFS, peaks under -5 dBFS, no clipping. That is a level check only. Nobody has listened yet: the walkthrough is where Tommy does.

Every sound fades in over one in-breath (four seconds) and out over one out-breath (six). The closing bell of a sit with a length is the existing `strike()`, lower and longer than unlock (528 Hz, four seconds).

**If the forest sounds drawn.** Synthesised noise is convincing as rain and surf; synthesised birds are the weak one. If Tommy's verdict on the walkthrough is that the forest sounds like a toy, package S4 replaces the forest alone with a recorded loop (a public-domain field recording, about a megabyte of AAC, precached by the service worker so rule 22 still holds). That needs rule 21 amended, since it says "no files", and a crossfaded loop point. Rain, Ocean and Bowl stay synthesised either way.

### 3.2 What the iPhone does to it

Three things about sound from a Home Screen web app decide the design. Each is an iPhone-only check, listed again in S1.

1. **The ringer switch.** Safari's default audio session is `ambient`, which the silent switch mutes; `navigator.audioSession.type = "playback"` (Safari 16.4 and later) makes the page's sound media, which the switch does not mute. The plan sets `playback` when a sit begins and `auto` when it ends, behind the Settings switch. Side effect to know: `playback` is exclusive, so music playing in Spotify's app pauses when a sit begins; with the switch off the sit stays `ambient`, mixes with Spotify and obeys the ringer. [MDN](https://developer.mozilla.org/docs/Web/API/AudioSession/type), [WebKit list](https://lists.webkit.org/pipermail/webkit-unassigned/2024-September/1186593.html).
2. **The lock screen.** An `AudioContext` may be suspended when the page goes to the background or the phone locks; the WebKit bug on this has been fixed, broken and fixed again across iOS 17 point releases, and there is no current statement for Home Screen apps. So the plan does not depend on it: a wake lock keeps the screen lit for the length of the sit (the page is nearly empty and, at night, nearly dark), and if the phone is locked anyway the sit ends where it was. [WebKit bug 261554](https://bugs.webkit.org/show_bug.cgi?id=261554).
3. **The first sound needs a tap.** The circle is that tap; nothing plays before it (which is also rule 21).

If check 2 comes back "it keeps playing while locked" on Tommy's phone, a later package can let the sit run with the screen off by routing the same graph through a media element; that is not planned until the check is in.

## 4. The shape (one line per walkthrough step)

`design/meditate/index.html`, nine steps, on `meditate.css` and `meditate.js` with copies of `tokens.css`, `parts.css`, `flows.css` and `flows.js`:

1. **Meditate sits with my flows.** The Flow list: Right now, Meditate with its plain circle, then the flows.
2. **One circle.** The page at rest: the circle breathing with "begin" in print, the sound chips, the minutes, "last sat".
3. **Everything else leaves.** Sitting with rain: the circle and nothing else.
4. **The sea breathes with the circle.** Sitting with the ocean at night.
5. **Birds, a long way off.** Sitting with the forest.
6. **A sit can have an end.** Ten minutes with the bowl, thirty seconds from the end: the ink stroke almost round; the bell.
7. **The page comes back.** After: "Sat · 12 minutes · rain" and a row to today's journal page.
8. **In Still, only the circle and the sounds.** No lengths, nothing about last time.
9. **A flow can send me here.** Panic, Under the skin: a tip row "Sit with the rain" with the helper named Sit.

## 5. Data (schema version 4)

- **`sits`**: `{ id, startedAt, endedAt, sound: 'rain' | 'ocean' | 'forest' | 'bowl' | 'quiet', minutes?, pageId?, episodeId? }`, index `startedAt`. One row per sit of a minute or more, written when it ends. `minutes` is the chosen length (absent on an open sit); `pageId` is set when "Write it down" opens today's page; `episodeId` when the sit was reached from a flow's tip. Nothing in it is private text, so `fields.ts` seals nothing; `backup.ts` walks `TABLES`, so export and import carry it.
- **`pages`** gains optional `sit?: { sitId }`, like `flow`. Unindexed.
- **Settings** gains `sitSound` (`'rain'`), `sitMinutes` (`0`, open) and `sitThroughSilent` (`true`).
- **`Tip.helper`** gains `'sit'` (S3).
- `SCHEMA_VERSION` 4; `TABLES` gains `sits`. The upgrade writes nothing. S1 ships without the table; S2 adds it.
- Route `#/flow/meditate`, matched before `#/flow/:id` (as `#/flow/now` is). With the door on, the lock lets it through (S3): the page holds nothing private, and a sit begun before the PIN is written once the PIN is in, like the dot.

## 6. Build packages (one PR each, same rules as PLAN.md section 10)

| # | Package | Done when |
|---|---|---|
| S1 | The circle and the sounds | `parts/Sound` gains `scape(name)` returning `{ t0, end(seconds) }` for rain, ocean, forest and bowl, ported from `design/meditate/meditate.js` (one `AudioContext`, the bells' own); `parts/Circle` (the drawn circle, breathing on `--t-breath` at rest and on the sound's clock while sitting; reduced motion stills it); `ui/flow/Meditate.tsx` at `#/flow/meditate` with the sound chips (`settings.sitSound`), the sitting state (header, tabs, rules, lamp and words fade; wake lock; tap to end; four seconds in, six out), Quiet; the list row, second; `audioSession` set to `playback` for the sit behind `settings.sitThroughSilent` and its Settings row; ticks on begin and end. Unit: the scape graph on a fake context, Quiet makes no nodes, the ocean's curves land on the breath; e2e: the row opens the page, a tap sits, a tap returns, an offline reload keeps the chosen sound; three lights. |
| S2 | A sit with an end, and what is kept | The minutes chips (`settings.sitMinutes`); the ink stroke round the circle and the closing bell (the bell follows the Sounds switch); the `sits` table and schema version 4; "last sat" on the list row and the page; the after page with "Write it down" linking today's page by `page.sit`; a sit under a minute writes nothing and returns to rest; Still: chips for sound only, always open, nothing about last time; backup round trip. |
| S3 | From a flow, and through the door | `Tip.helper` `'sit'`: the row opens `#/flow/meditate`, the sit carries `episodeId`, and the tip is ticked when a sit of a minute or more ends; seeded as "Sit with the rain" on Panic "Under the skin", What if "Night before" and Energize "Landing" (existing users get the three tips added once, as a first revision, like every seed); the step sheet lists Sit among the helpers; `doorPasses` lets `#/flow/meditate` through read-only with the sit held in memory until the PIN. |
| S4 | A recorded forest (only if the synthesised one fails the listen) | One loop, precached, crossfaded at the seam, for Forest alone; rule 21 amended; `check-dist` still passes its size budget. |
| S5 | A Muse sitting, after the fact (only if Tommy has the headset and wants it; section 7) | Not planned in detail. |

Every PR: `npm test`, `npm run e2e`, three-lights screenshots, `design/meditate/index.html` rebuilt from the real components for the steps it touches, both lints PASS pasted in the body, no em dashes.

**Haptics and sound.** One new tick site for rule 19: beginning and ending a sit (`sit`). Rule 21 gains the four scapes and the closing bell: begun only by the tap on the circle, faded in over an in-breath and out over an out-breath, chosen by the chip (Quiet is off), and, alone among the app's sounds, played with the ringer off when `sitThroughSilent` is on.

**The motion rules (26 to 31).** Press (26): the chips take the motion pass's `.fs-chip` press state, and the circle gives under the thumb (`scale(var(--press))` on the drawn path, down at once, back over `--t-ui`). Drawn (27): the ink stroke of a sit with an end is a clock drawn as a line, so it runs on the sit's time and not `--t-draw`; when the page returns it is lifted over `--t-ui`. The same thing (28): the row's small circle is the page's circle, so it travels there through `parts/Turn` the way a flow's small drawing does (motion M2's `open` turn; S1 names the two circles for it, and the turn itself arrives with M2). The paper (29): sitting is not a turn between pages, and it is the one place the paper itself leaves; the rule gains that sentence. Breathing (31): the circle is the ring at the size of the page, so "the three that breathe" names it with the ring. The stream (30) does not run here: the circle has no steps and no pace.

**parts.css.** Meditate's rules go in one block of their own, placed immediately above the `==== Motion` comment, so the motion packages' sections at the end of the file are not touched.

**Tokens.** None new expected: the circle is `--print`, the stroke `--ink`, the breath `--t-breath`, the fades `--t-light`, the type `--fs-print` and `--fs-chip`.

**Rules touched.** DESIGN.md rule 13 (a sit in Still is open and shows no "last sat"), rule 15 (one line: a sit keeps its date, never a total or a run), rule 19 (the tick site), rule 21 (above), rule 29 (sitting) and rule 31 (the circle breathes). Rule 22 is untouched: nothing here makes a request.

**iPhone-only checks (S1, for Tommy's phone).** With the ringer off, is the rain heard (switch on) and silent (switch off)? Does Spotify pause when a sit begins? Does the screen stay lit for ten minutes? What happens to the sound when the phone is locked by hand? Does the circle stay in time with the waves after ten minutes? Are the ticks felt?

## 7. Muse: what is open

Checked 2026-11-09. Short answer: there is no way for FlowState on the iPhone to hear a Muse headset while it is worn. One path works after the fact.

| Path | What it is | Verdict for FlowState |
|---|---|---|
| **Muse SDK (LibMuse)** | Interaxon's own library. Registration by form; licensed "for testing, prototyping, art projects, and personal exploration", a separate licence for commercial use. Native iOS, Android, Windows and macOS only; no web or JavaScript SDK and no cloud API. Whether it reads the newest headset (Muse S Athena) I could not confirm. | Closed to a web app. It would mean wrapping FlowState in a native shell, which is a different architecture from PLAN.md. |
| **Web Bluetooth** | Community libraries read the headset straight from a browser: `web-muse` (Muse 2, Muse S, Athena, maintained), `muse-js` (older, unmaintained). They need `navigator.bluetooth`. | Closed on the iPhone: WebKit does not implement Web Bluetooth. An App Store extension (beacio) adds it to Safari tabs on iOS 26.2 and later, but its listing says Home Screen web apps are not supported, and a Safari tab has its own storage, so it would not be Tommy's journal. Open only in Chrome on a Mac or Android. |
| **Mind Monitor** | A third-party iPhone app that reads every Muse including Athena, streams OSC over UDP on Wi-Fi, and records sessions to a file (iCloud Drive). | Live: closed (a web page cannot receive UDP). **After the fact: open.** A recording can be imported into FlowState from Files, with no network, and laid against the sit by its timestamps. |
| **Muse app and Apple Health** | Muse's own app writes meditation minutes to Apple Health. | Closed: a web app cannot read HealthKit, and minutes are all that is written. |
| **A Mac in between** | OpenMuse (Python, Athena, research use) or `web-muse` in Chrome can read the headset on the laptop. | Possible only as a separate thing on the Mac; FlowState's data stays on the phone and the app makes no requests. |

**What S5 would be, if wanted.** Wear the headset with Mind Monitor recording in the background while sitting in FlowState; afterwards, "Bring in a recording" on the after page opens the file picker, the recording is matched to the sit by time, and the page draws one line under the circle (calm against time, from the band powers in the file), with no score and no number. It is the same shape as the eyes plan's export: files in, nothing sent. It depends on which headset Tommy has and on Mind Monitor's file format, which I have not opened.

**What is not possible.** The thing Muse's own app does, the weather calming as the mind does, needs the headset live and so cannot be built into the iPhone app. In Chrome on the Mac it could be, but that is a different product.

Sources: [Muse developers page](https://choosemuse.com/pages/developers), [web-muse](https://github.com/itayinbarr/web-muse/), [muse-js](https://github.com/urish/muse-js), [beacio listing](https://apps.apple.com/us/app/ioswebble/id6761301368), [WebKit bug 101034](https://bugs.webkit.org/show_bug.cgi?id=101034), [Mind Monitor](https://musemonitor.com/), [OpenMuse](https://github.com/DominiqueMakowski/OpenMuse).

## 8. Open questions for Tommy

1. Where the row sits: second, under Right now (assumed), or last, above "+ flow"?
2. The sounds, after listening on the walkthrough: which stay, and does the forest pass or go to a recording (S4)?
3. With the ringer off: should a sit be heard (assumed, and Spotify pauses for it) or follow the switch like the bells?
4. Lengths: Open, 5, 10, 20 (assumed), or other numbers, or no lengths at all?
5. "Last sat" and the `sits` row: keep (assumed), or should a sit leave no trace?
6. The door: may Meditate open without the PIN when the door is on (assumed yes, it holds nothing private)?
7. Which flows' steps get the seeded "Sit with the rain" tip: the three named in S3, others, or none?
8. Muse: which headset do you have, and is the after-the-fact line (S5) worth building?

## 9. Artifact

`design/meditate/index.html`, published 2026-11-09 as https://claude.ai/artifact/BuSuKBVtH7VvFkoN4aBdBR (slug 584e0679-3fd0-4c1b-9cab-0054b1b7822c), published from the seven files in `design/meditate/`. Its mocks are live: step 2 runs the whole loop, steps 3 to 6 play rain, ocean, forest and the bowl, and step 6 rings the closing bell when the circle closes.
