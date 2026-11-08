# FlowState design standard

The look and feel of FlowState, written so it can be checked. Every rule is marked **lint** (checked by `node script/design-lint.mjs`, which must print PASS before any PR) or **review** (checked by the reviewer against the walkthrough). The live reference is `design/walkthrough.html` with `design/tokens.css`; package 0 ships that tokens file unchanged as `src/ui/tokens.css`. The notebook "Who to Be, How to Flow" is the spec behind all of it.

## 1. What the design is for

The notebook names three needs. The app answers each with a light, and everything else follows from that.

| Need, in the notebook's words | Light | When | Character |
|---|---|---|---|
| "an enormous amount of potential energy... wish to use it in all seriousness" | **Day** | sunrise to sunset | cream page, blue rules, crisp ink; the Flow tab's checks |
| "my supreme duty to listen to the quiet voices within" | **Night** | sunset to sunrise | deep page, chalk ink, a lamp in the corner, voices glowing |
| "boiling in my own soup... wait out the truly hard parts, they never last forever" | **Still** | chosen, never automatic | deepest page, soft contrast, slower, counts gone, one kept line |

Mystical means wordless and incomplete here ("wisdom is to be experienced, and it is always incomplete"), so the app makes room rather than content: the page follows the real sky, the threshold is a breath, your own lines return as the echo, and nothing is ever generated for you.

## 2. Tokens (lint)

1. Every colour, font, size, spacing and duration in the UI comes from `tokens.css` as a `var(--…)`. No colour literal (`#hex`, `rgb()`, `hsl()`, `oklch()` with numbers), no `font-family`, no `transition`/`animation` duration literal anywhere else.
2. Three lights, one attribute: `data-light="day|night|still"` on `<html>`. A component never checks the light in code to pick a colour; it uses the token and the token changes.
3. Voices are hues, not swatches. A voice stores a hue angle; its colour is `oklch(var(--voice-l) var(--voice-c) <hue>)`, so lightness and chroma come from the light. Deep twins: lightness −17%, chroma × .6.
4. Fonts are the phone's own: `ui-serif` for ink (New York on iPhone), `ui-sans-serif` for printed stationery labels. Nothing is downloaded; no `@import`, no `<link href="http…">`, no `url(http…)`.

## 3. The page (review)

5. Every writing surface is a page: the notebook header ("No." and "DATE: 11 / 7 / 26" in grey sans, top right), rules the text sits on (line height equals rule spacing), ink in serif. Day 17 on 28; Still 18 on 33. A row that can wrap (a check, a question, a look-back line) ends on a blank rule however many lines its text took, so one line is text plus a blank rule and three lines is text plus a blank rule; dense indexes (Pages, councils) stay one line each, cut with an ellipsis.
6. One primary act per screen, and it is the first thing under the thumb. Journal opens on a blank dated page with the caret ready. No save buttons; everything autosaves.
7. Tabs are four words (Journal, Council, Be, Flow) and, third, the **?** mark for Questions (V2): a glyph in the serif a size up, like the header's ♪, not a fifth word. No icons anywhere except the moon, the ring, the drawn arrow and the drawn check. No icon libraries (lint).
8. Sheets rise; nothing is a modal dialog (`<dialog>`, `role="dialog"`, `alert`, `confirm`, `prompt` are banned, lint). Back is a swipe. Long press means pick up, keep close or reply.
9. A voice has a role (Architect, King) and may have a name Tommy gives it (V10); the name is what shows where it speaks, and a tap on the name above a line shows the role beside it. Messages spoken by a voice carry a 3px left rule in the voice colour and a 10% wash (0% in Still); deep twins carry a doubled rule. Chips: starred voices first, "+ voice" last.
10. Revisions are shown struck through with a drawn stroke, never hidden; corner tags are a line across the corner with the value written along it; arrows between items are drawn paths.
11. The spread is two facing pages: pole A's goals on the left, pole B's on the right, each at the height of its lean. A goal is normally added with the goal that balances it on the other pole; the pair is linked across the seam by a dotted path, and a missing balance is a dashed slot at the same height that stays until filled. Nothing is ever laid out while hidden: measure after display, and relayout on resize. The Be tab is a list first (V8): a row per paradox, its two poles facing across a short seam, and a tap opens that paradox's spread under its row.

## 4. The lights (review)

12. The light follows the sky: sunrise and sunset computed offline from a stored place (one-time in Settings; fallback 07:00 to 19:00); sunrise and sunset change the light in one `--t-light` breath, everything together (V5). Settings can pin Day or Night. The moon glows after sunset but never switches Still on by itself.
13. Still is a tap on the moon, from anywhere (V6: pulling the page down shows earlier pages instead, and does nothing in Still). In Still: no counts, states, page numbers, look-back or page list (today only); deep twins leave the chip row; a breathing ring (4s in, 6s out) replaces the moon and is the exit; one kept line sits at the top; after twelve minutes of typing the ring asks once, "Enough for now?". Leaving Still (ring, or the next sunrise) changes no data.
14. Still lowers luminance, not warmth: page #0F1016, ink #A19B8E (about 6.5:1), chroma × .4, cool-neutral. (Illuminance moves arousal; colour temperature barely does.)
15. Nothing counts a streak. No badges, confetti, counts on tabs (lint on the words in `src/ui`).

