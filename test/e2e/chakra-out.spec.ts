// Out of the app (PLAN-TASKS.md T4): on the Throat, Send asks for the one person once (the person sheet rises), then
// his sentence on the rule on the plate becomes Messages' body; on the Solar plexus, I will takes one thing and a time
// and opens Calendar on it. Each asserts the link that would open, without leaving the page. Shots at 390 wide.
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

const SHOTS = process.env.OUT_SHOTS;
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

const open = async (page: Page, hash: string) => {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-page').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

test('Send: the person chosen once, then the sentence on the rule is the body; Call and Reach go to that person', async ({ page }) => {
  await open(page, '#/flow/c/throat');
  await page.locator('.ck-touch[data-touch="send"]').click();
  const sheet = page.locator('[data-sheet="One person"]');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('textbox', { name: 'Who' }).fill('Ali');
  await sheet.getByRole('textbox', { name: 'Their number' }).fill('555 010 4471');
  await sheet.getByRole('textbox', { name: 'What the text says' }).fill('Hard hour. Ten minutes?');
  await shot(page, 'send-person');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);

  const stage = page.locator('.ck-stage [data-out="send"]');
  const rule = stage.getByRole('textbox', { name: 'Your sentence' });
  await expect(stage.locator('a.out-go')).toHaveCount(0);
  await rule.fill('I miss you & the lake?');
  const go = stage.locator('a.out-go');
  await expect(go).toHaveText('Ali');
  await expect(go).toHaveAttribute('href', 'sms:5550104471?&body=I%20miss%20you%20%26%20the%20lake%3F');
  await shot(page, 'send');

  // Call: chosen once, so no sheet: the phone on that number
  await page.locator('.ck-touch[data-touch="call"]').click();
  await expect(page.locator('[data-sheet="One person"]')).toHaveCount(0);
  await expect(page.locator('.ck-stage [data-out="call"] a.out-go')).toHaveAttribute('href', 'tel:5550104471');
  await shot(page, 'call');

  // Heart's Reach: the same person, with the words written when calm
  await page.goto('/#/flow/c/heart');
  await page.locator('.ck-touch[data-touch="reach"]').click();
  await expect(page.locator('.ck-stage [data-out="reach"] a.out-go')).toHaveAttribute('href', 'sms:5550104471?&body=Hard%20hour.%20Ten%20minutes%3F');
  await shot(page, 'reach-heart');
  await page.goto('/#/flow/c/root');
  await page.locator('.ck-touch[data-touch="reach"]').click();
  await expect(page.locator('.ck-stage [data-out="reach"] a.out-go')).toHaveText('Ali');
  await shot(page, 'reach-root');
  expect(page.url()).toContain('#/flow/c/root');
});

test('I will: one thing and a time on the plate, then Calendar on that time', async ({ page }) => {
  await open(page, '#/flow/c/solar-plexus');
  await page.locator('.ck-touch[data-touch="i-will"]').click();
  const stage = page.locator('.ck-stage [data-out="i-will"]');
  await stage.getByRole('textbox', { name: 'One thing you will do' }).fill('Walk to the lake');
  await expect(stage.locator('a.out-go')).toHaveCount(0);
  await stage.getByLabel('When').fill('18:30');
  const go = stage.locator('a.out-go');
  await expect(go).toHaveText('Calendar');
  const want = await page.evaluate(() => {
    const now = Date.now();
    const d = new Date(now); d.setHours(18, 30, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return `calshow:${Math.floor((d.getTime() - Date.UTC(2001, 0, 1)) / 1000)}`;
  });
  await expect(go).toHaveAttribute('href', want);
  await shot(page, 'i-will');
  for (const light of ['day', 'still'] as const) {
    await page.evaluate(l => document.documentElement.setAttribute('data-light', l), light);
    await shot(page, `i-will-${light}`);
  }
  expect(page.url()).toContain('#/flow/c/solar-plexus');
});

test('Move: the shelf\'s first album asked of Spotify; with none connected, Spotify\'s own line, and the page stays', async ({ page }) => {
  await open(page, '#/flow/c/sacral');
  await page.locator('.ck-touch[data-touch="move"]').click();
  await expect(page.locator('.ck-stage [data-out="move"] .out-note')).toHaveText('Connect Spotify in Settings');
  await shot(page, 'move');
  expect(page.url()).toContain('#/flow/c/sacral');
});
