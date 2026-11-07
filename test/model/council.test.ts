// The council model (package 2): pages, messages, speaker selection and the mutable pantheon.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { store, setKey } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import type { FlowDB, Voice } from '../../src/db/schema';
import * as c from '../../src/model/council';
import { messagesOf } from '../../src/model/pages';

let db: FlowDB;
const T0 = new Date(2026, 10, 7, 21, 0).getTime();

beforeEach(async () => {
  db = await freshDB();
  await ensureSeeded(T0);
});

const voice = async (id: string) => (await store.get('voices', id))!;

describe('council pages', () => {
  it('lists council pages newest first with the voices that spoke, and finds today\'s', async () => {
    const older = await c.newCouncil({ now: T0 - 86_400_000 * 2 });
    await c.speak(older.id, 'Our world is deeply out of balance with fulfilling human needs.', { voiceId: 'v-skeptic', now: T0 - 86_400_000 * 2 });
    expect(await c.councilToday(T0)).toBeUndefined();
    const p = await c.newCouncil({ now: T0 });
    await c.speak(p.id, 'Define ways toward fulfillment and chase them internally.', { voiceId: 'v-architect', now: T0 + 1 });
    await c.speak(p.id, 'Many hard things are accomplished better from suffering.', { voiceId: 'v-workaholic', now: T0 + 2 });
    await c.speak(p.id, 'Again.', { voiceId: 'v-architect', now: T0 + 3 });
    await c.speak(p.id, 'plain ink', { now: T0 + 4 });
    const rows = await c.councilPages();
    expect(rows.map(r => r.page.id)).toEqual([p.id, older.id]);
    expect(rows[0].spoke).toEqual(['v-architect', 'v-workaholic']);
    expect(rows[0].firstLine).toBe('Define ways toward fulfillment and chase them internally.');
    expect((await c.councilToday(T0 + 3_600_000))?.id).toBe(p.id);
    // entries never show up as councils
    expect(rows.some(r => r.page.id === 'pg-manifesto')).toBe(false);
  });

  it('opens from a question and links both ways; linking again changes nothing', async () => {
    const q = { id: 'q1', kind: 'question' as const, createdAt: T0, updatedAt: T0, state: 'open' as const, title: 'Should I commit myself to hard things that require sacrifice?', tags: [], paradoxIds: [], linkedPageIds: [] };
    await store.put('pages', q);
    const p = await c.newCouncil({ now: T0, linkedPageIds: ['q1'] });
    expect((await store.get('pages', 'q1'))!.linkedPageIds).toEqual([p.id]);
    const page = await c.councilById(p.id);
    expect(page!.linked).toEqual([{ id: 'q1', kind: 'question', label: q.title }]);
    await c.linkPages(p.id, 'q1');
    expect((await store.get('pages', p.id))!.linkedPageIds).toEqual(['q1']);
    expect(await c.councilById('pg-manifesto')).toBeNull();
    expect(await c.councilById('nope')).toBeNull();
  });

  it('finds pages to link by title or first line, questions first, leaving out councils and links already made', async () => {
    await store.put('pages', { id: 'q1', kind: 'question', createdAt: T0, updatedAt: T0, state: 'open', title: 'How do I retain skills?', tags: [], paradoxIds: [], linkedPageIds: [] });
    await store.many({ pages: [{ id: 'e1', kind: 'entry', createdAt: T0 - 9, updatedAt: T0 - 9, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [] }], messages: [{ id: 'm-e1', pageId: 'e1', at: T0 - 9, text: 'I determine my core.', kept: true }] });
    const p = await c.newCouncil({ now: T0 });
    const all = await c.linkCandidates('', p.id);
    expect(all.map(x => x.id)).toEqual(['q1', 'e1']);
    expect(all[1].label).toBe('I determine my core.');
    expect((await c.linkCandidates('CORE', p.id)).map(x => x.id)).toEqual(['e1']);
    await c.linkPages(p.id, 'q1');
    expect((await c.linkCandidates('', p.id)).map(x => x.id)).toEqual(['e1']);
    await expect(c.linkPages(p.id, 'gone')).rejects.toThrow();
  });
});

