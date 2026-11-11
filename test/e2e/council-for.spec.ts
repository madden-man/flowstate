// PLAN-VALUES.md C4, steps 6 to 9: a line is spoken with no label and confirmed after, on a tap, for what its voice
// fights for (values and shadows alike); a second tap takes it back; "+ value" makes the voice a champion and confirms
// in one go; "For what?" on the seats seats a value's champions and the council prints "About" with it. The same
// confirm and take-back on a journal page. Champions are set up in the database as champion() writes them (C3 builds
// the Be screens for them), then the page reloads.
import { test, expect, type Page } from '@playwright/test';

const SHOTS = '/private/tmp/claude-501/-Users-musicman-dev/1ad0c267-8f19-4657-8e14-c974598f28dd/scratchpad/c4';
const shots = !!process.env.C4_SHOTS;
const HONESTY = 'value-honesty';
const THOUGHTFUL = 'value-px-thoughtful-reactive';
const SELFLESS = 'value-px-selfless-selfish';

type Row = Record<string, unknown>;
/** Reads every row of a table as the app stores it (no lock in these specs, so plain). */
const rows = (page: Page, table: string) => page.evaluate(t => new Promise<Row[]>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const q = db.transaction(t).objectStore(t).getAll();
    q.onsuccess = () => { db.close(); resolve(q.result as Row[]); };
    q.onerror = () => reject(q.error);
  };
}), table);

/** honesty | discretion, and champions as champion() writes them: Warrior for honesty and for thoughtful's shadow
 *  (reactive), Mystic for honesty's shadow (discretion). */
const seedValues = (page: Page) => page.evaluate(({ honesty, thoughtful }) => new Promise<void>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const tx = db.transaction('values', 'readwrite');
    const s = tx.objectStore('values');
    const at = Date.now();
    s.put({
      id: honesty, createdAt: at, updatedAt: at, status: 'held', word: 'honesty', shadow: 'discretion', revisions: [],
      champions: [{ voiceId: 'v-warrior', side: 'value', at }, { voiceId: 'v-mystic', side: 'shadow', at: at + 1 }],
    });
    const g = s.get(thoughtful);
    g.onsuccess = () => {
      const v = g.result;
      v.champions = [...v.champions, { voiceId: 'v-warrior', side: 'shadow', at: at + 2 }];
      s.put(v);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}), { honesty: HONESTY, thoughtful: THOUGHTFUL });

