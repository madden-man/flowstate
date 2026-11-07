// The seams pass (package 8): the whole journey end to end, offline, in one go. Cold load and the threshold
// breath; write a line, speak as the Mystic, keep it close, turn the first line to a question, answer it,
// take the answer to the council, speak there as two voices; add a goal pair on Be, check it due on Flow,
// drag the lean; pull the blind into Still and see the kept line, leave Still; set a PIN, reload, unlock
// with the word, and everything is still there; export makes a file. Nothing leaves the origin.
import { test, expect, type Page } from '@playwright/test';

const today$ = (p: Page) => p.getByRole('textbox', { name: "Today's page" });
const chip = (p: Page, name: string) => p.getByRole('group', { name: 'Who speaks next' }).getByRole('button', { name, exact: true });
const tabs = (p: Page) => p.getByRole('navigation', { name: 'Sections' });
const tab = (p: Page, name: string) => tabs(p).getByRole('link', { name, exact: true });
const tap = async (p: Page, digits: string) => {
  for (const d of digits) await p.locator('.fs-key', { has: p.locator('b', { hasText: new RegExp(`^${d}$`) }) }).click();
};

async function hold(page: Page, text: string, sheet: string) {
  const box = (await page.locator('.fs-msg', { hasText: text }).last().boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.locator(`[data-sheet="${sheet}"]`)).toBeVisible();
}

async function say(page: Page, box: ReturnType<Page['getByRole']>, text: string) {
  await box.click();
  await box.pressSequentially(text, { delay: 2 });
  await box.press('Enter');
  await expect(page.locator('.fs-msg', { hasText: text })).toBeVisible();
}

