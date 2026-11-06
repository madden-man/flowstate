// Flow (package 0 placeholder): today, and each active paradox waiting for its first lean.
// Package 4 adds the checks, the lean slider and the look back.
import { useEffect, useState } from 'preact/hooks';
import { Page, Ruled } from '../parts/Page';
import { paradoxes } from '../../model/pages';

type Data = Awaited<ReturnType<typeof paradoxes>>;

export function Flow() {
  const [list, setList] = useState<Data>([]);
  useEffect(() => { paradoxes().then(setList); }, []);
  return (
    <Page label="Today">
      <Ruled>
        {list.map(({ paradox }) => (
          <p key={paradox.id} class="fs-split">
            <span>{paradox.poleA.value} · {paradox.poleB.value}</span>
            <small class="fs-state">no lean yet</small>
          </p>
        ))}
      </Ruled>
    </Page>
  );
}
