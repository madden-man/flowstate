// The touch words on a sign's plate (PLAN-TASKS.md T1, sections 1 and 2): one print word or two for each touch the sign
// has (model/acts.ts touchesOf), beside the stream, the lead one lit at rest. Each is a button with a thumb's hit area;
// a tap goes through the one dispatcher (./touch.ts onTouch), which for now only marks the word active (lit, and
// aria-pressed). A tap on the active word puts it back at rest. While a word is active its handler's View, if it has
// one, is drawn over the plate in .ck-stage (T2's materials).
// Through the door (section 7) only the touches with door: true are printed, and a touch writes nothing.
// The caret: a touch that draws a rule to write on (in the place, into the app, out of it) marks its input data-caret,
// and the tap itself puts the caret there: the View is drawn inside the tap (flushSync) and focus() is called before the
// handler returns, because the iPhone raises its keyboard only for a focus asked inside the gesture.
// Still: the words are the plate's print and its line colour, no hue. Reduce Motion: a word lights at once.
import { useEffect, useRef, useState } from 'preact/hooks';
import { flushSync } from 'preact/compat';
import { useLocation } from 'preact-iso';
import { touchesOf, type Touch } from '../../../model/acts';
import { chakraOf, type ChakraId } from '../../../model/mountain';
import { handlerFor, markDone, onTouch, type TouchAct } from './touch';
import { atOf, landsWord } from './words';
import './handlers';

export function Touches({ chakra, door = false, still = false }: { chakra: ChakraId; door?: boolean; still?: boolean }) {
  const { route } = useLocation();
  const [active, setActive] = useState<string | null>(null);
  const cleanup = useRef<(() => void) | undefined>(undefined);
  const stage = useRef<HTMLDivElement>(null);
  const all = touchesOf(chakra);
  const shown = door ? all.filter(t => t.door) : all;
  const lead = shown.find(t => t.lead);
  const lit = active ?? lead?.id;

  const release = () => { const c = cleanup.current; cleanup.current = undefined; c?.(); };
  // another sign or the door opening: back at rest, the handler's cleanup run
  useEffect(() => { setActive(null); return release; }, [chakra, door]);

  const close = () => { release(); setActive(null); };
  const ctx = { door, still, route: (to: string, replace?: boolean) => route(to, replace), close };
  const tap = (t: Touch) => {
    release();
    if (active === t.id) { setActive(null); return; }
    // drawn now, inside the tap, so the rule is there to take the caret while the gesture still counts
    flushSync(() => setActive(t.id));
    stage.current?.querySelector<HTMLElement>('[data-caret]')?.focus({ preventScroll: true });
    cleanup.current = onTouch(chakra, t, ctx);
  };

  const on = shown.find(t => t.id === active);
  const View = on && handlerFor(chakra, on)?.View;
  const act: TouchAct | undefined = on && { ...ctx, chakra, touch: on, done: () => markDone(chakra, on.id) };

  return (
    <>
      {View && act && <div ref={stage} class="ck-stage"><View {...act} /></div>}
      <div class="ck-touches" role="group" aria-label={chakraOf(chakra).name} data-door={door ? '' : undefined}>
        {shown.map((t, k) => {
          const at = atOf(chakra, t.id, k);
          const to = landsWord(t.lands);
          return (
            <button key={t.id} type="button" class="ck-touch" data-touch={t.id} data-lit={lit === t.id ? '' : undefined}
              data-end={at.end ? '' : undefined} aria-pressed={active === t.id ? 'true' : 'false'}
              aria-label={to && to !== '?' ? `${t.word}, ${to === '♪' ? 'Music' : to}` : undefined}
              style={at.end ? { right: `${((1 - at.x) * 100).toFixed(2)}%`, top: `${(at.y * 100).toFixed(2)}%` }
                : { left: `${(at.x * 100).toFixed(2)}%`, top: `${(at.y * 100).toFixed(2)}%` }}
              onClick={() => tap(t)}>
              {t.word}{to && <span class="ck-to" aria-hidden="true"> · {to}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
