// Into the app (PLAN-TASKS.md T3): a sign's touch opens Journal, Council or Be with what it carries, the sign travels
// with him (printed beside the date where he lands) and a tap on it comes back to the sign's page (rule 28).
// Ask: his line on one rule on the plate, then today's page with the line asked and the answer rule open in italic.
// Core: Be, on "I determine my core." Bring it: a new council with his line as its first line. A voice: a council with
// the voice chips ready.
import { test, expect, type Page } from '@playwright/test';

const open = async (page: Page, hash: string) => {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-page').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
};

const backTo = async (page: Page, chakra: string) => {
  const sign = page.locator(`.fs-hdr-r [data-sign-back="${chakra}"]`);
  await expect(sign).toBeVisible();
  // beside the date, on its line
  await expect(page.locator('.fs-hdr-r > span', { has: page.locator(`[data-sign-back="${chakra}"]`) })).toContainText('Date:');
  const b = (await sign.boundingBox())!;
  expect(b.width).toBeGreaterThan(0);
  await sign.click();
  await expect(page).toHaveURL(new RegExp(`#/flow/c/${chakra}$`));
  await expect(page.locator('.ck-page')).toHaveAttribute('data-chakra', chakra);
};

test('Ask: the line written on the plate lands on today\'s page, asked, with the answer rule open; the sign goes back', async ({ page }) => {
  await open(page, '#/flow/c/third-eye');
  await page.getByRole('button', { name: 'Ask, Journal' }).click();
  const rule = page.locator('.ck-stage [data-into="ask"] input');
  await expect(rule).toBeFocused();
  // nothing to carry yet: no arrow, and Return does nothing
  await expect(page.locator('.ck-into-go')).toHaveCount(0);
  await rule.press('Enter');
  await expect(page).toHaveURL(/#\/flow\/c\/third-eye$/);
  await rule.pressSequentially('What am I not seeing?', { delay: 2 });
  await expect(page.locator('.ck-into-go')).toBeVisible();
  await page.screenshot({ path: 'test-results/into-ask-rule.png' });
  await rule.press('Enter');

  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-msg p', { hasText: 'What am I not seeing?' })).toBeVisible();
  await expect(page.locator('.fs-links a', { hasText: 'Asked · Questions' })).toBeVisible();
  // Turn to answer open: the next rule, under the line, in italic, the caret on it
  const answer = page.locator('.fs-msg.fs-wise textarea');
  await expect(answer).toBeFocused();
  await expect(page.locator('.fs-hdr-r [data-sign-back="third-eye"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/into-ask-journal.png' });
  await answer.pressSequentially('Stand tall, you have seen this before.', { delay: 2 });
  await answer.press('Enter');
  await expect(page.locator('.fs-msg.fs-wise p', { hasText: 'Stand tall' })).toBeVisible();
  // the next Return is ink again
  await expect(page.locator('textarea:focus').locator('xpath=..')).not.toHaveClass(/fs-wise/);
  // the question is under the ?
  await backTo(page, 'third-eye');
  await page.goto('/#/questions');
  await expect(page.getByText('What am I not seeing?')).toBeVisible();
  // today's page stays linked to the sign: the sign still prints there
  await page.goto('/#/journal');
  await expect(page.locator('.fs-hdr-r [data-sign-back="third-eye"]')).toBeVisible();
});

test('Core lands on Be under "I determine my core." with the sign beside the date, and the sign goes back', async ({ page }) => {
  await open(page, '#/flow/c/crown');
  await page.getByRole('button', { name: 'Core, Be' }).click();
  await expect(page).toHaveURL(/#\/be$/);
  await expect(page.getByText('I determine my core.').first()).toBeVisible();
  await expect(page.locator('.fs-hdr-r [data-sign-back="crown"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/into-core-be.png' });
  await backTo(page, 'crown');
  // back on the sign, the touch is let go: Be no longer prints it
  await page.goto('/#/be');
  await expect(page.locator('[data-sign-back]')).toHaveCount(0);
});

test('Bring it lands on a new council with his line first; A voice on one with the voice chips ready', async ({ page }) => {
  await open(page, '#/flow/c/third-eye');
  await page.getByRole('button', { name: 'Bring it, Council' }).click();
  const rule = page.locator('.ck-stage [data-into="bring-it"] input');
  await rule.pressSequentially('Should I take the job?', { delay: 2 });
  await page.locator('.ck-into-go').click();
  await expect(page).toHaveURL(/#\/council\/[\w-]+$/);
  await expect(page.locator('.fs-chat .fs-msg').first()).toHaveText('Should I take the job?');
  await expect(page.getByRole('group', { name: 'Who speaks next' })).toBeVisible();
  await expect(page.locator('.fs-hdr-r [data-sign-back="third-eye"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/into-bring-it-council.png' });
  await backTo(page, 'third-eye');

  await page.goto('/#/flow/c/throat');
  await page.getByRole('button', { name: 'A voice, Council' }).click();
  await expect(page).toHaveURL(/#\/council\/[\w-]+$/);
  await expect(page.getByText('Who sits?')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Who sits' })).toBeVisible();
  await expect(page.locator('.fs-chat .fs-msg')).toHaveCount(0);
  await expect(page.locator('.fs-hdr-r [data-sign-back="throat"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/into-a-voice-council.png' });
  await backTo(page, 'throat');
});

test('the other landings: Kept line, Letter, Write from it, Stand on, Questions, Sit, Spark it, each with its sign', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-11T12:00:00') });
  await open(page, '#/journal');
  // a kept line, kept the usual way: written, held, Keep close
  const today = page.getByRole('textbox', { name: "Today's page" });
  await today.click();
  await today.pressSequentially('The quiet voices know the way.', { delay: 2 });
  await today.press('Enter');
  const line = page.locator('.fs-msg', { hasText: 'The quiet voices know the way.' });
  await expect(line.locator('p')).toBeVisible();
  const box = (await line.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await page.getByRole('switch', { name: /Keep close/ }).click();
  await expect(line.locator('.fs-kept')).toBeVisible();

  // Kept line: the star shows it on Crown's plate, and a tap opens the page it was kept on
  await page.goto('/#/flow/c/crown');
  await page.getByRole('button', { name: 'Kept line, Journal' }).click();
  const star = page.locator('.ck-stage .ck-star');
  await expect(star).toContainText('The quiet voices know the way.');
  await page.screenshot({ path: 'test-results/into-kept-line-star.png' });
  await star.click();
  await expect(page).toHaveURL(/#\/journal/);
  await expect(page.locator('.fs-msg p', { hasText: 'The quiet voices know the way.' })).toBeVisible();
  await backTo(page, 'crown');

  // Letter: today's page, opening on "Dear" on its next rule; nothing is saved until he writes after it
  await page.goto('/#/flow/c/heart');
  await page.getByRole('button', { name: 'Letter, Journal' }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  const dear = page.locator('textarea:focus');
  await expect(dear).toHaveValue('Dear ');
  await expect(page.locator('.fs-hdr-r [data-sign-back="heart"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/into-letter.png' });
  await dear.pressSequentially('Sam,', { delay: 2 });
  await dear.press('Enter');
  await expect(page.locator('.fs-msg p', { hasText: 'Dear Sam,' })).toBeVisible();
  await backTo(page, 'heart');

  // Write from it: his word on one rule, then a line of today's page with the next rule ready
  await page.goto('/#/flow/c/sacral');
  await page.getByRole('button', { name: 'Write from it, Journal' }).click();
  const rule = page.locator('.ck-stage [data-into="write-from-it"] input');
  await rule.pressSequentially('restless', { delay: 2 });
  await rule.press('Enter');
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.locator('.fs-msg p', { hasText: /^restless$/ })).toBeVisible();
  await expect(page.locator('textarea:focus')).toHaveValue('');
  await expect(page.locator('.fs-hdr-r [data-sign-back="sacral"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/into-write-from-it.png' });
  await backTo(page, 'sacral');

  // Stand on: his held values on the plate; a tap opens that one on Be, its champions under it
  await page.goto('/#/flow/c/solar-plexus');
  await page.getByRole('button', { name: 'Stand on, Be' }).click();
  const values = page.locator('.ck-stage .ck-values .ck-value');
  await expect(values.first()).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/into-stand-on-plate.png' });
  const word = (await values.first().textContent())!;
  await values.first().click();
  await expect(page).toHaveURL(/#\/be\/[\w-]+$/);
  await expect(page.getByText(word).first()).toBeVisible();
  await expect(page.locator('.fs-hdr-r [data-sign-back="solar-plexus"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/into-stand-on-be.png' });
  await backTo(page, 'solar-plexus');

  // Spark it: Energize, the sign beside the date
  await page.getByRole('button', { name: 'Spark it, Energize' }).click();
  await expect(page).toHaveURL(/#\/flow\/energize$/);
  await expect(page.locator('.fs-hdr-r [data-sign-back="solar-plexus"]')).toBeVisible();
  await backTo(page, 'solar-plexus');

  // Questions: the ? tab
  await page.goto('/#/flow/c/third-eye');
  await page.getByRole('button', { name: 'Questions' }).click();
  await expect(page).toHaveURL(/#\/questions$/);
  await expect(page.locator('.fs-hdr-r [data-sign-back="third-eye"]')).toBeVisible();
  await backTo(page, 'third-eye');

  // Sit: Meditate, in Day
  await page.goto('/#/flow/c/crown');
  await expect(page.locator('html')).toHaveAttribute('data-light', 'day');
  await page.getByRole('button', { name: 'Sit, Meditate' }).click();
  await expect(page).toHaveURL(/#\/flow\/meditate$/);
  await expect(page.locator('.fs-hdr-r [data-sign-back="crown"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/into-sit-day.png' });
  await backTo(page, 'crown');
  // the mountain lets a touch go without coming back: nothing is printed after
  await page.getByRole('button', { name: 'Core, Be' }).click();
  await page.goto('/#/flow');
  await page.goto('/#/be');
  await expect(page.locator('[data-sign-back]')).toHaveCount(0);
});

test('in Still a touch still lands with its sign, in print, and Stand on opens Be itself', async ({ page }) => {
  await open(page, '#/flow/c/solar-plexus');
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await page.getByRole('button', { name: 'Stand on, Be' }).click();
  await expect(page).toHaveURL(/#\/be$/);
  await expect(page.locator('.fs-hdr-r [data-sign-back="solar-plexus"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/into-stand-on-still.png' });
  await backTo(page, 'solar-plexus');
});
