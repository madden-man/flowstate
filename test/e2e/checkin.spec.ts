// The Sunday question in the app (PLAN-PUSH.md N1), no network. A journal begun on Saturday, opened at Sunday 10:01:
// his question is the one quiet line under the page (over the export's line), once; a tap lands on today's page with
// the question written and asked and the answer rule open in italic, the page linked to the week; a reload has no line.
// The next Sunday it asks again and Later puts it away. Never in Still. #/journal?ask=checkin (N3's notification tap)
// lands the same way, behind the PIN when there is one, and the address loses its query. The Settings row: the switch,
// the question on a rule, the time; reviewed in Day, Night and Still.
import { test, expect, type Page } from '@playwright/test';

type Row = Record<string, unknown> & { id: string };
const all = (page: Page, table: string) => page.evaluate(t => new Promise<Row[]>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const r = open.result.transaction(t).objectStore(t).getAll();
    r.onsuccess = () => { open.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
  };
}), table);
const put = (page: Page, table: string, row: Row) => page.evaluate(([t, v]) => new Promise<void>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const w = open.result.transaction(t, 'readwrite').objectStore(t).put(v);
    w.onsuccess = () => { open.result.close(); resolve(); };
    w.onerror = () => reject(w.error);
  };
}), [table, row] as const);
const settingsRow = async (page: Page) => (await all(page, 'settings')).find(r => r.id === 'app')!;

async function enter(page: Page, url: string) {
  // a goto that only changes the hash is no load: reload, so each enter is a fresh open of the app
  await page.goto(url);
  await page.reload();
  await page.locator('.fs-app, [data-lock]').first().waitFor();
  const t = page.locator('[data-threshold]:not([data-lock])');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

const LINE = 'Is there anything on your mind?';
const SAT = new Date(2026, 10, 21, 12, 0);
const SUN = new Date(2026, 10, 22, 10, 1);
const NEXT_SUN = new Date(2026, 10, 29, 10, 1);
const line = (page: Page) => page.locator('[data-checkin-line]');

test.use({ viewport: { width: 390, height: 844 } });

test('Sunday 10:01: the line shows once, lands on today\'s page asked, and is gone until next Sunday', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });
  await page.clock.install({ time: SAT });
  await enter(page, '/#/journal');
  // Saturday: no question (and a journal begun after last Sunday 10:00 is not asked last week's)
  await expect(page.locator('.fs-page').first()).toBeVisible();
  await expect(line(page)).toHaveCount(0);
  // the export is due too (no export, and a seed date long past), so the question has to win the day
  // (last Sunday's question counts as asked, so the older seed date asks nothing before this Sunday)
  await put(page, 'settings', {
    ...(await settingsRow(page)), seededAt: SAT.getTime() - 30 * 86_400_000,
    checkin: { on: true, weekday: 0, hour: 10, minute: 0, line: LINE, lastShownWeek: '2026-11-15' },
  });

  await page.clock.setSystemTime(new Date(2026, 10, 22, 9, 59));
  await enter(page, '/#/journal');
  await expect(page.locator('.fs-page').first()).toBeVisible();
  await expect(line(page)).toHaveCount(0);

  await page.clock.setSystemTime(SUN);
  await enter(page, '/#/journal');
  await expect(line(page)).toBeVisible();
  await expect(line(page).locator('.fs-quietline-tap')).toHaveText(LINE);
  await expect(page.locator('[data-backup-nag]')).toHaveCount(0);
  await expect(line(page)).not.toContainText(/\d/);
  await expect.poll(async () => ((await settingsRow(page)).checkin as { lastShownWeek?: string } | undefined)?.lastShownWeek).toBe('2026-11-22');
  await page.screenshot({ path: 'test-results/checkin-line-day.png' });

  await line(page).locator('.fs-quietline-tap').click();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-msg p', { hasText: LINE })).toBeVisible();
  await expect(page.locator('.fs-links a', { hasText: 'Asked · Questions' })).toBeVisible();
  // Turn to answer open: the next rule, under the line, in italic, the caret on it
  const answer = page.locator('.fs-msg.fs-wise textarea');
  await expect(answer).toBeFocused();
  await expect(line(page)).toHaveCount(0);
  await page.screenshot({ path: 'test-results/checkin-landed-day.png' });
  await answer.pressSequentially('Mostly the move.', { delay: 2 });
  await answer.press('Enter');
  await expect(page.locator('.fs-msg.fs-wise p', { hasText: 'Mostly the move.' })).toBeVisible();
  await expect.poll(async () => (await all(page, 'pages')).filter(p => (p.checkin as { week: string } | undefined)?.week === '2026-11-22').length).toBe(1);

  // a reload: the page is there, the line is not
  await enter(page, '/#/journal');
  await expect(page.locator('.fs-msg p', { hasText: LINE })).toBeVisible();
  await expect(page.locator('.fs-msg.fs-wise p', { hasText: 'Mostly the move.' })).toBeVisible();
  await expect(line(page)).toHaveCount(0);
  // and the export's line has had its day taken: not today either
  await expect(page.locator('[data-backup-nag]')).toHaveCount(0);

  // the next Sunday it asks again; Later puts it away, and a reload keeps it away
  await page.clock.setSystemTime(NEXT_SUN);
  await enter(page, '/#/journal');
  await expect(line(page)).toBeVisible();
  await line(page).getByRole('button', { name: 'Later' }).click();
  await expect(line(page)).toHaveCount(0);
  await enter(page, '/#/journal');
  await expect(page.locator('.fs-page').first()).toBeVisible();
  await expect(line(page)).toHaveCount(0);
  expect(outside).toEqual([]);
});

