# FlowState: the mountain (the Flow tab as seven chakras on one stream)

Planned 2026-11-11 at Tommy's ask, in six passes the same day. **Pass 6 overrides pass 5 where they disagree, and pass 5 overrides anything older.** The build brief for the agent who builds it is `BUILD-MOUNTAIN.md`. The build began the same evening on this branch (package PRs target `mountain-plan`). R0 to R3 and R5 are built on `mountain-plan` (not on `main`, not deployed); R4 waits for the walk. The walkthrough is `design/mountain/index.html`, the real app (R5); the proposal mock it replaced is in git history.

His words, in order:

1. "rather than being in a list, i want the top seven flows to be chakras along a stream... a mountain with particles (a stream) running down it, along seven stops which are tappable... a depression meter for the overall mountain which controls how strong the flow of particles is, and then at each chakra i can control what % blockage there is, and see the particles flowing faster or slower based on that, to represent the way that energy gets lost when i'm depressed/anxious/etc. keep the steps and visualizations for each of the named flows, but instead of having an overview and a bunch of copy (which wasn't helpful), just show the diagram and any steps to take which might help unblock the chakra (including the shows/books/games/art)."
2. "it should match the seven hindu chakras, and instead of having the names of the flows, those diagrams should just be used to show how things get blocked. if there is a better way to demonstrate the chakra, do that instead. do research first then fold it into the plan."
3. "make it go to an ocean, with a meditate circle in there, and make it more mountainy/nature inspired. i want it to be really creative and cool."
4. "put energize also at the end, as part of the ocean - there may be more circles like that, inspired flows for when everything is flowing well."

5. Pass 5, four notes on the mock: "rather than using the hindu names, use the character + part of body/soul (heart chakra for instance)"; of the sun on its arc, "what is this doing here"; "getting closer, but draw the mountain in a more dramatic and visceral way"; "also make the stream a bit less symmetrical, think about what the chakras represent and fit them accordingly. i don't want it to be explicitly based on the hindu chakras, but i do want them to have cute symbols".

**Pass 5, decided.**

- **Not explicitly Hindu.** The app borrows nothing visible from the tradition: no Sanskrit names, no lotuses, no petal counts, no element shapes, no seed letters, no "Meru". Section 2 stays as background reading only. What remains is the common idea of seven places down the body, each named by its part of the body or soul: Crown, Third eye, Throat, Heart, Solar plexus, Sacral, Root; "Heart chakra" in its page's header, "Heart" beside its sign on the mountain.
- **Cute signs.** Each stop is one small drawn sign in its hue: a crown, an eye, a speech bubble, a heart, a sun, a drop, a sprout. Open, it is full of its colour; as its gate closes it empties to an outline and draws in a little. This replaces the lotus and its folding petals everywhere below (read "sign" for "lotus", `parts/Sign` for `parts/Lotus`). Under the sign on its page the print line says what it is for, not an element: "Root · feeling safe", "Heart · love and grief".
- **An uneven stream, placed by meaning.** No regular zigzag. The crown sits just under the summit in the snow the water starts as (letting go); the third eye on a ledge out on the lit side, where you can see a long way; the throat tight against the arete at the narrows, where the water is loudest (speech); the heart at the end of the long swing out to a tarn in the mountain's middle, where water rests; the solar plexus across on the far flank, a fire kept on the side in shadow (will); the sacral a short drop to a pool low on the lit side (feeling); the root at the foot, in the trees, where the mountain meets the ground (safety). The coordinates are `STOPS` in `design/mountain/mountain.js`.
- **The mountain in ink, dramatic.** A horn, not a hill: a spire steepening to the summit, crags broken out of both flanks, an arete falling from the peak that splits a lit face from a face in shadow (ink at a low tone under close hatching), gullies cut down the lit side, two lesser horns shouldering in behind, spindrift torn off the top, a black treeline two ranks deep over sea cliffs. The rock's line is `--ink` and heavy, heaviest on the shadow side. `land()` in the mock is the reference drawing.
- **No sun.** See section 3.

