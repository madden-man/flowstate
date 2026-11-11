// The door without the PIN (F5, PLAN-FLOWS.md 3.7): set a PIN, turn the door on, reload to the keypad; "the ring"
// opens Right now with nothing private on it; a line puts the dot on its step without writing; the PIN (asked by the
// moon) writes the step as the episode's first mark. With the door off the word is gone and #/flow/now is the keypad.
import { test, expect, type Page } from '@playwright/test';

const keypad = (p: Page) => p.getByRole('group', { name: 'PIN' });
const tap = async (p: Page, digits: string, scope = p.locator('body')) => {
  for (const d of digits) await scope.locator('.fs-key', { has: p.locator('b', { hasText: new RegExp(`^${d}$`) }) }).click();
};
const episodes = (page: Page) => page.evaluate(() => new Promise<{ flowId: string; endedAt?: number; marks: { stepId: string }[] }[]>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const r = open.result.transaction('episodes').objectStore('episodes').getAll();
    r.onsuccess = () => { open.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
  };
}));
/** The words a person can see on the page. */
const visibleText = (page: Page) => page.evaluate(() => {
  const out: string[] = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.parentElement?.checkVisibility()) out.push(n.textContent ?? '');
  return out.join(' ');
});

test('door: the ring opens Right now read-only, the PIN writes the step, off means the keypad', async ({ page, baseURL }) => {
  await page.goto('/');
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);

  // a line on today's page, and an ended Panic episode, so there is a page and a "last time" to keep behind the PIN
  const line = 'Something only I should read.';
  const note = 'A note only I should read.';
  const today = page.getByRole('textbox', { name: "Today's page" });
  await today.click();
  await today.pressSequentially(line, { delay: 2 });
  await expect(today).toHaveAttribute('data-saved', 'true');
  await page.goto('/#/flow/panic');
  const dot = page.getByRole('slider', { name: 'Where you are' });
  await dot.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dot).toHaveAttribute('aria-valuenow', '1');
  await expect.poll(async () => (await episodes(page)).length).toBe(1);
  await page.keyboard.press('ArrowLeft');
  await expect(dot).toHaveAttribute('aria-valuenow', '0');
  await expect.poll(async () => (await episodes(page)).map(e => e.endedAt !== undefined)).toEqual([true]);
  await expect(page.locator('.fl-last')).toBeVisible();
  // F6: a note to the next one of you at the wave, and the ended episode is a ghost ring; both stay behind the PIN
  await page.evaluate(([text]) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('flowstate');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const st = open.result.transaction('flows', 'readwrite').objectStore('flows');
      const g = st.get('panic');
      g.onsuccess = () => {
        const f = g.result;
        f.notes = [{ id: 'n-door', stepId: 'panic-2', text, at: Date.now(), episodeId: 'e-door' }];
        const w = st.put(f);
        w.onsuccess = () => { open.result.close(); resolve(); };
        w.onerror = () => reject(w.error);
      };
    };
  }), [note] as const);
  await page.reload();
  await expect(page.locator('.fl-ghosts [data-ghost]')).toHaveCount(1);

  // Settings: no door switch until there is a PIN; the Shortcut row is there either way
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.locator('[data-sheet="Settings"]');
  await expect(settings.locator('[data-shortcut-row]')).toContainText(`${baseURL}/#/flow/now`);
  await expect(settings.locator('[data-shortcut-row]')).toContainText('Back Tap');
  await expect(settings.getByRole('switch', { name: /The ring without the PIN/ })).toHaveCount(0);
  await settings.getByRole('button', { name: /Set a PIN/ }).click();
  const sheet = page.locator('[data-sheet="Set a PIN"]');
  await tap(page, '3569', sheet);
  await sheet.getByRole('button', { name: 'Next' }).click();
  await tap(page, '3569', sheet);
  await expect(settings.getByRole('button', { name: 'Change PIN' })).toBeVisible({ timeout: 15_000 });
  const door = settings.getByRole('switch', { name: /The ring without the PIN/ });
  await expect(door).toHaveAttribute('aria-checked', 'false');
  await door.click();
  await expect(door).toHaveAttribute('aria-checked', 'true');
  await settings.getByRole('button', { name: 'Done' }).click();

  // a reload is locked: the keypad, and one word under it
  await page.goto('/#/journal');
  await page.reload();
  await expect(keypad(page)).toBeVisible();
  const ring = page.getByRole('link', { name: 'the ring' });
  await expect(ring).toBeVisible();
  await ring.click();

  // Right now: the seed lines, with the flow and step in print; nothing private, nothing to write with
  await expect(page).toHaveURL(/#\/flow\/now$/);
  await expect(keypad(page)).toHaveCount(0);
  const rows = page.locator('.fl-nowlist a.fl-flow');
  // every flow's lines, in flow order: Panic's four first (F3's seed flows follow them)
  await expect(rows.nth(3).locator('.fs-list-meta')).toHaveText('Panic · Under the skin');
  await expect(rows.first().locator('.fs-list-line')).toHaveText('Too much coming in at once.');
  await expect(rows.first().locator('.fs-list-meta')).toHaveText('Panic · Overstimulated');
  const behindThePin = async () => {
    await expect(page.locator('[data-kept-line], .fs-kept-line, .fs-echo')).toHaveCount(0);
    await expect(page.locator('.fl-last')).toHaveCount(0);
    await expect(page.locator('a[href^="#/journal"]')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Settings' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Edit$/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Edit$/ })).toHaveCount(0);
    const words = await visibleText(page);
    expect(words).not.toContain(line);
    expect(words).not.toMatch(/Last time|last time/);
    // F6: notes, the question, ghost rings, his stamps and the person row are behind the PIN
    await expect(page.locator('.fl-note, .fl-ask, .fl-ghosts, .fl-stamps, .fl-person, .fl-carried')).toHaveCount(0);
    expect(words).not.toContain(note);
  };
  await behindThePin();

  // a line puts the dot on its step; nothing is written yet
  await rows.nth(1).click();
  await expect(page).toHaveURL(/#\/flow\/panic\/2$/);
  await expect(dot).toHaveAttribute('aria-valuenow', '2');
  await expect(page.locator('.fs-flowpage .fl-line')).toHaveText('The wave. Loud, fast, certain.');
  await expect(page.locator('.fs-flowpage .fl-said')).toContainText("it's already on its way out");
  await behindThePin();
  expect((await episodes(page)).filter(e => e.endedAt === undefined)).toEqual([]);

  // F2's rows through the door: the ring can still be held; a tick draws and writes nothing; the rows that write or
  // leave (Journal, Timer, ♪, Five), what helped, Edit and the step sheet stay behind the PIN
  await expect(page.getByRole('button', { name: 'Hold to breathe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hold the ring' })).toBeVisible();
  await page.goto('/#/flow/panic/4');
  await expect(keypad(page)).toHaveCount(0);
  await expect(page.locator('.fs-flowpage[data-door]')).toBeVisible();
  // M5: the stream runs through the door too (it shows no past episode)
  await expect(page.locator('.fs-flowpage[data-door] .fl-stream svg')).toHaveAttribute('data-running', '');
  const water = page.locator('[data-tip="panic-4-water"] [role="checkbox"]');
  await water.click();
  await expect(water).toHaveAttribute('aria-checked', 'true');
  for (const id of ['panic-4-album', 'panic-4-write']) await expect(page.locator(`[data-tip="${id}"]`)).toHaveCount(0);
  await expect(page.locator('.fl-helped, .fl-edit, .fl-timer, .fl-return, .fl-five, .fs-sheet, .fl-add')).toHaveCount(0);
  await page.goto('/#/flow/panic/3');
  await expect(page.locator('[data-tip="panic-3-window"]')).toBeVisible();
  await expect(page.locator('[data-tip="panic-3-five"]')).toHaveCount(0);
  await page.goto('/#/flow/panic/1');
  await expect(page.locator('[data-tip="panic-1-album"]')).toHaveCount(0);
  await expect(page.locator('[data-tip="panic-1-less"]')).toBeVisible();
  await behindThePin();
  expect((await episodes(page)).filter(e => e.endedAt === undefined)).toEqual([]);
  expect((await episodes(page)).flatMap(e => (e as { done?: unknown[] }).done ?? [])).toEqual([]);

  // any other hash is the keypad again, and back
  await page.goto('/#/flow/panic');
  await expect(keypad(page)).toBeVisible();
  await page.goto('/#/flow/panic/2');
  await expect(keypad(page)).toHaveCount(0);
  // the held dot is memory only: a reload lost it, so put it back from Right now
  await page.goto('/#/flow/now');
  await rows.nth(1).click();
  await expect(dot).toHaveAttribute('aria-valuenow', '2');

  // the moon asks for the PIN in a sheet; the PIN writes the step as the episode's first mark and settles into Still
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  const pin = page.locator('[data-sheet="Your PIN"]');
  await expect(pin).toBeVisible();
  await tap(page, '3569', pin);
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/#\/flow\/panic\/2$/);
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect.poll(async () => (await episodes(page)).filter(e => e.endedAt === undefined).map(e => [e.flowId, e.marks.map(m => m.stepId)]))
    .toEqual([['panic', ['panic-2']]]);
  await expect(dot).toHaveAttribute('aria-valuenow', '2');
  await page.getByRole('button', { name: 'Leave Still' }).click();

  // locked again with the episode live: the app opens on its step through the door, read-only; the Flow word asks
  // for the PIN and then opens the list, and nothing new is marked
  await page.goto('/#/journal');
  await page.reload();
  await expect(page).toHaveURL(/#\/flow\/panic\/2$/);
  await expect(dot).toHaveAttribute('aria-valuenow', '2');
  await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(0);
  await behindThePin();
  await page.getByRole('button', { name: 'Flow', exact: true }).click();
  await tap(page, '3569', pin);
  await expect(page).toHaveURL(/#\/flow$/, { timeout: 15_000 });
  await expect(page.locator('a.fl-now[href="#/flow/now"]')).toBeVisible();
  expect((await episodes(page)).filter(e => e.endedAt === undefined).map(e => e.marks.map(m => m.stepId))).toEqual([['panic-2']]);

  // the door off: no word under the keypad, and #/flow/now waits behind it
  await page.getByRole('button', { name: 'Settings' }).click();
  await door.click();
  await expect(door).toHaveAttribute('aria-checked', 'false');
  await settings.getByRole('button', { name: 'Done' }).click();
  await page.goto('/#/flow/now');
  await page.reload();
  await expect(keypad(page)).toBeVisible();
  await expect(page.getByRole('link', { name: 'the ring' })).toHaveCount(0);
  await expect(page.locator('.fl-nowlist')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/flow\/now$/);
  await page.keyboard.type('flow');
  await expect(page.locator('.fl-nowlist a.fl-flow').first()).toBeVisible({ timeout: 15_000 });
});
