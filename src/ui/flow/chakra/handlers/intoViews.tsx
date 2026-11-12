// What an into-the-app touch draws on its sign's plate while its word is active (PLAN-TASKS.md T3; ./into.tsx registers
// them). Each is his, never the app's: one rule he writes his line on before it is carried (Ask, Bring it, Write from
// it), the day's star with one of his kept lines (Crown's Kept line), and the words of the values he holds (Stand on).
// None writes anything by itself; none is reached through the door (no touch here is door: true).
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { TouchAct } from '../touch';
import { leaveFor } from '../carry';
import { oneLine, keptStar } from '../../../../model/into';
import { held } from '../../../../model/values';
import { hrefOf } from '../../../journal/href';
import type { Star } from '../../../../model/stars';
import type { Kept } from '../../../../model/pages';
import type { Value } from '../../../../db/schema';
import type { Read } from '../../../../db/fields';
import '../into.css';

/** One rule on the plate. Return, or the drawn arrow once there are words, carries the line; Escape puts the word back
 *  at rest. A carry that fails (the journal locked under the thumb) leaves the line where it is. */
export function IntoRule({ a, label, carry }: { a: TouchAct; label: string; carry: (line: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const busy = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
  const go = async () => {
    const line = oneLine(text);
    if (!line || busy.current) return;
    busy.current = true;
    try { await carry(line); } catch { busy.current = false; }
  };
  return (
    <div class="ck-into-rule" data-into={a.touch.id}>
      <input ref={input} type="text" data-caret="" aria-label={label} value={text} enterKeyHint="go" autocomplete="off" spellcheck
        onInput={e => setText(e.currentTarget.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); void go(); }
          else if (e.key === 'Escape') { e.preventDefault(); a.close(); }
        }} />
      {oneLine(text) && (
        <button type="button" class="ck-into-go" aria-label={`${a.touch.word}, carry it`} onClick={() => void go()}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path pathLength={1} d="M2 8 H14 M9 3 L14 8 L9 13" /></svg>
        </button>
      )}
    </div>
  );
}

/** Where the day's star stands on the plate: in the middle of it, under the band the two top touch words are printed
 *  in (Kept line and Core, a thumb tall at .12 to .14) and over Let go's, so his line never runs into a word and no
 *  word takes the star's tap, wherever the day's star falls. */
export const starAt = (s: Pick<Star, 'x' | 'y'>) => ({ left: 0.32 + s.x * 0.36, top: 0.22 + s.y * 0.06 });

/** Crown's Kept line: the day's star and his kept line beside it; a tap opens the page it was kept on. With nothing
 *  kept there is no star, and nothing is drawn. */
export function KeptStar(a: TouchAct) {
  const [shown, setShown] = useState<{ star: Star; kept: Kept } | null | undefined>(undefined);
  useEffect(() => {
    let on = true;
    void keptStar().then(r => { if (on) setShown(r ?? null); }).catch(() => { if (on) setShown(null); });
    return () => { on = false; };
  }, []);
  if (!shown) return null;
  const at = starAt(shown.star);
  const to = hrefOf(shown.kept.page).slice(1);
  const under = to.split('/').slice(0, 2).join('/');
  return (
    <button type="button" class="ck-star" data-star={shown.star.id} data-into="kept-line"
      style={{ left: `${(at.left * 100).toFixed(2)}%`, top: `${(at.top * 100).toFixed(2)}%` }}
      onClick={() => leaveFor(a, to, under)}>
      <i class="ck-star-dot" aria-hidden="true" />
      <span class="ck-star-line">{shown.kept.message.text}</span>
    </button>
  );
}

/** The most value words the plate holds beside the stream, in his order. */
export const VALUES_SHOWN = 5;

/** Stand on: the words of the values he holds, on the plate; a tap opens that one where it stands on Be, its champions
 *  under it. With one held it opens at once; with none, or in Still (where nothing on Be opens, rule 13), Be itself. */
export function StandOn(a: TouchAct) {
  const [values, setValues] = useState<Read<Value>[] | null>(null);
  useEffect(() => {
    let on = true;
    void held().then(vs => {
      if (!on) return;
      const words = vs.filter(v => !v.locked && v.word.trim());
      if (a.still || !words.length) leaveFor(a, '/be');
      else if (words.length === 1) leaveFor(a, `/be/${words[0].id}`, '/be');
      else setValues(words.slice(0, VALUES_SHOWN));
    }).catch(() => { if (on) leaveFor(a, '/be'); });
    return () => { on = false; };
  }, []);
  if (!values) return null;
  return (
    <div class="ck-values" data-into="stand-on" role="group" aria-label={a.touch.word}>
      {values.map(v => (
        <button key={v.id} type="button" class="ck-value" data-value={v.id} onClick={() => leaveFor(a, `/be/${v.id}`, '/be')}>{v.word}</button>
      ))}
    </div>
  );
}
