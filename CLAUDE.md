# FlowState: rules for anyone building here

1. **Read `DESIGN.md` before touching `src/ui` or `design/`.** It is the design standard; `PLAN.md` is the architecture. The notebook photos are the spec behind both.
2. **Run the two lints before every commit and PR, and paste their PASS lines in the PR body:**
   ```
   node script/design-lint.mjs src design
   node ~/.claude/hooks/artifact-lint.mjs design/walkthrough.html
   ```
   Package 0 wires the first into `npm test` and a pre-commit hook; until then run it by hand. Never raise a limit or add a `design-lint: allow` marker without saying why in the same comment.
3. **Tokens only.** Colours, fonts, sizes, durations come from `src/ui/tokens.css` (copied unchanged from `design/tokens.css`). A new token needs a comment naming the screen that needed it.
4. **Every screen works in all three lights** (`data-light="day|night|still"`) and is reviewed in all three with the walkthrough's relight control. Still hides counts, states and deep twins; check that your screen does too.
5. **Every package PR adds or updates its steps in `design/walkthrough.html`**, built from the real components, one screen per step, one sentence per step (the artifact rule in `~/.claude/CLAUDE.md`).
6. **No network** outside `src/music/` and `src/research/`. No model-written text anywhere. No streaks, badges, confetti or counts on tabs. No modal dialogs; sheets rise. No icon libraries.
7. **Sound through `parts/Sound`, haptics through `parts/Haptic`**, nothing else; never uninvited.
8. **No em dashes** in anything written for Tommy (docs, UI copy, PR bodies).
