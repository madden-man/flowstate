// Carried forward (F6, PLAN-FLOWS.md 3.7): end an episode and open the flow again at rest: the question shows once;
// a note written there shows at its step after an offline reload; the ended episode is a ghost ring, gone in Still;
// the person row is filled in its sheet and opens an sms: link (asserted, never followed); the morning after a
// prediction the Flow list asks once, and one tap draws his stamp.
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

async function enter(page: Page, url: string) {
  await page.goto(url);
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-app').waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

test('carried forward: the note asked once and shown at its step offline, ghost rings, the person row', async ({ page }) => {
  await enter(page, '/#/flow/panic');
  const dot = page.getByRole('slider', { name: 'Where you are' });
  await expect(page.locator('.fl-ghosts')).toHaveCount(0);

  // an episode: Overstimulated, then back to rest. Ended in front of the page, so nothing asks yet.
  await dot.focus();
  for (const [key, to] of [['ArrowRight', '1'], ['ArrowLeft', '0']]) {
    await page.keyboard.press(key);
    await expect(dot).toHaveAttribute('aria-valuenow', to);
    await expect(page.locator('.fs-flowpage')).toHaveAttribute('data-saved', 'true');
  }
  await expect.poll(async () => (await all(page, 'episodes')).map(e => e.endedAt !== undefined)).toEqual([true]);
  await expect(page.locator('.fl-ask')).toHaveCount(0);

  // opened again at rest: the question, once, with the caret on its rule; the ghost ring of the ended episode
  await page.reload();
  const ask = page.locator('.fl-ask');
  await expect(ask.locator('.fl-usual')).toHaveText("Anything to tell the next one of you who's here?");
  await expect(page.locator('.fl-ghosts [data-ghost]')).toHaveCount(1);
  await expect(page.locator('.fl-ghosts')).toBeVisible();
  await expect(page.locator('.fl-ghosts')).not.toContainText(/\d/);
  const field = page.getByRole('textbox', { name: 'To the next one of you' });
  await expect(field).toBeFocused();
  await field.pressSequentially('Leave the kitchen before anything else.', { delay: 2 });
  // it lands on the step the episode spent longest on; a chip moves it
  await expect(ask.getByRole('button', { name: 'Overstimulated' })).toHaveAttribute('aria-pressed', 'true');
  await ask.getByRole('button', { name: 'The wave' }).click();
  await expect(ask.getByRole('button', { name: 'The wave' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => ((await all(page, 'flows')).find(f => f.id === 'panic')!.notes as { stepId: string; text: string }[] | undefined)
    ?.map(n => [n.stepId, n.text])).toEqual([['panic-2', 'Leave the kitchen before anything else.']]);

  // offline, the question never comes back, and the note is at its step, his line above the said line
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.locator('.fl-step-page')).toBeVisible();
  await expect(page.locator('.fl-ask')).toHaveCount(0);
  await expect(page.locator('.fl-carried .fl-line')).toHaveText('Leave the kitchen before anything else.');
  await page.getByRole('button', { name: 'The wave' }).click();
  const note = page.locator('.fl-step-page .fl-note');
  await expect(note.locator('.fl-line')).toHaveText('Leave the kitchen before anything else.');
  await expect(note.locator('.fl-usual')).toContainText(/^you · \d+ \/ \d+$/);
  // above the said line
  expect(await page.evaluate(() => {
    const n = document.querySelector('.fl-step-page .fl-note')!, s = document.querySelector('.fl-step-page .fl-said')!;
    return !!(n.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);

  // Still: the ghost rings go, the note's words stay without the date
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.locator('.fl-ghosts')).toBeHidden();
  await expect(note.locator('.fl-line')).toBeVisible();
  await expect(note.locator('.fl-usual')).toBeHidden();
  await page.getByRole('button', { name: 'Leave Still' }).click();

  // the person row at Settling: no name yet, so it opens its sheet; filled, it is a link to Messages
  await page.getByRole('button', { name: 'Settling' }).click();
  const empty = page.locator('[data-tip="panic-3-person"] .fl-person-empty');
  await expect(empty).toHaveText(/Someone, written when calm/);
  await empty.click();
  const sheet = page.locator('[data-sheet="One person"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('textbox', { name: 'What the text says' })).toHaveAttribute('placeholder', /ten minutes/);
  await expect(sheet.getByRole('textbox', { name: 'What the text says' })).toHaveValue('');
  await sheet.getByRole('textbox', { name: 'Who' }).fill('Ali');
  await sheet.getByRole('textbox', { name: 'Their number' }).fill('555 010 4471');
  await sheet.getByRole('textbox', { name: 'What the text says' }).fill('Hard hour. Can you talk to me for ten minutes?');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect.poll(async () => JSON.stringify((await all(page, 'flows')).find(f => f.id === 'panic'))).toContain('Ali');
  const link = page.locator('[data-tip="panic-3-person"] a.fl-person');
  await expect(link).toContainText('Text Ali');
  await expect(link).toContainText('Person');
  await expect(link).toHaveAttribute('href', 'sms:5550104471?&body=Hard%20hour.%20Can%20you%20talk%20to%20me%20for%20ten%20minutes%3F');
  // the walk: the card shows the text as it will read, a drawn bubble that is the same link
  const bubble = page.locator('[data-tip="panic-3-person"] a.fl-bubble');
  await expect(bubble).toHaveText('Hard hour. Can you talk to me for ten minutes?');
  await expect(bubble).toHaveAttribute('href', 'sms:5550104471?&body=Hard%20hour.%20Can%20you%20talk%20to%20me%20for%20ten%20minutes%3F');
});

test('your own stamps: the morning after a prediction, one tap, and the mark is drawn', async ({ page }) => {
  await enter(page, '/#/flow');
  const DAY = 24 * 3_600_000;
  const at = Date.now() - DAY;
  const flowId = (await all(page, 'flows')).some(f => f.id === 'whatif') ? 'whatif' : 'panic';
  await put(page, 'episodes', {
    id: 'e-worry', flowId, startedAt: at, endedAt: at + 3_600_000, marks: [], done: [],
    prediction: { text: "Tomorrow's call goes badly.", at },
  });
  await page.reload();
  const block = page.locator('.fl-stampask');
  await expect(block.locator('.fl-usual')).toHaveText("Yesterday's worry");
  await expect(block.locator('.fl-line')).toHaveText("Tomorrow's call goes badly.");
  await block.getByRole('button', { name: "Didn't happen" }).click();
  await expect(block).toHaveCount(0);
  await expect.poll(async () => ((await all(page, 'episodes')).find(e => e.id === 'e-worry')!.prediction as { outcome?: string }).outcome).toBe('didnt');
  await page.reload();
  await expect(page.locator('.fl-stampask')).toHaveCount(0);
  await page.goto(`/#/flow/${flowId}`);
  // F4: the curve draws his mark itself on its flat, and the seeded nine in ten give way to it
  await expect(page.locator('.fs-flowpage .fs-cycle[data-diagram="curve"] path.stamp.own')).toHaveCount(1);
  await expect(page.locator('.fl-stamps')).toHaveCount(0);
  await expect(page.locator('.fl-drawing')).toHaveAttribute('data-own', '');
  await expect(page.locator('.fs-cycle .seedstamp').first()).toBeHidden();
});