describe('messages', () => {
  it('speak, reply and keep close; same-millisecond lines keep their order', async () => {
    const p = await c.newCouncil({ now: T0 });
    const a = await c.speak(p.id, 'The mind is not pure, nor is it reliable.', { voiceId: 'v-skeptic', now: T0 });
    const b = await c.speak(p.id, 'Listen to the quiet voices within.', { voiceId: 'v-mystic', now: T0 });
    const r = await c.reply(p.id, a.id, 'Neither is the heart.', { voiceId: 'v-warrior', now: T0 });
    const ms = await messagesOf(p.id);
    expect(ms.map(m => m.id)).toEqual([a.id, b.id, r.id]);
    expect(ms[2].replyTo).toBe(a.id);
    expect(ms.map(m => m.voiceId)).toEqual(['v-skeptic', 'v-mystic', 'v-warrior']);
    expect((await store.get('pages', p.id))!.updatedAt).toBe(T0);
    await c.keepClose(b.id);
    expect((await store.get('messages', b.id))!.kept).toBe(true);
    await expect(c.speak('nope', 'x')).rejects.toThrow();
  });

  it('reorders a message, handing the page\'s moments out again', async () => {
    const p = await c.newCouncil({ now: T0 });
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push((await c.speak(p.id, `line ${i}`, { now: T0 + i * 10 })).id);
    const after = await c.reorderMessage(p.id, ids[3], 0);
    expect(after.map(m => m.text)).toEqual(['line 3', 'line 0', 'line 1', 'line 2']);
    expect(after.map(m => m.at)).toEqual([T0, T0 + 10, T0 + 20, T0 + 30]);
    expect((await c.reorderMessage(p.id, ids[3], 99)).map(m => m.text)).toEqual(['line 0', 'line 1', 'line 2', 'line 3']);
    await expect(c.reorderMessage(p.id, 'nope', 0)).rejects.toThrow();
  });

  it('marks the first of each run for the speaker\'s name', () => {
    const ms = [{ voiceId: 'a' }, { voiceId: 'a' }, { voiceId: undefined }, { voiceId: 'b' }, { voiceId: 'a' }];
    expect(ms.map((_, i) => c.startsRun(ms, i))).toEqual([true, false, true, true, true]);
  });

  it('survives the seal: text written with a key reads back the same', async () => {
    const salt = randomSalt();
    const key = await deriveKey('5446', salt, 1000);
    await setKey(key, { salt, iterations: 1000 });
    const p = await c.newCouncil({ now: T0 });
    await c.speak(p.id, 'stand tall, young one', { voiceId: 'v-mystic', now: T0 });
    const raw = (await db.messages.toArray()).find(m => m.pageId === p.id);
    expect(raw!.text).toBe('');
    expect((await c.councilById(p.id))!.messages[0].text).toBe('stand tall, young one');
  });
});

