// The tasks become the water (PLAN-TASKS.md, T0): the touches (section 2), the shelves (section 4), the marks and
// Root's basics (section 7).
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { store, setKey, lock, unlock, LockedError } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { ensureSeeded } from '../../src/db/seed';
import { PICKS } from '../../src/db/seed/picks';
import type { FlowDB } from '../../src/db/schema';
import { CHAKRA_IDS, chakraOf } from '../../src/model/mountain';
import { sunTimes } from '../../src/model/sun';
import {
  TOUCHES, touchesOf, touchOf, leadOf, STARTERS, STARTER_TITLES, shelf, addPick, movePick, removePick,
  writeMark, marksOf, stones, BASICS, dayOf, basicsToday, setBasic,
} from '../../src/model/acts';

const words = (c: Parameters<typeof touchesOf>[0]) => touchesOf(c).map(x => x.word);
const lockWith = async (pin = '2580') => {
  await ensureSeeded();
  const salt = randomSalt();
  const key = await deriveKey(pin, salt, 1000);
  await setKey(key, { salt, iterations: 1000 });
  return key;
};

describe('the touches (section 2)', () => {
  it('each sign has the touches the plan writes, in its order, at most four', () => {
    expect(Object.keys(TOUCHES)).toEqual([...CHAKRA_IDS]);
    expect(words('crown')).toEqual(['Let go', 'Core', 'Kept line', 'Sit']);
    expect(words('third-eye')).toEqual(['Look far', 'Ask', 'Bring it', 'Questions']);
    expect(words('throat')).toEqual(['Say it here', 'A voice', 'Send', 'Call']);
    expect(words('heart')).toEqual(['Grieve', 'Hold', 'Letter', 'Reach']);
    expect(words('solar-plexus')).toEqual(['Reword', 'Stand on', 'Spark it', 'I will']);
    expect(words('sacral')).toEqual(['Feel', 'Hold', 'Write from it', 'Move']);
    expect(words('root')).toEqual(['Five', 'Breathe', 'Basics', 'Reach']);
    for (const c of CHAKRA_IDS) expect(touchesOf(c).length).toBeLessThanOrEqual(4);
  });
  it('one lead a sign, drawn in the place', () => {
    for (const c of CHAKRA_IDS) {
      expect(touchesOf(c).filter(x => x.lead)).toHaveLength(1);
      expect(leadOf(c).kind).toBe('place');
    }
    expect(CHAKRA_IDS.map(c => leadOf(c).word)).toEqual(['Let go', 'Look far', 'Say it here', 'Grieve', 'Reword', 'Feel', 'Five']);
  });
  it('ids are unique within a sign, and touchOf finds them', () => {
    for (const c of CHAKRA_IDS) expect(new Set(touchesOf(c).map(x => x.id)).size).toBe(touchesOf(c).length);
    expect(touchOf('heart', 'grieve')!.word).toBe('Grieve');
    expect(touchOf('heart', 'let-go')).toBeUndefined();
  });
  it('kinds and landings follow the table and section 3', () => {
    const by = (c: Parameters<typeof touchOf>[0], id: string) => { const x = touchOf(c, id)!; return [x.kind, x.lands, x.carries]; };
    expect(by('crown', 'let-go')).toEqual(['place', 'place', 'lifts']);
    expect(by('crown', 'core')).toEqual(['be', 'be', 'core']);
    expect(by('crown', 'kept-line')).toEqual(['journal', 'kept-page', 'kept-line']);
    expect(by('crown', 'sit')).toEqual(['sea', 'meditate', 'nothing']);
    expect(by('third-eye', 'ask')).toEqual(['journal', 'today', 'question']);
    expect(by('third-eye', 'bring-it')).toEqual(['council', 'council', 'question']);
    expect(by('third-eye', 'questions')).toEqual(['questions', 'questions', 'nothing']);
    expect(by('throat', 'a-voice')).toEqual(['council', 'council', 'voices']);
    expect(by('throat', 'send')).toEqual(['out', 'messages', 'sentence']);
    expect(by('throat', 'call')).toEqual(['out', 'phone', 'person']);
    expect(by('heart', 'letter')).toEqual(['journal', 'today', 'dear']);
    expect(by('heart', 'reach')).toEqual(['out', 'messages', 'person']);
    expect(by('solar-plexus', 'stand-on')).toEqual(['be', 'be', 'value']);
    expect(by('solar-plexus', 'spark-it')).toEqual(['sea', 'energize', 'nothing']);
    expect(by('solar-plexus', 'i-will')).toEqual(['out', 'calendar', 'time']);
    expect(by('sacral', 'write-from-it')).toEqual(['journal', 'today', 'first-line']);
    expect(by('sacral', 'move')).toEqual(['out', 'spotify', 'shelf']);
    expect(by('root', 'basics')).toEqual(['place', 'place', 'basics']);
    expect(by('root', 'reach')).toEqual(['out', 'messages', 'person']);
  });
  it('the door shows only the in-place touches that write nothing (section 7)', () => {
    const door = CHAKRA_IDS.flatMap(c => touchesOf(c).filter(x => x.door).map(x => `${c}:${x.word}`));
    expect(door).toEqual(['third-eye:Look far', 'heart:Hold', 'sacral:Hold', 'root:Five', 'root:Breathe']);
    for (const x of CHAKRA_IDS.flatMap(c => touchesOf(c))) if (x.door) { expect(x.kind).toBe('place'); expect(x.marks).toBe(false); }
  });
  it('only Say it here, Grieve, Reword and Feel keep a mark; Let go keeps none', () => {
    const marking = CHAKRA_IDS.flatMap(c => touchesOf(c).filter(x => x.marks).map(x => x.word));
    expect(marking).toEqual(['Say it here', 'Grieve', 'Reword', 'Feel']);
    expect(touchOf('crown', 'let-go')!.marks).toBe(false);
  });
  it('no dash and no count in any word', () => {
    const all = CHAKRA_IDS.flatMap(c => touchesOf(c).map(x => x.word)).join(' ');
    expect(all).not.toMatch(/[\u2014\u2013\d]/);
  });
});

