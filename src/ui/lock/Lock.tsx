// The lock screen (PLAN.md section 7): the notebook's title and the manifesto's two lines on the page
// colour, the keypad beneath, no tab bar. The right PIN opens the journal with a tick and a bell; a wrong
// one empties the dots and says so in print grey, and after five wrong tries the keypad waits a little
// longer each time (1s, 2s, 4s, 8s). Never a shake, an alert or a lockout.
// Package 5's Threshold carries the manifesto with the breath; at integration this keypad mounts in its slot.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Keypad } from '../parts/Keypad';
import { tick } from '../parts/Haptic';
import { bell } from '../parts/Sound';
import { MANIFESTO } from '../../db/seed';
import { settings } from '../settings';
import { tryPin, PIN_MIN } from './pin';

export const NOT_THAT_ONE = 'Not that one';

/** The keypad and its quiet line: a PIN in, a check, the dots empty on a miss. Shared by the lock screen and the sheets. */
export function usePinEntry(check: (pin: string) => Promise<{ ok: true } | { ok: false; waitMs: number }>, digits?: number) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [held, setHeld] = useState(false);
  const wait = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(wait.current), []);
  const submit = async (pin: string) => {
    setHeld(true);
    const r = await check(pin);
    if (r.ok) return;
    setValue('');
    setNote(NOT_THAT_ONE);
    if (r.waitMs) wait.current = setTimeout(() => setHeld(false), r.waitMs);
    else setHeld(false);
  };
  const onInput = (next: string) => {
    setValue(next);
    if (next) setNote('');
    if (digits && next.length === digits) void submit(next);
  };
  const action = digits ? undefined : { label: 'Open', inert: value.length < PIN_MIN, onPress: () => void submit(value) };
  return { value, onInput, held, note, action };
}

export function Lock() {
  const digits = settings.value.lock.digits;
  const entry = usePinEntry(async pin => {
    const r = await tryPin(pin);
    if (r.ok) { tick('unlock'); bell('unlock'); }
    return r;
  }, digits);
  return (
    <div class="fs-app">
      <main class="fs-lock" data-lock>
        <div class="fs-lock-words">
          <h1 class="fs-lock-title">Who to Be, How to Flow</h1>
          <p class="fs-lock-man">{MANIFESTO[0]}<br />{MANIFESTO[1]}</p>
        </div>
        <Keypad label="PIN" value={entry.value} onInput={entry.onInput} digits={digits} action={entry.action} held={entry.held} note={entry.note} />
      </main>
    </div>
  );
}
