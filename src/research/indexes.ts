// The paper indexes (PLAN-RESEARCH.md section 3, package Q1): Europe PMC and OpenAlex searched, Crossref looked up
// by DOI, every record brought to one `Paper` (types.ts). Nothing here is model text and nothing is reworded: a
// title and an abstract are the index's own, with only the markup taken off. Peer reviewed is read from the
// record (the tier), never asked of a model; a retracted paper or one with no abstract never leaves this file.
// Plain fetch, no key needed (an OpenAlex key only raises the daily budget), no personal detail in any request.
import { CAPS, type AbstractSection, type Paper, type Search, type SearchOpts, type Source, type Tier } from './types';

const EUROPE_PMC = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';
const OPENALEX = 'https://api.openalex.org/works';
const CROSSREF = 'https://api.crossref.org/works/';

/** Asked of an index a search, more than the eight kept, so the client's own filter (tier, retraction, abstract)
 *  still leaves eight where the index has them. */
const ASKED = 25;

// ---- failures ---------------------------------------------------------

/** The index did not answer: no connection (offline), a rate limit (limit, HTTP 429), or any other refusal or
 *  unreadable reply (http). The agents' loop (Q3) turns this into "the index did not answer" for the model. */
export class IndexError extends Error {
  constructor(readonly kind: 'offline' | 'limit' | 'http', readonly index: Source, readonly status?: number) {
    super(`${index} ${kind}${status ? ` ${status}` : ''}`);
    this.name = 'IndexError';
  }
}

const isAbort = (e: unknown, signal?: AbortSignal) =>
  signal?.aborted === true || (e instanceof Error && e.name === 'AbortError') || (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError');

/** One GET as JSON. An aborted signal rethrows the abort as it came; a 404 is `undefined` when `missing` is set
 *  (a DOI Crossref has never heard of is not a failure). */
async function getJson(url: string, index: Source, opts: SearchOpts, missing = false): Promise<unknown> {
  opts.signal?.throwIfAborted();
  const f = opts.fetch ?? globalThis.fetch;
  let res: Response;
  try {
    res = await f(url, { signal: opts.signal });
  } catch (e) {
    if (isAbort(e, opts.signal)) throw e;
    throw new IndexError('offline', index);
  }
  if (res.status === 429) throw new IndexError('limit', index, 429);
  if (res.status === 404 && missing) return undefined;
  if (!res.ok) throw new IndexError('http', index, res.status);
  try {
    return await res.json();
  } catch (e) {
    if (isAbort(e, opts.signal)) throw e;
    throw new IndexError('http', index, res.status);
  }
}

// ---- text: markup off, words kept --------------------------------------

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', thinsp: '\u2009', ensp: '\u2002', emsp: '\u2003',
  ndash: '\u2013', mdash: '\u2014', hellip: '\u2026', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
  times: '\u00d7', plusmn: '\u00b1', le: '\u2264', ge: '\u2265', deg: '\u00b0', micro: '\u00b5', middot: '\u00b7',
  minus: '\u2212', alpha: '\u03b1', beta: '\u03b2', gamma: '\u03b3', delta: '\u03b4', kappa: '\u03ba', mu: '\u03bc',
  chi: '\u03c7', eacute: '\u00e9', ouml: '\u00f6', uuml: '\u00fc', auml: '\u00e4', copy: '\u00a9', reg: '\u00ae',
};

/** Decodes numeric and the common named entities once; an unknown name is left as written. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[name] ?? NAMED[name.toLowerCase()] ?? whole;
  });
}

// A raw tag must start with a letter (so "p<0.05" and "p < .05" stay as text). After decoding, only the inline
// names the indexes are seen to escape are taken off ("&lt;i&gt;C. elegans&lt;/i&gt;" in a Europe PMC title),
// so a decoded "<" in the words themselves is never eaten.
const RAW_TAG = /<\/?[a-z][\w.:-]*(?:\s[^<>]*)?\/?>/gi;
const ESCAPED_TAG = /<\/?(?:i|b|u|em|strong|sup|sub|sc|span|p|br|h[1-6]|italic|bold|jats:[\w-]+|mml:[\w-]+)(?:\s[^<>]*)?\/?>/gi;

/** Tags off, entities decoded, line breaks and runs of plain spaces made one space, ends trimmed. */
export function plainText(s: string): string {
  return decodeEntities(s.replace(RAW_TAG, '')).replace(ESCAPED_TAG, '').replace(/[ \t\r\n]+/g, ' ').trim();
}

/** A section head as print: its text, without the trailing colon and spaces. */
const headText = (s: string) => plainText(s).replace(/[\s:]+$/, '');

/** Cuts marked-up abstract text into sections: `heads` finds a section head (Europe PMC's `<h4>`, Crossref's
 *  `<jats:title>`), and each paragraph (`<p>`, `<jats:p>`, `<br>`) is a section of its own, the first under its
 *  head. Every word is kept in order; only empty pieces are dropped. */
