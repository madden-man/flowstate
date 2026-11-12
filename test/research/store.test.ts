// Research's rows (PLAN-RESEARCH.md section 5, Q2): every store function; the question, its runs and the keys sealed at
// rest once a PIN is set and whole after unlock, the papers clear; setKey re-encrypts the questions already asked; a
// backup carries both tables and the sealed key; a locked journal reads nothing and writes nothing.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import type { FlowDB } from '../../src/db/schema';
import { store, setKey, lock, unlock, init, LockedError } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { ensureSeeded } from '../../src/db/seed';
import { exportData, importData, parseBackup } from '../../src/db/backup';
import {
  listInquiries, getInquiry, putInquiry, deleteInquiry, putPapers, getPapers, researchKey, saveResearchKey, removeResearchKey, researchVersion,
} from '../../src/research/store';
import type { Inquiry, Paper, RunSnapshot } from '../../src/research/types';

const FAST = 1000;
let db: FlowDB;
beforeEach(async () => { db = await freshDB(); await ensureSeeded(7); });

const QUESTION = 'Does cold water swimming lift low mood?';
const paper = (id: string, title: string): Paper => ({
  id, title, abstract: [{ head: 'Background', text: `${title}, the abstract.` }], journal: 'BMJ Case Reports', year: 2018,
  kind: 'Journal article', tier: 1, url: `https://doi.org/${id.slice(4)}`, source: 'europepmc', fetchedAt: 100,
});
const runs = (): RunSnapshot => ({
  for: { messages: [{ role: 'user', content: QUESTION }], turns: 1, searches: 1, filed: [], done: false },
  against: { messages: [{ role: 'user', content: QUESTION }], turns: 0, searches: 0, filed: [], done: false },
  known: {},
});
const inquiry = (id: string, askedAt: number, extra: Partial<Inquiry> = {}): Inquiry => ({
  id, askedAt, question: QUESTION, state: 'done', picks: [{ paperId: 'doi:10.1136/bcr-2018-225007', side: 'for', tier: 1 }], ...extra,
});
const pin = async () => {
  const salt = randomSalt();
  const key = await deriveKey('2580', salt, FAST);
  await setKey(key, { salt, iterations: FAST });
  return key;
};
const raw = async () => JSON.stringify(await Promise.all(db.tables.map(t => t.toArray())));

describe('the store (Q2)', () => {
  it('lists newest first, gets one, writes one again, and deletes with a tombstone', async () => {
    await putInquiry(inquiry('q1', 1000));
    await putInquiry(inquiry('q2', 3000, { question: 'Is a cold plunge safe for the heart?' }));
    await putInquiry(inquiry('q3', 2000));
    expect((await listInquiries()).map(q => q.id)).toEqual(['q2', 'q3', 'q1']);
    expect(await getInquiry('q2')).toMatchObject({ question: 'Is a cold plunge safe for the heart?', state: 'done' });
    expect(await getInquiry('nope')).toBeUndefined();
    await putInquiry({ ...inquiry('q1', 1000), state: 'stopped' });
    expect((await getInquiry('q1'))!.state).toBe('stopped');
    await deleteInquiry('q3');
    expect(await getInquiry('q3')).toBeUndefined();
    expect((await db.settings.get('app'))!.deleted).toContain('q3');
  });

  it('keeps papers by id, a later fetch replacing the row, and gives them back in the order asked, missing ones left out', async () => {
    const a = paper('doi:10.1136/bcr-2018-225007', 'Open water swimming as a treatment for major depressive disorder');
    const b = paper('doi:10.3390/ijerph18010003', 'Cold water swimming and mental health');
    await putPapers([a, b]);
    await putPapers([{ ...a, fetchedAt: 200 }]);
    expect(await db.papers.count()).toBe(2);
    expect(await getPapers([b.id, 'doi:none', a.id])).toEqual([b, { ...a, fetchedAt: 200 }]);
    expect(await getPapers([])).toEqual([]);
  });

  it('saves the key trimmed, refuses a blank one, keeps the rest of settings, and removes it', async () => {
    expect(await researchKey()).toBeUndefined();
    await store.put('settings', { ...(await store.get('settings', 'app'))!, spotify: { connectedAt: 3, tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 9 } } });
    await expect(saveResearchKey('   ')).rejects.toThrow();
    await saveResearchKey('  sk-ant-api03-abcd1234  ', ' ');
    expect(await researchKey()).toEqual({ key: 'sk-ant-api03-abcd1234' });
    await saveResearchKey('sk-ant-api03-wxyz', 'oa-key-9876');
    expect(await researchKey()).toEqual({ key: 'sk-ant-api03-wxyz', openAlexKey: 'oa-key-9876' });
    expect((await store.get('settings', 'app'))!.spotify?.tokens?.refreshToken).toBe('R');
    await removeResearchKey();
    expect(await researchKey()).toBeUndefined();
    expect((await store.get('settings', 'app'))!.spotify?.tokens?.refreshToken).toBe('R');
  });

  it('bumps researchVersion on every write', async () => {
    const v = researchVersion.value;
    await putInquiry(inquiry('q1', 1));
    await putPapers([paper('doi:x', 'X')]);
    await saveResearchKey('k');
    await removeResearchKey();
    await deleteInquiry('q1');
    expect(researchVersion.value).toBe(v + 5);
  });
});