test('never in Still: the line waits until Still is left', async ({ page }) => {
  await page.clock.install({ time: SAT });
  await enter(page, '/#/journal');
  await expect(page.locator('.fs-page').first()).toBeVisible();
  await page.clock.setSystemTime(SUN);
  await enter(page, '/#/journal');
  await expect(line(page)).toBeVisible();
  // put it back as never shown (once its showing is stored), pin Night, and open again: then into Still
  await expect.poll(async () => ((await settingsRow(page)).checkin as { lastShownWeek?: string } | undefined)?.lastShownWeek).toBe('2026-11-22');
  const s = await settingsRow(page);
  await put(page, 'settings', { ...s, light: 'night', checkin: { ...(s.checkin as object), lastShownWeek: undefined } });
  await enter(page, '/#/journal');
  await expect(page.locator('html')).toHaveAttribute('data-light', 'night');
  await expect(line(page)).toBeVisible();
  await page.screenshot({ path: 'test-results/checkin-line-night.png' });
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(line(page)).toHaveCount(0);
  await page.screenshot({ path: 'test-results/checkin-line-still.png' });
});

test('#/journal?ask=checkin lands on today\'s page asked, and the address loses its query', async ({ page }) => {
  await page.clock.install({ time: SAT });
  await enter(page, '/#/journal');
  await expect(page.locator('.fs-page').first()).toBeVisible();
  await page.clock.setSystemTime(SUN);
  await enter(page, '/#/journal?ask=checkin');
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-msg p', { hasText: LINE })).toBeVisible();
  await expect(page.locator('.fs-msg.fs-wise textarea')).toBeFocused();
  await expect(line(page)).toHaveCount(0);
  // landed again the same day (a second tap on the notification): nothing written twice
  await enter(page, '/#/journal?ask=checkin');
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-msg p', { hasText: LINE })).toHaveCount(1);
  await expect.poll(async () => (await all(page, 'pages')).filter(p => p.kind === 'question').length).toBe(1);
  // and the quiet line counts the week as asked
  await enter(page, '/#/journal');
  await expect(page.locator('.fs-page').first()).toBeVisible();
  await expect(line(page)).toHaveCount(0);
});

const keypad = (p: Page) => p.getByRole('group', { name: 'PIN' });
const tap = async (p: Page, digits: string) => {
  for (const d of digits) await p.locator('.fs-key', { has: p.locator('b', { hasText: new RegExp(`^${d}$`) }) }).click();
};

