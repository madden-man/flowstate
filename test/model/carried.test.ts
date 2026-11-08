// Carried forward (F6): the note to the next one of you, ghost rings, one person written when calm, your own stamps.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { store, setKey } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { moveDot, endEpisode, flowById } from '../../src/model/flows';
import { shownTips } from '../../src/model/tips';
import {
  asksFor, markAsked, noteStepOf, writeNote, moveNote, strikeNote, notesAt, noteShownAt, ghostsOf, ghostScale, GHOSTS_MAX,
  hasPerson, personRowText, fillTime, smsHref, savePerson, PERSON_EXAMPLE, setPrediction, setOutcome, stampDue, stampsOf,
} from '../../src/model/carried';
import { stampTs } from '../../src/ui/flow/Stamps';

let fdb: Awaited<ReturnType<typeof freshDB>>;
beforeEach(async () => { fdb = await freshDB(); await ensureSeeded(); });

const MIN = 60_000;
const T0 = new Date(2026, 10, 8, 21, 36).getTime();

/** A Panic episode: Overstimulated 2 minutes, the wave 30, settling 5, then rest. */
async function episode(at = T0) {
  const e = await moveDot('panic', [], 'panic-1', at);
  await moveDot('panic', [], 'panic-2', at + 2 * MIN);
  await moveDot('panic', [], 'panic-3', at + 32 * MIN);
  return (await moveDot('panic', [], 'rest', at + 37 * MIN))!.id ?? e!.id;
}

describe('a note to the next one of you', () => {
  it('asks once, after an episode ended before the page opened, in Day and Night only, never through the door', async () => {
    const id = await episode();
    const e = (await store.get('episodes', id))!;
    const o = { still: false, door: false, locked: false };
    expect(asksFor(e, T0 + 40 * MIN, o)).toBe(true);
    expect(asksFor(e, T0 + 36 * MIN, o)).toBe(false); // ended after the page opened: not in the same breath
    expect(asksFor(e, T0 + 40 * MIN, { ...o, still: true })).toBe(false);
    expect(asksFor(e, T0 + 40 * MIN, { ...o, door: true })).toBe(false);
    await markAsked(id, T0 + 40 * MIN);
    expect(asksFor((await store.get('episodes', id))!, T0 + 50 * MIN, o)).toBe(false);
  });
  it('lands on the step the episode spent longest on', async () => {
    const id = await episode();
    const flow = (await flowById('panic'))!;
    expect(noteStepOf(flow, (await store.get('episodes', id))!)).toBe('panic-2');
    expect(noteStepOf(flow, { marks: [{ stepId: 'panic-1', at: 0 }, { stepId: 'panic-2', at: 0 }], startedAt: 0, endedAt: 0 })).toBe('panic-2');
  });
  it('is written sealed, one per episode, shown at its step, moved by a chip', async () => {
    const salt = randomSalt();
    await setKey(await deriveKey('2468', salt, 1000), { salt, iterations: 1000 });
    const id = await episode();
    await writeNote('panic', id, 'panic-2', 'Leave the kitchen first.', T0 + 40 * MIN);
    await writeNote('panic', id, 'panic-2', 'Leave the kitchen before anything else.', T0 + 41 * MIN);
    const raw = await fdb.flows.get('panic');
    expect(JSON.stringify(raw)).not.toContain('kitchen');
    let flow = (await flowById('panic'))!;
    expect(flow.notes).toHaveLength(1);
    expect(noteShownAt(flow, 'panic-2')?.text).toBe('Leave the kitchen before anything else.');
    await moveNote('panic', id, 'panic-1');
    flow = (await flowById('panic'))!;
    expect(noteShownAt(flow, 'panic-2')).toBeUndefined();
    expect(noteShownAt(flow, 'panic-1')?.text).toBe('Leave the kitchen before anything else.');
  });
  it('cleared while being written takes the draft away', async () => {
    const id = await episode();
    await writeNote('panic', id, 'panic-1', 'x');
    await writeNote('panic', id, 'panic-1', '  ');
    expect((await flowById('panic'))!.notes).toBeUndefined();
  });
  it('is struck in Earlier, never deleted, and leaves the page', async () => {
    const a = await episode(T0);
    const b = await episode(T0 + 24 * 60 * MIN);
    await writeNote('panic', a, 'panic-1', 'older', T0 + 40 * MIN);
    await writeNote('panic', b, 'panic-1', 'newer', T0 + 25 * 60 * MIN);
    let flow = (await flowById('panic'))!;
    expect(notesAt(flow, 'panic-1').map(n => n.text)).toEqual(['newer', 'older']);
    await strikeNote('panic', flow.notes!.find(n => n.text === 'newer')!.id, T0 + 26 * 60 * MIN);
    flow = (await flowById('panic'))!;
    expect(noteShownAt(flow, 'panic-1')?.text).toBe('older');
    expect(notesAt(flow, 'panic-1').find(n => n.text === 'newer')?.struck).toBe(T0 + 26 * 60 * MIN);
  });
});

