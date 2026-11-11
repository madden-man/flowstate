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

// R3: a flow under no sign keeps the old flow page, and with it the note to the next one of you (PLAN-MOUNTAIN.md
// section 6 takes the note off a sign's page only). Panic is taken off its sign here, so it is such a flow.
test('a flow under no sign: the note asked once and shown at its step offline, gone in Still with its date', async ({ page }) => {
  await enter(page, '/#/flow');
  const panic = (await all(page, 'flows')).find(f => f.id === 'panic')!;
  delete panic.chakra;
  await put(page, 'flows', panic);
  await page.goto('/#/flow/panic');
  await page.reload();
  await expect(page.locator('.fs-flowpage')).toBeVisible();
  await expect(page.locator('.ck-page')).toHaveCount(0);
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
});

test('carried forward on a sign\'s page: no ghost rings and no note (the old drawings are gone), the person row', async ({ page }) => {
  // Panic opens on the Root's page; its drawing left the page (Tommy, 2026-11-11), and the ghost rings with it
  await enter(page, '/#/flow/panic/3');
  await expect(page.locator('.ck-page')).toHaveAttribute('data-showing', '3');
  await expect(page.locator('.fl-ghosts, .fl-ask, .fl-carried, .fl-note')).toHaveCount(0);

  // the person row at Settling: no name yet, so it opens its sheet; filled, it is a link to Messages
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
});

test('your own stamps: the morning after a prediction, one tap, and the outcome is kept', async ({ page }) => {
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
  // the old drawings are gone from a sign's page, so the mark is kept on the episode and not drawn there
  await expect(page.locator('.ck-page')).toHaveAttribute('data-front', flowId);
  await expect(page.locator('.fs-cycle')).toHaveCount(0);
});
