// Not me (PLAN-SELF.md section 3.4.2): under an open spread, after the goals and before Today, up to REFUSALS
// lines of what he does not do, for that paradox, in his words. Each is one line in ink ending on its rule
// (DESIGN.md rule 5), under the print label "Not me"; with none written only the quiet "+ Not me" word shows, and
// it goes once REFUSALS are written. A tap on a line edits it where it stands; leaving the field keeps the words,
// an emptied line goes. No cadence, no check, no count. Still puts the whole block away (.fs-notstill): a refusal
// is decided once and then out of sight. The same for active and resting paradoxes.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Paradox } from '../../db/schema';
import type { Read } from '../../db/fields';
import { addRefusal, saveRefusal, REFUSALS } from '../../model/paradox';
import { useKeyboardFit } from '../parts/Keyboard';

/** A line being written where it stands (the council's EditLine): Return or leaving it keeps the words, Escape
 *  puts them back. While it is open the screen sits above the keyboard and brings the line back into view. */
function Field({ text, label, onDone }: { text: string; label: string; onDone: (text: string | null) => void }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const finish = (t: string | null) => { if (done.current) return; done.current = true; onDone(t); };
  const grow = () => { const a = area.current; if (a) { a.style.height = ''; a.style.height = `${a.scrollHeight}px`; } };
  useKeyboardFit(() => area.current?.scrollIntoView({ block: 'nearest' }));
  useLayoutEffect(() => {
    const a = area.current;
    if (!a) return;
    grow();
    a.focus({ preventScroll: true });
    a.setSelectionRange(a.value.length, a.value.length);
    a.scrollIntoView({ block: 'nearest' });
  }, []);
  return (
    <textarea ref={area} class="fs-edit fs-notme-line" rows={1} aria-label={label} placeholder="I don't ..." defaultValue={text}
      enterkeyhint="done"
      onInput={grow}
      onBlur={e => finish(e.currentTarget.value)}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); finish(null); }
        else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); finish((e.currentTarget as HTMLTextAreaElement).value); }
      }} />
  );
}

type Line = { id: string; text: string };

export function NotMe({ paradox, onWritten }: { paradox: Read<Paradox>; onWritten: () => void }) {
  const stored: Line[] = paradox.refusals ?? [];
  // what is written shows at once; the reread brings the stored lines back
  const [lines, setLines] = useState<Line[]>(stored);
  const [editing, setEditing] = useState<string | null>(null);
  const [writing, setWriting] = useState(0);
  useEffect(() => { if (!writing && editing === null) setLines(stored); }, [paradox.refusals, writing, editing]);
  if (paradox.locked) return null;

  const saving = async (w: () => Promise<unknown>) => {
    setWriting(n => n + 1);
    try { await w(); } finally { setWriting(n => n - 1); onWritten(); }
  };
  const edited = (id: string, text: string | null) => {
    setEditing(null);
    if (text === null) return;
    const line = text.trim();
    if (id === 'new') {
      if (!line) return;
      setLines(ls => [...ls, { id: 'new', text: line }]);
      void saving(() => addRefusal(paradox.id, line));
      return;
    }
    if (line === lines.find(l => l.id === id)?.text) return;
    setLines(ls => (line ? ls.map(l => (l.id === id ? { ...l, text: line } : l)) : ls.filter(l => l.id !== id)));
    void saving(() => saveRefusal(paradox.id, id, line));
  };

  const a = paradox.poleA.value, b = paradox.poleB.value;
  return (
    <section class="fs-notme fs-rules fs-notstill" aria-label={`Not me, ${a} and ${b}`} data-saved={writing ? 'false' : 'true'}>
      {(lines.length > 0 || editing === 'new') && <h3 class="fs-print fs-notme-head">Not me</h3>}
      {lines.map(l => (editing === l.id
        ? <Field key={l.id} text={l.text} label="Not me" onDone={t => edited(l.id, t)} />
        : <button key={l.id} type="button" class="fs-notme-line" disabled={l.id === 'new'} onClick={() => setEditing(l.id)}>{l.text}</button>
      ))}
      {editing === 'new' && <Field text="" label="Not me" onDone={t => edited('new', t)} />}
      {editing !== 'new' && lines.length < REFUSALS && (
        <button type="button" class="fs-word fs-notme-add" onClick={() => setEditing('new')}>+ Not me</button>
      )}
    </section>
  );
}
