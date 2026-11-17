// The meter and the gates under a finger (2026-11-17: "none of the depression meters and chakra blockers work"). The
// other specs drag with a mouse, which lands on the rule and keeps it; a finger is captured by what it lands on (the
// drawn line inside the rule), and taking the touch for the rule fires lostpointercapture on that line. parts/RuleDrag
// read that as a release, so every touch drag ended as it began. These drags are real touches (CDP), a thumb's: begun
// on the drawn line, drifting a little down as they go.
import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, hash: string) {
  await page.goto(`/${hash}`);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

/** A thumb on the rule's drawn line at x0 (a fraction of its width), swept dx px right and a little down, then lifted. */
async function thumb(page: Page, name: string, x0: number, dx: number) {
  const rule = page.getByRole('slider', { name, exact: true });
  await rule.scrollIntoViewIfNeeded();
  const box = (await rule.boundingBox())!;
  const line = (await rule.locator('line').first().boundingBox())!;
  const x = box.x + box.width * x0, y = line.y + line.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, px: number, py: number) =>
    cdp.send('Input.dispatchTouchEvent', { type: type as 'touchStart', touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py, id: 1 }] });
  await send('touchStart', x, y);
  for (let k = 1; k <= 12; k++) { await send('touchMove', x + (dx * k) / 12, y + k / 2); await page.waitForTimeout(16); }
  await send('touchEnd', 0, 0);
  await cdp.detach();
  return rule;
}

const now = async (rule: ReturnType<Page['getByRole']>) => Number(await rule.getAttribute('aria-valuenow'));

test('touch: a thumb drags the Depression meter and the reading is kept', async ({ page }) => {
  await open(page, '#/flow');
  const plate = page.locator('.mt-plate');
  await plate.click({ position: { x: 4, y: 300 } });
  await expect(plate).toHaveAttribute('data-arrive', 'done');
  const rule = await thumb(page, 'Depression', 0.02, 140);
  await expect.poll(() => now(rule)).toBeGreaterThan(30);
  await expect(page.locator('.mt-meter')).not.toHaveAttribute('data-drag', '');
  await expect.poll(async () => Number(await plate.getAttribute('data-d'))).toBeGreaterThan(0.3);
});

test('touch: a thumb drags a gate on the mountain, across more than its own short rule', async ({ page }) => {
  await open(page, '#/flow');
  const plate = page.locator('.mt-plate');
  await plate.click({ position: { x: 4, y: 300 } });
  await expect(plate).toHaveAttribute('data-arrive', 'done');
  // the rule is about 54px long: 60px of thumb is well under half shut, not past the end
  const rule = await thumb(page, 'Heart gate', 0.1, 60);
  await expect.poll(() => now(rule)).toBeGreaterThan(25);
  expect(await now(rule)).toBeLessThan(55);
  // and the far end is still within a thumb's reach
  await thumb(page, 'Heart gate', 0.1, 140);
  await expect.poll(() => now(rule)).toBe(100);
});

test('touch: a thumb drags the gate on a sign\'s page', async ({ page }) => {
  await open(page, '#/flow/c/heart');
  const rule = await thumb(page, 'Heart gate', 0.05, 120);
  await expect.poll(() => now(rule)).toBeGreaterThan(30);
  await expect(page.locator('.fs-gate')).not.toHaveAttribute('data-drag', '');
});
