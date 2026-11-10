# FlowState picks: something on, at the steps that ask for it

Date: 2026-11-09. Status: decided by Tommy 2026-11-10 (section 8); P0 to P2 built the same day. Tommy's ask: "look at semper dulce / tommysthoughts.com/darts and my letterboxd list for what shows and movies would be the best recommendations for each of the flows on flowstate, then make a plan for how we'll show those. also do the same for music albums (looking at for the poems and the prose and master for inspiration)", then "also include switch games", then "make sure your plan for showing all these entries fits within the design standard and doesn't detract from the very human, and fits well."

`PLAN-FLOWS.md` stays the flows' plan and research; `DESIGN.md` the standard. This file records where the picks come from, every pick for every step, the steps left empty on purpose, the screen, the check against the standard, the data and the packages. The proposal walkthrough is `design/flows/picks.html` (section 10).

## 1. What is there today (read at main 6bbbf24, rechecked at 2f936ec)

**The flows already point at this.** Seven seeded rows carry the ♪ helper ("An album, or the TV" on Panic's Under the skin and Shutdown's Thawing, "Earplugs, or one quiet album", "Music you choose", "In the crash: something easy on", "If you catch the replay, distract on purpose", "An album"). Each opens the whole ♪ sheet: every chosen playlist, hundreds of covers. At the step where the page says "all you owe it is water, food and something easy", the choosing is left to him.

**What he has already told his own tools:**

| Source | Where | What it holds | Read |
|---|---|---|---|
| Darts, Shows board | Mongo `tommy-data.darts` (tommysthoughts.com/darts) | 85 shows, every one rated, each with an enneagram type, a heartlighted value 1 to 7 and usually a one-line note in his words | 2026-11-09, read only |
| Darts, Movies board | the same collection | 826 films: 58 he curated by hand, the rest the Letterboxd import (`scripts/import-letterboxd.mjs`); 267 rated, 229 at four stars or more, 190 liked, his reviews as notes, his lists (top-50, with-babiz, harshberger-flicks) | 2026-11-09, read only |
| The Yes Pile | `japan-trip/src/content/guides/yes-pile.json` | 69 watch rows (his Letterboxd 3.5 and up, the darts board, and picks new to both of them), 13 Switch games and 3 phone games with players, vibes and which he owns | version 2026-10-29 |
| For the Poems and the Prose | Spotify playlist `0T6Gzc2hN81u3vGC5IJZ9a` | 3,051 tracks, 242 albums: almost all wordless or near it (scores, post-rock, piano, lo-fi, game soundtracks) | one playlist read, 2026-11-09 |
| master (ii) | Spotify playlist `1QDPVDJSXB9bIrfRg0V36q`, with the taste profile in `TommysThoughts/docs/spotify-taste-report.md` | 6,095 tracks, 855 records; twelve years of plays (210,732) scored per album: hours, years, loved or dropped | read 2026-11-05 |
| Semper Dulce | `~/dev/semper-dulce/PLAN.md` | No watch data of its own: its tonight picker (phase 5, not built) reads the darts collection and the Yes Pile | n/a |

## 2. Decisions and assumptions

Tommy's answers of 2026-11-10 are folded in below and listed in section 8. The rest is assumed, say so if wrong:

- **Fewer, not all.** A sheet holds at most three covers and three written lines. Fifteen of the forty-three steps carry one; the rest carry none, and section 3 says why for each flow. A first draft with nine rows, minutes and group labels read like a streaming shelf and was thrown away.
- **Only his.** Every title is one he rated four or more, liked, put on a list, owns, or put on a playlist himself. A line is the title and its kind, nothing more: Tommy ruled the darts notes out (2026-11-10), so no note is seeded, stored or shown. Nothing is written for him and nothing is chosen at run time: no model, no algorithm, no network. The order only ever changes by what he ticks.
- **On rows that are already there.** The On word goes on rows the flows already have: six of the seven ♪ rows (Replay's "An album" stays ♪), and five plain rows whose words it serves ("Eight minutes of something absorbing" on Depress and on Replay, "A walk, any length", "Something dull in dim light, away from bright screens", "Between fights, the friendship is what makes repairs work"). 4 rows are new (the three Tommy kept, and "The film you saved for after" on It was fine). No step goes past six rows.
- **Where a person is the answer, nothing is offered.** Shutdown's Far away asks for "a trusted voice, or someone's eyes"; Shame's steps are the reword and the repair; Depress's Pulling in is the step where television is what the withdrawal already looks like. A cast is not a person, so those steps get no On row.
- **How heartlighted was read.** As lightness, confirmed by Tommy 2026-11-10 (7 is the lightest): The Hangover, Letterkenny and Superbad are 7; The Grey, Fight Club and The Departed are 1. (`recommend_watch.js` describes the field to its model as "how much it moved them"; the values say otherwise.) Light steps drew from 6 and 7; "kept off" from 1 and 2.
- **The reasons stay in this file.** The page shows covers and titles. Why a title is on a step, and which of his titles were kept off it, is recorded here and printed nowhere in the app: naming Grave of the Fireflies at the bottom of the valley, even to say "not now", would be the app putting it in front of him.
- **Not a treatment.** As PLAN-FLOWS.md section 2. The studies in section 9 are why a kind of thing suits a step; none of them tested these titles, and most are applied by inference.

## 3. The picks, flow by flow

Per step: the row the On word sits on, why this kind of thing, the covers (with the playlist each is on and its Spotify album id), the lines, the bench (fits, not seeded: three and three is the cap) and what was kept off. 15 steps, 27 albums (12 on Poems only, 10 on master only, 5 on both), 25 titles. His darts notes are quoted in this section only under Kept off and the bench, as reasons; none reaches the app.

### 3.1 Panic

**Overstimulated** (`panic-1`), on the ♪ row: "Earplugs, or one quiet album". Less coming in: wordless, slow, already known. A screen is more coming in, so no lines.

- Covers: Gia Margaret, *Romantic Piano* (Poems; `4TFQoPpiHkSsYDbhfXMqCM`); Tom Ashbrook, *Solitudes* (Poems; `1Zrfkm3Oc8xhCLGCGmmKev`); S. Carey, *All We Grow* (Poems and master; `7hoiuRyh1XBh4YUOB0ZeGx`)

**Under the skin** (`panic-4`), on the ♪ row: "An album, or the TV". Drained, for hours. A world he already knows gives back what the effort took (Derrick 2013). The lightest things on his board (heartlighted 6 and 7), short, nothing that raises a pulse.

- Covers: Lord Huron, *Lonesome Dreams* (master; `2ZDjruwuzzzT8JMJRXvLtl`); The Head And The Heart, *The Head and the Heart* (master; `3MhJ8lLj98SPgtiH16ZmXo`); Of Monsters and Men, *My Head Is An Animal (The Cabin Sessions)* (Poems; `1oQYM3uKcmLBHvdO7vzRLo`)
- Lines: New Girl (show); Ferris Bueller's Day Off (film); A Short Hike (switch)
- Bench: Parks & Recreation, Stardew Valley
- Kept off: The Bear (his note: "stress"), 24 ("heart rate bounce"), A Quiet Place

Nothing on at The wave, Settling. The ring is the whole page at the wave; Settling is tea and a window.

### 3.2 Depress

**Head won't stop** (`depress-3`), on an existing row: "Eight minutes of something absorbing". Absorbing beats replaying. Things that take all of the attention: a hard platformer he owns, a whodunit, records with more words than the loop has.

- Covers: Watsky, *x Infinity* (master; `6CcTNttjHJN3WGR5igg4MR`); Logic, *The Incredible True Story* (master; `5dOpbgAmJeyoakKQ0QLWkR`); Lil Dicky, *Professional Rapper* (master; `7IhHBoBPWlCSrr8DCmP5ot`)
- Lines: Celeste (switch); Knives Out (film); Steins;Gate (show)
- Bench: Hollow Knight, Chess, Sherlock
- Kept off: Eternal Sunshine of the Spotless Mind, Memento, BoJack Horseman

**The bottom** (`depress-4`), on the ♪ row: "Music you choose". Music that keeps company, then lifts. Sad music deepens low mood in people who ruminate (Garrido and Schubert 2013, 2015), so the first cover is his most played and gentlest record, not his saddest. The row says music, so no lines. The sheet prints: "One that keeps you company, then one that lifts."

- Covers: Sleeping At Last, *Atlas: I* (Poems and master; `1E9iqjfSf5I5hPNfI1DRIh`); Sufjan Stevens, *Carrie & Lowell* (master; `0U8DeqqKDgIhIiWOdqiQXE`); Novo Amor, *Birthplace* (Poems and master; `0tWckYjFI6ioZptLr42J3p`)
- Kept off: Grave of the Fireflies (his note: "Probably the most brutal movie ever made."), Manchester by the Sea, Requiem for a Dream

**A little light** (`depress-5`), on an existing row: "A walk, any length". The lift came from doing, and the row is a walk. His loved albums run a median 42 minutes: a walk measured in a record, not in minutes. The sheet prints: "One album is about one walk."

- Covers: The Oh Hellos, *Through the Deep, Dark Valley* (master; `7cJyN85qjzHZBjeo9LRry8`); Lord Huron, *Strange Trails* (master; `3yoNZlqerJnsnMN5EDwwBS`); Passion Pit, *Gossamer* (Poems and master; `14JU5SskmcyckE5I8PY6lv`)
- Bench: Hunt for the Wilderpeople, The Secret Life of Walter Mitty, A Short Hike

Nothing on at Sliding, Pulling in, Climbing out. Pulling in is the one that matters: television is what pulling in already looks like, and the step says the doing comes first. A show offered there would be the app joining the withdrawal.

### 3.3 Energize

**Locked in** (`energize-3`), on a new row: "One wordless record". Lyrics cost reading and writing more than instrumental music does (Vasilev 2018, 65 studies). The Poems playlist is already his wordless shelf. Mr. Bean is his own exception, and it has no words either.

- Covers: Tycho, *Dive* (Poems; `4CBUbnGFz2iKFJjYqRIwst`); Lena Raine, *Celeste (Original Soundtrack)* (Poems and master; `5OZHQ7KG8k04IOkF50fACO`); GoGo Penguin, *v2.0 (Deluxe Edition)* (Poems; `7rXrjbrYcXG8EkqXpt0weK`)
- Lines: Mr. Bean (show)
- Bench: C418, Minecraft Volume Alpha, Christopher Larkin, Hollow Knight

**Landing, or the crash** (`energize-5`), on the ♪ row: "In the crash: something easy on, the usual coffee, and judge it after sleep". Flat and foggy is the sleep. The easiest things he owns: heartlighted 7, seen before, and one he filed under a trying time himself.

- Covers: Jack Johnson, *In Between Dreams* (master; `7tTc46dNdE6GGuiQsssWxo`); Bahamas, *Bahamas Is Afie* (master; `2UqlVTULRPG2qm8Bico9CK`)
- Lines: We're the Millers (film); 21 Jump Street (film); Letterkenny (show)
- Bench: A Short Hike, Super Mario Bros.

Nothing on at Spark, Build, The tip. The header ♪ is enough on the way up; at the tip the rows are about stopping.

### 3.4 Fight

**Flooded** (`fight-3`), on a new row: "One album: that's the twenty minutes". Twenty minutes is the least it takes, and rehearsing the argument keeps it up. An album is a clock that is not a timer. Venting is contraindicated (Bushman, already in PLAN-FLOWS.md), so nothing angry. The sheet prints: "Five songs is about twenty minutes."

- Covers: Tycho, *Awake* (Poems; `0GjrPTT00KWsalUi8jnpR9`); Sigur Rós, *Takk...* (Poems; `12tw1A9HmwE3MHvPfHhdoP`); Bon Iver, *Bon Iver, Bon Iver* (Poems; `2LpfNj3vB5rOXfaawLcOBg`)
- Kept off: Eminem, Curtain Call, Kendrick Lamar, DAMN.

**Cooling** (`fight-5`), on the ♪ row: "If you catch the replay, distract on purpose". About an hour, alone, and the replay is what keeps it up. One absurd half hour, or a game that needs both hands. Nothing about couples coming apart.

- Lines: Cunk on Earth (show); What We Do in the Shadows (show); Celeste (switch)
- Bench: Derry Girls, Death's Door, Chess
- Kept off: Beef, Marriage Story, The Roses

**Repair** (`fight-6`), on an existing row: "Between fights, the friendship is what makes repairs work". The row is about the friendship, so its lines are things for two: his with-babiz list, the Yes Pile together picks, a co-op game where both win or both lose.

- Lines: KPop Demon Hunters (film); The Big Sick (film); Spiritfarer (switch)
- Bench: Song of the Sea, Palm Springs, Lovers in a Dangerous Spacetime

Nothing on at Trigger, Climb, Said it or left. Leaving comes first.

### 3.5 What if

**Night before** (`whatif-3`), on a new row: "A film you know the ending of". The peak of the curve, and the future is the unknown. A rewatch is the one evening with a known ending (Russell and Levy 2012 on why people re-watch). Films he says get him every time. The sheet prints: "You know how this one ends."

- Lines: Back to the Future (film); Elf (film); Iron Man (film)
- Bench: Groundhog Day, The Princess Bride

**It was fine** (`whatif-5`), on a new row: "The film you saved for after". Tommy's call (2026-11-10): the saved film belongs here, on the far side of the thing, not as a row at Something's coming. Two films he has not seen yet, kept for the evening the thing is over. No covers, no printed line.

- Lines: Wake Up Dead Man (film); The Holdovers (film)

Nothing on at Something's coming, What if, The thing. The prediction is the work.

### 3.6 Replay

**Heavier** (`replay-3`), on an existing row: "Eight minutes of something absorbing". Eight minutes of something absorbing beat eight of replaying. Short and fast: a level, dialogue too quick to think over, six guesses. "An album" under it stays a ♪ row. Nothing built on second-hand embarrassment.

- Lines: Super Mario Bros. (switch); Letterkenny (show); Wordle (phone)
- Bench: Cunk on Earth, Doodle Jump
- Kept off: Nathan For You, The Office

Nothing on at That stung, Why did I, How not why. The question is the exit.

### 3.7 3 a.m.

**Up** (`night-4`), on an existing row: "Something dull in dim light, away from bright screens". Out of bed, dull and dim. Music may improve how sleep feels in insomnia (Cochrane 2022, 13 trials, moderate certainty); a screen is light and a clock. Covers only, and only at this step. The sheet prints: "Screens wait for seven."

- Covers: Tom Ashbrook, *Nocturnes* (Poems; `6gVzVC5RUQAPJaMcnP9zjI`); Sigur Rós, *Ágætis byrjun* (Poems; `1DMMv1Kmoli3Y9fVEZDUVC`); Hammock, *Raising Your Voice... Trying to Stop an Echo* (Poems; `5oixCadw77lgY0qTWMPm5r`)
- Kept off: Fight Club (his note: "insomnia kills")

Nothing on at Awake again, What time is it, Lying there, Same alarm. The bed is for sleeping; nothing is offered in it.

### 3.8 Shutdown

**Thawing** (`shutdown-4`), on the ♪ row: "An album, or the TV". Rest is the task. Slow and beautiful, little plot to hold.

- Covers: Novo Amor, *Birthplace* (Poems and master; `0tWckYjFI6ioZptLr42J3p`); S. Carey, *Hundred Acres* (Poems; `4H1xbaXxVDmHnFQ5ifzyM4`)
- Lines: Over the Garden Wall (show); Frieren: Beyond Journeys End (show); My Neighbor Totoro (film)
- Bench: A Short Hike, Stardew Valley, Song of the Sea

Nothing on at Too much, Stuck, Far away. Far away asks for a trusted voice or someone's eyes. A cast is not that, so the row stays a person's.

### 3.9 Shame

Nothing on at every step. The reword and the repair are the steps, and both are about a real person. Bench, for the evening after: The Good Place ("philosophy soup"), Good Will Hunting ("therapy works"), Celeste, Twenty One Pilots, Blurryface.

## 4. The shape (one line per walkthrough step)

1. **A row that says On.** Under the skin: "An album, or the TV" carries the word On where ♪ was.
2. **Three covers, three lines.** The sheet: his albums by their covers, then New Girl, Ferris Bueller's Day Off, A Short Hike.
3. **Tick the one you put on.** The row reads "An album, or the TV: New Girl", ticked.
4. **Too much coming in.** Overstimulated: three quiet covers, no lines.
5. **The bottom.** One printed line and three covers.
6. **Locked in.** Three wordless records and Mr. Bean.
7. **Flooded.** "Five songs is about twenty minutes." and three covers.
8. **Cooling.** Three lines, no covers.
9. **Night before.** "You know how this one ends." and three films.
10. **It was fine.** The film saved for after: two lines.
11. **Heavier.** Replay at its peak: a level, an episode, six guesses.
12. **3 a.m., up.** In Still: one line and three covers.
13. **Thawing.** Two covers, three lines.
14. **In Still.** Under the skin again: only the covers stay.
15. **Make it yours.** The step sheet: strike a pick, add an album or a line.

## 5. Against DESIGN.md

| Rule | How the sheet meets it |
|---|---|
| Section 1: the app makes room rather than content | Three and three, on fifteen steps, from his own lists. Twenty-eight steps offer nothing. |
| 1 to 4, 25: tokens | No new token and no new CSS rule. Covers are `.fs-tiles` and `.fs-tile`; lines are `.fs-check` in `.fl-tip`; the printed line is `.fl-said`. |
| 5: a row ends on a blank rule | The lines are the page's own check rows, unchanged: the title, then a blank rule. |
| 6: one primary act | Put one on. The sheet has no second act; ♪ beside Done reaches the whole grid. |
| 7: no icons | The row's word is "On", set like Ring and Journal. The kind word on a line (Show, Film, Switch, Phone) is the same small print. No posters, no service logos, no stars. |
| 8: sheets rise | `parts/Sheet`. No dialog. |
| 10: struck, never hidden | A pick is struck in the step sheet and stays struck; a seed pick he struck is never brought back. |
| 13: Still | Covers only, dimmed by the ♪ grid's own Still rule; the lines leave. The printed line stays (words, no digits). |
| 15: nothing counts | No minutes, ratings, hours played, "most watched" or "3 of 9". Last time's pick comes first; no number says so. |
| 16: the app never writes a line for you | A line is a title. The one printed line a sheet may carry is stationery like a step's `said`, passes the PLAN-FLOWS-WORDS.md audit, and is his to rewrite or blank in the step sheet. |
| 17: italic is the wiser second person or his own line | No italic on the sheet but the printed line, set as a step's `said` is. |
| 19, 21: ticks and bells | Existing sites only: a sheet opening, a check, `bell('album')` and M3's `tick('album')` on a cover. No new tick; rule 19's "a cover chosen on the music sheet" gains "or the On sheet" in P1. |
| 22: no network | Covers come from the cover cache the ♪ grid fills. No JustWatch, no "where to watch", no deep link to a streaming app. An album with no cached cover is a written line instead of a blank tile. |
| 26 to 31: motion | The covers are `MusicSheet`'s own `Tile`, so M3's press, drop and travel to the small cover by the ♪ come with it (rule 28). A ticked line draws its check (rule 27). Nothing new moves. |
| Door (PLAN-FLOWS.md 3.7) | The On word is behind the PIN, like ♪ (`BEHIND_PIN`): what he puts on is his. |

What keeps it his, beyond the rules: every title is one he chose long before the episode; the covers are wordless because he knows these records by sight, as he does in ♪; an album stands in for a clock twice ("Five songs is about twenty minutes", "One album is about one walk") so the page asks for no timer; and the sheet never says why it is offering anything.

## 6. Data (no schema version change expected: new optional fields inside `flows` and `episodes` rows)

```ts
export type TipHelper = /* existing */ | 'on';
export type PickKind = 'album' | 'show' | 'film' | 'switch' | 'phone';
/** Something to put on at a step. A title and its kind; no note (Tommy, 2026-11-10). Sealed with the step. */
export type Pick = { id: string; kind: PickKind; title: string; by?: string; albumId?: string; struck?: boolean };
export type Step = /* existing */ & { picks?: Pick[]; onLine?: string };
export type Episode = /* existing */ & { on?: { pickId: string; title: string; at: Millis } };
```

- **Seed:** `src/db/seed/picks.ts`, one const per flow, from section 3 (album ids are there). `seedPicksOnce` gives a journal that already has the flows each step's picks, its `onLine`, the helper swap on the named row and the 4 new rows, once, as a new revision; `SEED_TIPS_LATER` carries the new rows. A pick or row he struck or deleted is never brought back.
- **Albums:** a cover plays as a ♪ tile does: on its playlist at its first song when that playlist has been read (V9), on the album otherwise. `episodes.music` is written as today.
- **Lines:** ticking a line writes `episodes.on` and ticks the On row, which then reads its pick ("An album, or the TV: New Girl"). At rest, "what helped" names it. Next time at that step, the last one chosen is first.
- **His titles, guarded:** `test/fixtures/picks-titles.json` holds the seeded titles as listed in section 3; a test fails any seeded title that is not in it, any pick carrying a note, and any seeded step with more than six rows, three covers or three lines.

## 7. Build packages (one PR each, PLAN.md section 10 rules)

| # | Package | Done when |
|---|---|---|
| P0 | Data and seed | The types; `seed/picks.ts` from section 3; `seedPicksOnce`; the helper swap and the 4 new rows; the fixture and its guards; backup and restore carry the new fields |
| P1 | The On sheet | `flow/On.tsx` on `parts/Sheet`: the printed line, `Tile`s, lines as check rows; `'on'` in `Tips.tsx` and `BEHIND_PIN`; `episodes.on` and the row reading its pick; Still; the no-cover fallback; `design/flows/picks.html` rebuilt from the real components; e2e: open, tick a line, reload offline keeps it; a cover plays (mocked) |
| P2 | Yours | The On block in `StepSheet.tsx` (reorder, strike, "+ album" from the ♪ grid, "+ line" as a title and a kind, the line it prints); last chosen first; "what helped" names the pick |

P1 reuses the motion pass's `Tile` (M3, the album tap, on main since 2026-11-09). Every PR: `npm test`, `npm run e2e`, three lights, both lints PASS in the body, no em dashes.

## 8. Tommy's answers (2026-11-10)

1. Heartlighted: 7 is the lightest. Confirmed; the picks stand.
2. The empty steps (Pulling in, Far away, all of Shame) stay empty. Tommy: "if you don't have ideas for a flow, i can recommend". Shame's bench is not seeded; his recommendations go in when he gives them.
3. The three new rows: kept as worded.
4. Covers: wordless, as in ♪.
5. Darts notes: none, anywhere on the sheet.
6. Repair's lines for two: Tommy, "throw in my picks". They ship as his (KPop Demon Hunters, The Big Sick, Spiritfarer).
7. The saved film: only Wake Up Dead Man and The Holdovers, on It was fine (not a row at Something's coming). Thunderbolts* is dropped.

## 9. Sources

Data: section 1. Runtimes, services and availability were not used and are not printed, so none needed a desk check.

Research, each read from its abstract or record on 2026-11-09, not the full text; the grade is how far it carries to the step it is used on:

- Derrick 2013, "Energized by Television: Familiar Fictional Worlds Restore Self-Control", Social Psychological and Personality Science 4(3): one experiment and one diary study; a favourite, familiar show restored self-control after effort, and new or indiscriminate viewing did not. **Moderate**, applied by inference to the hours after panic. https://researchconnect.buffalo.edu/en/publications/energized-by-television-familiar-fictional-worlds-restore-self-co/
- Garrido and Schubert 2013 (Psychology of Music) and 2015 (Music Perception): self-chosen sad music raised depression scores, most in people who ruminate. **Moderate**; why the bottom's first cover is gentle rather than sad. https://www.eurekalert.org/news-releases/493878
- Jespersen et al. 2022, Cochrane review, "Listening to music for insomnia in adults": 13 trials, 1,007 people; moderate-certainty evidence for better subjective sleep quality, none for objective measures, no adverse events. **Moderate**, and the trials were bedtime listening, so it is inference at 3 a.m. https://pubmed.ncbi.nlm.nih.gov/36000763/
- Vasilev, Kirkby and Angele 2018, "Auditory Distraction During Reading", Perspectives on Psychological Science 13: 65 studies; music is a small reliable cost to reading, lyrics more than instrumental. **Strong** for reading; writing code is inference. https://eprints.bournemouth.ac.uk/29995/
- Russell and Levy 2012, "The Temporal and Focal Dynamics of Volitional Reconsumption", Journal of Consumer Research 39(2): interviews on why people re-read and re-watch. **Weak** (qualitative); behind "You know how this one ends." https://ideas.repec.org/a/oup/jconrs/doi10.1086-662996.html
- Games: Johannes, Vuorre and Przybylski 2021 found a small positive correlation between play and well-being; their 2022 follow-up found little to no causal effect of play time. So a game is offered as eight absorbing minutes, never as a mood treatment. **Weak**. https://pmc.ncbi.nlm.nih.gov/articles/PMC8074794
- Already in PLAN-FLOWS.md 3.6: eight minutes of distraction against rumination, flooding's twenty minutes, venting contraindicated (Bushman), clock-watching and sleep.

## 10. Artifact

`design/flows/picks.html`, fourteen steps as proposed (fifteen once P1 rebuilds it with It was fine and without the notes) on the shared `flows.css`, `flows.js`, `parts.css` and `tokens.css`. The phones are the finished app's own screens from `design/flows/index.html` and `others.html`, with the proposed sheet laid over them in the app's own parts; on three (Heavier, Up, Thawing) the dot was walked to the step by hand, since no capture of those steps existed. P1 rebuilds every step from the real component. Published private on 2026-11-09 as https://claude.ai/artifact/QtGSXokZ5oLE6Scb6Bbt5u (slug c16aa305-bad1-4f07-a31f-26e8f3375258): `picks.html` as `index.html` beside the four shared files. Private until Tommy shares it.
