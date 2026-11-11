// The picks (PLAN-PICKS.md sections 3 and 6, P0). The seed: fifteen steps carry an On row with picks, every title is
// one the fixture lists (his, as section 3 lists them), no pick carries a note, and no seeded step goes past six rows,
// three covers or three lines. A new journal has them from the seed; a journal that had the flows before gets them
// once (seed.ts seedPicksOnce), as a new revision, and never gets back a row or a pick he struck or deleted. Backup and
// restore carry the new fields, and with a PIN they are sealed.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from './helpers';
import titles from '../fixtures/picks-titles.json';
import { ensureSeeded, seedFlowsOnce, seedPicksOnce } from '../../src/db/seed';
import { SEED_FLOWS, SEED_TIPS_LATER } from '../../src/db/seed-flows';
import { PICKS, albumUriOf } from '../../src/db/seed/picks';
import { flowById, moveDot, liveEpisode } from '../../src/model/flows';
import { store, setKey, lock } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { exportData, importData, parseBackup } from '../../src/db/backup';
import type { FlowDB, OnPick, Step, Tip } from '../../src/db/schema';

type Seeded = { flow: string; step: Step; row: Tip };
const seeded = (): Seeded[] => SEED_FLOWS.flatMap(f => f.steps.filter(s => s.picks?.length).map(step => {
  const row = step.tips.find(t => t.helper === 'on');
  return { flow: f.id, step, row: row! };
}));
/** A step's rows as the page counts them against its six (model/tips.ts shownTips): no print line, no Sit row. */
const rowsOf = (s: Step) => s.tips.filter(t => !t.print && t.helper !== 'sit');
const covers = (s: Step) => (s.picks ?? []).filter(p => p.kind === 'album');
const lines = (s: Step) => (s.picks ?? []).filter(p => p.kind !== 'album');

/** The guards, as one function, so a test can show each one failing on a bad seed. Only steps that carry picks: a step
 *  with none is the flows' own business (Panic's Settling already rides its person row past six, F6). */
function guard(all: Step[]): string[] {
  const steps = all.filter(s => s.picks?.length);
  const albums = new Set(titles.albums.map(a => `${a.by}|${a.title}|${a.albumId}`));
  const named = new Set(titles.lines.map(l => `${l.kind}|${l.title}`));
  const out: string[] = [];
  for (const s of steps) {
    if (rowsOf(s).length > 6) out.push(`${s.id}: more than six rows`);
    if (covers(s).length > 3) out.push(`${s.id}: more than three covers`);
    if (lines(s).length > 3) out.push(`${s.id}: more than three lines`);
    for (const p of s.picks ?? []) {
      if ('note' in p) out.push(`${p.id}: a note`);
      const known = p.kind === 'album' ? albums.has(`${p.by}|${p.title}|${p.albumId}`) : named.has(`${p.kind}|${p.title}`);
      if (!known) out.push(`${p.id}: not in the fixture`);
    }
  }
  return out;
}

