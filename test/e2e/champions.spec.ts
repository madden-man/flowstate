// PLAN-VALUES.md C3, steps 3 to 5: champions under an open value, "+ champion", the Champions segment and the voice
// sheet's "Fights for". A link made from any of the three doors shows on the others, on the list's rules and in the
// council's "Spoke for" chips without a reload; a why is written in place and kept; letting go of a champion with a why
// takes two taps; an archived voice is drawn nowhere and is a champion again when restored; Still shows only the words.
import { test, expect, type Page } from '@playwright/test';

const SHOTS = '/private/tmp/claude-501/-Users-musicman-dev/1ad0c267-8f19-4657-8e14-c974598f28dd/scratchpad/c3';
const shots = !!process.env.C3_SHOTS;
const SELFLESS = 'value-px-selfless-selfish';

type Row = { id: string; champions: { voiceId: string; side: string; why?: string }[] };
const valueRow = (page: Page, id: string) => page.evaluate(vid => new Promise<Row>((resolve, reject) => {
  const open = indexedDB.open('flowstate');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const q = db.transaction('values').objectStore('values').get(vid);
    q.onsuccess = () => { db.close(); resolve(q.result as Row); };
    q.onerror = () => reject(q.error);
  };
}), id);

async function cross(page: Page) {
  const t = page.locator('[data-threshold]');
  await page.waitForTimeout(50);
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
}

async function be(page: Page, hash = '#/be') {
  await page.goto(`/${hash}`);
  await expect(page.locator('.fs-be-core, .fs-champ-voice').first()).toBeAttached();
  await cross(page);
}

