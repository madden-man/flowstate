// Down (PLAN-WORLDS.md section 5, W2): voices from the bible's characters (renamed there is renamed here, deleted there
// is archived here), question pages from its open questions (decided there, answered here with the decision as the wise
// line), and none of it echoed into the outbox.
import { describe, it, expect, beforeEach } from 'vitest';
import { store, type Handed } from '../../src/db/fields';
import type { FlowDB } from '../../src/db/schema';
import { applyPocket, characterVoiceId, decisionLineId } from '../../src/bridge/down';
import { hueOf } from '../../src/bridge/colour';
import type { NovelPocket } from '../../src/bridge/protocol';
import { worldDB, settled } from './helpers';

let db: FlowDB;
let h: Handed;
beforeEach(async () => { ({ db, h } = await worldDB()); });

const pocket = (o: Partial<NovelPocket> = {}): NovelPocket => ({
  kind: 'novel', places: [], chapters: [], events: [], storyYear: 2071, span: { from: 2040, to: 2090 },
  characters: [
    { id: 'dawn', fullName: 'Dawn Li', firstName: 'Dawn', familyColour: '#d04040', born: 2062 },
    { id: 'wei', fullName: 'Wei Chen', firstName: 'Wei', familyColour: '#3060d0', born: 2030, died: 2075 },
  ],
  questions: [{ id: 'q1', question: 'Does the river freeze?', state: 'open', changedAt: 10 }],
  ...o,
});

describe('voices from characters', () => {
  it('one voice a character: c:<id>, the full name, the first name given, the family colour\'s hue, light, no twin', async () => {
    await applyPocket(h, pocket());
    const v = (await store.get('voices', characterVoiceId('dawn')))!;
    expect(v).toMatchObject({ id: 'c:dawn', name: 'Dawn Li', given: 'Dawn', shade: 'light', archived: false, colour: { hue: hueOf('#d04040') } });
    expect(v.twinId).toBeUndefined();
    expect(await db.voices.count()).toBe(2);
  });
  it('renamed in the bible is renamed here, the old name kept as a revision; applied twice, nothing more changes', async () => {
    await applyPocket(h, pocket());
    await applyPocket(h, pocket({ characters: [{ id: 'dawn', fullName: 'Dawn Li-Hart', firstName: 'Dawn', familyColour: '#d04040' }, pocket().characters[1]] }), 99);
    const v = (await store.get('voices', 'c:dawn'))!;
    expect(v.name).toBe('Dawn Li-Hart');
    expect(v.revisions).toEqual([{ at: 99, name: 'Dawn Li', given: 'Dawn', aka: [], colour: { hue: hueOf('#d04040') } }]);
    await applyPocket(h, pocket({ characters: [{ id: 'dawn', fullName: 'Dawn Li-Hart', firstName: 'Dawn', familyColour: '#d04040' }, pocket().characters[1]] }), 120);
    expect((await store.get('voices', 'c:dawn'))!.revisions).toHaveLength(1);
  });
  it('deleted in the bible is archived here, so old councils still read; back in the bible, back here', async () => {
    await applyPocket(h, pocket());
    await applyPocket(h, pocket({ characters: [pocket().characters[0]] }));
    expect((await store.get('voices', 'c:wei'))!).toMatchObject({ archived: true, name: 'Wei Chen' });
    await applyPocket(h, pocket());
    expect((await store.get('voices', 'c:wei'))!.archived).toBe(false);
  });
  it('a voice of his own in the world is never touched', async () => {
    await store.put('voices', { id: 'mine', name: 'Narrator', aka: [], colour: { hue: 200 }, shade: 'light', starred: false, order: 0, archived: false, revisions: [] });
    await applyPocket(h, pocket({ characters: [] }));
    expect((await store.get('voices', 'mine'))!.archived).toBe(false);
  });
  it('a grey or missing family colour speaks as the Black voice', () => {
    expect(hueOf('#808080')).toBeNull();
    expect(hueOf(undefined)).toBeNull();
    expect(hueOf('red')).toBeNull();
    expect(hueOf('#ff0000')).toBe(29);
    expect(hueOf('0000ff')).toBe(264);
  });
});

