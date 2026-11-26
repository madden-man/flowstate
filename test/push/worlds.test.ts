// @vitest-environment jsdom
// The Sunday question with worlds (the merge of PLAN-PUSH.md into PLAN-WORLDS.md; DESIGN.md rule 22). The question was
// written for a one-notebook app; with worlds it stays the personal notebook's whatever world is worn: its settings on
// home's row, its page and its question in his own pages, never a world's database, never the outbox, never the bridge;
// the quiet line waits for his own pages; a landing (the notification's tap, or the quiet line's) takes the world off
// first, as the door does; and a world's backup never carries it.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { worldDbName, type FlowDB, type Settings } from '../../src/db/schema';
import { book, worn, don } from '../../src/db/fields';
import { exportData, importData } from '../../src/db/backup';
import { askCheckin } from '../../src/model/into';
import { carryNow } from '../../src/model/carry';
import { settings, saveSettings, loadSettings } from '../../src/ui/settings';
import { syncWorn, wornWorld } from '../../src/ui/notebook';
import { landCheckin, takeCheckin, checkinUp } from '../../src/ui/journal/checkin';
import { CHECKIN_DEFAULT, weekKey } from '../../src/push/due';
import { freshDB } from '../db/helpers';
import { fakeBridge, settled } from '../bridge/helpers';
import WORLDS from '../fixtures/worlds.json';

const WORLD = 'eastwinds';
const LINE = 'Is there anything on your mind?';
// Sunday 22 November 2026, 10:01 local: the question is due
const T0 = new Date(2026, 10, 22, 10, 1).getTime();

let homeDb: FlowDB;
let worldDb: FlowDB;

beforeEach(async () => {
  homeDb = await freshDB();
  // a journal begun before this week's Sunday, the registry as the bridge leaves it, a bridge token pasted
  await homeDb.settings.put({
    id: 'app', light: 'sky', stillAfterMidnight: 'offer', sounds: true, haptics: true, lock: { enabled: false, relockAfterMin: 5 },
    seededAt: T0 - 30 * 86_400_000, worlds: WORLDS as Settings['worlds'],
  } as Settings);
  await loadSettings();
  await saveSettings({ bridge: { token: 'tok' } });
  await don(WORLD);
  worldDb = book();
  syncWorn();
  await loadSettings();
  checkinUp.value = null;
});
afterEach(() => { vi.restoreAllMocks(); wornWorld.value = null; });

const rows = async (d: FlowDB, t: 'pages' | 'messages' | 'outbox') => d.table(t).toArray();
const route = vi.fn();

describe('the Sunday question while a world is worn', () => {
  it('its settings land on home\'s row, never the world\'s', async () => {
    expect(worn()).toBe(WORLD);
    await saveSettings({ checkin: { ...CHECKIN_DEFAULT, hour: 9, line: LINE } });
    expect((await homeDb.settings.get('app'))?.checkin).toMatchObject({ hour: 9, line: LINE });
    expect((await worldDb.settings.get('app'))?.checkin).toBeUndefined();
    // and the app reads them back whatever is worn
    await loadSettings();
    expect(settings.peek().checkin).toMatchObject({ hour: 9 });
  });

  it('askCheckin refuses with a world worn and writes nothing in it', async () => {
    await expect(askCheckin('2026-11-22', LINE, T0)).rejects.toThrow(/own pages/);
    expect(await rows(worldDb, 'pages')).toEqual([]);
    expect(await rows(worldDb, 'outbox')).toEqual([]);
  });

  it('the landing takes the world off, writes the question in his own pages, and sends nothing to the bridge', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await landCheckin(route, T0);
    await settled();
    expect(worn()).toBeNull();
    expect(wornWorld.peek()).toBeNull();
    // his own pages: today's page linked to the week, and the question asked from it
    const pages = await rows(homeDb, 'pages');
    expect(pages.find(p => p.checkin?.week === '2026-11-22')).toBeTruthy();
    expect(pages.filter(p => p.kind === 'question')).toHaveLength(1);
    expect((await rows(homeDb, 'messages')).map(m => m.text)).toContain(LINE);
    // the world: nothing written, nothing waiting to go up
    expect(await rows(worldDb, 'pages')).toEqual([]);
    expect(await rows(worldDb, 'messages')).toEqual([]);
    expect(await rows(worldDb, 'outbox')).toEqual([]);
    expect(await rows(homeDb, 'outbox')).toEqual([]);
    expect((await homeDb.settings.get('app'))?.checkin?.lastShownWeek).toBe('2026-11-22');
    expect(fetchSpy).not.toHaveBeenCalled();
    // a carry afterwards (every registered world's outbox drained) sends none of it
    await don(WORLD);
    const bridge = fakeBridge();
    await carryNow(bridge.fetcher);
    const sent = bridge.calls.map(c => String(c.init?.body ?? '')).join('\n');
    expect(sent).not.toContain(LINE);
    expect(sent).not.toContain('2026-11-22');
  });

  it('the quiet line waits for his own pages: not shown, not counted as shown, while a world is worn', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(T0);
    expect(takeCheckin(T0)).toBe(false);
    await settled();
    expect((await homeDb.settings.get('app'))?.checkin?.lastShownWeek).toBeUndefined();
    // back in his own pages it asks
    const { wear } = await import('../../src/ui/notebook');
    await wear(null);
    expect(takeCheckin(T0)).toBe(true);
    await settled();
    expect((await homeDb.settings.get('app'))?.checkin?.lastShownWeek).toBe(weekKey(T0, CHECKIN_DEFAULT));
  });

  it('a world\'s backup never carries it, and a world file that does is stripped on import', async () => {
    await saveSettings({ checkin: { ...CHECKIN_DEFAULT, line: LINE, push: true } });
    const file = await exportData();
    expect(file.notebook).toBe(WORLD);
    const row = (file.tables.settings as Settings[])[0];
    expect(row.checkin).toBeUndefined();
    // a hand-made world file with the question in its row
    (file.tables.settings as Settings[])[0] = { ...row, checkin: { ...CHECKIN_DEFAULT, line: 'Not here' } };
    await importData(file, 'replace');
    expect((await worldDb.settings.get('app'))?.checkin).toBeUndefined();
    // his own row keeps his question and this phone's push
    expect((await homeDb.settings.get('app'))?.checkin).toMatchObject({ line: LINE, push: true });
  });
});

describe('the notebooks the question may name', () => {
  it('a world database is never the personal one', () => {
    expect(worldDb.name).toBe(worldDbName(homeDb.name, WORLD));
    expect(worldDb.name).not.toBe(homeDb.name);
  });
});
