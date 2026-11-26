// W8's chain, Music Companion's half (FlowState script/chain-desktops.mjs copies this into a throwaway clone of the
// app as tests/e2e/chain.spec.ts; the app runs hidden, MUSIC_COMPANION_HIDDEN=1, on its local test database).
// CHAIN_PHASE=down: Songbook with one Mac song (example data); what the app publishes for the phone is saved.
// CHAIN_PHASE=screens: Novel Companion's registry row (recorded in down-nc.json) and the documents the bridge function
// stored from the phone (up.json, its clips beside it) written into the test flowstate_bridge as the function and
// Novel Companion write them; the app pulls them on connect, and each screen is captured.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import type { Db } from 'mongodb';
import { bridgeDatabaseName } from '../../src/main/bridge/database';
import { connectTo, fileDb, invokeVia, launchApp } from './helpers';
import { capture, clockAt, size } from './chainCapture';

const PHASE = process.env.CHAIN_PHASE ?? 'down';
const FIX = process.env.CHAIN_FIX!;
const OUT = process.env.CHAIN_OUT!;

let app: ElectronApplication;
let page: Page;

test.describe.configure({ mode: 'serial' });

async function onBridge<T>(work: (db: Db) => Promise<T>): Promise<T> {
  const target = fileDb();
  const store = await connectTo(target);
  try { return await work(store.client.db(bridgeDatabaseName(target.name))); } finally { await store.close(); }
}

test.beforeAll(async () => {
  if (PHASE === 'screens') {
    const nc = JSON.parse(readFileSync(join(FIX, 'down-nc.json'), 'utf8')) as { worlds: object[] };
    const up = JSON.parse(readFileSync(join(FIX, 'up.json'), 'utf8')) as { up: object[]; clips: (Record<string, unknown> & { file: string })[] };
    await onBridge(async db => {
      await db.collection('bridge_worlds').insertMany(nc.worlds as never[]);
      await db.collection('bridge_up').insertMany(up.up as never[]);
      if (up.clips.length) await db.collection('bridge_clips').insertMany(up.clips.map(({ file, ...c }) => ({ ...c, audio: readFileSync(join(FIX, file)) })) as never[]);
    });
  }
  ({ app, page } = await launchApp());
  await size(app);
  await clockAt(app, '2026-11-19T15:00:00.000Z');
  const invoke = invokeVia(page);
  await expect(page.getByTestId('db-status')).toHaveAttribute('data-state', 'connected');
  const { song } = await invoke('songs.create', { name: 'Low tide', workDate: '2026-11-19' });
  await invoke('songs.update', { id: song._id, patch: { lyrics: '[Verse]\nThe water left a line on every door\nand we painted over it in May' } });
  await clockAt(app, '2026-11-26T15:20:00.000Z');
});

test.afterAll(async () => { await app?.close(); });

test('down: what Songbook publishes for the phone', async () => {
  test.skip(PHASE !== 'down');
  await expect.poll(() => onBridge(async db => ((await db.collection('bridge_down').findOne({ _id: 'songbook' as never })) as { pocket?: { songs: { lyric?: string }[] } } | null)?.pocket?.songs[0]?.lyric ?? ''), { timeout: 30_000 }).toContain('painted');
  const worlds = await onBridge(db => db.collection('bridge_worlds').find({}).toArray());
  const down = await onBridge(db => db.collection('bridge_down').find({}).toArray());
  writeFileSync(join(FIX, 'down-mc.json'), `${JSON.stringify({ worlds, down }, null, 1)}\n`);
});

test('screens: the phone\'s songs and hums on the Mac', async () => {
  test.skip(PHASE !== 'screens');
  await app.evaluate(({ BrowserWindow, app: a }) => { a.emit('browser-window-focus', {}, BrowserWindow.getAllWindows()[0]); });
  await page.getByTestId('rail').getByRole('button', { name: 'Songs' }).click();
  const row = page.getByTestId('song-row').filter({ hasText: 'The grey coat' });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  await row.click();
  await expect(page.getByTestId('song-world')).toBeVisible();
  await expect(page.getByTestId('song-sketches').getByTestId('sketch-row').first()).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('song-sketches').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await capture(page, OUT, 'mc-song');
  await page.getByTestId('loose-hums-row').click();
  await expect(page.getByTestId('loose-hums')).toBeVisible();
  await page.waitForTimeout(800);
  await capture(page, OUT, 'mc-hums');
});
