// The Be tab's shared state (PLAN-VALUES.md C2): which value the value sheet is open on, and the values as last read.
import { signal } from '@preact/signals';
import type { Value } from '../../db/schema';
import type { Read } from '../../db/fields';
import { openSheet } from '../sheets';
import { tick } from '../parts/Haptic';

/** valueId absent is a new value; focus 'shadow' puts the caret in Shadow (the open value's "+ shadow"). */
export type ValueTarget = { valueId?: string; focus?: 'shadow'; n?: number };

/** Each opening is a fresh form, even on the same value. */
let opened = 0;

export const valueTarget = signal<ValueTarget | null>(null);
/** Every value, held then resting, as Be last read them: the sheet finds its value here. */
export const beValues = signal<Read<Value>[]>([]);
/** Bumped after a write; the tab reads the values again. */
export const beVersion = signal(0);

export function openValue(t: ValueTarget) {
  valueTarget.value = { ...t, n: ++opened };
  openSheet.value = 'value';
  tick('sheet');
}

export function closeValueSheet() {
  if (openSheet.value === 'value') openSheet.value = null;
}

export const changed = () => { beVersion.value++; };
