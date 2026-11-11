// PLAN-VALUES.md section 7, the unit part for C1: values, champions from both sides, whys, speaking for, the record,
// delete against a merge import, and a council called on a value.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import type { FlowDB } from '../../src/db/schema';
import { ensureSeeded } from '../../src/db/seed';
import { store } from '../../src/db/fields';
import { exportData, importData, parseBackup } from '../../src/db/backup';
import { archiveVoice, newCouncil, speak } from '../../src/model/council';
import {
  held, resting, createValue, saveValue, moveValue, deleteValue, champion, unchampion, setWhy, fightsFor, byVoice,
  saidFor, speakFor, callCouncil, championsOf, NoWordError,
} from '../../src/model/values';

const SELFLESS = 'value-px-selfless-selfish';
const THOUGHTFUL = 'value-px-thoughtful-reactive';
const DAY = 86_400_000;
const T0 = new Date(2026, 10, 11, 9).getTime();

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); await ensureSeeded(T0); });

describe('the lists', () => {
  it('held in his order, resting apart; a new value goes after the placed ones; a drag holds', async () => {
    expect((await held()).map(v => v.word)).toEqual(['selfless', 'thoughtful']);
    const honest = await createValue({ word: ' honesty ', shadow: 'tact', looks: '' }, T0);
    expect(honest).toMatchObject({ word: 'honesty', shadow: 'tact', status: 'held', champions: [], revisions: [] });
    expect(honest.looks).toBeUndefined();
    await expect(createValue({ word: '  ' })).rejects.toBeInstanceOf(NoWordError);
    expect((await held()).map(v => v.word)).toEqual(['selfless', 'thoughtful', 'honesty']);
    await moveValue((await held()).map(v => v.id), honest.id, 0, T0 + 1);
    expect((await held()).map(v => v.word)).toEqual(['honesty', 'selfless', 'thoughtful']);
    await saveValue({ id: THOUGHTFUL }, { word: 'thoughtful', shadow: 'reactive' }, 'resting', T0 + 2);
    expect((await held()).map(v => v.word)).toEqual(['honesty', 'selfless']);
    expect((await resting()).map(v => v.word)).toEqual(['thoughtful']);
  });
});

describe('saveValue', () => {
  it('keeps the old word and shadow once per later day; the same day and looks are written over', async () => {
    const v = await createValue({ word: 'patient', shadow: 'urgent' }, T0);
    await saveValue(v, { word: 'patience', shadow: 'urgent', looks: 'waiting a beat' }, undefined, T0 + 1000);
    expect((await store.get('values', v.id))!.revisions).toEqual([]);
    await saveValue(v, { word: 'patient', shadow: 'urgency', looks: 'a breath first' }, undefined, T0 + DAY);
    await saveValue(v, { word: 'patient', shadow: 'urgent', looks: 'a breath first' }, undefined, T0 + DAY + 1);
    const after = (await store.get('values', v.id))!;
    expect(after).toMatchObject({ word: 'patient', shadow: 'urgent', looks: 'a breath first', updatedAt: T0 + DAY + 1 });
    expect(after.revisions).toEqual([{ at: T0 + DAY, word: 'patience', shadow: 'urgent' }]);
    // an emptied shadow is taken away
    await saveValue(v, { word: 'patient', looks: 'a breath first' }, undefined, T0 + DAY + 2);
    expect((await store.get('values', v.id))!.shadow).toBeUndefined();
  });

  it('a why is kept across a word edit', async () => {
    await champion(SELFLESS, 'v-warrior', 'value', T0);
    await setWhy(SELFLESS, 'v-warrior', 'value', ' I stand up for the others ', T0);
    const stale = (await store.get('values', SELFLESS))!;
    await saveValue(stale, { word: 'generous', shadow: 'selfish', looks: stale.looks }, undefined, T0 + DAY);
    const v = (await store.get('values', SELFLESS))!;
    expect(v.word).toBe('generous');
    expect(v.champions).toEqual([{ voiceId: 'v-warrior', side: 'value', at: T0, why: 'I stand up for the others' }]);
    await setWhy(SELFLESS, 'v-warrior', 'value', '', T0 + DAY);
    expect((await store.get('values', SELFLESS))!.champions[0].why).toBeUndefined();
  });
});

