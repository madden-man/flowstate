// "+ flow", last on the Flow list (PLAN-FLOWS.md section 4 part 2 step 14, F3): a sheet with the flow's name and its
// drawing, the nine shapes drawn small in print with their names. Make opens the new flow's page on an empty drawing
// and "name the first step". Nothing is filled in for you (rule 16); Make stays print-grey until there is a name.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Sheet } from '../parts/Sheet';
import { Cycle } from '../parts/Cycle';
import { SHAPES } from '../parts/cycle/index';
import { tick } from '../parts/Haptic';
import type { DiagramName } from '../../db/schema';
import { DIAGRAMS, makeFlow } from '../../model/flow-make';
import { Sign } from '../parts/Sign';
import { CHAKRAS, type ChakraId } from '../../model/mountain';

/** The shapes' names on the sheet; a shape not drawn yet (F4's) still has its name. */
const TITLES: Record<DiagramName, string> = {
  ring: 'The ring', valley: 'The valley', arc: 'The landing arc', mountain: 'The mountain', curve: 'The curve',
  coil: 'The coil', clock: 'The clock', stairs: 'The stairs', fork: 'The fork',
};
const titleOf = (d: DiagramName) => SHAPES[d]?.title ?? TITLES[d];
/** Four quiet steps, so the small drawing shows its shape whole. */
const SAMPLE = [1, 2, 3, 4].map(k => ({ id: String(k), name: '' }));

export function NewFlow() {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  const show = () => { tick('sheet'); setN(k => k + 1); setOpen(true); };
  return (
    <>
      <div class="fl-add"><button type="button" class="fs-chip add" onClick={show}>+ flow</button></div>
      {n > 0 && <FlowForm key={n} open={open} onClose={() => setOpen(false)} />}
    </>
  );
}

function FlowForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { route } = useLocation();
  const [name, setName] = useState('');
  const [diagram, setDiagram] = useState<DiagramName>('ring');
  // R3: which sign it sits under; none chosen leaves it on its own page. A second tap on the chosen sign unchooses it.
  const [chakra, setChakra] = useState<ChakraId | undefined>(undefined);
  const done = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const ok = !!name.trim();

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => nameRef.current?.focus({ preventScroll: true })));
    return () => cancelAnimationFrame(r);
  }, []);

  const make = async () => {
    if (done.current || !ok) return;
    done.current = true;
    const flow = await makeFlow(name, diagram, Date.now(), chakra);
    onClose();
    route(`/flow/${flow.id}`);
  };

  return (
    <Sheet open={open} onClose={onClose} title="New flow" action={{ label: 'Make', inert: !ok, onPress: () => void make() }}>
      <div class="fs-rows">
        <div class="fs-row stack">
          <span class="fs-print">Name</span>
          <input ref={nameRef} class="fs-input" value={name} placeholder="What you call it" aria-label="Name"
            autocomplete="off" onInput={e => setName(e.currentTarget.value)} />
        </div>
        <div class="fs-row stack">
          <span class="fs-print">Its drawing</span>
          <div class="fl-shapes" role="group" aria-label="Its drawing">
            {DIAGRAMS.map(d => (
              <button key={d} type="button" class="fl-shape" aria-pressed={diagram === d} data-diagram={d} onClick={() => setDiagram(d)}>
                <span class="fl-shape-draw" aria-hidden="true"><Cycle small diagram={d} steps={SAMPLE} at={0} /></span>
                <span class="fl-shape-name">{titleOf(d)}</span>
              </button>
            ))}
          </div>
        </div>
        <div class="fs-row stack">
          <span class="fs-print">Under</span>
          <div class="fl-signs" role="group" aria-label="Under">
            {CHAKRAS.map(c => (
              <button key={c.id} type="button" class="fl-signpick" aria-pressed={chakra === c.id} aria-label={c.name}
                onClick={() => setChakra(was => (was === c.id ? undefined : c.id))}>
                <Sign kind={c.sign} hue={c.hue} closed={chakra === c.id ? 0 : 1} size="small" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
