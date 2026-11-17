// Plan-stage capture only (PLAN-BLOCKERS.md): lets design/blockers/capture.mjs draw the real parts/Cycle and the real
// FlowPage inside the running dev app, for screens the plan proposes and the app does not have yet. Not part of the app.
import { render } from 'preact';
import { Cycle } from '../../src/ui/parts/Cycle';
import { FlowPage } from '../../src/ui/flow/FlowPage';
import { HashLocation } from '../../src/ui/route';
import { SEED_FLOWS } from '../../src/db/seed-flows';
import type { DiagramName } from '../../src/db/schema';

/** The small drawing of a shape, as HTML. */
export function mini(diagram: DiagramName, names: string[], at = 0): string {
  const el = document.createElement('div');
  render(<Cycle small diagram={diagram} steps={names.map((name, i) => ({ id: `s${i}`, name }))} at={at} />, el);
  return el.innerHTML;
}

/** The seed flows: id, name, shape and step words. */
export const seeds = () => SEED_FLOWS.map(f => ({ id: f.id, name: f.name, diagram: f.diagram, steps: f.steps.map(s => s.name) }));

/** A flow's own page in the app's main, in place of what is there. */
export function showFlow(id: string, step?: string) {
  const main = document.querySelector('.fs-main')!;
  for (const c of [...main.children]) (c as HTMLElement).hidden = true;
  const el = document.createElement('div');
  el.style.display = 'contents';
  main.appendChild(el);
  render(<HashLocation><FlowPage id={id} step={step} /></HashLocation>, el);
}
