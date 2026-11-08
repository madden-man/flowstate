// v2 (V1): the page is the editor. The caret waits on the first rule; Return makes the next paragraph and
// Shift+Return breaks a line inside one; a paragraph tapped in the middle of the page takes the caret, and
// Return there opens a paragraph in its place. An earlier page is written on the same way, and the block
// written later carries its date. Pages lists the entries by month and searches them. No composer, no
// chip row standing, no segment row, no Mood.
import { test, expect, type Page } from '@playwright/test';

const today$ = (p: Page) => p.getByRole('textbox', { name: "Today's page" });
const lines = (p: Page) => p.locator('.fs-col .fs-msg p');

async function cross(page: Page) {
  // the threshold, when a cold load breathes, is drawn with the page: wait for the page, then tap through
  await expect(page.locator('.fs-col')).toBeAttached();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

test('write, Return, reload; a paragraph in the middle; an earlier page; Pages', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 5, 21, 10) });
  await page.goto('/');
  await cross(page);

  // the journal is the page: header, rules, tabs; nothing standing between
  await expect(page.locator('.fs-composer, .fs-seg, .fs-meta')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Who speaks next' })).toHaveCount(0);
  await expect(page.locator('.fs-msg.cur .fs-dot')).toHaveCount(1);

  // an earlier day: two paragraphs, a line break inside the second
  await today$(page).click();
  await today$(page).pressSequentially('Wait out the truly hard parts.', { delay: 2 });
  await today$(page).press('Enter');
  await today$(page).pressSequentially('Boiling in my own soup.', { delay: 2 });
  await today$(page).press('Shift+Enter');
  await today$(page).pressSequentially('Nothing to solve.', { delay: 2 });
  await expect(today$(page)).toHaveAttribute('data-saved', 'true');
  await page.reload();
  await cross(page);
  await expect(lines(page)).toHaveText(['Wait out the truly hard parts.', 'Boiling in my own soup.\nNothing to solve.']);
  await expect(today$(page)).toHaveValue('');

  // tap the first paragraph: it takes the caret; Return there opens a paragraph beneath it, in place
  await lines(page).first().click();
  const editing = page.getByRole('textbox', { name: 'This line' });
  await expect(editing).toHaveValue('Wait out the truly hard parts.');
  // the caret lands where the tap did; put it at the end of the paragraph
  await editing.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length, el.value.length));
  await editing.press('Enter');
  await page.keyboard.type('They never last forever.', { delay: 2 });
  await page.waitForTimeout(500);
  await page.reload();
  await cross(page);
  await expect(lines(page)).toHaveText(['Wait out the truly hard parts.', 'They never last forever.', 'Boiling in my own soup.\nNothing to solve.']);

  // three days on: today's page is new and numbered among entries only; the earlier page is written on
  await page.clock.setSystemTime(new Date(2026, 10, 8, 9, 40));
  await page.reload();
  await cross(page);
  await expect(lines(page)).toHaveCount(0);
  await today$(page).click();
  await today$(page).pressSequentially('All this, and I am reduced to simple journaling. #evergreen', { delay: 2 });
  await expect(today$(page)).toHaveAttribute('data-saved', 'true');

  await page.getByRole('link', { name: 'Pages' }).click();
  await expect(page).toHaveURL(/#\/journal\/pages$/);
  await expect(page.locator('.fs-month').first()).toHaveText('November');
  await expect(page.locator('.fs-pagelist .fs-list-row .fs-list-line')).toContainText(['All this, and I am reduced', 'Wait out the truly hard parts.']);
  await page.getByRole('searchbox', { name: 'Search the pages' }).fill('soup');
  await expect(page.locator('.fs-pagelist .fs-list-row')).toHaveCount(1);
  await page.locator('.fs-pagelist .fs-list-row', { hasText: 'Wait out' }).click();

  const later = page.getByRole('textbox', { name: 'This page' });
  await expect(later).toBeFocused();
  await later.pressSequentially('Three days on, it did pass.', { delay: 2 });
  await expect(later).toHaveAttribute('data-saved', 'true');
  await page.reload();
  await cross(page);
  await expect(lines(page).last()).toHaveText('Three days on, it did pass.');
  await expect(page.locator('.fs-dated')).toHaveText('11 / 8 / 26');
  await expect(page.getByRole('button', { name: 'Revisit' })).toHaveCount(0);
});

test('a + after Pages starts another entry today; nothing is made until its first word (V12)', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 8, 8, 0) });
  await page.goto('/');
  await cross(page);
  const plus = page.getByRole('button', { name: 'Another entry today' });
  const no = page.locator('.fs-hdr .fs-count b');
  // a blank page offers no +
  await expect(plus).toHaveCount(0);
  await today$(page).click();
  await today$(page).pressSequentially('Morning, before the move.', { delay: 2 });
  await expect(today$(page)).toHaveAttribute('data-saved', 'true');
  await expect(plus).toBeVisible();
  const first = Number(await no.textContent());

  // +: a fresh page, the next number, the caret on its first rule; leaving it unwritten makes nothing
  await plus.click();
  await expect(page).toHaveURL(/#\/journal\/new\//);
  await expect(lines(page)).toHaveCount(0);
  await expect(no).toHaveText(String(first + 1));
  await expect(plus).toHaveCount(0);
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await expect(lines(page)).toHaveText(['Morning, before the move.']);
  await expect(no).toHaveText(String(first));

  // + again, and write: the new entry is today's page from then on
  await page.getByRole('button', { name: 'Another entry today' }).click();
  await today$(page).click();
  await today$(page).pressSequentially('Evening, after it.', { delay: 2 });
  await expect(today$(page)).toHaveAttribute('data-saved', 'true');
  await expect(page).toHaveURL(/#\/journal$/);
  await page.reload();
  await cross(page);
  await expect(lines(page)).toHaveText(['Evening, after it.']);
  await expect(no).toHaveText(String(first + 1));
  // both are in Pages, the morning one too
  await page.getByRole('link', { name: 'Pages', exact: true }).click();
  await expect(page.locator('.fs-list-row', { hasText: 'Morning, before the move.' })).toHaveCount(1);
  await expect(page.locator('.fs-list-row', { hasText: 'Evening, after it.' })).toHaveCount(1);
});