describe('speaker selection', () => {
  it('puts starred voices first, drops archived ones, and the deep twins in Still', async () => {
    const vs = await c.allVoices();
    const row = c.chipVoices(vs).map(v => v.name);
    expect(row.slice(0, 4)).toEqual(['Skeptic', 'Mystic', 'Warrior', 'Architect']);
    expect(row).toContain('Phantom');
    expect(c.chipVoices(vs, true).map(v => v.name)).not.toContain('Phantom');
    await c.archiveVoice('v-joker');
    expect(c.chipVoices(await c.allVoices()).map(v => v.name)).not.toContain('Joker');
  });

  it('keeps the tapped chip until it leaves the row, then falls back to plain ink', async () => {
    const vs = await c.allVoices();
    expect(c.nextSpeaker('v-mystic', vs)).toBe('v-mystic');
    expect(c.nextSpeaker(undefined, vs)).toBeUndefined();
    expect(c.nextSpeaker('v-phantom', vs, true)).toBeUndefined();
    expect(c.nextSpeaker('v-phantom', vs, false)).toBe('v-phantom');
    expect(c.nextSpeaker('gone', vs)).toBeUndefined();
  });

  it('lights the lamp with the last voice that spoke, skipping plain ink', async () => {
    const vs = await c.allVoices();
    expect(c.lastSpeaker([{ voiceId: 'v-red' }, { voiceId: 'v-warrior' }, { voiceId: undefined }], vs)?.name).toBe('Warrior');
    expect(c.lastSpeaker([{ voiceId: undefined }], vs)).toBeUndefined();
  });
});

