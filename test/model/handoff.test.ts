// One episode, two flows (F4, PLAN-FLOWS.md 3.7): a hand-off ends the episode it leaves on the step its line is
// printed on, starts one on the other flow with the dot on that step and `from` set, and the journal's span reads
// the whole chain from any leg. Nothing is counted or compared.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import type { FlowDB } from '../../src/db/schema';
import { ensureSeeded } from '../../src/db/seed';
import { store, setKey } from '../../src/db/fields';
import { deriveKey, randomSalt } from '../../src/db/crypto';
import { handOff, handedFrom, liveEpisode, moveDot, spanOfEpisode, spanText, currentStepId } from '../../src/model/flows';

let db: FlowDB;
beforeEach(async () => { db = await freshDB(); await ensureSeeded(); });

const MIN = 60_000;
const T0 = new Date(2026, 10, 24, 15, 2).getTime();
const clock = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

describe('handOff', () => {
  it('ends the episode here on its step, starts one there with from set and the dot on the step', async () => {
    const shame = (await moveDot('shame', [], 'shame-3', T0))!;
    const fight = (await handOff(shame.id, { flowId: 'fight', stepId: 'fight-1' }, 'shame-3', T0 + 4 * MIN))!;
    expect(fight).toMatchObject({ flowId: 'fight', from: shame.id, startedAt: T0 + 4 * MIN, marks: [{ stepId: 'fight-1', at: T0 + 4 * MIN }] });
    expect(await liveEpisode('shame')).toBeUndefined();
    const ended = (await store.get('episodes', shame.id))!;
    expect(ended.endedAt).toBe(T0 + 4 * MIN);
    expect(currentStepId(ended)).toBe('shame-3');
    expect((await liveEpisode('fight'))!.id).toBe(fight.id);
  });

  it('marks the line\'s step first when the dot was elsewhere', async () => {
    const shame = (await moveDot('shame', [], 'shame-2', T0))!;
    await handOff(shame.id, { flowId: 'fight', stepId: 'fight-1' }, 'shame-3', T0 + MIN);
    expect((await store.get('episodes', shame.id))!.marks.map(m => m.stepId)).toEqual(['shame-2', 'shame-3']);
  });

  it('with the other flow already open, the dot moves there and that episode keeps its own past', async () => {
    const fightOpen = (await moveDot('fight', [], 'fight-3', T0))!;
    const shame = (await moveDot('shame', [], 'shame-3', T0 + MIN))!;
    const after = (await handOff(shame.id, { flowId: 'fight', stepId: 'fight-1' }, 'shame-3', T0 + 2 * MIN))!;
    expect(after.id).toBe(fightOpen.id);
    expect(after.from).toBeUndefined();
    expect(currentStepId(after)).toBe('fight-1');
    expect((await store.get('episodes', shame.id))!.endedAt).toBe(T0 + 2 * MIN);
  });

  it('writes nothing from an ended episode, or to a step that is not there', async () => {
    const shame = (await moveDot('shame', [], 'shame-3', T0))!;
    expect(await handOff(shame.id, { flowId: 'fight', stepId: 'nope' }, 'shame-3', T0 + MIN)).toBeUndefined();
    await moveDot('shame', [], 'rest', T0 + MIN);
    expect(await handOff(shame.id, { flowId: 'fight', stepId: 'fight-1' }, 'shame-3', T0 + 2 * MIN)).toBeUndefined();
    expect(await liveEpisode('fight')).toBeUndefined();
  });

  it('the link row reads where it came from: the flow, the step it left, when', async () => {
    const shame = (await moveDot('shame', [], 'shame-2', T0))!;
    const fight = (await handOff(shame.id, { flowId: 'fight', stepId: 'fight-1' }, 'shame-2', T0 + 3 * MIN))!;
    expect(await handedFrom(fight)).toEqual({ flowId: 'shame', flow: 'Shame', step: "I'm worthless", place: 2, at: T0 + 3 * MIN });
    expect(await handedFrom(shame)).toBeUndefined();
  });

  it('`from` survives sealing (it is an id); the hand-off line keeps its link in the clear copy', async () => {
    const salt = randomSalt();
    await setKey(await deriveKey('3569', salt, 1000), { salt, iterations: 1000 });
    const shame = (await moveDot('shame', [], 'shame-3', T0))!;
    const fight = (await handOff(shame.id, { flowId: 'fight', stepId: 'fight-1' }, 'shame-3', T0 + MIN))!;
    expect((await db.episodes.get(fight.id))!.from).toBe(shame.id);
    const raw = JSON.stringify(await db.flows.get('shame'));
    expect(raw).toContain('"handoff":{"flowId":"fight","stepId":"fight-1"}');
    expect(raw).not.toContain("If it's hot");
  });
});

describe('spanOfEpisode', () => {
  it('reads the whole chain from any leg: "Shame, I\'m worthless, then Fight, 15:02 to 16:10"', async () => {
    const shame = (await moveDot('shame', [], 'shame-2', T0))!;
    const fight = (await handOff(shame.id, { flowId: 'fight', stepId: 'fight-1' }, 'shame-2', T0 + 4 * MIN))!;
    await moveDot('fight', [], 'rest', T0 + 68 * MIN);
    for (const id of [shame.id, fight.id]) {
      const span = (await spanOfEpisode(id))!;
      expect(span.legs.map(l => [l.flow, l.step])).toEqual([['Shame', "I'm worthless"], ['Fight', undefined]]);
      expect(spanText(span, clock)).toBe("Shame, I'm worthless, then Fight, 15:02 to 16:10");
    }
  });

  it('three legs; an open chain reads from its start with no end', async () => {
    const a = (await moveDot('whatif', [], 'whatif-3', T0))!;
    const b = (await handOff(a.id, { flowId: 'panic', stepId: 'panic-1' }, 'whatif-3', T0 + MIN))!;
    await moveDot('panic', ['panic-2', 'panic-3'], 'panic-4', T0 + 30 * MIN);
    await handOff(b.id, { flowId: 'depress', stepId: 'depress-1' }, 'panic-4', T0 + 40 * MIN);
    const span = (await spanOfEpisode(b.id))!;
    expect(spanText(span, clock)).toBe('What if, Night before, then Panic, Under the skin, then Depress, 15:02');
    expect(span.endedAt).toBeUndefined();
  });

  it('a lone episode is its own span; an unknown id has none', async () => {
    const e = (await moveDot('replay', [], 'replay-2', T0))!;
    expect(spanText((await spanOfEpisode(e.id))!, clock)).toBe('Replay, 15:02');
    expect(await spanOfEpisode('nope')).toBeUndefined();
  });
});