describe('the seed', () => {
  it('fifteen steps, as section 3 lists them, each with one On row', () => {
    expect(seeded().map(x => x.step.id)).toEqual([
      'panic-1', 'panic-4', 'depress-3', 'depress-4', 'depress-5', 'energize-3', 'energize-5', 'fight-3', 'fight-5', 'fight-6',
      'whatif-3', 'whatif-5', 'replay-3', 'night-4', 'shutdown-4',
    ]);
    for (const { step } of seeded()) expect(step.tips.filter(t => t.helper === 'on'), step.id).toHaveLength(1);
    // and every On row is on a step with picks
    const onRows = SEED_FLOWS.flatMap(f => f.steps.flatMap(s => s.tips.filter(t => t.helper === 'on').map(() => s.id)));
    expect(onRows).toEqual(seeded().map(x => x.step.id));
  });

  it('the On word sits where the plan puts it: six ♪ rows, five plain rows, four new rows', () => {
    const at = Object.fromEntries(seeded().map(x => [x.step.id, x.row.text]));
    expect(at).toEqual({
      'panic-1': 'Earplugs, or one quiet album',
      'panic-4': 'An album, or the TV',
      'depress-3': 'Eight minutes of something absorbing',
      'depress-4': 'Music you choose',
      'depress-5': 'A walk, any length',
      'energize-3': 'One wordless record',
      'energize-5': 'In the crash: something easy on, the usual coffee, and judge it after sleep',
      'fight-3': "One album: that's the twenty minutes",
      'fight-5': 'If you catch the replay, distract on purpose',
      'fight-6': 'Between fights, the friendship is what makes repairs work',
      'whatif-3': 'A film you know the ending of',
      'whatif-5': 'The film you saved for after',
      'replay-3': 'Eight minutes of something absorbing',
      'night-4': 'Something dull in dim light, away from bright screens',
      'shutdown-4': 'An album, or the TV',
    });
    // the walk's audit (seed/walk.ts) took Replay's "An album", the last ♪ row: the On row beside it is the album
    const music = SEED_FLOWS.flatMap(f => f.steps.flatMap(s => s.tips.filter(t => t.helper === 'music').map(t => t.id)));
    expect(music).toEqual([]);
    for (const id of ['energize-3-on', 'fight-3-on', 'whatif-3-on', 'whatif-5-on']) expect(SEED_TIPS_LATER).toContain(id);
  });

  it('the printed lines are the plan\'s five, word for word, and nothing else is printed', () => {
    const printed = Object.fromEntries(seeded().filter(x => x.step.onLine).map(x => [x.step.id, x.step.onLine]));
    expect(printed).toEqual({
      'depress-4': 'One that keeps you company, then one that lifts.',
      'depress-5': 'One album is about one walk.',
      'fight-3': 'Five songs is about twenty minutes.',
      'whatif-3': 'You know how this one ends.',
      'night-4': 'Screens wait for seven.',
    });
  });

  it('It was fine has exactly the two saved films, and Thunderbolts* is not anywhere', () => {
    const fine = seeded().find(x => x.step.id === 'whatif-5')!.step;
    expect(fine.picks!.map(p => [p.kind, p.title])).toEqual([['film', 'Wake Up Dead Man'], ['film', 'The Holdovers']]);
    expect(fine.onLine).toBeUndefined();
    expect(JSON.stringify(SEED_FLOWS)).not.toMatch(/Thunderbolts/);
  });

  it('the empty steps stay empty: Pulling in, Far away and all of Shame', () => {
    const empty = ['depress-2', 'shutdown-3', ...SEED_FLOWS.find(f => f.id === 'shame')!.steps.map(s => s.id)];
    const steps = SEED_FLOWS.flatMap(f => f.steps);
    for (const id of empty) {
      const s = steps.find(x => x.id === id)!;
      expect(s.picks, id).toBeUndefined();
      expect(s.tips.some(t => t.helper === 'on'), id).toBe(false);
    }
  });

  it('27 album placements on 10 steps, 27 lines on 10; counts match section 3', () => {
    const all = seeded().flatMap(x => x.step.picks!);
    expect(new Set(all.filter(p => p.kind === 'album').map(p => p.albumId)).size).toBe(27);
    expect(new Set(all.filter(p => p.kind !== 'album').map(p => p.title)).size).toBe(25);
    for (const p of all.filter(p => p.kind === 'album')) expect(albumUriOf(p)).toMatch(/^spotify:album:[A-Za-z0-9]{22}$/);
  });

  it('pick ids are unique on their step and never a tip id', () => {
    for (const { step } of seeded()) {
      const ids = step.picks!.map(p => p.id);
      expect(new Set(ids).size, step.id).toBe(ids.length);
      for (const id of ids) expect(step.tips.some(t => t.id === id)).toBe(false);
    }
  });

  it('no em dash, and a pick is a title and its kind (an album also its artist and id), nothing more', () => {
    expect(JSON.stringify(PICKS)).not.toMatch(/\u2014/);
    for (const p of PICKS.flatMap(x => x.picks)) expect(Object.keys(p).sort()).toEqual(p.kind === 'album' ? ['albumId', 'by', 'id', 'kind', 'title'] : ['id', 'kind', 'title']);
  });
});

describe('the guards', () => {
  it('the seed passes every guard', () => {
    expect(guard(SEED_FLOWS.flatMap(f => f.steps))).toEqual([]);
  });
  const base = () => structuredClone(seeded().find(x => x.step.id === 'panic-4')!.step);
  it('an unknown title fails', () => {
    const s = base();
    s.picks!.push({ id: 'pk-x', kind: 'film', title: 'Grave of the Fireflies' });
    expect(guard([s])).toEqual(['panic-4: more than three lines', 'pk-x: not in the fixture']);
  });
  it('a known title under the wrong kind or artist fails', () => {
    const s = base();
    s.picks = [{ ...s.picks![3], kind: 'film' }, { ...s.picks![0], by: 'Someone' }];
    expect(guard([s])).toHaveLength(2);
  });
  it('a pick with a note fails', () => {
    const s = base();
    (s.picks![3] as OnPick & { note?: string }).note = 'stress';
    expect(guard([s])).toEqual([`${s.picks![3].id}: a note`]);
  });
  it('a step over six rows, three covers or three lines fails', () => {
    const rows = base();
    rows.tips = [...rows.tips, ...['x1', 'x2', 'x3', 'x4'].map(id => ({ id, text: id }))];
    expect(guard([rows])).toEqual(['panic-4: more than six rows']);
    const cov = base();
    cov.picks = [...cov.picks!, cov.picks![0]];
    expect(guard([cov]).filter(m => m.includes('covers'))).toEqual(['panic-4: more than three covers']);
    const lin = base();
    lin.picks = [...lin.picks!, lin.picks![3]];
    expect(guard([lin]).filter(m => m.includes('lines'))).toEqual(['panic-4: more than three lines']);
  });
});

