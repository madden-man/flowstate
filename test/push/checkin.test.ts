import { describe, expect, it, vi } from 'vitest';
import { runCheckin } from '../../netlify/functions/lib/checkin.mts';
import { keyFor, memoryStore, type Device } from '../../netlify/functions/lib/store.mts';
import { makeSend, PAYLOAD, TTL_SECONDS, type SendResult } from '../../netlify/functions/lib/send.mts';

const keys = { p256dh: 'BPKEY', auth: 'AUTH' };
const dev = (endpoint: string, extra: Partial<Device> = {}): Device => ({
  subscription: { endpoint, keys },
  tz: 'America/Denver',
  weekday: 0,
  hour: 10,
  minute: 0,
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...extra,
});
const A = 'https://web.push.apple.com/a';
const B = 'https://web.push.apple.com/b';
const SUNDAY_10_DENVER = new Date('2026-11-22T17:00:00Z');

const quiet = () => {};

describe('runCheckin', () => {
  it('sends to due devices and stamps the week', async () => {
    const store = memoryStore({ [keyFor(A)]: dev(A), [keyFor(B)]: dev(B, { tz: 'Asia/Tokyo' }) });
    const send = vi.fn(async (): Promise<SendResult> => 'sent');
    const r = await runCheckin({ store, send, now: SUNDAY_10_DENVER, log: quiet });
    expect(r).toEqual({ devices: 2, sent: 1, removed: 0, failed: 0 });
    expect(send).toHaveBeenCalledWith({ endpoint: A, keys });
    expect(store.data.get(keyFor(A))?.lastSentWeek).toBe('2026-11-22');
    expect(store.data.get(keyFor(B))?.lastSentWeek).toBeUndefined();
  });

  it('never sends twice in a week across hourly runs', async () => {
    const store = memoryStore({ [keyFor(A)]: dev(A) });
    const send = vi.fn(async (): Promise<SendResult> => 'sent');
    for (let h = 17; h <= 23; h++) await runCheckin({ store, send, now: new Date(`2026-11-22T${h}:00:00Z`), log: quiet });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('deletes a device the push service says is gone (410)', async () => {
    const store = memoryStore({ [keyFor(A)]: dev(A) });
    const r = await runCheckin({ store, send: async () => 'gone', now: SUNDAY_10_DENVER, log: quiet });
    expect(r.removed).toBe(1);
    expect(store.data.size).toBe(0);
  });

  it('keeps an unstamped device on other errors so a later run that day retries', async () => {
    const store = memoryStore({ [keyFor(A)]: dev(A) });
    const send = vi.fn<() => Promise<SendResult>>().mockResolvedValueOnce('failed').mockResolvedValueOnce('sent');
    expect((await runCheckin({ store, send, now: SUNDAY_10_DENVER, log: quiet })).failed).toBe(1);
    expect(store.data.get(keyFor(A))?.lastSentWeek).toBeUndefined();
    expect((await runCheckin({ store, send, now: new Date('2026-11-22T18:00:00Z'), log: quiet })).sent).toBe(1);
  });

  it('carries on past a device that throws', async () => {
    const store = memoryStore({ [keyFor(A)]: dev(A), [keyFor(B)]: dev(B) });
    const send = vi.fn<() => Promise<SendResult>>().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('sent');
    const r = await runCheckin({ store, send, now: SUNDAY_10_DENVER, log: quiet });
    expect(r).toMatchObject({ sent: 1, failed: 1 });
  });
});

describe('makeSend', () => {
  it('sends the wordless payload with a 12 hour TTL at normal urgency', async () => {
    const webpush = { sendNotification: vi.fn(async () => ({})) };
    expect(await makeSend(webpush)({ endpoint: A, keys })).toBe('sent');
    expect(webpush.sendNotification).toHaveBeenCalledWith({ endpoint: A, keys }, '{"kind":"checkin"}', { TTL: 43200, urgency: 'normal' });
    expect(PAYLOAD).toBe('{"kind":"checkin"}');
    expect(TTL_SECONDS).toBe(43200);
  });

  it.each([404, 410])('calls %i gone', async status => {
    const webpush = { sendNotification: vi.fn(async () => Promise.reject(Object.assign(new Error('x'), { statusCode: status }))) };
    expect(await makeSend(webpush, quiet)({ endpoint: A, keys })).toBe('gone');
  });

  it('calls other errors failed', async () => {
    const webpush = { sendNotification: vi.fn(async () => Promise.reject(Object.assign(new Error('x'), { statusCode: 500 }))) };
    expect(await makeSend(webpush, quiet)({ endpoint: A, keys })).toBe('failed');
  });
});
