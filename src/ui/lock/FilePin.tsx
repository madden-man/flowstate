// Import of a file saved with a PIN (PLAN.md section 7): the keypad asks for that file's PIN, the key is
// derived with the file's own salt and checked against the file's own verifier. Nothing is written here;
// the import that follows opens every row with this key and stores it the way this journal stores rows now.
import { useState } from 'preact/hooks';
import { Keypad } from '../parts/Keypad';
import { deriveKey } from '../../db/crypto';
import { fileLock, fileKeyFits, type BackupFile } from '../../db/backup';
import { PIN_MIN } from './keys';
import { wrongDelayMs } from './pin';
import { NOT_THAT_ONE } from './Lock';

export const fileNeedsPin = (file: BackupFile) => {
  try { return !!fileLock(file); } catch { return true; }
};

export function FilePin({ file, onOpen, onCancel }: { file: BackupFile; onOpen: (key: CryptoKey) => void; onCancel: () => void }) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [held, setHeld] = useState(false);
  const [wrong, setWrong] = useState(0);
  let fl: ReturnType<typeof fileLock> = null;
  let damaged = '';
  try { fl = fileLock(file); } catch (e) { damaged = (e as Error).message; }

  const enter = async (pin: string) => {
    if (!fl) return;
    setHeld(true);
    const k = await deriveKey(pin, fl.salt, fl.iterations);
    if (await fileKeyFits(file, k)) { onOpen(k); return; }
    const n = wrong + 1;
    setWrong(n);
    setValue('');
    setNote(NOT_THAT_ONE);
    const wait = wrongDelayMs(n);
    if (wait) setTimeout(() => setHeld(false), wait);
    else setHeld(false);
  };
  const onInput = (next: string) => {
    setValue(next);
    if (next) setNote('');
    if (fl?.digits && next.length === fl.digits) void enter(next);
  };

  if (!fl) return <span class="fs-note" role="status">{damaged}</span>;
  return (
    <div class="fs-pin" data-file-pin>
      <span class="fs-note">This file's PIN</span>
      <Keypad label="This file's PIN" value={value} onInput={onInput} digits={fl.digits} held={held} note={note}
        action={fl.digits ? undefined : { label: 'Open', inert: value.length < PIN_MIN, onPress: () => void enter(value) }} />
      <button type="button" class="fs-word" onClick={onCancel}>Cancel</button>
    </div>
  );
}
