// "Spoke for" (PLAN-VALUES.md section 2, "Speaking for is confirmed after, never declared before"; steps 7 to 9, C4).
// A line is spoken with no label. Tapped, a voiced line offers what its voice fights for, values and shadows alike, each
// chip the plain word; a tap confirms the line for it (one tick), a tap on the pressed chip takes it back. "+ value"
// rises a sheet of the held values and shadows the voice does not fight for yet: one pick makes the voice a champion
// and confirms the line in one go. The council puts the row in its reply bar, the journal under the current line.
// The label on the line ("WARRIOR · FOR HONESTY") is print beside the speaker (parts/Speaker); it is drawn on at the
// confirm over --t-draw and lifted over --t-ui when taken back (rule 27). Nothing here writes a word of his.
import { signal } from '@preact/signals';
import { Chip } from './Chip';
import { Sheet, tokenMs } from './Sheet';
import { tick } from './Haptic';
import { openSheet } from '../sheets';
import type { Message, Value, ValueSide, Voice } from '../../db/schema';
import type { Read } from '../../db/fields';
import { held, resting, champion, speakFor, type SpokeFor as For } from '../../model/values';

/** Every value, held and resting (a label for a resting value still shows), read through the model. */
export const valueList = signal<Read<Value>[]>([]);
export async function reloadValues(): Promise<void> {
  const [h, r] = await Promise.all([held(), resting()]);
  valueList.value = [...h, ...r];
}

export type ForChip = { valueId: string; side: ValueSide; word: string };

const sides = (v: Pick<Value, 'shadow'>): ValueSide[] => (v.shadow ? ['value', 'shadow'] : ['value']);
const chipOf = (v: Read<Value>, side: ValueSide): ForChip => ({ valueId: v.id, side, word: (side === 'shadow' ? v.shadow : v.word) ?? '' });
/** The held values, in the order given (valueList is held() then resting(), so his order). */
const heldOf = (values: Read<Value>[]) => values.filter(v => v.status === 'held' && !v.locked && v.word);
const fights = (v: Pick<Value, 'champions'>, voiceId: string, side: ValueSide) => v.champions.some(c => c.voiceId === voiceId && c.side === side);

/** The chips on a voice's line: each held value, then that value's shadow, it fights for, in list order (fightsFor's). */
export function spokeChips(values: Read<Value>[], voice: Pick<Voice, 'id' | 'archived'>): ForChip[] {
  if (voice.archived) return [];
  return heldOf(values).flatMap(v => sides(v).filter(s => fights(v, voice.id, s)).map(s => chipOf(v, s)));
}

/** "+ value": every held value and shadow the voice does not fight for yet, in the same order. */
export function offerChips(values: Read<Value>[], voiceId: string): ForChip[] {
  return heldOf(values).flatMap(v => sides(v).filter(s => !fights(v, voiceId, s)).map(s => chipOf(v, s)));
}

/** The word a confirmed line is printed for: the value's word, or its shadow's; nothing once the value is gone. */
export function forWord(values: Pick<Value, 'id' | 'word' | 'shadow'>[], f: Message['for']): string | undefined {
  if (!f) return undefined;
  const v = values.find(x => x.id === f.valueId);
  return (f.side === 'shadow' ? v?.shadow : v?.word) || undefined;
}

// ---- the label's motion: drawn on at a confirm, lifted at a take-back ----

/** The line whose label a thumb has just drawn (only that one animates; a label there when the page drew does not). */
const inked = signal<string | null>(null);
/** The line whose label is being lifted, with the word, so it can leave over --t-ui. */
const lifted = signal<{ id: string; word: string } | null>(null);

export type SpokeLabel = { word: string; state?: 'draw' | 'lift' };

/** What the speaker line prints after the name, for this line; undefined for a line spoken for nothing. */
export function spokeLabel(m: Pick<Message, 'id' | 'for'>, values: Pick<Value, 'id' | 'word' | 'shadow'>[]): SpokeLabel | undefined {
  const word = forWord(values, m.for);
  if (word) return { word, state: inked.value === m.id ? 'draw' : undefined };
  const l = lifted.value;
  return l && l.id === m.id ? { word: l.word, state: 'lift' } : undefined;
}

