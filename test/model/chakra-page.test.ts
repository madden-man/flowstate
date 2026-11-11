// A stop's page (PLAN-MOUNTAIN.md section 6, R3): the rest list, the safety lines, the hand-off words, the reads.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { ensureSeeded } from '../../src/db/seed';
import { SEED_FLOWS, seedFlow } from '../../src/db/seed-flows';
import type { Episode, Flow } from '../../src/db/schema';
import { CHAKRA_IDS, type ChakraId } from '../../src/model/mountain';
import {
  REST_MOST, REST_ON_ID, chakraPageData, sameRow, handOffWords, homes as readHomes, restLineId, restRows, safetyLines,
} from '../../src/model/chakra-page';
import { printTips } from '../../src/ui/flow/PrintLines';

const FLOWS: Flow[] = SEED_FLOWS.map(s => seedFlow(s));
const HOMES = new Map(FLOWS.map(f => [f.id, f.chakra]));
const under = (c: ChakraId) => FLOWS.filter(f => f.chakra === c);
const ended = (flowId: string, endedAt: number, done: [string, number][]): Episode =>
  ({ id: `e-${flowId}-${endedAt}`, flowId, startedAt: endedAt - 1000, endedAt, marks: [], done: done.map(([tipId, at]) => ({ tipId, at })) });

describe('the rest list', () => {
  it('lists up to six, with no wise line, no printed line and no row that needs its own step or a live episode', () => {
    for (const c of CHAKRA_IDS) {
      const rest = restRows(c, under(c), []);
      expect(rest.tips.length).toBeLessThanOrEqual(REST_MOST);
      expect(rest.tips.length).toBeGreaterThan(0);
      for (const t of rest.tips) {
        expect(t.wise, `${c} ${t.id}`).toBeFalsy();
        expect(t.print, `${c} ${t.id}`).toBeFalsy();
        expect(['journal', 'timer', 'person', 'prediction', 'five']).not.toContain(t.helper);
      }
    }
  });

  it('puts what he ticked in past episodes first, newest episode first, in the order he ticked them', () => {
    const eps = [
      ended('panic', 1_000, [['panic-1-cold', 10]]),
      // the prediction row needs its own step and a live episode: ticked or not, it never stands in the rest list
      ended('whatif', 5_000, [['whatif-1-predict', 5], ['whatif-1-later', 30], ['panic-1-cold', 20]]),
    ];
    expect(restRows('root', under('root'), eps).tips.map(t => t.id).slice(0, 2)).toEqual(['panic-1-cold', 'whatif-1-later']);
  });

  it('gathers every On row under the sign into one, with every pick once, right after the ticked rows', () => {
    const rest = restRows('root', under('root'), [ended('panic', 1_000, [['panic-1-cold', 10]])]);
    const ons = rest.tips.filter(t => t.helper === 'on');
    expect(ons.map(t => t.id)).toEqual([REST_ON_ID]);
    expect(rest.tips.map(t => t.id).slice(0, 2)).toEqual(['panic-1-cold', REST_ON_ID]);
    const all = under('root').flatMap(f => f.steps.flatMap(s => (s.tips.some(t => t.helper === 'on') ? (s.picks ?? []) : [])));
    expect(rest.picks?.map(p => p.title)).toEqual([...new Set(all.filter(p => !p.struck).map(p => p.title))]);
  });

  it('falls back to seed order, and never says the same words twice', () => {
    const rest = restRows('heart', under('heart'), []);
    const words = rest.tips.map(t => t.text.toLowerCase());
    expect(new Set(words).size).toBe(words.length);
    expect(rest.tips[0].id).toBe(REST_ON_ID);
    expect(rest.tips[1].id).toBe('depress-1-wake');
  });

  it('says nothing twice on Root: one cold-water row, one Ring row, though the ring and the curve both have them', () => {
    const rest = restRows('root', under('root'), []);
    const texts = rest.tips.map(t => t.text);
    expect(texts.filter(t => /cold water/i.test(t))).toHaveLength(1);
    expect(rest.tips.filter(t => t.helper === 'ring')).toHaveLength(1);
    for (const c of CHAKRA_IDS) {
      const tips = restRows(c, under(c), []).tips;
      tips.forEach((a, i) => tips.slice(i + 1).forEach(b => expect(sameRow(a.text, b.text), `${c}: ${a.text} / ${b.text}`).toBe(false)));
      const hs = tips.flatMap(t => (t.helper ? [t.helper] : []));
      expect(new Set(hs).size, c).toBe(hs.length);
    }
  });

  it('tells near-identical rows from rows that only share a word', () => {
    expect(sameRow('Cold water on your face', 'Cold water on your wrists and face')).toBe(true);
    expect(sameRow('Name it: shame', 'Name it: this is the replay')).toBe(false);
    expect(sameRow('Daylight early, outside if you can', 'Same wake time and meals, whatever the night was')).toBe(false);
  });

  it('leaves out ended episodes of flows under other signs, and live ones', () => {
    const live: Episode = { ...ended('panic', 9_000, [['panic-1-cold', 1]]), endedAt: undefined };
    const elsewhere = ended('depress', 9_000, [['depress-1-wake', 1]]);
    expect(restRows('root', under('root'), [live, elsewhere]).tips.map(t => t.id)).toEqual(restRows('root', under('root'), []).tips.map(t => t.id));
  });
});

