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

async function boot() {
  await init();
  const firstRun = await ensureSeeded();
  await loadSettings();
  startLight();
  bootMusic();
  // first run asks Safari to keep the data, and the answer goes into the settings row
  if (firstRun) void persistNow();
  countLaunch();
  startUpdates();
  render(<App />, document.getElementById('app')!);
}

void boot();
