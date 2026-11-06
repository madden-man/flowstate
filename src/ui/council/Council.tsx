// Council (package 0 placeholder): the pantheon, each voice in its colour with its deep twin beside it,
// under the notebook's own line for what the council is for. Package 2 builds the conversations.
import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Page, Ruled } from '../parts/Page';
import { voices } from '../../model/pages';
import type { Read } from '../../db/fields';
import type { Voice } from '../../db/schema';
import { voiceColour } from '../voice';

export function Council(_: { id?: string }) {
  const [list, setList] = useState<Read<Voice>[]>([]);
  useEffect(() => {
    // each light voice with its deep twin right beneath it, as the notebook pairs them
    voices().then(vs => setList(vs.filter(v => v.shade === 'light').flatMap(v => [v, ...vs.filter(d => d.shade === 'deep' && d.twinId === v.id)])));
  }, []);
  return (
    <Page label="Council">
      <Ruled>
        <p class="fs-quiet">write conversations between them that lead to deeper understanding and reconciliation</p>
        <p />
        {list.map(v => (
          <div key={v.id} class={`fs-v${v.shade === 'deep' ? ' deep' : ''}`} style={{ '--vc': voiceColour(v.colour, v.shade) } as JSX.CSSProperties}>
            <p><span class="fs-sp">{v.name}</span></p>
            {v.aka.length > 0 && <p class="fs-aka">{v.aka.join(', ')}</p>}
          </div>
        ))}
      </Ruled>
    </Page>
  );
}
