// The PIN asked from the door (PLAN-FLOWS.md 3.7, F5): the moon or the Flow word on a page opened through the door
// raises the lock's own keypad in a sheet over the page (DESIGN.md rule 8: sheets rise). The right PIN opens the
// journal with the lock's tick and bell, and the gate writes the dot (app.tsx, ui/flow/door.ts afterUnlock).
import { Sheet } from '../parts/Sheet';
import { LockPad } from './Lock';
import { doorAsking } from '../flow/door';

export function DoorPin() {
  const open = doorAsking.value !== null;
  return (
    <Sheet open={open} onClose={() => { doorAsking.value = null; }} title="Your PIN">
      {open && <div class="fl-doorpin"><LockPad /></div>}
    </Sheet>
  );
}
