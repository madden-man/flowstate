# The Sunday question: push setup

How the weekly check-in reaches the phone when the app is closed, in one place: the server half (N2), the phone half (N3), how to deploy it, and what only the iPhone can tell. `PLAN-PUSH.md` is the why; this is the how. The walkthrough (N4) shows every screen: `npm run walkthrough:push` builds it into `design/push/dist/`.

In order: what the server keeps, the env, the deploy, the routes, the hourly run, the phone, the iPhone checklist, sending a test, the walkthrough.

The code: `netlify/functions/push.mts` (the four routes), `netlify/functions/checkin.mts` (the hourly run), `netlify/functions/lib/` (`due.mts` the wall clock, `routes.mts` the checks, `store.mts` the Blobs store, `send.mts` the push, `checkin.mts` the run itself). Tests: `test/push/`.

## What the server keeps

One blob per phone in the Netlify Blobs store `push`, keyed by the sha256 hex of the phone's push address:

```json
{
  "subscription": { "endpoint": "https://web.push.apple.com/…", "keys": { "p256dh": "…", "auth": "…" } },
  "tz": "America/Denver",
  "weekday": 0,
  "hour": 10,
  "minute": 0,
  "lastSentWeek": "2026-11-22",
  "updatedAt": "2026-11-25T14:00:00.000Z"
}
```

An address, a time and a zone. Never a word: the question, the journal and the answer stay on the phone. Every push carries exactly `{"kind":"checkin"}`; the service worker reads his line from its own IndexedDB.

`lastSentWeek` names a week by the local date of its Sunday. At most four phones are stored; a fifth new address is refused, an existing one may always update.

## Env (once, before the first deploy that includes the functions)

Three values on the site, all functions scope:

| Name | What |
|---|---|
| `VAPID_PUBLIC_KEY` | The public half; the phone fetches it from `GET /api/push/key` to subscribe |
| `VAPID_PRIVATE_KEY` | The private half; signs every push. Never in the app, never in the repo |
| `VAPID_SUBJECT` | A `mailto:` address the push services can contact about abuse |

Make a pair:

```
npm run vapid
```

It prints three lines and writes nothing. Fill your own address into the `VAPID_SUBJECT` line, then from `~/dev/flowstate` (the linked checkout):

```
netlify env:set VAPID_PUBLIC_KEY "<public key>"
netlify env:set VAPID_PRIVATE_KEY "<private key>"
netlify env:set VAPID_SUBJECT "mailto:<your address>"
```

Keep the pair: a new pair silently breaks every stored subscription (each phone has to turn the switch off and on again). Without the env, `GET /api/push/key` answers 503 and the hourly run logs a line and sends nothing.

Netlify Blobs needs no setting: it is on for every site, and functions get its credentials from the runtime. `netlify dev` uses a local sandbox store under `.netlify/` (ignored by git).

## Deploy, in this order

1. Set the three VAPID values above (`netlify env:set`, once). A deploy without them still works, but Notify me answers "Not set up yet" and the hourly run sends nothing.
2. Once `push-plan` is merged to main, deploy from `~/dev/flowstate` only (the linked checkout, on main; a worktree deploy makes a stray site):

   ```
   cd ~/dev/flowstate && git pull && netlify deploy --build --prod
   ```

   The build bundles the two functions with the app (`netlify.toml` `functions = "netlify/functions"`); nothing else changes in the deploy.
3. Check the server answers: `curl -s https://flowstate-journal.netlify.app/api/push/key` gives `{"key":"..."}`, not 503.
4. On the iPhone, open the home-screen app once so the new service worker (with `importScripts("/push-sw.js")`) takes over, then work through the checklist below.

## The routes

All under `/api/push/`, JSON in and out, `cache-control: no-store`. Errors are `{ "error": code }` or `{ "error": "invalid", "field": name }`, never a stack trace. Bodies over 4096 bytes are refused with 413.

