// W0 spike: what has to outlive a close and reopen (opens, hides, the token), in localStorage. The spike never touches
// the notebook's database. In the real app the bridge token is sealed in the settings row (PLAN-WORLDS.md section 5).

export interface OpenRow { at: string; mic: string; motion: string; standalone: boolean }
export interface HideRow {
  id: string;
  at: string;
  event: 'visibilitychange' | 'pagehide';
  kind: 'small' | 'near limit';
  bytes: number;
  /** what the page saw of the send, if anything, before it was frozen */
  seen?: string;
  /** from the function, on return */
  arrived?: string | null;
}
export interface Kept {
  token: string;
  opens: OpenRow[];
  hides: HideRow[];
  motionGrantedAt?: string;
  nextKind: 'small' | 'near limit';
}

const KEY = 'fs-spike-w0';
const EMPTY: Kept = { token: '', opens: [], hides: [], nextKind: 'small' };

export function load(): Kept {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

export function save(k: Kept) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...k, opens: k.opens.slice(-12), hides: k.hides.slice(-30) }));
  } catch {
    // storage refused: the screen still shows this open's results
  }
}

export function update(f: (k: Kept) => void): Kept {
  const k = load();
  f(k);
  save(k);
  return k;
}
