// The safety lines on a stop's page, checked on the page itself (R3 review finding 7): for every seeded flow under a
// sign, in Day, Night and Still, at rest and with an episode live on each of its steps, every line the old FlowPage
// printed there is on the page and visible: the 988 lines, the doctor lines, the hand-offs (a link to their step), and
// 3 a.m.'s rest line. The expected lines are read from the stored flows, so a page that stopped passing them, or hid
// them in a light, fails here.
import { test, expect, type Page } from '@playwright/test';

type Tip = { id: string; text: string; print?: boolean; struck?: boolean; handoff?: { flowId: string; stepId: string } };
type Flow = { id: string; chakra?: string; restLine?: string; steps: { id: string; tips: Tip[] }[] };

const TIMES = { day: '2026-11-11T12:00:00', night: '2026-11-11T21:30:00' } as const;

const storedFlows = (page: Page) => page.evaluate(() => new Promise<Flow[]>((resolve, reject) => {
  const req = indexedDB.open('flowstate');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const r = req.result.transaction('flows').objectStore('flows').getAll();
    r.onsuccess = () => { req.result.close(); resolve(r.result as Flow[]); };
    r.onerror = () => reject(r.error);
  };
}));

async function enter(page: Page, light: 'day' | 'night' | 'still') {
  await page.clock.install({ time: new Date(light === 'day' ? TIMES.day : TIMES.night) });
  await page.goto('/#/flow/c/root');
  const t = page.locator('[data-threshold]');
  await page.locator('.fs-page').first().waitFor();
  if (await t.count()) await t.click();
  await expect(t).toHaveCount(0);
  await expect(page.locator('.ck-page')).toBeVisible();
  if (light === 'still') {
    await page.getByRole('button', { name: 'Still', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-light', 'still');
  } else await expect(page.locator('html')).toHaveAttribute('data-light', light);
}

/** Every line the old FlowPage printed for this flow at this place: its rest line at rest, its step's print lines. */
async function expectLines(page: Page, f: Flow, at: number, where: string) {
  const prints = page.locator('.ck-page .fl-prints');
  if (at === 0) {
    if (f.restLine) await expect(prints.getByText(f.restLine, { exact: true }), where).toBeVisible();
    return;
  }
  for (const t of f.steps[at - 1].tips.filter(x => x.print && !x.struck)) {
    const line = prints.locator(`[data-tip="${t.id}"]`);
    await expect(line, `${where} ${t.id}`).toBeVisible();
    if (t.handoff) {
      await expect(line.locator('a.fl-handoff'), `${where} ${t.id}`).toBeVisible();
      await expect(line, `${where} ${t.id}`).not.toContainText(/\bflow\b/);
    } else await expect(line, `${where} ${t.id}`).toHaveText(t.text);
  }
}

for (const light of ['day', 'night', 'still'] as const) {
  test(`every safety line the old flow page printed is on its stop's page, in ${light}, at rest and on every step`, async ({ page }) => {
    test.setTimeout(240_000);
    await enter(page, light);
    const flows = (await storedFlows(page)).filter(f => f.chakra);
    expect(flows.map(f => f.id).sort()).toEqual(['depress', 'fight', 'night', 'panic', 'replay', 'shame', 'shutdown', 'whatif']);
    // the lines that matter most are among them
    const all = flows.flatMap(f => [f.restLine ?? '', ...f.steps.flatMap(s => s.tips.filter(t => t.print).map(t => t.text))]).join(' ');
    expect(all).toMatch(/988/);
    expect(all).toMatch(/doctor/);

    for (const f of flows) {
      await page.goto(`/#/flow/c/${f.chakra}`);
      const body = page.locator('.ck-page');
      await expect(body).toHaveAttribute('data-chakra', f.chakra!);
      await expectLines(page, f, 0, `${light} ${f.id} at rest`);
      // an episode, live on each step in turn
      await page.goto(`/#/flow/${f.id}`);
      await expect(body).toHaveAttribute('data-front', f.id);
      const dot = page.locator(`.ck-drawing[data-flow="${f.id}"]`).getByRole('slider', { name: 'Where you are' });
      for (let k = 1; k <= f.steps.length; k++) {
        await dot.focus();
        await page.keyboard.press('ArrowRight');
        await expect(page).toHaveURL(new RegExp(`#/flow/${f.id}/${k}$`));
        await expect(body).toHaveAttribute('data-saved', 'true');
        await expect(dot).toHaveAttribute('aria-valuenow', String(k));
        await expectLines(page, f, k, `${light} ${f.id} live on ${k}`);
      }
    }
  });
}
