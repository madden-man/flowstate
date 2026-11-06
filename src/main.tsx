import { render } from 'preact';
import './ui/tokens.css';
import './ui/base.css';
import './ui/parts/parts.css';
import { App } from './app';
import { init } from './db/fields';
import { ensureSeeded } from './db/seed';
import { loadSettings } from './ui/settings';
import { startLight } from './ui/light';
import { startUpdates, askPersist } from './pwa/install';

async function boot() {
  await init();
  const firstRun = await ensureSeeded();
  await loadSettings();
  startLight();
  if (firstRun) void askPersist();
  startUpdates();
  render(<App />, document.getElementById('app')!);
}

void boot();