export function sectionsOf(markup: string, heads: RegExp): AbstractSection[] {
  const out: AbstractSection[] = [];
  const paragraphs = (body: string, head?: string) => {
    const parts = body.split(/<\/?(?:jats:)?p\b[^>]*>|<br\s*\/?>/i).map(plainText).filter(Boolean);
    parts.forEach((text, i) => out.push(i === 0 && head ? { head, text } : { text }));
  };
  let at = 0;
  let head: string | undefined;
  for (const m of markup.matchAll(heads)) {
    paragraphs(markup.slice(at, m.index), head);
    head = headText(m[1]) || undefined;
    at = (m.index ?? 0) + m[0].length;
  }
  paragraphs(markup.slice(at), head);
  // A head with no words under it is not a section of its own (its paragraphs() call pushed nothing).
  return out;
}

const H4 = /<h4\b[^>]*>([\s\S]*?)<\/h4>/gi;
const JATS_TITLE = /<(?:jats:)?title\b[^>]*>([\s\S]*?)<\/(?:jats:)?title>/gi;

/** OpenAlex keeps an abstract as word to positions; the words are laid back in position order, one section. */
export function fromInverted(index: Record<string, number[]> | null | undefined): AbstractSection[] {
  if (!index) return [];
  const at: string[] = [];
  for (const [word, places] of Object.entries(index)) for (const p of places) at[p] = word;
  const text = plainText(at.filter(w => w !== undefined).join(' '));
  return text ? [{ text }] : [];
}

