// The PIN sheet, from the Settings row (PLAN.md section 7). Set a PIN: the keypad twice, then every row
// is sealed while a quiet line says so. Change PIN: the current one, then the new one twice, re-sealed in
// one pass. Turn off: the PIN once, then every row goes back to plain. When it is done the sheet goes
// down and Settings comes back up.
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { Sheet } from '../parts/Sheet';
import { Keypad } from '../parts/Keypad';
import { openSheet } from '../sheets';
import { settings } from '../settings';
import { choosePin, pinFits, turnOff, wrongDelayMs } from './pin';
import { PIN_MIN } from './keys';
import { NOT_THAT_ONE } from './Lock';

export type PinMode = 'set' | 'change' | 'off';
export const pinMode = signal<PinMode>('set');
const TITLES: Record<PinMode, string> = { set: 'Set a PIN', change: 'Change PIN', off: 'Turn off' };

type Step = 'current' | 'new' | 'again' | 'busy';
const PROMPTS: Record<Exclude<Step, 'busy'>, string> = {
  current: 'Your PIN now',
  new: '4 to 8 digits, or a word',
  again: 'Once more',
};

export function PinSheet() {
  const open = openSheet.value === 'pin';
  const mode = pinMode.value;
  return (
    <Sheet open={open} onClose={() => { openSheet.value = 'settings'; }} title={TITLES[mode]}>
      {open && <PinSteps key={mode} mode={mode} />}
    </Sheet>
  );
}

function PinSteps({ mode }: { mode: PinMode }) {
  const [step, setStep] = useState<Step>(mode === 'set' ? 'new' : 'current');
  const [value, setValue] = useState('');
  const [first, setFirst] = useState('');
  const [note, setNote] = useState('');
  const [held, setHeld] = useState(false);
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(0);
  const digits = step === 'current' ? settings.value.lock.digits : step === 'again' ? first.length : undefined;

  // the wrong-try pause: the same 1s, 2s, 4s, 8s as the lock screen, after five
  useEffect(() => {
    if (!held) return;
    const t = setTimeout(() => setHeld(false), wrongDelayMs(wrong));
    return () => clearTimeout(t);
  }, [held, wrong]);

  const done = () => { openSheet.value = 'settings'; };
  const miss = () => {
    setValue('');
    setNote(NOT_THAT_ONE);
    const n = wrong + 1;
    setWrong(n);
    if (wrongDelayMs(n)) setHeld(true);
  };

  const enter = async (pin: string) => {
    if (step === 'current') {
      if (mode === 'off') {
        setStep('busy');
        const r = await turnOff(pin);
        if (r.ok) return done();
        setStep('current');
        return miss();
      }
      setChecking(true);
      const fits = await pinFits(pin);
      setChecking(false);
      if (fits) { setValue(''); setNote(''); setStep('new'); return; }
      return miss();
    }
    if (step === 'new') { setFirst(pin); setValue(''); setNote(''); setStep('again'); return; }
    if (step === 'again') {
      if (pin !== first) { setValue(''); setFirst(''); setStep('new'); setNote('Those two differ; choose again'); return; }
      setStep('busy');
      await choosePin(pin);
      done();
    }
  };

  const onInput = (next: string) => {
    setValue(next);
    if (next) setNote('');
    if (digits && next.length === digits) void enter(next);
  };

  if (step === 'busy') {
    return <p class="fs-note fs-pin-busy" role="status">{mode === 'off' ? 'Opening the journal' : 'Sealing the journal'}</p>;
  }
  return (
    <div class="fs-pin">
      <p class="fs-note">{PROMPTS[step]}</p>
      <Keypad label={PROMPTS[step]} value={value} onInput={onInput} digits={digits} held={held || checking} note={note}
        action={digits ? undefined : { label: step === 'new' ? 'Next' : 'Open', inert: value.length < PIN_MIN, onPress: () => void enter(value) }} />
    </div>
  );
}