describe('Crown\'s gloss (section 2)', () => {
  it('is letting go, with sleep gone to Root\'s basics', () => {
    expect(chakraOf('crown').gloss).toBe('Crown · letting go');
    expect(BASICS.map(b => b.word)).toContain('slept');
  });
});

describe('the shelves (section 4)', () => {
  let db: FlowDB;
  beforeEach(async () => { db = await freshDB(); });

  it('the starters are the plan\'s, three a sign, each an album already seeded with its artist and Spotify id', () => {
    const seeded = PICKS.flatMap(s => s.picks).filter(p => p.kind === 'album');
    for (const c of CHAKRA_IDS) {
      expect(STARTERS[c]).toHaveLength(3);
      expect(STARTERS[c].map(p => p.title)).toEqual([...STARTER_TITLES[c]]);
      for (const p of STARTERS[c]) {
        const s = seeded.find(x => x.title === p.title)!;
        expect(p).toMatchObject({ kind: 'album', title: s.title, by: s.by, albumId: s.albumId });
        expect(p.id.startsWith(`pk-${c}-`)).toBe(true);
      }
    }
    expect(STARTERS.crown.map(p => p.by)).toEqual(['Sigur Rós', 'Hammock', 'Sigur Rós']);
    expect(new Set(CHAKRA_IDS.flatMap(c => STARTERS[c].map(p => p.id))).size).toBe(21);
  });
  it('a shelf never touched reads as its starters and writes nothing', async () => {
    expect(await shelf('heart')).toEqual(STARTERS.heart);
    expect(await db.signShelves.count()).toBe(0);
  });
  it('add, reorder and remove, kept in his order', async () => {
    const T = 1000;
    let s = await addPick('root', { kind: 'album', title: 'Hundred Acres', by: 'S. Carey', albumId: '4H1xbaXxVDmHnFQ5ifzyM4' }, T);
    expect(s.map(p => p.title)).toEqual(['Romantic Piano', 'Solitudes', 'All We Grow', 'Hundred Acres']);
    s = await addPick('root', { kind: 'film', title: '  My Neighbor Totoro ', id: 'totoro' }, T + 1);
    expect(s.at(-1)).toEqual({ kind: 'film', title: 'My Neighbor Totoro', id: 'totoro' });
    // the same album, or the same id, is not added twice
    s = await addPick('root', { kind: 'album', title: 'Hundred Acres', albumId: '4H1xbaXxVDmHnFQ5ifzyM4' }, T + 2);
    s = await addPick('root', { kind: 'film', title: 'Totoro again', id: 'totoro' }, T + 2);
    expect(s).toHaveLength(5);
    s = await movePick('root', 'totoro', 0, T + 3);
    expect(s.map(p => p.title)).toEqual(['My Neighbor Totoro', 'Romantic Piano', 'Solitudes', 'All We Grow', 'Hundred Acres']);
    s = await movePick('root', 'totoro', 99, T + 4);
    expect(s.at(-1)!.id).toBe('totoro');
    s = await movePick('root', STARTERS.root[1].id, -3, T + 5);
    expect(s[0].title).toBe('Solitudes');
    s = await removePick('root', STARTERS.root[0].id, T + 6);
    expect(s.map(p => p.title)).toEqual(['Solitudes', 'All We Grow', 'Hundred Acres', 'My Neighbor Totoro']);
    expect(await shelf('root')).toEqual(s);
    expect((await db.signShelves.get('root'))!.updatedAt).toBe(T + 6);
    // the other signs are untouched
    expect(await shelf('crown')).toEqual(STARTERS.crown);
  });
  it('a shelf he empties stays empty', async () => {
    for (const p of STARTERS.sacral) await removePick('sacral', p.id);
    expect(await shelf('sacral')).toEqual([]);
  });
  it('an unknown pick moves and removes nothing; an empty title or an unknown sign is refused', async () => {
    expect(await movePick('crown', 'nope', 0)).toEqual(STARTERS.crown);
    expect(await removePick('crown', 'nope')).toEqual(STARTERS.crown);
    await expect(addPick('crown', { kind: 'show', title: '  ' })).rejects.toThrow();
    await expect(shelf('elbow' as never)).rejects.toThrow();
  });
  it('sealed with the PIN: no titles in the database, nothing while locked, all of it once open', async () => {
    await addPick('throat', { kind: 'show', title: 'Cunk on Earth', id: 'cunk' });
    const key = await lockWith();
    const raw = (await db.signShelves.get('throat'))!;
    expect(raw.picks).toEqual([]);
    expect(raw.sealed).toBeTruthy();
    expect(JSON.stringify(raw)).not.toMatch(/Cunk|Watsky/);
    lock();
    expect(await shelf('throat')).toEqual([]);
    expect(await shelf('heart')).toEqual([]);
    await expect(addPick('throat', { kind: 'show', title: 'x' })).rejects.toBeInstanceOf(LockedError);
    expect(await unlock(key)).toBe(true);
    expect((await shelf('throat')).at(-1)).toMatchObject({ id: 'cunk', title: 'Cunk on Earth' });
  });
});

