// Questions, a section of their own (V2). A line on today's page is held and asked; the ? tab lists it
// open; its page is the journal's editor under the title. A line written there is plain ink until it is
// held and "This answers it" turns it italic, and the question rests under Answered with the day. With
// two open questions, Next walks to the other one, and a swipe across the page does the same.
import { test, expect, type Page } from '@playwright/test';

const today$ = (p: Page) => p.getByRole('textbox', { name: "Today's page" });
const tabs = (p: Page) => p.getByRole('navigation', { name: 'Sections' });

async function cross(page: Page) {
  await expect(page.locator('.fs-col')).toBeAttached();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

async function hold(page: Page, text: string) {
  const box = (await page.locator('.fs-msg', { hasText: text }).last().boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.locator('[data-sheet="This line"]')).toBeVisible();
}

async function say(page: Page, box: ReturnType<Page['getByRole']>, text: string) {
  await box.click();
  await box.pressSequentially(text, { delay: 2 });
  await box.press('Enter');
  // drawn as a paragraph once it is saved (until then it is still a textarea, and a hold would only focus it)
  await expect(page.locator('.fs-msg p', { hasText: text })).toBeVisible();
}

test('ask a line, find it under the ?, write to it, This answers it, and it rests under Answered', async ({ page }) => {
  await page.goto('/');
  await cross(page);

  // the bar: four words and the ? mark between Council and Be
  await expect(tabs(page).getByRole('link')).toHaveText(['Journal', 'Council', '?', 'Be', 'Flow']);
  await expect(tabs(page).getByRole('link', { name: 'Questions' })).toHaveText('?');

  const asked = 'How can I gauge my pleasure/pain barometer?';
  await say(page, today$(page), asked);
  await hold(page, asked);
  await expect(page.getByRole('button', { name: 'This answers it' })).toHaveCount(0);
  await page.getByRole('button', { name: /Ask this/ }).click();
  await expect(page.locator('.fs-link', { hasText: asked }).locator('small')).toHaveText('Asked · Questions');

  // the ? tab: the question waits, open, with no state word and no placeholder
  await tabs(page).getByRole('link', { name: 'Questions' }).click();
  await expect(page).toHaveURL(/#\/questions$/);
  await expect(tabs(page).getByRole('link', { name: 'Questions' })).toHaveAttribute('aria-current', 'page');
  const row = page.locator('.fs-qrow:not(.done)', { hasText: asked });
  await expect(row).toBeVisible();
  await expect(page.getByText('Answered', { exact: true })).toHaveCount(0);
  await expect(page.getByText('[space to answer left]')).toHaveCount(0);

  // its page: Questions is the way back, Pages is not here; the title is the first rule
  await row.click();
  await expect(page).toHaveURL(/#\/questions\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue(asked);
  const hdr = page.locator('.fs-hdr');
  await expect(hdr.getByRole('link', { name: 'Questions' })).toHaveAttribute('href', '#/questions');
  await expect(hdr.getByRole('link', { name: 'Pages' })).toHaveCount(0);
  // the only open question: nothing to walk
  await expect(page.getByRole('button', { name: 'Next ›' })).toHaveCount(0);

  // a line in plain ink, then held: This answers it, and it turns italic
  const answer = 'Notice what I reach for when I am tired.';
  const body = page.getByRole('textbox', { name: 'This page' });
  await say(page, body, answer);
  await expect(page.locator('.fs-msg', { hasText: answer })).not.toHaveClass(/fs-wise/);
  await hold(page, answer);
  await expect(page.getByRole('button', { name: /Ask this/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'This answers it' }).click();
  const line = page.locator('.fs-msg', { hasText: answer });
  await expect(line).toHaveClass(/fs-wise/);
  await expect(line.locator('p')).toHaveCSS('font-style', 'italic');

  // Asked from goes back to the day's page
  await expect(page.locator('.fs-link', { hasText: asked }).locator('small')).toHaveText('Asked from');

  // back: it rests under Answered, the date asked and the date answered on its meta line
  await hdr.getByRole('link', { name: 'Questions' }).click();
  await expect(page).toHaveURL(/#\/questions$/);
  await expect(page.locator('.fs-answered')).toHaveText('Answered');
  const done = page.locator('.fs-qrow.done', { hasText: asked });
  await expect(done).toBeVisible();
  await expect(done.locator('.fs-list-meta')).toHaveText(/^\d+ \/ \d+ \/ \d+ · \d+ \/ \d+ \/ \d+$/);
  await expect(page.locator('.fs-qrow:not(.done)')).toHaveCount(0);

  // held again it is Not the answer: the line goes plain and the question is open again
  await done.click();
  await hold(page, answer);
  await page.getByRole('button', { name: 'Not the answer' }).click();
  await expect(line).not.toHaveClass(/fs-wise/);
  await page.goto('/#/questions');
  await expect(page.locator('.fs-qrow:not(.done)', { hasText: asked })).toBeVisible();
  await expect(page.locator('.fs-answered')).toHaveCount(0);

  // the old address comes here
  await page.goto('/#/journal/questions');
  await expect(page).toHaveURL(/#\/questions$/);
});

test('two open questions: Next walks to the other, a swipe walks back, the counter says where', async ({ page, context }) => {
  await page.goto('/#/questions');
  await expect(page.getByRole('button', { name: 'New question' })).toBeVisible();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();

  const first = 'Who are my models?';
  const second = 'What would the Mystic say to the Skeptic?';
  await page.getByRole('button', { name: 'New question' }).click();
  const field = page.getByRole('textbox', { name: 'A question' });
  for (const q of [first, second]) {
    await field.fill(q);
    await field.press('Enter');
    await expect(page.locator('.fs-qrow', { hasText: q })).toBeVisible();
  }
  // newest first
  await expect(page.locator('.fs-qrow .fs-list-line')).toHaveText([second, first]);

  await page.locator('.fs-qrow', { hasText: second }).click();
  const title = page.getByRole('textbox', { name: 'Question' });
  await expect(title).toHaveValue(second);
  await expect(page.locator('.fs-hdr-r')).toContainText('1 of 2 open');
  await page.getByRole('button', { name: 'Next ›' }).click();
  await expect(title).toHaveValue(first);
  await expect(page.locator('.fs-hdr-r')).toContainText('2 of 2 open');
  // Next on the last open question wraps to the first
  await page.getByRole('button', { name: 'Next ›' }).click();
  await expect(title).toHaveValue(second);
  await page.getByRole('button', { name: '‹ Previous' }).click();
  await expect(title).toHaveValue(first);

  // a swipe to the right walks back; a vertical drag does not
  const col = (await page.locator('.fs-col').boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const drag = async (x0: number, y0: number, x1: number, y1: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let k = 1; k <= 8; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * k) / 8, y: y0 + ((y1 - y0) * k) / 8 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const y = col.y + col.height * 0.6;
  await drag(col.x + 60, y, col.x + 60, y - 120);
  await page.waitForTimeout(200);
  await expect(title).toHaveValue(first);
  await drag(col.x + 60, y, col.x + col.width - 40, y + 6);
  await expect(title).toHaveValue(second);

  // Still: the counter goes, the walk stays
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.locator('.fs-hdr-r .fs-count')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Next ›' })).toBeVisible();
});