describe('seats and turns (V3)', () => {
  // The council screen's loop: who is up, a line in their voice, and the tap cleared after it.
  const table = async (seats: string[] | undefined, still = false) => {
    const vs = await c.allVoices();
    const ms: { voiceId?: string }[] = [];
    const up = (tap?: c.Tapped) => c.nextSpeaker(tap, vs, still, { seats, messages: ms });
    const say = (tap?: c.Tapped) => { const v = up(tap); ms.push({ voiceId: v }); return v; };
    return { vs, ms, up, say };
  };

  it('seats and unseats on the page, in the order tapped; twice changes nothing', async () => {
    const p = await c.newCouncil({ now: T0 });
    expect((await store.get('pages', p.id))!.seats).toBeUndefined();
    await c.seat(p.id, 'v-warrior', T0 + 1);
    await c.seat(p.id, 'v-mystic', T0 + 2);
    await c.seat(p.id, 'v-warrior', T0 + 3);
    expect((await store.get('pages', p.id))!.seats).toEqual(['v-warrior', 'v-mystic']);
    await c.toggleSeat(p.id, 'v-skeptic', T0 + 4);
    await c.toggleSeat(p.id, 'v-warrior', T0 + 5);
    const after = (await store.get('pages', p.id))!;
    expect(after.seats).toEqual(['v-mystic', 'v-skeptic']);
    expect(after.updatedAt).toBe(T0 + 5);
    await c.unseat(p.id, 'v-joker');
    expect((await c.councilById(p.id))!.page.seats).toEqual(['v-mystic', 'v-skeptic']);
    await expect(c.seat(p.id, 'gone')).rejects.toThrow();
    await expect(c.seat('pg-manifesto', 'v-mystic')).rejects.toThrow();
  });

  it('two seats alternate without a tap, starting with the first seated', async () => {
    const t = await table(['v-skeptic', 'v-mystic']);
    expect(t.up()).toBe('v-skeptic');
    expect([t.say(), t.say(), t.say(), t.say()]).toEqual(['v-skeptic', 'v-mystic', 'v-skeptic', 'v-mystic']);
  });

  it('three seats go round in seat order, not pantheon order', async () => {
    const t = await table(['v-warrior', 'v-skeptic', 'v-architect']);
    expect([t.say(), t.say(), t.say(), t.say(), t.say()]).toEqual(['v-warrior', 'v-skeptic', 'v-architect', 'v-warrior', 'v-skeptic']);
  });

  it('a chip tap speaks for one line, then the turn goes on from the one who just spoke', async () => {
    const t = await table(['v-warrior', 'v-skeptic', 'v-architect']);
    expect(t.say()).toBe('v-warrior');
    expect(t.say('v-architect')).toBe('v-architect');
    expect(t.say()).toBe('v-warrior');
    expect(t.say()).toBe('v-skeptic');
    // tapping the voice already up changes nothing
    expect(t.say('v-architect')).toBe('v-architect');
    expect(t.say()).toBe('v-warrior');
  });

  it('Ink is one tap and takes no turn', async () => {
    const t = await table(['v-skeptic', 'v-mystic']);
    expect(t.say()).toBe('v-skeptic');
    expect(t.say(null)).toBeUndefined();
    expect(t.say(null)).toBeUndefined();
    expect(t.up()).toBe('v-mystic');
    expect(t.say()).toBe('v-mystic');
    // a council that opens on a line in ink still starts with the first seat
    const u = await table(['v-skeptic', 'v-mystic']);
    expect(u.say(null)).toBeUndefined();
    expect(u.say()).toBe('v-skeptic');
  });

  it('a seat removed mid-council is passed over, and the turn goes on to the seat after it', async () => {
    const seats = ['v-warrior', 'v-skeptic', 'v-architect', 'v-mystic'];
    const vs = await c.allVoices();
    const ms = [{ voiceId: 'v-warrior' }, { voiceId: 'v-skeptic' }];
    const at = (s: string[]) => c.nextSpeaker(undefined, vs, false, { seats: s, messages: ms });
    expect(at(seats)).toBe('v-architect');
    // the Skeptic, who just spoke, leaves: the Architect after it is still up
    expect(at(['v-warrior', 'v-architect', 'v-mystic'])).toBe('v-architect');
    // the Architect, who was up, leaves: the Mystic after it
    expect(at(['v-warrior', 'v-skeptic', 'v-mystic'])).toBe('v-mystic');
    // everyone after the last speaker leaves: round to the first seat
    expect(at(['v-warrior', 'v-skeptic'])).toBe('v-warrior');
    // an archived voice keeps its seat but takes no turn
    await c.archiveVoice('v-architect');
    expect(c.nextSpeaker(undefined, await c.allVoices(), false, { seats, messages: ms })).toBe('v-mystic');
    // and the rotation works against the stored page too
    const p = await c.newCouncil({ now: T0 });
    for (const id of ['v-warrior', 'v-skeptic', 'v-mystic']) await c.seat(p.id, id);
    await c.speak(p.id, 'Stand tall, young one.', { voiceId: 'v-warrior', now: T0 });
    await c.unseat(p.id, 'v-skeptic');
    const d = (await c.councilById(p.id))!;
    expect(c.turnOf(d.page.seats, d.messages, await c.allVoices())).toBe('v-mystic');
  });

  it('in Still a seated deep twin keeps its seat but is passed over, and a tap on it does nothing', async () => {
    const t = await table(['v-mystic', 'v-phantom', 'v-warrior'], true);
    expect(c.seatedVoices(['v-mystic', 'v-phantom', 'v-warrior'], t.vs, true).map(v => v.name)).toEqual(['Mystic', 'Warrior']);
    expect([t.say(), t.say(), t.say()]).toEqual(['v-mystic', 'v-warrior', 'v-mystic']);
    expect(t.say('v-phantom')).toBe('v-warrior');
    // by night the Phantom is back in the round
    const n = await table(['v-mystic', 'v-phantom', 'v-warrior']);
    expect([n.say(), n.say(), n.say()]).toEqual(['v-mystic', 'v-phantom', 'v-warrior']);
  });

  it('with no seats it behaves as before: ink unless a chip is tapped, and the tap holds', async () => {
    for (const seats of [undefined, [] as string[], ['gone']]) {
      const t = await table(seats);
      expect(c.isSeated(seats, t.vs)).toBe(false);
      expect(t.say()).toBeUndefined();
      expect(t.say('v-mystic')).toBe('v-mystic');
      expect(t.say(null)).toBeUndefined();
    }
    expect(c.isSeated(['v-mystic'], await c.allVoices())).toBe(true);
    expect(c.isSeated(['v-phantom'], await c.allVoices(), true)).toBe(false);
  });
});

