// Research (PLAN-RESEARCH.md): the shapes the indexes (Q1), the agents (Q3), the store and the page (Q2, Q4) share.
// Nothing here is model text: a Paper's words are the index's own record of it, and an agent hands back only ids.

/** + is evidence the answer to the question is yes; − is evidence it is no. */
export type Side = 'for' | 'against';
/** 1 a journal paper; 2 a preprint, conference paper, chapter, thesis or report from an index; 3 a web page. */
export type Tier = 1 | 2 | 3;
export type Source = 'europepmc' | 'openalex' | 'crossref' | 'web';

/** One part of an abstract as the index holds it: its section head ("Background"), if it has one, and its text. */
export type AbstractSection = { head?: string; text: string };

/** A paper as an index records it (the `papers` table). `id` is `doi:<lowercased doi>` when there is a DOI, else
 *  `<source>:<the index's own id>`, so one paper found twice is one row. `kind` is printed as it stands
 *  ("Meta-analysis", "Systematic review", "Randomised trial", "Review", "Journal article", "Preprint, not peer
 *  reviewed", "Conference paper", "Book chapter", "Thesis", "Report", "Web page"). `url` is where its title links:
 *  `https://doi.org/<doi>`, or with no DOI the index's own page for the record. */
export interface Paper {
  id: string;
  doi?: string;
  title: string;
  abstract: AbstractSection[];
  journal?: string;
  year?: number;
  kind: string;
  tier: Tier;
  url: string;
  source: Source;
  fetchedAt: number;
}

/** A paper filed on a side. */
export interface Pick { paperId: string; side: Side; tier: Tier }

/** running: the agents are looking (or were, when the phone locked); done; stopped: he ended it or it failed (what
 *  was filed is kept); no-sides: the question has no yes and no; refused: the API declined the whole chain. */
export type InquiryState = 'running' | 'done' | 'stopped' | 'no-sides' | 'refused';

/** One agent's place in its loop, kept so a run cut short picks up at the last finished turn. `messages` is the
 *  API conversation exactly as sent and received (thinking blocks whole, only ever appended to). */
export interface Trail {
  messages: unknown[];
  turns: number;
  searches: number;
  filed: Pick[];
  done: boolean;
}

/** A whole run's place: the two searchers, the check once it has begun, and whether the check has ruled. */
export interface RunSnapshot {
  for: Trail;
  against: Trail;
  check?: Trail;
  /** The check's rulings so far: paperId to the side it stands on, or 'neither'. */
  ruled?: Record<string, Side | 'neither'>;
  /** Every paper a search has returned in this run, by id: the only ids `file` and `rule` will take. */
  known: Record<string, Paper>;
}

/** A question asked (the `inquiries` table). `question` is private text and sealed at rest. `runs` is there only
 *  while state is 'running'. `earlier` keeps what a re-asked question held before, shown struck. */
export interface Inquiry {
  id: string;
  askedAt: number;
  question: string;
  state: InquiryState;
  picks: Pick[];
  runs?: RunSnapshot;
  earlier?: { askedAt: number; picks: Pick[] }[];
}

// ---- the indexes (Q1: src/research/indexes.ts exports `search: Search` and `lookup`) ----

export interface SearchArgs { query: string; index: 'europepmc' | 'openalex'; tier: 1 | 2 }
export interface SearchOpts { signal?: AbortSignal; openAlexKey?: string; fetch?: typeof fetch; now?: () => number }
/** Up to eight papers, each with an abstract, none retracted, every one of the tier asked for. */
export type Search = (args: SearchArgs, opts?: SearchOpts) => Promise<Paper[]>;

// ---- the run (Q3: src/research/agents.ts exports `runInquiry`) ----

export type RunEvent =
  /** A side has begun or stopped looking (the chip's dot breathes while it is on). */
  | { type: 'looking'; side: Side; on: boolean }
  /** A paper was filed: write its title in. */
  | { type: 'filed'; pick: Pick; paper: Paper }
  /** The check ruled a filed paper neither, or moved it: lift the line (and, when `to` is set, write it on that side). */
  | { type: 'ruled'; paperId: string; to: Side | 'neither' }
  /** Every turn, after it is finished: persist this so the run can resume. */
  | { type: 'snapshot'; snapshot: RunSnapshot };

/** `why` says what stopped a run that did not finish, for the page's one fixed line: no connection, a key the API
 *  would not take, a rate or spend limit, he ended it (the signal), or anything else. */
export interface RunResult { state: Exclude<InquiryState, 'running'>; picks: Pick[]; why?: 'offline' | 'key' | 'limit' | 'ended' | 'error' }

/** The caps the app enforces (PLAN-RESEARCH.md section 4), not the model. */
export const CAPS = { searches: 8, turns: 12, perSide: 5, results: 8 } as const;
