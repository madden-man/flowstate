#!/usr/bin/env node
// The built app makes no network request after the first load except from src/music and src/research, each opt-in
// (DESIGN.md rule 22, PLAN.md section 2).
// This scans dist/ for any http(s) URL. A few strings are inert text inside libraries (XML namespaces,
// links inside error messages that are never fetched); they are listed here by name, with the reason.
// Anything else fails. The Playwright smoke test proves the runtime half: no request leaves the origin.
import fs from 'node:fs';
import path from 'node:path';

const INERT = [
  [/^http:\/\/www\.w3\.org\/(2000\/svg|1999\/xhtml|1998\/Math\/MathML)$/, 'XML namespace, never fetched'],
  [/^https:\/\/bit\.ly\/wb-precache$/, 'workbox: text of a console warning'],
  [/^https:\/\/tinyurl\.com\/y2uuvskb$/, 'dexie: text of an error message'],
  [/^http:\/\/bit\.ly\/2kdckMn$/, 'dexie: text of an error message'],
  [/^https:\/\/github\.com\/preactjs\/preact-iso#locationprovider$/, 'preact-iso: text of an error message'],
  // The Spotify tie-in (PLAN.md section 8.1): src/music is the one place allowed to reach out, opt-in and
  // only after Tommy connects. accounts and api are its fetches; open.spotify.com is the playlist link
  // with no account, a navigation. The Playwright music spec proves nothing else leaves the origin.
  [/^https:\/\/accounts\.spotify\.com$/, 'src/music: the PKCE sign-in, opt-in'],
  [/^https:\/\/api\.spotify\.com\/v1$/, 'src/music: the Web API, opt-in'],
  [/^https:\/\/open\.spotify\.com\/playlist\/(\$\{[\w$]+\}|0T6Gzc2hN81u3vGC5IJZ9a)$/, 'src/music: the playlist link, a navigation'],
  [/^https:\/\/open\.spotify\.com\/album\/\$\{[\w$]+\}$/, 'src/music: an album link from a sign\'s shelf with no account (openAlbum), a navigation'],
  // (a minified build may name the id's variable with a $, as $p: still the same template, not a URL)
  // Research (PLAN-RESEARCH.md sections 3 and 4, Q2): src/research is the second place allowed to reach out, opt-in
  // like Spotify: nothing is sent until a key is pasted in Settings and a question is asked. The API's base URL and the
  // three index endpoints are its fetches (a query string after one is still that endpoint, the question as search
  // terms); doi.org and europepmc.org are where a title links, navigations. Each may be a template with its variables
  // in ${...} (a variable or a field of one, as ${e.doi}), named with a $ when minified, as the Spotify links are.
  // Written at Q2 from the plan and Q1's source; Q4's page is the first build to carry them, and they match it.
  [/^https:\/\/api\.anthropic\.com\/?$/, 'src/research: the Anthropic API (the SDK\'s base URL), opt-in'],
  [/^https:\/\/www\.ebi\.ac\.uk\/europepmc\/webservices\/rest\/search(\?\S*)?$/, 'src/research: Europe PMC search, opt-in'],
  [/^https:\/\/api\.openalex\.org\/works(\?\S*)?$/, 'src/research: OpenAlex works, opt-in'],
  [/^https:\/\/api\.crossref\.org\/works\/?(\$\{[\w$.]+\})?(\?\S*)?$/, 'src/research: Crossref lookup by DOI, opt-in'],
  [/^https:\/\/doi\.org\/(\$\{[\w$.]+\})?$/, 'src/research: a title\'s link to its paper by DOI, a navigation'],
  [/^https:\/\/europepmc\.org\/article\/(\$\{[\w$.]+\}\/?)*$/, 'src/research: a title\'s link to its Europe PMC record, a navigation'],
  // The Research walkthrough (design/research/dist, Q6) carries one recorded OpenAlex record, cut from
  // test/fixtures/research/openalex-tier1.json at build time: its work id (data, never fetched) and its DOI in URL form
  // (read into the title's link, a navigation). Only that build carries them; each is listed by name.
  [/^https:\/\/openalex\.org\/W2045642783$/, 'design/research: a recorded OpenAlex work id, never fetched'],
  [/^https:\/\/doi\.org\/10\.1037\/1528-3542\.8\.2\.302$/, 'design/research: a recorded DOI, a title\'s link, a navigation'],
  // The SDK's own inert strings (@anthropic-ai/sdk, loaded by src/research/client.ts in its own chunk, Q4): links inside
  // the text of its errors and console warnings, never fetched. Seen in the build, each by name.
  [/^https:\/\/docs\.expo\.dev\/versions\/latest\/sdk\/expo\/#expofetch-api$/, '@anthropic-ai/sdk: text of a React Native error'],
  [/^https:\/\/docs\.anthropic\.com\/en\/docs\/resources\/model-deprecations$/, '@anthropic-ai/sdk: text of a deprecation warning'],
  [/^https:\/\/platform\.claude\.com\/docs\/en\/build-with-claude\/adaptive-thinking$/, '@anthropic-ai/sdk: text of a thinking-config warning'],
  [/^https:\/\/platform\.claude\.com\/docs\/en\/cli-sdks-libraries\/sdks\/typescript#(streaming-responses|long-requests)$/, '@anthropic-ai/sdk: text of a long-request error'],
];
const dir = process.argv[2] || 'dist';
if (!fs.existsSync(dir)) { console.error(`${dir} not found: run npm run build first`); process.exit(2); }
const files = [];
const walk = p => fs.statSync(p).isDirectory() ? fs.readdirSync(p).forEach(n => walk(path.join(p, n))) : files.push(p);
walk(dir);
let bad = 0, inert = 0;
for (const f of files.filter(f => /\.(html|js|css|json|webmanifest|svg|txt)$/.test(f))) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
    const url = m[0];
    if (INERT.some(([re]) => re.test(url))) { inert++; continue; }
    bad++;
    console.log(`${f}: ${url}`);
  }
}
console.log(`${bad ? 'FAIL' : 'PASS'}  check-dist: ${files.length} files, ${bad} external URL${bad === 1 ? '' : 's'} (${inert} inert library strings allowed by name)`);
process.exit(bad ? 1 : 0);