describe('voices are mutable', () => {
  it('adds a voice that can speak at once, at the end of the order', async () => {
    const g = await c.addVoice({ name: ' Gardener ', aka: c.akaWords('Tender, , Grower '), colour: { hue: 120 }, shade: 'light' });
    expect(g.name).toBe('Gardener');
    expect(g.aka).toEqual(['Tender', 'Grower']);
    expect(g.order).toBe(Math.max(...(await c.allVoices()).filter(v => v.id !== g.id).map(v => v.order)) + 1);
    expect(c.chipVoices(await c.allVoices()).some(v => v.id === g.id)).toBe(true);
    const p = await c.newCouncil({ now: T0 });
    await c.speak(p.id, 'Tend what is growing.', { voiceId: g.id });
    expect((await c.councilPages())[0].spoke).toEqual([g.id]);
    await expect(c.addVoice({ name: '  ', colour: { hue: 1 }, shade: 'light' })).rejects.toThrow();
  });

  it('adds a deep voice already paired with its light twin', async () => {
    const d = await c.addVoice({ name: 'Tyrant', colour: { hue: 25 }, shade: 'deep', twinId: 'v-warrior' });
    expect(d.twinId).toBe('v-warrior');
    expect((await voice('v-warrior')).twinId).toBe(d.id);
  });

  it('pushes the old name, aka and colour onto revisions on every edit, and nothing when nothing changed', async () => {
    await c.editVoice('v-explorer', { name: 'Wanderer' }, T0 + 1);
    await c.editVoice('v-explorer', { colour: { hue: 70 } }, T0 + 2);
    await c.editVoice('v-explorer', { name: 'Wanderer', aka: ['Adventurer'], colour: { hue: 70 } }, T0 + 3);
    const v = await voice('v-explorer');
    expect(v.name).toBe('Wanderer');
    expect(v.revisions).toEqual([
      { at: T0 + 1, name: 'Explorer', aka: ['Adventurer'], colour: { hue: 55 } },
      { at: T0 + 2, name: 'Wanderer', aka: ['Adventurer'], colour: { hue: 55 } },
    ]);
    // a blank name keeps the old one
    expect((await c.editVoice('v-explorer', { name: '  ' })).name).toBe('Wanderer');
  });

  it('re-pairs twins, letting go of the old partners on both sides', async () => {
    // Phantom leaves the Mystic for the Warrior
    await c.setTwin('v-warrior', 'v-phantom');
    expect((await voice('v-warrior')).twinId).toBe('v-phantom');
    expect((await voice('v-phantom')).twinId).toBe('v-warrior');
    expect((await voice('v-mystic')).twinId).toBeUndefined();
    // the Workaholic moves to the Warrior too: the Phantom and the Architect are let go
    await c.setTwin('v-workaholic', 'v-warrior');
    expect((await voice('v-phantom')).twinId).toBeUndefined();
    expect((await voice('v-architect')).twinId).toBeUndefined();
    await c.setTwin('v-warrior', null);
    expect((await voice('v-warrior')).twinId).toBeUndefined();
    expect((await voice('v-workaholic')).twinId).toBeUndefined();
    await expect(c.setTwin('v-warrior', 'v-mystic')).rejects.toThrow(/other shade/);
    await expect(c.setTwin('v-warrior', 'gone')).rejects.toThrow();
  });

  it('changing shade lets go of the twin', async () => {
    await c.editVoice('v-victim', { shade: 'light' });
    expect((await voice('v-victim')).twinId).toBeUndefined();
    expect((await voice('v-meaning-maker')).twinId).toBeUndefined();
  });

  it('stars, archives and restores; archived voices keep their messages and colour', async () => {
    const p = await c.newCouncil({ now: T0 });
    await c.speak(p.id, 'Ha.', { voiceId: 'v-joker' });
    await c.starVoice('v-joker', true);
    expect(c.chipVoices(await c.allVoices())[4].name).toBe('Joker');
    await c.archiveVoice('v-joker');
    const j = await voice('v-joker');
    expect(j.archived).toBe(true);
    expect(j.colour).toEqual({ hue: 95 });
    expect((await messagesOf(p.id))[0].voiceId).toBe('v-joker');
    await c.restoreVoice('v-joker');
    expect((await voice('v-joker')).archived).toBe(false);
  });

  it('groups each light voice with its twin and reorders by group', async () => {
    const groups = c.voiceGroups((await c.allVoices()).filter(v => !v.archived));
    expect(groups.length).toBe(9);
    expect(groups[1]).toMatchObject({ light: { name: 'Mystic' }, deep: { name: 'Phantom' } });
    await c.moveGroup('v-phantom', 0);
    const after = c.voiceGroups(await c.allVoices());
    expect(after[0].light!.name).toBe('Mystic');
    expect(after[0].deep!.name).toBe('Phantom');
    expect(after[1].light!.name).toBe('Skeptic');
    const ordered = (await c.allVoices()).map(v => v.order);
    expect(ordered).toEqual([...ordered.keys()]);
    await c.orderVoices(['v-joker']);
    expect((await c.allVoices())[0].name).toBe('Joker');
  });
});

