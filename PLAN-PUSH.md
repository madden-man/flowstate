# FlowState: the Sunday question

Planned 2026-11-25 at Tommy's ask: "make a plan for push notifications in flow state (you can mimic the architecture for it in semper dulce or make options for simplifying) so i can set up weekly check ins on sunday mornings that ask me if there's anything on my mind."

Status: planned 2026-11-25; being built the same day on `push-plan` (draft PR), packages N0 to N4. Decided by Tommy: 10:00 Sunday. The other three defaults in section 8 stand until he overturns them.

## 1. The idea

1. **One question a week, in his words.** Sunday morning the phone shows one line he wrote himself. The default is his own sentence from the ask: "Is there anything on your mind?"
2. **A tap lands on the page.** The notification opens FlowState (the PIN first, as always), then today's Journal page with the question set as a line and Turn to answer open, the same landing as Third eye's Ask.
3. **The question waits in the app too.** If the push never arrives (no signal, iOS dropped the subscription, notifications off), the first open on or after Sunday morning shows the same line under the Journal page. The push is a knock; the question does not depend on it.
4. **The server knows a time, not a word.** It holds the phone's push address, a weekday, an hour and a time zone. The question's words stay on the phone; the push carries no text.
5. **Off by default, asked only on a tap.** Like Spotify and Research, nothing leaves the phone until he turns it on in Settings.

## 2. What this overturns

FlowState has no server today, and two documents say it never will:

- `PLAN.md` principle 1: "No server, no accounts, no analytics, no network after the first load."
- `DESIGN.md` rule 22 allows `fetch(` only under `src/music/` and `src/research/` (lint DL21, `script/check-dist.mjs` names the hosts), and its research notes list "no notifications" under calm technology.

An iPhone home-screen app cannot schedule a notification for itself. iOS has no local scheduling for web apps; a notification only appears when a server sends a Web Push. So a real Sunday notification means one small server piece. This plan adds a third opt-in exception, `src/push/`, with the same shape as the other two: off until he switches it on, same-origin only, and the journal still opens and works in airplane mode.

The calm note becomes: one notification a week, that he set, in his words, and never a second one.

## 3. Options

| | What it is | Tap opens | Server | Verdict |
|---|---|---|---|---|
| **A. Web Push, slimmed** | Semper Dulce's Web Push with everything two-person removed | FlowState itself, on the page | Two Netlify functions + Netlify Blobs | **Recommended** |
| B. Semper Dulce copied whole | `notify()` with Mongo, ntfy fan-out, the digest queue, quiet hours, per-person audiences | FlowState | Mongo + three functions | More than one phone and one push a week needs |
| C. ntfy only | A scheduled function posts to an ntfy topic; the ntfy app shows it | Safari, not the home-screen app. On iOS those two have separate storage, so the journal there is empty | One function | Cannot land on the page. No |
| D. A repeating Calendar or Reminders event | "Anything on your mind?" every Sunday 10:00, made once by hand or by a `calshow:` link the app already knows how to build | Calendar | None | Works today with zero code, but it is Calendar asking, and it cannot open FlowState. A stopgap |
| E. In the app only | The question shows on the first open on or after Sunday morning | n/a | None | Not a notification. Kept as part of A (idea 3), built first |
| F. Declarative Web Push | iOS 18.4+ can show a push from a JSON payload with no service worker code | FlowState | Same as A | Saves about thirty lines of service worker, but the words must travel through the server. Not worth the trade; revisit only if the service worker handler proves flaky |

### What A keeps from Semper Dulce, and what it drops

Read from `~/dev/semper-dulce` (`src/lib/push.ts`, `public/sw.js`, `netlify/functions/lib/notify.cjs`, `api.cjs`, `jay.cjs`, `scripts/vapid.mjs`).

