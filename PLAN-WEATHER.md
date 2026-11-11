# FlowState: the weather means something

Date: 2026-11-11. Status: planned, nothing built. Walkthrough: https://claude.ai/artifact/4cFKUKqAnwB1efG2zkKHWT (nine steps, the real mountain with the proposed weather drawn over it).

`PLAN-MOUNTAIN.md` stays the plan for the mountain itself. This file gives its atmosphere (the mist, the sky, the stars, the sea, the snow) something to stand for.

His words:

1. "look over all the creative things that are being drawn for flows in flowstate and consider how to make them mean something in the larger scheme"
2. "i'm talking about the mist, the ocean, etc..all the new drawing stuff and how it could match my mood based on what i'm listening to or maybe just based on the recent journals/council sessions, or maybe based on how the depression meter sits..idk, something like that"
3. Shown the nine steps and asked whether to plan them: "yes".

## 1. The idea: two layers

He named three sources. The plan uses all three, each on its own part of the drawing, so he can always tell what is speaking.

| Layer | Source | Drawn as | Who moves it |
|---|---|---|---|
| Stated | the Depression meter, the gates | snow, summit cloud, how much water runs, the lanterns | his finger only (as built) |
| Observed | council and journal voices, what is playing, sits, the meter's own history | valley mist, bands in the sky, stars, the sea, old snow | nothing he sets; it follows what happened |

The observed layer never moves the meter or a gate, never prints a word, never asks anything. It stands beside what he set, and the two may disagree: bright water under heavy mist is a clear day set over a harder one lived.

## 2. What each thing stands for

| Drawn thing | Reads | Meaning | Cap and decay |
|---|---|---|---|
| Old snow | `readings` history for `mountain` | days in a row the meter sat above the middle: blue ice below the snowline | six days at most; a lower reading than yesterday's lets it go as one surge on arrival |
| Valley mist | `messages` of the last three days whose voice has `shade: 'deep'` | the shadow voices have been speaking | share of lines, weighted toward today; thins each day none speak |
| Sky bands | `messages.voiceId`, last three days, council and journal | who has been speaking, each in his own hue, widest spoke most | three bands at most; Skeptic has no hue and draws none |
| Stars | kept lines (`messages.kept`) | his own words kept close; a tap shows one in the hand for a breath | newest forty, each placed by a seed from its id so it stays where it is |
| Sea colour | `/me/player/currently-playing` and the cover's cached bytes | what is playing: the cover's two main colours as the sea's phosphorescence | eased in over `--t-light`; silence, offline or signed out leaves the sea its own light |
| A bead on a lantern | the picks under each sign | the playing album is one he chose for that place | while it plays |
| A flat sea | `model/sits.ts lastSit()` | he sat since the last sunrise | until the next sunrise; one slow ring round Meditate |
| The day's plate | the day's last readings and its mist, bands and sea colour | a thumbnail of that day's mountain by the date on its journal page and in the Earlier rail | saved once when the day closes; absent on a day with no reading |

## 3. What it must never do

- **Read what he wrote.** Only who spoke (a voice id, its shade), when, and whether a line was kept. No model, no network outside `src/music/` (rules 6, 16, 22).
- **Count.** Every drawing here is capped and prints no number (rule 15, as the ghost rings).
- **Ask or nudge.** Nothing loops for attention, nothing is offered (rule 31).
- **Show in Still.** All of it leaves: the line, open signs, slow water (rule 13).
- **Give hue a second meaning.** On the plate a hue in the sky is a voice (rule 3); the signs keep theirs as lanterns.

## 4. Music: what is honest

As far as I know Spotify no longer gives new apps a track's mood or tempo numbers (the audio features endpoint); this was not re-checked against Spotify's docs, and W3 starts by checking it. The plan does not depend on it: the signal is the cover's colour and his own picks, both already on the phone.

## 5. Data

- `days`: one row per local day, `{ day, d, gates, mist, bands, sea }`, written when the day closes (the first unlock of the next day) from that day's readings and messages. A schema bump (main is 7).
- Nothing else is stored: mist, bands, stars, old snow and the flat sea are derived on opening Flow.
- `model/weather.ts`, pure and tested: `mistOf(messages, voices, now)`, `bandsOf(...)`, `oldSnow(readings, now)`, `starsOf(keptIds)`, `seaOf(cover)`, `calm(lastSit, sunrise)`.

## 6. Packages

| | Package | Holds | After |
|---|---|---|---|
| W0 | The model | `model/weather.ts` with tests; the `days` table and its bump; no drawing | |
| W1 | Mist and sky | the valley band in `mountain/weather.ts drawAir`, apart from the meter's summit cloud; the bands by the voice formula at `--plate-voice-l` | W0 |
| W2 | Stars and old snow | one star per kept line and the tap that shows it; the ice under the snowline and the melt on arrival | W0 |
| W3 | The sea | two colours from the cached cover (a small canvas, once per album), the bead on a pick's lantern, the flat sea after a sit | W0 |
| W4 | The day's plate | a fixed SVG thumbnail on `journal/PageView.tsx` and the Earlier rail; a tap opens Flow | W1 to W3 |
| W5 | Walkthrough and standard | `design/weather` from the real app, the DESIGN.md rule, the artifact republished | all |

Each PR: `npm test`, `PORT=42xx npm run e2e`, both lints, three-light screenshots, review against this file and DESIGN.md.

## 7. Open questions

1. **The window.** Three days for mist and bands (my default), or today only?
2. **Mist from the twins.** Is "a deep twin spoke" the right reading of a hard stretch, or should late-night pages (written between midnight and five) add to it?
3. **Stars.** All kept lines (capped at forty), or only those from councils?
4. **The day's plate.** On every page of the day, or only the first?
5. **The disagreement.** Shown silently (default), or does a tap on the mist say where it came from ("Phantom, 11 / 9")?

## 8. Only the iPhone can say

Whether a star is a fair tap target at the plate's size; the cost of a second air layer at night; whether the sea's colour reads as the cover or as noise.