## 5. Your own words (review)

16. Kept lines: long press a message, "Keep close". The echo above a new page is a kept line, oldest unseen first ("Same answer as last"); tap to link, swipe away. Still shows kept lines only; the seed is the manifesto. The app never writes a line for you.
17. Turn to answer: one tap makes an entry a question and opens the answer frame beneath, set in italic as the wiser second person. (Distanced self-talk lowers rumination over time; the notebook already answers "stand tall, young one".)

## 6. Motion, touch, sound (lint where marked)

18. Durations: `--t-ui` 180ms, `--t-page` 400ms, `--t-light` 1200ms, `--t-breath` 10s. Easing `--ease`, never a bounce or spring. Any file with `animation:` contains a `prefers-reduced-motion` rule (lint); all durations drop to zero there.
19. Haptics only through `parts/Haptic` (the hidden `<input type="checkbox" switch>` trick; `navigator.vibrate` is banned, lint). Ticks on: unlock, tab change, a check, an item dropped, a lean detent, the dot's detent at a flow's step (`parts/Cycle`, F1), entering Still, keep close, a sheet opening. Nowhere else. Silent mode may mute them; the app degrades to nothing.
20. Tactility without haptics: goals slide up and down their page under the finger, the lean slider clicks into three detents, the rail of earlier pages follows the drag, long press lifts an item 2px. Drag feedback is immediate (no transition while dragging).
21. Sound only through `parts/Sound` (Web Audio synthesis, no files; `new AudioContext` elsewhere is banned, lint): a bell on unlock, a long low tone on settling, a soft bell on keep close, the lean's two ends, a short bell on choosing an album. Never uninvited; a Settings switch; follows the ring switch.

## 7. Network (lint)

22. The app makes no network request after the first load. `fetch(` is allowed only under `src/music/` (the Spotify tie-in, opt-in, PKCE, no server). Covers are cached as blobs so the album grid works offline.

## 8. Process (review)

23. Every package PR carries its walkthrough step(s) in `design/walkthrough.html`, built from the real components and `tokens.css`, passing `node ~/.claude/hooks/artifact-lint.mjs`.
24. A new screen is reviewed in all three lights before merge (the walkthrough's relight control exists for this).
25. New tokens go into `tokens.css` with a comment naming the screen that needed them; a new colour needs a reason the existing ones do not cover.

## 9. Research behind the choices

- Calm technology (Amber Case): the smallest possible attention, use the periphery, work when it fails → the sky in the periphery, no notifications, offline always. [Calm principles as cited](https://arxiv.org/pdf/2306.05741), [Designing calm](https://www.uxmatters.com/mt/archives/2025/05/designing-calm-ux-principles-for-reducing-users-anxiety.php).
- Slow technology (Hallnäs and Redström; Odom et al. 2022: temporal interconnectedness, temporal drift, explicit slowness) → the page lit by the real sun, the breath, 400ms page turns. [Slow technology](https://dl.acm.org/doi/10.1007/PL00000019), [office installation study](https://arxiv.org/pdf/2405.11772).
- Self-distancing (Kross and Ayduk): reflecting from a distanced perspective and non-first-person self-talk lowers rumination over time → Turn to answer, the wiser second person. [Chapter](https://sites.lsa.umich.edu/emotion-selfcontrol-psych/wp-content/uploads/sites/1322/2017/09/Self-distancing-theory-research-future.pdf), [Kross 2011](https://rascl.studentorg.berkeley.edu/assets/files/kross_ayduk_2011_cd.pdf).
- Lighting and arousal: higher illuminance raises self-rated arousal, colour temperature does not significantly → Still dims rather than warms. [VR lighting study](https://arxiv.org/pdf/2307.10969). Dark vs light reading: no comprehension difference, less glare in low light → Night by sky is safe. [Summary](https://android.gadgethacks.com/news/dark-mode-vs-light-mode-what-research-says-about-when-each-works-best/).
- Apple Journal reviews: restraint works, surfacing what already happened beats prompting, long prompts feel heavy under stress → no prompts, the echo, Still never asks. [AppleInsider](https://appleinsider.com/articles/26/07/17/how-to-make-apple-journal-part-of-a-mindful-daily-routine), [14-day test](https://blog.vividiary.live/reviews/ios-27-apple-journal-insights-tab-review).
- Web haptics on iPhone: `navigator.vibrate` never shipped in WebKit; the switch trick fires the Taptic Engine on a direct tap, iOS 17.4+, single tick from 26.5. [haptics library notes](https://haptics.kushagragolash.dev/), [state of web haptics 2026](https://creativealive.com/haptics-web-whats-possible-whats-fake-2026/).
- Spotify from a PWA: Web Playback SDK support on iOS Safari is contradictory in the field and stops in the background; the Web API player endpoints need Premium; development mode allows the owner plus a few users. [Grimoire issue](https://github.com/Larront/grimoire/issues/243), [community thread](https://community.spotify.com/t5/Spotify-for-Developers/Web-Playback-SDK-should-work-on-iOS-13-4-but-it-does-not/td-p/5232605).