| Semper Dulce | FlowState |
|---|---|
| `src/lib/push.ts`: `pushState`, `turnOnPush`, base64 key helper, the five states (`unsupported`, `needsHomeScreen`, `denied`, `off`, `on`) | Copied nearly as is into `src/push/push.ts`, minus `person` |
| `public/sw.js` `push` and `notificationclick` handlers | Copied into `public/push-sw.js`, loaded by the generated worker (section 5) |
| `web-push` + VAPID keys in Netlify env, `scripts/vapid.mjs` | Same |
| Mongo collection `dulce-push` | Netlify Blobs store `push`, one small JSON per device. No database |
| `denverParts`, `denverToDate` (DST-safe wall clock) | Same maths, the zone read from the stored subscription instead of fixed to Mountain |
| Hourly `jay` function | Hourly `checkin` function |
| ntfy second channel | Dropped (option C's problem) |
| Digest queue, quiet hours, `instant`, kinds, Nala's voice | Dropped. One push, at the hour he chose, with no text |
| `person`, audiences, `retagPush` | Dropped. One person |
| Dropped subscriptions cleared on 404 / 410 | Kept |

## 4. What he sees

**Settings, a new row "Sunday question"** (under Sounds, above Storage):

- Off: the row and a switch. In Safari rather than the home-screen app it reads "Add to Home Screen first" (the `needsHomeScreen` state) and the switch is held.
- Turning it on asks iOS for permission (only ever from that tap), then the row opens to three things on the page's rules: the question as an editable line, the time (a wheel, default 10:00), and "Send one now".
- Under them, in print: when the last one arrived ("Last arrived Sunday 10:00"), written by the service worker when a push lands. It is how he can tell the thing is alive without waiting a week. Hidden in Still, like every state.
- If iOS says denied: one line, "Notifications are off for FlowState in iOS Settings", no button that cannot work.

**Sunday, the lock screen:** title "FlowState", body his line. One notification, replaced not stacked if an old one is still there (`tag: 'checkin'`).

**The tap:** the app opens or comes to the front, the PIN sheet rises if the lock is on, then today's page with his question written as a line and Turn to answer open (DESIGN.md rule 17). The page is linked to the check-in the way a sit or a sign links a page (`pages.ts todayLinked`), so "pages that began from a Sunday question" can be found later without a count anywhere.

**No tap:** the first open on or after the chosen time that week, the Journal shows the question as one quiet line under the page, where the backup line goes (`UpdateToast.tsx`, `pwa/hints.ts`). A tap does the same landing; a swipe puts it away until next Sunday. Never in Still. If the backup line is also due, the question wins that day.

Nothing is counted: no "3 Sundays answered", no badge on the icon.

## 5. How it is built

```
phone (src/push/)                         Netlify (same origin)
  Settings switch
    Notification.requestPermission()
    pushManager.subscribe(VAPID public) --> POST /api/push/subscribe
                                              { subscription, tz, weekday, hour, minute }
                                              Blobs store "push", key = sha256(endpoint)

                                          checkin (scheduled, hourly)
                                            for each stored device:
                                              is it that weekday and hour in its tz,
                                              and not already sent this week?
  service worker "push" event         <--   web-push send, payload { kind: "checkin" }, TTL 12h
    reads his line from the phone             404 / 410: delete the blob
    showNotification("FlowState", line)
  "notificationclick"
    focus or open /#/journal?ask=checkin
```

**The phone**

- `src/push/push.ts`: `pushState()`, `turnOn()`, `turnOff()`, `sendNow()`, `resubscribeIfMoved()`. The only new code allowed to `fetch`, and only to `/api/push/*`.
- `src/push/due.ts`: pure. Given the schedule, the last week it was shown or answered, and now, is the in-app line due? Unit tested. No network.
- `public/push-sw.js`: the `push` and `notificationclick` handlers. `vite.config.ts` gains `workbox: { importScripts: ['/push-sw.js'] }`, so the generated worker stays generated and precaching is untouched.
- **The line reaches the worker without the server.** The app writes `{ line, lastArrivedAt }` to a tiny IndexedDB database of its own (`fs-push`, one store), which the worker reads with the raw API. It is outside the Dexie schema, so no schema bump for it, and it holds one sentence he chose to show on a lock screen, so it is not encrypted with the PIN key (the worker has no key).
- `Settings` gains `checkin?: { on, weekday: 0, hour: 10, minute: 0, line, lastShownWeek }` and `Page` gains an unindexed `checkin?: { week }` link. Whether that bumps `SCHEMA` (main is 9) depends on how `backup.ts` validates fields; the builder checks and bumps only if export or import would drop it.
- **iOS drops subscriptions quietly.** On every open with the switch on, `resubscribeIfMoved()` reads the current subscription locally and posts only if the endpoint is missing or changed. No request on a normal open.

**The server**

- `netlify/functions/push.mts`, routes under `/api/push/`: `GET key` (the VAPID public key), `POST subscribe`, `POST unsubscribe`, `POST test` (sends to the caller's own endpoint only).
- `netlify/functions/checkin.mts`, `schedule: "@hourly"`. Hourly because Netlify schedules run in UTC and Sunday 10:00 moves with daylight saving and with travel; the function does the wall-clock check per device with the copied time-zone maths. About 720 runs a month, far inside the free tier.
- `netlify/functions/lib/due.mts`: pure, shared shape with `src/push/due.ts`, unit tested across both DST changes and a Tokyo zone.
- Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, set with `netlify env:set`. `script/vapid.mjs` prints a pair.
- `netlify.toml`: `functions = "netlify/functions"`. The SPA fallback stays last; the functions claim `/api/push/*` by their own `config.path`.

**Guarding a public endpoint.** There are no accounts, so `subscribe` is open to anyone who finds it. What limits the harm: the endpoint must be `https` on a known push host (`*.push.apple.com`, `fcm.googleapis.com`, `*.notify.windows.com`, `updates.push.services.mozilla.com`), which also stops the function being pointed at arbitrary URLs; the store holds at most four devices and refuses a fifth; the payload is fixed and has no words; `test` only ever sends to the endpoint in its own request. The worst case is a stranger receiving a wordless weekly push they asked for.

**The time zone follows the phone.** `resubscribeIfMoved()` also posts when `Intl.DateTimeFormat().resolvedOptions().timeZone` differs from what was last sent, so Sunday morning in Japan is Sunday morning in Japan, at the cost of one small request the first time the app opens in a new zone.

## 6. Packages

Each is one PR, with its steps added to a `design/push/` walkthrough built from the real components (CLAUDE.md rule 5).

| | Package | Done when |
|---|---|---|
| N0 | **The rule change.** `PLAN.md` principle 1 and `DESIGN.md` rule 22 name `src/push/` as the third exception; lint DL21 and `check-dist.mjs` allow same-origin `/api/push/` from it; the calm note is reworded | Lints pass; a `fetch(` anywhere else still fails |
| N1 | **The question in the app.** `checkin` in Settings, the Settings row (line and time only, no switch for push yet), `due.ts`, the Journal line, the landing on today's page with Turn to answer, the page link | Set the clock to Sunday 10:01: the line shows once, lands on the page, and is gone until next week. Works in airplane mode. Three lights reviewed |
| N2 | **The server.** `push.mts`, `checkin.mts`, `lib/due.mts`, Blobs store, VAPID script and env, host allowlist, the four-device cap | Unit tests for due (DST both ways, Tokyo, already sent this week), subscribe validation, 410 cleanup. `netlify dev` answers `GET /api/push/key` |
| N3 | **The phone's half.** `src/push/push.ts`, `push-sw.js` through `importScripts`, the `fs-push` store, the switch, "Send one now", "Last arrived", `resubscribeIfMoved` | On the iPhone: switch on, Send one now, the notification shows his line, a tap lands on the page behind the PIN |
| N4 | **Walkthrough and docs.** `design/push/` steps (Settings off, permission, on, the lock screen, the landing, the in-app line), `docs/PUSH.md` with the env and the iPhone checks | Artifact lint PASS; published private |

N1 stands alone and can ship before any server exists. N2 and N3 can be built side by side by two agents.

Deploy is unchanged (`netlify deploy --build --prod` from `~/dev/flowstate` only), and now also bundles the functions; the VAPID env must be set before the first deploy that includes N2.

## 7. Only the iPhone can tell

- Permission prompt appears from the Settings tap in the home-screen app (iOS 16.4+; it never appears in a Safari tab).
- A push arrives with the app closed, with the phone locked, and in a Focus mode he expects it to pass.
- The worker reads the line from `fs-push` when woken cold. If iOS ever fails this read, the worker falls back to the bare title "FlowState" rather than showing nothing, because iOS withdraws a subscription whose pushes show no notification.
- The tap opens the installed app, not Safari, and reaches the page after the PIN.
- The subscription survives a week untouched, an app update, and a phone restart. "Last arrived" is the evidence.

## 8. Open for Tommy

1. ~~The time.~~ Decided 2026-11-25: 10:00 Sunday, in whatever zone the phone is in.
2. **The line on the lock screen.** His question is not private, but it does say a journal is asking. The alternative is a bare "FlowState" with the question only inside. Default: show the line.
3. **Still.** The server cannot know the light. Default: the push still comes on Sunday morning (Still is a night thing), and the in-app line stays out of Still.
4. **More than one.** The stored shape is a list, so a Wednesday question or a monthly one is a later row in Settings, not a rebuild. Only Sunday is built now. Want a second from the start?
5. **A stopgap this Sunday.** Option D (a repeating Calendar event) takes a minute by hand if he wants the question before any of this is built.
