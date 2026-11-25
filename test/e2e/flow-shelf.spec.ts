// Flow made plain (PLAN-WORLDS.md section 4 and 4.1, WF): the Flow tab is a shelf with one cover, My own pages, and
// under it the last line written, Meditate, Energize and Research as three circles, and Right now. Each circle and
// the row reach their own page, unchanged; the cover opens the Journal; where the signs' pages were (#/flow/c/...)
// goes back to the shelf; and the lock's ring still opens the personal Right now. Nothing of the mountain is drawn.
import { test, expect, type Page } from '@playwright/test';

const keypad = (p: Page) => p.getByRole('group', { name: 'PIN' });
const tap = async (p: Page, digits: string, scope = p.locator('body')) => {
  for (const d of digits) await scope.locator('.fs-key', { has: p.locator('b', { hasText: new RegExp(`^${d}$`) }) }).click();
};
async function enter(page: Page, url: string) {
  await page.goto(url);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

test('the shelf: the cover, the last line, the three circles and Right now each reach their page', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });
  await enter(page, '/#/journal');
  const today = page.getByRole('textbox', { name: "Today's page" });
  await today.click();
  await today.pressSequentially('It is the pace, not the list.', { delay: 2 });
  await expect(today).toHaveAttribute('data-saved', 'true');

  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Flow' }).click();
  await expect(page).toHaveURL(/#\/flow$/);
  // one cover, his own, worn: its name in the serif and Open in print
  const cover = page.locator('.fl-shelf .fl-cover');
  await expect(cover).toHaveCount(1);
  await expect(cover.locator('.fl-cover-name')).toHaveText('My own pages');
  await expect(cover.locator('.fl-cover-foot')).toHaveText('Open');
  await expect(cover).toBeInViewport();
  // the last line written, in the quiet italic, with its date
  const last = page.locator('.fl-lastline');
  await expect(last).toContainText('It is the pace, not the list.');
  await expect(last.locator('small')).toHaveText(/^\d+ \/ \d+ \/ \d\d$/);
  // nothing of the mountain
  await expect(page.locator('.mt-plate, .mt-stop, .ck-page, canvas, a[href^="#/flow/c/"]')).toHaveCount(0);
  // the three circles in a row, and Right now, all on screen
  const circles = page.locator('a.fl-circle');
  await expect(circles).toHaveText(['Meditate', 'Energize', 'Research']);
  const boxes = await circles.evaluateAll(as => as.map(a => a.getBoundingClientRect().top));
  expect(new Set(boxes.map(Math.round)).size).toBe(1);
  const now = page.locator('.fs-flows a.fl-flow[href="#/flow/now"]');
  await expect(now).toBeInViewport();

  // each reaches its own page, and the way back is Flow
  const back = () => page.locator('.fs-hdr').getByRole('link', { name: 'Flow', exact: true }).click();
  await circles.filter({ hasText: 'Meditate' }).click();
  await expect(page).toHaveURL(/#\/flow\/meditate$/);
  await expect(page.locator('.md-page')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/flow$/);
  await circles.filter({ hasText: 'Energize' }).click();
  await expect(page).toHaveURL(/#\/flow\/energize$/);
  await expect(page.locator('.fs-flowpage .fx-card .fx-name')).toHaveText(['FlowState', 'East Winds', 'Japan Trip']);
  await back();
  await expect(page).toHaveURL(/#\/flow$/);
  await circles.filter({ hasText: 'Research' }).click();
  await expect(page).toHaveURL(/#\/flow\/research$/);
  await expect(page.locator('.fs-hdr-label')).toHaveText('Research');
  await page.goBack();
  await expect(page).toHaveURL(/#\/flow$/);
  await now.click();
  await expect(page).toHaveURL(/#\/flow\/now$/);
  // the flows stay reachable from Right now (PLAN-WORLDS.md question 1)
  await page.locator('.fl-nowlist a[href="#/flow/panic/1"]').click();
  await expect(page.locator('.fs-flowpage[data-flow="panic"]')).toHaveAttribute('data-showing', '1');
  await back();
  await expect(page).toHaveURL(/#\/flow$/);

  // the cover opens the notebook's Journal
  await cover.click();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.getByRole('textbox', { name: "Today's page" }).first()).toBeVisible();
  expect(outside).toEqual([]);
});

test('where the signs were goes back to the shelf', async ({ page }) => {
  await enter(page, '/#/flow/c/heart');
  await expect(page).toHaveURL(/#\/flow$/);
  await expect(page.locator('.fl-cover')).toBeVisible();
  for (const to of ['/#/flow/c/root', '/#/flow/c', '/#/flow/c/root/1']) {
    await page.goto(to);
    await expect(page).toHaveURL(/#\/flow$/);
    await expect(page.locator('.fl-cover')).toBeVisible();
  }
});

test('the shelf in the three lights: Still is paper and seam, with no hue and no shadow', async ({ page }) => {
  await enter(page, '/#/flow');
  const cover = page.locator('.fl-cover');
  await expect(cover).toBeVisible();
  const look = () => cover.evaluate(el => { const s = getComputedStyle(el); return { bg: s.backgroundImage, shadow: s.boxShadow }; });
  const lit = await look();
  expect(lit.shadow).not.toBe('none');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect.poll(async () => (await look()).shadow).toBe('none');
  await expect(cover.locator('.fl-cover-name')).toHaveText('My own pages');
  await expect(page.locator('a.fl-circle')).toHaveCount(3);
  await page.getByRole('button', { name: 'Leave Still' }).click();
});

test('locked, the ring under the keypad still opens the personal Right now', async ({ page }) => {
  await enter(page, '/#/flow');
  await page.locator('.fs-hdr').getByRole('button', { name: 'Settings' }).click();
  const settings = page.locator('[data-sheet="Settings"]');
  await settings.getByRole('button', { name: /Set a PIN/ }).click();
  const sheet = page.locator('[data-sheet="Set a PIN"]');
  await tap(page, '3569', sheet);
  await sheet.getByRole('button', { name: 'Next' }).click();
  await tap(page, '3569', sheet);
  await expect(settings.getByRole('button', { name: 'Change PIN' })).toBeVisible({ timeout: 15_000 });
  const door = settings.getByRole('switch', { name: /The ring without the PIN/ });
  await door.click();
  await expect(door).toHaveAttribute('aria-checked', 'true');
  await settings.getByRole('button', { name: 'Done' }).click();

  // locked on the shelf: the keypad, and the ring under it
  await page.reload();
  await expect(keypad(page)).toBeVisible();
  await expect(page.locator('.fl-cover')).toHaveCount(0);
  await page.getByRole('link', { name: 'the ring' }).click();
  await expect(page).toHaveURL(/#\/flow\/now$/);
  await expect(keypad(page)).toHaveCount(0);
  await expect(page.locator('.fl-nowlist a.fl-flow').first().locator('.fs-list-meta')).toHaveText('Panic · Overstimulated');
  // and the PIN, asked by the way back, opens the shelf
  await page.getByRole('button', { name: 'Flow', exact: true }).click();
  await tap(page, '3569');
  await expect(page).toHaveURL(/#\/flow$/, { timeout: 15_000 });
  await expect(page.locator('.fl-cover')).toBeVisible();
});
