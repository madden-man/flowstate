# FlowState: the mountain (the Flow tab as seven chakras on one stream)

Planned 2026-11-11 at Tommy's ask, in four passes the same day. Nothing here is built. The proposal walkthrough is `design/mountain/index.html` (a live mock: the meter and the gates drag, the water answers).

His words, in order:

1. "rather than being in a list, i want the top seven flows to be chakras along a stream... a mountain with particles (a stream) running down it, along seven stops which are tappable... a depression meter for the overall mountain which controls how strong the flow of particles is, and then at each chakra i can control what % blockage there is, and see the particles flowing faster or slower based on that, to represent the way that energy gets lost when i'm depressed/anxious/etc. keep the steps and visualizations for each of the named flows, but instead of having an overview and a bunch of copy (which wasn't helpful), just show the diagram and any steps to take which might help unblock the chakra (including the shows/books/games/art)."
2. "it should match the seven hindu chakras, and instead of having the names of the flows, those diagrams should just be used to show how things get blocked. if there is a better way to demonstrate the chakra, do that instead. do research first then fold it into the plan."
3. "make it go to an ocean, with a meditate circle in there, and make it more mountainy/nature inspired. i want it to be really creative and cool."
4. "put energize also at the end, as part of the ocean - there may be more circles like that, inspired flows for when everything is flowing well."

## 1. What changes, in one screen each

| Screen | Today | After |
|---|---|---|
| Flow tab (`ui/flow/Flow.tsx`) | A list: Right now, Meditate, nine flows, + flow | The mountain, drawn in pen: snow, one stream, seven lotuses, the sea, where Meditate and Energize float as circles |
| A flow's page (`ui/flow/FlowPage.tsx`) | One page per named flow, with paragraphs | One page per chakra: its lotus, its gate, the drawings of how it gets blocked (the flows, unnamed), and rows to do |
| On sheet (`ui/flow/On.tsx`) | Albums, shows, films, games | The same, plus books and art |

Kept as they are: the nine drawings and their water (`parts/Cycle`, `parts/Stream`), the dot and episodes, hold the ring, the clock, ghost rings and stamps, hand-offs, the door, Right now, Meditate's page, Energize's page.

## 2. What the research found

Sources are at the end. Where they disagree I say so.

**The seven.** The best-known set is six centres plus the thousand-petalled one above them, from Purnananda's *Sat-Cakra-Nirupana* (1577), brought west in Woodroffe's *The Serpent Power* (1919). Older texts count four, five, or many more; this seven is one tradition, not the only one.

| Summit to foot | Name | Where | Petals | Element | Shape inside | Seed |
|---|---|---|---|---|---|---|
| 1 | Sahasrara | crown | a thousand | beyond the elements | none | none |
| 2 | Ajna | between the brows | 2 | mind | none | om |
| 3 | Vishuddha | throat | 16 | space | circle | ham |
| 4 | Anahata | heart | 12 | air | two triangles crossed | yam |
| 5 | Manipura | navel | 10 | fire | triangle, point down | ram |
| 6 | Svadhisthana | below the navel | 6 | water | crescent | vam |
| 7 | Muladhara | base of the spine | 4 | earth | square | lam |

**What is old and what is new.** The petals, elements, shapes and seed syllables are from the texts. The rainbow colours are not: Leadbeater's *The Chakras* (1927) and the colour healers of the 1930s added them, and the texts' own colours differ by source (vermilion, rain-cloud, smoky purple). The list of feelings each chakra governs is newer still: it came out of Esalen and first met the rainbow in print in 1977, and Anodea Judith's books carried it from the 1980s. So "fear blocks the root" is a modern Western reading laid over a Hindu map. It is the reading his ask needs, and the plan uses it, but as a pairing he can change, not as scripture.

**Blocked, in the tradition.** The texts do have blockage: three knots (granthi) on the central channel that stop what rises, most often placed at Muladhara, Anahata and Ajna, though sources move them. The tradition's aim is to pierce the centres, not balance them. A percent per chakra is the modern picture; the plan keeps it because he asked for it.

**Why a mountain is right.** The spine is called *merudanda*, Meru's staff: the body's axis is the world's mountain. The crown belongs at the summit.

