// No network in the walkthrough: the global fetch is replaced before the app runs, and every request is refused as a
// dropped connection would be, without one ever leaving the page. Energize asks for nothing; the music is not
// connected here, so the app's one network user (src/music) stays quiet.
export function installNet(): void {
  const refuse = async (): Promise<Response> => { throw new TypeError('No network in the walkthrough'); };
  Object.defineProperty(globalThis, 'fetch', { value: refuse, configurable: true, writable: true });
}
