// preact-iso's Router on a hash location: hash routes survive standalone mode and deep links
// (PLAN.md section 3). preact-iso only ships a path-based LocationProvider, so this supplies its
// context from location.hash; Router, Route and useLocation are preact-iso's own.
//
// Every navigation comes through here (M2, PLAN-MOTION.md): a tab, a row, the header's way back, a route() call and
// the browser's back all change the hash, and the hashchange is the one place a page turn is started (ui/turns.ts).
// The route changes inside the turn, at once; the turn only decides how the change is shown. A replace (a Redirect,
// the dot moving on a flow's page, the live episode opened on load) changes no hash and never turns.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { LocationProvider, useLocation } from 'preact-iso';
import { turnBetween } from './turns';

export { TABS } from './turns';

export const readHash = (): string => {
  const h = decodeURI(location.hash.replace(/^#/, ''));
  return h.startsWith('/') ? h : `/${h}`;
};

/** A url's path, as the location gives it to the routes. */
export const pathOf = (url: string) => new URL(url, location.origin).pathname.replace(/\/+$/g, '') || '/';

export function HashLocation({ children }: { children: ComponentChildren }) {
  const [url, setUrl] = useState(readHash);
  const shown = useRef(url);
  shown.current = url;
  useEffect(() => {
    // the browser's own back gesture already animates (Safari's swipe): that one is not turned again
    let byBrowser = false;
    const pop = (e: PopStateEvent) => { byBrowser = !!(e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition; };
    const on = () => {
      const from = shown.current, ua = byBrowser;
      byBrowser = false;
      // the hash as it is when the change is made, so a turn skipped by a second tap still lands on the last one
      const go = () => setUrl(readHash());
      if (ua) go();
      else void turnBetween(pathOf(from), pathOf(readHash()), go);
    };
    addEventListener('popstate', pop);
    addEventListener('hashchange', on);
    return () => { removeEventListener('popstate', pop); removeEventListener('hashchange', on); };
  }, []);
  const value = useMemo(() => {
    const u = new URL(url, location.origin);
    return {
      url,
      path: u.pathname.replace(/\/+$/g, '') || '/',
      query: Object.fromEntries(u.searchParams),
      route: (to: string, replace?: boolean) => {
        if (replace) {
          history.replaceState(null, '', `#${to}`);
          setUrl(to);
        } else location.hash = to;
      },
      back: () => history.back(),
      forward: () => history.forward(),
      wasPush: false,
    };
  }, [url]);
  return <LocationProvider.ctx.Provider value={value}>{children}</LocationProvider.ctx.Provider>;
}

export function Redirect({ to }: { to: string }) {
  const { route } = useLocation();
  useEffect(() => route(to, true), [to]);
  return null;
}
