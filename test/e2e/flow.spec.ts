// Flow (package 4), offline: a cold deep link to #/flow opens Today; check one due item, drag the lean
// to a detent, reload with the network off, and the check and the lean are still there. Still keeps
// today's items and the sliders and puts the look back away. Nothing leaves the origin.
import { test, expect } from '@playwright/test';

test('flow: check, lean to a detent, and both survive an offline reload', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });

  // a cold load straight onto the deep link
  await page.goto('/#/flow');
  await expect(page.getByRole('link', { name: 'Flow' })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.fs-hdr-r')).toContainText('Today');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();

  const group = page.getByRole('region', { name: 'selfless and selfish' });
  const item = group.getByRole('checkbox', { name: /write for its own sake/ });
  await expect(item).toHaveAttribute('aria-checked', 'false');
  await item.click();
  await expect(item).toHaveAttribute('aria-checked', 'true');

  // drag the mark from the middle to the selfish end: it clicks onto the +1 detent
  const slider = group.getByRole('slider', { name: 'Lean between selfless and selfish' });
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

  // the look back draws the lean line once there is a lean
  await expect(page.getByRole('img', { name: /The lean between selfless and selfish over time/ })).toBeAttached();

  const saved = page.locator('.fs-flow[data-saved="true"]');
  await expect(saved).toBeAttached();
  await page.reload();
  await expect(item).toHaveAttribute('aria-checked', 'true');
  await expect(slider).toHaveAttribute('aria-valuenow', '1');
  await expect(group.getByText('more breathing room this week')).toBeVisible();

  // un-drawing the check takes today's done back out, and that survives a reload too
  await item.click();
  await expect(item).toHaveAttribute('aria-checked', 'false');
  await expect(saved).toBeAttached();
  await page.reload();
  await expect(item).toHaveAttribute('aria-checked', 'false');

  // Still: today's items and the sliders stay; the look back goes
  await expect(page.getByRole('region', { name: 'Look back' })).toBeVisible();
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(item).toBeVisible();
  await expect(slider).toBeVisible();
  await expect(page.getByRole('region', { name: 'Look back' })).toBeHidden();

  expect(outside).toEqual([]);
});