describe('a new journal', () => {
  beforeEach(async () => { await freshDB(); });
  it('has the picks from the seed, in its first revision, and the pass adds nothing', async () => {
    await ensureSeeded();
    const panic = (await flowById('panic'))!;
    expect(panic.steps[3].picks!.map(p => p.title)).toEqual(PICKS.find(p => p.stepId === 'panic-4')!.picks.map(p => p.title));
    expect(panic.revisions).toHaveLength(1);
    expect(await seedFlowsOnce()).toEqual([]);
    expect(await seedPicksOnce()).toEqual([]);
    for (const f of await store.all('flows')) expect(f.revisions, f.id).toHaveLength(1);
  });
});

describe('a journal that had the flows before the picks', () => {
  beforeEach(async () => { await freshDB(); });

  const NEW_ROWS = new Set(['energize-3-on', 'fight-3-on', 'whatif-3-on', 'whatif-5-on']);
  /** As main left it before P0: no new rows, no picks, no printed lines, the six ♪ rows still music and the five plain. */
  async function beforePicks() {
    await ensureSeeded();
    const music = new Set(['panic-1-album', 'panic-4-album', 'depress-4-music', 'energize-5-crash', 'fight-5-distract', 'shutdown-4-album']);
    for (const row of await store.all('flows')) {
      const steps: Step[] = row.steps.map(({ picks: _p, onLine: _l, ...s }) => ({
        ...s,
        tips: s.tips.filter(t => !NEW_ROWS.has(t.id)).map(t => {
          if (t.helper !== 'on') return t;
          const { helper: _h, ...plain } = t;
          return music.has(t.id) ? { ...t, helper: 'music' as const } : plain;
        }),
      }));
      await store.put('flows', { ...row, steps, revisions: [{ ...row.revisions[0], steps }] });
    }
    const s = (await store.get('settings', 'app'))!;
    await store.put('settings', { ...s, flowsSeeded: s.flowsSeeded!.filter(m => !m.startsWith('picks:') && !NEW_ROWS.has(m.slice(4))) });
  }
  const pass = async () => { await seedFlowsOnce(); return seedPicksOnce(); };

  it('gets every step its picks, the helper swap and the four new rows, once, as new revisions', async () => {
    await beforePicks();
    expect((await pass())!.sort()).toEqual(PICKS.map(p => p.stepId).sort());
    for (const p of PICKS) {
      const flow = (await store.all('flows')).find(f => f.steps.some(s => s.id === p.stepId))!;
      const step = flow.steps.find(s => s.id === p.stepId)!;
      expect(step.picks, p.stepId).toEqual(p.picks);
      expect(step.onLine).toBe(p.onLine);
      expect(step.tips.find(t => t.id === p.tipId)!.helper).toBe('on');
      expect(flow.revisions.at(-1)!.steps).toEqual(flow.steps);
    }
    const before = (await store.all('flows')).map(f => f.revisions.length);
    expect(await pass()).toEqual([]);
    expect((await store.all('flows')).map(f => f.revisions.length)).toEqual(before);
    // the new On row comes in its seed place: after the row before it in the seed
    const energize = (await flowById('energize'))!;
    expect(energize.steps[2].tips.map(t => t.id)).toEqual(['energize-3-timer', 'energize-3-park', 'energize-3-on']);
  });

  it('an On row he struck gets no picks; one he deleted gets none; one he gave another helper keeps it', async () => {
    await beforePicks();
    const panic = (await flowById('panic'))!;
    const steps = panic.steps.map(s => s.id === 'panic-4' ? { ...s, tips: s.tips.map(t => t.id === 'panic-4-album' ? { ...t, struck: true } : t) }
      : s.id === 'panic-1' ? { ...s, tips: s.tips.filter(t => t.id !== 'panic-1-album') } : s);
    await store.put('flows', { ...panic, steps });
    const depress = (await flowById('depress'))!;
    await store.put('flows', { ...depress, steps: depress.steps.map(s => s.id === 'depress-5'
      ? { ...s, tips: s.tips.map(t => t.id === 'depress-5-walk' ? { ...t, helper: 'ring' as const } : t) } : s) });
    const given = await pass();
    expect(given).not.toContain('panic-1');
    expect(given).not.toContain('panic-4');
    const after = (await flowById('panic'))!;
    expect(after.steps[0].picks).toBeUndefined();
    expect(after.steps[3].picks).toBeUndefined();
    expect(after.steps[3].tips.find(t => t.id === 'panic-4-album')).toMatchObject({ struck: true, helper: 'music' });
    expect((await flowById('depress'))!.steps[4].tips.find(t => t.id === 'depress-5-walk')!.helper).toBe('ring');
    // marked all the same: a later open never brings them back
    expect(await pass()).toEqual([]);
    expect((await flowById('panic'))!.steps[3].picks).toBeUndefined();
  });

  it('picks he wrote himself are never replaced, and a pick he struck stays struck', async () => {
    await beforePicks();
    const panic = (await flowById('panic'))!;
    const mine = [{ id: 'mine', kind: 'film' as const, title: 'Paddington 2' }];
    await store.put('flows', { ...panic, steps: panic.steps.map(s => s.id === 'panic-4' ? { ...s, picks: mine } : s) });
    await pass();
    expect((await flowById('panic'))!.steps[3].picks).toEqual(mine);
    // struck after the pass, then the marks lost (an old file's settings): the pass leaves the struck pick as it is
    const depress = (await flowById('depress'))!;
    await store.put('flows', { ...depress, steps: depress.steps.map(s => s.id === 'depress-4'
      ? { ...s, picks: s.picks!.map((p, i) => (i === 0 ? { ...p, struck: true } : p)) } : s) });
    const set = (await store.get('settings', 'app'))!;
    await store.put('settings', { ...set, flowsSeeded: set.flowsSeeded!.filter(m => !m.startsWith('picks:')) });
    await pass();
    expect((await flowById('depress'))!.steps[3].picks![0].struck).toBe(true);
  });

  it('a step he deleted gets nothing, and a locked journal waits', async () => {
    await beforePicks();
    const night = (await flowById('night'))!;
    await store.put('flows', { ...night, steps: night.steps.filter(s => s.id !== 'night-4') });
    await pass();
    expect((await flowById('night'))!.steps.some(s => s.id === 'night-4')).toBe(false);
    const salt = randomSalt();
    await setKey(await deriveKey('2468', salt, 1000), { salt, iterations: 1000 });
    lock();
    expect(await seedPicksOnce()).toBeNull();
  });
});

