// A recorded Research run (PLAN-RESEARCH.md Q4), for the page's DOM tests and its e2e spec: the replies each of the
// three conversations gave, in order, and the saved index responses the searches are served. No key, no network.
// The format and the player are in ./play (no node imports there, so the walkthrough's app plays the same files).
import fs from 'node:fs';
import path from 'node:path';
import { indexFileFor, type Recorded } from './play';

export { keyOf, message, player, indexFileFor, type Key, type Turn, type Recorded } from './play';

const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'fixtures', 'research');

export const loadRun = (name: string): Recorded => JSON.parse(fs.readFileSync(path.join(DIR, `run-${name}.json`), 'utf8'));
export const indexBody = (file: string) => fs.readFileSync(path.join(DIR, file), 'utf8');

/** A fetch that answers the indexes from the recording. */
export function indexFetch(run: Recorded): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const file = indexFileFor(run, String(input instanceof Request ? input.url : input));
    return file ? new Response(indexBody(file), { status: 200, headers: { 'content-type': 'application/json' } }) : new Response('{}', { status: 404 });
  }) as typeof fetch;
}
