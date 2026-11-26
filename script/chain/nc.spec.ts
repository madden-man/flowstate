// W8's chain, Novel Companion's half (FlowState script/chain-desktops.mjs copies this into a throwaway clone of the
// app as tests/e2e/chain.spec.ts and runs it through the app's own Playwright Electron harness and local test
// database). CHAIN_PHASE=down: a bible "East Winds" (example data) with fixed ids is made and what the app publishes
// for the phone (its registry row and its pocket) is saved. CHAIN_PHASE=screens: the same bible, then the documents
// the bridge function stored from the phone (recorded by FlowState script/snap-chain-phone.mjs) written into the test
// bridge_up as the function writes them, the window brought to the front to pull them, and each screen captured.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import type { Store } from '../../src/main/db';
import { BRIDGE_DOWN, BRIDGE_UP, BRIDGE_WORLDS } from '../../src/shared/bridge';
import type { Invoke } from '../helpers/t5';
import { connectTo, fileDb, invokeVia, launch, rail } from './helpers';
import { capture, clockAt, size } from './chainCapture';

const PHASE = process.env.CHAIN_PHASE ?? 'down';
const FIX = process.env.CHAIN_FIX!;
const OUT = process.env.CHAIN_OUT!;
const SLUG = 'east-winds';
const WORLD = 'east-winds';

let app: ElectronApplication;
let page: Page;
let invoke: Invoke;
let store: Store;

test.describe.configure({ mode: 'serial' });

const at = '2026-10-11T17:00:00.000Z';
const fam = (id: string, name: string, color: string) => ({ collection: 'families', data: { _id: id, title: `${name} family`, name, color } });
const person = (id: string, full: string, born: number, family: string, extra: Record<string, unknown> = {}) => ({
  collection: 'characters', data: { _id: id, title: full, names: { full }, birth: { year: born }, familyIds: [family], ...extra },
});
const SEED = [
  fam('fam-temple', 'Temple', '#8a6a4a'), fam('fam-li', 'Li', '#8a5ac0'), fam('fam-harbour', 'Harbour', '#d04848'),
  fam('fam-wen', 'Wen', '#3a70d0'), fam('fam-river', 'River', '#3a9a5a'),
  person('ren', 'Abbot Ren', 2010, 'fam-temple', { death: { year: 2069 } }),
  person('li', 'Mrs. Li', 2033, 'fam-li'),
  person('sydney', 'Sydney', 2037, 'fam-harbour'),
  person('siyuan', 'Siyuan', 2041, 'fam-wen', { backstory: 'Raised at the temple from the age of six.' }),
  person('dawn', 'Dawn Li', 2062, 'fam-river', { backstory: 'Mrs. Li\'s granddaughter. Nine in the spring of the flood.' }),
  { collection: 'places', data: { _id: 'gate', title: 'The temple gate', parentId: null, communityId: null, descriptions: [] } },
  { collection: 'places', data: { _id: 'river', title: 'The river', parentId: null, communityId: null, descriptions: [] } },
  { collection: 'parts', data: { _id: 'pt1', title: 'Part One: High Water', number: 1 } },
  { collection: 'chapters', data: { _id: 'ch12', title: 'The flood', partId: 'pt1', readingOrder: 1, strands: [{ id: 'ch12-a', label: 'spring', startYear: 2071, endYear: null, primary: true, povCharacterId: 'siyuan', characterIds: ['siyuan', 'dawn'], placeIds: ['gate'] }] } },
  { collection: 'worldEvents', data: { _id: 'ev1', title: 'The spring flood', start: { year: 2071 }, categoryId: 'climate', regions: [], characterIds: [] } },
  { collection: 'openQuestions', data: { _id: 'q-leave', title: 'Does Siyuan leave before the flood, or after?', question: 'Does Siyuan leave before the flood, or after?' } },
  { collection: 'openQuestions', data: { _id: 'q-who', title: 'Who raises Dawn after 2065?', question: 'Who raises Dawn after 2065?' } },
];

async function focusWindow() {
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0]?.emit('focus'); });
}