test('the journey: threshold to export, offline, across a PIN and a reload', async ({ page, context, baseURL }) => {
  test.setTimeout(120_000);
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });

  // ---- a cold load breathes once on the manifesto; a tap goes straight through ----
  await page.goto('/');
  const threshold = page.locator('[data-threshold]');
  await expect(threshold).toContainText('I determine my core.');
  await expect(threshold).toContainText('I choose how to flow.');
  await threshold.click();
  await expect(threshold).toHaveCount(0);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(today$(page)).toBeEnabled();

  // ---- the Journal: a line, the Mystic, keep close ----
  const first = 'How can I gauge my pleasure/pain barometer?';
  const mystic = 'Listen to the quiet voices within.';
  await say(page, today$(page), first);
  await chip(page, 'Mystic').click();
  await say(page, today$(page), mystic);
  await expect(page.locator('.fs-msg.fs-v', { hasText: mystic }).locator('.fs-sp')).toHaveText('Mystic');
  await hold(page, mystic, 'This line');
  await page.getByRole('switch', { name: /Keep close/ }).click();
  await expect(page.locator('.fs-msg', { hasText: mystic }).locator('.fs-kept')).toBeVisible();

  // ---- turn the first line to a question, answer it, take the answer to the council ----
  await hold(page, first, 'This line');
  await page.getByRole('button', { name: /Turn to answer/ }).click();
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue(first);
  const answer = page.getByRole('textbox', { name: 'Answer' });
  await expect(answer).toBeFocused();
  const questionUrl = page.url();
  const answered = 'Stand tall, young one.';
  await say(page, answer, answered);
  await hold(page, answered, 'This line');
  await page.getByRole('button', { name: 'Take to the council' }).click();
  await expect(page).toHaveURL(/#\/council\/[\w-]+$/);
  const councilUrl = page.url();
  await expect(page.locator('.fs-council .fs-msg', { hasText: answered })).toBeVisible();
  await expect(page.locator('.fs-from a').first()).toHaveText(first);

  // ---- the council: two voices ----
  const message = page.getByRole('textbox', { name: 'Message' });
  const skeptic = 'The mind is not pure, nor is it reliable.';
  const warrior = 'Then stand anyway.';
  await chip(page, 'Skeptic').click();
  await say(page, message, skeptic);
  await chip(page, 'Warrior').click();
  await say(page, message, warrior);
  await expect(page.locator('.fs-council .fs-msg', { hasText: skeptic })).toHaveAttribute('data-voice', 'Skeptic');
  await expect(page.locator('.fs-council .fs-msg', { hasText: warrior })).toHaveAttribute('data-voice', 'Warrior');

  // ---- Be: a goal and its balance, daily ----
  await tab(page, 'Be').click();
  const card = page.locator('#be-px-selfless-selfish');
  await expect(card.locator('[data-laid="true"]')).toBeAttached();
  await card.getByRole('button', { name: '+ Goal' }).click();
  const giving = 'Chop vegetables at the Evergreen kitchen';
  const keeping = 'An hour of the playlist, nothing else';
  await page.getByRole('textbox', { name: 'selfless goal' }).fill(giving);
  await page.getByRole('textbox', { name: 'selfish goal' }).fill(keeping);
  await page.getByRole('group', { name: 'Cadence' }).getByRole('button', { name: 'daily' }).click();
  await page.getByRole('button', { name: 'Save both' }).click();
  await expect(card.getByRole('button', { name: new RegExp(giving) })).toBeVisible();
  await expect(card.getByRole('button', { name: new RegExp(keeping) })).toBeVisible();

  // ---- Flow: the new goal is due today; check it, drag the lean ----
  await tab(page, 'Flow').click();
  const group = page.getByRole('region', { name: 'selfless and selfish' });
  const due = group.getByRole('checkbox', { name: new RegExp(giving) });
  await expect(due).toHaveAttribute('aria-checked', 'false');
  await due.click();
  await expect(due).toHaveAttribute('aria-checked', 'true');
  const slider = group.getByRole('slider', { name: 'Lean between selfless and selfish' });
  const sb = (await slider.boundingBox())!;
  const sy = sb.y + sb.height / 2;
  await page.mouse.move(sb.x + sb.width / 2, sy);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width * 0.8, sy, { steps: 6 });
  await page.mouse.move(sb.x + sb.width - 2, sy, { steps: 4 });
  await page.mouse.up();
  await expect(slider).toHaveAttribute('aria-valuenow', '1');
  await expect(page.locator('.fs-flow[data-saved="true"]')).toBeAttached();

  // ---- the blind: pull the Journal page down into Still; a kept line at the top; the ring brings it back ----
  await tab(page, 'Journal').click();
  await expect(today$(page)).toBeEnabled();
  const lightBefore = await page.locator('html').getAttribute('data-light');
  const col = (await page.locator('.fs-col').boundingBox())!;
  const x = col.x + col.width / 2, y = col.y + 40;
  const cdp = await context.newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', ty?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ty === undefined ? [] : [{ x, y: ty }] });
  await touch('touchStart', y);
  for (let dy = 10; dy <= 150; dy += 10) await touch('touchMove', y + dy);
  await touch('touchEnd');
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.locator('[data-kept-line]')).toHaveText(/I determine my core\.|Listen to the quiet voices within\./);
  // nothing quiet waits under the page in Still: no count, no hint line
  await expect(page.locator('.fs-count')).toBeHidden();
  await expect(page.locator('.fs-quietline')).toHaveCount(0);
  await page.getByRole('button', { name: 'Leave Still' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', lightBefore!);

  // ---- a PIN: FLOW, twice ----
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.locator('[data-sheet="Settings"]');
  await settings.getByRole('button', { name: /Set a PIN/ }).click();
  const pinSheet = page.locator('[data-sheet="Set a PIN"]');
  await expect(pinSheet).toBeVisible();
  await tap(page, '3569');
  await pinSheet.getByRole('button', { name: 'Next' }).click();
  await tap(page, '3569');
  await expect(settings.getByRole('button', { name: 'Change PIN' })).toBeVisible({ timeout: 15_000 });
  await settings.getByRole('button', { name: 'Done' }).click();

  // ---- reload: the keypad stands in front; the word opens it ----
  await page.reload();
  await expect(page.getByRole('group', { name: 'PIN' })).toBeVisible();
  await expect(tabs(page)).toHaveCount(0);
  await page.keyboard.type('flow');
  await expect(tab(page, 'Journal')).toHaveAttribute('aria-current', 'page', { timeout: 15_000 });

  // ---- everything is still there ----
  await page.goto(questionUrl);
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue(first);
  await expect(page.locator('.fs-msg', { hasText: mystic }).locator('.fs-kept')).toBeVisible();
  await expect(page.locator('.fs-msg.fs-wise', { hasText: answered })).toBeVisible();
  await page.goto(councilUrl);
  await expect(page.locator('.fs-council .fs-msg', { hasText: warrior })).toHaveAttribute('data-voice', 'Warrior');
  await expect(page.locator('.fs-council .fs-msg', { hasText: skeptic })).toHaveAttribute('data-voice', 'Skeptic');
  await tab(page, 'Be').click();
  await expect(card.getByRole('button', { name: new RegExp(giving) })).toBeVisible();
  await tab(page, 'Flow').click();
  await expect(due).toHaveAttribute('aria-checked', 'true');
  await expect(slider).toHaveAttribute('aria-valuenow', '1');

  // ---- export: a file, sealed with the PIN, and the Export row says when ----
  // (headless Chromium may offer navigator.share; the file is wanted as a download here)
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await page.getByRole('button', { name: 'Settings' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    settings.locator('[data-export]').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^flowstate-\d{4}-\d{2}-\d{2}\.json$/);
  const file = JSON.parse(await (await import('node:fs/promises')).readFile((await download.path())!, 'utf8'));
  expect(file.app).toBe('flowstate');
  expect(file.encrypted).toBe(true);
  expect(file.tables.pages.length).toBeGreaterThan(2);
  await expect(settings.locator('[data-export] small')).toHaveText(/^Last /);

  expect(outside).toEqual([]);
});