const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name, exact: true }).click();
const row = (p: Page, w: string) => p.locator('.fs-values .fs-be-row', { has: p.locator('.a', { hasText: new RegExp(`^${w}$`) }) });
const side = (p: Page, label: string) => p.getByRole('group', { name: label, exact: true });
const champSheet = (p: Page, word: string) => p.locator(`[data-sheet="Who fights for ${word}?"]`);
const done = async (_: Page, sheet: ReturnType<Page['locator']>) => { await sheet.getByRole('button', { name: 'Done' }).click(); await expect(sheet).toHaveCount(0); };
const light = (page: Page, l: 'day' | 'night' | 'still') => page.evaluate(x => { document.documentElement.dataset.light = x; }, l);
const shot = async (page: Page, name: string, l: 'day' | 'night') => {
  if (!shots) return;
  await light(page, l);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${SHOTS}/${name}` });
};

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); });

test('+ champion: two voices take up a value, their rows and colours show; a why is kept; two taps to let go of it', async ({ page }) => {
  await be(page, `#/be/${SELFLESS}`);
  const selfless = row(page, 'selfless');
  await expect(selfless.locator('.fs-dichotomy')).toHaveAttribute('aria-expanded', 'true');
  // nobody fights for it yet: the dashed recruiting row; the shadow side has only its + champion
  await expect(selfless.getByRole('button', { name: 'who fights for this?' })).toBeVisible();
  await expect(side(page, 'Fighting for selfish').locator('.fs-champ-none')).toHaveCount(0);

  await selfless.getByRole('button', { name: '+ champion', exact: true }).click();
  const sheet = champSheet(page, 'selfless');
  await expect(sheet).toBeVisible();
  const forValue = sheet.getByRole('group', { name: 'For selfless' });
  const forShadow = sheet.getByRole('group', { name: 'For selfish' });
  await expect(sheet).toContainText('And for selfish?');
  // every voice in chip order, deep twins among them, none pressed, none singled out
  await expect(forValue.getByRole('button')).toHaveCount(await forShadow.getByRole('button').count());
  await expect(forValue.getByRole('button').first()).toHaveText('Skeptic');
  await expect(forValue.getByRole('button', { name: 'Workaholic' })).toBeVisible();
  await forValue.getByRole('button', { name: 'Warrior', exact: true }).click();
  await forValue.getByRole('button', { name: 'Mystic', exact: true }).click();
  await expect(forValue.getByRole('button', { name: 'Warrior', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(forValue.getByRole('button', { name: 'Mystic', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(forShadow.getByRole('button', { name: 'Warrior', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await shot(page, 'sheet-day.png', 'day');
  await done(page, sheet);

  const valueSide = side(page, 'Fighting for it');
  await expect(valueSide.locator('.fs-champ')).toHaveCount(2);
  await expect(valueSide.locator('.fs-champ .fs-sp')).toHaveText(['Warrior', 'Mystic']);
  await expect(selfless.getByRole('button', { name: 'who fights for this?' })).toHaveCount(0);

  // the why, written in place; Return keeps it
  const why = page.getByRole('textbox', { name: 'Why Warrior fights for selfless' });
  await expect(why).toHaveAttribute('placeholder', 'Why, in a sentence');
  await why.fill('I hold the door, and I mean it.');
  await why.press('Enter');
  await expect.poll(async () => (await valueRow(page, SELFLESS)).champions.find(c => c.voiceId === 'v-warrior')?.why).toBe('I hold the door, and I mean it.');

  // the same voice on the shadow side: under the shadow's label, drawn the same
  await selfless.getByRole('button', { name: '+ champion for selfish' }).click();
  await sheet.getByRole('group', { name: 'For selfish' }).getByRole('button', { name: 'Warrior', exact: true }).click();
  await expect(sheet.getByRole('group', { name: 'For selfish' }).getByRole('button', { name: 'Warrior', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await done(page, sheet);
  const shadowSide = side(page, 'Fighting for selfish');
  await expect(shadowSide.locator('.fs-champ .fs-sp')).toHaveText(['Warrior']);
  const [a, b] = await Promise.all([valueSide.locator('.fs-champ').first(), shadowSide.locator('.fs-champ').first()].map(l => l.evaluate(e => {
    const s = getComputedStyle(e);
    return [s.borderLeftColor, s.borderLeftStyle, s.borderLeftWidth, s.backgroundColor].join(' ');
  })));
  expect(a).toBe(b);
  await shot(page, 'open-day.png', 'day');
  await shot(page, 'open-night.png', 'night');
  await light(page, 'day');

  // reload: the why is still there
  await page.reload();
  await cross(page);
  await expect(page.getByRole('textbox', { name: 'Why Warrior fights for selfless' })).toHaveValue('I hold the door, and I mean it.');

  // fold: the list row carries its champions' colours
  await row(page, 'selfless').locator('.fs-dichotomy').click();
  await expect(row(page, 'selfless').locator('.fs-spoke i')).toHaveCount(2);
  await expect(row(page, 'selfless').locator('.fs-spoke-none')).toHaveCount(0);
  await row(page, 'selfless').locator('.fs-dichotomy').click();

  // letting go of Warrior, who has a why, takes two taps; Mystic, who has none, one
  await row(page, 'selfless').getByRole('button', { name: '+ champion', exact: true }).click();
  const warrior = sheet.getByRole('group', { name: 'For selfless' }).locator('.fs-chip', { hasText: 'Warrior' });
  await warrior.click();
  await expect(warrior).toHaveClass(/armed/);
  await expect(warrior).toContainText('tap again');
  await expect(warrior).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(150);
  expect((await valueRow(page, SELFLESS)).champions.some(c => c.voiceId === 'v-warrior' && c.side === 'value')).toBe(true);
  await warrior.click();
  await expect(warrior).toHaveAttribute('aria-pressed', 'false');
  await expect(warrior).not.toHaveClass(/armed/);
  const mystic = sheet.getByRole('group', { name: 'For selfless' }).getByRole('button', { name: 'Mystic', exact: true });
  await mystic.click();
  await expect(mystic).toHaveAttribute('aria-pressed', 'false');
  await done(page, sheet);
  await expect(side(page, 'Fighting for it').locator('.fs-champ')).toHaveCount(0);
  await expect(row(page, 'selfless').getByRole('button', { name: 'who fights for this?' })).toBeVisible();
  // the shadow side kept its own link
  await expect(side(page, 'Fighting for selfish').locator('.fs-champ .fs-sp')).toHaveText(['Warrior']);
});

test('the Champions segment: each voice and what it fights for; a tap toggles from the voice', async ({ page }) => {
  await be(page, `#/be/${SELFLESS}`);
  await row(page, 'selfless').getByRole('button', { name: '+ champion', exact: true }).click();
  const sheet = champSheet(page, 'selfless');
  await sheet.getByRole('group', { name: 'For selfless' }).getByRole('button', { name: 'Warrior', exact: true }).click();
  await sheet.getByRole('group', { name: 'For selfish' }).getByRole('button', { name: 'Warrior', exact: true }).click();
  await sheet.getByRole('group', { name: 'For selfish' }).getByRole('button', { name: 'Sensualist', exact: true }).click();
  await expect(sheet.getByRole('group', { name: 'For selfish' }).getByRole('button', { name: 'Sensualist', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await done(page, sheet);

  await page.getByRole('navigation', { name: 'Be' }).getByRole('link', { name: 'Champions' }).click();
  const voice = (name: string) => page.locator('.fs-champ-voice', { has: page.locator('.fs-champ-vname', { hasText: new RegExp(`^${name}$`) }) });
  await expect(page.locator('.fs-champ-vname').first()).toHaveText('Skeptic');
  await expect(voice('Warrior').locator('.fs-champ-vals')).toHaveText('selfless, selfish');
  await expect(voice('Warrior').locator('.fs-champ-vals span')).toHaveText('selfless');
  await expect(voice('Warrior').locator('.fs-champ-vals i')).toHaveText('selfish');
  expect(await voice('Warrior').locator('.fs-champ-vals i').evaluate(e => getComputedStyle(e).fontStyle)).toBe('italic');
  expect(await voice('Warrior').locator('.fs-champ-vals span').evaluate(e => getComputedStyle(e).fontStyle)).toBe('normal');
  await expect(voice('Skeptic').locator('.fs-champ-vals')).toHaveText('nothing yet');
  // no number anywhere on the page
  expect(await page.locator('.fs-sheetof').innerText()).not.toMatch(/\d/);
  await shot(page, 'champions-day.png', 'day');
  await light(page, 'day');

  await voice('Warrior').click();
  const vs = page.locator('[data-sheet="What does Warrior fight for?"]');
  await expect(vs).toBeVisible();
  await expect(vs.getByRole('group', { name: 'Values' }).getByRole('button')).toHaveText(['selfless', 'thoughtful']);
  await expect(vs.getByRole('group', { name: 'Shadows' }).getByRole('button')).toHaveText(['selfish', 'reactive']);
  await expect(vs.getByRole('group', { name: 'Values' }).getByRole('button', { name: 'selfless' })).toHaveAttribute('aria-pressed', 'true');
  await vs.getByRole('group', { name: 'Values' }).getByRole('button', { name: 'thoughtful' }).click();
  await expect(vs.getByRole('group', { name: 'Values' }).getByRole('button', { name: 'thoughtful' })).toHaveAttribute('aria-pressed', 'true');
  await shot(page, 'voice-values-sheet-night.png', 'night');
  await light(page, 'day');
  await done(page, vs);
  await expect(voice('Warrior').locator('.fs-champ-vals')).toHaveText('selfless, selfish, thoughtful');

  // the link shows under the value
  await page.getByRole('navigation', { name: 'Be' }).getByRole('link', { name: 'Values' }).click();
  await row(page, 'thoughtful').locator('.fs-dichotomy').click();
  await expect(row(page, 'thoughtful').getByRole('group', { name: 'Fighting for it' }).locator('.fs-champ .fs-sp')).toHaveText(['Warrior']);
});

test("the voice sheet's Fights for toggles; an archived voice is drawn nowhere and comes back when restored", async ({ page }) => {
  await be(page);
  await page.goto('/#/voices');
  const mysticName = page.locator('.fs-vname', { hasText: /^Mystic/ });
  await mysticName.click();
  const vsheet = page.locator('[data-sheet="Mystic"]');
  await expect(vsheet).toBeVisible();
  const fights = vsheet.locator('.fs-fightsfor');
  await expect(fights).toContainText('Fights for');
  await fights.getByRole('group', { name: 'Values' }).getByRole('button', { name: 'thoughtful' }).click();
  await expect(fights.getByRole('group', { name: 'Values' }).getByRole('button', { name: 'thoughtful' })).toHaveAttribute('aria-pressed', 'true');
  await shot(page, 'voicesheet-day.png', 'day');
  await vsheet.getByRole('button', { name: 'Done' }).click();
  await expect(vsheet).toHaveCount(0);

  await tab(page, 'Be');
  await row(page, 'thoughtful').locator('.fs-dichotomy').click();
  await expect(row(page, 'thoughtful').getByRole('group', { name: 'Fighting for it' }).locator('.fs-champ .fs-sp')).toHaveText(['Mystic']);

  // archived: not drawn under the value, on the list row, on Champions, or in the sheet
  await page.goto('/#/voices');
  await mysticName.click();
  await vsheet.getByRole('button', { name: 'Archive' }).click();
  await expect(vsheet).toHaveCount(0);
  await tab(page, 'Be');
  await row(page, 'thoughtful').locator('.fs-dichotomy').click();
  await expect(row(page, 'thoughtful').getByRole('group', { name: 'Fighting for it' }).locator('.fs-champ')).toHaveCount(0);
  await row(page, 'thoughtful').getByRole('button', { name: '+ champion', exact: true }).click();
  await expect(champSheet(page, 'thoughtful').getByRole('button', { name: 'Mystic', exact: true })).toHaveCount(0);
  await done(page, champSheet(page, 'thoughtful'));
  await row(page, 'thoughtful').locator('.fs-dichotomy').click();
  await expect(row(page, 'thoughtful').locator('.fs-spoke-none')).toHaveCount(1);
  await page.getByRole('navigation', { name: 'Be' }).getByRole('link', { name: 'Champions' }).click();
  await expect(page.locator('.fs-champ-vname', { hasText: /^Mystic$/ })).toHaveCount(0);

  // restored: a champion again
  await page.goto('/#/voices');
  await page.getByRole('region', { name: 'Archived' }).getByRole('button', { name: 'Restore' }).click();
  await tab(page, 'Be');
  await row(page, 'thoughtful').locator('.fs-dichotomy').click();
  await expect(row(page, 'thoughtful').getByRole('group', { name: 'Fighting for it' }).locator('.fs-champ .fs-sp')).toHaveText(['Mystic']);
});

test("a link made on Be shows in the council's Spoke for chips, by tabs alone", async ({ page }) => {
  await be(page, `#/be/${SELFLESS}`);
  await row(page, 'selfless').getByRole('button', { name: '+ champion', exact: true }).click();
  const sheet = champSheet(page, 'selfless');
  await sheet.getByRole('group', { name: 'For selfless' }).getByRole('button', { name: 'Warrior', exact: true }).click();
  await expect(sheet.getByRole('group', { name: 'For selfless' }).getByRole('button', { name: 'Warrior', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await done(page, sheet);

  await tab(page, 'Council');
  await page.getByRole('button', { name: 'New council' }).click();
  await page.getByRole('group', { name: 'Who sits' }).getByRole('button', { name: 'Warrior', exact: true }).click();
  await page.getByRole('button', { name: 'Begin' }).click();
  const say = page.getByRole('textbox', { name: 'Message' });
  await say.fill('I will hold the door.');
  await say.press('Enter');
  const line = page.locator('.fs-council .fs-msg').last();
  await expect(line).toHaveAttribute('data-voice', 'Warrior');
  await line.click();
  const spoke = page.locator('.fs-composer-wrap').getByRole('group', { name: 'Spoke for' });
  await expect(spoke.getByRole('button')).toHaveText(['selfless', '+ value']);

  // and back: thoughtful taken up from the voice's sheet shows there too, after a turn through Be
  await tab(page, 'Be');
  await page.getByRole('navigation', { name: 'Be' }).getByRole('link', { name: 'Champions' }).click();
  await page.locator('.fs-champ-voice', { hasText: 'Warrior' }).click();
  const vs = page.locator('[data-sheet="What does Warrior fight for?"]');
  await vs.getByRole('group', { name: 'Shadows' }).getByRole('button', { name: 'reactive' }).click();
  await expect(vs.getByRole('group', { name: 'Shadows' }).getByRole('button', { name: 'reactive' })).toHaveAttribute('aria-pressed', 'true');
  await done(page, vs);
  await tab(page, 'Council');
  await page.getByRole('link', { name: /I will hold the door/ }).last().click();
  await page.locator('.fs-council .fs-msg').last().click();
  await expect(page.locator('.fs-composer-wrap').getByRole('group', { name: 'Spoke for' }).getByRole('button')).toHaveText(['selfless', 'reactive', '+ value']);
});

test('Still: #/be/champions typed by hand falls back to the words', async ({ page }) => {
  await be(page, '#/be/champions');
  await expect(page.locator('.fs-champ-voice').first()).toBeVisible();
  await page.getByRole('button', { name: 'Still', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  await expect(page.locator('.fs-values .fs-value')).toHaveText(['selfless', 'thoughtful']);
  await expect(page.locator('.fs-champ-voice, .fs-champs')).toHaveCount(0);
  await page.goto('/#/be/champions');
  await expect(page.locator('.fs-values .fs-value')).toHaveText(['selfless', 'thoughtful']);
  await expect(page.locator('.fs-champ-voice, .fs-champs')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Be' })).toBeHidden();
});