function drawn(id: string) {
  lifted.value = null;
  inked.value = id;
  setTimeout(() => { if (inked.peek() === id) inked.value = null; }, tokenMs('--t-draw') + 40);
}
function lift(id: string, word: string | undefined) {
  if (inked.peek() === id) inked.value = null;
  if (!word) return;
  lifted.value = { id, word };
  setTimeout(() => { if (lifted.peek()?.id === id) lifted.value = null; }, tokenMs('--t-ui') + 40);
}

/** Confirms a line for a side of a value, or takes the label back (undefined). The tick is the confirm's, inside the tap. */
async function claim(m: Pick<Message, 'id' | 'for'>, f: For | undefined, write: (run: () => Promise<void>) => Promise<void>, onChange: (f: For | undefined) => void) {
  if (f) { tick('for'); drawn(m.id); } else lift(m.id, forWord(valueList.peek(), m.for));
  onChange(f);
  await write(() => speakFor(m.id, f));
}

/** The default write: straight to the model. The journal passes its own so the label waits behind its queued saves. */
const direct = (run: () => Promise<void>) => run();

type Props = {
  message: Pick<Message, 'id' | 'for'>;
  voice: Pick<Voice, 'id' | 'archived'>;
  /** Called at once with the new label (so the line shows it inside the tap), before the write lands. */
  onChange: (f: For | undefined) => void;
  write?: (run: () => Promise<void>) => Promise<void>;
};

/** The row: "Spoke for", one chip per thing the voice fights for, "+ value". A press never takes the caret. */
export function SpokeFor({ message, voice, onChange, write = direct }: Props) {
  const mine = spokeChips(valueList.value, voice);
  // a label the voice no longer fights for (the line was given to another voice, or the voice left the value) still
  // shows as its pressed chip, so it can always be taken back
  const kept = message.for && !mine.some(c => c.valueId === message.for!.valueId && c.side === message.for!.side) ? forWord(valueList.value, message.for) : undefined;
  const chips = kept ? [...mine, { ...message.for!, word: kept }] : mine;
  const on = (c: ForChip) => message.for?.valueId === c.valueId && message.for.side === c.side;
  return (
    <div class="fs-chips fs-for" role="group" aria-label="Spoke for" onMouseDown={e => e.preventDefault()}>
      <span class="fs-print">Spoke for</span>
      {chips.map(c => (
        <Chip key={`${c.valueId}:${c.side}`} label={c.word} pressed={on(c)}
          onPress={() => void claim(message, on(c) ? undefined : { valueId: c.valueId, side: c.side }, write, onChange)} />
      ))}
      <Chip label="+ value" add onPress={() => {
        forSheet.value = { message, voiceId: voice.id, onChange, write };
        openSheet.value = 'spoke-for';
        tick('sheet');
      }} />
    </div>
  );
}

const forSheet = signal<{ message: Pick<Message, 'id' | 'for'>; voiceId: string; onChange: (f: For | undefined) => void; write: Props['write'] & {} } | null>(null);

/** "+ value": the held values and shadows this voice does not fight for yet. A pick takes it up and confirms the line. */
export function SpokeForSheet() {
  const s = forSheet.value;
  const open = openSheet.value === 'spoke-for' && !!s;
  const close = () => { if (openSheet.value === 'spoke-for') openSheet.value = null; };
  const offers = s ? offerChips(valueList.value, s.voiceId) : [];
  return (
    <Sheet open={open} onClose={close} title="Spoke for">
      <div class="fs-seats" role="group" aria-label="Take up">
        {offers.map(c => (
          <Chip key={`${c.valueId}:${c.side}`} label={c.word} onPress={() => {
            if (!s) return;
            const f = { valueId: c.valueId, side: c.side };
            close();
            void claim(s.message, f, async run => { await champion(c.valueId, s.voiceId, c.side); await reloadValues(); await s.write(run); }, s.onChange);
          }} />
        ))}
      </div>
    </Sheet>
  );
}
