// Routes and the tab bar (PLAN.md section 5). Four words, always visible; hash routes so deep links
// and standalone mode both work: #/journal/:id, #/journal/questions, #/council/:id, #/be/:id, #/flow.
import { useEffect } from 'preact/hooks';
import { Router, Route, useLocation } from 'preact-iso';
import { HashLocation, Redirect } from './ui/route';
import { JournalToday, JournalPage, Questions } from './ui/journal/Journal';
import { Council } from './ui/council/Council';
import { Be } from './ui/be/Be';
import { Flow } from './ui/flow/Flow';
import { SettingsSheet } from './ui/settings/SettingsSheet';
import { UpdateToast } from './ui/UpdateToast';
import { openSheet, dataVersion } from './ui/sheets';
import { tick } from './ui/parts/Haptic';

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
          <Route path="/journal/:id" component={JournalPage} />
          <Route path="/council" component={Council} />
          <Route path="/council/:id" component={Council} />
          <Route path="/be" component={Be} />
          <Route path="/be/:id" component={Be} />
          <Route path="/flow" component={Flow} />
          <Route default component={() => <Redirect to="/journal" />} />
        </Router>
        <SettingsSheet />
        <UpdateToast />
      </main>
      <Tabs />
    </div>
  );
}

export function App() {
  return (
    <HashLocation>
      <Frame />
    </HashLocation>
  );
}