| Route | Body | Answers |
|---|---|---|
| `GET /api/push/key` | none | 200 `{ "key": "<VAPID public key>" }`; 503 `not_configured` |
| `POST /api/push/subscribe` | `{ subscription: { endpoint, keys: { p256dh, auth } }, tz, weekday, hour, minute, replaces? }` | 200 `{ "ok": true }`; 400 `invalid` with `field` one of `endpoint`, `keys`, `tz`, `weekday`, `hour`, `minute`, `replaces`; 400 `bad_json`; 409 `too_many_devices`; 413 `too_large` |
| `POST /api/push/unsubscribe` | `{ endpoint }` | 200 `{ "ok": true }` (also when it was not stored); 400 `invalid` `endpoint` |
| `POST /api/push/test` | `{ endpoint }` | 200 `{ "ok": true }` (sent); 409 `not_subscribed`; 410 `gone` (the push service dropped it; it is deleted, subscribe again); 502 `push_failed`; 503 `not_configured` |

Anything else is 404 `not_found`.

The checks, because there are no accounts: the endpoint must be `https` on `*.push.apple.com`, `fcm.googleapis.com`, `*.notify.windows.com` or `updates.push.services.mozilla.com`, with no port or credentials; `tz` must be an IANA name the runtime knows; `weekday` 0 (Sunday) to 6, `hour` 0 to 23, `minute` 0 to 59, all integers. Only the known fields are stored. `test` only ever sends to an address that is already stored, and only the wordless payload.

`replaces` (optional, N3) is the address this phone posted before, sent when iOS has since given it a new one. When it is a push address and is stored, the new entry takes the later of the two week stamps and the old blob is deleted, so the phone is never pushed twice in a week and the old address does not count toward the four. When it is not stored it changes nothing.

`not_subscribed` is 409 rather than 404 because Netlify retries a function's 404 against `.html` and `/index.html` variants of the path, which would turn it into `not_found`.

## The hourly run

`checkin.mts` runs at the top of every UTC hour. For each stored phone, in its own zone: if today is the chosen weekday, the time is at or past the chosen hour and minute, and `lastSentWeek` is not this week, it sends one push and stamps the week. So a run that is late or skipped still sends later the same local day, a missed day is not sent on Monday, and nothing is sent twice in a week (including the hour that repeats when the clocks go back). A 404 or 410 from the push service deletes that phone's blob; any other error is logged and the phone is left for the next run that day. A re-subscribe keeps the week stamp.

## The phone (N3)

**With worlds** (PLAN-WORLDS.md): the Sunday question always belongs to his own pages. Its settings live on the personal notebook's row; with a world worn the quiet line waits, and a tap on the notification takes the world off (as the door does) before landing on today's page. Nothing of it enters a world's database, the outbox or the bridge (`test/push/worlds.test.ts`). The service worker answers neither `/api/push/*` nor `/.netlify/*` with the app's page.

The code: `src/push/push.ts` (the only code allowed to call the routes, same origin only), `src/push/store.ts` (the `fs-push` database), `public/push-sw.js` (the worker's two handlers), `src/ui/settings/PushRows.tsx` (the Settings controls, inside the Sunday question's row). Tests: `test/push/push.test.ts`, `test/push/push-sw.test.ts`, `test/e2e/push.spec.ts`.

**Settings.** With the Sunday question on, under its line and time:

| State | What shows |
|---|---|
| In Safari, not the home-screen app | "Notify me", held, and "Add to Home Screen first" |
| Denied in iOS | "Notifications are off for FlowState in iOS Settings", no button |
| No Web Push at all | nothing |
| Off | "Notify me" Off. A tap asks iOS (only ever from that tap), subscribes, posts the schedule |
| On | "Notify me" On, "Send one now", and once one has landed "Last arrived Sunday 10:00" (hidden in Still) |

