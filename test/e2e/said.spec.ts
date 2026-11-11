// "Said for it" (PLAN-VALUES.md section 3 step 10, C5): under an open value, the lines confirmed for it or its shadow,
// newest first, each its day, its words and its voice's rule, the shadow's word on a shadow line; a row leads to its
// page; a label taken back is gone on the way back to Be; "Call a council" opens on "Who sits?" with the value's
// champions seated and the value pressed. No lines, no label. The value, its champions and the lines are put straight
// into the database (as council-for.spec.ts does), then the page reloads.
import { test, expect, type Page } from '@playwright/test';

const SHOTS = '/private/tmp/claude-501/-Users-musicman-dev/1ad0c267-8f19-4657-8e14-c974598f28dd/scratchpad/c5';
const shots = !!process.env.C5_SHOTS;
const HONESTY = 'value-honesty';
const DAY = 86_400_000;
const notebook = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1} / ${d.getDate()} / ${String(d.getFullYear()).slice(-2)}`; };

type Line = { id: string; pageId: string; kind: 'council' | 'entry'; at: number; voiceId?: string; text: string; side?: 'value' | 'shadow' };

/** honesty | discretion, Warrior fighting for honesty and Mystic for discretion, and the lines, each on its own page. */
const seed = (page: Page, lines: Line[]) => page.evaluate(({ honesty, lines }) => new Promise<void>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const tx = db.transaction(['values', 'pages', 'messages'], 'readwrite');
    const at = Date.now() - 30 * 86_400_000;
    tx.objectStore('values').put({
      id: honesty, createdAt: at, updatedAt: at, status: 'held', word: 'honesty', shadow: 'discretion', revisions: [],
      champions: [{ voiceId: 'v-warrior', side: 'value', at }, { voiceId: 'v-mystic', side: 'shadow', at: at + 1 }],
    });
    for (const l of lines) {
      tx.objectStore('pages').put({
        id: l.pageId, kind: l.kind, createdAt: l.at, updatedAt: l.at, state: 'open', tags: [], paradoxIds: [], linkedPageIds: [],
        ...(l.kind === 'council' && l.voiceId ? { seats: [l.voiceId] } : {}),
      });
      tx.objectStore('messages').put({
        id: l.id, pageId: l.pageId, at: l.at, text: l.text, kept: false,
        ...(l.voiceId ? { voiceId: l.voiceId } : {}), ...(l.side ? { for: { valueId: honesty, side: l.side } } : {}),
      });
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
}), { honesty: HONESTY, lines });

async function cross(page: Page) {
  await expect(page.locator('.fs-page').first()).toBeAttached();
  const t = page.locator('[data-threshold]');
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

async function setUp(page: Page, lines: Line[]) {
  await page.goto('/');
  await cross(page);
  await expect(page.getByRole('textbox', { name: "Today's page" })).toBeEnabled();
  await seed(page, lines);
  await page.goto(`/#/be/${HONESTY}`);
  await page.reload();
  await cross(page);
}

