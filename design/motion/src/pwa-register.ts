// The walkthrough's stand-in for vite-plugin-pwa's virtual:pwa-register: no service worker is registered (the
// artifact host refuses them), so nothing is installed, cached or looked for. startUpdates gets a no-op back.
export function registerSW(_options: unknown = {}): (reload?: boolean) => Promise<void> {
  return async () => { /* no update to apply */ };
}
