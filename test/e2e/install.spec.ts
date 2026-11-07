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
  await expect(page.getByRole('button', { name: 'New council' })).toBeVisible();
  await page.goto('/#/be/px-selfless-selfish');
  await expect(page.getByRole('link', { name: 'Be' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('selfless', { exact: true })).toBeVisible();

  // Be (package 3): a goal on the selfless side only leaves a dashed slot on the selfish side; filling
  // it from the slot links the two across the seam; a reload offline keeps all of it
  const card = page.locator('#be-px-selfless-selfish');
  const pairs = card.locator('path.fs-pair:not(.open)');
  // count the links only once the spread has been laid out (it draws nothing before)
  await expect(card.locator('[data-laid="true"]')).toBeAttached();
  await expect(pairs).not.toHaveCount(0);
  const before = await pairs.count();
  await card.getByRole('button', { name: '+ Goal' }).click();
  await page.getByRole('textbox', { name: 'selfless goal' }).fill('Share what you make with the world');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const slot = card.getByRole('button', { name: 'and on the selfish side?' });
  await expect(slot).toBeVisible();
  // the upright spread (V4): the slot sits on the goal's row, level with it, on the other side of the seam
  const box = async (name: string) => (await card.getByRole('button', { name, exact: true }).boundingBox())!;
  const lone = await box('Share what you make with the world');
  const open = (await slot.boundingBox())!;
  expect(open.y).toBeCloseTo(lone.y, 0);
  expect(open.x).toBeGreaterThan(lone.x + lone.width);
  await slot.click();
  await expect(page.getByRole('textbox', { name: 'selfish goal' })).toBeFocused();
  await page.getByRole('textbox', { name: 'selfish goal' }).fill('Write for its own sake');
  await page.getByRole('button', { name: 'Save both' }).click();
  await expect(slot).toHaveCount(0);
  await expect(pairs).toHaveCount(before + 1);
  // the pair shares one row
  const [give, keep] = [await box('Share what you make with the world'), await box('Write for its own sake')];
  expect(keep.y).toBeCloseTo(give.y, 0);
  await page.reload();
  await expect(card.getByRole('button', { name: 'Share what you make with the world' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Write for its own sake', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'and on the selfish side?' })).toHaveCount(0);
  await expect(pairs).toHaveCount(before + 1);
  // the poles stand on their rules; the earlier versions of the three words stay struck through under Edit
  await card.getByRole('button', { name: 'Edit' }).click();
  const paradoxSheet = page.locator('[data-sheet="The paradox"]');
  await expect(paradoxSheet.getByLabel('Earlier versions').locator('[data-struck]')).toHaveCount(2);
  await paradoxSheet.getByRole('button', { name: 'Done' }).click();
  await expect(paradoxSheet).toHaveCount(0);

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

test('the journal, offline: two paragraphs, a voice, keep close, ask this, and it all survives a reload', async ({ page, context, baseURL }) => {
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
  // the margin dot: the chips step out for this paragraph only
  await page.getByRole('button', { name: 'Who speaks this line' }).click();
  await page.getByRole('group', { name: 'Who speaks this line' }).getByRole('button', { name: 'Mystic' }).click();
  await expect(page.getByRole('group', { name: 'Who speaks this line' })).toHaveCount(0);
  await page$(page).pressSequentially(second, { delay: 2 });
  await page$(page).press('Enter');
  await expect(page.locator('.fs-msg.fs-v', { hasText: second }).locator('.fs-sp')).toHaveText('Mystic');
  // the next Return is ink again
  await expect(page.locator('.fs-msg.cur')).not.toHaveClass(/fs-v/);

  // long press the Mystic's line and keep it close
  await hold(page, second);
  await page.getByRole('switch', { name: /Keep close/ }).click();
  await expect(page.locator('.fs-msg', { hasText: second }).locator('.fs-kept')).toBeVisible();
  await expect(page.locator('[data-sheet="This line"]')).toHaveCount(0);

  // long press the first line and ask it: a question page is made, the day stays whole
  await hold(page, first);
  await page.getByRole('button', { name: /Ask this/ }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  const asked = page.locator('.fs-link', { hasText: first });
  await expect(asked.locator('small')).toHaveText('Asked · Questions');
  await expect(page.locator('.fs-msg', { hasText: first })).toBeVisible();
  await asked.click();
  await expect(page).toHaveURL(/#\/journal\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue(first);
  const questionUrl = page.url();

  await page.goto('/#/journal/questions');
  await expect(page.locator('.fs-qrow', { hasText: first })).toBeVisible();
  await expect(page.getByText('[space to answer left]')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.fs-qrow', { hasText: first })).toBeVisible();
  await page.goto(questionUrl);
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue(first);
  await page.goto('/#/journal');
  await expect(page.locator('.fs-msg', { hasText: first })).toBeVisible();
  await expect(page.locator('.fs-msg.fs-v', { hasText: second }).locator('.fs-sp')).toHaveText('Mystic');
  await expect(page.locator('.fs-msg', { hasText: second }).locator('.fs-kept')).toBeVisible();
  expect(outside).toEqual([]);
});
