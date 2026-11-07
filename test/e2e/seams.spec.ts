// The seams between the Journal (package 1) and the Council (package 2), offline: a question's line
// taken to the council lands on the council's seats (V3) with "About: <the line>" at the top, and
// that link opens the question again. Then the council's Link a page finds journal pages by a
// question's title and by an entry's first line. Nothing leaves the origin.
import { test, expect, type Page } from '@playwright/test';

async function hold(page: Page, text: string, sheet: string) {
  const box = (await page.locator('.fs-msg', { hasText: text }).boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.locator(`[data-sheet="${sheet}"]`)).toBeVisible();
}

async function ask(page: Page, title: string) {
  await page.goto('/#/journal/questions');
  const field = page.getByRole('textbox', { name: 'A question' });
  // after a question is asked the field stays open for the next one
  if (!(await field.isVisible())) await page.getByRole('button', { name: 'Ask a question' }).click();
  await field.fill(title);
  await field.press('Enter');
  await expect(page.locator('.fs-qrow', { hasText: title })).toBeVisible();
}

test('journal and council meet: take to the council, About, and Link a page, offline', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();

  // today's entry, one line
  const today = page.getByRole('textbox', { name: "Today's page" });
  await expect(today).toBeEnabled();
  const entryLine = 'All this, and I am reduced to simple journaling.';
  await today.click();
  await today.pressSequentially(entryLine, { delay: 2 });
  await today.press('Enter');
  await expect(page.locator('.fs-msg', { hasText: entryLine })).toBeVisible();

  // two questions; the first gets an answer, and that answer goes to the council
  const q1 = 'How can I gauge my pleasure/pain barometer?';
  const q2 = 'How do I retain skills built on dysfunctional beliefs?';
  await ask(page, q1);
  await ask(page, q2);
  await page.locator('.fs-qrow', { hasText: q1 }).click();
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue(q1);
  const questionUrl = page.url();
  const answer = page.getByRole('textbox', { name: 'Answer' });
  const said = 'The mind is not pure, nor is it reliable.';
  await answer.click();
  await answer.pressSequentially(said, { delay: 2 });
  await answer.press('Enter');
  await hold(page, said, 'This line');
  await page.getByRole('button', { name: 'Take to the council' }).click();

  // the council's seats: "About" the line at the top, nothing copied
  await expect(page).toHaveURL(/#\/council\/[\w-]+$/);
  const councilUrl = page.url();
  await expect(page.getByText('Who sits?')).toBeVisible();
  await expect(page.locator('.fs-council .fs-msg')).toHaveCount(0);
  const from = page.locator('.fs-from').first();
  await expect(from.locator('small')).toHaveText('About');
  await expect(from.locator('a')).toHaveText(said);

  // the link back opens the question
  await from.locator('a').click();
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue(q1);
  expect(page.url()).toBe(questionUrl);

  // nobody seated, Begin, a line in ink; then Link a page from it finds the other question by its title
  await page.goto(councilUrl);
  await page.getByRole('button', { name: 'Begin' }).click();
  const message = page.getByRole('textbox', { name: 'Message' });
  await expect(message).toHaveAttribute('placeholder', 'A line in ink…');
  await message.fill(said);
  await message.press('Enter');
  await hold(page, said, 'Message');
  await page.getByRole('button', { name: /Link a page/ }).click();
  const find = page.locator('[data-sheet="Link a page"] input');
  await find.fill('dysfunctional');
  await page.locator('[data-sheet="Link a page"] .fs-row', { hasText: q2 }).click();
  await expect(page.locator('.fs-from', { hasText: q2 }).locator('small')).toHaveText('Linked');

  // and today's entry by its first line
  await hold(page, said, 'Message');
  await page.getByRole('button', { name: /Link a page/ }).click();
  await find.fill('simple journaling');
  await page.locator('[data-sheet="Link a page"] .fs-row', { hasText: entryLine }).click();
  await expect(page.locator('.fs-from', { hasText: entryLine })).toBeVisible();

  // all of it survives a reload offline, and the entry's link opens the journal page
  await page.reload();
  await expect(page.locator('.fs-from')).toHaveCount(3);
  await page.locator('.fs-from a', { hasText: entryLine }).click();
  await expect(page).toHaveURL(/#\/journal/);
  await expect(page.locator('.fs-msg', { hasText: entryLine })).toBeVisible();
  expect(outside).toEqual([]);
});
