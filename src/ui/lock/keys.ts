// The phone keypad's letters (PLAN.md section 7), so a word works as a PIN. Pure: the Keypad part and the
// PIN steps both read it.
export const PIN_MIN = 4;
export const PIN_MAX = 8;

/** 1 and 0 carry no letters. */
export const LETTERS: Record<string, string> = { 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ' };

/** A digit, or a letter typed on a hardware keyboard turned into its key. */
export function digitOf(key: string): string | null {
  if (/^[0-9]$/.test(key)) return key;
  if (key.length !== 1) return null;
  const up = key.toUpperCase();
  for (const [d, ls] of Object.entries(LETTERS)) if (ls.includes(up)) return d;
  return null;
}

/** The digits a word spells on the keypad ("FLOW" is 3569). */
export const spell = (word: string): string => [...word].map(digitOf).filter(Boolean).join('');

export const validPin = (pin: string) => /^[0-9]+$/.test(pin) && pin.length >= PIN_MIN && pin.length <= PIN_MAX;
