# FlowState Research: a question, and the papers on both sides

Date: 2026-11-13. Status: planned, not built. Packages are Q0 to Q6 (Q for question). Tommy's ask: "make a plan to create a new 'research' flow (next to meditate and energize) which lets me ask a question, and opus agents will find peer reviewed articles on both sides of the argument (+ / -). this should be hooked up to anthropic api, but only titles and abstracts of the peer reviewed journals should show. where no peer reviewed journals can be found relevant to the question, lower level sources are fine."

`PLAN.md` stays the architecture, `PLAN-MOUNTAIN.md` the Flow tab, `PLAN-MEDITATE.md` the shape this copies (a circle in the sea with a page of its own, not a flow with steps). The walkthrough is `design/research/index.html` (Q6, `npm run walkthrough:research`): fourteen steps round one phone running the real app on the two recorded runs in `test/fixtures/research/`, with no key and no network.

## 1. What this breaks, and what it keeps

Research is the first thing in FlowState that needs a model and the second that needs the network. Three standing rules meet it:

| Rule today | After this plan |
|---|---|
| "No network outside `src/music/`" (CLAUDE.md rule 6, DESIGN.md rule 22, lint DL21, `check-dist`) | A second fenced place, `src/research/`, opt-in like Spotify: nothing is sent until a key is pasted in Settings and a question is asked. Every other screen stays offline. |
| "No server" (PLAN.md section 2) | Kept. The phone calls the Anthropic API and the paper indexes itself. No Netlify function, no account, nothing of Tommy's stored anywhere but the phone. |
| "No model-written text anywhere"; "nothing is ever generated for you" (DESIGN.md section 1) | Kept, and made a type. The agents never write a word that is shown: they hand back paper ids and a side, and the page prints the title and abstract the index holds for that id. An id the app did not itself fetch is refused. |

What leaves the phone, and nothing else: the question (to Anthropic, and as search terms to Europe PMC and OpenAlex). No journal page, voice, value or flow is ever in a request. The page says so in print under the question line, once, before the first ask: "This question leaves the phone."

## 2. The shape: a council between two sides

Tommy, mid-plan: "make the page immersive and in line with design standards for the app, especially journal/council sections." So Research adds no new kind of screen. It is a council page whose two speakers are the sides, and every line they speak is a paper's title.