async function cross(page: Page) {
  await expect(page.locator('.fs-col')).toBeAttached();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

async function setUp(page: Page) {
  await page.goto('/');
  await cross(page);
  await expect(page.getByRole('textbox', { name: "Today's page" })).toBeEnabled();
  await seedValues(page);
}

const light = (page: Page, l: 'day' | 'night' | 'still') => page.evaluate(x => { document.documentElement.dataset.light = x; }, l);
const shot = async (page: Page, name: string, l: 'day' | 'night' | 'still') => {
  if (!shots) return;
  await light(page, l);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${SHOTS}/${name}` });
};

test('a council line is confirmed for a value after it is said, and taken back', async ({ page }) => {
  if (shots) await page.setViewportSize({ width: 390, height: 844 });
  await setUp(page);
  await page.goto('/#/council');
  await page.getByRole('button', { name: 'New council' }).click();

  // "For what?": one chip per held value; honesty seats its champions, value side first, and the council is about it
  const forWhat = page.getByRole('group', { name: 'For what' });
  await expect(forWhat.getByRole('button')).toHaveText(['selfless', 'thoughtful', 'honesty']);
  await forWhat.getByRole('button', { name: 'honesty' }).click();
  await expect(forWhat.getByRole('button', { name: 'honesty' })).toHaveAttribute('aria-pressed', 'true');
  const seatChip = (name: string) => page.getByRole('group', { name: 'Who sits' }).getByRole('button', { name, exact: true });
  await expect(seatChip('Warrior')).toHaveAttribute('aria-pressed', 'true');
  await expect(seatChip('Mystic')).toHaveAttribute('aria-pressed', 'true');
  await expect(seatChip('Skeptic')).toHaveAttribute('aria-pressed', 'false');
  await shot(page, 'seats-night.png', 'night');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('group', { name: 'Who speaks next' }).getByRole('button')).toHaveText(['Ink', 'Warrior', 'Mystic', '+ seat']);
  await expect(page.locator('.fs-chat .fs-from')).toHaveText('About honesty');

  // three lines spoken as always: Warrior, Warrior again (a chip tap), then the turn goes to Mystic; no label anywhere
  const say = page.getByRole('textbox', { name: 'Message' });
  const lines = page.locator('.fs-council .fs-msg');
  const line = async (text: string) => { await say.fill(text); await say.press('Enter'); await expect(lines.last()).toContainText(text); };
  await line('He asked what I thought. I told him it was fine.');
  await page.getByRole('group', { name: 'Who speaks next' }).getByRole('button', { name: 'Warrior', exact: true }).click();
  await line('The evening. So I owe him the real answer.');
  await line('He asked at the door, with his coat on. Tomorrow.');
  await expect(lines.nth(1)).toHaveAttribute('data-voice', 'Warrior');
  await expect(lines.nth(2)).toHaveAttribute('data-voice', 'Mystic');
  await expect(page.locator('.fs-sp-for')).toHaveCount(0);
  // the second Warrior line is mid-run: no speaker printed yet
  await expect(lines.nth(1).locator('.fs-sp')).toHaveCount(0);

  // tap it: the reply bar, and under the quote what Warrior fights for, value and shadow as plain words
  await lines.nth(1).click();
  const spoke = page.locator('.fs-composer-wrap').getByRole('group', { name: 'Spoke for' });
  await expect(spoke).toContainText('Spoke for');
  await expect(spoke.getByRole('button')).toHaveText(['reactive', 'honesty', '+ value']);
  await expect(say).toBeFocused();
  await shot(page, 'council-tap-night.png', 'night');
  await spoke.getByRole('button', { name: 'honesty' }).click();
  await expect(spoke.getByRole('button', { name: 'honesty' })).toHaveAttribute('aria-pressed', 'true');
  // the label on that line only, even mid-run; nothing sent, the bar stays, the caret stays in the composer
  await expect(lines.nth(1).locator('.fs-sp')).toHaveText('Warrior · for honesty');
  await expect(lines.nth(0).locator('.fs-sp')).toHaveText('Warrior');
  await expect(lines).toHaveCount(3);
  await expect(page.locator('.fs-replying')).toHaveCount(1);
  await expect(say).toBeFocused();
  await expect(say).toHaveValue('');
  await shot(page, 'council-confirmed-night.png', 'night');
  if (shots) {
    // the keyboard up on a 390x844 phone leaves about 508px: the reply bar and both chip rows still leave the conversation
    await page.setViewportSize({ width: 390, height: 508 });
    await shot(page, 'council-keyboard-night.png', 'night');
    await shot(page, 'council-confirmed-day.png', 'day');
    await page.setViewportSize({ width: 390, height: 844 });
  }

  // the record: the line carries the label in the database (what saidFor reads), and a reload keeps it
  const saidFor = async (valueId: string) => (await rows(page, 'messages')).filter(m => (m.for as { valueId?: string } | undefined)?.valueId === valueId).map(m => [m.text, (m.for as { side: string }).side]);
  await expect.poll(() => saidFor(HONESTY)).toEqual([['The evening. So I owe him the real answer.', 'value']]);
  await page.reload();
  await expect(lines.nth(1).locator('.fs-sp')).toHaveText('Warrior · for honesty');
  await expect(page.locator('.fs-sp-for')).toHaveCount(1);

  // tap again, then the pressed chip: taken back
  await lines.nth(1).click();
  await expect(spoke.getByRole('button', { name: 'honesty' })).toHaveAttribute('aria-pressed', 'true');
  await spoke.getByRole('button', { name: 'honesty' }).click();
  await expect(page.locator('.fs-sp-for')).toHaveCount(0);
  await expect(lines.nth(1).locator('.fs-sp')).toHaveCount(0);
  await expect.poll(() => saidFor(HONESTY)).toEqual([]);

  // the shadow gets a voice too: Mystic's line for discretion, drawn the same way
  await lines.nth(2).click();
  await expect(spoke.getByRole('button')).toHaveText(['discretion', '+ value']);
  await spoke.getByRole('button', { name: 'discretion' }).click();
  await expect(lines.nth(2).locator('.fs-sp')).toHaveText('Mystic · for discretion');
  await expect.poll(() => saidFor(HONESTY)).toEqual([['He asked at the door, with his coat on. Tomorrow.', 'shadow']]);

  // "+ value": what Warrior does not fight for yet; a pick makes it a champion and confirms the line in one go
  await lines.nth(0).click();
  await spoke.getByRole('button', { name: '+ value' }).click();
  const sheet = page.locator('[data-sheet="Spoke for"]');
  await expect(sheet.getByRole('button', { name: 'Done' })).toBeVisible();
  await expect(sheet.getByRole('group', { name: 'Take up' }).getByRole('button')).toHaveText(['selfless', 'selfish', 'thoughtful', 'discretion']);
  await sheet.getByRole('button', { name: 'selfless', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(lines.nth(0).locator('.fs-sp')).toHaveText('Warrior · for selfless');
  await expect.poll(async () => ((await rows(page, 'values')).find(v => v.id === SELFLESS)!.champions as { voiceId: string; side: string }[])
    .some(c => c.voiceId === 'v-warrior' && c.side === 'value')).toBe(true);
  await expect(spoke.getByRole('button')).toHaveText(['selfless', 'reactive', 'honesty', '+ value']);
  await expect(spoke.getByRole('button', { name: 'selfless' })).toHaveAttribute('aria-pressed', 'true');

  // a line in plain ink offers nothing
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('group', { name: 'Who speaks next' }).getByRole('button', { name: 'Plain ink' }).click();
  await line('a line in plain ink');
  await lines.last().click();
  await expect(page.locator('.fs-replying')).toHaveCount(1);
  await expect(spoke).toHaveCount(0);

  // Still: the labels and the row stay (words, not counts); nothing printed is a number
  await lines.nth(2).click();
  await shot(page, 'council-still.png', 'still');
  await light(page, 'still');
  await expect(lines.nth(2).locator('.fs-sp')).toHaveText('Mystic · for discretion');
  await expect(spoke).toBeVisible();
  expect(await spoke.innerText()).not.toMatch(/\d/);
  expect(await page.locator('.fs-sp-for').allInnerTexts()).not.toContainEqual(expect.stringMatching(/\d/));
});

test('a second tap on a value takes it off the council and leaves the seats; no values, no row', async ({ page }) => {
  await setUp(page);
  await page.goto('/#/council');
  await page.getByRole('button', { name: 'New council' }).click();
  const honesty = page.getByRole('group', { name: 'For what' }).getByRole('button', { name: 'honesty' });
  await honesty.click();
  await expect(honesty).toHaveAttribute('aria-pressed', 'true');
  await honesty.click();
  await expect(honesty).toHaveAttribute('aria-pressed', 'false');
  const seatChip = (name: string) => page.getByRole('group', { name: 'Who sits' }).getByRole('button', { name, exact: true });
  await expect(seatChip('Warrior')).toHaveAttribute('aria-pressed', 'true');
  await expect(seatChip('Mystic')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.locator('.fs-chat .fs-from')).toHaveCount(0);

  // every value resting: no "For what?" row on a new council
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('flowstate');
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('values', 'readwrite');
      const q = tx.objectStore('values').getAll();
      q.onsuccess = () => { for (const v of q.result) tx.objectStore('values').put({ ...v, status: 'resting' }); };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.goto('/#/council');
  await page.reload();
  await page.getByRole('button', { name: 'New council' }).click();
  await expect(page.getByText('Who sits?')).toBeVisible();
  await expect(page.getByText('For what?')).toHaveCount(0);
});

test('a journal line is confirmed for a value on a tap, and taken back', async ({ page }) => {
  if (shots) await page.setViewportSize({ width: 390, height: 844 });
  await setUp(page);
  await page.reload();
  await cross(page);
  const today = page.getByRole('textbox', { name: "Today's page" });
  await today.click();
  await today.pressSequentially('Slept badly.', { delay: 2 });
  await today.press('Enter');
  await today.pressSequentially('Call him before noon and say the part I left out.', { delay: 2 });
  // the margin dot: Warrior speaks this line
  await page.locator('.fs-msg.cur .fs-dot').click();
  await page.getByRole('group', { name: 'Who speaks this line' }).getByRole('button', { name: 'Warrior', exact: true }).click();
  await today.press('Enter');
  await today.pressSequentially('Then breakfast.', { delay: 2 });
  await expect(today).toHaveAttribute('data-saved', 'true');
  await page.reload();
  await cross(page);

  const warrior = page.locator('.fs-col .fs-msg[data-line]').filter({ hasText: 'Call him' });
  await expect(warrior.locator('.fs-sp')).toHaveText('Warrior');
  const spoke = page.locator('.fs-col').getByRole('group', { name: 'Spoke for' });
  await expect(spoke).toHaveCount(0);

  // tapped, the line offers what Warrior fights for, under it; a confirm keeps the caret in the line
  await warrior.locator('p').click();
  const editing = page.getByRole('textbox', { name: 'This line' });
  await expect(editing).toBeFocused();
  await expect(spoke.getByRole('button')).toHaveText(['reactive', 'honesty', '+ value']);
  await spoke.getByRole('button', { name: 'honesty' }).click();
  await expect(warrior.locator('.fs-sp')).toHaveText('Warrior · for honesty');
  await expect(editing).toBeFocused();
  await shot(page, 'journal-day.png', 'day');
  if (shots) { await shot(page, 'journal-night.png', 'night'); await shot(page, 'journal-still.png', 'still'); await light(page, 'day'); }
  const said = async () => (await rows(page, 'messages')).filter(m => (m.for as { valueId?: string } | undefined)?.valueId === HONESTY).map(m => m.text);
  await expect.poll(said).toEqual(['Call him before noon and say the part I left out.']);

  await page.reload();
  await cross(page);
  await expect(warrior.locator('.fs-sp')).toHaveText('Warrior · for honesty');
  expect(await said()).toEqual(['Call him before noon and say the part I left out.']);

  // another line made current: the row goes; an ink line offers none
  await warrior.locator('p').click();
  await expect(spoke).toHaveCount(1);
  await page.locator('.fs-col .fs-msg p', { hasText: 'Slept badly.' }).click();
  await expect(spoke).toHaveCount(0);

  // tap again, the pressed chip: taken back
  await warrior.locator('p').click();
  await spoke.getByRole('button', { name: 'honesty' }).click();
  await expect(page.locator('.fs-sp-for')).toHaveCount(0);
  await expect.poll(said).toEqual([]);
  // typing on after a take-back keeps the line spoken by Warrior and unlabelled
  await editing.press('End');
  await page.keyboard.type(' Today.', { delay: 2 });
  await page.waitForTimeout(500);
  await page.reload();
  await cross(page);
  await expect(warrior).toContainText('Today.');
  await expect(warrior.locator('.fs-sp')).toHaveText('Warrior');
});

test('a named voice keeps its role tap beside the label (V10)', async ({ page }) => {
  await setUp(page);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('flowstate');
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('voices', 'readwrite');
      const q = tx.objectStore('voices').get('v-warrior');
      q.onsuccess = () => tx.objectStore('voices').put({ ...q.result, given: 'Gus' });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.goto('/#/council');
  await page.reload();
  await page.getByRole('button', { name: 'New council' }).click();
  await page.getByRole('group', { name: 'Who sits' }).getByRole('button', { name: 'Gus', exact: true }).click();
  await page.getByRole('button', { name: 'Begin' }).click();
  const say = page.getByRole('textbox', { name: 'Message' });
  await say.fill('Say the true thing.');
  await say.press('Enter');
  const line = page.locator('.fs-council .fs-msg').first();
  await line.locator('p').click();
  await page.locator('.fs-composer-wrap').getByRole('group', { name: 'Spoke for' }).getByRole('button', { name: 'honesty' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  const name = line.locator('.fs-sp');
  await expect(name).toHaveText('Gus · for honesty');
  await name.click();
  await expect(name).toHaveText('Gus · Warrior · for honesty');
  await expect(page.locator('.fs-replying')).toHaveCount(0);
  await name.click();
  await expect(name).toHaveText('Gus · for honesty');
});
