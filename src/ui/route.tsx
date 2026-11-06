// preact-iso's Router on a hash location: hash routes survive standalone mode and deep links
// (PLAN.md section 3). preact-iso only ships a path-based LocationProvider, so this supplies its
// context from location.hash; Router, Route and useLocation are preact-iso's own.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { LocationProvider, useLocation } from 'preact-iso';

export const readHash = (): string => {
  const h = decodeURI(location.hash.replace(/^#/, ''));
  return h.startsWith('/') ? h : `/${h}`;
};

export function HashLocation({ children }: { children: ComponentChildren }) {
  const [url, setUrl] = useState(readHash);
  useEffect(() => {
    const on = () => setUrl(readHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
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
