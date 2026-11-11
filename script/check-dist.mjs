#!/usr/bin/env node
// The built app makes no network request after the first load (DESIGN.md rule 22, PLAN.md section 2).
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
  // (a minified build may name the id's variable with a $, as $p: still the same template, not a URL)
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
