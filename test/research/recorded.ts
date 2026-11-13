// A recorded Research run (PLAN-RESEARCH.md Q4), for the page's DOM tests and its e2e spec: the replies each of the
// three conversations gave, in order, and the saved index responses the searches are served. No key, no network.
// Format (test/fixtures/research/run-*.json):
//   { about, question,
//     indexes: { "europepmc 1": "<file>", "europepmc 2": ..., "openalex 1": ..., "openalex 2": ... },
//     turns: { for: Turn[], against: Turn[], check: Turn[] } }   where Turn = { stop_reason, content: BetaContentBlock[] }
// A conversation is told apart by its system prompt; past its last turn it answers end_turn with no tool call.
import fs from 'node:fs';
import path from 'node:path';

export type Key = 'for' | 'against' | 'check';
export type Turn = { stop_reason: string; content: Record<string, unknown>[] };
export type Recorded = { about: string; question: string; indexes: Record<string, string>; turns: Record<Key, Turn[]> };

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'fixtures', 'research');

export const loadRun = (name: string): Recorded => JSON.parse(fs.readFileSync(path.join(DIR, `run-${name}.json`), 'utf8'));
export const indexBody = (file: string) => fs.readFileSync(path.join(DIR, file), 'utf8');

/** Which conversation a request is, by its system prompt (agents.ts searcherPrompt and CHECKER_PROMPT). */
export function keyOf(system: unknown): Key {
  const s = String(system ?? '');
  if (s.startsWith('You check papers')) return 'check';
  return s.includes('Your side is +') ? 'for' : 'against';
}

let n = 0;
/** A Messages API reply around a recorded turn. */
export function message(turn: Turn | undefined) {
  const t = turn ?? { stop_reason: 'end_turn', content: [{ type: 'text', text: 'MODEL-TEXT-NEVER-SHOWN', citations: null }] };
  return {
    id: `msg_rec_${++n}`, type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: t.content,
    stop_reason: t.stop_reason, stop_sequence: null, stop_details: null, container: null, context_management: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

/** Plays the recorded replies back, one a request, each conversation in its own order. */
export function player(run: Recorded) {
  const at: Record<Key, number> = { for: 0, against: 0, check: 0 };
  const sent: Record<Key, unknown[]> = { for: [], against: [], check: [] };
  return {
    sent,
    next(params: { system?: unknown }) {
      const k = keyOf(params.system);
      sent[k].push(JSON.parse(JSON.stringify(params)));
      return message(run.turns[k][at[k]++]);
    },
  };
}

/** The saved index response a search URL is served: by host and tier, whatever the query. */
export function indexFileFor(run: Recorded, url: string): string | undefined {
  const u = new URL(url);
  if (u.hostname === 'www.ebi.ac.uk') return run.indexes[`europepmc ${/SRC:PPR/.test(u.searchParams.get('query') ?? '') ? 2 : 1}`];
  if (u.hostname === 'api.openalex.org') return run.indexes[`openalex ${(u.searchParams.get('filter') ?? '').includes('source.type:journal') ? 1 : 2}`];
  return undefined;
}

/** A fetch that answers the indexes from the recording. */
export function indexFetch(run: Recorded): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const file = indexFileFor(run, String(input instanceof Request ? input.url : input));
    return file ? new Response(indexBody(file), { status: 200, headers: { 'content-type': 'application/json' } }) : new Response('{}', { status: 404 });
  }) as typeof fetch;
}
