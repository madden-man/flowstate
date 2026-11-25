# W0 spike: the phone answers section 13

Package W0 of `PLAN-WORLDS.md`. A throwaway screen at `#/spike` with five probes, each printing its result as text, and one "Copy findings" button. **This branch never merges.** Findings go into PLAN-WORLDS.md section 13 (and section 12 where they settle a default) on `worlds-plan`.

## Run it on the phone

From the linked main checkout (the only place `netlify` is linked to the site; never deploy from a worktree):

```
cd ~/dev/flowstate
git fetch origin && git switch --detach origin/worlds-w0-spike
npm ci                        # adds @netlify/blobs, which the spike function uses
git status --short            # must be empty: the main checkout is shared
netlify env:set SPIKE_TOKEN "$(openssl rand -hex 16)" --scope functions
netlify env:get SPIKE_TOKEN                            # copy this for the phone
netlify deploy --build --alias w0-spike                # a draft URL, never --prod
git switch main && npm ci     # put the main checkout back
```

`--alias w0-spike` serves it at `https://w0-spike--flowstate-journal.netlify.app`, a different origin from the real app, so the notebook on the phone is never touched. The token is set for functions in every context (a CLI draft deploy's context is not a branch deploy); production has no spike function, so it is inert there. Remove it when the findings are in: `netlify env:unset SPIKE_TOKEN`.

On the iPhone:

1. In Safari open `https://w0-spike--flowstate-journal.netlify.app/#/spike`.
2. Share, Add to Home Screen. The branch's manifest opens the installed app on `#/spike`.
3. Open it from the Home Screen (the first findings line must say `standalone (Home Screen app): yes`).
4. Paste the token. Hold to hum for a few seconds, then for about thirty. Try `auto` and each listed format.
5. Send, Send hum, Send 4 MB, Send 5 MB.
6. Leave the app (swipe home), wait ten seconds, come back. Do it four times, once by swiping it away in the app switcher and reopening.
7. Allow motion, tilt the phone. Close the app fully, reopen, and read "on open, without asking".
8. Close and reopen once more, hum again, and read the mic line and the getUserMedia time.
9. Copy findings and paste them below.

## What each probe answers (section 13)

| Probe | Section 13 item it settles |
|---|---|
| 1. Hum | `MediaRecorder` and the mic work in the installed app; whether the mic is asked again on every open (permission state on open and after, the earlier opens, and getUserMedia time: over 700 ms means a prompt was shown); the format chosen and the bytes a second. |
| 1 and 3. Projection, Send hum, Send 4 MB, Send 5 MB | A hum's size, and that a three-minute take fits the function request limit. Netlify: 6 MB buffered request payload, a binary body is base64 encoded so about 4.5 MB of binary ([Configuration for functions, Default deployment options, footnote 2](https://docs.netlify.com/build/functions/configuration/)). 4 MB should pass and 5 MB should fail on the deploy; `netlify dev` enforces neither. |
| 2. Pitch line | That a pitch line from a phone hum is good enough to read a melody from (voiced share, the range, and the line itself; screenshot it). |
| 3. Round trip | A bearer token reaches a function and back from the installed app: status, milliseconds, bytes received. |
| 4. Keepalive on hide | That a `keepalive` send completes when iOS hides the app: per hide, sent vs arrived, small (64 B) and near the 64 KiB keepalive budget (60000 B). The function keeps hide ids in Netlify Blobs, so "arrived" is reliable across invocations. |
| 5. Tilt | That the installed app can read tilt after the one permission tap, and whether that permission is remembered on reopen. |

## Relaxed on this branch only (W2 must replace these with the real fence)

- `script/design-lint.mjs` DL21: `src/spike/` may fetch (an `isSpike` exemption). W2 exempts `src/bridge/` instead.
- `test/ui/architecture.test.ts`, "no file outside src/music and src/research fetches": `src/spike` added to the fenced list. W2 adds `src/bridge`.
- `vite.config.ts`: manifest `start_url` is `/#/spike` (spike only, must not merge). `navigateFallbackDenylist: [/^\/\.netlify\//]` is the rule W2 keeps.
- `src/main.tsx`: `#/spike` renders the spike instead of the app, before the lock and the database.
- `tsconfig.json` includes `netlify/` so the function is type checked. W2 keeps this.
- `package.json`: `@netlify/blobs` (dev dependency, pinned 11.1.8) for the spike function only. W2's bridge uses MongoDB instead.
- `script/check-dist.mjs`: unchanged. The function is same origin, so no host was added.
- `netlify.toml`: unchanged. Locally under `netlify dev` the SPA fallback `/*` does not swallow `/.netlify/functions/spike` (401 JSON, not index.html); confirm on the deploy with the Send buttons.

## Findings (fill in from the phone)

| Item | Result |
|---|---|
| iOS version, iPhone model | |
| Standalone | |
| Formats supported | |
| Format chosen by auto | |
| Bytes a second (auto; each other format) | |
| Three minutes projected, fits 6 MB as base64? | |
| Send 4 MB / Send 5 MB status | |
| Mic asked again on reopen? (state on open, getUserMedia ms) | |
| Pitch line readable? voiced %, range | |
| Round trip ms (JSON, hum) | |
| Keepalive: hides sent / arrived, small vs near limit, swiped away | |
| Tilt: granted, live values, remembered on reopen | |
