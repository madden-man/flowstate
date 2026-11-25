// One way out for the Sunday question: a Web Push with no words in it. The
// service worker on the phone reads his line from its own IndexedDB.

import type { PushSubscriptionJSON } from './store.mts';

/** The whole payload, always. No text from the journal ever travels through the server. */
export const PAYLOAD = '{"kind":"checkin"}';

/** Twelve hours: a phone that is off all Sunday morning still gets it that day. */
export const TTL_SECONDS = 60 * 60 * 12;

/** The slice of web-push the functions use. */
export interface WebPushLike {
  sendNotification(
    subscription: PushSubscriptionJSON,
    payload: string,
    options: { TTL: number; urgency: 'normal' },
  ): Promise<unknown>;
}

/** sent: landed. gone: the push service says the address is dead (404/410); delete it. failed: anything else; keep it. */
export type SendResult = 'sent' | 'gone' | 'failed';

export function makeSend(webpush: WebPushLike, log: (...a: unknown[]) => void = console.warn) {
  return async function send(subscription: PushSubscriptionJSON): Promise<SendResult> {
    try {
      await webpush.sendNotification(subscription, PAYLOAD, { TTL: TTL_SECONDS, urgency: 'normal' });
      return 'sent';
    } catch (err) {
      const status = (err as { statusCode?: number } | null)?.statusCode;
      if (status === 404 || status === 410) return 'gone';
      // Log the status and the push host only; the endpoint path is the device's address.
      let host = '';
      try {
        host = new URL(subscription.endpoint).host;
      } catch {
        /* stored endpoints were validated; nothing to add */
      }
      log('[push] send did not land:', status ?? 'no status', host, (err as Error | null)?.message ?? '');
      return 'failed';
    }
  };
}

export interface VapidEnv {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

/** web-push with VAPID details from env, or null when the keys are not set. */
export async function liveWebPush(env: VapidEnv): Promise<WebPushLike | null> {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return null;
  const webpush = await import('web-push');
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return webpush as unknown as WebPushLike;
}

/** Env from the Netlify runtime when present, else process.env (tests, scripts). */
export function readEnv(): VapidEnv {
  const netlify = (globalThis as { Netlify?: { env: { get(k: string): string | undefined } } }).Netlify;
  const get = (k: string) => netlify?.env.get(k) ?? process.env[k];
  return {
    VAPID_PUBLIC_KEY: get('VAPID_PUBLIC_KEY'),
    VAPID_PRIVATE_KEY: get('VAPID_PRIVATE_KEY'),
    VAPID_SUBJECT: get('VAPID_SUBJECT'),
  };
}