6. Pass 6, with the word to build it: "i really want this to feel dark/mystical and i want the animation to be sort of captivating, so get creative with the drawing and how everything comes together".

**Pass 6, decided (mine to defend, his to overturn; every PR lists what it assumed).**

- **The mountain is a night plate, in every light.** The drawing is no longer pen on the cream page. It is its own dark plate, like an aquatint pasted into the notebook: a deep sky, the rock in chalk line, the shadow face the darkest thing on the screen. By Day the plate sits dark on the cream page with the ruled rows under it; by Night it runs into the page; in Still it is the deepest and the quietest. New tokens carry it (`--plate`, `--plate-deep`, `--plate-line`, `--plate-print`, `--glow`), set per light in `tokens.css`, so no component checks the light (rule 2). Where older sections say `--ink` and `--print` for the land, read the plate's tokens.
- **The water is the light.** Nothing shines on this mountain but what runs down it: no sun, no moon in the drawing. Motes are points of light with a short trail (fast water a streak, slow a bead). The rock near the stream is lit by it, and the lit face is lit only as far as the water is running. A sign is a lantern: open, it glows in its hue and throws a little of it on the rock and into the water below it, which carries that tint a short way before it pales again; closed, it goes to a cold outline and the mountain under it goes darker. So a heavy day is literally a dark mountain with a bright cap of held snow, and a good day is lit from summit to sea. This amends section 4's "the water is ink" (rule 30 gets the amendment in R5). In Still the water and signs are the plate's line colour only.
- **Places with weather of their own.** Spindrift off the summit, a fall with spray at the narrows by the Throat, the tarn at the Heart holding a still reflection, an ember glow on the shadow flank at the Solar plexus, a pool with slow rings at the Sacral, fireflies of the stream's own light in the firs at the Root, phosphorescence where the river fans into the sea. Each is the stream's light doing something at that place; none is decoration that stands for nothing. Stars are few and faint and the cloud swallows them as the meter rises.
- **How it comes together (the arrival).** Opening Flow, once per unlock: the plate is dark; a few stars prick in; the horn draws itself from the summit down both flanks in the order a pen would (rule 27), the hatching falling in behind; the snow settles; then the first water is let go from the snow as one bright head and runs the whole course, and each sign kindles as the head reaches it, a ring going out in its hue; it reaches the sea, the sea takes its first breath, and the circles surface. About four seconds, then the steady water. Every tap works throughout and cuts it short (rule 31: it starts from his touch, runs once, ends in the steady state). Coming back to Flow later in the same unlock it is already there, and a sign he opened travels home (rule 28). Reduce Motion: drawn at once, no head.
- **Touch is answered in light.** Closing a gate: the lantern cools, the pool above it brightens and swells as the water backs up, what is turned back sinks into the rock as embers, and the dark moves down the mountain stop by stop. Opening it: the pooled water goes in one visible surge and rekindles each sign below in turn. The meter: flakes fall while it rises, the cloud bank comes down over the stars and the summit, the cap grows bright and the rest dims; lifting it, the melt runs as a surge. All eased, nothing flashes, the fastest water slower than a finger (rule 30).
- **A stop's page opens on its place.** The top of a chakra's page is a piece of the same plate: a close view of that stop's place on the mountain (the snow, the ledge, the narrows, the tarn, the shadow flank, the pool, the firs) with the stream running through the large sign, which is drawn in pen order and then fills with its light. The sign on the mountain travels into it (rule 28). Under the plate the page is paper as before: the gate, the drawings, the rows.
- **How it is drawn.** The land is SVG drawn once; the water, glow, snow and embers are one canvas over it (additive light is cheap there; no animated SVG blur). Every colour the canvas uses is read from the tokens at start and on a light change. One `requestAnimationFrame` loop, only on screen and visible; budget 60 fps on an iPhone with about 200 motes.
- **Still** keeps rule 13: no meter, no gates, no hues, no snow line, no numbers, no arrival beyond a slow fade; the plate, the land's line, open signs, names, slow water.

## 1. What changes, in one screen each

