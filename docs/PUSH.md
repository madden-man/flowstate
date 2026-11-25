# The Sunday question: push setup

How the weekly check-in reaches the phone when the app is closed. Companion to `PLAN-PUSH.md` section 5. This page covers the server half (package N2); the phone half and the iPhone checks are added with N3 and N4.

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

## The routes

All under `/api/push/`, JSON in and out, `cache-control: no-store`. Errors are `{ "error": code }` or `{ "error": "invalid", "field": name }`, never a stack trace. Bodies over 4096 bytes are refused with 413.

| Route | Body | Answers |
|---|---|---|
| `GET /api/push/key` | none | 200 `{ "key": "<VAPID public key>" }`; 503 `not_configured` |
| `POST /api/push/subscribe` | `{ subscription: { endpoint, keys: { p256dh, auth } }, tz, weekday, hour, minute }` | 200 `{ "ok": true }`; 400 `invalid` with `field` one of `endpoint`, `keys`, `tz`, `weekday`, `hour`, `minute`; 400 `bad_json`; 409 `too_many_devices`; 413 `too_large` |
| `POST /api/push/unsubscribe` | `{ endpoint }` | 200 `{ "ok": true }` (also when it was not stored); 400 `invalid` `endpoint` |
| `POST /api/push/test` | `{ endpoint }` | 200 `{ "ok": true }` (sent); 409 `not_subscribed`; 410 `gone` (the push service dropped it; it is deleted, subscribe again); 502 `push_failed`; 503 `not_configured` |

Anything else is 404 `not_found`.

The checks, because there are no accounts: the endpoint must be `https` on `*.push.apple.com`, `fcm.googleapis.com`, `*.notify.windows.com` or `updates.push.services.mozilla.com`, with no port or credentials; `tz` must be an IANA name the runtime knows; `weekday` 0 (Sunday) to 6, `hour` 0 to 23, `minute` 0 to 59, all integers. Only the known fields are stored. `test` only ever sends to an address that is already stored, and only the wordless payload.

`not_subscribed` is 409 rather than 404 because Netlify retries a function's 404 against `.html` and `/index.html` variants of the path, which would turn it into `not_found`.

## The hourly run

`checkin.mts` runs at the top of every UTC hour. For each stored phone, in its own zone: if today is the chosen weekday, the time is at or past the chosen hour and minute, and `lastSentWeek` is not this week, it sends one push and stamps the week. So a run that is late or skipped still sends later the same local day, a missed day is not sent on Monday, and nothing is sent twice in a week (including the hour that repeats when the clocks go back). A 404 or 410 from the push service deletes that phone's blob; any other error is logged and the phone is left for the next run that day. A re-subscribe keeps the week stamp.

## Sending a test

From the phone: "Send one now" in Settings (package N3) posts its own endpoint to `/api/push/test`.

By hand, with an endpoint you already subscribed:

```
curl -s -X POST https://flowstate-journal.netlify.app/api/push/test \
  -H 'content-type: application/json' \
  -d '{"endpoint":"https://web.push.apple.com/…"}'
```

Locally, `netlify dev` answers the routes (with the three env values exported in the shell), and `curl -X POST http://localhost:8888/.netlify/functions/checkin` runs the hourly pass once.
