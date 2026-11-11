// Taking up a value, from either side (PLAN-VALUES.md section 2, "Many to many, by taps"; steps 4 and 5; C3). From a
// value, "Who fights for honesty?": every voice in the chip row a chip, pressed when it fights for it, and "And for
// discretion?" with every voice again for its shadow. From a voice, "What does Warrior fight for?": every held value a
// chip and, under "Shadows", every held shadow in italic. A tap toggles the link with the one champion tick; letting go
// of a champion that holds a why takes a second tap within four seconds (the armed chip says so, never a dialog),
// because the why goes with it. Deep twins are chips like any voice, in chip order, never suggested; in Still they
// leave the chips as everywhere. After a change Be, the open value and the council's "Spoke for" chips read again.
import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { Sheet } from '../parts/Sheet';
import { tick } from '../parts/Haptic';
import { openSheet } from '../sheets';
import { light } from '../light';
import { voiceColour } from '../voice';
import { valueList, reloadValues } from '../parts/SpokeFor';
import { voiceList, reloadVoices } from '../council/state';
import { chipVoices, voiceLabel } from '../../model/council';
import { champion, unchampion } from '../../model/values';
import type { Value, ValueSide } from '../../db/schema';
import type { Read } from '../../db/fields';
import { beValues, changed } from './state';
import { fightsOn, linkKey, offersFor, sideWord, sidesOf, twoTaps, type Offer } from './fights';

/** The value the champion sheet is open on, and the voice the voice's sheet is open on. Kept after closing so the
 *  sheet can go down. */
export const championTarget = signal<{ valueId: string } | null>(null);
export const voiceTarget = signal<{ voiceId: string } | null>(null);

/** "+ champion" or "who fights for this?" under an open value. */
export function openChampions(valueId: string) {
  // Be's own read is the freshest; the sheet reads the shared list, then the model
  if (beValues.peek().length) valueList.value = beValues.peek();
  championTarget.value = { valueId };
  openSheet.value = 'champion';
  tick('sheet');
  void reloadValues();
}

/** A voice tapped on the Champions segment. */
export function openVoiceValues(voiceId: string) {
  voiceTarget.value = { voiceId };
  openSheet.value = 'voice-values';
  tick('sheet');
  void reloadValues();
}

/** Every screen that draws a link reads again: the shared list (the council's chips), and Be (its rules and rows). */
async function refresh() {
  await reloadValues();
  changed();
}

/** A voice takes up a side of a value, or leaves it. The tick is the link's, inside the tap. */
export async function setLink(valueId: string, voiceId: string, side: ValueSide, on: boolean) {
  tick('champion');
  await (on ? champion(valueId, voiceId, side) : unchampion(valueId, voiceId, side));
  await refresh();
}

/** One link armed at a time; it lets go after four seconds (the value sheet's Delete pattern). */
export function useArmed() {
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(null), 4000); return () => clearTimeout(t); }, [armed]);
  /** A tap on a link's chip: on toggles off, unless it holds a why and this is the first tap. */
  const tap = (value: Pick<Value, 'id' | 'champions'>, voiceId: string, side: ValueSide) => {
    const on = fightsOn(value, voiceId, side);
    const key = linkKey(value.id, voiceId, side);
    if (on && twoTaps(value, voiceId, side) && armed !== key) { setArmed(key); return; }
    setArmed(null);
    void setLink(value.id, voiceId, side, !on);
  };
  return { armed, tap };
}

type ChipProps = {
  label: string; pressed: boolean; armed: boolean; onPress: () => void;
  colour?: string; deep?: boolean; shadow?: boolean;
};

/** A toggle chip (parts/Chip's look) that can also be armed: still pressed, outlined, "tap again" beside the word. */
function LinkChip({ label, pressed, armed, onPress, colour, deep, shadow }: ChipProps) {
  const style = colour ? ({ '--vc': colour } as JSX.CSSProperties) : undefined;
  return (
    <button type="button" class={`fs-chip${deep ? ' deep' : ''}${shadow ? ' fs-chip-shadow' : ''}${armed ? ' armed' : ''}`} style={style}
      aria-pressed={pressed} aria-label={armed ? `${label}: tap again to let go` : undefined} onClick={onPress}>
      {colour && <i />}
      {label}
      {armed && <small class="fs-chip-again">tap again</small>}
    </button>
  );
}

/** What a voice fights for, as chips: the held values, then under "Shadows" their shadows in italic. The voice's
 *  sheet and the voice sheet's "Fights for" row both draw this. */
export function FightChips({ voiceId }: { voiceId: string }) {
  const { armed, tap } = useArmed();
  const { values, shadows } = offersFor(valueList.value, voiceId);
  const chip = (o: Offer) => (
    <LinkChip key={linkKey(o.value.id, voiceId, o.side)} label={o.word} pressed={o.on} shadow={o.side === 'shadow'}
      armed={armed === linkKey(o.value.id, voiceId, o.side)} onPress={() => tap(o.value, voiceId, o.side)} />
  );
  if (!values.length) return null;
  return (
    <div class="fs-fightchips">
      <div class="fs-seats" role="group" aria-label="Values">{values.map(chip)}</div>
      {shadows.length > 0 && <>
        <p class="fs-print">Shadows</p>
        <div class="fs-seats" role="group" aria-label="Shadows">{shadows.map(chip)}</div>
      </>}
    </div>
  );
}

const close = (name: 'champion' | 'voice-values') => () => { if (openSheet.value === name) openSheet.value = null; };

/** "Who fights for <word>?", and when the value has a shadow, "And for <shadow>?". */
export function ChampionSheet() {
  const t = championTarget.value;
  const open = openSheet.value === 'champion' && !!t;
  const { armed, tap } = useArmed();
  useEffect(() => { if (open) void reloadVoices(); }, [open]);
  const value: Read<Value> | undefined = t ? valueList.value.find(v => v.id === t.valueId) : undefined;
  if (!t || !value) return null;
  const voices = chipVoices(voiceList.value, light.value === 'still');
  const group = (side: ValueSide) => (
    <div class="fs-seats" role="group" aria-label={`For ${sideWord(value, side)}`}>
      {voices.map(v => (
        <LinkChip key={v.id} label={voiceLabel(v)} colour={voiceColour(v.colour, v.shade)} deep={v.shade === 'deep'}
          pressed={fightsOn(value, v.id, side)} armed={armed === linkKey(value.id, v.id, side)} onPress={() => tap(value, v.id, side)} />
      ))}
    </div>
  );
  return (
    <Sheet open={open} onClose={close('champion')} title={`Who fights for ${value.word}?`}>
      <div class="fs-champsheet">
        {sidesOf(value).map(side => (
          <div key={side}>
            {side === 'shadow' && <p class="fs-print">And for <i>{value.shadow}</i>?</p>}
            {group(side)}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/** "What does <voice> fight for?": every held value and shadow, pressed where it fights. */
export function VoiceValuesSheet() {
  const t = voiceTarget.value;
  const open = openSheet.value === 'voice-values' && !!t;
  const voice = t ? voiceList.value.find(v => v.id === t.voiceId) : undefined;
  if (!t || !voice) return null;
  return (
    <Sheet open={open} onClose={close('voice-values')} title={`What does ${voiceLabel(voice)} fight for?`}>
      <div class="fs-champsheet">
        <FightChips voiceId={voice.id} />
      </div>
    </Sheet>
  );
}