| Screen | Today | After |
|---|---|---|
| Flow tab (`ui/flow/Flow.tsx`) | A list: Right now, Meditate, nine flows, + flow | The mountain, drawn in pen and ink: snow, one uneven stream, seven signs, the sea, where Meditate and Energize float as circles |
| A flow's page (`ui/flow/FlowPage.tsx`) | One page per named flow, with paragraphs | One page per chakra: its sign, its gate, the drawings of how it gets blocked (the flows, unnamed), and rows to do |
| On sheet (`ui/flow/On.tsx`) | Albums, shows, films, games | The same, plus books and art |

Kept as they are: the nine drawings and their water (`parts/Cycle`, `parts/Stream`), the dot and episodes, hold the ring, the clock, ghost rings and stamps, hand-offs, the door, Right now, Meditate's page, Energize's page.

## 2. What the research found (background only since pass 5: nothing here is shown in the app)

Sources are at the end. Where they disagree I say so.

**The seven.** The best-known set is six centres plus the thousand-petalled one above them, from Purnananda's *Sat-Cakra-Nirupana* (1577), brought west in Woodroffe's *The Serpent Power* (1919). Older texts count four, five, or many more; this seven is one tradition, not the only one.

| Summit to foot | Name in the app | Where | Petals | Element | Shape inside | Seed character | In the texts |
|---|---|---|---|---|---|---|---|
| 1 | Crown chakra | crown | a thousand | beyond the elements | none | none | Sahasrara |
| 2 | Third eye chakra | between the brows | 2 | mind | none | ॐ (om) | Ajna |
| 3 | Throat chakra | throat | 16 | space | circle | हं (ham) | Vishuddha |
| 4 | Heart chakra | heart | 12 | air | two triangles crossed | यं (yam) | Anahata |
| 5 | Solar plexus chakra | navel | 10 | fire | triangle, point down | रं (ram) | Manipura |
| 6 | Sacral chakra | below the navel | 6 | water | crescent | वं (vam) | Svadhisthana |
| 7 | Root chakra | base of the spine | 4 | earth | square | लं (lam) | Muladhara |

**Names.** The app never prints a Sanskrit name or a seed letter (pass 5). The first column is the only name the app uses; the rest of the table is for this document only.

**What is old and what is new.** The petals, elements, shapes and seed syllables are from the texts. The rainbow colours are not: Leadbeater's *The Chakras* (1927) and the colour healers of the 1930s added them, and the texts' own colours differ by source (vermilion, rain-cloud, smoky purple). The list of feelings each chakra governs is newer still: it came out of Esalen and first met the rainbow in print in 1977, and Anodea Judith's books carried it from the 1980s. So "fear blocks the root" is a modern Western reading laid over a Hindu map. It is the reading his ask needs, and the plan uses it, but as a pairing he can change, not as scripture.

**Blocked, in the tradition.** The texts do have blockage: three knots (granthi) on the central channel that stop what rises, most often placed at the root, the heart and the third eye, though sources move them. The tradition's aim is to pierce the centres, not balance them. A percent per chakra is the modern picture; the plan keeps it because he asked for it.

**Why a mountain is right.** The spine is called *merudanda*, Meru's staff: the body's axis is the world's mountain. The crown belongs at the summit.

