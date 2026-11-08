// Flow (PLAN.md section 5 item 4): today's page. The items due by cadence, grouped by paradox, each a
// drawn check; one lean slider per active paradox under its items; and below, the look back: short
// lists of what is still open, in print grey with ink links, and the lean line per paradox. Still shows
// today's items and the sliders only. Nothing counts a run of days; there are no totals.
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Page } from '../parts/Page';
import { Check } from '../parts/Check';
import { LeanSlider } from '../parts/LeanSlider';
import { LeanLine } from '../parts/LeanLine';
import { dataVersion } from '../sheets';
import { now } from '../light';
import { dayKey } from '../../model/pages';
import { today, lookBack, setDone, addLean, setLeanNote, doneOn, type TodayGroup, type LookBack } from '../../model/flow';
import { voiceLabel } from '../../model/council';

export function Flow() {
  const t = now.value;
  const day = dayKey(t);
  const [groups, setGroups] = useState<TodayGroup[] | null>(null);
  const [back, setBack] = useState<LookBack | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    const at = Date.now();
    today(at).then(g => { if (live) setGroups(g); });
    lookBack(at).then(b => { if (live) setBack(b); });
    return () => { live = false; };
  }, [day, version, dataVersion.value]);

  const reread = () => setVersion(v => v + 1);
  // writes in flight: the page says so (data-saved), the way the Journal's page does
  const [writing, setWriting] = useState(0);
  const saving = async (w: () => Promise<unknown>) => {
    setWriting(n => n + 1);
    try { await w(); } finally { setWriting(n => n - 1); reread(); }
  };

  const check = async (id: string, done: boolean) => {
    // the check is drawn at once; the write follows
    const at = Date.now();
    setGroups(gs => gs && gs.map(g => ({ ...g, items: g.items.map(i => (i.id !== id ? i : { ...i, doneLog: done ? [...i.doneLog, { at }] : i.doneLog.filter(e => dayKey(e.at) !== dayKey(at)) })) })));
    await saving(() => setDone(id, done, at));
  };

  const lean = async (paradoxId: string, value: number) => {
    await saving(async () => {
      const row = await addLean(paradoxId, value);
      setGroups(gs => gs && gs.map(g => (g.paradox.id !== paradoxId ? g : { ...g, lean: row })));
    });
  };

  const note = async (leanId: string, text: string) => {
    await saving(() => setLeanNote(leanId, text));
  };

  const toSlider = (id: string) => {
    const el = document.getElementById(`flow-${id}`);
    el?.scrollIntoView({ block: 'center' });
    el?.querySelector<HTMLElement>('[role="slider"]')?.focus({ preventScroll: true });
  };

  return (
    <Page label="Today">
      <div class="fs-sheetof fs-rules fs-flow" data-saved={writing ? 'false' : 'true'}>
        {groups?.map(g => (
          <section key={g.paradox.id} id={`flow-${g.paradox.id}`} class="fs-flow-group" aria-label={`${g.paradox.poleA.value} and ${g.paradox.poleB.value}`}>
            {/* the slider's two pole words name a paradox with nothing due today; the heading would repeat them */}
            {g.items.length > 0 && <h2 class="fs-print fs-flow-head">{g.paradox.poleA.value} · {g.paradox.poleB.value}</h2>}
            {g.items.map(i => (
              <Check key={i.id} checked={doneOn(i, t)} aside={i.cadence} disabled={!!i.locked}
                onChange={done => void check(i.id, done)}>{i.locked ? '' : i.text}</Check>
            ))}
            <LeanSlider a={g.paradox.poleA.value} b={g.paradox.poleB.value} lean={g.lean?.lean} note={g.lean?.note}
              disabled={!!g.paradox.locked}
              onLean={v => void lean(g.paradox.id, v)}
              onNote={g.lean ? text => void note(g.lean!.id, text) : undefined} />
          </section>
        ))}
        {groups && !groups.length && <p class="fs-quiet">Fill both.</p>}
        {back && <Back back={back} now={t} toSlider={toSlider} />}
      </div>
    </Page>
  );
}

function Back({ back, now: t, toSlider }: { back: LookBack; now: number; toSlider: (id: string) => void }) {
  const { open, quiet, voices, balances, lines } = back;
  if (![open, quiet, voices, balances, lines].some(l => l.length)) return null;
  return (
    <section class="fs-back fs-notstill" aria-label="Look back">
      <h2 class="fs-print fs-back-title">Look back</h2>
      {open.length > 0 && (
        <List title="Still open">
          {open.map(q => <a key={q.id} class="fs-back-link" href={`#/questions/${q.id}`}>{q.title}</a>)}
        </List>
      )}
      {quiet.length > 0 && (
        <List title="No lean this month">
          {quiet.map(p => <button key={p.id} type="button" class="fs-back-link" onClick={() => toSlider(p.id)}>{p.label}</button>)}
        </List>
      )}
      {voices.length > 0 && (
        <List title="Quiet a while">
          <a class="fs-back-link fs-back-names" href="#/voices">{voices.map(voiceLabel).join(', ')}</a>
        </List>
      )}
      {balances.length > 0 && (
        <List title="Open balance">
          {balances.map(s => (
            <a key={s.forId} class="fs-back-link" href={`#/be/${s.paradoxId}`}>
              {s.goal}<span class="fs-back-slot">{s.line}</span>
            </a>
          ))}
        </List>
      )}
      {lines.length > 0 && (
        <List title="The lean over time">
          {lines.map(l => (
            <div key={l.paradox.id} class="fs-back-line">
              <span class="fs-back-poles" aria-hidden="true"><span>{l.paradox.poleA.value}</span><span>{l.paradox.poleB.value}</span></span>
              <LeanLine points={l.points} now={t} label={`The lean between ${l.paradox.poleA.value} and ${l.paradox.poleB.value} over time`} />
            </div>
          ))}
        </List>
      )}
    </section>
  );
}

function List({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <div class="fs-back-list">
      <h3 class="fs-print">{title}</h3>
      {children}
    </div>
  );
}