describe('champions', () => {
  it('from both sides: a voice may champion a value and its shadow, once each; unchampion leaves the other side', async () => {
    await champion(SELFLESS, 'v-mystic', 'value', T0);
    await champion(SELFLESS, 'v-mystic', 'value', T0 + 5);
    await champion(SELFLESS, 'v-mystic', 'shadow', T0 + 1);
    await champion(SELFLESS, 'v-architect', 'shadow', T0 + 2);
    await champion(THOUGHTFUL, 'v-mystic', 'value', T0 + 3);
    let v = (await store.get('values', SELFLESS))!;
    expect(v.champions.map(c => [c.voiceId, c.side])).toEqual([['v-mystic', 'value'], ['v-mystic', 'shadow'], ['v-architect', 'shadow']]);
    // seen from the voice
    expect((await fightsFor('v-mystic')).map(f => [f.value.word, f.side])).toEqual([['selfless', 'value'], ['selfless', 'shadow'], ['thoughtful', 'value']]);
    await unchampion(SELFLESS, 'v-mystic', 'value', T0 + 4);
    v = (await store.get('values', SELFLESS))!;
    expect(v.champions.map(c => [c.voiceId, c.side])).toEqual([['v-mystic', 'shadow'], ['v-architect', 'shadow']]);
    expect((await fightsFor('v-mystic')).map(f => [f.value.word, f.side])).toEqual([['selfless', 'shadow'], ['thoughtful', 'value']]);
    await expect(champion(SELFLESS, 'v-nobody', 'value')).rejects.toThrow('No such voice');
  });

  it('fightsFor and byVoice leave an archived voice out and keep its links; restored, it is a champion again', async () => {
    await champion(SELFLESS, 'v-joker', 'shadow', T0);
    await champion(SELFLESS, 'v-warrior', 'value', T0 + 1);
    await champion(SELFLESS, 'v-skeptic', 'value', T0 + 2);
    await archiveVoice('v-joker');
    expect(await fightsFor('v-joker')).toEqual([]);
    const rows = await byVoice();
    expect(rows.map(r => r.voice.id)).not.toContain('v-joker');
    // chip order: the starred four first
    expect(rows.slice(0, 4).map(r => r.voice.name)).toEqual(['Skeptic', 'Mystic', 'Warrior', 'Architect']);
    expect(rows.find(r => r.voice.id === 'v-warrior')!.fights.map(f => [f.value.word, f.side])).toEqual([['selfless', 'value']]);
    expect(rows.find(r => r.voice.id === 'v-mystic')!.fights).toEqual([]);
    const v = (await store.get('values', SELFLESS))!;
    expect(v.champions.map(c => c.voiceId)).toContain('v-joker');
    const vs = await store.all('voices');
    expect(championsOf(v, vs, 'value').map(d => d.voice.id)).toEqual(['v-warrior', 'v-skeptic']);
    expect(championsOf(v, vs, 'shadow')).toEqual([]);
    await archiveVoice('v-joker', false);
    expect((await fightsFor('v-joker')).map(f => f.side)).toEqual(['shadow']);
    // a resting value is not fought for on the lists
    await saveValue(v, { word: v.word, shadow: v.shadow, looks: v.looks }, 'resting', T0 + 3);
    expect(await fightsFor('v-joker')).toEqual([]);
  });
});

