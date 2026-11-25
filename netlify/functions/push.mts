// /api/push/*: key, subscribe, unsubscribe, test. See docs/PUSH.md and
// lib/routes.mts. The path config claims these URLs ahead of the SPA fallback.

import type { Config } from '@netlify/functions';
import { makePushHandler } from './lib/routes.mts';
import { blobStore } from './lib/store.mts';
import { liveWebPush, makeSend, readEnv } from './lib/send.mts';

const handle = makePushHandler({
  store: blobStore,
  send: async () => {
    const webpush = await liveWebPush(readEnv());
    return webpush ? makeSend(webpush) : null;
  },
  publicKey: () => readEnv().VAPID_PUBLIC_KEY,
});

export default (req: Request): Promise<Response> => handle(req);

export const config: Config = { path: '/api/push/*' };