describe('ghost rings', () => {
  it('one per ended episode, newest innermost, capped so the page never fills', () => {
    const eps = Array.from({ length: 20 }, (_, i) => ({ id: `e${i}`, startedAt: i, endedAt: i + 1 }));
    eps.push({ id: 'live', startedAt: 99, endedAt: undefined as unknown as number });
    const ids = ghostsOf(eps);
    expect(ids).toHaveLength(GHOSTS_MAX);
    expect(ids[0]).toBe('e19');
    expect(ids).not.toContain('live');
    expect(ghostScale(0, true)).toBeGreaterThan(1);
    expect(ghostScale(1, true)).toBeGreaterThan(ghostScale(0, true));
    expect(ghostScale(GHOSTS_MAX - 1, false)).toBeLessThan(1.3);
  });
  it('hide in Still and print no number (the component draws only paths, inside fs-notstill)', () => {
    const src = fs.readFileSync('src/ui/flow/Ghosts.tsx', 'utf8');
    expect(src).toMatch(/class="fl-ghosts fs-notstill"/);
    expect(src).not.toMatch(/<text/);
    expect(fs.readFileSync('src/ui/flow/FlowPage.tsx', 'utf8')).toMatch(/!doorOnly && !flow\.locked && <Ghosts/);
  });
});

describe('one person, written when calm', () => {
  it('builds the sms: link with the body encoded, for iOS and Android both', () => {
    expect(smsHref('+1 (555) 010-4471', "Hard hour. Talk to me? 10 min & a laugh")).toBe(
      'sms:+15550104471?&body=Hard%20hour.%20Talk%20to%20me%3F%2010%20min%20%26%20a%20laugh');
    expect(smsHref(undefined, 'hi')).toBe('sms:?&body=hi');
  });
  it('fills {time} from the return time, else the earliest the Timer would give', () => {
    const back = new Date(2026, 10, 8, 19, 40).getTime();
    expect(fillTime("I'm going. Back at {time}.", back)).toBe("I'm going. Back at 19:40.");
    expect(fillTime('Back at {time}.', undefined, new Date(2026, 10, 8, 21, 52).getTime())).toBe('Back at 22:15.');
    expect(fillTime('no time here', undefined)).toBe('no time here');
  });
  it('a row with no name is the slot to fill; with a name it reads "Text Ali"', async () => {
    const flow = (await flowById('panic'))!;
    const t = flow.steps[2].tips.find(x => x.helper === 'person')!;
    expect(hasPerson(t)).toBe(false);
    expect(personRowText(t)).toBe('Someone, written when calm');
    expect(shownTips(flow.steps[2], false).map(x => x.id)).toContain(t.id);
    await savePerson('panic', 'panic-3', t.id, { name: ' Ali ', tel: ' ', text: 'Hard hour.' });
    const saved = (await flowById('panic'))!.steps[2].tips.find(x => x.id === t.id)!;
    expect(saved.person).toEqual({ name: 'Ali', text: 'Hard hour.' });
    expect(personRowText(saved)).toBe('Text Ali');
    expect(PERSON_EXAMPLE).toMatch(/ten minutes/);
  });
  it('is sealed with the step', async () => {
    const salt = randomSalt();
    await setKey(await deriveKey('2468', salt, 1000), { salt, iterations: 1000 });
    await savePerson('panic', 'panic-3', 'panic-3-person', { name: 'Ali', tel: '5550104471', text: 'Hard hour.' });
    expect(JSON.stringify(await fdb.flows.get('panic'))).not.toContain('5550104471');
  });
});

describe('your own stamps', () => {
  it('a prediction is written on the live episode, sealed, then asked about the next day, once', async () => {
    const salt = randomSalt();
    await setKey(await deriveKey('2468', salt, 1000), { salt, iterations: 1000 });
    const e = (await moveDot('panic', [], 'panic-1', T0))!;
    await setPrediction(e.id, "Tomorrow's call goes badly", T0 + MIN);
    expect(JSON.stringify(await fdb.episodes.get(e.id))).not.toContain('call');
    await endEpisode(e.id, T0 + 5 * MIN);
    expect(await setPrediction(e.id, 'later')).toBeUndefined();
    expect(await stampDue(T0 + 60 * MIN)).toBeUndefined(); // the same day: not yet
    const due = await stampDue(T0 + 12 * 60 * MIN);
    expect(due?.episode.prediction?.text).toBe("Tomorrow's call goes badly");
    await setOutcome(e.id, 'didnt');
    await setOutcome(e.id, 'happened'); // no second ask: the first tap stands
    expect(await stampDue(T0 + 12 * 60 * MIN)).toBeUndefined();
    expect(await stampsOf('panic')).toEqual(['didnt']);
  });
  it('marks sit oldest leftmost along the flat after the last step', () => {
    const ts = stampTs(0.8, 3);
    expect(ts[0]).toBeGreaterThan(0.8);
    expect(ts[0]).toBeLessThan(ts[1]);
    expect(ts[2]).toBeLessThanOrEqual(1);
  });
});
