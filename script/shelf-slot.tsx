// The walkthrough's stand-in for the slot the rebuilt sign's page leaves under its gate (PLAN-TASKS.md T5): the real
// SignShelf rendered after the gate of the page on screen, by script/build-shelf-steps.mjs under the vite dev server,
// until the two are wired together. Not part of the app.
import { render } from 'preact';
import { SignShelf } from '../src/ui/flow/chakra/SignShelf';
import type { ChakraId } from '../src/model/mountain';

export function mount(chakra: ChakraId) {
  const gate = document.querySelector('.ck-page .fs-gate');
  if (!gate) throw new Error('no gate on the page');
  const slot = document.createElement('div');
  slot.className = 'ck-shelf-slot';
  gate.after(slot);
  render(<SignShelf chakra={chakra} />, slot);
}
