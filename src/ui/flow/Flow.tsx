// Flow: the tab's header and an empty page, held for the list of flows (PLAN-FLOWS.md, package F1).
// F0 moved what this tab held: the checks due today and the lean slider sit under each paradox's spread on
// Be (src/ui/be/Due.tsx), and the look back is gone.
import { Page } from '../parts/Page';

export function Flow() {
  return (
    <Page label="Today">
      <section class="fs-sheetof fs-rules fs-flow" aria-label="Flow" />
    </Page>
  );
}