describe('questions from the bible', () => {
  it('one question page an open question, its id the question\'s', async () => {
    await applyPocket(h, pocket());
    expect(await store.get('pages', 'q1')).toMatchObject({ id: 'q1', kind: 'question', title: 'Does the river freeze?', state: 'open' });
  });
  it('decided in the bible: the page moves under Answered with the decision as its wise line', async () => {
    await applyPocket(h, pocket());
    await applyPocket(h, pocket({ questions: [{ id: 'q1', question: 'Does the river freeze?', state: 'decided', decision: 'Only at the edges', changedAt: 20 }] }));
    expect(await store.get('pages', 'q1')).toMatchObject({ state: 'answered', answeredAt: 20 });
    expect(await store.get('messages', decisionLineId('q1'))).toMatchObject({ pageId: 'q1', text: 'Only at the edges', wise: true, kept: false });
    // the decision reworded there is reworded here, still one line
    await applyPocket(h, pocket({ questions: [{ id: 'q1', question: 'Does the river freeze?', state: 'decided', decision: 'Only the edges, in a hard year', changedAt: 30 }] }));
    expect((await store.get('messages', 'd:q1'))!.text).toBe('Only the edges, in a hard year');
    expect(await db.messages.count()).toBe(1);
  });
  it('a question reworded in the bible is reworded here; one he answered on the phone since is not reopened by an older pocket', async () => {
    await applyPocket(h, pocket());
    await store.put('pages', { ...(await store.get('pages', 'q1'))!, state: 'answered', answeredAt: 30, updatedAt: 30 });
    await applyPocket(h, pocket({ questions: [{ id: 'q1', question: 'Will the river freeze?', state: 'open', changedAt: 25 }] }));
    expect(await store.get('pages', 'q1')).toMatchObject({ title: 'Will the river freeze?', state: 'answered' });
  });
  it('nothing that came down enters the outbox', async () => {
    await applyPocket(h, pocket({ questions: [{ id: 'q1', question: 'Q', state: 'decided', decision: 'D', changedAt: 1 }] }));
    await settled();
    expect(await db.outbox.count()).toBe(0);
  });
  it('a Songbook pocket writes nothing (W6 reads its songs from the pocket)', async () => {
    await applyPocket(h, { kind: 'songs', songs: [{ id: 's1', title: 'Low tide' }] });
    expect(await db.pages.count() + await db.voices.count()).toBe(0);
  });
});

describe('a bible decision taken back on the phone (review of W4, finding 1)', () => {
  const decided = (changedAt: number) => pocket({ questions: [{ id: 'q1', question: 'Does the river freeze?', state: 'decided', decision: 'Only at the edges', changedAt }] });
  const opened = (changedAt: number) => pocket({ questions: [{ id: 'q1', question: 'Does the river freeze?', state: 'open', changedAt }] });
  const outbox = async () => (await db.outbox.toArray()).map(o => `${o.table} ${o.id}`);

  it('the d: line never goes up; the page goes up open; a stale pocket leaves it open; a fresh one opens or decides again', async () => {
    const { answerWith } = await import('../../src/model/pages');
    const { readBatch } = await import('../../src/bridge/up');
    await applyPocket(h, decided(1_000));
    const d = (await store.get('messages', 'd:q1'))!;
    // taken back on the phone ("Not the answer" on the bible's own line)
    await answerWith((await store.get('pages', 'q1'))!, d, false, 2_000);
    await settled();
    expect(await outbox()).toEqual(['pages q1']);
    const b = (await readBatch(h, 'eastwinds'))!;
    expect(b.envelopes.map(e => `${e.table} ${e.id}`)).toEqual(['pages q1']);
    expect(b.envelopes[0].row).toMatchObject({ state: 'open' });
    // the next pocket is stale (still decided, changed before he took it back): it undoes nothing
    await applyPocket(h, decided(1_000), 3_000);
    expect(await store.get('pages', 'q1')).toMatchObject({ state: 'open' });
    expect((await store.get('messages', 'd:q1'))!.wise).toBeUndefined();
    // the bible took the reopening: open, later
    await applyPocket(h, opened(4_000), 4_100);
    expect(await store.get('pages', 'q1')).toMatchObject({ state: 'open' });
    // decided there again, later still: answered here, and the d: line is wise again
    await applyPocket(h, decided(5_000), 5_100);
    expect(await store.get('pages', 'q1')).toMatchObject({ state: 'answered', answeredAt: 5_000 });
    expect(await store.get('messages', 'd:q1')).toMatchObject({ wise: true, text: 'Only at the edges' });
    // and the bible reopening a question it had decided reopens it here, the d: line no longer wise
    await applyPocket(h, opened(6_000), 6_100);
    expect(await store.get('pages', 'q1')).toMatchObject({ state: 'open' });
    expect((await store.get('pages', 'q1'))!.answeredAt).toBeUndefined();
    expect((await store.get('messages', 'd:q1'))!.wise).toBeUndefined();
    // none of that went back up: only the page he reopened is in the outbox
    await settled();
    expect(await outbox()).toEqual(['pages q1']);
  });

  it('a d: line written on the phone (edited, kept, made wise) never enters the outbox', async () => {
    const { answerWith, setKept } = await import('../../src/model/pages');
    await applyPocket(h, decided(1_000));
    await db.outbox.clear();
    const d = (await store.get('messages', 'd:q1'))!;
    await setKept(d, true);
    await answerWith((await store.get('pages', 'q1'))!, (await store.get('messages', 'd:q1'))!, true, 2_000);
    await settled();
    expect((await db.outbox.toArray()).some(o => o.id === 'd:q1')).toBe(false);
  });
});
