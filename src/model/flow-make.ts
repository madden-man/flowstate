// Your own flows (PLAN-FLOWS.md section 4 part 2 step 14, F3): "+ flow" makes a flow from nothing, with one empty
// step, so its page opens on an empty drawing and "name the first step"; "+ step" adds a step (its name, your line,
// what the page says). Every change is kept as a revision (the flow's history, its first version included), like a
// seeded flow's. Every read and write goes through store, so a flow is sealed like the rest. No UI here.
import type { DiagramName, Flow, Step } from '../db/schema';
import { store } from '../db/fields';
import { flows, flowById } from './flows';

/** The nine drawn shapes, in the order the sheet offers them (PLAN-FLOWS.md section 5). */
export const DIAGRAMS: DiagramName[] = ['ring', 'valley', 'arc', 'mountain', 'curve', 'coil', 'clock', 'stairs', 'fork'];

/** A step not yet named: what "+ flow" leaves, and what the page asks to have named first. */
export const isUnnamed = (s: Pick<Step, 'name' | 'tips'>) => !s.name.trim() && s.tips.length === 0;

const clean = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);

/** A new flow at the end of the list: its name, its drawing, one empty step. Its id can never be "now". */
export async function makeFlow(name: string, diagram: DiagramName, at = Date.now()): Promise<Flow> {
  const all = await flows();
  const steps: Step[] = [{ id: crypto.randomUUID(), name: '', tips: [] }];
  const flow: Flow = {
    id: crypto.randomUUID(), name: name.trim(), order: Math.max(0, ...all.map(f => f.order)) + 1, diagram,
    createdAt: at, updatedAt: at, steps, revisions: [{ at, name: name.trim(), steps: structuredClone(steps) }],
  };
  await store.put('flows', flow);
  return flow;
}

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