test('#/journal?ask=checkin behind the PIN: the keypad first, then the landing', async ({ page }) => {
  await page.clock.install({ time: SUN });
  await enter(page, '/#/journal');
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.locator('[data-sheet="Settings"]');
  await settings.getByRole('button', { name: /Set a PIN/ }).click();
  const sheet = page.locator('[data-sheet="Set a PIN"]');
  await tap(page, '3569');
  await sheet.getByRole('button', { name: 'Next' }).click();
  await expect(sheet.getByText('Once more')).toBeVisible();
  await tap(page, '3569');
  await expect(settings.getByRole('button', { name: 'Change PIN' })).toBeVisible({ timeout: 15_000 });
  await settings.getByRole('button', { name: 'Done' }).click();

  await page.goto('/#/journal?ask=checkin');
  await page.reload();
  await expect(keypad(page)).toBeVisible();
  await expect(page.locator('.fs-msg')).toHaveCount(0);
  await tap(page, '3569');
  await expect(page).toHaveURL(/#\/journal$/, { timeout: 15_000 });
  await expect(page.locator('.fs-msg p', { hasText: LINE })).toBeVisible();
  await expect(page.locator('.fs-msg.fs-wise textarea')).toBeFocused();
});

test('Settings: the Sunday question row, its line and time, kept; three lights', async ({ page }) => {
  await page.clock.install({ time: SAT });
  await enter(page, '/#/journal');
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.locator('[data-sheet="Settings"]');
  const row = settings.locator('[data-checkin]');
  const sw = row.getByRole('switch', { name: /Sunday question/ });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  // under the sounds and haptics, above Storage
  const order = await settings.locator('.fs-rows > *').evaluateAll(els => els.map(e => (e.matches('[data-checkin]') ? 'checkin' : e.matches('[data-storage]') ? 'storage' : e.textContent?.startsWith('Haptics') ? 'haptics' : '')).filter(Boolean));
  expect(order).toEqual(['haptics', 'checkin', 'storage']);
  const q = row.getByRole('textbox', { name: 'The question' });
  await expect(q).toHaveValue(LINE);
  await expect(row.locator('[data-checkin-time]')).toHaveValue('10:00');
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/checkin-settings-day.png' });

  await q.fill('What is on your mind this week?');
  await q.press('Enter');
  await row.locator('[data-checkin-time]').fill('09:30');
  await expect.poll(async () => (await settingsRow(page)).checkin).toMatchObject({ line: 'What is on your mind this week?', hour: 9, minute: 30, weekday: 0, on: true });
  // emptied, the line is his first one again
  await q.fill('   ');
  await q.press('Enter');
  await expect(q).toHaveValue(LINE);
  await q.fill('What is on your mind this week?');
  await q.press('Enter');
  await expect.poll(async () => ((await settingsRow(page)).checkin as { line: string }).line).toBe('What is on your mind this week?');

  // off: the line and time go; on again they come back
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(q).toHaveCount(0);
  await sw.click();
  await expect(q).toHaveValue('What is on your mind this week?');

  // Night and Still: the state (On) is hidden in Still, the row otherwise the same
  await settings.getByRole('button', { name: 'Night' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'night');
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/checkin-settings-night.png' });
  await expect(sw.locator('small')).toBeVisible();
  await settings.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await page.getByRole('button', { name: 'Settings' }).click();
  await row.scrollIntoViewIfNeeded();
  await expect(sw).toBeVisible();
  await expect(sw.locator('small')).toBeHidden();
  await page.screenshot({ path: 'test-results/checkin-settings-still.png' });
  await settings.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Leave Still' }).click();

  // Sunday 09:31: his line, at his time
  await page.clock.setSystemTime(new Date(2026, 10, 22, 9, 31));
  await enter(page, '/#/journal');
  await expect(line(page).locator('.fs-quietline-tap')).toHaveText('What is on your mind this week?');
});
