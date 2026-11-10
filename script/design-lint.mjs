#!/usr/bin/env node
// design-lint: the checkable half of DESIGN.md. Usage: node script/design-lint.mjs <files or dirs...>
// A line ending in a comment containing "design-lint: allow" is skipped (say why in the comment).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (!args.length) { console.error('usage: design-lint <files or dirs...>'); process.exit(64); }
const exts = new Set(['.css', '.html', '.ts', '.tsx', '.js', '.mjs', '.json']);
const files = [];
const walk = p => { const st = fs.statSync(p); if (st.isDirectory()) { for (const n of fs.readdirSync(p)) if (n !== 'node_modules' && n !== 'dist') walk(path.join(p, n)); } else if (exts.has(path.extname(p))) files.push(p); };
args.forEach(walk);

const isTokens = f => /tokens\.css$/.test(f);
const inSrc = f => /(^|\/)src\//.test(f);
const inUi = f => /(^|\/)src\/ui\//.test(f);
const isSound = f => /parts\/Sound\.(ts|tsx)$/.test(f);
const isHaptic = f => /parts\/Haptic\.(ts|tsx)$/.test(f);
const isMusic = f => /(^|\/)src\/music\//.test(f);
const isBeSheet = f => /(^|\/)src\/ui\/be\/(ParadoxSheet|GoalSheet)\.tsx$/.test(f) || /(^|\/)src\/model\/paradox\.ts$/.test(f);

const rules = [
  { id: 'DL1 colour literal outside tokens.css', skip: isTokens, re: /(#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{3}\b(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab)\(\s*[\d.])/ , where: l => !/^\s*\/\//.test(l) },
  { id: 'DL2 font-family outside tokens.css', skip: isTokens, re: /font(?:-family)?\s*:[^;{}]*(?:"[^"]+"|'[^']+'|(?<![-\w])(?:serif|sans-serif|system-ui|monospace|cursive|ui-serif|ui-sans-serif)(?![-\w]))/ },
  { id: 'DL4 external resource', re: /(@import\b|url\(\s*["']?https?:|<link[^>]+href=["']https?:|<script[^>]+src=["']https?:)/ },
  { id: 'DL17 duration literal outside tokens.css', skip: isTokens, re: /\b(?:transition|animation)(?:-duration|-delay)?\s*:[^;{}]*\b\d+(?:\.\d+)?m?s\b/ },
  { id: 'DL8 modal dialog', re: /(<dialog\b|role=["']dialog["']|\.showModal\(|\b(?:alert|confirm|prompt)\s*\()/ },
  { id: 'DL7 icon library', re: /\b(lucide|heroicons|font-?awesome|phosphor-icons|material-icons|tabler-icons|ionicons|react-icons)\b/i },
  { id: 'DL18 navigator.vibrate outside parts/Haptic', skip: isHaptic, re: /navigator\.vibrate/ },
  { id: 'DL20 AudioContext outside parts/Sound', skip: isSound, re: /new\s+(?:window\.)?(?:webkit)?AudioContext|\bHTMLAudioElement\b|<audio\b/ },
  { id: 'DL21 fetch outside src/music', only: f => inSrc(f) && !isMusic(f), re: /\bfetch\s*\(|new\s+XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket/ },
  // DESIGN.md rule 10: delete is entire, so it is reached only through the two Be sheets' two-tap row (PLAN-SELF.md 3.2)
  { id: 'DL10 deleteParadox or deleteGoal outside the Be sheets', only: f => inSrc(f) && !isBeSheet(f), re: /\b(?:deleteParadox|deleteGoal)\s*\(/ },
  { id: 'DL14 streaks and badges', only: inUi, re: /\b(streak|confetti|badge|leaderboard)\b/i },
];

let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  for (const r of rules) {
    if (r.skip && r.skip(f)) continue;
    if (r.only && !r.only(f)) continue;
    lines.forEach((l, i) => {
      if (/design-lint:\s*allow/.test(l)) return;
      if (r.where && !r.where(l)) return;
      if (r.re.test(l)) { bad++; console.log(`${f}:${i + 1}  ${r.id}\n    ${l.trim().slice(0, 110)}`); }
    });
  }
  // DL17b: a file that animates must honour reduced motion
  if (/animation\s*:/.test(src) && !/prefers-reduced-motion/.test(src)) { bad++; console.log(`${f}  DL17 animation without a prefers-reduced-motion rule`); }
}
console.log(`${bad ? 'FAIL' : 'PASS'}  design-lint: ${files.length} files, ${bad} finding${bad === 1 ? '' : 's'}`);
process.exit(bad ? 1 : 0);
