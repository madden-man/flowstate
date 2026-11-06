#!/usr/bin/env node
// Draws the app icon: a thin moon on the cream page, in ink. Colours come from tokens.css (day).
// Writes public/icon.svg and renders the PNGs with Playwright's Chromium (npx playwright install chromium).
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const tokens = fs.readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
const day = tokens.match(/:root, \[data-light="day"\] \{[\s\S]*?\n\}/)[0];
const tok = n => day.match(new RegExp(`--${n}:\\s*(#[0-9A-Fa-f]{6})`))[1];
const page = tok('page'), ink = tok('ink');

// The moon is the header's crescent: lit on the right, a thin rim. It sits inside the maskable safe zone.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="${page}"/>
<mask id="m"><rect width="512" height="512" fill="white"/><circle cx="190" cy="244" r="142" fill="black"/></mask>
<circle cx="224" cy="256" r="140" fill="${ink}" mask="url(#m)"/>
</svg>
`;
fs.mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../public/icon.svg', import.meta.url), svg);

const browser = await chromium.launch();
const pg = await browser.newPage();
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-512-maskable.png', 512]]) {
  await pg.setViewportSize({ width: size, height: size });
  await pg.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await pg.screenshot({ path: new URL(`../public/${name}`, import.meta.url).pathname, omitBackground: false });
  console.log(`public/${name} ${size}px`);
}
await browser.close();
