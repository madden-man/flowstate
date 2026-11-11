// The seams pass (package 8): the whole journey end to end, offline, in one go. Cold load and the threshold
// breath; write a paragraph, give the next one the Mystic's voice from the margin dot, keep it close, ask
// the first line (a new question page; the day stays whole), write under the question, take that line to
// the council, speak there as two voices; find the entry on Pages; add a goal pair on Be, check it due under the
// spread, drag the lean; tap the moon into Still and see the kept line, leave Still; set a PIN, reload, unlock
// with the word, and everything is still there; export makes a file. Nothing leaves the origin.
import { test, expect, type Page } from '@playwright/test';
import { writeParadoxes } from './paradoxes';

const today$ = (p: Page) => p.getByRole('textbox', { name: "Today's page" });
const chip = (p: Page, name: string) => p.getByRole('group', { name: 'Who speaks next' }).getByRole('button', { name, exact: true });
/** The margin dot of the paragraph you are on, then a voice for that paragraph only. */
const voice = async (p: Page, name: string) => {
  await p.getByRole('button', { name: 'Who speaks this line' }).click();
  await p.getByRole('group', { name: 'Who speaks this line' }).getByRole('button', { name, exact: true }).click();
};
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
  // drawn as a paragraph once it is saved (until then it is still a textarea, and a hold would only focus it)
  await expect(page.locator('.fs-msg p', { hasText: text })).toBeVisible();
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
  // C1: a fresh install has values and no paradoxes, so the paradox Be shows later is written first
  await writeParadoxes(page);
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
  await voice(page, 'Mystic');
  await say(page, today$(page), mystic);
  await expect(page.locator('.fs-msg.fs-v', { hasText: mystic }).locator('.fs-sp')).toHaveText('Mystic');
  await hold(page, mystic, 'This line');
  await page.getByRole('switch', { name: /Keep close/ }).click();
  await expect(page.locator('.fs-msg', { hasText: mystic }).locator('.fs-kept')).toBeVisible();

  // ---- ask the first line: a question page, linked; the day keeps it. Write under it, take that to the council ----
  await hold(page, first, 'This line');
  await page.getByRole('button', { name: /Ask this/ }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-msg', { hasText: first })).toBeVisible();
  await page.locator('.fs-link', { hasText: first }).click();
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue(first);
  const answer = page.getByRole('textbox', { name: 'This page' });
  await expect(answer).toBeFocused();
  const questionUrl = page.url();
  const answered = 'Stand tall, young one.';
  await say(page, answer, answered);
  await hold(page, answered, 'This line');
  await page.getByRole('button', { name: 'Take to the council' }).click();
  await expect(page).toHaveURL(/#\/council\/[\w-]+$/);
  const councilUrl = page.url();
  await expect(page.locator('.fs-from a').first()).toHaveText(answered);

  // ---- the council: seat two voices, and they take turns ----
  const seat = (name: string) => page.getByRole('group', { name: 'Who sits' }).getByRole('button', { name, exact: true });
  await seat('Skeptic').click();
  await seat('Warrior').click();
  await page.getByRole('button', { name: 'Begin' }).click();
  const message = page.getByRole('textbox', { name: 'Message' });
  const skeptic = 'The mind is not pure, nor is it reliable.';
  const warrior = 'Then stand anyway.';
  await expect(chip(page, 'Skeptic')).toHaveAttribute('aria-pressed', 'true');
  await say(page, message, skeptic);
  await expect(chip(page, 'Warrior')).toHaveAttribute('aria-pressed', 'true');
  await say(page, message, warrior);
  await expect(page.locator('.fs-council .fs-msg', { hasText: skeptic })).toHaveAttribute('data-voice', 'Skeptic');
  await expect(page.locator('.fs-council .fs-msg', { hasText: warrior })).toHaveAttribute('data-voice', 'Warrior');

  // ---- Be: a goal and its balance, daily ----
  await tab(page, 'Be').click();
  const card = page.locator('#be-px-selfless-selfish');
  // V8: the tab is a list of pole pairs; a tap opens the spread under its row
  const row = card.getByRole('button', { name: /selfless\s*selfish/ });
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
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

  // ---- under the spread: the new goal is due today; check it, drag the lean (F0, moved from Flow) ----
  const group = card.getByRole('region', { name: 'Today, selfless and selfish' });
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
  await expect(group).toHaveAttribute('data-saved', 'true');

  // ---- Still: tap the moon on the Journal page; a kept line at the top; the ring brings it back ----
  await tab(page, 'Journal').click();
  await expect(today$(page)).toBeEnabled();
  const lightBefore = await page.locator('html').getAttribute('data-light');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
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
  // the keypad hears a hardware keyboard from the frame it is drawn; it says so (parts/Keypad data-listening)
  await expect(page.getByRole('group', { name: 'PIN' })).toHaveAttribute('data-listening', '');
  await page.keyboard.type('flow');
  await expect(tab(page, 'Journal')).toHaveAttribute('aria-current', 'page', { timeout: 15_000 });

  // ---- everything is still there, and Pages lists the entry ----
  await page.goto(questionUrl);
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue(first);
  await expect(page.locator('.fs-msg', { hasText: answered })).toBeVisible();
  await page.goto('/#/journal');
  await expect(page.locator('.fs-msg', { hasText: first })).toBeVisible();
  await expect(page.locator('.fs-msg', { hasText: mystic }).locator('.fs-kept')).toBeVisible();
  await page.getByRole('link', { name: 'Pages' }).click();
  await expect(page).toHaveURL(/#\/journal\/pages$/);
  await expect(page.locator('.fs-pagelist a.fs-list-row[href^="#/journal/"]', { hasText: first })).toBeVisible();
  // the council is known by its question, and shows who spoke
  await expect(page.locator('.fs-pagelist a.fs-list-row[href^="#/council/"]').locator('.fs-spoke')).toHaveAttribute('aria-label', 'Skeptic, Warrior');
  await page.goto(councilUrl);
  await expect(page.locator('.fs-council .fs-msg', { hasText: warrior })).toHaveAttribute('data-voice', 'Warrior');
  await expect(page.locator('.fs-council .fs-msg', { hasText: skeptic })).toHaveAttribute('data-voice', 'Skeptic');
  await tab(page, 'Be').click();
  await row.click();
  await expect(card.getByRole('button', { name: new RegExp(giving) })).toBeVisible();
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
  expect(file.tables.pages.length).toBeGreaterThan(1); // what the journey wrote; the seed writes no pages (V5)
  await expect(settings.locator('[data-export] small')).toHaveText(/^Last /);

  expect(outside).toEqual([]);
});
