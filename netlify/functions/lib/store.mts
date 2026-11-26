// What the server keeps per phone (PLAN-PUSH.md section 5): a push address, a
// time, a zone. Never a word of the journal.

import { createHash } from 'node:crypto';
import type { Schedule } from './due.mts';

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface Device extends Schedule {
  subscription: PushSubscriptionJSON;
  /** The local week (its Sunday's date) of the last check-in sent. */
  lastSentWeek?: string;
  /** ISO instant of the last subscribe. */
  updatedAt: string;
}

/** The few store calls the functions make, so tests can pass a Map. */
export interface DeviceStore {
  get(key: string): Promise<Device | null>;
  set(key: string, device: Device): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** Blob key for an endpoint: sha256 hex, so the URL itself is never a key. */
export const keyFor = (endpoint: string): string => createHash('sha256').update(endpoint).digest('hex');

/** The most phones the store holds; a fifth new endpoint is refused. */
export const MAX_DEVICES = 4;

/** An in-memory store for tests and local experiments. */
export function memoryStore(seed: Record<string, Device> = {}): DeviceStore & { data: Map<string, Device> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    get: async k => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
    delete: async k => void data.delete(k),
    keys: async () => [...data.keys()],
  };
}

/** The live store: Netlify Blobs "push", strong consistency so the cap and the week stamp read back. */
export async function blobStore(): Promise<DeviceStore> {
  const { getStore } = await import('@netlify/blobs');
  const store = getStore({ name: 'push', consistency: 'strong' });
  return {
    get: async k => ((await store.get(k, { type: 'json' })) as Device | null) ?? null,
    set: async (k, v) => void (await store.setJSON(k, v)),
    delete: async k => store.delete(k),
    keys: async () => (await store.list()).blobs.map(b => b.key),
  };
}
