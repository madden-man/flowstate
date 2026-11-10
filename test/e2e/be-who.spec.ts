// S3 (PLAN-SELF.md 3.3 and 3.4.2): the creed opens Be, a line a held paradox, the three words until his own line is
// written; a tap on a line opens that spread. Under an open spread, "+ Not me" adds a line that holds across a
// reload, an emptied line goes, and at three the word goes. Still keeps the creed and puts Not me away.
import { test, expect, type Page } from '@playwright/test';

/** Writes a creed onto a paradox straight in IndexedDB (the Both field is S2's, in the sheet). */
const writeCreed = (page: Page, id: string, creed: string) => page.evaluate(([pid, c]) => new Promise<void>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const st = open.result.transaction('paradoxes', 'readwrite').objectStore('paradoxes');
    const g = st.get(pid);
    g.onsuccess = () => {
      const w = st.put({ ...g.result, creed: c });
      w.onsuccess = () => { open.result.close(); resolve(); };
      w.onerror = () => reject(w.error);
    };
  };
}), [id, creed] as const);

async function enter(page: Page) {
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-dichotomy').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

test('the creed: three words until his own line, which holds; a tap opens that spread', async ({ page }) => {
  await page.goto('/#/be');
  await enter(page);
  const who = page.getByRole('region', { name: 'Who' });
  const lines = who.locator('.fs-who-line');
  await expect(lines).toHaveText(['selfless · selfish', 'thoughtful (obsessive) · reactive']);
  await expect(who.locator('.fs-who-line.own')).toHaveCount(0);
  // the creed comes before the list
  const creedBox = (await who.boundingBox())!;
  const rowBox = (await page.locator('.fs-dichotomy').first().boundingBox())!;
  expect(creedBox.y).toBeLessThan(rowBox.y);

  await writeCreed(page, 'px-thoughtful-reactive', 'I think it through and still move when it is time.');
  await page.reload();
  await enter(page);
  await expect(lines).toHaveText(['selfless · selfish', 'I think it through and still move when it is time.']);
  await expect(who.locator('.fs-who-line.own')).toHaveText('I think it through and still move when it is time.');

  // a tap on the line opens that paradox's spread and brings its row into view
  await lines.nth(1).click();
  const card = page.locator('#be-px-thoughtful-reactive');
  await expect(card.locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true');
  await expect(card.locator('.fs-dichotomy')).toBeInViewport();
  await expect(page.locator('#be-px-selfless-selfish .fs-dichotomy')).toHaveAttribute('aria-expanded', 'false');
});

test('Not me: add, reload, empty, three is all, and Still puts it away', async ({ page }) => {
  await page.goto('/#/be/px-selfless-selfish');
  await enter(page);
  const card = page.locator('#be-px-selfless-selfish');
  const notMe = card.getByRole('region', { name: 'Not me, selfless and selfish' });
  const add = notMe.getByRole('button', { name: '+ Not me' });
  await expect(add).toBeVisible();
  // with none written there is no label
  await expect(notMe.getByText('Not me', { exact: true })).toHaveCount(0);

  const write = async (text: string) => {
    await add.click();
    const field = notMe.getByRole('textbox', { name: 'Not me' });
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute('placeholder', "I don't ...");
    await field.fill(text);
    await field.press('Enter');
    await expect(notMe).toHaveAttribute('data-saved', 'true');
  };
  await write("I don't say yes to fill the silence.");
  await expect(notMe.locator('button.fs-notme-line')).toHaveText(["I don't say yes to fill the silence."]);
  await expect(notMe.getByText('Not me', { exact: true })).toBeVisible();

  await page.reload();
  await enter(page);
  await expect(notMe.locator('button.fs-notme-line')).toHaveText(["I don't say yes to fill the silence."]);

  // a tap edits it in place; emptied, it goes
  await notMe.locator('button.fs-notme-line').click();
  const field = notMe.getByRole('textbox', { name: 'Not me' });
  await expect(field).toBeFocused();
  await field.fill('');
  await field.blur();
  await expect(notMe).toHaveAttribute('data-saved', 'true');
  await expect(notMe.locator('.fs-notme-line')).toHaveCount(0);
  await page.reload();
  await enter(page);
  await expect(notMe.locator('.fs-notme-line')).toHaveCount(0);

  // three, and the word is gone; the open fold grows to hold them, none clipped
  await write("I don't keep score.");
  await write("I don't skip lunch to look busy.");
  await write("I don't answer for someone who has not asked.");
  await expect(notMe.locator('button.fs-notme-line')).toHaveCount(3);
  await expect(add).toHaveCount(0);
  const fold = card.locator('.fs-be-fold');
  const [foldH, scrollH] = await fold.evaluate(f => [f.clientHeight, f.scrollHeight]);
  expect(foldH).toBe(scrollH);

  // Still: the creed stays, Not me goes
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(notMe).toBeHidden();
  await expect(page.getByRole('region', { name: 'Who' }).locator('.fs-who-line')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Who' })).toBeVisible();
});
