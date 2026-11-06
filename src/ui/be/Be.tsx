// Be (package 0 placeholder): each paradox as two facing pages, pole A's goals on the left and pole
// B's on the right, a goal level with its balance. Package 3 draws the full spread.
import { useEffect, useState } from 'preact/hooks';
import { Page, Ruled } from '../parts/Page';
import { paradoxes } from '../../model/pages';

type Data = Awaited<ReturnType<typeof paradoxes>>;

export function Be({ id }: { id?: string }) {
  const [list, setList] = useState<Data>([]);
  useEffect(() => { paradoxes().then(setList); }, []);
  const shown = id ? list.filter(p => p.paradox.id === id) : list;
  return (
    <Page>
      <Ruled>
        <p class="fs-quiet">Fill both.</p>
        {(shown.length ? shown : list).map(({ paradox, items }) => {
          // rows by height on the page; a pair shares a row
          const rows: { a?: string; b?: string; lean: number }[] = [];
          for (const it of [...items].sort((x, y) => x.lean - y.lean || x.order - y.order)) {
            const row = rows.find(r => r.lean === it.lean && !r[it.pole]);
            if (row) row[it.pole] = it.text;
            else rows.push({ lean: it.lean, [it.pole]: it.text });
          }
          const mids = paradox.revisions.map(r => r.middle?.word).filter(Boolean) as string[];
          return (
            <section key={paradox.id} aria-label={`${paradox.poleA.value} and ${paradox.poleB.value}`}>
              <p />
              <div class="fs-facing">
                <p><span class="fs-tag">{paradox.poleA.value}</span>{paradox.poleA.shadow && <span class="fs-quiet"> ({paradox.poleA.shadow})</span>}</p>
                <p class="b"><span class="fs-tag">{paradox.poleB.value}</span></p>
                {rows.map((r, i) => [
                  <p key={`a${i}`}>{r.a}</p>,
                  <p key={`b${i}`} class="b">{r.b}</p>,
                ])}
              </div>
              {mids.map((m, i) => <p key={i}><span class="fs-strike">{m}</span></p>)}
              {paradox.middle?.word && <p class="fs-quiet">{paradox.middle.word}</p>}
            </section>
          );
        })}
      </Ruled>
    </Page>
  );
}
