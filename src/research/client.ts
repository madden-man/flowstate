// Research (PLAN-RESEARCH.md section 4): the one door to the Anthropic API. This is the only file that loads the
// SDK's runtime; agents.ts takes a MessagesPort and imports types only, so its tests run on a scripted stub.
import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessage, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/beta/messages/messages';

/** One non-streaming request on the beta Messages API (the server side fallback lives there), and its reply. */
export interface MessagesPort {
  create(params: MessageCreateParamsNonStreaming, opts?: { signal?: AbortSignal }): Promise<BetaMessage>;
}

/** A port on Tommy's own key, called from the phone itself (section 4: no server). The SDK refuses to run in a
 *  browser unless told the key is meant to be there; it is, sealed under the PIN in Settings. The SDK's own retries
 *  (twice, on 429 and 5xx) stand. */
export function makePort(key: string): MessagesPort {
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  return {
    create: (params, opts) => client.beta.messages.create(params, { signal: opts?.signal }),
  };
}