describe('the marks (section 7)', () => {
  let db: FlowDB;
  beforeEach(async () => { db = await freshDB(); });

  it('a touch that keeps one writes its line, and marksOf reads them oldest first', async () => {
    await writeMark('throat', 'say-it-here', ' I needed you there. ', { at: 20 });
    await writeMark('throat', 'say-it-here', 'Not again.', { at: 10 });
    await writeMark('sacral', 'feel', 'tender', { at: 15 });
    const m = await marksOf('throat');
    expect(m.map(x => [x.text, x.at, x.touch])).toEqual([['Not again.', 10, 'say-it-here'], ['I needed you there.', 20, 'say-it-here']]);
    expect((await marksOf('sacral', 'feel')).map(x => x.text)).toEqual(['tender']);
    expect(await marksOf('sacral', 'hold')).toEqual([]);
  });
  it('Reword keeps the deed and strikes the verdict', async () => {
    const m = await writeMark('solar-plexus', 'reword', 'I sent it late', { struck: 'I am useless', at: 5 });
    expect(m).toMatchObject({ text: 'I sent it late', struck: 'I am useless' });
    expect((await marksOf('solar-plexus'))[0]).toMatchObject({ text: 'I sent it late', struck: 'I am useless' });
  });
  it('Crown\'s Let go cannot write one, nor any touch that keeps nothing, nor an empty line', async () => {
    await expect(writeMark('crown', 'let-go', 'all of it')).rejects.toThrow(/Let go keeps nothing/);
    await expect(writeMark('root', 'breathe', 'x')).rejects.toThrow();
    await expect(writeMark('heart', 'nope', 'x')).rejects.toThrow();
    await expect(writeMark('heart', 'grieve', '   ')).rejects.toThrow();
    await expect(writeMark('elbow' as never, 'grieve', 'x')).rejects.toThrow();
    expect(await db.marks.count()).toBe(0);
  });
  it('Heart\'s stones are the names he grieved, oldest first, and stay', async () => {
    await writeMark('heart', 'grieve', 'Grandpa', { at: 1 });
    await writeMark('throat', 'say-it-here', 'Grandpa', { at: 2 });
    await writeMark('heart', 'grieve', 'Biscuit', { at: 3 });
    expect((await stones()).map(s => s.text)).toEqual(['Grandpa', 'Biscuit']);
  });
  it('sealed with the PIN: no words in the database, none while locked, all of them once open', async () => {
    await writeMark('heart', 'grieve', 'Grandpa', { at: 1 });
    const key = await lockWith();
    await writeMark('solar-plexus', 'reword', 'I asked', { struck: 'I am weak', at: 2 });
    for (const r of await db.marks.toArray()) {
      expect(r.text).toBe('');
      expect(r).not.toHaveProperty('struck');
      expect(r.sealed).toBeTruthy();
      expect(r.chakra).toBeTruthy();
    }
    lock();
    expect(await stones()).toEqual([]);
    await expect(writeMark('heart', 'grieve', 'x')).rejects.toBeInstanceOf(LockedError);
    expect(await unlock(key)).toBe(true);
    expect((await stones()).map(s => s.text)).toEqual(['Grandpa']);
    expect((await marksOf('solar-plexus'))[0]).toMatchObject({ text: 'I asked', struck: 'I am weak' });
  });
});

