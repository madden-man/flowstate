// The offline smoke (PLAN.md section 10, package 0): load, go offline, reload, write, reload again,
// the text is still there. Nothing leaves the origin at any point.
import { test, expect, type Page } from '@playwright/test';

const page$ = (p: Page) => p.getByRole('textbox', { name: "Today's page" });

test('opens, writes and survives reloads with the network off', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });

  await page.goto('/');
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link')).toHaveText(['Journal', 'Council', 'Be', 'Flow']);
  await expect(page.locator('html')).toHaveAttribute('data-light', /^(day|night)$/);

  // wait until the service worker has precached everything and controls the page
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page$(page)).toBeEnabled();

  // the first keystroke makes the page; a reload files the line on it
  const line = 'All this, and I am reduced to simple journaling.';
  await page$(page).click();
  await page$(page).pressSequentially(line, { delay: 5 });
  await expect(page$(page)).toHaveAttribute('data-saved', 'true');

  await page.reload();
  await expect(page.locator('.fs-msg', { hasText: line })).toBeVisible();
  await expect(page$(page)).toHaveValue('');

  // the other tabs open offline too, and a deep link lands on its tab
  await page.getByRole('link', { name: 'Council' }).click();
  await expect(page.getByText('Mystic')).toBeVisible();
  await page.goto('/#/be/px-selfless-selfish');
  await expect(page.getByRole('link', { name: 'Be' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('selfless', { exact: true })).toBeVisible();

  // Settings rises from the header and goes away without leaving anything over the tabs
  await page.getByRole('button', { name: 'Settings' }).click();
  const sheet = page.locator('[data-sheet="Settings"]');
  await expect(sheet).toBeVisible();
  await page.getByRole('button', { name: 'Night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'night');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.fs-scrim')).toHaveCount(0);

  // the moon puts the page in Still; the ring brings it back
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await page.getByRole('button', { name: 'Leave Still' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'night');

  expect(outside).toEqual([]);
});

/** A 500ms pointer hold on a line, the long press that brings up its sheet. */
async function hold(page: Page, text: string) {
  const box = (await page.locator('.fs-msg', { hasText: text }).boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.locator('[data-sheet="This line"]')).toBeVisible();
}

test('the journal, offline: two lines, a voice, keep close, turn to answer, and it all survives a reload', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page$(page)).toBeEnabled();

  const first = 'How can I gauge my pleasure/pain barometer?';
  const second = 'Listen to the quiet voices within.';
  await page$(page).click();
  await page$(page).pressSequentially(first, { delay: 2 });
  await page$(page).press('Enter');
  await page.getByRole('group', { name: 'Who speaks next' }).getByRole('button', { name: 'Mystic' }).click();
  await page$(page).pressSequentially(second, { delay: 2 });
  await page$(page).press('Enter');
  await expect(page.locator('.fs-msg.fs-v', { hasText: second }).locator('.fs-sp')).toHaveText('Mystic');

  // long press the Mystic's line and keep it close
  await hold(page, second);
  await page.getByRole('switch', { name: /Keep close/ }).click();
  await expect(page.locator('.fs-msg', { hasText: second }).locator('.fs-kept')).toBeVisible();
  await expect(page.locator('[data-sheet="This line"]')).toHaveCount(0);

  // long press the first line and turn it to a question: the answer frame opens beneath
  await hold(page, first);
  await page.getByRole('button', { name: /Turn to answer/ }).click();
  await expect(page).toHaveURL(/#\/journal\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue(first);
  await expect(page.getByRole('textbox', { name: 'Answer' })).toBeFocused();
  const questionUrl = page.url();

  await page.getByRole('link', { name: 'Questions' }).click();
  await expect(page.locator('.fs-qrow', { hasText: first })).toContainText('[space to answer left]');

  await page.reload();
  await expect(page.locator('.fs-qrow', { hasText: first })).toBeVisible();
  await page.goto(questionUrl);
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue(first);
  await expect(page.locator('.fs-msg.fs-v', { hasText: second }).locator('.fs-sp')).toHaveText('Mystic');
  await expect(page.locator('.fs-msg', { hasText: second }).locator('.fs-kept')).toBeVisible();
  // the new day's page is empty again (the entry became a question), with an echo above it
  await page.getByRole('link', { name: 'Entries' }).click();
  await expect(page.locator('[data-echo]')).toBeVisible();
  expect(outside).toEqual([]);
});
