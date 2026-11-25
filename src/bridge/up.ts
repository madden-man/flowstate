// Up (PLAN-WORLDS.md section 5, W2): the outbox read into envelopes, sent, and cleared by acknowledgement. It is handed
// a world's notebook (fields.ts handed) and that world's id, never the personal notebook.
//
// Each envelope is built at send time from the row as it stands (so many edits before a send are one envelope), and
// carries the rev its outbox entry was given at the last write. A row leaves the outbox only when the function
// acknowledges it, and only if it was not written again since it was read: a new write replaces the entry with a new
// n, and an acknowledgement takes out only the n it was read at. Locked, nothing is read and nothing goes up: the rows
// are sealed, and unsealing them needs the PIN's key.
import type { Handed } from '../db/fields';
import type { Message, OutboxRow, Page, Song, Take } from '../db/schema';
import type { Inquiry } from '../research/types';
import { BATCH_MAX, BODY_MAX_BYTES, CLEARS, ENVELOPE_MAX_BYTES, KEEPALIVE_MAX_BYTES, envelopeProblem, type Ack, type Envelope } from './protocol';
import { postUp } from './net';

type Out = Record<string, unknown>;
/** Only the fields named here leave the phone; anything a later package adds to a row stays home until it is named. */
const pick = <T extends object>(row: T, keys: (keyof T)[]): Out => {
  const o: Out = {};
  for (const k of keys) if (row[k] !== undefined) o[k as string] = row[k];
  return o;
};

const PAGE: (keyof Page)[] = ['id', 'kind', 'title', 'state', 'createdAt', 'updatedAt', 'answeredAt', 'resolvedByTap', 'seats', 'reading', 'chips', 'asked', 'year'];
const LINE: (keyof Message)[] = ['id', 'pageId', 'at', 'updatedAt', 'voiceId', 'text', 'replyTo', 'kept', 'wise', 'paper'];
const SONG: (keyof Song)[] = ['id', 'createdAt', 'updatedAt', 'title', 'lyric', 'sections', 'key', 'bpm', 'characterIds'];
/** A take's audio goes as a clip of its own (W6), never inside an envelope. */
const TAKE: (keyof Take)[] = ['id', 'songId', 'at', 'seconds', 'audioType', 'pitch', 'key', 'bpm', 'lineId'];

/** What an outbox entry becomes: an envelope, nothing to send (dropped from the outbox unsent), or wait (left). */
type Built = { envelope: Envelope } | { drop: true } | { wait: true };

async function build(h: Handed, world: string, o: OutboxRow): Promise<Built> {
  const base = { world, table: o.table, id: o.id, rev: o.rev };
  const gone = (): Built => ({ envelope: { ...base, deleted: true } });
  if (o.table === 'pages') {
    const p = await h.get('pages', o.id);
    if (!p) return gone();
    if (p.locked) return { wait: true };
    // a journal page never travels (section 5): if one is ever recorded, it leaves the outbox unsent
    if (p.kind === 'entry') return { drop: true };
    return { envelope: { ...base, row: pick(p, PAGE) } };
  }
  if (o.table === 'messages') {
    const m = await h.get('messages', o.id);
    if (!m) return gone();
    if (m.locked) return { wait: true };
    const page = await h.get('pages', m.pageId);
    if (page?.locked) return { wait: true };
    if (!page || page.kind === 'entry') {
      // a journal line: only while it is kept, alone, with its page's date, the year and its own chips (decision 18);
      // never the page, its title or its other lines. No longer kept, it goes up as a delete.
      if (!m.kept) return gone();
      return {
        envelope: {
          ...base,
          row: {
            ...pick(m, ['id', 'at', 'updatedAt', 'text', 'wise', 'kept']),
            kind: 'kept',
            date: page?.createdAt ?? m.at,
            year: page?.year ?? null,
            chips: m.chips ?? { characterIds: [], placeIds: [] },
          },
        },
      };
    }
    return { envelope: { ...base, row: pick(m, LINE) } };
  }
  if (o.table === 'inquiries') {
    const q = await h.get('inquiries', o.id) as (Inquiry & { locked?: true }) | undefined;
    if (!q) return gone();
    if (q.locked) return { wait: true };
    // the agents' runs stay home; the papers picked go with their own public record (section 7, Research)
    const papers = (await h.many('papers', q.picks.map(p => p.paperId)))
      .map((p, i) => p && { id: p.id, title: p.title, journal: p.journal, year: p.year, doi: p.doi, kind: p.kind, tier: p.tier, side: q.picks[i].side });
    return { envelope: { ...base, row: { ...pick(q, ['id', 'askedAt', 'question', 'state', 'pageId']), papers: papers.filter(Boolean) } } };
  }
  if (o.table === 'songs') {
    const s = await h.get('songs', o.id);
    if (!s) return gone();
    if (s.locked) return { wait: true };
    return { envelope: { ...base, row: pick(s, SONG) } };
  }
  const t = await h.get('takes', o.id);
  if (!t) return gone();
  if (t.locked) return { wait: true };
  return { envelope: { ...base, row: pick(t, TAKE) } };
}