const honestyRow = (p: Page) => p.locator(`#be-${HONESTY}`);
const said = (p: Page) => honestyRow(p).locator('.fs-saidline');
const light = (page: Page, l: 'day' | 'night' | 'still') => page.evaluate(x => { document.documentElement.dataset.light = x; }, l);
const shot = async (page: Page, name: string, l: 'day' | 'night' | 'still') => {
  if (!shots) return;
  await light(page, l);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${SHOTS}/${name}` });
};

const now = Date.now();
const COUNCIL: Line = { id: 'm-council', pageId: 'p-council', kind: 'council', at: now - 3 * DAY, voiceId: 'v-warrior', text: 'Is it honest, or is it only loud?', side: 'value' };
const JOURNAL: Line = { id: 'm-journal', pageId: 'p-journal', kind: 'entry', at: now - DAY, voiceId: 'v-mystic', text: 'Not every true thing is mine to say tonight, and this one can wait for the morning when he is rested.', side: 'shadow' };

test('the lines said for a value, newest first; a row leads to its page; a label taken back is gone', async ({ page }) => {
  if (shots) await page.setViewportSize({ width: 390, height: 844 });
  await setUp(page, [COUNCIL, JOURNAL]);
  await expect(honestyRow(page).locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true');
  await expect(honestyRow(page).locator('.fs-said-label')).toHaveText('Said for it');
  await expect(said(page)).toHaveCount(2);
  await expect(said(page).locator('small')).toHaveText([`${notebook(JOURNAL.at)} discretion`, notebook(COUNCIL.at)]);
  await expect(said(page).nth(0).locator('small i')).toHaveText('discretion');
  await expect(said(page).nth(1).locator('small i')).toHaveCount(0);
  await expect(said(page).locator('span')).toHaveText([JOURNAL.text, COUNCIL.text]);
  // one line each, cut with an ellipsis, a 3px rule in its voice's colour
  const [h, overflow, rule] = await said(page).nth(0).evaluate(a => [a.getBoundingClientRect().height, getComputedStyle(a.querySelector('span')!).textOverflow, getComputedStyle(a).borderLeftWidth]);
  expect(h).toBeLessThan(40);
  expect(overflow).toBe('ellipsis');
  expect(rule).toBe('3px');
  // the shadow's word is the only italic: the day and the words stand upright, as on any line
  const styles = await said(page).nth(0).evaluate(a => ['small', 'small i', 'span'].map(q => getComputedStyle(a.querySelector(q)!).fontStyle));
  expect(styles).toEqual(['normal', 'italic', 'normal']);
  // no count anywhere
  await expect(honestyRow(page).locator('.fs-said-for')).not.toContainText(/\bof\b|\bmore\b|Earlier/);
  await expect(honestyRow(page).getByRole('button', { name: 'Call a council' })).toBeVisible();
  await shot(page, 'said-day.png', 'day');
  await shot(page, 'said-night.png', 'night');
  if (shots) await light(page, 'day');

  // the journal row leads to its page
  await said(page).nth(0).click();
  await expect(page).toHaveURL(new RegExp(`#/journal/${JOURNAL.pageId}$`));
  await expect(page.locator('.fs-col')).toContainText('Not every true thing');

  // the council row leads to its council; there the label is taken back
  await page.goBack();
  await expect(said(page)).toHaveCount(2);
  await said(page).nth(1).click();
  await expect(page).toHaveURL(new RegExp(`#/council/${COUNCIL.pageId}$`));
  const line = page.locator('.fs-council .fs-msg').filter({ hasText: 'only loud' });
  await expect(line.locator('.fs-sp')).toHaveText('Warrior · for honesty');
  await line.click();
  const spoke = page.locator('.fs-composer-wrap').getByRole('group', { name: 'Spoke for' });
  await spoke.getByRole('button', { name: 'honesty' }).click();
  await expect(line.locator('.fs-sp')).toHaveText('Warrior');

  // back on Be, that row is gone
  await page.goto(`/#/be/${HONESTY}`);
  await expect(said(page)).toHaveCount(1);
  await expect(said(page).locator('span')).toHaveText(JOURNAL.text);
});

test('Call a council opens on Who sits with the champions seated and the value pressed', async ({ page }) => {
  if (shots) await page.setViewportSize({ width: 390, height: 844 });
  await setUp(page, [COUNCIL]);
  await honestyRow(page).getByRole('button', { name: 'Call a council' }).click();
  await expect(page).toHaveURL(/#\/council\/[^/]+$/);
  await expect(page.getByText('Who sits?')).toBeVisible();
  const seatChip = (name: string) => page.getByRole('group', { name: 'Who sits' }).getByRole('button', { name, exact: true });
  await expect(seatChip('Warrior')).toHaveAttribute('aria-pressed', 'true');
  await expect(seatChip('Mystic')).toHaveAttribute('aria-pressed', 'true');
  await expect(seatChip('Skeptic')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('group', { name: 'For what' }).getByRole('button', { name: 'honesty' })).toHaveAttribute('aria-pressed', 'true');
  await shot(page, 'seats-after-call-night.png', 'night');
  if (shots) await light(page, 'day');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.locator('.fs-chat .fs-from')).toHaveText('About honesty');
});

test('no lines, no label; more than five, a quiet Earlier shows the rest in place', async ({ page }) => {
  // a plain ink line said on a page, never confirmed for anything: honesty has nothing said for it
  await setUp(page, [{ ...COUNCIL, side: undefined, voiceId: undefined }]);
  await expect(honestyRow(page).getByRole('button', { name: 'Edit' })).toBeVisible();
  await expect(honestyRow(page).locator('.fs-said-for')).toHaveCount(0);
  await expect(honestyRow(page)).not.toContainText('Said for it');

  const seven: Line[] = Array.from({ length: 7 }, (_, i) => ({
    id: `m-${i}`, pageId: `p-${i}`, kind: 'council', at: now - (i + 1) * DAY, voiceId: 'v-warrior', text: `line ${String.fromCharCode(97 + i)}`, side: 'value',
  }));
  await seed(page, seven);
  await page.reload();
  await cross(page);
  await expect(said(page).locator('span')).toHaveText(['line a', 'line b', 'line c', 'line d', 'line e']);
  const earlier = honestyRow(page).getByRole('button', { name: 'Earlier' });
  await expect(earlier).toHaveText('Earlier');
  await earlier.click();
  await expect(said(page).locator('span')).toHaveText(['line a', 'line b', 'line c', 'line d', 'line e', 'line f', 'line g']);
  await expect(earlier).toHaveCount(0);

  // Still: Be is words alone
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(honestyRow(page).locator('.fs-value')).toHaveText('honesty');
  await expect(page.locator('.fs-saidline')).toHaveCount(0);
  await expect(page.locator('.fs-values')).not.toContainText('Said for it');
});
