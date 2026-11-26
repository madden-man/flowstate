// The Sunday question's landing (PLAN-PUSH.md N1, model/into.ts askCheckin): his question on today's page, asked as
// Ask asks, the page linked to the week; landed again the same day, nothing is written twice.
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDB } from '../db/helpers';
import { messagesOf, questions, today, writeLine } from '../../src/model/pages';
import { askCheckin } from '../../src/model/into';

beforeEach(async () => { await freshDB(); });

const T0 = new Date(2026, 10, 22, 10, 1).getTime();
const LINE = 'Is there anything on your mind?';

describe('askCheckin', () => {
  it('writes the question on today\'s page, linked to the week, and asks it', async () => {
    const r = await askCheckin('2026-11-22', LINE, T0);
    const t = await today(new Date(T0));
    expect(t.page!.id).toBe(r.page.id);
    expect(t.page!.checkin).toEqual({ week: '2026-11-22' });
    expect((await messagesOf(r.page.id)).map(m => m.text)).toEqual([LINE]);
    expect((await questions()).map(q => [q.title, q.askedFrom])).toEqual([[LINE, r.page.id]]);
  });

  it('links a page already begun today, after what is on it', async () => {
    const w = await writeLine(undefined, undefined, { text: 'Coffee on the porch.' }, T0 - 60_000);
    const r = await askCheckin('2026-11-22', LINE, T0);
    expect(r.page.id).toBe(w!.page.id);
    expect((await messagesOf(r.page.id)).map(m => m.text)).toEqual(['Coffee on the porch.', LINE]);
    expect((await today(new Date(T0))).page!.checkin).toEqual({ week: '2026-11-22' });
  });

  it('landed twice the same day, writes and asks once', async () => {
    await askCheckin('2026-11-22', LINE, T0);
    const again = await askCheckin('2026-11-22', LINE, T0 + 60_000);
    expect(again.question).toBeUndefined();
    expect((await messagesOf(again.page.id)).map(m => m.text)).toEqual([LINE]);
    expect(await questions()).toHaveLength(1);
  });

  it('refuses an empty line', async () => {
    await expect(askCheckin('2026-11-22', '  ', T0)).rejects.toThrow();
  });
});
