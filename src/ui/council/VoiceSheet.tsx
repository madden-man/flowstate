// "+ voice" (PLAN.md section 4, "Add from where you write"): name, aka words, a colour wheel, light or
// deep, an optional twin from the other shade, and a line when the hue sits close to another voice's.
// The same sheet edits a voice from the Voices screen; every edit pushes a revision (model/council.ts).
// No save button (DESIGN.md rule 6): putting the sheet away (Done, a swipe, the scrim) keeps what is
// written; a new voice with no name is simply not made.
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Sheet } from '../parts/Sheet';
import { HueWheel } from '../parts/HueWheel';
import { openSheet } from '../sheets';
import { voiceColour } from '../voice';
import type { VoiceColour } from '../../db/schema';
import { addVoice, editVoice, setTwin, starVoice, archiveVoice, akaWords, closeWarning, suggestHue } from '../../model/council';
import { voiceList, reloadVoices, speaker, editing, draft } from './state';

type Shade = 'light' | 'deep';

export function VoiceSheet() {
  const open = openSheet.value === 'voice';
  const id = editing.value;
  const all = voiceList.value;
  const v = id ? all.find(x => x.id === id) : undefined;

  const [name, setName] = useState('');
  const [aka, setAka] = useState('');
  const [colour, setColour] = useState<VoiceColour>({ hue: 250 });
  const [shade, setShade] = useState<Shade>('light');
  const [twin, setTwinId] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    // a twin asked for from the Voices screen arrives as editing = null with a draft on the signal
    const d = draft.value;
    draft.value = null;
    setName(v?.name ?? '');
    setAka(v?.aka.join(', ') ?? '');
    setColour(v?.colour ?? (d?.colour ?? { hue: suggestHue(all) }));
    setShade(v?.shade ?? d?.shade ?? 'light');
    setTwinId(v?.twinId ?? d?.twinId);
    setBusy(false);
  }, [open, id]);

  const others = all.filter(x => !x.archived && x.shade !== shade && x.id !== id && (!x.twinId || x.twinId === id || x.id === twin));
  const warn = colour.hue === null ? null : closeWarning(colour.hue, all, [id ?? undefined, twin]);
  const shut = () => { openSheet.value = null; };

  const pickTwin = (t?: string) => {
    setTwinId(t);
    const tv = t ? all.find(x => x.id === t) : undefined;
    // a twin shares its partner's hue unless you turn the wheel after
    if (tv) setColour(tv.colour);
  };

  const save = async () => {
    if (busy) return;
    if (!name.trim()) { shut(); return; }
    setBusy(true);
    try {
      if (v) {
        await editVoice(v.id, { name, aka: akaWords(aka), colour, shade });
        if ((twin ?? null) !== (v.twinId ?? null) || (shade !== v.shade && twin)) await setTwin(v.id, twin ?? null);
      } else {
        const made = await addVoice({ name, aka: akaWords(aka), colour, shade, twinId: twin });
        speaker.value = made.id; // the new voice speaks on the very next message
      }
      await reloadVoices();
      shut();
    } finally { setBusy(false); }
  };

  const shown = voiceColour(colour, shade);
  return (
    <Sheet open={open} onClose={() => void save()} title={v ? v.name : 'A new voice'}>
      <div class="fs-rows">
        <label class="fs-row stack">
          <span>Name</span>
          <input class="fs-input" value={name} placeholder="a name" autocomplete="off" enterKeyHint="done" aria-label="Name"
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setName(e.currentTarget.value)} />
        </label>
        <label class="fs-row stack">
          <span>Also called</span>
          <input class="fs-input" value={aka} placeholder="words, with commas" autocomplete="off" aria-label="Also called"
            onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setAka(e.currentTarget.value)} />
        </label>
        <div class="fs-row stack">
          <span>Colour</span>
          <HueWheel hue={colour.hue ?? 0} deep={shade === 'deep'} colour={shown} label={name.trim() || undefined}
            onHue={h => setColour(c => ({ hue: h, chroma: c.hue === null ? undefined : c.chroma }))} />
          <div class="fs-opts" role="group" aria-label="Ink black">
            <button type="button" class="fs-opt" aria-pressed={colour.hue === null} onClick={() => setColour(c => (c.hue === null ? { hue: suggestHue(all) } : { hue: null }))}>Black</button>
          </div>
          {warn && <span class="fs-note fs-warn" role="status">{warn}</span>}
        </div>
        <div class="fs-row stack">
          <span>Shade</span>
          <div class="fs-opts" role="group" aria-label="Shade">
            <button type="button" class="fs-opt" aria-pressed={shade === 'light'} onClick={() => { setShade('light'); setTwinId(undefined); }}>Light</button>
            <button type="button" class="fs-opt" aria-pressed={shade === 'deep'} onClick={() => { setShade('deep'); setTwinId(undefined); }}>Deep</button>
          </div>
        </div>
        {others.length > 0 && (
          <div class="fs-row stack">
            <span>Twin</span>
            <div class="fs-opts" role="group" aria-label="Twin">
              <button type="button" class="fs-opt" aria-pressed={!twin} onClick={() => pickTwin(undefined)}>None</button>
              {others.map(o => (
                <button key={o.id} type="button" class="fs-opt fs-opt-v" aria-pressed={twin === o.id}
                  style={{ '--vc': voiceColour(o.colour, o.shade) } as JSX.CSSProperties} onClick={() => pickTwin(o.id)}><i />{o.name}</button>
              ))}
            </div>
          </div>
        )}
        {v && (
          <div class="fs-row stack">
            <span>In the chip row</span>
            <div class="fs-opts">
              <button type="button" class="fs-opt" aria-pressed={v.starred} onClick={async () => { await starVoice(v.id, !v.starred); await reloadVoices(); }}>{v.starred ? 'Starred' : 'Star'}</button>
              <button type="button" class="fs-opt" onClick={async () => { await archiveVoice(v.id, !v.archived); await reloadVoices(); shut(); }}>{v.archived ? 'Restore' : 'Archive'}</button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

