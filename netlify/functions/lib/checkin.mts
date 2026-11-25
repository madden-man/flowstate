// The hourly pass behind the Sunday question: for each stored phone, is it that
// weekday and at or past that time in its own zone, with nothing sent this local
// week? Then one wordless push, and the week is stamped.

import { isDue } from './due.mts';
import type { DeviceStore, PushSubscriptionJSON } from './store.mts';
import type { SendResult } from './send.mts';

export interface CheckinDeps {
  store: DeviceStore;
  send: (s: PushSubscriptionJSON) => Promise<SendResult>;
  now: Date;
  log?: (...a: unknown[]) => void;
}

export interface CheckinResult {
  devices: number;
  sent: number;
  removed: number;
  failed: number;
}

export async function runCheckin({ store, send, now, log = console.warn }: CheckinDeps): Promise<CheckinResult> {
  const result: CheckinResult = { devices: 0, sent: 0, removed: 0, failed: 0 };
  for (const key of await store.keys()) {
    result.devices++;
    try {
      const device = await store.get(key);
      if (!device) continue;
      const { due, week } = isDue(device, device.lastSentWeek, now);
      if (!due) continue;
      const outcome = await send(device.subscription);
      if (outcome === 'sent') {
        await store.set(key, { ...device, lastSentWeek: week });
        result.sent++;
      } else if (outcome === 'gone') {
        await store.delete(key);
        result.removed++;
      } else {
        // Left unstamped: the next hourly run the same local day tries again.
        result.failed++;
      }
    } catch (err) {
      result.failed++;
      log('[checkin] device skipped:', key.slice(0, 8), (err as Error | null)?.message ?? '');
    }
  }
  return result;
}
