# FlowState: the tasks become the water

Planned 2026-11-11 at Tommy's ask: "revamp each of the tasks in flowstate flows ... more cohesive with the chakras and more interactive with the energy flow, only showing buttons or info when there is a clear interactive thing in the app (music album, game, etc., which can be separated out) ... more immersive with the mountain animation/drawings."

Second pass, the same evening, in his words:

- "don't rely on the responses that were on the original examples - do it for the actual chakra. for example, crown shouldn't be about insomnia anymore."
- "there should be music picks on all of the chakras, clickable and easy to jump to. i can provide, or you can make it editable."
- "where possible, integrate this with the other three sections, or link out of the app to things that could help (messaging a friend for example)."

This file is the second pass. Built: T0 to T6, as PRs #71 to #76 and #77 (T6), all merged into `acts-plan`, whose draft PR is #69; none of it is on main or deployed. Walkthrough: `design/tasks/` (fifteen steps, the real app running with example data; `npm run walkthrough:tasks` writes the publishable `design/tasks/dist/`), private at https://claude.ai/artifact/8XBwpvXuXCWPKeWVo3XMJf until republished. The standard is DESIGN.md rule 35.

## 1. The idea

1. **A sign's page is about that sign.** What it shows is written for what the sign is for (letting go, seeing clearly, speech, love and grief, will and worth, feeling, feeling safe), not carried over from the old flows' rows.
2. **A task is a touch on the water.** No checkboxes. Each touch is one or two print words beside the stream, drawn in what that place is made of.
3. **A touch goes somewhere real.** It either happens in the place (a held thumb, a line on the water), opens Journal, Council, Be or Questions with something carried in, or leaves the app for Messages, the phone, Calendar or Spotify. Nothing is shown that the app cannot act on.
4. **Music is on every sign.** A shelf of covers under each place, editable, and all seven shelves one tap away from any screen.
5. **A touch moves the water.** Done, it sends a surge from the pool above the sign down the course and on to the sea. It never writes the gate.

## 2. The seven signs

At most four touches a sign. The lead touch is the one drawn in use at rest.

| Sign | For | In the place | Into the app | Out of the app |
|---|---|---|---|---|
| Crown | letting go | **Let go**: one rule on the snow; the words lift off as spindrift and are not kept | **Core**: Be, on "I determine my core." **Kept line**: a star shows one kept line and opens its journal page. **Sit**: Meditate | |
| Third eye | seeing clearly | **Look far**: a held thumb; the ranges clear one by one on the breath | **Ask**: today's page, the line set as a question with Turn to answer open. **Bring it**: Council, the question as its first line. **Questions**: the ? tab | |
| Throat | speech | **Say it here**: one rule at the lip; the sentence goes over the fall | **A voice**: Council, the voice chips ready | **Send**: Messages with the sentence filled in. **Call**: the phone |
| Heart | love and grief | **Grieve**: a name on the tarn sinks and stays as a stone. **Hold**: the reflection steadies on the breath | **Letter**: a journal page that opens on "Dear", never sent | **Reach**: Messages to one person he chose |
| Solar plexus | will and worth | **Reword**: two rules, the verdict struck, the deed kept | **Stand on**: Be, a held value and who champions it. **Spark it**: Energize | **I will**: one thing with a time, into Calendar |
| Sacral | feeling | **Feel**: one word on the pool, rings out. **Hold**: a ring on each out-breath | **Write from it**: today's page, the word as its first line | **Move**: this sign's shelf, playing in Spotify |
| Root | feeling safe | **Five**: five things he can see, drawn as stepping stones. **Breathe**: a thumb on the water. **Basics**: four lanterns in the firs (ate, slept, water, outside) | | **Reach**: Messages to one safe person |

Changes this makes to what is built:

- Crown's gloss becomes "letting go" (it reads "letting go, sleep" in `model/mountain.ts`). Sleep is one of Root's basics.
- The 988 line, with Call and Text, is printed on Heart and Root in every light.
- Wise lines, said paragraphs and advice rows stay off the page, as R3 and mountain-fixes left them.

## 3. How a touch carries something in

