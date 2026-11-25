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
import { syncWorn } from './ui/notebook';

async function boot() {
  // init opens the notebook left worn (PLAN-WORLDS.md decision 3), so the first page is drawn from it
  await init();
  syncWorn();
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

void boot();
