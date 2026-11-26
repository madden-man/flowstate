// Shared by the two desktop chain specs (script/chain/nc.spec.ts, mc.spec.ts), copied beside them into a throwaway clone
// of each app. A screen of the running app as markup: the body as rendered with every field's value written in, the
// scroll of every scrolled box kept as data-st, a canvas as its picture, nothing that goes anywhere; and every rule of
// the app's own stylesheets, as the window holds them. The window's own size and its <html> attributes go with it.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';

export type Shot = { css: string; body: string; bodyAttrs: [string, string][]; htmlAttrs: [string, string][]; w: number; h: number };

export async function size(app: ElectronApplication, w = 1180, h = 760): Promise<void> {
  await app.evaluate(({ BrowserWindow }, [cw, ch]) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(cw!, ch!);
  }, [w, h]);
}

/** The main process's clock moved to `iso` (and running on from there), so what the app stamps reads as the story's
 *  days. Only Date is shifted; timers run as they do. */
export async function clockAt(app: ElectronApplication, iso: string): Promise<void> {
  await app.evaluate((_e, t) => {
    const g = globalThis as unknown as { __RealDate?: DateConstructor; __off: number; Date: DateConstructor };
    if (!g.__RealDate) {
      const R = Date;
      g.__RealDate = R;
      g.__off = 0;
      class D extends R {
        constructor(...a: unknown[]) {
          if (a.length === 0) super(R.now() + g.__off);
          else super(...(a as [number]));
        }
        static now() { return R.now() + g.__off; }
      }
      g.Date = D as unknown as DateConstructor;
    }
    g.__off = g.__RealDate.parse(t) - g.__RealDate.now();
  }, iso);
}

export async function capture(page: Page, out: string, name: string, theme = 'light'): Promise<void> {
  await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(400);
  const shot: Shot = await page.evaluate(() => {
    const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
    const live = document.body;
    const copy = live.cloneNode(true) as HTMLElement;
    const L = live.querySelectorAll<HTMLInputElement>('input,textarea,select');
    const C = copy.querySelectorAll<HTMLInputElement>('input,textarea,select');
    L.forEach((el, i) => {
      const c = C[i]!;
      if (el.tagName === 'TEXTAREA') c.textContent = el.value;
      else if (el.tagName === 'SELECT') [...(c as unknown as HTMLSelectElement).options].forEach((o, k) => { if (k === (el as unknown as HTMLSelectElement).selectedIndex) o.setAttribute('selected', ''); else o.removeAttribute('selected'); });
      else if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) c.setAttribute('checked', ''); else c.removeAttribute('checked'); }
      else c.setAttribute('value', el.value);
    });
    const all = live.querySelectorAll('*');
    const call = copy.querySelectorAll('*');
    all.forEach((el, i) => { if (el.scrollTop || el.scrollLeft) call[i]!.setAttribute('data-st', `${el.scrollTop},${el.scrollLeft}`); });
    live.querySelectorAll('canvas').forEach((cv, i) => {
      try {
        const img = document.createElement('img');
        img.src = cv.toDataURL();
        img.setAttribute('style', cv.getAttribute('style') ?? '');
        img.className = cv.className;
        img.width = cv.clientWidth; img.height = cv.clientHeight;
        copy.querySelectorAll('canvas')[i]!.replaceWith(img);
      } catch { /* a tainted canvas stays blank */ }
    });
    copy.querySelectorAll('script,audio,video,iframe').forEach(e => e.remove());
    copy.querySelectorAll('a[href]').forEach(a => a.removeAttribute('href'));
    copy.querySelectorAll('[autofocus]').forEach(e => e.removeAttribute('autofocus'));
    copy.querySelectorAll('a,button,input,textarea,select,[tabindex],summary').forEach(e => e.setAttribute('tabindex', '-1'));
    const attrs = (el: Element) => [...el.attributes].map(a => [a.name, a.value] as [string, string]);
    return { css, body: copy.innerHTML, bodyAttrs: attrs(live), htmlAttrs: attrs(document.documentElement), w: innerWidth, h: innerHeight };
  });
  writeFileSync(join(out, `${name}.json`), JSON.stringify(shot));
  await page.screenshot({ path: join(out, `${name}.png`) });
}
