// The phone keypad (PLAN.md section 7): 1 to 9 then 0, each digit with its letters under it in print grey,
// so a word works as a PIN. Dots above show how many digits are in, never which. "delete" is a word, not
// an icon. A hardware keyboard types too: digits, the letters of a word, Backspace and Enter.
import { useLayoutEffect, useRef } from 'preact/hooks';
import { LETTERS, digitOf, PIN_MAX } from '../lock/keys';

type Props = {
  value: string;
  onInput: (next: string) => void;
  /** The PIN's length when it is known: that many dots, and the keypad stops there. */
  digits?: number;
  /** A word in the bottom-left corner (Next, Open), for when the length is not known. */
  action?: { label: string; inert?: boolean; onPress: () => void };
  /** Held (a wrong-try pause, or a key being derived): keys do nothing. */
  held?: boolean;
  /** What the keypad is for, read out by a screen reader ("PIN", "This file's PIN"). */
  label: string;
  /** One quiet print-grey line under the dots ("Not that one"). */
  note?: string;
};

const ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];

export function Keypad({ value, onInput, digits, action, held, label, note }: Props) {
  const max = digits ?? PIN_MAX;
  const live = useRef({ value, onInput, held, action, max });
  live.current = { value, onInput, held, action, max };

  const press = (d: string) => {
    const l = live.current;
    if (l.held || l.value.length >= l.max) return;
    // written through at once, so two keys landing before the next render both count
    l.value += d;
    l.onInput(l.value);
  };
  const del = () => {
    const l = live.current;
    if (l.held || !l.value) return;
    l.value = l.value.slice(0, -1);
    l.onInput(l.value);
  };

  // A layout effect, not an effect: it runs as the keypad goes into the document, before it is painted, so a hardware
  // keyboard is heard from the first frame the keypad can be seen. (An effect waits for a paint, and on a slow frame a
  // PIN typed at once was lost key by key.) data-listening says so, for anyone who needs to know.
  const group = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'Backspace') { e.preventDefault(); del(); return; }
      if (e.key === 'Enter') {
        const a = live.current.action;
        if (a && !a.inert && !live.current.held) { e.preventDefault(); a.onPress(); }
        return;
      }
      const d = digitOf(e.key);
      if (d) { e.preventDefault(); press(d); }
    };
    addEventListener('keydown', onKey);
    group.current?.setAttribute('data-listening', '');
    return () => removeEventListener('keydown', onKey);
  }, []);

  // a miss (or a sheet starting over) empties every dot at once: they go right to left, one --t-ui apart, so the
  // render that empties them tells each how many places it stands from the right (--k in parts.css). One dot
  // going (delete) goes at once.
  const had = useRef(value.length);
  const shown = digits ?? Math.max(4, value.length);
  const emptied = value.length < had.current - 1 ? Math.min(had.current, shown) : 0;
  had.current = value.length;
  return (
    <div ref={group} class={`fs-keypad${held ? ' held' : ''}`} role="group" aria-label={label}>
      <div class="fs-dots" role="img" aria-label={value.length ? `${value.length} in` : 'Nothing in yet'}>
        {Array.from({ length: shown }, (_, i) => <i key={i} class={i < value.length ? 'on' : undefined}
          style={i >= value.length && i < emptied ? { '--k': String(emptied - 1 - i) } : undefined} />)}
      </div>
      <p class="fs-keypad-note" role="status">{note}</p>
      <div class="fs-keys">
        {[...ROWS, ['', '0', '']].flatMap((row, r) => row.map((d, c) => {
          if (d) {
            const ls = LETTERS[d] ?? '';
            return (
              <button key={d} type="button" class="fs-key" aria-label={ls ? `${d} ${ls}` : d} aria-disabled={held ? 'true' : undefined}
                onClick={() => press(d)}>
                <b>{d}</b><small aria-hidden="true">{ls}</small>
              </button>
            );
          }
          if (r === 3 && c === 0)
            return action
              ? <button key="act" type="button" class={`fs-word fs-key-word${action.inert || held ? ' inert' : ''}`} aria-disabled={action.inert || held ? 'true' : undefined}
                  onClick={() => { if (!action.inert && !held) action.onPress(); }}>{action.label}</button>
              : <span key="l" />;
          return (
            <button key="del" type="button" class={`fs-word fs-key-word${value ? '' : ' inert'}`} aria-disabled={value && !held ? undefined : 'true'}
              onClick={del}>delete</button>
          );
        }))}
      </div>
    </div>
  );
}