describe('Root\'s basics (section 7)', () => {
  let db: FlowDB;
  beforeEach(async () => { db = await freshDB(); });
  const evergreen = { name: 'Evergreen, Colorado', lat: 39.6336, lon: -105.3172 };

  it('the four, in their order', () => {
    expect(BASICS.map(b => b.id)).toEqual(['ate', 'slept', 'water', 'outside']);
  });
  it('the day runs sunrise to sunrise: before it, still yesterday', () => {
    expect(dayOf(new Date(2026, 10, 11, 6, 59).getTime())).toBe('2026-11-10');
    expect(dayOf(new Date(2026, 10, 11, 7, 0).getTime())).toBe('2026-11-11');
    expect(dayOf(new Date(2026, 10, 11, 23, 59).getTime())).toBe('2026-11-11');
    const rise = sunTimes(new Date(2026, 10, 11, 12), evergreen).rise;
    expect(dayOf(rise - 1, evergreen)).toBe('2026-11-10');
    expect(dayOf(rise, evergreen)).toBe('2026-11-11');
    expect(dayOf(new Date(2026, 0, 1, 3).getTime())).toBe('2025-12-31');
  });
  it('lit on the day\'s row, put out, and gone at the next sunrise', async () => {
    await ensureSeeded();
    const morning = new Date(2026, 10, 11, 9).getTime();
    expect(await basicsToday(morning)).toEqual([]);
    expect(await setBasic('water', true, morning)).toEqual(['water']);
    expect(await setBasic('ate', true, morning + 1)).toEqual(['ate', 'water']);
    expect(await setBasic('water', false, morning + 2)).toEqual(['ate']);
    expect(await setBasic('slept', true, morning + 3)).toEqual(['ate', 'slept']);
    // after midnight, before sunrise, it is still the same day
    const late = new Date(2026, 10, 12, 3).getTime();
    expect(await basicsToday(late)).toEqual(['ate', 'slept']);
    // the sun rises: none lit, and lighting one takes the earlier day's row away
    const next = new Date(2026, 10, 12, 8).getTime();
    expect(await basicsToday(next)).toEqual([]);
    expect(await setBasic('outside', true, next)).toEqual(['outside']);
    expect((await db.days.toArray()).map(d => d.id)).toEqual(['2026-11-12']);
  });
  it('the day turns at his place\'s sunrise when he has set one', async () => {
    await ensureSeeded();
    const s = (await store.get('settings', 'app'))!;
    await store.put('settings', { ...s, place: evergreen });
    const rise = sunTimes(new Date(2026, 10, 11, 12), evergreen).rise;
    await setBasic('ate', true, rise - 60_000);
    expect(await basicsToday(rise - 1)).toEqual(['ate']);
    expect(await basicsToday(rise)).toEqual([]);
  });
  it('refuses what is not a basic', async () => {
    await expect(setBasic('ran' as never, true)).rejects.toThrow();
  });
  it('sealed with the PIN: no basics in the database, none while locked, all of them once open', async () => {
    const T = new Date(2026, 10, 11, 9).getTime();
    const key = await lockWith();
    await setBasic('slept', true, T);
    const raw = (await db.days.toArray())[0];
    expect(raw.basics).toEqual([]);
    expect(raw.sealed).toBeTruthy();
    lock();
    expect(await basicsToday(T)).toEqual([]);
    await expect(setBasic('ate', true, T)).rejects.toBeInstanceOf(LockedError);
    expect(await unlock(key)).toBe(true);
    expect(await basicsToday(T)).toEqual(['slept']);
  });
});
