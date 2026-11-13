// The Research walkthrough's run: the app's own run (src/research/run.ts) on the two recordings the tests play
// (test/fixtures/research/run-writing.json and run-lower.json, through test/research/play.ts), set in with
// setRunDeps before the first render. The API port answers each request with the recording's next reply for that
// conversation (told apart by its system prompt, the recording by the question in the first message); the indexes'
// own code (src/research/indexes.ts) runs on the saved responses, served by a fetch of its own. The page's fetch is
// still refused (design/energize/src/net.ts): nothing here is a request, and no key is ever checked.
//
// pace() sets a moment a reply, so the titles are seen landing; hold() keeps the next run's first reply back until
// release(), so a run begun under a load that is not yet shown plays once the step is on screen.
import { setRunDeps } from '../../../src/research/run';
import { search } from '../../../src/research/indexes';
import type { MessagesPort } from '../../../src/research/client';
import type { Search } from '../../../src/research/types';
import { indexFileFor, player, type Recorded } from '../../../test/research/play';
import writingRun from '../../../test/fixtures/research/run-writing.json';
import lowerRun from '../../../test/fixtures/research/run-lower.json';
// the saved index responses, by file name, cut at build time to the records the runs file (vite.config.ts)
import BODIES from 'virtual:research-recorded';

export const WRITING = writingRun as Recorded;
export const LOWER = lowerRun as Recorded;
const RUNS = [WRITING, LOWER];

let ms = 0;
/** A moment before each reply from now on (0: at once). */
export function pace(next: number): void { ms = next; }

let gate: Promise<void> = Promise.resolve();
let open: () => void = () => {};
/** The next replies wait until release(). */
export function hold(): void { gate = new Promise<void>(r => { open = r; }); }
export function release(): void { open(); }

const wait = (t: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (!t) return resolve();
  const k = setTimeout(resolve, t);
  signal?.addEventListener('abort', () => { clearTimeout(k); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

/** The recording a request belongs to: the one whose question is in its first message. */
const runOf = (messages: unknown): Recorded => {
  const first = JSON.stringify((messages as unknown[] | undefined)?.[0] ?? '');
  return RUNS.find(r => first.includes(r.question)) ?? WRITING;
};

/** A port for one run: a fresh player a run, so asking again plays the recording from its first reply. */
function makePort(): MessagesPort {
  let play: ReturnType<typeof player> | undefined;
  return {
    async create(params, opts) {
      await gate;
      await wait(ms, opts?.signal);
      opts?.signal?.throwIfAborted();
      play ??= player(runOf(params.messages));
      return play.next(params as { system?: unknown }) as never;
    },
  };
}

/** The saved index response for a search, as the index would have sent it. */
const recordedFetch = (async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  const file = indexFileFor(WRITING, url);
  const body = file ? BODIES[file] : undefined;
  return body ? new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }) : new Response('{}', { status: 404 });
}) as typeof fetch;

const recordedSearch: Search = (args, opts) => search(args, { ...opts, fetch: recordedFetch });

export function installRecorded(): void {
  setRunDeps({ makePort, search: recordedSearch });
}
