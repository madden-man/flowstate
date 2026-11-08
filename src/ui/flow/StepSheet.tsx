// The step sheet (F2, PLAN-FLOWS.md 4 step 13): a step's words, editable. Name, your line (Tommy's, italic), what the
// page says, usually, and the things to do: each tip's text, its helper as a chip, a long press to lift it and drag it
// to its place, Strike to strike it (rule 10: struck, never deleted). Earlier lists every word this step no longer
// says, struck through with the day it changed (rule 10, the paradox sheet's pattern). Closing the sheet keeps the work
// (rule 6: no save button): an edit writes the step and adds the new version to the flow's revisions.
// Opened by the Edit word under a step read at rest (walk it once: the words are changed calm, never mid-episode).
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Sheet } from '../parts/Sheet';
import { Strike } from '../parts/Strike';
import { useHold } from '../parts/Hold';
import { tick } from '../parts/Haptic';
import { shortDate } from '../date';
import { HELPER_WORD } from './Tips';
import type { Flow, Step, Tip, TipHelper } from '../../db/schema';
import type { Read } from '../../db/fields';
import { earlierOf, moveTip, newTip, saveStep, type StepDraft } from '../../model/tips';

/** The helpers a tip can carry from this sheet (the person row is F6's and has its own sheet). */
const HELPERS: TipHelper[] = ['still', 'music', 'ring', 'five', 'journal', 'timer'];

type Props = { flow: Read<Flow>; step: Step; open: boolean; onClose: () => void; onSaved: () => void };

const draftOf = (s: Step): StepDraft => ({ name: s.name, line: s.line ?? '', said: s.said ?? '', usual: s.usual ?? '', tips: structuredClone(s.tips) });

export function StepSheet({ flow, step, open, onClose, onSaved }: Props) {
  const [d, setD] = useState<StepDraft>(() => draftOf(step));
  const dRef = useRef(d);
  dRef.current = d;
  useEffect(() => { if (open) setD(draftOf(step)); }, [open, step.id]);
  // closing keeps the work
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) void saveStep(flow.id, step.id, dRef.current).then(onSaved);
    wasOpen.current = open;
  }, [open]);

  const set = (k: 'name' | 'line' | 'said' | 'usual') => (e: JSX.TargetedEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.currentTarget.value;
    setD(p => ({ ...p, [k]: v }));
  };
  const setTip = (id: string, patch: Partial<Tip>) => setD(p => ({ ...p, tips: p.tips.map(t => (t.id === id ? { ...t, ...patch } : t)) }));

  // ---- the drag: a long press lifts a tip; it rides under the finger and drops into its place ----
  const list = useRef<HTMLDivElement>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const drag = useRef<{ id: string; y: number; dy: number } | null>(null);
  useEffect(() => {
    if (!lifted) return;
    const rowOf = (id: string) => list.current?.querySelector<HTMLElement>(`[data-tip="${id}"]`) ?? null;
    const hold = (e: TouchEvent) => e.preventDefault();
    const move = (e: PointerEvent) => {
      const g = drag.current, el = rowOf(lifted);
      if (!g || !el) return;
      g.dy = e.clientY - g.y;
      const live = dRef.current.tips.filter(t => !t.struck);
      const i = live.findIndex(t => t.id === g.id), half = el.offsetHeight / 2;
      const j = g.dy > half && i < live.length - 1 ? i + 1 : g.dy < -half && i > 0 ? i - 1 : i;
      if (j !== i) {
        const h = rowOf(live[j].id)?.offsetHeight ?? 0;
        g.y += j > i ? h : -h;
        g.dy -= j > i ? h : -h;
        const all = dRef.current.tips;
        setD(p => ({ ...p, tips: moveTip(all, g.id, all.findIndex(t => t.id === live[j].id)) }));
      }
      el.style.transform = `translateY(${g.dy - 2}px)`;
    };
    const up = () => {
      const el = rowOf(lifted);
      if (el) el.style.transform = '';
      if (drag.current) tick('drop');
      drag.current = null;
      setLifted(null);
    };
    document.addEventListener('touchmove', hold, { passive: false });
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    return () => {
      document.removeEventListener('touchmove', hold);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };
  }, [lifted]);
  const lift = (id: string, y: number) => { drag.current = { id, y, dy: 0 }; setLifted(id); };

  const earlier = earlierOf({ revisions: flow.revisions, steps: flow.steps.map(s => (s.id === step.id ? { ...s, ...d } : s)) }, step.id);
  const tips = d.tips.filter(t => !t.struck);

  return (
    <Sheet open={open} onClose={onClose} title={d.name.trim() || step.name}>
      <div class="fs-rows fl-stepsheet">
        <label class="fs-row stack">
          <span class="fs-print">Name</span>
          <input class="fs-input" value={d.name} aria-label="Name" autocomplete="off" onInput={set('name')} />
        </label>
        <label class="fs-row stack">
          <span class="fs-print">Your line</span>
          <textarea class="fs-input fs-area fl-line-field" rows={2} value={d.line} aria-label="Your line" onInput={set('line')} />
        </label>
        <label class="fs-row stack">
          <span class="fs-print">What the page says</span>
          <textarea class="fs-input fs-area fl-said-field" rows={4} value={d.said} aria-label="What the page says" onInput={set('said')} />
        </label>
        <label class="fs-row stack">
          <span class="fs-print">Usually</span>
          <input class="fs-input" value={d.usual} aria-label="Usually" autocomplete="off" onInput={set('usual')} />
        </label>
        <div class="fs-row stack">
          <span class="fs-print">Things to do</span>
          <div ref={list} class="fl-tiplist" role="list" aria-label="Things to do">
            {tips.map(t => (
              <TipRow key={t.id} t={t} lifted={lifted === t.id} onLift={y => lift(t.id, y)}
                onText={text => setTip(t.id, { text })} onHelper={helper => setTip(t.id, { helper })} onStrike={() => setTip(t.id, { struck: true })} />
            ))}
          </div>
          <div class="fs-opts">
            <button type="button" class="fs-chip add" onClick={() => setD(p => ({ ...p, tips: [...p.tips, newTip()] }))}>+ thing</button>
          </div>
        </div>
        {earlier.length > 0 && (
          <div class="fs-row stack" aria-label="Earlier">
            <span class="fs-print">Earlier</span>
            {earlier.map((w, k) => <p key={k} class="fs-was"><Strike>{w.text}</Strike> <small class="fs-print">· {shortDate(new Date(w.at))}</small></p>)}
          </div>
        )}
      </div>
    </Sheet>
  );
}

