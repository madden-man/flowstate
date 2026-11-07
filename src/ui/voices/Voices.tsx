// The Voices screen (PLAN.md section 4, "Voices are mutable, always"): the whole pantheon, each light
// voice with its deep twin beside it. Tap a voice to rename, recolour or re-pair it; star it; long
// press a row to lift it and drag it into a new place in the chip row. "versions" shows the old names
// struck through. Archived voices wait at the bottom; "More voices" are one-tap additions.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Page } from '../parts/Page';
import { Strike } from '../parts/Strike';
import { openSheet } from '../sheets';
import { tick } from '../parts/Haptic';
import { voiceColour } from '../voice';
import { notebookDate } from '../date';
import type { Read } from '../../db/fields';
import type { Voice } from '../../db/schema';
import { voiceGroups, moveGroup, starVoice, restoreVoice, moreVoices, addFigure, suggestHue, type VoiceGroup } from '../../model/council';
import { voiceList, reloadVoices, editing, draft, useLongPress } from '../council/state';
import { VoiceSheet } from '../council/VoiceSheet';
import { CouncilSeg } from '../council/Council';

type V = Read<Voice>;
const vc = (v: Voice) => ({ '--vc': voiceColour(v.colour, v.shade) } as JSX.CSSProperties);
const edit = (id: string | null) => { editing.value = id; openSheet.value = 'voice'; tick('sheet'); };

function Versions({ v }: { v: V }) {
  return (
    <span class="fs-versions">
      {[...v.revisions].reverse().map(r => (
        <span key={r.at}><Strike>{r.name}</Strike> <small>{notebookDate(new Date(r.at))}</small></span>
      ))}
    </span>
  );
}

function Cell({ v, open, onVersions }: { v: V; open: boolean; onVersions: () => void }) {
  return (
    <div class={`fs-vcell${v.shade === 'deep' ? ' deep' : ''}`} style={vc(v)}>
      <button type="button" class="fs-vname" onClick={() => edit(v.id)}>
        <i />{v.name}
        {v.aka.length > 0 && <span class="fs-aka">{v.aka.join(', ')}</span>}
      </button>
      <span class="fs-vacts">
        {v.shade === 'light' && (
          <button type="button" class="fs-word" aria-pressed={v.starred} onClick={async () => { await starVoice(v.id, !v.starred); await reloadVoices(); }}>
            {v.starred ? 'Starred' : 'Star'}
          </button>
        )}
        {v.revisions.length > 0 && <button type="button" class="fs-word" aria-expanded={open} onClick={onVersions}>versions</button>}
      </span>
      {open && <Versions v={v} />}
    </div>
  );
}

export function Voices() {
  useEffect(() => { void reloadVoices(); }, []);
  const all = voiceList.value;
  const active = all.filter(v => !v.archived);
  const archived = all.filter(v => v.archived);
  const [shownVersions, setShownVersions] = useState<string | null>(null);
  const [order, setOrder] = useState<VoiceGroup<V>[] | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; y: number; dy: number } | null>(null);
  const groups = order ?? voiceGroups(active);
  const keyOf = (g: VoiceGroup<V>) => (g.light ?? g.deep)!.id;

  // long press lifts a row; it rides under the finger and drops into its new place
  const live = useRef<VoiceGroup<V>[] | null>(null);
  const press = useLongPress<HTMLElement>((el, e) => {
    const id = el.dataset.group!;
    drag.current = { id, y: (e as PointerEvent).clientY ?? 0, dy: 0 };
    live.current = voiceGroups(active);
    setOrder(live.current);
    setLifted(id);
  }, '.fs-vgroup');

  useEffect(() => {
    if (!lifted) return;
    const rowOf = (id: string) => list.current?.querySelector<HTMLElement>(`[data-group="${id}"]`) ?? null;
    const hold = (e: TouchEvent) => e.preventDefault();
    const move = (e: PointerEvent) => {
      const d = drag.current, cur = live.current, el = rowOf(lifted);
      if (!d || !cur || !el) return;
      d.dy = e.clientY - d.y;
      const i = cur.findIndex(g => keyOf(g) === d.id);
      const half = el.offsetHeight / 2;
      const j = d.dy > half && i < cur.length - 1 ? i + 1 : d.dy < -half && i > 0 ? i - 1 : i;
      if (j !== i) {
        const sib = rowOf(keyOf(cur[j]));
        const h = sib?.offsetHeight ?? 0;
        d.y += j > i ? h : -h;
        d.dy -= j > i ? h : -h;
        const n = [...cur];
        [n[i], n[j]] = [n[j], n[i]];
        live.current = n;
        setOrder(n);
      }
      el.style.transform = `translateY(${d.dy - 2}px)`;
    };
    const up = async () => {
      const d = drag.current;
      drag.current = null;
      const el = rowOf(lifted);
      if (el) el.style.transform = '';
      const to = d && live.current ? live.current.findIndex(g => keyOf(g) === d.id) : -1;
      if (d && to >= 0) {
        await moveGroup(d.id, to);
        tick('drop');
        await reloadVoices();
      }
      live.current = null;
      setLifted(null);
      setOrder(null);
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

  const toggle = (id: string) => setShownVersions(s => (s === id ? null : id));
  const more = moreVoices(all);

  return (
    <Page label="Voices">
      <CouncilSeg here="voices" />
      <div class="fs-sheetof fs-voices">
        <div ref={list} class="fs-vlist" {...press}>
          {groups.map(g => (
            <div key={keyOf(g)} class={`fs-vgroup${lifted === keyOf(g) ? ' lift' : ''}`} data-group={keyOf(g)}>
              {g.light ? <Cell v={g.light} open={shownVersions === g.light.id} onVersions={() => toggle(g.light!.id)} /> : <span />}
              {g.deep ? <Cell v={g.deep} open={shownVersions === g.deep.id} onVersions={() => toggle(g.deep!.id)} />
                : g.light && (
                  <button type="button" class="fs-vslot" style={vc(g.light)}
                    onClick={() => { draft.value = { colour: g.light!.colour, shade: 'deep', twinId: g.light!.id }; edit(null); }}>+ twin</button>
                )}
            </div>
          ))}
        </div>
        <div class="fs-chips fs-vadd">
          <button type="button" class="fs-chip add" onClick={() => edit(null)}>+ voice</button>
        </div>
        {more.length > 0 && (
          <section class="fs-vmore" aria-label="More voices">
            <h3 class="fs-note">More voices</h3>
            <div class="fs-opts">
              {more.map(m => (
                <button key={m.name} type="button" class="fs-opt fs-opt-v" style={{ '--vc': voiceColour({ hue: suggestHue(active, m.hue) }, 'light') } as JSX.CSSProperties}
                  onClick={async () => { await addFigure(m.name); await reloadVoices(); }}><i />{m.name}</button>
              ))}
            </div>
          </section>
        )}
        {archived.length > 0 && (
          <section class="fs-vmore" aria-label="Archived">
            <h3 class="fs-note">Archived</h3>
            {archived.map(v => (
              <div key={v.id} class="fs-row">
                <span class="fs-vname" style={vc(v)}><i />{v.name}</span>
                <button type="button" class="fs-word" onClick={async () => { await restoreVoice(v.id); await reloadVoices(); }}>Restore</button>
              </div>
            ))}
          </section>
        )}
      </div>
      <VoiceSheet />
    </Page>
  );
}
