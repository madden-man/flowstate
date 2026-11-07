// The Be tab's shared state: which goal or paradox a sheet is open on, and the spreads as last read.
import { signal } from '@preact/signals';
import type { Item } from '../../db/schema';
import type { SpreadData } from '../../model/paradox';
import { openSheet } from '../sheets';
import { tick } from '../parts/Haptic';

export type GoalTarget = { paradoxId: string; goalId?: string; focus?: Item['pole']; n?: number };
export type ParadoxTarget = { paradoxId?: string; n?: number };

/** Each opening is a fresh form, even on the same goal. */
let opened = 0;

export const goalTarget = signal<GoalTarget | null>(null);
export const paradoxTarget = signal<ParadoxTarget | null>(null);
export const beData = signal<SpreadData[]>([]);
/** Bumped after a write; the tab reads the spreads again. */
export const beVersion = signal(0);

export function openGoal(t: GoalTarget) {
  goalTarget.value = { ...t, n: ++opened };
  openSheet.value = 'goal';
  tick('sheet');
}

export function openParadox(t: ParadoxTarget) {
  paradoxTarget.value = { ...t, n: ++opened };
  openSheet.value = 'paradox';
  tick('sheet');
}

export function closeBeSheet() {
  if (openSheet.value === 'goal' || openSheet.value === 'paradox') openSheet.value = null;
}

export const changed = () => { beVersion.value++; };