A tap that comes to nothing leaves the switch off with one line: "Not set up yet" (the server has no VAPID env), "No connection", or "Did not work". "Send one now" answers "Sent" or the same lines. Switching the Sunday question off switches push off too. Whether push is on is `settings.checkin.push`; an import never changes it (it is this phone's subscription).

**What goes to the server.** Only on his tap, and after that only when something moved: `resubscribeIfMoved()` runs on every open and every return to the front, reads the subscription on the phone, and posts only if the address is missing or changed, the time zone changed, or the time changed since the last post (remembered in localStorage as `fs-push-posted`). A changed address is posted with `replaces`. Every call fails quietly offline; the journal opens and works in airplane mode with push on.

**The line reaches the worker without the server.** The app writes his line to its own IndexedDB database `fs-push` (one store `push`, keys `line` and `lastArrivedAt`), outside Dexie and outside the PIN, whenever the line changes while push is on. It is not in the export. Turning push off empties it.

**The worker.** `vite.config.ts` adds `importScripts: ['/push-sw.js']`; the built `dist/sw.js` begins its body with `importScripts("/push-sw.js")` and precaches the file with the rest. On `push` it always shows a notification: title "FlowState", body his line, `tag: 'checkin'` (a new one replaces an old one), the app icon; if the line cannot be read, the bare title. Then it writes `lastArrivedAt` and tells any open window. On `notificationclick` it focuses the open app, sends it a message `{ kind: 'checkin' }` (iOS may not change the address of an app already open) and navigates it to `/#/journal?ask=checkin`, or opens that address if no window is open. Either way the app lands on today's page with the question, after the PIN. Landing twice writes nothing twice.

**Testing here.** Desktop Chromium cannot receive a real push from Apple. The e2e spec stubs PushManager and the routes, and wakes the real built worker's `push` handler through the DevTools protocol, so the worker, `fs-push` and "Last arrived" are real; the notification tap is tested by posting the worker's message.

## Only the iPhone can tell (for Tommy)

After the first deploy with the VAPID env set, on the home-screen app:

- [ ] Settings, Sunday question, "Notify me": the iOS permission prompt appears from that tap (it never appears in a Safari tab, where the row says "Add to Home Screen first").
- [ ] "Send one now": a notification arrives, title "FlowState", body your line.
- [ ] It arrives with the app closed, and with the phone locked.
- [ ] It arrives in a Focus mode you expect it to pass (or does not, in one you expect to hold it).
- [ ] With the app swiped away for a while, a push still shows your line (the worker read `fs-push` cold). If it ever shows only "FlowState", tell me: that is the fallback, not a failure.
- [ ] A tap opens the installed app, not Safari; with a PIN, the keypad first, then today's page with the question and Turn to answer open.
- [ ] A tap with the app already open on another tab lands on the question too.
- [ ] "Last arrived" shows after a push, and still shows after a week untouched, an app update, and a phone restart (the subscription survived).
- [ ] The Sunday 10:00 push comes on its own.

## Sending a test

From the phone: "Send one now" in Settings posts its own endpoint to `/api/push/test`.

By hand, with an endpoint you already subscribed:

```
curl -s -X POST https://flowstate-journal.netlify.app/api/push/test \
  -H 'content-type: application/json' \
  -d '{"endpoint":"https://web.push.apple.com/…"}'
```

Locally, `netlify dev` answers the routes (with the three env values exported in the shell), and `curl -X POST http://localhost:8888/.netlify/functions/checkin` runs the hourly pass once.

## The walkthrough

`npm run walkthrough:push` builds the real app with example data into `design/push/dist/` (eight steps: the Settings row, Notify me and iOS's question, Send one now, the lock screen, the PIN, the landing, the quiet line, Safari) and runs the artifact lint and check-dist on it. The lock screen, iOS's permission question and Safari's bar are drawn, since they are the phone's and not FlowState's; every FlowState screen is the app itself, its storage in memory and its network refused. The push rows' state comes from a build-time seam (`design/push/vite.config.ts`), because the artifact host has no service worker. The spec is `test/e2e/walkthrough-push.spec.ts`.