describe('backup, restore and the seal', () => {
  let db: FlowDB;
  beforeEach(async () => { db = await freshDB(); });

  it('a file carries the picks, the printed line and the episode\'s On, and brings them back', async () => {
    await ensureSeeded();
    await moveDot('panic', [], 'panic-4');
    const e = (await liveEpisode('panic'))!;
    await store.put('episodes', { ...e, on: { pickId: 'pk-panic-4-new-girl', title: 'New Girl', at: 5 } });
    const text = JSON.stringify(await exportData(db));
    const target = await freshDB();
    await importData(parseBackup(text), 'replace', target);
    const panic = (await flowById('panic'))!;
    expect(panic.steps[3].picks).toEqual(PICKS.find(p => p.stepId === 'panic-4')!.picks);
    expect((await flowById('depress'))!.steps[3].onLine).toBe('One that keeps you company, then one that lifts.');
    expect((await store.get('episodes', e.id))!.on).toEqual({ pickId: 'pk-panic-4-new-girl', title: 'New Girl', at: 5 });
  });

  it('with a PIN the titles and the printed line are sealed, the ids and times stay clear, and open again with the key', async () => {
    await ensureSeeded();
    await moveDot('panic', [], 'panic-4');
    const e = (await liveEpisode('panic'))!;
    await store.put('episodes', { ...e, on: { pickId: 'pk-panic-4-new-girl', title: 'New Girl', at: 5 } });
    const salt = randomSalt();
    const key = await deriveKey('2468', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    const file = JSON.stringify(await exportData(db));
    expect(file).not.toMatch(/New Girl|Lonesome Dreams|keeps you company/);
    const raw = JSON.parse(file).tables.episodes.find((r: { id: string }) => r.id === e.id);
    expect(raw.on).toEqual({ pickId: 'pk-panic-4-new-girl', title: '', at: 5 });
    expect((await store.get('episodes', e.id))!.on!.title).toBe('New Girl');
    expect((await flowById('panic'))!.steps[3].picks![3].title).toBe('New Girl');
  });
});
