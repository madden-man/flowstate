// Your own flows (PLAN-FLOWS.md section 4 part 2 step 14, F3): "+ step" adds a step (its name, your line, what the page
// says). "+ flow" left with the mountain (PLAN-WORLDS.md section 4.1); a flow he made before keeps its unnamed step
// until he names it. Every change is kept as a revision (the flow's history, its first version included), like a
// seeded flow's. Every read and write goes through store, so a flow is sealed like the rest. No UI here.
import type { Flow, Step } from '../db/schema';
import { store } from '../db/fields';
import { flowById } from './flows';

/** A step not yet named: what "+ flow" left, and what the page asks to have named first. */
export const isUnnamed = (s: Pick<Step, 'name' | 'tips'>) => !s.name.trim() && s.tips.length === 0;

const clean = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);

export type StepDraft = { name: string; line?: string; said?: string };

/** A step added at the end; the flow's unnamed step, if it has one, takes it instead (naming the first step). */
export async function addStep(flowId: string, draft: StepDraft, at = Date.now()): Promise<Flow | undefined> {
  const flow = await flowById(flowId);
  if (!flow || flow.locked || !draft.name.trim()) return undefined;
  const words = { name: draft.name.trim(), line: clean(draft.line), said: clean(draft.said) };
  const blank = flow.steps.findIndex(isUnnamed);
  const steps: Step[] = blank >= 0
    ? flow.steps.map((s, i) => (i === blank ? { ...s, ...words } : s))
    : [...flow.steps, { id: crypto.randomUUID(), ...words, tips: [] }];
  // store.put drops the read's locked mark
  const next: Flow = { ...flow, steps, updatedAt: at, revisions: [...flow.revisions, { at, name: flow.name, steps: structuredClone(steps) }] };
  await store.put('flows', next);
  return next;
}