test.beforeAll(async () => {
  const db = fileDb();
  store = await connectTo(db);
  ({ app, page } = await launch(db));
  invoke = invokeVia(page);
  await size(app);
  // the bible was written in October; the phone's pages are from 25 November
  await clockAt(app, at);
  await invoke('bible.create', { slug: SLUG, name: 'East Winds' });
  await invoke('bible.open', { slug: SLUG });
  await expect(page.getByTestId('workspace')).toBeVisible();
  for (const item of SEED) {
    try { await invoke('test.seed', { items: [item as never] }); } catch (e) { throw new Error(`seed ${JSON.stringify(item).slice(0, 80)}: ${String(e)}`); }
  }
  await invoke('storyTime.set', { time: { year: 2071 } });
});

test.afterAll(async () => {
  await app?.close();
  await store?.close();
});

test('down: what the bible publishes for the phone', async () => {
  test.skip(PHASE !== 'down');
  await expect.poll(async () => ((await store.bridge.collection(BRIDGE_DOWN).findOne({ _id: WORLD as never })) as { pocket?: { characters: unknown[]; questions: unknown[] } } | null)?.pocket?.questions.length ?? 0, { timeout: 30_000 }).toBe(2);
  await page.waitForTimeout(3000);
  const worlds = await store.bridge.collection(BRIDGE_WORLDS).find({}).toArray();
  const down = await store.bridge.collection(BRIDGE_DOWN).find({}).toArray();
  writeFileSync(join(FIX, 'down-nc.json'), `${JSON.stringify({ worlds, down }, null, 1)}\n`);
});

const editor = () => page.getByTestId('editor');
async function openCharacter(name: string) {
  await rail(page, 'Characters').click();
  await page.getByTestId('entry-list').getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByTestId('character-page')).toBeVisible();
}
const shot = (name: string) => capture(page, OUT, `nc-${name}`);

test('screens: the phone\'s pages arrive', async () => {
  test.skip(PHASE !== 'screens');
  const up = JSON.parse(readFileSync(join(FIX, 'up.json'), 'utf8')) as { up: Record<string, unknown>[] };
  // the next morning at the Mac
  await clockAt(app, '2026-11-26T15:10:00.000Z');
  const mine = up.up.filter(d => d.world === WORLD);
  for (const d of mine) await store.bridge.collection(BRIDGE_UP).replaceOne({ _id: d._id as never }, d, { upsert: true });
  await focusWindow();
  await expect.poll(async () => (await invoke('notebook.offered', {})).pages.length, { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);

  await openCharacter('Siyuan');
  const list = editor().getByTestId('notebook-list');
  await expect(list).toBeVisible();
  await list.scrollIntoViewIfNeeded();
  await shot('kept');

  const council = list.locator('[data-notebook-id]').filter({ hasText: 'before the flood' }).first();
  await council.getByRole('button').first().click();
  await expect(page.getByTestId('notebook-page')).toBeVisible();
  await shot('council');
  await page.keyboard.press('Escape');

  await openCharacter('Dawn Li');
  const voice = page.getByTestId('voice-list');
  await expect(voice).toBeVisible();
  await voice.scrollIntoViewIfNeeded();
  await shot('voice');
  const song = editor().getByTestId('notebook-list').locator('[data-notebook-id]').filter({ hasText: 'grey coat' });
  if (await song.count()) { await song.first().scrollIntoViewIfNeeded(); await shot('song'); }

  await rail(page, 'From the notebook').click();
  await expect(page.getByTestId('notebook-tray')).toBeVisible();
  await page.waitForTimeout(1500);
  await shot('tray');
  const file = page.getByTestId('notebook-tray').getByTestId('tray-file').first();
  if (await file.isEnabled().catch(() => false)) {
    await file.click();
    await page.waitForTimeout(800);
    await shot('filed');
  }

  await rail(page, 'Questions').click();
  await page.waitForTimeout(1000);
  await shot('questions');
  await page.getByTestId('top-changes').click();
  await page.waitForTimeout(500);
  await shot('changes');
  await page.keyboard.press('Escape');
});