export type Batch = { world: string; body: string; envelopes: Envelope[]; ns: Map<string, number>; drops: number[] };
const keyOf = (table: string, id: string) => `${table} ${id}`;
const bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * Reads the outbox, oldest first, into one batch under maxBytes (the keepalive budget for a send as the app is hidden,
 * else the function's own limit). Null when the notebook is locked or there is nothing to send. An entry whose row is
 * too large for an envelope stays in the outbox and is not sent (the function would refuse it).
 */
export async function readBatch(h: Handed, world: string, maxBytes = BODY_MAX_BYTES): Promise<Batch | null> {
  if (!h.open()) return null;
  const rows = await h.db.outbox.orderBy('n').toArray();
  const envelopes: Envelope[] = [];
  const ns = new Map<string, number>();
  const drops: number[] = [];
  const shell = bytes(JSON.stringify({ world, envelopes: [] }));
  let size = shell;
  for (const o of rows) {
    if (envelopes.length >= BATCH_MAX) break;
    const b = await build(h, world, o);
    if ('wait' in b) { if (!h.open()) return null; continue; }
    if ('drop' in b) { drops.push(o.n!); continue; }
    if (envelopeProblem(b.envelope, world)) continue;
    const n = bytes(JSON.stringify(b.envelope)) + 1;
    if (n > ENVELOPE_MAX_BYTES + 1024) continue;
    if (size + n > maxBytes) break;
    size += n;
    envelopes.push(b.envelope);
    ns.set(keyOf(b.envelope.table, b.envelope.id), o.n!);
  }
  if (!envelopes.length && !drops.length) return null;
  return { world, body: JSON.stringify({ world, envelopes }), envelopes, ns, drops };
}

/** Takes out of the outbox each entry the function acknowledged, by the n it was read at: an entry written again since
 *  has a new n and stays. Entries that were never to be sent go too. Returns how many acks cleared. */
export async function settle(h: Handed, batch: Batch, acks: Ack[]): Promise<number> {
  const gone = acks.filter(a => CLEARS.includes(a.result)).map(a => batch.ns.get(keyOf(a.table, a.id))).filter((n): n is number => n !== undefined);
  const all = [...gone, ...batch.drops];
  if (all.length) await h.db.transaction('rw', h.db.outbox, () => h.db.outbox.bulkDelete(all));
  return gone.length;
}

/** One send: read, post, settle. keepalive keeps the batch under the keepalive budget, for a send as the app is hidden;
 *  if it never completes, the entries are still in the outbox for the next one. Throws BridgeError (offline, or a
 *  status) with the outbox untouched. */
export async function sendOnce(h: Handed, world: string, token: string, opts: { keepalive?: boolean; fetcher?: typeof fetch; maxBytes?: number } = {}): Promise<{ sent: number; cleared: number } | null> {
  const batch = await readBatch(h, world, opts.maxBytes ?? (opts.keepalive ? KEEPALIVE_MAX_BYTES : BODY_MAX_BYTES));
  if (!batch) return null;
  if (!batch.envelopes.length) { await settle(h, batch, []); return { sent: 0, cleared: 0 }; }
  const acks = await postUp(token, batch.body, !!opts.keepalive, opts.fetcher);
  return { sent: batch.envelopes.length, cleared: await settle(h, batch, acks) };
}

/** Sends until the outbox is empty or a send clears nothing (a refused row waits; offline throws). */
export async function drain(h: Handed, world: string, token: string, fetcher?: typeof fetch): Promise<number> {
  let total = 0;
  for (let i = 0; i < 50; i++) {
    const r = await sendOnce(h, world, token, { fetcher });
    if (!r) break;
    total += r.sent;
    if (!r.cleared && r.sent) break;
  }
  return total;
}
