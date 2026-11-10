// Routes and the tab bar (PLAN.md section 5). Four words and the ? mark (V2), always visible; hash routes so
// deep links and standalone mode both work: #/journal/:id, #/journal/pages, #/questions, #/questions/:id,
// #/council/:id, #/be/:id, #/flow, #/flow/now, #/flow/meditate, #/flow/:id, #/flow/energize/stuck (X4), #/flow/:id/:step. The old #/journal/questions goes to #/questions.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Router, Route, useLocation } from 'preact-iso';
import { HashLocation, Redirect, readHash, TABS } from './ui/route';
import { useFrameUp } from './ui/turns';
import { JournalToday, JournalPage, JournalPages, JournalNew } from './ui/journal/Journal';
import { Questions, QuestionPage } from './ui/questions/Questions';
import { Council } from './ui/council/Council';
import { Be } from './ui/be/Be';
import { Flow } from './ui/flow/Flow';
import { FlowPage } from './ui/flow/FlowPage';
import { Now } from './ui/flow/Now';
import { Stuck } from './ui/flow/Stuck';
import { Meditate, sitting } from './ui/flow/Meditate';
import { afterUnlock } from './ui/flow/door';
import { doorPasses } from './model/door';
import { DoorPin } from './ui/lock/DoorPin';
import { onOpen } from './model/flows';
import { FIXATION_FLOW } from './model/fixations';
import { Voices } from './ui/voices/Voices';
import { SettingsSheet } from './ui/settings/SettingsSheet';
import { MusicSheet, AlbumPagesSheet } from './ui/music/MusicSheet';
import { PlaylistsSheet } from './ui/music/PlaylistsSheet';
import { QuietLine } from './ui/UpdateToast';
import { openSheet, dataVersion } from './ui/sheets';
import { earlierOpen } from './ui/parts/Earlier';
import { cleanSeedPages, seedFixationsOnce, seedFlowsOnce, seedPicksOnce } from './db/seed';
import { loadSettings, settings } from './ui/settings';
import { tick } from './ui/parts/Haptic';
import { Threshold, thresholdWanted } from './ui/parts/Threshold';
import type { ComponentChildren } from 'preact';
import { LockPad } from './ui/lock/Lock';
import { gateState } from './ui/lock/pin';
import { startRelock } from './ui/lock/relock';

// the bar's words live with the turns now (ui/turns.ts), which turn by their order
export { TABS };

/** The mark under the tab (M2, DESIGN.md rule 27): one ink stroke under the current word, or the ?. It slides to the
 *  tapped tab over --t-page; it is placed without moving on first render and on resize, drawn where there was none,
 *  and lifted where no tab is current (Voices). The bar itself never moves. */
function placeMark(nav: HTMLElement, mark: HTMLElement, how: 'slide' | 'place') {
  const tab = nav.querySelector('.fs-tab[aria-current="page"]');
  if (!tab) { mark.dataset.gone = ''; return; }
  // the word's own box, not the tab's: a range round its text
  const range = document.createRange();
  range.selectNodeContents(tab);
  const w = range.getBoundingClientRect(), n = nav.getBoundingClientRect();
  const gone = mark.dataset.gone !== undefined;
  const set = (scale: number) => {
    mark.style.setProperty('--mark-x', `${w.left - n.left}px`);
    mark.style.setProperty('--mark-y', `${w.bottom - n.top + 3}px`);
    mark.style.setProperty('--mark-w', String(scale * w.width));
  };
  if (how === 'place' || gone) {
    // put it there with no transition; where there was none, from nothing, then drawn left to right
    mark.dataset.placing = '';
    set(how === 'place' ? 1 : 0);
    delete mark.dataset.gone;
    void mark.getBoundingClientRect();
    delete mark.dataset.placing;
    if (how === 'place') return;
    mark.dataset.drawing = '';
    set(1);
    return;
  }
  delete mark.dataset.drawing;
  set(1);
}

function Tabs() {
  const { path } = useLocation();
  const here = path.split('/')[1];
  const nav = useRef<HTMLElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!nav.current || !mark.current) return;
    placeMark(nav.current, mark.current, first.current ? 'place' : 'slide');
    first.current = false;
  }, [here]);
  useEffect(() => {
    const again = () => { if (nav.current && mark.current) placeMark(nav.current, mark.current, 'place'); };
    addEventListener('resize', again);
    // the words' widths change when the phone's fonts finish loading
    void document.fonts?.ready.then(again);
    return () => removeEventListener('resize', again);
  }, []);
  return (
    <nav ref={nav} class="fs-tabs" aria-label="Sections">
      {TABS.map(({ slug, word, label }) => (
        <a key={slug} class={label ? 'fs-tab fs-tab-q' : 'fs-tab'} href={`#/${slug}`} aria-label={label}
          aria-current={here === slug ? 'page' : undefined}
          onClick={() => { if (here !== slug) tick('tab'); }}>{word}</a>
      ))}
      <span ref={mark} class="fs-tab-mark" aria-hidden="true" data-gone="" />
    </nav>
  );
}