type RowProps = {
  t: Tip; lifted: boolean; onLift: (y: number) => void;
  onText: (text: string) => void; onHelper: (h: TipHelper | undefined) => void; onStrike: () => void;
};

/** One thing to do: its words (a tap writes in them), its helper chip, Strike. A long press on the words lifts it. */
function TipRow({ t, lifted, onLift, onText, onHelper, onStrike }: RowProps) {
  const [edit, setEdit] = useState(!t.text);
  const [helpers, setHelpers] = useState(false);
  const y = useRef(0);
  const hold = useHold(() => onLift(y.current), () => setEdit(true));
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (edit) area.current?.focus({ preventScroll: true }); }, [edit]);
  return (
    <div class={`fl-tiprow${lifted ? ' lift' : ''}`} role="listitem" data-tip={t.id}>
      {edit ? (
        <textarea ref={area} class="fs-input fs-area" rows={2} value={t.text} aria-label="A thing to do" placeholder="A thing to do"
          onInput={e => onText(e.currentTarget.value)} onBlur={() => { if (t.text.trim()) setEdit(false); }} />
      ) : (
        <p class={`fl-tiptext fs-hold${t.wise ? ' fs-wise' : ''}`} {...hold}
          onPointerDown={e => { y.current = e.clientY; hold.onPointerDown(e); }}>{t.text}</p>
      )}
      <div class="fl-tipacts">
        {/* a wise line is the wiser second person, printed, not a thing to tick: it carries no helper */}
        {!t.wise ? (
          <button type="button" class={`fs-chip${t.helper ? '' : ' add'}`} aria-expanded={helpers} onClick={() => setHelpers(!helpers)}>
            {t.helper ? HELPER_WORD[t.helper] : 'helper'}
          </button>
        ) : <span />}
        <button type="button" class="fs-word" onClick={onStrike} aria-label={`Strike ${t.text}`}>Strike</button>
      </div>
      {helpers && (
        <div class="fs-opts" role="group" aria-label="Helper">
          <button type="button" class="fs-opt" aria-pressed={!t.helper} onClick={() => { onHelper(undefined); setHelpers(false); }}>none</button>
          {HELPERS.map(h => (
            <button key={h} type="button" class="fs-opt" aria-pressed={t.helper === h} onClick={() => { onHelper(h); setHelpers(false); }}>{HELPER_WORD[h]}</button>
          ))}
        </div>
      )}
    </div>
  );
}
