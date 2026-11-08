// Routes and the tab bar (PLAN.md section 5). Four words and the ? mark (V2), always visible; hash routes so
// deep links and standalone mode both work: #/journal/:id, #/journal/pages, #/questions, #/questions/:id,
// #/council/:id, #/be/:id, #/flow. The old #/journal/questions goes to #/questions.
import { useEffect, useState } from 'preact/hooks';
import { Router, Route, useLocation } from 'preact-iso';
import { HashLocation, Redirect } from './ui/route';
import { JournalToday, JournalPage, JournalPages } from './ui/journal/Journal';
import { Questions, QuestionPage } from './ui/questions/Questions';
import { Council } from './ui/council/Council';
import { Be } from './ui/be/Be';
import { Flow } from './ui/flow/Flow';
import { Voices } from './ui/voices/Voices';
import { SettingsSheet } from './ui/settings/SettingsSheet';
import { MusicSheet, AlbumPagesSheet } from './ui/music/MusicSheet';
import { QuietLine } from './ui/UpdateToast';
import { openSheet, dataVersion } from './ui/sheets';
import { earlierOpen } from './ui/parts/Earlier';
import { cleanSeedPages } from './db/seed';
import { loadSettings } from './ui/settings';
import { tick } from './ui/parts/Haptic';
import { Threshold, thresholdWanted } from './ui/parts/Threshold';
import type { ComponentChildren } from 'preact';
import { LockPad } from './ui/lock/Lock';
import { gateState } from './ui/lock/pin';
import { startRelock } from './ui/lock/relock';

/** The bar: four words, and Questions as a ? mark in the serif (V2, PLAN-V2.md section 2), so DESIGN.md
 *  rule 7's four words stand. The mark carries its name for VoiceOver. */
export const TABS: readonly { slug: string; word: string; label?: string }[] = [
  { slug: 'journal', word: 'Journal' },
  { slug: 'council', word: 'Council' },
  { slug: 'questions', word: '?', label: 'Questions' },
  { slug: 'be', word: 'Be' },
  { slug: 'flow', word: 'Flow' },
];

function Tabs() {
  const { path } = useLocation();
  const here = path.split('/')[1];
  return (
    <nav class="fs-tabs" aria-label="Sections">
      {TABS.map(({ slug, word, label }) => (
        <a key={slug} class={label ? 'fs-tab fs-tab-q' : 'fs-tab'} href={`#/${slug}`} aria-label={label}
          aria-current={here === slug ? 'page' : undefined}
          onClick={() => { if (here !== slug) tick('tab'); }}>{word}</a>
      ))}
    </nav>
  );
}

function Frame() {
  const { path } = useLocation();
  // A tab change (or any route change) puts the sheet away, and the rail of earlier pages back up (V6).
  useEffect(() => { openSheet.value = null; earlierOpen.value = false; }, [path]);
  return (
    <div class="fs-app">
      <main class="fs-main">
        {/* an import bumps dataVersion, and every open page reads again */}
        <Router key={dataVersion.value}>
          <Route path="/journal" component={JournalToday} />
          <Route path="/journal/questions" component={() => <Redirect to="/questions" />} />
          <Route path="/journal/pages" component={JournalPages} />
          <Route path="/journal/:id" component={JournalPage} />
          <Route path="/questions" component={Questions} />
          <Route path="/questions/:id" component={QuestionPage} />
          <Route path="/council" component={Council} />
          <Route path="/council/:id" component={Council} />
          <Route path="/be" component={Be} />
          <Route path="/be/:id" component={Be} />
          <Route path="/flow" component={Flow} />
          <Route path="/voices" component={Voices} />
          <Route default component={() => <Redirect to="/journal" />} />
        </Router>
        <SettingsSheet />
        <MusicSheet />
        <AlbumPagesSheet />
        <QuietLine />
      </main>
      <Tabs />
    </div>
  );
}

/** One threshold (PLAN.md sections 7 and 8). With a PIN on and the key out of memory, the threshold stands in
 *  front of everything, tab bar included: the manifesto, the ring breathing, and the keypad beneath (package 6).
 *  The hash is left alone, so a deep link lands once the PIN opens it. Unlocked, a cold load breathes once
 *  over the page (package 5) and the page comes up. */
function Gate({ children }: { children: ComponentChildren }) {
  useEffect(() => startRelock(), []);
  const [breath, setBreath] = useState(thresholdWanted);
  const locked = gateState() === 'locked';
  // the locked threshold was the breath: once the PIN opens the app, the page comes straight up
  useEffect(() => { if (locked) setBreath(false); }, [locked]);
  // once it is open, a journal seeded before V5 loses the seed pages it never wrote on (seed.ts cleanSeedPages)
  useEffect(() => {
    if (locked) return;
    cleanSeedPages()
      .then(async removed => { if (!removed) return; await loadSettings(); if (removed.length) dataVersion.value++; })
      .catch(() => { /* locked again before it ran: the next open tries again */ });
  }, [locked]);
  if (locked) return <Threshold keypad={<LockPad />} onDone={() => setBreath(false)} />;
  return (
    <>
      {children}
      {breath && <Threshold onDone={() => setBreath(false)} />}
    </>
  );
}

export function App() {
  return (
    <HashLocation>
      <Gate>
        <Frame />
      </Gate>
    </HashLocation>
  );
}