**Why water running down is right.** The famous current rises (kundalini, root to crown). But hatha yoga also has one that falls: nectar dripping from the head and used up lower in the body (the *Hatha Yoga Pradipika*'s verses before its inverted pose; verse numbers vary by edition, and I did not read the verse itself). His stream is that one.

**Why the sea is right.** "As the flowing rivers disappear in the sea, losing their name and their form" is the Mundaka Upanishad (3.2.8). Meditate's circle goes there.

**A better way to show a chakra (pass 2; replaced in pass 5 by the signs).** The tradition already draws each one: a lotus with its own number of petals, its element's shape inside, its seed syllable at the centre. A lotus opens and closes, so blockage needs no invented symbol: the petals fold to a bud. That replaces the ring-and-gate of the first pass, and it is the "better way" of pass 2. The flow drawings stay for what they are good at: the course of one way of getting blocked over time.

## 3. The picture

Drawn in pen and ink on the ruled page, in `--print` and `--ink`: the peak's mass is the page's own colour so nothing behind shows through, its shadow face is ink at a low tone, and the signs are filled with their hue.

- **The peak**, as pass 5 has it: a horn with crags, an arete, a lit face cut by gullies and a face in shadow under hatching, two lesser horns and far ranges behind, spindrift off the summit, a ledge, falls and a tarn where the stream's stops sit, a black treeline, scree at the river mouth, sea cliffs. By night, stars.
- **The snow.** The Depression meter is the weather on the peak: as it rises the snowline comes down, flakes fill the cap and cloud gathers. The water is still on the mountain, held; that is the truth the picture tells about a heavy day, and it melts back as the meter lifts.
- **The stream** leaves the snow and runs an uneven course down through the seven signs, crown to root, each where pass 5 puts it.
- **The signs.** A crown, an eye, a speech bubble, a heart, a sun, a drop, a sprout, each in its hue by the voice formula (rule 3), on a small disc of the page's colour so it reads over the hatching. The hue is the rainbow because it is the one he will know at a glance (question 2). The name beside each is its part of the body or soul ("Heart"); "Root · feeling safe" is printed on its page.
- **The sea.** Below the shore the river fans out and slows. Rows of wave strokes sway on the breath, four in and six out, the same breath as the ring and Meditate's Ocean sound.
- **The circles.** The sea holds what he does when everything is flowing well. Each is a circle afloat, riding the swell: **Meditate** empty, as its page draws it; **Energize** with its arc inside. A tap opens that page, unchanged, and the circle travels into it (rule 28). The more water reaches the sea, the more the circles stand out and the faster their rings go out; with a trickle they sit faint and slow. They are never locked: a faint circle still opens.
- **More circles.** The sea spaces up to five. A new one is a name and a page of its own (question 9 asks which come next); nothing about the mountain changes to add one.
- **No sun.** A sun on an arc stood over the far range in the first drawings; it read as one more diagram and meant nothing, so it is gone (Tommy, 2026-11-11: "what is this doing here"). The page's own light is the sky (rule 12); at night the stars come out.
- **Under the sea**, on the rules: Right now and + flow.
- **The door** (the ring without the PIN) keeps its own list: the mountain shows what he set, so it stays behind the PIN.

## 4. The water

One model, pure and tested (`model/mountain.ts`), drawn by the engine the flows already use.

- **The meter** `d` from 0 to 1: the spring gives `s = 1 - 0.8 d`.
- **A gate** `b` from 0 to 1 at each sign lets through `p = 1 - 0.85 b`. Neither reaches zero: something always gets through.
- **Below sign i** runs `q(i) = s × p(1) × ... × p(i)`. A sign closed high on the mountain starves every one below it.
- **In each stretch:** the share of motes showing is `0.15 + 0.85 q`, their pace `0.3 + 1.2 q` (fast water is a dash, slow a dot), and the channel line under them is `1 + 2.5 q` px wide, so the picture still says it with Reduce Motion on.
- **Above a part-closed sign** the water pools: over the last 26 units it slows by up to `0.75 b` and spreads. What a gate turns back fades into the ground there. Every change is eased; nothing flashes.
- **An open episode** on any drawing puts the dot on its chakra's sign, with the halo.
- **Still** (rule 13, no states): no meter, no gates, no hues, no snow line, no numbers; open signs in print grey, their names, the sea, and water in ink at `--stream` .4.
- One `requestAnimationFrame` loop, only while on screen and visible, about 150 moving lines; the land is drawn once and never redrawn.

## 5. The controls

- **Depression**: one drawn rule above the sky, the mark dragged like the lean slider. The snow and the water answer under the finger (rule 20); the reading is written on release.
- **A gate**: the short rule under a sign's name; drag its mark sideways toward the stream and the sign empties. Horizontal, so the page still scrolls. The percent prints in grey at the rule's end while above zero, in Day and Night only.
- **A tap** on a sign or its name opens its page; the sign travels to the page's sign (rule 28).
- **The same gate** is on the chakra's page under its sign.
- Nothing moves a gate but his finger (question 4). A reading older than a day is drawn dashed until touched (question 5).
- Ticks (rule 19, amended): the mark landing on closed and on open. No sound.

## 6. A chakra's page

Top to bottom: the sign, large, emptying with its gate; one print line ("Root · feeling safe"); the gate; then **how it gets blocked**: the drawings that belong to it, each with its water, dot and step words, no flow name anywhere; then the rows; the print safety lines; Edit.

**Which drawing sits under which chakra.** This is the modern pairing from section 2 and is mine to defend, his to change (question 1). The eight flows that are ways of getting stuck each land under a sign; Energize, the ninth, is not a blockage and floats in the sea:

| Chakra | Its modern reading | The drawing (the old flow) |
|---|---|---|
| Crown | letting go, sleep and waking | the clock (3 a.m.) |
| Third eye | seeing clearly, against the story | the coil (Replay) |
| Throat | speech | the mountain with a fork (Fight) |
| Heart | grief | the valley (Depress) |
| Solar plexus | will and worth, against shame | the fork (Shame) |
| Sacral | feeling, against going numb | the stairs (Shutdown) |
| Root | safety, against fear | the ring (Panic) and the curve (What if) |

A flow he makes himself asks which sign it belongs under.

**Rows.** With the dot on a step, or a step word tapped: that step's rows, as now. At rest: one list of up to six, what he ticked in past episodes first, then the On row gathering every pick under this chakra, then seed order.

**Leaves the page (kept in the data):** flow names, the flow's line and rest line, each step's said paragraph, "Usually", the words under the clock, wise lines, "Last time", "What helped" as a sentence, the note to the next one (question 3). The step sheet keeps its rows and loses its said and usual fields.

**Stays because it is safety:** the 988 line, the doctor lines, the hand-offs (a hand-off now names a chakra). 3 a.m.'s rest line moves to a print line on its first step.

**Right now** still reads his own step lines.

## 7. Books and art

`PickKind` gains `book` and `art`, written lines with their kind word. The On sheet keeps its rule (at most three covers and three lines; Still keeps covers only). No titles are seeded by me: every pick is his (rule 16), written in the step sheet's pick editor (question 6).

## 8. Data

- New table `readings`: `{ id, at, of, value }`, `of` being `'mountain'` or a chakra id, `value` 0 to 1, written on release, never edited. The newest per `of` is drawn; the history is kept for a later drawing.
- `circles`: the sea's circles in order, each a name and a route. Seeded with Meditate and Energize; kept in `settings` until there is a third.
- `flows.chakra`: which sign a flow's drawing sits under, seeded from section 6, editable. Flow rows, ids, steps, episodes and routes are otherwise untouched, so nothing on his phone is rewritten. Routes: `#/flow/c/:chakra`; `#/flow/:id` still opens a drawing on its chakra's page, so the door, Right now and hand-offs keep working.
- **Schema bump.** The values (PLAN-VALUES.md, PR #59) reached main first as schema 6; the mountain is schema 7 on top of it (`MOUNTAIN_VERSION`). Never deploy a dist built from an older tree.
- `PickKind` widens in place. Backup and merge import carry `readings` like `sits`.

## 9. DESIGN.md

- (R5: written as DESIGN.md rule 34, after the walk's 33, with pass 6's night plate in place of the ink below.) New rule, **the mountain**: the Flow tab is one drawing in pen and ink; the land is drawn once, the rock in `--ink`, its shadow face ink at a low tone; seven signs hued by the voice formula; the water ink; what the meter and gates do; Still shows names, open signs in print grey and ink.
- Rule 7: the seven signs join the moon, the ring, the arrow and the check as drawn marks; they are drawn paths in the app's own code, never an icon library or an emoji.
- Rule 15: a gate's percent is a state he sets, not a count; it leaves in Still. Rule 19: the gate's two end ticks. Rule 30: the mountain's water. Rule 31: the sea joins the things that breathe.
- `tokens.css`: `--h-indigo` (the third eye). (R0 dropped it: the hues live in `CHAKRAS`.)

## 10. Packages

| | Package | Holds | After |
|---|---|---|---|
| R0 | Data, maths and the signs | `readings`, `flows.chakra`, schema bump, `model/mountain.ts` with tests, `PickKind` book and art, `parts/Sign` (so R1 and R3 can run side by side), the plate tokens | |
| R1 | The mountain | the night plate, the arrival, `cycle/river.ts`, the land, the sea and its breath, the circles, `ui/flow/Mountain.tsx` in place of the list, taps with travel, Still, night | R0 |
| R2 | The weather and the gates | the meter with snow and cloud, the gates and emptying signs, writes on release, dashed when stale, ticks, Reduce Motion | R1 |
| R3 | The chakra page | section 6: the large sign, drawings grouped under it, names and copy gone, the rest list, routes, hand-offs, the step sheet | R0, beside R1 |
| R4 | Books and art | the On sheet's two kinds, the pick editor | R0 |
| R5 | Walkthrough and standard | `design/mountain` rebuilt from the real app, DESIGN.md, the old flows walkthroughs marked as history | all |

Each PR: `npm test`, `PORT=42xx npm run e2e`, both lints, three-light screenshots, review against this file and DESIGN.md.

Status, 2026-11-11: R0 #62, R1 #64, R2 #65 and R3 #63 merged into `mountain-plan`; R5 is its own PR; R4 not built.

## 11. Open questions

Built to the defaults. The choices the builders made, for Tommy to overturn, are listed in `BUILD-MOUNTAIN.md` section 7. Still open with no default: which books and art go under which sign (R4, none seeded), and which circles join Meditate and Energize in the sea.

## 12. Only the iPhone can say

See `BUILD-MOUNTAIN.md` section 8; none of it has been checked on a phone.

## 13. Sources

- [Chakra (Wikipedia)](https://en.wikipedia.org/wiki/Chakra): the seven, petals, elements, shapes, seeds; "the colours are modern"; the 1577 text and Woodroffe; the lowest of three obstructions.
- [Shat-cakra-nirupana, Avalon's translation (wisdomlib)](https://www.wisdomlib.org/hinduism/book/shat-cakra-nirupana-english/d/doc1144829.html): the verses; the texts' own colours.
- [The Rainbow Body: how the Western chakra system came to be (Kurt Leland, Quest)](https://www.theosophical.org/publications/quest-magazine/the-rainbow-body-how-the-western-chakra-system-came-to-be): Leadbeater 1927, the colour healers, Esalen, Dychtwald 1977, Judith; pierced, not balanced.
- [The granthis (Hridaya Yoga)](https://hridaya-yoga.com/the-granthis-the-3-psychic-knots/) and [Kundalini and chakras (eSamskriti)](https://esamskriti.com/e/Spirituality/Tantra/Kundalini-And-Chakras-1.aspx): the three knots and where sources put them. Teaching sites, not the texts.
- [Merudanda in hatha yoga (Hindu Blog)](https://www.hindu-blog.com/2022/08/merudanda-in-hatha-yoga.html): the spine as Meru's staff. A secondary source.
- [Bindu (Wikipedia)](https://en.wikipedia.org/wiki/Bindu_(symbol)), [Viparita Karani (Wikipedia)](https://en.wikipedia.org/wiki/Viparita_Karani) and [Hatha Yoga Pradipika, Muktibodhananda](https://terebess.hu/english/Hatha-Yoga-Pradipika-Muktibodhananda.pdf): the fluid held in the head and lost downward; "the nectar is consumed" before the inverted pose.
- [Mundaka Upanishad 3.2 (Krishnananda)](https://www.swami-krishnananda.org/mundak/mun_3-2.html) and [Müller's translation](https://www.universalfreemasonry.org/en/library/the-upanishads-part-II/mundaka-upanishad-III-2): the rivers and the sea.
- Anodea Judith, *Eastern Body, Western Mind* (rev. 2004): the per-chakra "demons" (fear, guilt, shame, grief). I confirmed the first four from summaries of the book, not the book itself.