**Why water running down is right.** The famous current rises (kundalini, root to crown). But hatha yoga also has one that falls: nectar dripping from the head and used up lower in the body (the *Hatha Yoga Pradipika*'s verses before its inverted pose; verse numbers vary by edition, and I did not read the verse itself). His stream is that one.

**Why the sea is right.** "As the flowing rivers disappear in the sea, losing their name and their form" is the Mundaka Upanishad (3.2.8). Meditate's circle goes there.

**A better way to show a chakra.** The tradition already draws each one: a lotus with its own number of petals, its element's shape inside, its seed syllable at the centre. A lotus opens and closes, so blockage needs no invented symbol: the petals fold to a bud. That replaces the ring-and-gate of the first pass, and it is the "better way" of pass 2. The flow drawings stay for what they are good at: the course of one way of getting blocked over time.

## 3. The picture

Drawn in pen on the ruled page, in `--print` and `--ink`, nothing filled but the lotuses.

- **The peak**, a little jagged, with far ranges behind it, hatching down its shaded flank, a spur, firs on the lower slopes, boulders at the river mouth, two birds. By night, stars.
- **The snow.** The Depression meter is the weather on the peak: as it rises the snowline comes down, flakes fill the cap and cloud gathers. The water is still on the mountain, held; that is the truth the picture tells about a heavy day, and it melts back as the meter lifts.
- **The stream** leaves the snow and switches back down through the seven lotuses, crown to root.
- **The lotuses.** Each has its own petal count (the thousand as two rings of twenty) and its hue by the voice formula (rule 3). The hue is the modern rainbow because it is the one he will know at a glance (question 2). The name beside each is the Sanskrit one; "Root · earth" is printed on its page.
- **The sea.** Below the shore the river fans out and slows. Rows of wave strokes sway on the breath, four in and six out, the same breath as the ring and Meditate's Ocean sound.
- **The circles.** The sea holds what he does when everything is flowing well. Each is a circle afloat, riding the swell: **Meditate** empty, as its page draws it; **Energize** with its arc inside. A tap opens that page, unchanged, and the circle travels into it (rule 28). The more water reaches the sea, the more the circles stand out and the faster their rings go out; with a trickle they sit faint and slow. They are never locked: a faint circle still opens.
- **More circles.** The sea spaces up to five. A new one is a name and a page of its own (question 9 asks which come next); nothing about the mountain changes to add one.
- **The sun** on its arc over the far range is weather, nothing to tap. It sets at night, when the stars come out.
- **Under the sea**, on the rules: Right now and + flow.
- **The door** (the ring without the PIN) keeps its own list: the mountain shows what he set, so it stays behind the PIN.

## 4. The water

One model, pure and tested (`model/mountain.ts`), drawn by the engine the flows already use.

- **The meter** `d` from 0 to 1: the spring gives `s = 1 - 0.8 d`.
- **A gate** `b` from 0 to 1 at each lotus lets through `p = 1 - 0.85 b`. Neither reaches zero: something always gets through.
- **Below lotus i** runs `q(i) = s × p(1) × ... × p(i)`. A lotus closed high on the mountain starves every one below it.
- **In each stretch:** the share of motes showing is `0.15 + 0.85 q`, their pace `0.3 + 1.2 q` (fast water is a dash, slow a dot), and the channel line under them is `1 + 2.5 q` px wide, so the picture still says it with Reduce Motion on.
- **Above a part-closed lotus** the water pools: over the last 26 units it slows by up to `0.75 b` and spreads. What a gate turns back fades into the ground there. Every change is eased; nothing flashes.
- **An open episode** on any drawing puts the dot on its chakra's lotus, with the halo.
- **Still** (rule 13, no states): no meter, no gates, no hues, no snow line, no numbers; open lotuses, their names, the sea, and water in ink at `--stream` .4.
- One `requestAnimationFrame` loop, only while on screen and visible, about 150 moving lines; the land is drawn once and never redrawn.

## 5. The controls

- **Depression**: one drawn rule above the sky, the mark dragged like the lean slider. The snow and the water answer under the finger (rule 20); the reading is written on release.
- **A gate**: the short rule under a lotus's name; drag its mark sideways toward the stream and the petals fold. Horizontal, so the page still scrolls. The percent prints in grey at the rule's end while above zero, in Day and Night only.
- **A tap** on a lotus or its name opens its page; the lotus travels to the page's lotus (rule 28).
- **The same gate** is on the chakra's page under its lotus.
- Nothing moves a gate but his finger (question 4). A reading older than a day is drawn dashed until touched (question 5).
- Ticks (rule 19, amended): the mark landing on closed and on open. No sound.

## 6. A chakra's page

Top to bottom: the lotus, large, with its element's shape and seed syllable inside, folding with its gate; one print line ("Root · earth"); the gate; then **how it gets blocked**: the drawings that belong to it, each with its water, dot and step words, no flow name anywhere; then the rows; the print safety lines; Edit.

**Which drawing sits under which chakra.** This is the modern pairing from section 2 and is mine to defend, his to change (question 1). The eight flows that are ways of getting stuck each land under a lotus; Energize, the ninth, is not a blockage and floats in the sea:

| Chakra | Its modern reading | The drawing (the old flow) |
|---|---|---|
| Sahasrara | letting go, sleep and waking | the clock (3 a.m.) |
| Ajna | seeing clearly, against the story | the coil (Replay) |
| Vishuddha | speech | the mountain with a fork (Fight) |
| Anahata | grief | the valley (Depress) |
| Manipura | will and worth, against shame | the fork (Shame) |
| Svadhisthana | feeling, against going numb | the stairs (Shutdown) |
| Muladhara | safety, against fear | the ring (Panic) and the curve (What if) |

A flow he makes himself asks which lotus it belongs under.

**Rows.** With the dot on a step, or a step word tapped: that step's rows, as now. At rest: one list of up to six, what he ticked in past episodes first, then the On row gathering every pick under this chakra, then seed order.

**Leaves the page (kept in the data):** flow names, the flow's line and rest line, each step's said paragraph, "Usually", the words under the clock, wise lines, "Last time", "What helped" as a sentence, the note to the next one (question 3). The step sheet keeps its rows and loses its said and usual fields.

**Stays because it is safety:** the 988 line, the doctor lines, the hand-offs (a hand-off now names a chakra). 3 a.m.'s rest line moves to a print line on its first step.

**Right now** still reads his own step lines.

## 7. Books and art

`PickKind` gains `book` and `art`, written lines with their kind word. The On sheet keeps its rule (at most three covers and three lines; Still keeps covers only). No titles are seeded by me: every pick is his (rule 16), written in the step sheet's pick editor (question 6).

## 8. Data

- New table `readings`: `{ id, at, of, value }`, `of` being `'mountain'` or a chakra id, `value` 0 to 1, written on release, never edited. The newest per `of` is drawn; the history is kept for a later drawing.
- `circles`: the sea's circles in order, each a name and a route. Seeded with Meditate and Energize; kept in `settings` until there is a third.
- `flows.chakra`: which lotus a flow's drawing sits under, seeded from section 6, editable. Flow rows, ids, steps, episodes and routes are otherwise untouched, so nothing on his phone is rewritten. Routes: `#/flow/c/:chakra`; `#/flow/:id` still opens a drawing on its chakra's page, so the door, Right now and hand-offs keep working.
- **Schema bump.** Main is schema 5. PLAN-VALUES.md (draft PR #59) also plans a bump; whichever merges second rebases its migration. Never deploy a dist built from an older tree.
- `PickKind` widens in place. Backup and merge import carry `readings` like `sits`.

## 9. DESIGN.md

- New rule 33, **the mountain**: the Flow tab is one pen drawing; the land is `--print` strokes drawn once; seven lotuses with the texts' petal counts, hued by the voice formula; the water ink; what the meter and gates do; Still shows names, open lotuses and ink.
- Rule 7: the lotus joins the moon, the ring, the arrow and the check as a drawn mark; the sun is scenery; no icon library.
- Rule 15: a gate's percent is a state he sets, not a count; it leaves in Still. Rule 19: the gate's two end ticks. Rule 30: the mountain's water. Rule 31: the sea joins the things that breathe.
- `tokens.css`: `--h-indigo` (Ajna).

## 10. Packages

| | Package | Holds | After |
|---|---|---|---|
| R0 | Data and maths | `readings`, `flows.chakra`, schema bump, `model/mountain.ts` with tests, `PickKind` book and art | |
| R1 | The mountain | `parts/Lotus`, `cycle/river.ts`, the land, the sea and its breath, the circles, `ui/flow/Mountain.tsx` in place of the list, taps with travel, Still, night | R0 |
| R2 | The weather and the gates | the meter with snow and cloud, the gates and folding petals, writes on release, dashed when stale, ticks, Reduce Motion | R1 |
| R3 | The chakra page | section 6: the large lotus, drawings grouped under it, names and copy gone, the rest list, routes, hand-offs, the step sheet | R0, beside R1 |
| R4 | Books and art | the On sheet's two kinds, the pick editor | R0 |
| R5 | Walkthrough and standard | `design/mountain` rebuilt from the real app, DESIGN.md, the old flows walkthroughs marked as history | all |

Each PR: `npm test`, `PORT=42xx npm run e2e`, both lints, three-light screenshots, review against this file and DESIGN.md.

## 11. Open questions

1. **The pairing** of drawings to chakras (section 6). It is the modern reading, not the texts'; move any of them.
2. **Colour.** Rainbow hues (modern, recognisable; my default), the texts' own colours (they disagree with each other), or ink alone?
3. **His own words.** The step lines and the notes to the next one are his, not the page's. They leave with the copy by default.
4. **Should a ticked row ease the gate?** Default no.
5. **Stale readings.** Dashed after a day (default), or left as set?
6. **Books and art.** Which titles, under which chakra? Manipura's fork and Svadhisthana's "Far away" step have nothing to put on yet.
7. **Names.** Sanskrit on the mountain with the English on the page (default), or English on the mountain too?
8. **The three knots.** The tradition's own blockages sit at Muladhara, Anahata and Ajna. Draw them on the stream as a quiet mark, or leave them out (default)?
9. **The next circles.** Which inspired flows join Meditate and Energize in the sea, and what is on each one's page?

## 12. Only the iPhone can say

Whether a sideways drag on a gate fights Safari's back swipe near the left edge; the frame rate of about 150 moving lines over the drawn land at night; the two ticks under a dragging thumb; whether the swaying sea reads as calm or as busy.

## 13. Sources

- [Chakra (Wikipedia)](https://en.wikipedia.org/wiki/Chakra): the seven, petals, elements, shapes, seeds; "the colours are modern"; the 1577 text and Woodroffe; the lowest of three obstructions.
- [Shat-cakra-nirupana, Avalon's translation (wisdomlib)](https://www.wisdomlib.org/hinduism/book/shat-cakra-nirupana-english/d/doc1144829.html): the verses; the texts' own colours.
- [The Rainbow Body: how the Western chakra system came to be (Kurt Leland, Quest)](https://www.theosophical.org/publications/quest-magazine/the-rainbow-body-how-the-western-chakra-system-came-to-be): Leadbeater 1927, the colour healers, Esalen, Dychtwald 1977, Judith; pierced, not balanced.
- [The granthis (Hridaya Yoga)](https://hridaya-yoga.com/the-granthis-the-3-psychic-knots/) and [Kundalini and chakras (eSamskriti)](https://esamskriti.com/e/Spirituality/Tantra/Kundalini-And-Chakras-1.aspx): the three knots and where sources put them. Teaching sites, not the texts.
- [Merudanda in hatha yoga (Hindu Blog)](https://www.hindu-blog.com/2022/08/merudanda-in-hatha-yoga.html): the spine as Meru's staff. A secondary source.
- [Bindu (Wikipedia)](https://en.wikipedia.org/wiki/Bindu_(symbol)), [Viparita Karani (Wikipedia)](https://en.wikipedia.org/wiki/Viparita_Karani) and [Hatha Yoga Pradipika, Muktibodhananda](https://terebess.hu/english/Hatha-Yoga-Pradipika-Muktibodhananda.pdf): the fluid held in the head and lost downward; "the nectar is consumed" before the inverted pose.
- [Mundaka Upanishad 3.2 (Krishnananda)](https://www.swami-krishnananda.org/mundak/mun_3-2.html) and [Müller's translation](https://www.universalfreemasonry.org/en/library/the-upanishads-part-II/mundaka-upanishad-III-2): the rivers and the sea.
- Anodea Judith, *Eastern Body, Western Mind* (rev. 2004): the per-chakra "demons" (fear, guilt, shame, grief). I confirmed the first four from summaries of the book, not the book itself.