function Frame() {
  const { path } = useLocation();
  useFrameUp();
  // A tab change (or any route change) puts the sheet away, and the rail of earlier pages back up (V6).
  useEffect(() => { openSheet.value = null; earlierOpen.value = false; }, [path]);
  return (
    // a sit on the Meditate page (PLAN-MEDITATE.md, S1): the header, the tabs and the lamp leave on one --t-light
    <div class="fs-app" data-sitting={sitting.value ? 'true' : undefined}>
      <main class="fs-main">
        {/* an import bumps dataVersion, and every open page reads again */}
        <Router key={dataVersion.value}>
          <Route path="/journal" component={JournalToday} />
          <Route path="/journal/questions" component={() => <Redirect to="/questions" />} />
          <Route path="/journal/pages" component={JournalPages} />
          <Route path="/journal/new/:n" component={JournalNew} />
          <Route path="/journal/:id" component={JournalPage} />
          <Route path="/questions" component={Questions} />
          <Route path="/questions/:id" component={QuestionPage} />
          <Route path="/council" component={Council} />
          <Route path="/council/:id" component={Council} />
          <Route path="/be" component={Be} />
          <Route path="/be/:id" component={Be} />
          <Route path="/flow" component={Flow} />
          {/* before /flow/:id, so no flow can ever be called "now" or "meditate" */}
          <Route path="/flow/now" component={Now} />
          <Route path="/flow/meditate" component={Meditate} />
          <Route path="/flow/meditate/:step" component={() => <Redirect to="/flow/meditate" />} />
          <Route path="/flow/:id" component={FlowPage} />
          {/* What stuck (PLAN-ENERGIZE.md X4), before /flow/:id/:step so it is never read as a step; behind the PIN only:
              the door frame has no such route and model/door.ts doorPasses lets no word step through */}
          <Route path={`/flow/${FIXATION_FLOW}/stuck`} component={Stuck} />
          <Route path="/flow/:id/:step" component={FlowPage} />
          <Route path="/voices" component={Voices} />
          <Route default component={() => <Redirect to="/journal" />} />
        </Router>
        <SettingsSheet />
        <MusicSheet />
        <AlbumPagesSheet />
        <PlaylistsSheet />
        <QuietLine />
      </main>
      <Tabs />
    </div>
  );
}

/** The app opens on a live episode once per load, not on every unlock. */
let openedOnce = false;

const DoorNow = () => <Now doorOnly />;
const DoorFlowPage = ({ id, step }: { id: string; step?: string }) => <FlowPage id={id} step={step} doorOnly />;
const DoorMeditate = () => <Meditate doorOnly />;

/** Through the door without the PIN (PLAN-FLOWS.md 3.7, F5): the pages the lock lets through, read-only, with no
 *  tab bar and no sheet but the PIN's own; Meditate S3 adds #/flow/meditate, whose sit fades the frame as it does
 *  unlocked. Every other hash shows the keypad (the Gate). */
function DoorFrame() {
  return (
    <div class="fs-app" data-door data-sitting={sitting.value ? 'true' : undefined}>
      <main class="fs-main">
        <Router>
          <Route path="/flow/now" component={DoorNow} />
          <Route path="/flow/meditate" component={DoorMeditate} />
          <Route path="/flow/:id/:step" component={DoorFlowPage} />
        </Router>
        <DoorPin />
      </main>
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
  // the flows (F1): the seed flows written once, then, on the first open of this load, a live episode inside its
  // step's usual span opens its flow page instead of the journal (PLAN-FLOWS.md 3.7); a deep link anywhere else stays.
  // The door (F5): locked with the door on, the live episode opens read-only through the door. Once the PIN opens
  // the journal, the dot put through the door is written first (ui/flow/door.ts), and the page stays where it is.
  const { route, path } = useLocation();
  const doorOn = !!settings.value.flowDoor;
  useEffect(() => {
    if (locked) {
      if (!doorOn || openedOnce) return;
      onOpen()
        .then(live => {
          const here = readHash();
          if (openedOnce || !live?.step || (here !== '/' && here !== '/journal')) return;
          openedOnce = true;
          route(`/flow/${live.flowId}/${live.step}`, true);
        })
        .catch(() => { /* nothing to open on */ });
      return;
    }
    afterUnlock(to => route(to))
      .then(async wrote => {
        const written = await seedFlowsOnce();
        // the picks (PLAN-PICKS.md, P0) after the flows, so the four new On rows are there to give theirs
        const picked = await seedPicksOnce();
        // the fixations (PLAN-ENERGIZE.md section 5, X1): the first three and the deck, once, sealed like the flows
        const fixed = await seedFixationsOnce();
        if (wrote || written?.length || picked?.length || fixed?.length) dataVersion.value++;
        if (openedOnce) return;
        openedOnce = true;
        const live = await onOpen();
        const here = readHash();
        if (live && (here === '/' || here === '/journal')) route(`/flow/${live.flowId}${live.step ? `/${live.step}` : ''}`, true);
      })
      .catch(() => { /* locked again before it ran: the next open tries again */ });
  }, [locked]);
  if (locked && doorPasses(path, doorOn)) return <DoorFrame />;
  if (locked) {
    return (
      <Threshold onDone={() => setBreath(false)} keypad={
        <>
          <LockPad />
          {/* the door (F5): one word under the keypad, only with the door on in Settings */}
          {doorOn && <a class="fs-word fl-door" href="#/flow/now">the ring</a>}
        </>
      } />
    );
  }
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
