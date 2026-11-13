// Research (PLAN-RESEARCH.md section 2, Q4), in the real app with the network routed to a recorded run
// (test/research/recorded.ts, test/fixtures/research/run-writing.json): no key on this machine reaches anything. The
// third circle in the sea opens the blank page; with no key it says where the key goes and nothing leaves the origin;
// a key pasted in Settings, Ask sends the question to the (routed) API and the indexes and nothing else; the titles
// are written in, the check lifts one, the chips filter; Abstract opens the paper's page; Write about it carries the
// title to today's page; Asked lists the question. Screenshots in the three lights land in test-results/research-*.
import { test, expect, type Page, type Route } from '@playwright/test';
import { indexBody, indexFileFor, loadRun, player } from '../research/recorded';

const RUN = loadRun('writing');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };

const open = async (page: Page, hash: string) => {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-page').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

async function shoot(page: Page, name: string) {
  for (const l of ['day', 'night', 'still']) {
    await page.evaluate(v => document.documentElement.setAttribute('data-light', v), l);
    await page.waitForTimeout(1400);
    await page.locator('.fs-app').screenshot({ path: `test-results/research-${name}-${l}.png` });
  }
  await page.evaluate(() => document.documentElement.setAttribute('data-light', 'day'));
  await page.waitForTimeout(1400);
}

test('Research: the circle, no key, a key, a run written in, a paper, the carry, Asked', async ({ page, context, baseURL }) => {
  // eight screens in three lights each, a breath of light apiece
  test.setTimeout(150_000);
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(new URL(r.url()).host); });
  const play = player(RUN);
  const api: string[] = [];
  await context.route('https://api.anthropic.com/**', async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() ?? '{}');
    api.push(JSON.stringify(body.messages));
    // a moment a turn, so the lines are seen landing
    await new Promise(r => setTimeout(r, 150));
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json', 'request-id': 'req_rec' }, body: JSON.stringify(play.next(body)) });
  });
  for (const host of ['https://www.ebi.ac.uk/**', 'https://api.openalex.org/**']) {
    await context.route(host, (route: Route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      const file = indexFileFor(RUN, route.request().url());
      return file ? route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: indexBody(file) }) : route.fulfill({ status: 404, headers: CORS });
    });
  }

  // the third circle in the sea, the line down its middle; its name is what travels
  await open(page, '#/flow');
  const circle = page.locator('.mt-plate a.mt-circle', { hasText: 'Research' });
  await expect(circle).toHaveAttribute('href', '#/flow/research');
  await expect(circle.locator('.mt-name')).toHaveAttribute('data-travel', 'rs-name');
  await circle.click();
  await expect(page).toHaveURL(/#\/flow\/research$/);
  await expect(page.locator('.fs-hdr-label')).toHaveText('Research');

  // no key: where it goes, and Settings under the thumb; nothing left the origin
  await expect(page.locator('[data-print="key"]')).toHaveText('The key goes in Settings.');
  await expect(page.getByRole('button', { name: 'Ask' })).toHaveCount(0);
  await shoot(page, 'nokey');
  expect(outside).toEqual([]);
  await page.locator('.fs-new', { hasText: 'Settings' }).click();
  const sheet = page.locator('[data-sheet="Settings"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-research]').getByText('Research key')).toBeVisible();
  // the key typed into the row a letter at a time (it once saved itself after the first letter), then Save
  const keyField = sheet.locator('[data-research] input').first();
  await keyField.click();
  await page.keyboard.type('sk-ant-recorded-0000');
  await sheet.locator('[data-research-save]').click();
  await expect(sheet.locator('[data-research-last]')).toHaveText('Ends in 0000');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  expect(outside).toEqual([]);
  await page.reload();
  await page.locator('.fs-page').first().waitFor();
  expect(outside).toEqual([]);

  // the blank page: the caret ready, the printed line, Ask
  await expect(page.locator('[data-print="leaves"]')).toHaveText('This question leaves the phone.');
  const q = page.getByRole('textbox', { name: 'Question' });
  await q.fill(RUN.question);
  await shoot(page, 'ask');
  await page.getByRole('button', { name: 'Ask' }).click();
  await expect(page).toHaveURL(/#\/flow\/research\/[0-9a-f-]{36}$/);
  const qp = page.locator('[data-research="question"]');
  await expect(page.locator('p.rs-q')).toHaveText(RUN.question);
  await expect(page.locator('[data-print="looking"]')).toHaveText('Looking');
  await expect(page.locator('.rs-side[data-looking]').first()).toBeAttached();
  await expect(page.locator('.rs-line').first()).toBeVisible();
  await shoot(page, 'running');
  await expect(qp).toHaveAttribute('data-state', 'done', { timeout: 20_000 });
  const lines = page.locator('.rs-line:not(.rs-lifting)');
  await expect(lines).toHaveCount(4);
  await expect(page.locator('.rs-line[data-paper-id="doi:10.1111/acer.70412"]')).toHaveCount(0);
  await expect(page.locator('.rs-side[data-looking]')).toHaveCount(0);
  await expect(page.locator('.rs-line[data-side="for"]')).toHaveCount(3);
  await expect(page.locator('.rs-line[data-side="against"] .rs-sp')).toHaveText('− · Acta psychologica · 2026 · Journal article');
  await expect(page.locator('.rs-line[data-paper-id="doi:10.1111/famp.70206"] a.rs-link')).toHaveAttribute('href', 'https://doi.org/10.1111/famp.70206');
  expect(await page.locator('.fs-app').innerText()).not.toMatch(/NEVER-SHOWN|MODEL-/);
  // only the question went out: every request is to the API or an index, and no journal word rode with it
  expect([...new Set(outside)].sort()).toEqual(['api.anthropic.com', 'www.ebi.ac.uk', 'api.openalex.org'].sort());
  for (const m of api) expect(m).not.toMatch(/FlowState|East Winds|Japan Trip/);
  await shoot(page, 'sides');

  // the chips filter by side
  await page.locator('.rs-side[data-side="against"]').click();
  await expect(page.locator('.rs-line:not(.rs-hush)')).toHaveCount(1);
  await shoot(page, 'one');
  await page.locator('.rs-side[data-side="against"]').click();
  await expect(page.locator('.rs-line:not(.rs-hush)')).toHaveCount(4);

  // Abstract opens the paper's page
  await page.locator('.rs-line[data-paper-id="doi:10.1111/famp.70206"] .rs-abs').click();
  await expect(page.locator('[data-research="paper"]')).toBeVisible();
  await expect(page.locator('.fs-hdr-label')).toHaveText('Paper');
  await expect(page.locator('.rs-words > *')).toHaveText(['Open the paper', 'Write about it', 'To Council']);
  await expect(page.locator('.rs-section').first()).toBeVisible();
  await shoot(page, 'paper');

  // Write about it: today's page, From and the question, the title in its side's voice
  await page.getByRole('button', { name: 'Write about it' }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.rs-from a')).toHaveText(RUN.question);
  await expect(page.locator('.rs-carried a.rs-link')).toHaveAttribute('href', 'https://doi.org/10.1111/famp.70206');
  await shoot(page, 'journal');
  await page.locator('.rs-from a').click();
  await expect(page).toHaveURL(/#\/flow\/research\/[0-9a-f-]{36}$/);
  await expect(page.locator('.rs-line:not(.rs-lifting)')).toHaveCount(4);

  // Asked: the question, date over line, readable offline
  await context.setOffline(true);
  await page.getByRole('link', { name: 'Asked' }).click();
  await expect(page.locator('.rs-asked .fs-list-line')).toHaveText([RUN.question]);
  await shoot(page, 'asked');
  await context.setOffline(false);
});
