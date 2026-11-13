// Q4's run controller (src/research/run.ts), off the page: a recorded run's every turn written through the store with
// its paper rows; the lines a snapshot holds; ask again keeping the old picks under earlier; and a finished question,
// its papers and a carried line surviving a backup's round trip (schema 9).
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import type { FlowDB } from '../../src/db/schema';
import { exportData, importData } from '../../src/db/backup';
import { ask, askAgain, linesOfSnapshot, live, setRunDeps, startRun } from '../../src/research/run';
import { getInquiry, getPapers, listInquiries, putInquiry, saveResearchKey } from '../../src/research/store';
import { search } from '../../src/research/indexes';
import { writeAboutPaper } from '../../src/model/into';
import { messagesOf, today } from '../../src/model/pages';
import { indexFetch, loadRun, player } from './recorded';

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); await ensureSeeded(7); live.value = {}; });
afterEach(() => setRunDeps({}));

async function recorded(name: string) {
  const run = loadRun(name);
  const p = player(run);
  setRunDeps({ makePort: () => ({ create: async params => p.next(params) as never }), search: (a, o) => search(a, { ...o, fetch: indexFetch(run) }) });
  await saveResearchKey('sk-ant-test-0000');
  const q = await ask(run.question);
  return { run, q };
}

describe('the run controller', () => {
  it('runs to done, keeps each filed paper, and leaves no runs or model text on the row', async () => {
    const { q } = await recorded('writing');
    await startRun(q);
    const row = (await getInquiry(q.id))!;
    expect(row.state).toBe('done');
    expect(row.runs).toBeUndefined();
    expect(row.picks.map(p => p.paperId).sort()).toEqual([
      'doi:10.1016/j.actpsy.2026.107843', 'doi:10.1037/1528-3542.8.2.302', 'doi:10.1111/famp.70206', 'doi:10.1177/13591053261499814',
    ]);
    // every filed paper is kept, the lifted one too (one row a paper, whatever cites it)
    expect((await getPapers(['doi:10.1111/acer.70412', 'doi:10.1111/famp.70206'])).map(p => p.id)).toEqual(['doi:10.1111/acer.70412', 'doi:10.1111/famp.70206']);
    expect(JSON.stringify(row)).not.toMatch(/NEVER-SHOWN/);
    expect(live.value[q.id].on).toBe(false);
    expect(live.value[q.id].lines.filter(l => l.lifted).map(l => l.paperId)).toEqual(['doi:10.1111/acer.70412']);
  });

  it('with no key, sends nothing and leaves the question running', async () => {
    const run = loadRun('writing');
    let made = 0;
    setRunDeps({ makePort: () => { made++; return { create: async () => { throw new Error('no'); } }; } });
    const q = await ask(run.question);
    await startRun(q);
    expect(made).toBe(0);
    expect((await getInquiry(q.id))!.state).toBe('running');
    expect(live.value[q.id]).toBeUndefined();
  });

  it('reads a snapshot\'s lines in found order with the rulings laid on', () => {
    const paper = (id: string) => ({ id, title: id, abstract: [], kind: 'Review', tier: 1 as const, url: '', source: 'europepmc' as const, fetchedAt: 0 });
    const t = (filed: { paperId: string; seq: number }[], side: 'for' | 'against') => ({ messages: [], turns: 1, searches: 1, done: false, filed: filed.map(f => ({ ...f, side, tier: 1 as const })) });
    const lines = linesOfSnapshot({
      for: t([{ paperId: 'a', seq: 0 }, { paperId: 'c', seq: 3 }], 'for'),
      against: t([{ paperId: 'b', seq: 1 }, { paperId: 'a', seq: 2 }], 'against'),
      known: { a: paper('a'), b: paper('b'), c: paper('c') },
      ruled: { a: 'against', c: 'neither' },
    });
    expect(lines.map(l => [l.paperId, l.side])).toEqual([['a', 'against'], ['b', 'against']]);
  });

  it('ask again keeps the old picks under earlier and runs fresh', async () => {
    const { q } = await recorded('writing');
    await startRun(q);
    const again = (await askAgain(q.id))!;
    expect(again.state).toBe('running');
    expect(again.picks).toEqual([]);
    expect(again.earlier).toHaveLength(1);
    expect(again.earlier![0].picks).toHaveLength(4);
  });

  it('a question, its papers and a carried line come back whole through a backup', async () => {
    const { q } = await recorded('writing');
    await startRun(q);
    const [paper] = await getPapers(['doi:10.1111/famp.70206']);
    await writeAboutPaper(q.id, paper, 'for');
    const file = await exportData(db);
    const other = await freshDB();
    await importData(JSON.parse(JSON.stringify(file)), 'replace', other);
    const back = await listInquiries();
    expect(back.map(r => [r.question, r.state, r.picks.length])).toEqual([[q.question, 'done', 4]]);
    expect((await getPapers(['doi:10.1111/famp.70206']))[0].title).toBe(paper.title);
    const t = await today();
    expect(t.page!.research).toEqual({ inquiryId: q.id });
    expect((await messagesOf(t.page!.id)).at(-1)!.paper).toEqual({ paperId: paper.id, side: 'for' });
  });

  it('a stored running question with runs is a resume: startRun takes its snapshot', async () => {
    const { q } = await recorded('writing');
    const snap = { for: { messages: [{ role: 'user', content: 'x' }], turns: 12, searches: 0, filed: [], done: true }, against: { messages: [{ role: 'user', content: 'x' }], turns: 12, searches: 0, filed: [], done: true }, known: {} };
    await putInquiry({ ...q, runs: snap });
    await startRun((await getInquiry(q.id))!);
    expect((await getInquiry(q.id))!.state).toBe('done');
    expect((await getInquiry(q.id))!.picks).toEqual([]);
  });
});