describe('sealing (Q2)', () => {
  it('with a PIN set, the question, the runs and the keys are sealed at rest and whole after unlock; papers stay clear', async () => {
    const title = 'Open water swimming as a treatment for major depressive disorder';
    await putPapers([paper('doi:10.1136/bcr-2018-225007', title)]);
    // asked before the PIN: setKey re-encrypts it in place
    await putInquiry(inquiry('q1', 1000, { state: 'running', runs: runs() }));
    await saveResearchKey('sk-ant-api03-SECRETKEY', 'OPENALEX-SECRET');
    const key = await pin();
    await putInquiry(inquiry('q2', 2000, { question: 'Is a sauna good for sleep?' }));
    const at = await raw();
    for (const s of [QUESTION, 'Is a sauna good for sleep?', 'SECRETKEY', 'OPENALEX-SECRET']) expect(at).not.toContain(s);
    expect(at).toContain(title);
    const stored = (await db.inquiries.get('q1'))!;
    expect(stored.question).toBe('');
    expect(stored).not.toHaveProperty('runs');
    expect((stored as { sealed?: unknown }).sealed).toBeTruthy();
    expect(stored.picks).toEqual(inquiry('q1', 0).picks);
    expect((await db.settings.get('app'))!).not.toHaveProperty('research');
    expect(await getInquiry('q1')).toEqual(inquiry('q1', 1000, { state: 'running', runs: runs() }));
    expect(await researchKey()).toEqual({ key: 'sk-ant-api03-SECRETKEY', openAlexKey: 'OPENALEX-SECRET' });

    // locked: nothing to read, nothing written; the papers still read
    lock();
    expect(await listInquiries()).toEqual([]);
    expect(await getInquiry('q1')).toBeUndefined();
    expect(await researchKey()).toBeUndefined();
    expect(await getPapers(['doi:10.1136/bcr-2018-225007'])).toHaveLength(1);
    await expect(putInquiry(inquiry('q3', 3))).rejects.toBeInstanceOf(LockedError);
    await expect(saveResearchKey('k')).rejects.toBeInstanceOf(LockedError);
    await expect(removeResearchKey()).rejects.toBeInstanceOf(LockedError);
    await expect(deleteInquiry('q1')).rejects.toBeInstanceOf(LockedError);

    expect(await unlock(key)).toBe(true);
    expect((await listInquiries()).map(q => q.question)).toEqual(['Is a sauna good for sleep?', QUESTION]);
  });

  it('a settings row sealed before Research (the tokens alone) still opens, and takes a key beside them', async () => {
    await store.put('settings', { ...(await store.get('settings', 'app'))!, spotify: { connectedAt: 3, tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 9 } } });
    await pin();
    expect((await store.get('settings', 'app'))!.spotify?.tokens?.accessToken).toBe('A');
    await saveResearchKey('sk-1234');
    const s = (await store.get('settings', 'app'))!;
    expect(s.spotify?.tokens?.accessToken).toBe('A');
    expect(s.research).toEqual({ key: 'sk-1234' });
  });
});

describe('backup (Q2)', () => {
  it('both tables and the sealed key travel through a file and open with its PIN', async () => {
    const p = paper('doi:10.1136/bcr-2018-225007', 'Open water swimming as a treatment for major depressive disorder');
    await putPapers([p]);
    await putInquiry(inquiry('q1', 1000));
    await saveResearchKey('sk-ant-api03-SECRETKEY');
    // plain
    const plain = parseBackup(JSON.stringify(await exportData(db, 1000)));
    expect(plain.tables.inquiries).toHaveLength(1);
    expect(plain.tables.papers).toEqual([p]);
    const other = await freshDB();
    await importData(plain, 'replace', other);
    expect(await other.inquiries.get('q1')).toEqual(inquiry('q1', 1000));
    expect((await other.settings.get('app'))!.research).toEqual({ key: 'sk-ant-api03-SECRETKEY' });

    // sealed
    await init(db);
    await pin();
    const sealed = parseBackup(JSON.stringify(await exportData(db, 2000)));
    expect(sealed.encrypted).toBe(true);
    const text = JSON.stringify(sealed);
    expect(text).not.toContain('SECRETKEY');
    expect(text).not.toContain(QUESTION);
    expect(text).toContain(p.title);
    const fourth = await freshDB();
    await importData(sealed, 'replace', fourth, await deriveKey('2580', sealed.salt!, sealed.iterations!));
    expect(await fourth.inquiries.get('q1')).toEqual(inquiry('q1', 1000));
    expect(await fourth.papers.toArray()).toEqual([p]);
    expect((await fourth.settings.get('app'))!.research).toEqual({ key: 'sk-ant-api03-SECRETKEY' });
  });

  it('a version 8 file (no inquiries, no papers) imports with both tables empty', async () => {
    const f = await exportData(db, 1000);
    const v8 = { ...f, schemaVersion: 8, tables: { ...f.tables, inquiries: undefined, papers: undefined } };
    const parsed = parseBackup(JSON.stringify(v8));
    expect(parsed.tables.inquiries).toEqual([]);
    expect(parsed.tables.papers).toEqual([]);
    const other = await freshDB();
    await importData(parsed, 'replace', other);
    expect(await other.inquiries.count()).toBe(0);
  });

  it('a merge keeps the newer question by when it was asked, and the newer paper by when it was fetched', async () => {
    await putInquiry(inquiry('q1', 5000, { state: 'stopped' }));
    await putPapers([{ ...paper('doi:a', 'A'), fetchedAt: 900 }]);
    const file = parseBackup(JSON.stringify(await exportData(db, 1000)));
    const other = await freshDB();
    await ensureSeeded(7);
    await putInquiry(inquiry('q1', 1000));
    await putPapers([{ ...paper('doi:a', 'A'), fetchedAt: 100 }]);
    await importData(file, 'merge', other);
    expect((await other.inquiries.get('q1'))!.state).toBe('stopped');
    expect((await other.papers.get('doi:a'))!.fetchedAt).toBe(900);
  });
});
