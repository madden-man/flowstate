// "Said for it" rows (PLAN-VALUES.md section 3 step 10, C5): where a row leads, its day, its words on one line, its rule.
import { describe, it, expect } from 'vitest';
import { saidRow } from '../../src/ui/be/saidRows';
import type { Said } from '../../src/model/values';
import type { Voice } from '../../src/db/schema';

const at = new Date(2026, 10, 10, 21, 40).getTime();
const said = (o: Partial<Said['message']> & { kind?: Said['kind']; side?: Said['side'] } = {}): Said => ({
  message: { id: 'm1', pageId: 'p1', at, text: 'Then tell him tonight,\nnot in a letter.', kept: false, voiceId: 'v-warrior', ...o },
  pageId: 'p1', kind: o.kind ?? 'council', side: o.side ?? 'value',
});
const voices = new Map<string, Pick<Voice, 'colour' | 'shade'>>([
  ['v-warrior', { colour: { hue: 25 }, shade: 'light' }],
  ['v-phantom', { colour: { hue: 250 }, shade: 'deep' }],
]);
const value = { shadow: 'discretion' };

describe('saidRow', () => {
  it('leads a council line to its council and a journal line to its page', () => {
    expect(saidRow(said(), value, voices).href).toBe('#/council/p1');
    expect(saidRow(said({ kind: 'entry' }), value, voices).href).toBe('#/journal/p1');
  });
  it('prints the line\'s day as the notebook does and its words on one line', () => {
    const r = saidRow(said(), value, voices);
    expect(r.date).toBe('11 / 10 / 26');
    expect(r.text).toBe('Then tell him tonight, not in a letter.');
  });
  it('carries the shadow\'s word only for a line spoken for the shadow', () => {
    expect(saidRow(said(), value, voices).shadow).toBeUndefined();
    expect(saidRow(said({ side: 'shadow' }), value, voices).shadow).toBe('discretion');
  });
  it('draws the voice\'s colour, a deep twin doubled, and plain ink with no colour of its own', () => {
    const light = saidRow(said(), value, voices);
    expect(light.colour).toMatch(/oklch/);
    expect(light.deep).toBe(false);
    expect(saidRow(said({ voiceId: 'v-phantom' }), value, voices).deep).toBe(true);
    const ink = saidRow(said({ voiceId: undefined }), value, voices);
    expect(ink.colour).toBeUndefined();
    expect(ink.deep).toBe(false);
  });
});