- **Where.** A third circle in the mountain's sea, after Meditate and Energize, at `#/flow/research` (`SEA_CIRCLES` in `ui/flow/Mountain.tsx`; `seaSlots(3)` already spaces three). Its drawing is the plain circle with one line down the middle: two sides.
- **Asking is the Journal's blank page** (rules 5 and 6): the notebook header ("Research" over the date), ruled paper, the caret ready, the question written at the title size as a question page's is (`fs-q`). One act under the thumb: Ask. The question is asked so that yes and no are the sides: **+** is evidence the answer is yes, **−** is evidence it is no. A question with no yes and no ("what is the best diet?") gets one fixed line in print, "Ask it so yes and no are the sides.", and no run.
- **The sides are two voices** (rules 3 and 9): **+** speaks in a light voice and **−** in its deep twin, the same hue, the doubled rule. Each paper is a council line (`fs-msg fs-v`): the speaker's print above it is the sign, the journal, the year and the kind, and the line itself is the title in ink on the rules, with the voice's 3px rule and wash. **The title is a link** (Tommy, 2026-11-13: "make them seem more like links, and make them link to the journals"): underlined in its side's colour, and a tap on it leaves for the paper at its journal, by DOI (with no DOI, the index's own record of it). Under the title, at the right of the line's last rule, the word Abstract in print. The lines stay in the order they were found, as a council's do, so the two sides answer each other down the page.
- **Looking.** Two Opus agents run at once, one told to find the strongest papers for yes, one for no. Each title is written in as it is filed, left to right as a pen would (rule 27). Under the page, where the council keeps its voice chips, sit two chips, + and −, their dots breathing while their side is looking (rule 31). At night the lamp takes the last speaker's colour, as it does in a council. No model words show: not the search terms, not a progress note; the only word is "Looking", in the quiet italic.
- **Checking.** When both are done, a third Opus call reads every filed abstract cold, without being told which agent filed it, and rules each one for, against or neither. Neither is lifted off the page. This is the guard against the commonest fault, a paper filed for a side its abstract does not support.
- **Hearing one side.** After the run the two chips are the filter: a tap on + or − quiets the other; a second tap brings it back.
- **A paper's page is a journal page.** A tap on Abstract, or anywhere on the line but its title, turns to it (rule 29: the paper stays, the ink turns): the title at the title size and a link as it is on the line, the print line, then the abstract as the index holds it, in ink on the rules, its section heads in print. At the foot, three words: Open the paper (a link out to its DOI, like the Spotify links), Write about it, To Council.
- **Into the Journal and the Council** (through `model/into.ts`, as a sign's touch carries): Write about it opens today's page with "From" and the question on its first rule and the title set above the caret as a quoted line in the side's voice; To Council begins a council with the question as its title and the title as its first line. The page keeps `page.research`, like `page.flow` and `page.sit`, so the way back is one tap. These are the only places a paper's words sit beside his own, and they are marked as the paper's by the voice rule.
- **Up to five a side, never padded.** A side with nothing says so in the quiet italic: "Nothing found for +."
- **Lower sources.** A side with no peer reviewed paper may be filled from lower tiers, each line's print saying what it is: "Preprint, not peer reviewed", "Conference paper", "Thesis", "Report", and last "Web page". A lower line never speaks on a side that has a journal paper.
- **Asked.** The header's word Asked (where the Journal has Pages) lists every earlier question, date over line, readable in airplane mode. A question can be asked again; the old lines are kept struck (rule 10) until Tommy lifts them.
- **Still** (rule 13): the question and the titles, no wash and no hue, the chips' dots still, nothing running. **The door**: not let through; the key is sealed under the PIN.
- **Haptics and sound**: a tick as each title lands (`check`), the soft bell when the run ends, both through `parts/Haptic` and `parts/Sound`, both following their switches.

## 3. Where the papers come from (checked 2026-11-13 with a browser `Origin` header)

| Index | Covers | Key | Answers a browser | Use |
|---|---|---|---|---|
| Europe PMC | Life sciences, medicine, psychology; preprints as `SRC:PPR` | None | Yes (`access-control-allow-origin: *`) | First. Full abstracts, publication types (Meta-Analysis, Systematic Review, Randomized Controlled Trial), citation counts. |
| OpenAlex | Every field | Works without one on a shared $0.10 a day budget per IP (a search costs $0.001); a free key gives $1 a day | Yes | Everything Europe PMC does not cover. Abstracts come as an inverted index and are rebuilt; `is_retracted` is read. |
| Crossref | Every DOI | None (one request a second) | Yes | Fallback lookup by DOI; abstracts only where the publisher deposits them. |
| Semantic Scholar | | | Returned 429 with no key | Not used. |

**Peer reviewed is decided by the index record, never by the model.** Tier 1: a journal article or review in a journal source (Europe PMC `MED` or `PMC`; OpenAlex `type` article or review with a `journal` source), not retracted, with an abstract. Tier 2: preprints, conference papers, book chapters, theses and reports from the same indexes, with an abstract. Tier 3: web pages found by the API's web search tool, title and site only, since a page has no abstract. A retracted paper is never returned to an agent. Honest limit: no index can prove a paper was reviewed; "in a journal the index lists" is the proxy, and a weak journal can pass it.

Abstracts from Europe PMC carry `<h4>` section heads and `<i>`: the heads become print labels, the rest plain text; nothing is reworded or cut.

## 4. The agents (Anthropic API)

- **SDK and key.** `@anthropic-ai/sdk` in the browser (`dangerouslyAllowBrowser: true`), the key pasted once in Settings and sealed with the PIN's key through `db/fields.ts`, as the Spotify tokens are. Use a key from a workspace of its own with a monthly spend limit set in the Console, so a lost phone costs a bounded amount. Q0 proves the direct call works from the installed app on the iPhone before anything else is built.
- **Model.** `claude-opus-5-5` for all three calls, `output_config: { effort: 'high' }` (its default is medium; Q0 measures whether medium holds), thinking left adaptive (it cannot be turned off on this model), `betas: ['server-side-fallback-2026-07-01']` with `fallbacks: 'default'` on `client.beta.messages.create` so a declined health question is retried rather than lost; a refusal of the whole chain prints "This one could not be looked up." Top level `cache_control: { type: 'ephemeral' }` so each turn rereads the growing history from cache.
- **Tools, all the app's own (strict, `additionalProperties: false`), no forced `tool_choice` (this model rejects it):**
  - `search({ query, index: 'europepmc' | 'openalex', tier: 1 | 2 })`: the app runs it and returns up to eight records, each `{ id, title, abstract, journal, year, kind, tier }`, whole. Parallel calls in one turn run together and come back in one message.
  - `file({ id, side: 'for' | 'against' })`: records a pick. An id not returned by a `search` in this run is answered with an error result.
  - `not_a_side_question()`: the question has no yes and no.
  - The checker has one tool, `rule({ id, side: 'for' | 'against' | 'neither' })`.
- **What is read from a reply.** Tool calls only. Text blocks are never read, stored or shown; `src/research/agents.ts` returns `{ paperId, side }[]` and nothing else, and a test asserts no string from a model reply can reach `ui/`.
- **The loop is the app's own, by hand**, one request a turn, because every turn is written to the question's row before the next is sent: a phone that locks mid-run picks up at the last finished turn when the page is opened again. Thinking blocks go back unchanged and the history is only ever appended to. A wake lock holds the screen while a run is on, as a sit does.
- **Caps, enforced by the app, not asked of the model.** Eight searches an agent (the ninth is answered "no searches left, file what you have"), twelve turns, five filed a side after the check. Tier 2 search is refused while the agent's side has a tier 1 paper filed.
- **Web pages (Q5).** Only when a side is still empty after tiers 1 and 2: one more request for that side with the server tool `{ type: 'web_search_20260209', name: 'web_search' }` and the same `file` tool taking a result's URL. The title and site shown are the search result's own. Billed per search on top of tokens; the price is looked up at Q5, not assumed here.
- **Cost.** My estimate, not measured: 150 to 300 thousand input tokens a question, mostly cache reads, and about 15 thousand out, so roughly $0.50 to $1.50 at $4 and $20 a million. Q0 replaces this with a real number.

## 5. Data (schema version 9)

- **`inquiries`**: `{ id, askedAt, question, state: 'running' | 'done' | 'stopped' | 'no-sides' | 'refused', picks: { paperId, side, tier }[], runs?: { for, against }, earlier?: [...] }`, index `askedAt`. `question` is private text and sealed by `fields.ts`. `runs` holds each agent's message history while `state` is running and is deleted when it ends. `earlier` keeps a re-asked question's former picks.
- **`papers`**: `{ id, doi?, title, abstract, journal?, year?, kind?, tier, url, source: 'europepmc' | 'openalex' | 'crossref' | 'web', fetchedAt }`. Public text, not sealed. One row a paper however many questions cite it.
- **Settings** gains `research?: { key, openAlexKey? }`, sealed.
- `SCHEMA_VERSION` 9; `TABLES` gains both; the upgrade writes nothing; `backup.ts` walks `TABLES`, so export and import carry them (the key is exported sealed, like the Spotify tokens). **Once this is on main, never deploy a dist built from an older tree.**
- Route `#/flow/research` and `#/flow/research/:id` (a saved question), matched before `#/flow/:id`.

## 6. Build packages (one PR each, same rules as PLAN.md section 10)

| # | Package | Done when |
|---|---|---|
| Q0 | The spike, on the phone | A throwaway page on a branch deploy: a pasted key, one `claude-opus-5-5` call straight from the installed app on the iPhone, one search of each index; then one whole run of section 4 from a script on the laptop for two real questions. Written into this plan: that the direct call works in the Home Screen app, what happens when the phone locks mid-request, tokens, dollars and seconds a question at effort high and at medium. Nothing merges to main. |
| Q1 | The indexes | `src/research/indexes.ts`: Europe PMC, OpenAlex and Crossref clients to one `Paper` shape; tiers and kinds from the record; retractions out; the inverted index rebuilt; section heads kept; merged by DOI. Fixture tests from saved responses, no live calls in `npm test`. |
| Q2 | The fence and the key | DL21 allows `fetch(` under `src/research/`; `check-dist` names the four hosts and `https://doi.org/`; the SDK's inert strings listed by name; DESIGN.md rule 22 rewritten and a new rule 36 (section 7); CLAUDE.md rule 6 and PLAN.md section 2 amended; Settings gains a Research row (paste, replace, remove; sealed; locked shows nothing); `@anthropic-ai/sdk` added and the precache size checked. |
| Q3 | The agents | `src/research/agents.ts`: the three prompts, the tools, the hand loop with resume, the caps, the fallback and refusal paths, the checker. Tests against a stubbed client: an unknown id is refused, text blocks are dropped, a run cut at turn four resumes at turn five, a tier 2 search is refused when tier 1 is filed, both agents filing one paper is settled by the check. |
| Q4 | The page | `ui/flow/Research.tsx` on the council's and the journal's own parts (`Page`, `fs-chat`, `fs-msg fs-v`, the chips, `fs-sheetof`): the sea's third circle and its travel (rule 28), the blank page and Ask, the printed "leaves the phone" line, the lines written in, the breathing chips and the lamp, the filter, the paper's page, the three words at its foot with `page.research` and the two carries, Asked, ask again with the old lines struck, schema 9, backup round trip, offline lines, Still, three lights. Can start beside Q3 against its stub. |
| Q5 | Web pages | The tier 3 pass of section 4 and its row. Only if Tommy wants pages at all (question 3). |
| Q6 | The walkthrough | `design/research/index.html` rebuilt as the real app running live, as `design/energize` is, on recorded index and agent fixtures (no key, no network in the artifact). |

Order: Q0, then Q1 and Q2 together, then Q3 and Q4, then Q5, Q6. Every PR: `npm test`, `npm run e2e`, three-lights screenshots, both lints PASS in the body, no em dashes. The e2e network spec gains one case: with no key, nothing leaves the origin anywhere in the app.

## 7. Rules touched

- **Rule 22** becomes: no request after the first load except from `src/music/` (Spotify) and `src/research/` (the Anthropic API and the paper indexes), each opt-in.
- **New rule 36, Research prints, it does not write (review; the type is lint):** every word on a Research page is Tommy's question, a paper's own title, abstract, journal and year, or the app's fixed print. No summary, verdict, score or count of papers; sides are not padded; a lower source is marked; a title is always a link to its paper; the + and − are glyphs in the serif like the ? and the ♪ (rule 7); the sides are a light voice and its deep twin and take no new colour (rule 25); a paper's words carried to a journal or council page keep the voice rule, so they are never mistaken for his.
- **Rule 15**: no count of questions asked or papers found. **Rule 13**: Still, above. **Rule 31**: the chips' dots breathe only while a run is on, and end still. **Rule 27**: a title is written in. **Rules 19 and 21**: one tick site (a title lands) and the soft bell at the end.
- **Tokens**: none new expected.

## 8. Open questions (each built on its stated default unless Tommy says otherwise)

1. **The key on the phone, or behind a server?** Default: on the phone, sealed. A Netlify function would hide the key but needs its own secret typed into the phone anyway (the site and repo are public), and breaks "no server".
2. **The print line under a title** (journal, year, kind) is more than "titles and abstracts". Default: shown, since it is the paper's own and is how a meta-analysis is told from a single study.
3. **How low may lower sources go?** Default: preprints and the like from the indexes (Q3), and web pages only if Q5 is wanted.
4. **Lower sources by side, or only when the whole question has no journal paper?** Default: by side.
5. **Papers the check rules neither** (mixed results). Default: dropped. The other choice is a third group under the two.
6. **How many a side.** Default: up to five.
7. **The circle's drawing, and the sides' hue.** Default: a circle with a line down the middle; blue and its deep twin, the notebook rule's colour (it is also the Mystic's hue).
8. **A spend guard in the app** beyond the Console's workspace limit. Default: none; the caps in section 4 bound one question.

## 9. Not verified

- That the Anthropic API takes a direct call from the installed Home Screen app on iOS (Q0). The SDK option exists; nobody has run it on Tommy's phone.
- The cost and time of a question (my estimate, section 4).
- How often OpenAlex has an abstract outside medicine; a paper with none is not offered to the agents, so thin fields may come back short.
- What iOS does to a request in flight when the phone locks; the resume in section 4 is designed for the worst case.
