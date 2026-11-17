// Resolve (PLAN-BLOCKERS.md K1, section 3 steps 12 and 13): one tap on the print word resolves a question, on the ?
// tab's list and on the question's own page, with nothing written under it; the drawn check stands in the word's
// place and a tap on it takes it back. On the list a row stays where it stood until the list is read again, and a
// resolved row prints one date when it was asked and resolved the same day. In Still the word and the check are gone.
import { test, expect, type Page } from '@playwright/test';

async function questionsOpen(page: Page) {
  await page.goto('/#/questions');
  const t = page.locator('[data-threshold]');
  await expect(page.getByRole('button', { name: 'New question' })).toBeVisible();
  if (await t.count()) await t.click();
}

async function ask(page: Page, qs: string[]) {
  await page.getByRole('button', { name: 'New question' }).click();
  const field = page.getByRole('textbox', { name: 'A question' });
  for (const q of qs) {
    await field.fill(q);
    await field.press('Enter');
    await expect(page.locator('.fs-qrow', { hasText: q })).toBeVisible();
  }
}

const item = (page: Page, q: string) => page.locator('.fs-qitem', { has: page.locator('.fs-list-line', { hasText: q }) });
const resolveOn = (page: Page, q: string) => item(page, q).getByRole('checkbox', { name: 'Resolved' });

test('on the list: Resolve, the check where the word was, taken back, and under Resolved on coming back', async ({ page }) => {
  await questionsOpen(page);
  const first = 'Do I call Dad back this week?';
  const second = 'What do I want the mornings to be?';
  await ask(page, [first, second]);

  // the print word on every open row, at the right of its date
  for (const q of [first, second]) {
    await expect(resolveOn(page, q)).toHaveText('Resolve');
    await expect(resolveOn(page, q)).not.toBeChecked();
  }
  const word = (await resolveOn(page, first).boundingBox())!;
  const date = (await item(page, first).locator('.fs-list-meta').boundingBox())!;
  expect(Math.abs(word.y + word.height / 2 - (date.y + date.height / 2))).toBeLessThan(2);
  expect(word.x + word.width).toBeGreaterThan(date.x + date.width - 2);

  // a tap resolves it where it stands: the check drawn, the row in print grey, the page unchanged
  await resolveOn(page, first).click();
  await expect(resolveOn(page, first)).toBeChecked();
  await expect(item(page, first).locator('.fs-qrow')).toHaveClass(/\bdone\b/);
  await expect(item(page, first).locator('.fs-resolve-word')).toHaveCSS('opacity', '0');
  await expect(page).toHaveURL(/#\/questions$/);
  await expect(page.locator('.fs-qitem .fs-list-line')).toHaveText([second, first]);

  // a tap on the check takes it back
  await resolveOn(page, first).click();
  await expect(resolveOn(page, first)).not.toBeChecked();
  await expect(item(page, first).locator('.fs-qrow')).not.toHaveClass(/\bdone\b/);

  // resolved again and the list read again: under Resolved, with one date (asked and resolved today)
  await resolveOn(page, first).click();
  await expect(resolveOn(page, first)).toBeChecked();
  await page.reload();
  await expect(page.locator('.fs-answered')).toHaveText('Resolved');
  const group = page.getByRole('group', { name: 'Resolved' });
  await expect(group.locator('.fs-list-line')).toHaveText([first]);
  await expect(item(page, first).locator('.fs-list-meta')).toHaveText(/^\d+ \/ \d+ \/ \d+$/);
  await expect(resolveOn(page, first)).toBeChecked();

  // taken back from under Resolved: open again, and among the open once the list is read again
  await resolveOn(page, first).click();
  await expect(resolveOn(page, first)).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole('group', { name: 'Resolved' })).toHaveCount(0);
  await expect(page.locator('.fs-qitem .fs-list-line')).toHaveText([second, first]);

  // Still: the open questions only, and no Resolve
  await resolveOn(page, second).click();
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.locator('.fs-resolve').first()).toBeHidden();
  await expect(item(page, first)).toBeVisible();
  await expect(item(page, second)).toBeHidden();
});

test('on its page: Resolve beside the title, with nothing written; the counter goes; taken back', async ({ page }) => {
  await questionsOpen(page);
  const first = 'Who are my models?';
  const second = 'What would the Mystic say to the Skeptic?';
  await ask(page, [first, second]);
  await page.locator('.fs-qrow', { hasText: second }).click();
  const title = page.getByRole('textbox', { name: 'Question' });
  await expect(title).toHaveValue(second);

  const r = page.locator('.fs-qtitle').getByRole('checkbox', { name: 'Resolved' });
  await expect(r).toHaveText('Resolve');
  // at the right of the title's first rule
  const rb = (await r.boundingBox())!, tb = (await title.boundingBox())!;
  expect(rb.x).toBeGreaterThan(tb.x + tb.width - 2);
  expect(Math.abs(rb.y - tb.y)).toBeLessThan(4);
  await expect(page.locator('.fs-hdr-r')).toContainText('of 2 open');

  await r.click();
  await expect(r).toBeChecked();
  await expect(page.locator('.fs-hdr-r')).not.toContainText('open');
  // the walk stays to move on
  await expect(page.getByRole('button', { name: 'Next ›' })).toBeVisible();

  await r.click();
  await expect(r).not.toBeChecked();
  await expect(page.locator('.fs-hdr-r')).toContainText('of 2 open');

  // resolved here, it rests under Resolved on the list
  await r.click();
  await expect(r).toBeChecked();
  await page.locator('.fs-hdr').getByRole('link', { name: 'Questions' }).click();
  await expect(page.getByRole('group', { name: 'Resolved' }).locator('.fs-list-line')).toHaveText([second]);
});