| Lands on | What is carried | Uses |
|---|---|---|
| Journal, today's page | the line he wrote, as a question (Ask), a first line (Write from it) or "Dear" (Letter); the page is linked to the sign | `pages.ts todayLinked`, rule 17's Turn to answer |
| Journal, an older page | nothing; the kept line's own page opens | `messages.kept` |
| Council | the question as the first line, or nothing with the chips ready | `model/council.ts` |
| Be | nothing; the core line, or the value sheet of a held value | `ui/be` |
| Questions | nothing | the ? tab |
| Meditate, Energize | as now (`sitFrom`, Spark it) | the sea |
| Messages, phone | his own sentence, to a person he chose once | `sms:`, `tel:`, `ui/flow/Person` |
| Calendar | the line and its time | `calshow:` (the walk's helper) |
| Spotify | the cover tapped | `src/music` |

The sign travels with him: the place a touch lands shows a small sign in print by the date (on the header's top line, right over it), and a tap on it comes back (rule 28). The app writes no words of its own anywhere in this.

## 4. Music on every sign

- **The shelf.** Under the gate on every sign's page: covers, wordless, then a plus. A tap plays. Shows, films, games, books and art follow as written lines when he adds them.
- **Editable.** The plus opens the ♪ grid and his playlists; the chosen cover travels to the shelf. A long press lifts a cover: drag to reorder, off the shelf to remove.
- **Easy to jump to.** The ♪ in the header (on every screen) gains a Signs segment beside Playlists: seven rows, each a sign's name on its hue and its covers. A tap on a cover plays; a tap on the name opens that sign.
- **Starters.** Three of the albums already seeded in the app per sign, so no shelf opens empty. They are my guess at a fit and his to replace:

| Sign | Starter albums |
|---|---|
| Crown | Ágætis byrjun; Raising Your Voice... Trying to Stop an Echo; Takk... |
| Third eye | Dive; v2.0; Awake |
| Throat | x Infinity; The Incredible True Story; Professional Rapper |
| Heart | Atlas: I; Carrie & Lowell; Birthplace |
| Solar plexus | Gossamer; Celeste; Through the Deep, Dark Valley |
| Sacral | In Between Dreams; Bahamas Is Afie; The Head and the Heart |
| Root | Romantic Piano; Solitudes; All We Grow |

## 5. The water answers

- **Pool and surge.** R2's maths stands. With the gate part shut, water pools above the sign; a touch done releases a share of it as one surge, then the pool fills again because the reading has not changed.
- **The gate asks without words.** After a surge its handle goes dashed (R2's stale state) until he sets it or leaves it.
- **A touch that leaves** (Messages, Calendar, Journal) surges when he comes back to the sign, not when he goes.
- **On the mountain** the first return to the Flow tab in the same unlock shows the surge run from that sign to the sea, once.
- **Still:** touches work, no hue, no pool, no surge. **Reduce Motion:** marks light at once, nothing travels.
- **Never:** a tally of touches, a streak, a reading written for him, a sound he did not ask for.

## 6. The old flows

The eight crisis flows (Panic, What if, Depress, Fight, Replay, 3 a.m., Shutdown, Shame) no longer decide what a sign's page shows. They keep their steps, episodes and routes, and stay where a crisis starts: Right now and the door. A live episode still shows its step words on the sign's page, as mountain-fixes built it. Whether they stay paired to signs at all is question 3.

## 7. Data

- `signs` content in `model/acts.ts`: per sign, its touches (`id`, word, kind: `place | journal | council | be | questions | sea | out`, and what it carries). Seeded, editable later.
- `shelves`: one row per sign, `picks: OnPick[]` (the type the picks already use). The fifteen step picks stay on their steps.
- What he writes on the water: `marks` (`chakra`, `touch`, `text`, `at`), sealed. Crown's Let go writes none. Heart's stones read from it.
- Root's basics: today's four, on the day's row, gone at sunrise.
- A new table means a schema bump: main is 7, so this is 8.
- The door (no PIN) shows the place and the in-place touches that write nothing (Breathe, Hold, Look far, Five); everything that opens his words stays behind the PIN.

## 8. What this sits on

- **mountain-fixes (#70, merged):** the old drawings are off the sign's page. This plan builds on that page.
- **PLAN-WEATHER.md (#68, merged, not built):** its stars are kept lines, which is Crown's Kept line; build that once, there or here.
- **The walk (#61, open):** its card strip is not used. Kept from it: the `calendar` helper and the Call and Text links. Closing #61 is Tommy's call.
- **Mountain R4 (books and art):** lands on the shelf.

## 9. Packages

| | Package | Holds | After |
|---|---|---|---|
| T0 | Data | `model/acts.ts`, `shelves`, `marks`, the schema bump, the starter shelves, Crown's gloss, tests | |
| T1 | The place is the page | the taller plate, touch words on it, the paper foot (gloss, gate, shelf, safety), the checklist gone at rest | T0 |
| T2 | In the place | Breathe, Hold, Look far, Let go, Say it here, Grieve, Feel, Reword, Five, Basics, each in its material; the surge and the dashed gate | T1 |
| T3 | Into the app | Ask, Bring it, Letter, Write from it, Core, Stand on, Kept line, Questions, with the sign carried and the way back | T1, beside T2 |
| T4 | Out of the app | Send, Call, Reach, I will; the surge on return | T1, beside T2 |
| T5 | Music | the shelf, the plus, lift and remove, the Signs segment in the ♪ sheet | T0, beside T1 |
| T6 | Walkthrough and standard | `design/tasks` rebuilt from the real app, the DESIGN.md rule, the artifact republished | all |

## 10. Questions for Tommy, each with the default taken

1. The touches in section 2: any sign whose set is wrong for him? (Default: as written.)
2. Music: are the starter albums fine to seed, or does he want to give his own per sign? (Default: seed, editable.)
3. The old crisis flows: keep them under Right now and the door only (default), or still paired to signs?
4. A touch moves water but never the gate (default), or should each ease the gate a notch?
5. Crown's Let go keeps nothing; every other written line is kept. Right?
6. Close the walk (#61)?

## Built: choices taken for Tommy to overturn

- The starter shelves are read from code (`STARTER_TITLES`) until he first changes one; only then is a row written to `signShelves`.
- The lit word at rest is the data's lead touch, never the last one he used.
- Three signs show no words through the door: Crown, Throat and Solar plexus have no touch that writes nothing.
- The rest list left the flow page after Done: at rest the touches are what the page offers.
- One person for the whole app: Send, Call and both Reaches go to the person chosen once.
- Two taps to leave the app: the touch word, then the link named for what it opens.
- I will gives Calendar the time; the line goes to the clipboard, since `calshow:` takes no text.
- Ask uses Ask this on the line, and the answer stays on today's page.
- Letter places "Dear " on the next rule, unsaved until he writes after it.
- Kept line shows one kept line a day, one star.
- A touch that leaves the app is dropped if he does not come back to its sign.
- An open gate sends no surge and asks nothing.
- A touch releases 0.6 of what the gate holds (`SHARE`).
- Grieve's stones show only while Grieve is the active word.
- The shelf's plus shows only with Spotify connected, and adds albums only.
- A sign's page has no Settings in its header: the sign's name is there, and the way back takes Settings' place, as on a question page.
- The carried sign is printed on the header's top line, before "No.", not on the date's own line, so the date keeps its line on a 375pt phone.
- ♪ with no account raises the music sheet on the row that connects (Signs beside it); it no longer opens the Poems playlist in Spotify.
- A question asked from a line still on the page is not printed again under "Asked · Questions"; the link is those words alone.

## 11. Only the iPhone can say

A thumb held on a canvas against Safari's scroll and back swipe; the keyboard over a rule drawn on the plate; `sms:` with a body, `tel:` and `calshow:` from the installed app, and what coming back looks like; print words on dark rock under a thumb; the surge read as relief and not as a reward.

Found walking the whole feature (T6) and since fixed in code, still to be seen on the phone: the keyboard rising for every rule a touch draws (the tap itself now draws the rule and puts the caret on it, Send and I will included); the header at 390pt and 375pt with "Solar plexus chakra" or a carried sign on it. Still open: a long press on a cover against iOS's own image callout, and the time field's wheel for I will.
