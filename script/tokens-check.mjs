#!/usr/bin/env node
// tokens:check. src/ui/tokens.css ships unchanged from design/tokens.css (DESIGN.md section 2), and the
// walkthrough's copies of the app's own CSS (design/parts.css, the mountain's design/mountain.css and design/gate.css, and the sign's page's design/chakra.css) and of itself (design/index.html, the
// file a published artifact opens on) must match their sources. Any difference fails.
import fs from 'node:fs';

const pairs = [
  ['design/tokens.css', 'src/ui/tokens.css', 'cp design/tokens.css src/ui/tokens.css'],
  ['src/ui/parts/parts.css', 'design/parts.css', 'cp src/ui/parts/parts.css design/parts.css'],
  ['src/ui/flow/mountain/mountain.css', 'design/mountain.css', 'cp src/ui/flow/mountain/mountain.css design/mountain.css'],
  ['src/ui/parts/gate.css', 'design/gate.css', 'cp src/ui/parts/gate.css design/gate.css'],
  // PLAN-TASKS.md T5: the sign's shelf and the ♪ sheet's Signs segment, for the walkthrough's shelf steps
  ['src/ui/flow/chakra/SignShelf.css', 'design/sign-shelf.css', 'cp src/ui/flow/chakra/SignShelf.css design/sign-shelf.css'],
  ['src/ui/flow/chakra/chakra.css', 'design/chakra.css', 'cp src/ui/flow/chakra/chakra.css design/chakra.css'],
  ['design/walkthrough.html', 'design/index.html', 'cp design/walkthrough.html design/index.html'],
];
let bad = 0;
for (const [src, copy, fix] of pairs) {
  const a = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : null;
  const b = fs.existsSync(copy) ? fs.readFileSync(copy, 'utf8') : null;
  if (a === null || b === null) { bad++; console.log(`missing: ${a === null ? src : copy}`); continue; }
  if (a !== b) {
    bad++;
    const al = a.split('\n'), bl = b.split('\n');
    const i = al.findIndex((l, k) => l !== bl[k]);
    console.log(`${copy} differs from ${src} at line ${i + 1}\n  - ${al[i] ?? ''}\n  + ${bl[i] ?? ''}\n  fix: ${fix}`);
  }
}
console.log(`${bad ? 'FAIL' : 'PASS'}  tokens:check: ${pairs.length} pairs, ${bad} differing`);
process.exit(bad ? 1 : 0);