describe('speaking for', () => {
  it('a line is born with no label; speakFor sets and clears it, and saidFor reads both sides newest first', async () => {
    const page = await newCouncil({ now: T0 });
    const a = await speak(page.id, 'I will give the evening away.', { voiceId: 'v-warrior', now: T0 + 1 });
    const b = await speak(page.id, 'And keep the morning.', { voiceId: 'v-architect', now: T0 + 2 });
    const c = await speak(page.id, 'Plain ink.', { now: T0 + 3 });
    expect(a.for).toBeUndefined();
    await speakFor(a.id, { valueId: SELFLESS, side: 'value' }, T0 + 10);
    await speakFor(b.id, { valueId: SELFLESS, side: 'shadow' }, T0 + 11);
    expect((await store.get('messages', a.id))!).toMatchObject({ for: { valueId: SELFLESS, side: 'value' }, updatedAt: T0 + 10, text: 'I will give the evening away.' });
    const said = await saidFor(SELFLESS, 10);
    expect(said.map(s => [s.message.text, s.side, s.pageId, s.kind])).toEqual([
      ['And keep the morning.', 'shadow', page.id, 'council'],
      ['I will give the evening away.', 'value', page.id, 'council'],
    ]);
    expect(await saidFor(SELFLESS, 1)).toHaveLength(1);
    expect(await saidFor(THOUGHTFUL, 10)).toEqual([]);
    await speakFor(b.id, undefined, T0 + 12);
    expect((await store.get('messages', b.id))!.for).toBeUndefined();
    expect((await saidFor(SELFLESS, 10)).map(s => s.message.id)).toEqual([a.id]);
    expect((await store.get('messages', c.id))!.for).toBeUndefined();
    await expect(speakFor(a.id, { valueId: 'nope', side: 'value' })).rejects.toThrow('No such value');
  });
});

describe('deleteValue', () => {
  it('drops the row, the labels and the council link in one go; a merge of an older backup brings none of it back', async () => {
    const council = await callCouncil(SELFLESS, T0);
    const m = await speak(council.id, 'For the others.', { voiceId: 'v-warrior', now: T0 + 1 });
    await speakFor(m.id, { valueId: SELFLESS, side: 'value' }, T0 + 2);
    const older = parseBackup(JSON.stringify(await exportData(db, T0 + 3)));

    await deleteValue(SELFLESS, T0 + 4);
    expect(await store.get('values', SELFLESS)).toBeUndefined();
    const line = (await store.get('messages', m.id))!;
    expect(line.text).toBe('For the others.');
    expect(line.for).toBeUndefined();
    expect((await store.get('pages', council.id))!.valueIds).toBeUndefined();
    expect((await store.get('settings', 'app'))!.deleted).toContain(SELFLESS);

    await importData(older, 'merge', db);
    expect(await store.get('values', SELFLESS)).toBeUndefined();
    expect((await store.get('messages', m.id))!.for).toBeUndefined();
    expect((await store.get('pages', council.id))!.valueIds ?? []).not.toContain(SELFLESS);
    expect((await held()).map(v => v.id)).toEqual([THOUGHTFUL]);
  });
});

describe('newCouncil with a value', () => {
  it('seats the value side first, then the shadow side, each in join order, skipping archived voices and repeats', async () => {
    await champion(SELFLESS, 'v-architect', 'shadow', T0);
    await champion(SELFLESS, 'v-warrior', 'value', T0 + 1);
    await champion(SELFLESS, 'v-joker', 'value', T0 + 2);
    await champion(SELFLESS, 'v-mystic', 'value', T0 + 3);
    await champion(SELFLESS, 'v-mystic', 'shadow', T0 + 4);
    await archiveVoice('v-joker');
    const page = await newCouncil({ valueId: SELFLESS, now: T0 + 5 });
    expect(page.valueIds).toEqual([SELFLESS]);
    expect(page.seats).toEqual(['v-warrior', 'v-mystic', 'v-architect']);
    expect((await store.get('pages', page.id))!).toMatchObject({ kind: 'council', valueIds: [SELFLESS], seats: ['v-warrior', 'v-mystic', 'v-architect'] });
    // no champions: a council about the value with nobody seated yet
    const bare = await callCouncil(THOUGHTFUL, T0 + 6);
    expect(bare.valueIds).toEqual([THOUGHTFUL]);
    expect(bare.seats).toBeUndefined();
    await expect(newCouncil({ valueId: 'nope' })).rejects.toThrow('No such value');
  });
});
