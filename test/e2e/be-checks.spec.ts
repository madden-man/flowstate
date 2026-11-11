// The checks and the lean under a spread on Be (package 4, moved from Flow by PLAN-FLOWS.md F0), offline: a
// cold deep link to #/be/:id opens that paradox's spread; check one due goal, drag the lean to a detent,
// reload with the network off, and the check and the lean are still there. Still puts the checks and the
// slider away (counts and states leave in Still). Nothing leaves the origin.
import { test, expect } from '@playwright/test';
import { writeParadoxes } from './paradoxes';

test('be: check under the spread, lean to a detent, and both survive an offline reload', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });

  // a cold load straight onto the deep link
  await page.goto('/#/be/px-selfless-selfish');
  await expect(page.getByRole('link', { name: 'Be' })).toHaveAttribute('aria-current', 'page');
  // C1: a fresh install has values and no paradoxes, so the paradoxes this screen shows are written first
  await writeParadoxes(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  // the threshold, when a cold load breathes, is tapped through first
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-dichotomy').first().waitFor();
  if (await t.count()) await t.click();

  const card = page.locator('#be-px-selfless-selfish');
  await expect(card.getByRole('button', { name: /selfless\s*selfish/ })).toHaveAttribute('aria-expanded', 'true');
  const group = card.getByRole('region', { name: 'Today, selfless and selfish' });
  const item = group.getByRole('checkbox', { name: /write for its own sake/ });
  await expect(item).toHaveAttribute('aria-checked', 'false');
  await item.click();
  await expect(item).toHaveAttribute('aria-checked', 'true');

  // drag the mark from the middle to the selfish end: it clicks onto the +1 detent
  const slider = group.getByRole('slider', { name: 'Lean between selfless and selfish' });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, y, { steps: 6 });
  await page.mouse.move(box.x + box.width - 2, y, { steps: 4 });
  await page.mouse.up();
  await expect(slider).toHaveAttribute('aria-valuenow', '1');
  await expect(slider).toHaveAttribute('aria-valuetext', 'selfish');

  // a note, one line beneath
  await group.getByRole('button', { name: 'note' }).click();
  await page.getByRole('textbox', { name: /Note on the lean/ }).fill('more breathing room this week');
  await page.getByRole('textbox', { name: /Note on the lean/ }).press('Enter');
  await expect(group.getByText('more breathing room this week')).toBeVisible();

  // the look back is gone from the app
  await expect(page.getByRole('region', { name: 'Look back' })).toHaveCount(0);

  await expect(group).toHaveAttribute('data-saved', 'true');
  await page.reload();
  if (await t.count()) await t.click();
  await expect(item).toHaveAttribute('aria-checked', 'true');
  await expect(slider).toHaveAttribute('aria-valuenow', '1');
  await expect(group.getByText('more breathing room this week')).toBeVisible();

  // un-drawing the check takes today's done back out, and that survives a reload too
  await item.click();
  await expect(item).toHaveAttribute('aria-checked', 'false');
  await expect(group).toHaveAttribute('data-saved', 'true');
  await page.reload();
  if (await t.count()) await t.click();
  await expect(item).toHaveAttribute('aria-checked', 'false');

  // a paradox with nothing due today still has its lean under the spread
  const other = page.locator('#be-px-thoughtful-reactive');
  await other.getByRole('button', { name: /thoughtful\s*reactive/ }).click();
  await expect(other.getByRole('slider', { name: 'Lean between thoughtful and reactive' })).toBeVisible();

  // Still: the spread stays; the checks and the slider go
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(card.locator('[data-laid="true"]')).toBeVisible();
  await expect(item).toBeHidden();
  await expect(slider).toBeHidden();

  expect(outside).toEqual([]);
});
