# FlowState

"Who to Be, How to Flow." A personal journal that installs on an iPhone, keeps every byte on the phone, and is modelled on the pocket notebook started 2026-11-04. The notebook is the spec: its pages are the screens.

Live at https://flowstate-journal.netlify.app/ (add it to the Home Screen from Safari's Share menu).

## Run it

```
npm install
npm run dev        # the app on the Vite dev server
npm test           # design lint, tokens check, vitest, typecheck
npm run e2e        # Playwright against a production build, offline, then the dist check
```

Deploy (static files only):

```
npm run build
netlify deploy --prod --dir dist
```

## The two lints

Both must print PASS before any commit or PR:

```
node script/design-lint.mjs src design
node ~/.claude/hooks/artifact-lint.mjs design/walkthrough.html
```

The first runs in `npm test` and the pre-commit hook. `npm run tokens:check` keeps `src/ui/tokens.css` equal to `design/tokens.css`, and the walkthrough's copies of the app's CSS equal to theirs.

## Where things are

- `DESIGN.md`: the design standard, 25 rules, each marked lint or review.
- `PLAN.md`: the architecture, the data model and the build order.
- `design/walkthrough.html`: the walkthrough of every screen in the three lights, built from the app's own CSS.
- `CLAUDE.md`: the rules for anyone building here.
- `docs/SPOTIFY.md`: the Spotify setup (the app, the redirect URIs, Premium) for the music sheet.