describe('hand-off words', () => {
  it('read as the sign the line lands on', () => {
    expect(handOffWords("If it's hot: the Fight flow.", 'throat')).toBe("If it's hot: the Throat chakra.");
    expect(handOffWords('If it tips into panic: the Panic flow.', 'root')).toBe('If it tips into panic: the Root chakra.');
    expect(handOffWords('If the heat shows up most days: the Depress flow.', 'heart')).toBe('If the heat shows up most days: the Heart chakra.');
    expect(handOffWords('If it runs on: the What if flow.', 'root')).toBe('If it runs on: the Root chakra.');
  });
  it('read as the other drawing\'s place when it is on the same page, never naming the sign he is on', () => {
    expect(handOffWords('If it tips into panic: the Panic flow.', 'root', 'above')).toBe('If it tips into panic: the other steps here.');
    const whatif = FLOWS.find(f => f.id === 'whatif')!;
    const lines = whatif.steps.flatMap(s => safetyLines(under('root'), HOMES, { flowId: 'whatif', stepId: s.id }));
    const toPanic = lines.filter(t => t.handoff?.flowId === 'panic');
    expect(toPanic.length).toBeGreaterThan(0);
    for (const t of toPanic) {
      expect(t.text).toMatch(/the other steps here\.$/);
      expect(t.text).not.toMatch(/Root chakra|Panic/);
    }
  });
  it('leave his own words, and a line to a flow with no sign, as they are', () => {
    expect(handOffWords('Go and see Mum.', 'heart')).toBe('Go and see Mum.');
    expect(handOffWords('Then: the Energize flow.', undefined)).toBe('Then: the Energize flow.');
  });
});

describe('safety stays', () => {
  // Every line FlowPage prints for each of the eight flows under a sign (PrintLines on each step, the rest line at rest)
  // is printed on that sign's page: on the same step, and the rest line on the first step and at rest.
  const placed = FLOWS.filter(f => f.chakra);
  it('covers the eight flows under the seven signs', () => {
    expect(placed.map(f => f.id).sort()).toEqual(['depress', 'fight', 'night', 'panic', 'replay', 'shame', 'shutdown', 'whatif']);
  });

  for (const f of placed) {
    it(`prints every line ${f.id}'s page printed, on ${f.chakra}'s page`, () => {
      const fs = under(f.chakra!);
      f.steps.forEach((s, i) => {
        const shown = safetyLines(fs, HOMES, { flowId: f.id, stepId: s.id });
        const ids = shown.map(t => t.id);
        for (const t of printTips(s)) {
          expect(ids, `${f.id} ${s.id} ${t.id}`).toContain(t.id);
          const line = shown.find(x => x.id === t.id)!;
          if (t.handoff) {
            expect(line.handoff).toEqual(t.handoff);
            expect(line.text).not.toMatch(/\bflow\b/);
          } else expect(line.text).toBe(t.text);
        }
        if (f.restLine) expect(ids.includes(restLineId(f.id)), `${f.id} rest line on step ${i + 1}`).toBe(i === 0);
      });
      const atRest = safetyLines(fs, HOMES).map(t => t.text);
      for (const s of f.steps) for (const t of printTips(s).filter(x => !x.handoff)) expect(atRest).toContain(t.text);
      if (f.restLine) expect(atRest).toContain(f.restLine);
    });
  }

  it('prints the 988 line on the Heart page at rest, and the doctor line on the Crown page at rest and on its first step', () => {
    expect(safetyLines(under('heart'), HOMES).map(t => t.text).join(' ')).toMatch(/988/);
    const night = FLOWS.find(f => f.id === 'night')!;
    expect(safetyLines(under('crown'), HOMES).map(t => t.text)).toContain(night.restLine);
    expect(safetyLines(under('crown'), HOMES, { flowId: 'night', stepId: night.steps[0].id }).map(t => t.text)).toContain(night.restLine);
  });
});

describe('the reads', () => {
  beforeEach(async () => { await freshDB(); await ensureSeeded(); });
  it('reads the flows under a sign, every flow\'s sign and their episodes', async () => {
    const { seedFlowsOnce } = await import('../../src/db/seed');
    await seedFlowsOnce();
    const h = await readHomes();
    expect(h.get('panic')).toBe('root');
    expect(h.get('energize')).toBeUndefined();
    const d = await chakraPageData('root');
    expect(d.flows.map(f => f.id)).toEqual(['panic', 'whatif']);
    expect(d.episodes).toEqual([]);
  });
});
