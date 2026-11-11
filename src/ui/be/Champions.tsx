// Be's champions (PLAN-VALUES.md section 2, "A champion is a voice on a side" and "A champion may say why"; steps 3 to
// 5; C3). ChampionsOf is the slot inside an open value: "Fighting for it", then each champion drawn as that voice's line
// (its 3px rule and wash, doubled for a deep voice) holding his one sentence of why, written in place and kept on blur
// or Return; then "+ champion". A value with a shadow gets "Fighting for <shadow>" and the same rows, drawn the same (a
// shadow is a value too). A value nobody fights for shows the dashed "who fights for this?", rule 11's mark for something
// owed. Champions is the second segment, #/be/champions: each voice in chip order and what it fights for, values in
// roman and shadows in italic, in his list order; a tap opens what that voice fights for. Still never draws either: Be
// is the words alone there (Be.tsx).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Fragment, type JSX } from 'preact';
import { voiceColour } from '../voice';
import { dataVersion } from '../sheets';
import { useKeyboardFit } from '../parts/Keyboard';
import { Chip } from '../parts/Chip';
import { reloadValues } from '../parts/SpokeFor';
import { voiceList, reloadVoices } from '../council/state';
import { voiceLabel } from '../../model/council';
import { byVoice, championsOf, setWhy } from '../../model/values';
import type { Champion, Value, ValueSide, Voice } from '../../db/schema';
import type { Read } from '../../db/fields';
import { beVersion, changed } from './state';
import { ChampionSheet, VoiceValuesSheet, championTarget, openChampions, openVoiceValues } from './ChampionSheet';

const vc = (v: Pick<Voice, 'colour' | 'shade'>) => ({ '--vc': voiceColour(v.colour, v.shade) } as JSX.CSSProperties);

/** The Champions segment's page body: each voice and what it fights for (step 5). */
export function Champions() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof byVoice>> | null>(null);
  useEffect(() => {
    let live = true;
    void byVoice().then(r => { if (live) setRows(r); });
    return () => { live = false; };
  }, [beVersion.value, dataVersion.value]);
  useEffect(() => { void reloadVoices(); void reloadValues(); }, []);
  return (
    <>
      {(rows ?? []).map(({ voice, fights }) => (
        <button key={voice.id} type="button" class={`fs-vcell fs-champ-voice${voice.shade === 'deep' ? ' deep' : ''}`} style={vc(voice)}
          onClick={() => openVoiceValues(voice.id)}>
          <span class="fs-champ-vname">{voiceLabel(voice)}</span>
          <span class="fs-champ-vals">
            {fights.length
              ? fights.map((f, k) => <Fragment key={`${f.value.id}:${f.side}`}>{k > 0 && ', '}{f.side === 'shadow' ? <i>{f.value.shadow}</i> : <span>{f.value.word}</span>}</Fragment>)
              : <span class="fs-quiet">nothing yet</span>}
          </span>
        </button>
      ))}
      <VoiceValuesSheet />
    </>
  );
}

/** Brings the field back above the keyboard while it is up (parts/Keyboard), only while a why is being written. */
function Fit({ el }: { el: HTMLElement | null }) {
  useKeyboardFit(() => el?.scrollIntoView({ block: 'center' }));
  return null;
}

/** Grows the field to the rules its words take, so a long sentence wraps onto the next rule. */
const grow = (t: HTMLTextAreaElement | null) => {
  if (!t) return;
  t.style.height = '0px';
  t.style.height = `${t.scrollHeight}px`;
};

/** A champion's line: the voice's name in print, and under it his why, written where it stands. */
function ChampionLine({ value, voice, champion: c }: { value: Read<Value>; voice: Read<Voice>; champion: Champion }) {
  const [text, setText] = useState(c.why ?? '');
  const [writing, setWriting] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  // a why saved elsewhere (or cleared) shows here, unless he is writing in it
  useEffect(() => { if (!writing) setText(c.why ?? ''); }, [c.why]);
  useEffect(() => grow(field.current), [text]);
  const keep = async () => {
    setWriting(false);
    if (value.locked || text.trim() === (c.why ?? '')) return;
    await setWhy(value.id, voice.id, c.side, text);
    await reloadValues();
    changed();
  };
  return (
    <div class={`fs-msg fs-v fs-champ${voice.shade === 'deep' ? ' deep' : ''}`} style={vc(voice)} data-voice={voice.name}>
      <span class="fs-sp">{voiceLabel(voice)}</span>
      <textarea ref={field} class="fs-champ-why" rows={1} value={text} placeholder="Why, in a sentence" disabled={!!value.locked}
        aria-label={`Why ${voiceLabel(voice)} fights for ${c.side === 'shadow' ? value.shadow : value.word}`} enterkeyhint="done"
        onFocus={() => setWriting(true)} onBlur={() => void keep()}
        onInput={e => setText(e.currentTarget.value.replace(/\n/g, ' '))}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
      {writing && <Fit el={field.current} />}
    </div>
  );
}

/** Under an open value: who fights for it, then who fights for its shadow (steps 3 and 4). */
export function ChampionsOf({ value }: { value: Read<Value> }) {
  useEffect(() => { void reloadVoices(); }, []);
  const voices = voiceList.value;
  const side = (s: ValueSide) => {
    const champs = championsOf(value, voices, s);
    const word = s === 'shadow' ? value.shadow : undefined;
    return (
      <div class="fs-champside" role="group" aria-label={word ? `Fighting for ${word}` : 'Fighting for it'}>
        <p class="fs-print">{word ? <>Fighting for <i>{word}</i></> : 'Fighting for it'}</p>
        {champs.map(({ voice, champion }) => <ChampionLine key={voice.id} value={value} voice={voice} champion={champion} />)}
        {s === 'value' && !champs.length && (
          <button type="button" class="fs-champ-none" onClick={() => openChampions(value.id)}>who fights for this?</button>
        )}
        <p class="fs-champ-add">
          <Chip label="+ champion" add ariaLabel={word ? `+ champion for ${word}` : undefined} onPress={() => openChampions(value.id)} />
        </p>
      </div>
    );
  };
  return (
    <div class="fs-champs">
      {side('value')}
      {value.shadow && side('shadow')}
      {championTarget.value?.valueId === value.id && <ChampionSheet />}
    </div>
  );
}