describe('hues', () => {
  const vs = () => c.allVoices();
  it('measures around the wheel', () => {
    expect(c.hueDistance(350, 10)).toBe(20);
    expect(c.hueDistance(10, 350)).toBe(20);
    expect(c.hueDistance(0, 180)).toBe(180);
    expect(c.hueDistance(725, 5)).toBe(0);
  });
  it('warns within about 20 degrees of an active voice, naming it and its colour', async () => {
    expect(c.closeWarning(240, await vs())).toBe("Close to the Mystic's blue");
    expect(c.closeWarning(62, await vs())).toBe("Close to the Engineer's brown");
    expect(c.closeWarning(200, await vs())).toBeNull();
    // the voice itself and its twin are no clash
    expect(c.closeWarning(250, await vs(), ['v-mystic', 'v-phantom'])).toBeNull();
    await c.archiveVoice('v-joker');
    expect(c.closeWarning(95, await vs())).toBeNull();
  });
  it('names colours', () => {
    expect(c.hueWord({ hue: null })).toBe('black');
    expect(c.hueWord({ hue: 60, chroma: 0.5 })).toBe('brown');
    expect(c.hueWord({ hue: 60 })).toBe('orange');
    expect(c.hueWord({ hue: 355 })).toBe('pink');
  });
  it('suggests the asked-for hue when clear, else the nearest clear one, else the widest gap', async () => {
    expect(c.suggestHue(await vs(), 200)).toBe(200);
    // the Mystic sits at 250: the nearest clear hues are 230 and 270
    expect([230, 270]).toContain(c.suggestHue(await vs(), 250));
    const free = c.suggestHue(await vs());
    expect(c.closeVoice(free, await vs())).toBeUndefined();
    expect(c.suggestHue([] as Voice[])).toBe(250);
  });
});

describe('more voices', () => {
  it('offers Jung\'s figures and the twelve not yet in the pantheon, none active until added', async () => {
    const offered = c.moreVoices(await c.allVoices()).map(m => m.name);
    expect(offered).toEqual(expect.arrayContaining(['Self', 'Shadow', 'Persona', 'Anima/Animus', 'Wise Old One', 'Child', 'Trickster', 'Sage', 'Hero']));
    expect(offered).not.toContain('Explorer'); // already seeded
    expect((await c.allVoices()).some(v => v.name === 'Self')).toBe(false);
    const s = await c.addFigure('Sage');
    expect(c.closeVoice(s.colour.hue!, (await c.allVoices()).filter(v => v.id !== s.id))).toBeUndefined();
    expect(c.moreVoices(await c.allVoices()).map(m => m.name)).not.toContain('Sage');
    await expect(c.addFigure('Nobody')).rejects.toThrow();
  });
});
