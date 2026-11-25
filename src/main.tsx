import { render } from 'preact';
import './ui/tokens.css';
import './ui/base.css';
import './ui/parts/parts.css';
import { App } from './app';
import { init } from './db/fields';
import { ensureSeeded } from './db/seed';
import { loadSettings } from './ui/settings';
import { startLight } from './ui/light';
import { startUpdates, countLaunch } from './pwa/install';
import { persistNow } from './pwa/persist';
import { bootMusic } from './ui/music/state';
import { startPress } from './ui/parts/Press';

async function boot() {
  await init();
  const firstRun = await ensureSeeded();
  await loadSettings();
  startLight();
  startPress();
  bootMusic();
  // first run asks Safari to keep the data, and the answer goes into the settings row
  if (firstRun) void persistNow();
  countLaunch();
  startUpdates();
  render(<App />, document.getElementById('app')!);
}

// W0 spike (PLAN-WORLDS.md row W0, never merges): #/spike is the probe screen, shown instead of the app, before the
// lock and the database. On this branch the manifest opens the installed app there.
if (location.hash.replace(/^#\/?/, '') === 'spike') {
  // the service worker is registered as the app does, so the probes run under it as the real app's requests will
  startUpdates();
  void import('./spike/Spike').then(({ Spike }) => render(<Spike />, document.getElementById('app')!));
} else void boot();