const bareDoi = (doi: string | null | undefined): string | undefined => {
  const d = doi?.trim().replace(/^(?:doi:|https?:\/\/(?:dx\.)?doi\.org\/)/i, '').toLowerCase();
  return d || undefined;
};
const yearOf = (y: unknown): number | undefined => {
  const n = typeof y === 'number' ? y : parseInt(String(y ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Brings the parts of a record to a Paper; `id` and `url` follow the DOI when there is one (types.ts). */
function paper(p: { doi?: string; ownId: string; ownUrl: string; source: Source; title: string; abstract: AbstractSection[]; journal?: string; year?: number; kind: string; tier: Tier }, now: () => number): Paper {
  const out: Paper = {
    id: p.doi ? `doi:${p.doi}` : `${p.source}:${p.ownId}`,
    title: p.title,
    abstract: p.abstract,
    kind: p.kind,
    tier: p.tier,
    url: p.doi ? `https://doi.org/${p.doi}` : p.ownUrl,
    source: p.source,
    fetchedAt: now(),
  };
  if (p.doi) out.doi = p.doi;
  if (p.journal) out.journal = p.journal;
  if (p.year) out.year = p.year;
  return out;
}

// A title that announces a retraction is one, whatever the record's flags say.
const RETRACTION_TITLE = /^\s*(?:\[\s*retracted\b|retracted\b|retraction\b|notice of retraction\b|withdrawn\b)/i;

// ---- Europe PMC --------------------------------------------------------

type EpmcRecord = {
  id: string; source: string; doi?: string; title?: string; pubYear?: string; abstractText?: string;
  pubTypeList?: { pubType?: string[] }; journalInfo?: { journal?: { title?: string } }; bookOrReportDetails?: { publisher?: string };
};

const EPMC_RETRACTED = new Set(['retracted publication', 'retraction of publication', 'retraction notice', 'retraction', 'withdrawn publication']);
// Publication types that are not a journal article or review, though MEDLINE tags them "Journal Article" too.
const EPMC_NOT_ARTICLE = new Set(['letter', 'editorial', 'comment', 'news', 'published erratum', 'erratum', 'correction', 'expression of concern', 'abstract', 'preprint', 'retraction of publication', 'retraction notice']);
const EPMC_ARTICLE = new Set(['journal article', 'research-article', 'review-article']);

/** The best evidence label a record's own publication types carry (types.ts), journal papers only. */
export function epmcKind(types: string[]): string {
  const t = types.map(s => s.toLowerCase());
  if (t.some(s => s === 'meta-analysis')) return 'Meta-analysis';
  if (t.some(s => s === 'systematic review' || s === 'systematic-review')) return 'Systematic review';
  if (t.some(s => /^randomi[sz]ed controlled trial/.test(s))) return 'Randomised trial';
  if (t.some(s => s === 'review' || s === 'review-article' || s.endsWith(' review'))) return 'Review';
  return 'Journal article';
}

/** Tier 1 is a MED or PMC journal article or review; tier 2 a preprint (SRC:PPR). Anything else, any
 *  retraction, and any record with no abstract is no tier at all. */
export function epmcPaper(r: EpmcRecord, now: () => number): Paper | undefined {
  const types = r.pubTypeList?.pubType ?? [];
  const lower = types.map(s => s.toLowerCase());
  const title = plainText(r.title ?? '');
  if (!title || lower.some(t => EPMC_RETRACTED.has(t)) || RETRACTION_TITLE.test(title)) return undefined;
  const abstract = sectionsOf(r.abstractText ?? '', H4);
  if (!abstract.length) return undefined;
  let tier: Tier;
  let kind: string;
  let journal: string | undefined;
  if (r.source === 'MED' || r.source === 'PMC') {
    if (!lower.some(t => EPMC_ARTICLE.has(t)) || lower.some(t => EPMC_NOT_ARTICLE.has(t))) return undefined;
    tier = 1;
    kind = epmcKind(types);
    journal = r.journalInfo?.journal?.title;
  } else if (r.source === 'PPR') {
    tier = 2;
    kind = 'Preprint, not peer reviewed';
    journal = r.bookOrReportDetails?.publisher;
  } else return undefined;
  return paper({
    doi: bareDoi(r.doi), ownId: r.id, ownUrl: `https://europepmc.org/article/${r.source}/${r.id}`, source: 'europepmc',
    title, abstract, journal: journal ? plainText(journal) : undefined, year: yearOf(r.pubYear), kind, tier,
  }, now);
}

/** The Europe PMC query: the agent's words, held in brackets, with the tier, the abstract and the retractions
 *  pushed into the index's own syntax so the eight come from the right shelf. */
export function epmcQuery(query: string, tier: 1 | 2): string {
  const where = tier === 1 ? '(SRC:MED OR SRC:PMC)' : 'SRC:PPR';
  return `(${query}) AND ${where} AND HAS_ABSTRACT:y NOT PUB_TYPE:"Retracted Publication" NOT PUB_TYPE:"Retraction of Publication"`;
}

async function searchEuropePmc(query: string, tier: 1 | 2, opts: SearchOpts, now: () => number): Promise<Paper[]> {
  const url = new URL(EUROPE_PMC);
  url.searchParams.set('query', epmcQuery(query, tier));
  url.searchParams.set('format', 'json');
  url.searchParams.set('resultType', 'core');
  url.searchParams.set('pageSize', String(ASKED));
  const body = await getJson(url.toString(), 'europepmc', opts) as { resultList?: { result?: EpmcRecord[] } } | undefined;
  return (body?.resultList?.result ?? []).map(r => epmcPaper(r, now)).filter((p): p is Paper => !!p && p.tier === tier);
}

// ---- OpenAlex ----------------------------------------------------------

type OaWork = {
  id: string; doi?: string | null; title?: string | null; display_name?: string | null; publication_year?: number | null; type?: string | null;
  primary_location?: { landing_page_url?: string | null; version?: string | null; source?: { display_name?: string | null; type?: string | null } | null } | null;
  is_retracted?: boolean | null; abstract_inverted_index?: Record<string, number[]> | null;
};

/** The tier and kind an OpenAlex work's own type and primary source give it, or none. Tier 1: an article or
 *  review in a journal, the published version. Tier 2: preprints and posted content (an article in a repository
 *  or with no source), conference papers, book chapters, dissertations, reports. */
export function oaTier(w: OaWork): { tier: Tier; kind: string } | undefined {
  const src = w.primary_location?.source?.type ?? undefined;
  switch (w.type) {
    case 'article':
    case 'review':
      if (src === 'journal') return w.primary_location?.version === 'publishedVersion' ? { tier: 1, kind: w.type === 'review' ? 'Review' : 'Journal article' } : undefined;
      if (src === 'conference') return { tier: 2, kind: 'Conference paper' };
      if (src === 'repository' || src === undefined) return { tier: 2, kind: 'Preprint, not peer reviewed' };
      return undefined;
    case 'preprint': return { tier: 2, kind: 'Preprint, not peer reviewed' };
    case 'book-chapter': return { tier: 2, kind: 'Book chapter' };
    case 'dissertation': return { tier: 2, kind: 'Thesis' };
    case 'report': return { tier: 2, kind: 'Report' };
    default: return undefined;
  }
}

export function oaPaper(w: OaWork, now: () => number): Paper | undefined {
  const title = plainText(w.title ?? w.display_name ?? '');
  if (!title || w.is_retracted || w.type === 'retraction' || RETRACTION_TITLE.test(title)) return undefined;
  const place = oaTier(w);
  if (!place) return undefined;
  const abstract = fromInverted(w.abstract_inverted_index);
  if (!abstract.length) return undefined;
  const landing = w.primary_location?.landing_page_url;
  const journal = w.primary_location?.source?.display_name;
  return paper({
    doi: bareDoi(w.doi), ownId: w.id.replace(/^https?:\/\/openalex\.org\//, ''),
    ownUrl: landing && /^https?:\/\//.test(landing) ? landing : w.id, source: 'openalex',
    title, abstract, journal: journal ? plainText(journal) : undefined, year: yearOf(w.publication_year), ...place,
  }, now);
}

/** The OpenAlex filter: the tier pushed as far as the filter syntax goes (one field a clause, so the tier 2
 *  "not a journal" is a negation), retractions and empty abstracts left out by the index itself. */
export function oaFilter(tier: 1 | 2): string {
  return tier === 1
    ? 'is_retracted:false,has_abstract:true,type:article|review,primary_location.source.type:journal,primary_location.version:publishedVersion'
    : 'is_retracted:false,has_abstract:true,type:preprint|article|review|book-chapter|dissertation|report,primary_location.source.type:!journal';
}

const OA_FIELDS = 'id,doi,title,display_name,publication_year,type,primary_location,is_retracted,abstract_inverted_index';

async function searchOpenAlex(query: string, tier: 1 | 2, opts: SearchOpts, now: () => number): Promise<Paper[]> {
  const url = new URL(OPENALEX);
  url.searchParams.set('search', query);
  url.searchParams.set('filter', oaFilter(tier));
  url.searchParams.set('select', OA_FIELDS);
  url.searchParams.set('per-page', String(ASKED));
  if (opts.openAlexKey) url.searchParams.set('api_key', opts.openAlexKey);
  const body = await getJson(url.toString(), 'openalex', opts) as { results?: OaWork[] } | undefined;
  return (body?.results ?? []).map(w => oaPaper(w, now)).filter((p): p is Paper => !!p && p.tier === tier);
}

// ---- the search the agents call (section 4) ------------------------------

/** Up to eight papers of the tier asked for, in the index's relevance order, each with its abstract, none
 *  retracted. A blank query asks nothing. */
export const search: Search = async ({ query, index, tier }, opts = {}) => {
  const q = query.trim();
  if (!q) return [];
  const now = opts.now ?? Date.now;
  const found = index === 'europepmc' ? await searchEuropePmc(q, tier, opts, now) : await searchOpenAlex(q, tier, opts, now);
  return mergeByDoi(found).slice(0, CAPS.results);
};

/** One row an id, the first found kept, the order kept (a paper two indexes both hold is one line). */
export function mergeByDoi(papers: Paper[]): Paper[] {
  const seen = new Set<string>();
  return papers.filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

// ---- Crossref, the fallback by DOI ---------------------------------------

type CrossrefWork = {
  DOI?: string; type?: string; subtype?: string; title?: string[]; 'container-title'?: string[]; abstract?: string;
  issued?: { 'date-parts'?: (number | null)[][] }; published?: { 'date-parts'?: (number | null)[][] };
  'updated-by'?: { type?: string }[];
};

const CROSSREF_KIND: Record<string, { tier: Tier; kind: string }> = {
  'journal-article': { tier: 1, kind: 'Journal article' },
  'posted-content': { tier: 2, kind: 'Preprint, not peer reviewed' },
  'proceedings-article': { tier: 2, kind: 'Conference paper' },
  'book-chapter': { tier: 2, kind: 'Book chapter' },
  dissertation: { tier: 2, kind: 'Thesis' },
  report: { tier: 2, kind: 'Report' },
};

export function crossrefPaper(w: CrossrefWork, now: () => number): Paper | undefined {
  const doi = bareDoi(w.DOI);
  const title = plainText(w.title?.[0] ?? '');
  const place = w.type ? CROSSREF_KIND[w.type] : undefined;
  if (!doi || !title || !place || RETRACTION_TITLE.test(title)) return undefined;
  if ((w['updated-by'] ?? []).some(u => u.type === 'retraction' || u.type === 'withdrawal')) return undefined;
  const abstract = sectionsOf(w.abstract ?? '', JATS_TITLE);
  if (!abstract.length) return undefined;
  const journal = w['container-title']?.[0];
  return paper({
    doi, ownId: doi, ownUrl: `https://doi.org/${doi}`, source: 'crossref', title, abstract,
    journal: journal ? plainText(journal) : undefined, year: yearOf((w.issued ?? w.published)?.['date-parts']?.[0]?.[0]), ...place,
  }, now);
}

/** A paper by its DOI from Crossref, only when Crossref holds an abstract for it (most publishers deposit none),
 *  it is not retracted and its type has a tier. A DOI Crossref does not know is `undefined`, not a failure. */
export async function lookup(doi: string, opts: SearchOpts = {}): Promise<Paper | undefined> {
  const d = bareDoi(doi);
  if (!d) return undefined;
  const body = await getJson(`${CROSSREF}${encodeURIComponent(d)}`, 'crossref', opts, true) as { message?: CrossrefWork } | undefined;
  return body?.message ? crossrefPaper(body.message, opts.now ?? Date.now) : undefined;
}
