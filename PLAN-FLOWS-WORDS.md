# FlowState flows: a language audit of the proposal walkthrough

Date: 2026-11-08. Audited: `design/flows/index.html` at e867513 (artifact QgjCMzDNxdzSHbDT36ybhZ). Tommy's ask: "is there any way to make it feel more kind, more specific, more to the point? look at research as you review." Nothing here is applied; this is the review. Tommy's own lines (the italic "your line" on each step, quoted from the notebook) are left alone throughout.

## 1. What the research says about words for someone in distress

- **Validate, then inform.** Invalidating responses raised negative affect, heart rate and skin conductance in a stressor study (Shenk and Fruzzetti 2011, https://pure.psu.edu/en/publications/the-impact-of-validating-and-invalidating-responses-on-emotional-). Barlow's panic model names the attack a *false alarm*: a real alarm firing at the wrong time, never an imagined one (https://legacy.psychiatrist.com/read-pdf/3133). Patient-facing CBT says "the sensations are real, but they are not signs of danger" (https://www.psychologytools.com/resource/psychology-tools-for-overcoming-panic). A flat "It isn't" contradicts the one thing the person can verify, their heartbeat.
- **Get specific, fast.** In 15,000 crisis-line conversations the more effective counsellors "quickly got to the heart of the issue", wrote less templated text and asked concrete clarifying questions (Althoff, Clark and Leskovec 2016, https://homes.cs.washington.edu/~althoff/docs/althoff-2016-mental_health.pdf). Plans that name a time and place are followed through far more often (Gollwitzer and Sheeran 2006, d = .65 across 94 tests, https://stafforini.com/works/gollwitzer-2006-implementation-intentions-and/; the 2024 update of 642 tests puts the bias-corrected figure at .15 to .35, still positive). Concrete "how it unfolded" processing cut rumination and dysphoria where abstract "why" deepened it (Watkins 2009, https://ore.exeter.ac.uk/articles/journal_contribution/Concreteness_training_reduces_dysphoria_proof-of-principle_for_repeated_cognitive_bias_modification_in_depression_/29698868).
- **Short, plain, positive.** Simple words are read as more intelligent and more trustworthy; the effect runs through processing fluency (Oppenheimer 2006, https://en.wikipedia.org/wiki/Daniel_M._Oppenheimer). Negated instructions take more effort and produce more errors, and acute stress makes reading lean harder on working memory (2024 negated-instruction study, https://frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1451309/pdf). The plan's own P25 already says acute stress narrows working memory. Simple positive contractions ("it's", "you're") read as speech; readability guidance flags only negative and conditional ones (https://readabilityguidelines.netlify.com/grammar-points/contractions/).
- **Information beats reassurance.** Reassurance brings short relief and then more anxiety and more seeking (Salkovskis; https://researchportal.bath.ac.uk/en/publications/patterns-of-reassurance-seeking-and-reassurance-related-behaviour/). A clock, a half-life, a last-time line are information the person can check. "The worst is behind you" and "You're okay" are reassurance; the page should carry at most one such line per step, and it should be the wise line (rule 17, Kross 2014).
- **Counts, not percentages.** "Nine in ten" is a natural frequency, which people read correctly far more often than "91%" (Gigerenzer, https://pure.mpg.de/pubman/item/item_2099208_1/component/file_2099207/GG_What_2011.pdf). The page already does this; keep it.
- **Ask about suicide directly.** None of 13 studies found that asking raised ideation (Dazzi 2014, https://core-prod.cambridgecore.org/core/services/aop-cambridge-core/content/view/FCAEE9E5BC840D76CF10AEBECD921AC9/S0033291714001299a.pdf). 988's own line is "call or text 988, or chat" (https://988lifeline.org/contact-us/). "Hurting yourself" conflates self-harm with suicide and is the softer, less clear phrase.
- **Directive vs. soft wording is a wash.** Reactance research is mixed: "you might" did not beat "you must" reliably, and in one trial soft wording lowered intentions (https://cris.maastrichtuniversity.nl/en/publications/should-or-could-testing-the-use-of-autonomy-supportive-language-a/). So the short imperative tips are fine as they are; the gain is in cutting negation and repetition, not softening verbs.

## 2. Six patterns to fix

1. **"It isn't" contradicts the body.** Twice (Overstimulated, Dim). Replace the contradiction with the false-alarm frame: real signal, wrong meaning.
2. **Passive, formal lines where the wise voice should be.** "Nothing is asked of you but...", "Nothing big is asked of you here" (twice). Put the person in the sentence.
3. **Said lines that repeat the tips.** The tip step's said line is four sentences carrying three instructions the rows already hold; Replay says "swap" twice; the peak's fifth tip restates its said line. One idea per said line; the rows do the rest.
4. **Register drifts.** "It isn't", "don't", "you're" sit beside "it is", "you are", "that is", "say you are going". Pick speech ("it's", "you're") everywhere a sentence is addressed to Tommy. British words for a US reader: "GP", "round the block".
5. **App words leak into the page.** "The morning is pinned", "peak to clear", "relapse", "the page follows". Say the thing, not the widget.
6. **Walkthrough lines describe the mock, not the moment.** Several of the one-sentence lines under step titles read as engineering ("The halo breathes at six a minute", "A dotted arrow up the far slope", "Name, your line, the page's, Earlier."). The global rule wants the user's words.

## 3. Line by line

Format: step · field · now → proposed · why. Tommy's italic lines are not listed; they stay.

**List (step 1)**
- Row meta "The ring · last 11 / 8" → "The ring · last time 11 / 8". "Last" alone reads as a duration.

**Panic at rest (2) and It passed before (9)**
- "Last time · 11 / 2 · 48 minutes, peak to clear" → "Last time · 11 / 2 · 48 minutes from the peak to clear". "Peak to clear" is a label, not a sentence.
- Title "Panic: the cycle" → "Panic: the ring". Every other flow title names its shape.

**Overstimulated (3)**
- Said: "Too much is coming in, and your body is reading it as danger. It isn't. Less coming in, a slower breath out, and this can still settle." → "Too much is coming in, and your body is reading it as danger. It's a false alarm: real, loud, and not dangerous. Less in, a slower breath out, and this settles here more often than not." Validates first (Shenk and Fruzzetti); "can still settle" hedges where the usual line already says "often settles here".
- "Coming in" appears four times on one screen (line, said, tip). Keep it in the tip, cut it from the said line as above.
- Walkthrough line "Drag the dot; the page follows." → "I put the dot on Overstimulated." (the user's moment).

**Dim the page (4)**
- Said: "Your body is reading this as danger. It isn't. Less in, slower out." → "Your body is reading this as danger. It's a false alarm. Less in, slower out."

**Panic, the peak (5)**
- Title "Panic" (inside the Panic flow) → "The wave" (Tommy's own word for it) or "The peak".
- Tip "It's adrenaline, and it's already halving. Wait with it." repeats the said line → "Wait with it. You don't have to fix it." (the wise line, no repeat).
- Tip "Let it crest. You don't have to go anywhere." Keep; it is the best line on the page.
- Walkthrough line "The halo breathes at six a minute." → "The ring breathes with me."

**Settling (6)**
- Said: "The worst is behind you. Your heart has already slowed. Shaky is what draining feels like, and it takes about an hour: on schedule, not a relapse." → "The peak was n minutes ago and your heart has already slowed. Shaky is what draining feels like. It takes about an hour, and it's on schedule." Swaps a reassurance for a checkable fact (the clock is on the page); "relapse" is a clinic word; "not a relapse" is a negation under stress.
- Tip "You're okay. It's passing." Keep (Kross 2014, rule 17).

**Under the skin (7)**
- Said: "Tired and gross is what afterwards feels like, and it is the last part. It drains over hours, not minutes. Nothing is asked of you but water, food and something easy." → "Tired and gross is what afterwards feels like, and it's the last part. It drains over hours, not minutes. All you owe it is water, food and something easy." Active, addressed, one syllable shorter.
- Tip "Don't pick at it yet. It's draining." Keep: short, and the negation is the point.

**Write it down, later (8)**
- Link row "under the skin, now" is good. No change.

**Depress, Pulling in (10)**
- Said: "Pulling in is the dip doing its work, not you failing. The way out is back to front: one small thing before you feel like it. Most people who tried that felt a first lift inside three weeks." → "Pulling in is what a dip does; it isn't you failing. The way out runs backwards: do one small thing first, and the wanting to comes after. Most people who tried it felt a first lift within a few weeks." "Doing its work" makes the dip sound purposeful; "back to front" is a British idiom that can read as "reversed"; "three weeks" has no source in PLAN-FLOWS.md (see section 4).
- Tip "The act before the feeling: one small thing, scheduled" → "One small thing, with a time on it: the dishes at four". Gollwitzer: the when is what makes it happen; "scheduled" is the abstract form.
- Walkthrough line "A far slope as long as the near." Keep.

**The bottom (11)**
- Said: "This is the floor, and the floor is where it turns. Half of all dips are over inside three months, many well before. Nothing big is asked of you here: water, food, one tiny thing." → "This is the floor, and the floor is where it turns. Many dips are over in weeks; half are done inside three months. Today only asks for water, food and one tiny thing." Leads with the nearer horizon; active voice.
- Safety line: "If you're thinking of hurting yourself, call or text 988. Any hour." → "If you're thinking about suicide, call or text 988. Someone answers, any hour." Direct wording does no harm (Dazzi 2014); "someone answers" is the specific, kind detail. Open question 4 still stands.

**Energize, Locked in (12)**
- Said is good. Usual "An hour at a go; a few hours a day" is good.
- Walkthrough line "Locked in at the crest; a timer." → "I'm locked in, and the timer is counting."

**The tip (13)**
- Said: four sentences → "Wired and scattered means you're past the top, and from here more isn't better. If tomorrow is flat, that's the sleep, not you." The three instructions it drops are already the three rows under it.
- Tip "Stop while ahead, mid-sentence" → "Stop mid-sentence, so tomorrow starts easy". Says why.
- Boundary line (How this is built): "talk to your GP" → "talk to your doctor". Tommy is in the US.

**Fight, Flooded (14)**
- Said: "...say you are going, and when you will be back." → "...say you're going, and when you'll be back." Register.
- Tip "Don't text them, and don't vent to anyone yet" → "No texts, no venting, not yet." Two negated imperatives become one short list.

**Cooling (15)**
- Said is good. "What did Tommy want, in there?" is the right third-person line (Mischkowski, Kross and Bushman 2012); in the app it takes the user's name.

**What if (16)**
- Said: "...Expect the feeling instead of fighting it; it is already as high as it gets." → "...Expect the feeling instead of fighting it; it's already as high as it gets." Register only. The line is otherwise the best-sourced on the page.

**Replay (17)**
- Said: "Every "why" tightens the coil. Swap it for "how did it unfold, moment by moment": that is the swap that loosens it. Eight minutes of something absorbing beats eight minutes of replaying." → "Every "why" tightens the coil. "How did it unfold, moment by moment" loosens it. Eight minutes of something absorbing beats eight minutes of replaying." Says swap once.

**3 a.m. (18)**
- Said: "...The morning is pinned whatever the night does." → "...Seven still comes, whatever the night does." The pin is the widget; seven is the fact.
- Walkthrough line "The awake arc; 7 pinned." → "Awake at 3; 7 is still 7."

**Shutdown (19)**
- Said: "Your body pulled a brake. It is holding fight-or-flight, not failing..." → "Your body pulled a brake. It's holding, not failing..." Register, and "fight-or-flight" is jargon the next sentence does not need.

**Shame (20)**
- Said: ""I am bad" is a verdict on the whole of you, and it is the one that drags everything down. "I did a bad thing" is the version with a door. One specific repair, and done." → ""I am bad" is a verdict on the whole of you, and it's the one that drags everything down. "I did a bad thing" has a door in it. One specific repair, then it's done." Tangney's distinction kept; "and done" was clipped.
- Tip "Notice the urge to hide or blame before replying" → "Before you reply, notice the pull to hide or hit back". Puts the moment first; "hit back" matches the diagram's branch.

**Your own flows (21)**
- Fine. "An empty ring; name the first step." is in the user's register.

**Edit a step (22)**
- Walkthrough line "Name, your line, the page's, Earlier." → "I rewrite what the page says; the old words stay under Earlier."

**"How this is built" disclosures**
- The evidence row is labelled "Truth" on eight steps and "Evidence" on one. Use "Evidence" everywhere; "Truth" over-claims for clinical-practice rows the text itself grades as untested (Shutdown, Five).

## 4. Numbers to check before they are seeded

- "Most people who tried that felt a first lift inside three weeks" (Pulling in) and the disclosure's "61% halved symptoms by session three": neither figure appears in PLAN-FLOWS.md section 3.2 or its sources D1 to D21. Ekers 2014 reports post-treatment effect sizes only. Find the trial or drop the number ("within a few weeks" is defensible from early-response BA data only once a source is cited).
- "Raising next-day anxiety about 27%" (The tip disclosure): Ben Simon 2020 reports up to 30%. Minor; align with the plan's E-list.
- "It halves every few minutes" (the peak): plasma half-life of adrenaline is two to three minutes in most references, 3.5 in the plan's P15. "Every few minutes" is safe as written.
- "Nine in ten logged worries did not happen": LaFreniere and Newman 2020, 91.4%, in 29 GAD patients over ten days. Fine as a natural frequency; the disclosure could say "in a small study".

## 5. What to leave alone

Tommy's italic lines on every step. "Let it crest. You don't have to go anywhere." "You're okay. It's passing." "Don't pick at it yet. It's draining." "Write it down, later." "Same wake time tomorrow." "No big decisions now." "One concrete next step." The usual lines. The natural-frequency numbers. The example journal line about the kitchen. The imperative form of the tips: the reactance literature gives no reason to soften them.
