// Scheduled hourly (Netlify schedules run in UTC; Sunday 10:00 moves with
// daylight saving and travel, so the wall-clock check is per phone in lib/due.mts).

import type { Config } from '@netlify/functions';
import { runCheckin } from './lib/checkin.mts';
import { blobStore } from './lib/store.mts';
import { liveWebPush, makeSend, readEnv } from './lib/send.mts';

export default async (): Promise<void> => {
  const webpush = await liveWebPush(readEnv());
  if (!webpush) {
    console.warn('[checkin] VAPID keys are not set; nothing sent.');
    return;
  }
  const result = await runCheckin({ store: await blobStore(), send: makeSend(webpush), now: new Date() });
  console.log('[checkin]', JSON.stringify(result));
};

export const config: Config = { schedule: '@hourly' };
