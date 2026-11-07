// Routes and the tab bar (PLAN.md section 5). Four words, always visible; hash routes so deep links
// and standalone mode both work: #/journal/:id, #/journal/pages, #/journal/questions, #/council/:id, #/be/:id, #/flow.
import { useEffect, useState } from 'preact/hooks';
import { Router, Route, useLocation } from 'preact-iso';
import { HashLocation, Redirect } from './ui/route';
import { JournalToday, JournalPage, JournalPages, Questions } from './ui/journal/Journal';
import { Council } from './ui/council/Council';
import { Be } from './ui/be/Be';
import { Flow } from './ui/flow/Flow';
import { Voices } from './ui/voices/Voices';
import { SettingsSheet } from './ui/settings/SettingsSheet';
import { MusicSheet, AlbumPagesSheet } from './ui/music/MusicSheet';
import { QuietLine } from './ui/UpdateToast';
import { openSheet, dataVersion } from './ui/sheets';
import { ensureSeedAdditions } from './db/seed';
import { loadSettings } from './ui/settings';
import { tick } from './ui/parts/Haptic';
import { Threshold, thresholdWanted } from './ui/parts/Threshold';
import type { ComponentChildren } from 'preact';
import { LockPad } from './ui/lock/Lock';
import { gateState } from './ui/lock/pin';
import { startRelock } from './ui/lock/relock';

export const TABS = [
  ['journal', 'Journal'],
  ['council', 'Council'],
  ['be', 'Be'],
  ['flow', 'Flow'],
] as const;

function Tabs() {
  const { path } = useLocation();
  const here = path.split('/')[1];
  return (
    <nav class="fs-tabs" aria-label="Sections">
      {TABS.map(([slug, word]) => (
        <a key={slug} class="fs-tab" href={`#/${slug}`} aria-current={here === slug ? 'page' : undefined}
          onClick={() => { if (here !== slug) tick('tab'); }}>{word}</a>
      ))}
    </nav>
  );
}

function Frame() {
  const { path } = useLocation();
  // A tab change (or any route change) puts the sheet away.
  useEffect(() => { openSheet.value = null; }, [path]);
  return (
    <div class="fs-app">
      <main class="fs-main">
        {/* an import bumps dataVersion, and every open page reads again */}
        <Router key={dataVersion.value}>
          <Route path="/journal" component={JournalToday} />
          <Route path="/journal/questions" component={Questions} />
          <Route path="/journal/pages" component={JournalPages} />
          <Route path="/journal/:id" component={JournalPage} />
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
  // a journal seeded before a seed page existed gets it once it is open (package 8: the models question)
  useEffect(() => {
    if (locked) return;
    ensureSeedAdditions()
      .then(async added => { if (added.length) { await loadSettings(); dataVersion.value++; } })
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
