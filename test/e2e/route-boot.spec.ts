// The address changed while the app is coming up: the hash moves in the moment between the first render (which reads
// the hash) and the router's hashchange listener (added in an effect, after paint). The page must still follow it.
// This is the window carried.spec.ts's stamps test hit under load: page.goto('/#/flow/<id>') right after a reload.
import { test, expect } from '@playwright/test';

test('a hash changed between the first render and the router listening is still followed', async ({ page }) => {
  await page.goto('/#/flow');
  await page.locator('.fs-app').waitFor();
  // on the next load, the moment the app's first render lands (a mutation, before any effect has run), move the hash
  await page.addInitScript(() => {
    new MutationObserver((_, mo) => {
      if (!document.querySelector('.fs-app')) return;
      mo.disconnect();
      location.hash = '#/flow/panic';
    }).observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  await expect(page).toHaveURL(/#\/flow\/panic$/);
  await expect(page.locator('.fs-flowpage')).toHaveCount(1);
});
