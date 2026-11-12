// Q1 (PLAN-RESEARCH.md sections 3 and 6): the paper indexes, from saved responses only, no live call. The fixtures
// under test/fixtures/research are real Europe PMC, OpenAlex and Crossref records (generic queries: expressive
// writing, intermittent fasting), trimmed to the fields the client reads, with a retracted record, a retraction
// notice, a letter, a meeting abstract and a book set in among the hits so each rule meets a real case.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  search, lookup, mergeByDoi, IndexError, plainText, sectionsOf, fromInverted, epmcKind, epmcQuery, oaFilter,
} from '../../src/research/indexes';
import { CAPS, type Paper } from '../../src/research/types';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/research/${name}.json`, import.meta.url), 'utf8'));
const NOW = 1_763_000_000_000;
const now = () => NOW;

/** A fetch stub answering one body (or status), and keeping every URL asked. */
function stub(body: unknown, status = 200) {
  const urls: string[] = [];
  const fetch = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return new Response(JSON.stringify(body), { status });
  }) as typeof globalThis.fetch;
  return { fetch, urls };
}
/** The Europe PMC fixture with only the records whose ids are given, in that order. */
const epmcOnly = (name: string, ids: string[]) => {
  const all = fixture(name);
  const byId = new Map((all.resultList.result as { id: string }[]).map(r => [r.id, r]));
  return { ...all, resultList: { result: ids.map(id => byId.get(id)) } };
};
const oaOnly = (name: string, ids: string[]) => {
  const all = fixture(name);
  const byId = new Map((all.results as { id: string }[]).map(r => [r.id.replace('https://openalex.org/', ''), r]));
  return { ...all, results: ids.map(id => byId.get(id)) };
};

describe('Europe PMC, tier 1', () => {
  it('keeps journal articles and reviews in relevance order, drops retractions, notices, letters, meeting abstracts, books and no-abstract records, and stops at eight', async () => {
    const s = stub(fixture('europepmc-tier1'));
    const got = await search({ query: 'expressive writing', index: 'europepmc', tier: 1 }, { fetch: s.fetch, now });
    expect(got).toHaveLength(CAPS.results);
    expect(got.map(p => p.id)).toEqual([
      'doi:10.1111/famp.70206', // Meta-Analysis
      'doi:10.1111/acer.70412', // Randomized Controlled Trial
      // 39695671 Retracted Publication, PMC13444288 meeting abstract, 41457010 letter, PMC13644249 retraction note: out
      'doi:10.17912/micropub.biology.002408',
      // 28211668 a GeneReviews book chapter ("Book", "Review", no "Journal Article"): out
      'europepmc:7623671', // no DOI
      'doi:10.1080/10410236.2026.2749454',
      'doi:10.1016/j.soncn.2026.152394',
      'doi:10.1016/j.actpsy.2026.107843',
      'doi:10.1177/13591053261499814',
    ]);
    expect(got.every(p => p.tier === 1 && p.source === 'europepmc' && p.fetchedAt === NOW && p.abstract.length > 0)).toBe(true);
  });

  it('maps a record with a DOI to the doi id and a doi.org link, the journal and the year as the index holds them', async () => {
    const [p] = await search({ query: 'q', index: 'europepmc', tier: 1 }, { fetch: stub(epmcOnly('europepmc-tier1', ['42853002'])).fetch, now });
    expect(p).toMatchObject<Partial<Paper>>({
      id: 'doi:10.1111/famp.70206', doi: '10.1111/famp.70206', url: 'https://doi.org/10.1111/famp.70206',
      title: 'The Effectiveness of Expressive Writing Interventions on the Psychosocial Health of Family Caregivers: A Meta-Analysis.',
      journal: 'Family process', year: 2026, kind: 'Meta-analysis', tier: 1, source: 'europepmc', fetchedAt: NOW,
    });
    // the abstract word for word, one section, its thin spaces kept
    expect(p.abstract).toHaveLength(1);
    expect(p.abstract[0].head).toBeUndefined();
    expect(p.abstract[0].text).toContain('(SMD = -0.22; p = 0.041)');
    expect(p.abstract[0].text.endsWith('psychosocial outcomes in family caregivers.')).toBe(true);
  });

  it('with no DOI, the id is the index id and the link is its Europe PMC page', async () => {
    const [p] = await search({ query: 'q', index: 'europepmc', tier: 1 }, { fetch: stub(epmcOnly('europepmc-tier1', ['7623671'])).fetch, now });
    expect(p.id).toBe('europepmc:7623671');
    expect(p.doi).toBeUndefined();
    expect(p.url).toBe('https://europepmc.org/article/MED/7623671');
    expect(p.kind).toBe('Journal article');
  });

  it('turns <h4> heads into section heads and strips inline tags, whole', async () => {
    const [p] = await search({ query: 'q', index: 'europepmc', tier: 1 }, { fetch: stub(epmcOnly('europepmc-tier1', ['42852269'])).fetch, now });
    expect(p.abstract.map(s => s.head)).toEqual(['Objective', 'Methods', 'Results', 'Conclusion']);
    expect(p.abstract[0].text.startsWith('The gut microbiome is a critical regulator of host metabolism')).toBe(true);
    expect(p.abstract.every(s => !/<\/?[a-z]/i.test(s.text))).toBe(true);
    // a bare "<" in the words is the record's own and stays
    expect(p.abstract.some(s => s.text.includes('p\u202f<\u202f0.05'))).toBe(true);
    // nothing cut: every word of the record, heads and text, is there in order
    const raw: string = epmcOnly('europepmc-tier1', ['42852269']).resultList.result[0].abstractText;
    const words = (s: string) => s.replace(/<\/?h4>/g, ' ').replace(/<\/?[a-z][^>]*>/gi, '').split(/\s+/).filter(Boolean);
    expect(p.abstract.flatMap(s => [...(s.head ? words(s.head) : []), ...words(s.text)])).toEqual(words(raw));
  });

  it('decodes an escaped <i> in a title and strips a real one in an abstract, keeping the full stop', async () => {
    const [p] = await search({ query: 'q', index: 'europepmc', tier: 1 }, { fetch: stub(epmcOnly('europepmc-tier1', ['42953508'])).fetch, now });
    expect(p.title).toBe('A simplified intermittent fasting regimen robustly extends C. elegans lifespan without FUdR or antibiotic confounds.');
    expect(p.abstract[0].text).toContain('including Caenorhabditis elegans . However');
  });

  it('labels kinds by the best evidence the record carries', async () => {
    const got = await search({ query: 'q', index: 'europepmc', tier: 1 }, { fetch: stub(epmcOnly('europepmc-tier1', ['42853002', '43002129', '42949254', '42738975', '42072957', '42885302'])).fetch, now });
    expect(got.map(p => p.kind)).toEqual(['Meta-analysis', 'Randomised trial', 'Review', 'Review', 'Review', 'Journal article']);
    expect(epmcKind(['Systematic Review', 'Meta-Analysis', 'Journal Article'])).toBe('Meta-analysis');
    expect(epmcKind(['Review', 'Systematic Review', 'Journal Article'])).toBe('Systematic review');
    expect(epmcKind(['Randomized Controlled Trial', 'Review', 'Journal Article'])).toBe('Randomised trial');
    expect(epmcKind(['English Abstract', 'Journal Article'])).toBe('Journal article');
  });

  it('pushes the tier, the abstract and the retractions into the query, and asks for JSON core records', async () => {
    const s = stub({ resultList: { result: [] } });
    expect(await search({ query: 'expressive writing', index: 'europepmc', tier: 1 }, { fetch: s.fetch })).toEqual([]);
    const url = new URL(s.urls[0]);
    expect(url.origin + url.pathname).toBe('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('resultType')).toBe('core');
    expect(url.searchParams.get('query')).toBe(epmcQuery('expressive writing', 1));
    expect(epmcQuery('x', 1)).toContain('(SRC:MED OR SRC:PMC)');
    expect(epmcQuery('x', 1)).toContain('HAS_ABSTRACT:y');
    expect(epmcQuery('x', 1)).toContain('NOT PUB_TYPE:"Retracted Publication"');
    expect(epmcQuery('x', 2)).toContain('SRC:PPR');
  });

  it('a tier 1 search never returns a preprint, even when the index sends one', async () => {
    expect(await search({ query: 'q', index: 'europepmc', tier: 1 }, { fetch: stub(fixture('europepmc-tier2')).fetch, now })).toEqual([]);
  });
});

describe('Europe PMC, tier 2', () => {
  it('maps preprints, with the server as the journal, and each <p> its own section', async () => {
    const got = await search({ query: 'expressive writing', index: 'europepmc', tier: 2 }, { fetch: stub(fixture('europepmc-tier2')).fetch, now });
    expect(got).toHaveLength(4);
    expect(got.every(p => p.tier === 2 && p.kind === 'Preprint, not peer reviewed')).toBe(true);
    expect(got[0]).toMatchObject({ id: 'doi:10.31234/osf.io/gve7w', url: 'https://doi.org/10.31234/osf.io/gve7w', journal: 'PsyArXiv', year: 2026 });
    expect(got[0].abstract).toHaveLength(1);
    expect(got[0].abstract[0].text.startsWith('The words people use provide important insights')).toBe(true);
    expect(got[0].abstract[0].text.endsWith('through everyday language.')).toBe(true);
  });

  it('a tier 2 search never returns a journal paper', async () => {
    expect(await search({ query: 'q', index: 'europepmc', tier: 2 }, { fetch: stub(fixture('europepmc-tier1')).fetch, now })).toEqual([]);
  });
});

describe('OpenAlex, tier 1', () => {
  it('keeps published journal articles and reviews, drops the retracted one and the one with no abstract, stops at eight', async () => {
    const got = await search({ query: 'expressive writing', index: 'openalex', tier: 1 }, { fetch: stub(fixture('openalex-tier1')).fetch, now });
    expect(got).toHaveLength(CAPS.results);
    expect(got.map(p => p.id)).toEqual([
      'doi:10.1177/1745691617707315',
      // W4405540946 is_retracted, W2071766083 no abstract: out
      'openalex:W2901218898', // no DOI
      'doi:10.1192/apt.11.5.338',
      'doi:10.1037/xap0000013',
      'doi:10.1037/0096-3445.130.3.520',
      'doi:10.5465/256708',
      'doi:10.1037/1528-3542.8.2.302',
      'doi:10.1002/jclp.20810',
    ]);
    expect(got.every(p => p.tier === 1 && p.source === 'openalex' && p.kind === 'Journal article')).toBe(true);
  });

  it('rebuilds the inverted index in position order as one section with no head', async () => {
    const [p] = await search({ query: 'q', index: 'openalex', tier: 1 }, { fetch: stub(oaOnly('openalex-tier1', ['W2764161243'])).fetch, now });
    expect(p).toMatchObject({ id: 'doi:10.1177/1745691617707315', url: 'https://doi.org/10.1177/1745691617707315', title: 'Expressive Writing in Psychological Science', journal: 'Perspectives on Psychological Science', year: 2017 });
    expect(p.abstract).toHaveLength(1);
    expect(p.abstract[0].head).toBeUndefined();
    expect(p.abstract[0].text.startsWith('The 1997 Psychological Science paper "Writing About Emotional Experiences as a Therapeutic Process" summarized the results of')).toBe(true);
    expect(fromInverted({ b: [1, 3], a: [0], c: [2] })).toEqual([{ text: 'a b c b' }]);
    expect(fromInverted(null)).toEqual([]);
  });

  it('with no DOI, the id is the work id and the link is its landing page', async () => {
    const [p] = await search({ query: 'q', index: 'openalex', tier: 1 }, { fetch: stub(oaOnly('openalex-tier1', ['W2901218898'])).fetch, now });
    expect(p.id).toBe('openalex:W2901218898');
    expect(p.doi).toBeUndefined();
    expect(p.url).toBe('https://ejournal.atmajaya.ac.id/index.php/Manasa/article/view/144');
    const bare = oaOnly('openalex-tier1', ['W2901218898']);
    bare.results[0] = { ...bare.results[0], primary_location: { ...bare.results[0].primary_location, landing_page_url: null } };
    const [q] = await search({ query: 'q', index: 'openalex', tier: 1 }, { fetch: stub(bare).fetch, now });
    expect(q.url).toBe('https://openalex.org/W2901218898');
  });

  it('labels a review Review, and a journal article that is not the published version is no tier', async () => {
    const [r] = await search({ query: 'q', index: 'openalex', tier: 1 }, { fetch: stub(oaOnly('openalex-tier1', ['W2000497654'])).fetch, now });
    expect(r.kind).toBe('Review');
    const accepted = oaOnly('openalex-tier1', ['W2000497654']);
    accepted.results[0] = { ...accepted.results[0], primary_location: { ...accepted.results[0].primary_location, version: 'acceptedVersion' } };
    expect(await search({ query: 'q', index: 'openalex', tier: 1 }, { fetch: stub(accepted).fetch, now })).toEqual([]);
    expect(await search({ query: 'q', index: 'openalex', tier: 2 }, { fetch: stub(accepted).fetch, now })).toEqual([]);
  });

  it('sends the tier filter, the fields it reads, and the key only when there is one', async () => {
    const s = stub({ results: [] });
    await search({ query: 'expressive writing', index: 'openalex', tier: 1 }, { fetch: s.fetch });
    await search({ query: 'expressive writing', index: 'openalex', tier: 2 }, { fetch: s.fetch, openAlexKey: 'KEY' });
    const [a, b] = s.urls.map(u => new URL(u));
    expect(a.origin + a.pathname).toBe('https://api.openalex.org/works');
    expect(a.searchParams.get('search')).toBe('expressive writing');
    expect(a.searchParams.get('filter')).toBe(oaFilter(1));
    expect(oaFilter(1)).toContain('primary_location.source.type:journal');
    expect(oaFilter(1)).toContain('is_retracted:false');
    expect(a.searchParams.has('api_key')).toBe(false);
    expect(b.searchParams.get('filter')).toBe(oaFilter(2));
    expect(b.searchParams.get('api_key')).toBe('KEY');
  });
});

describe('OpenAlex, tier 2', () => {
  it('maps repository articles as preprints, chapters and dissertations by their type, and drops the chapter with no abstract', async () => {
    const got = await search({ query: 'intermittent fasting', index: 'openalex', tier: 2 }, { fetch: stub(fixture('openalex-tier2')).fetch, now });
    expect(got.map(p => [p.id, p.kind, p.tier])).toEqual([
      ['doi:10.5281/zenodo.18157121', 'Preprint, not peer reviewed', 2],
      ['doi:10.22038/jnfh.2018.30667.1111', 'Preprint, not peer reviewed', 2],
      ['openalex:W3021544097', 'Preprint, not peer reviewed', 2],
      ['doi:10.5772/intechopen.1010918', 'Book chapter', 2],
      ['openalex:W7128332315', 'Thesis', 2],
      // W4241029879, an Elsevier chapter with no abstract: out
    ]);
    expect(got[2].url).toBe('https://digitalcommons.liberty.edu/honors/999');
    expect(got[3].journal).toBe('IntechOpen eBooks');
  });

  it('a conference paper and a report have their own labels; a tier 2 search drops journal papers', async () => {
    const one = oaOnly('openalex-tier2', ['W7118634757']).results[0];
    const body = { results: [
      { ...one, id: 'https://openalex.org/W1', doi: null, primary_location: { ...one.primary_location, source: { display_name: 'A Conference', type: 'conference' } } },
      { ...one, id: 'https://openalex.org/W2', doi: null, type: 'report' },
      ...fixture('openalex-tier1').results.slice(0, 1),
    ] };
    const got = await search({ query: 'q', index: 'openalex', tier: 2 }, { fetch: stub(body).fetch, now });
    expect(got.map(p => [p.id, p.kind])).toEqual([['openalex:W1', 'Conference paper'], ['openalex:W2', 'Report']]);
  });
});

describe('text', () => {
  it('strips tags, decodes entities, and leaves a bare "<" in the words alone', () => {
    expect(plainText('Effect of <i>Lactobacillus</i> on IL-1&#x3b2; (p&lt;0.05) &amp; more')).toBe('Effect of Lactobacillus on IL-1β (p<0.05) & more');
    expect(plainText('H<sub>2</sub>O and 10<sup>3</sup> cells, p < .01')).toBe('H2O and 103 cells, p < .01');
    expect(plainText('a &lt;b&gt;bold&lt;/b&gt; claim, &unknown; kept.')).toBe('a bold claim, &unknown; kept.');
  });

  it('trims a head\'s trailing colon and keeps text before the first head as a section of its own', () => {
    expect(sectionsOf('Lead in.<h4>Aims: </h4>To see.<h4>Methods</h4><p>One.</p><p>Two.</p>', /<h4\b[^>]*>([\s\S]*?)<\/h4>/gi)).toEqual([
      { text: 'Lead in.' }, { head: 'Aims', text: 'To see.' }, { head: 'Methods', text: 'One.' }, { text: 'Two.' },
    ]);
  });
});

describe('mergeByDoi', () => {
  it('keeps one row an id, the first, in order', () => {
    const p = (id: string, title: string) => ({ id, title, abstract: [{ text: 't' }], kind: 'Journal article', tier: 1, url: 'u', source: 'europepmc', fetchedAt: 0 }) as Paper;
    const merged = mergeByDoi([p('doi:a', 'one'), p('openalex:W1', 'two'), p('doi:a', 'three'), p('doi:b', 'four'), p('openalex:W1', 'five')]);
    expect(merged.map(x => x.title)).toEqual(['one', 'two', 'four']);
    expect(mergeByDoi([])).toEqual([]);
  });
});

describe('Crossref lookup', () => {
  it('returns a paper when Crossref holds an abstract, its <jats:title> heads as section heads', async () => {
    const s = stub(fixture('crossref-abstract'));
    const p = await lookup('https://doi.org/10.1108/09654280610637201', { fetch: s.fetch, now });
    expect(s.urls[0]).toBe('https://api.crossref.org/works/10.1108%2F09654280610637201');
    expect(p).toMatchObject({
      id: 'doi:10.1108/09654280610637201', doi: '10.1108/09654280610637201', url: 'https://doi.org/10.1108/09654280610637201',
      title: 'Health‐related effects of creative and expressive writing', journal: 'Health Education', year: 2006,
      kind: 'Journal article', tier: 1, source: 'crossref', fetchedAt: NOW,
    });
    expect(p!.abstract.map(s => s.head)).toEqual(['Purpose', 'Design/methodology/approach', 'Findings', 'Originality/value']);
    expect(p!.abstract[0].text).toBe('The purpose of this paper is to provide an overview of some health‐related effects of creative and expressive writing.');
    expect(p!.abstract.every(s => !/[<>]/.test(s.text))).toBe(true);
  });

  it('a plain <jats:p> abstract is one section with no head', async () => {
    const p = await lookup('10.3390/nu14030631', { fetch: stub(fixture('crossref-plain')).fetch, now });
    expect(p?.abstract).toHaveLength(1);
    expect(p?.abstract[0].head).toBeUndefined();
    expect(p?.title).toBe('Intermittent Fasting and Metabolic Health');
  });

  it('is undefined with no abstract, when retracted, and for a DOI Crossref does not know', async () => {
    expect(await lookup('10.1016/j.jand.2015.02.018', { fetch: stub(fixture('crossref-none')).fetch })).toBeUndefined();
    expect(await lookup('10.1186/s12986-024-00876-y', { fetch: stub(fixture('crossref-retracted')).fetch })).toBeUndefined();
    expect(await lookup('10.9999/nothing', { fetch: stub('Resource not found.', 404).fetch })).toBeUndefined();
    expect(await lookup('  ')).toBeUndefined();
  });
});

describe('when an index does not answer', () => {
  it('a 429 is a limit, another refusal is http', async () => {
    const limit = await search({ query: 'q', index: 'openalex', tier: 1 }, { fetch: stub({}, 429).fetch }).catch(e => e);
    expect(limit).toBeInstanceOf(IndexError);
    expect(limit).toMatchObject({ kind: 'limit', index: 'openalex', status: 429 });
    const http = await search({ query: 'q', index: 'europepmc', tier: 1 }, { fetch: stub({}, 503).fetch }).catch(e => e);
    expect(http).toMatchObject({ kind: 'http', index: 'europepmc', status: 503 });
    const lookupLimit = await lookup('10.1/x', { fetch: stub({}, 429).fetch }).catch(e => e);
    expect(lookupLimit).toMatchObject({ kind: 'limit', index: 'crossref' });
  });

  it('a network failure is offline', async () => {
    const down = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;
    const e = await search({ query: 'q', index: 'europepmc', tier: 2 }, { fetch: down }).catch(x => x);
    expect(e).toBeInstanceOf(IndexError);
    expect(e.kind).toBe('offline');
  });

  it('an unreadable reply is http', async () => {
    const garbled = (async () => new Response('<html>', { status: 200 })) as typeof fetch;
    expect(await search({ query: 'q', index: 'openalex', tier: 1 }, { fetch: garbled }).catch(e => e)).toMatchObject({ kind: 'http' });
  });

  it('an aborted signal rethrows the abort, before the request and during it', async () => {
    const before = new AbortController();
    before.abort();
    const s = stub(fixture('europepmc-tier1'));
    const e1 = await search({ query: 'q', index: 'europepmc', tier: 1 }, { fetch: s.fetch, signal: before.signal }).catch(e => e);
    expect(e1).not.toBeInstanceOf(IndexError);
    expect(e1.name).toBe('AbortError');
    expect(s.urls).toEqual([]);

    const during = new AbortController();
    const hang = ((_u: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
    })) as typeof fetch;
    const pending = search({ query: 'q', index: 'openalex', tier: 1 }, { fetch: hang, signal: during.signal }).catch(e => e);
    during.abort();
    const e2 = await pending;
    expect(e2).not.toBeInstanceOf(IndexError);
    expect(e2.name).toBe('AbortError');
  });

  it('a blank query asks nothing', async () => {
    const s = stub({});
    expect(await search({ query: '   ', index: 'openalex', tier: 1 }, { fetch: s.fetch })).toEqual([]);
    expect(s.urls).toEqual([]);
  });
});
