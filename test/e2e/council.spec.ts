// The council, offline (package 2, V3): New council opens on its seats; seat the Warrior and the Skeptic,
// Begin, and two Returns alternate them without a chip tap; a chip tap speaks for one line and the turn
// goes on; "+ seat" then "+ voice" seats a new voice "Gardener"; tap a message to reply to it; Ink is one
// tap; a reload keeps all of it. Nothing leaves the origin.
import { test, expect } from '@playwright/test';

test('a council seats its voices, takes turns, gains a voice and survives a reload offline', async ({ page, context, baseURL }) => {
  const outside: string[] = [];
  context.on('request', r => { if (!r.url().startsWith(baseURL!)) outside.push(r.url()); });

  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);

  await page.reload();
  await expect(page.getByRole('textbox', { name: "Today's page" })).toBeEnabled();
  await page.getByRole('link', { name: 'Council', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Council', exact: true })).toHaveAttribute('aria-current', 'page');

  // the list has no composer, only New council at the bottom
  const say = page.getByRole('textbox', { name: 'Message' });
  await expect(say).toHaveCount(0);
  await page.getByRole('button', { name: 'New council' }).click();
  await expect(page).toHaveURL(/#\/council\/[\w-]+$/);
  const councilUrl = page.url();

  // the seats screen: who sits?
  await expect(page.getByText('Who sits?')).toBeVisible();
  const seatChip = (name: string) => page.getByRole('group', { name: 'Who sits' }).getByRole('button', { name, exact: true });
  await expect(seatChip('Phantom')).toBeVisible();
  await seatChip('Warrior').click();
  await seatChip('Skeptic').click();
  await expect(seatChip('Warrior')).toHaveAttribute('aria-pressed', 'true');
  await expect(seatChip('Skeptic')).toHaveAttribute('aria-pressed', 'true');
  await expect(seatChip('Mystic')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Begin' }).click();

  // only the seated voices get chips, in seat order
  const row = page.getByRole('group', { name: 'Who speaks next' });
  const chip = (name: string) => row.getByRole('button', { name, exact: true });
  await expect(row.getByRole('button')).toHaveText(['Ink', 'Warrior', 'Skeptic', '+ seat']);
  await expect(say).toBeFocused();
  await expect(say).toHaveAttribute('placeholder', 'Warrior speaks…');
  await expect(chip('Warrior')).toHaveAttribute('aria-pressed', 'true');

  const lines = page.locator('.fs-msg');
  const line = async (text: string) => { await say.fill(text); await say.press('Enter'); await expect(lines.last()).toContainText(text); };

  // two Returns, two voices, no chip tapped
  await line('Stand tall, young one.');
  await expect(say).toHaveAttribute('placeholder', 'Skeptic speaks…');
  await line('And which voice is that, exactly?');
  await expect(lines.nth(0)).toHaveAttribute('data-voice', 'Warrior');
  await expect(lines.nth(1)).toHaveAttribute('data-voice', 'Skeptic');
  await expect(say).toHaveAttribute('placeholder', 'Warrior speaks…');

  // a tap breaks the order for one line; the turn goes on from whoever just spoke
  await chip('Skeptic').click();
  await expect(say).toHaveAttribute('placeholder', 'Skeptic speaks…');
  await line('Name one.');
  await expect(lines.nth(2)).toHaveAttribute('data-voice', 'Skeptic');
  await expect(chip('Warrior')).toHaveAttribute('aria-pressed', 'true');
  await line('The one that never shouts.');
  await expect(lines.nth(3)).toHaveAttribute('data-voice', 'Warrior');

  // "+ seat" opens the seat row; "+ voice" there makes a voice that sits and speaks next
  await chip('+ seat').click();
  await page.getByRole('group', { name: 'Who sits' }).getByRole('button', { name: '+ voice' }).click();
  const sheet = page.locator('[data-sheet="A new voice"]');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Gardener');
  const wheel = sheet.getByRole('slider', { name: 'Colour' });
  const box = (await wheel.boundingBox())!;
  // a tap on the left of the ring, a little above the middle: violet, clear of every seeded voice
  await wheel.click({ position: { x: box.width * 0.1, y: box.height * 0.4 } });
  await expect.poll(async () => Number(await wheel.getAttribute('aria-valuenow'))).toBeGreaterThan(270);
  expect(Number(await wheel.getAttribute('aria-valuenow'))).toBeLessThan(290);
  await expect(sheet.getByRole('status')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(seatChip('Gardener')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.fs-seatrow').getByRole('button', { name: 'Done' }).click();
  await expect(row.getByRole('button')).toHaveText(['Ink', 'Warrior', 'Skeptic', 'Gardener', '+ seat']);
  await expect(chip('Gardener')).toHaveAttribute('aria-pressed', 'true');
  await line('Tend what is growing.');
  await expect(lines.nth(4)).toHaveAttribute('data-voice', 'Gardener');

  // tap a message to reply to it: the quote sits above the composer, then on the line
  await lines.nth(1).click();
  await expect(page.locator('.fs-replying .fs-quote')).toContainText('And which voice is that, exactly?');
  await expect(say).toBeFocused();
  await expect(say).toHaveAttribute('placeholder', 'Warrior speaks…');
  await line('This one.');
  await expect(lines.nth(5)).toHaveAttribute('data-voice', 'Warrior');
  await expect(lines.nth(5).locator('.fs-quote')).toContainText('And which voice is that, exactly?');
  await expect(page.locator('.fs-replying')).toHaveCount(0);

  // Ink is one tap, and takes no turn
  await chip('Plain ink').click();
  await line('a line in plain ink');
  expect(await lines.nth(6).getAttribute('data-voice')).toBeNull();
  await expect(say).toHaveAttribute('placeholder', 'Skeptic speaks…');

  // the lamp takes the last voice's colour
  await expect(page.locator('.fs-app')).toHaveAttribute('data-lamp', '');

  // long press keeps the sheet, without Reply (a tap does that now)
  const held = lines.nth(0);
  const hb = (await held.boundingBox())!;
  await page.mouse.move(hb.x + 30, hb.y + 12);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  const msheet = page.locator('[data-sheet="Message"]');
  await expect(msheet).toBeVisible();
  await expect(msheet.getByRole('button', { name: 'Reply' })).toHaveCount(0);
  await expect(msheet.getByRole('button', { name: /Speak as/ })).toBeVisible();
  await msheet.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.fs-replying')).toHaveCount(0);

  const voices = ['Warrior', 'Skeptic', 'Skeptic', 'Warrior', 'Gardener', 'Warrior'];
  const expectAll = async () => {
    await expect(lines).toHaveCount(7);
    for (const [i, v] of voices.entries()) await expect(lines.nth(i)).toHaveAttribute('data-voice', v);
  };
  await expectAll();

  // a reload goes straight to the conversation, seats and turn intact
  await page.reload();
  await expectAll();
  await expect(row.getByRole('button')).toHaveText(['Ink', 'Warrior', 'Skeptic', 'Gardener', '+ seat']);
  await expect(say).toHaveAttribute('placeholder', 'Skeptic speaks…');

  // the list knows it by its first line, with New council still at the bottom
  await page.getByRole('link', { name: 'Councils', exact: true }).click();
  await expect(page.locator(`.fs-crow[href="#/council/${councilUrl.split('/').pop()}"]`)).toContainText('Stand tall, young one.');
  await expect(page.getByRole('button', { name: 'New council' })).toBeVisible();

  // the Voices screen has the Gardener too, beside the rest of the pantheon
  await page.getByRole('link', { name: 'Voices', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Gardener/ })).toBeVisible();

  expect(outside).toEqual([]);
});

test('a voice given a name of its own speaks by it; a tap on the name shows its role (V10)', async ({ page }) => {
  await page.goto('/#/voices');
  await page.getByRole('button', { name: /^Warrior/ }).click();
  const sheet = page.locator('[data-sheet="Warrior"]');
  await expect(sheet.getByRole('textbox', { name: 'Role' })).toHaveValue('Warrior');
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Gus');
  await sheet.getByRole('button', { name: 'Done' }).click();
  // the Voices screen shows the name, the role beside the other words it goes by
  await expect(page.getByRole('button', { name: /^Gus\s*Warrior/ })).toBeVisible();

  await page.getByRole('link', { name: 'Councils', exact: true }).click();
  await page.getByRole('button', { name: 'New council' }).click();
  await page.getByRole('group', { name: 'Who sits' }).getByRole('button', { name: 'Gus', exact: true }).click();
  await page.getByRole('button', { name: 'Begin' }).click();
  const say = page.getByRole('textbox', { name: 'Message' });
  await expect(say).toHaveAttribute('placeholder', 'Gus speaks…');
  await say.fill('Stand tall.');
  await say.press('Enter');
  const name = page.locator('.fs-msg .fs-sp');
  await expect(name).toHaveText('Gus');
  // a tap on the name shows the role, and does not reply to the line
  await name.click();
  await expect(name).toHaveText('Gus · Warrior');
  await expect(page.locator('.fs-replying')).toHaveCount(0);
  await name.click();
  await expect(name).toHaveText('Gus');
});

