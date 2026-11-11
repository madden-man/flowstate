// A stop's page draws its whole course as one path (chakra/scenes.ts courseOf). Found in R5's walkthrough: joining the
// two halves dropped the second half's start point, so a half that went on with a curve read "LC..." and the browser
// refused the whole path (no channel under the water on that page).
import { describe, it, expect } from 'vitest';
import { courseOf, sceneOf } from '../../src/ui/flow/chakra/scenes';
import { CHAKRA_IDS } from '../../src/model/mountain';

describe('a stop page course', () => {
  it.each(CHAKRA_IDS)('%s: every command letter has its numbers', id => {
    const d = courseOf(sceneOf(id));
    expect(d).toMatch(/^M/);
    expect(d).not.toMatch(/[MLCQSTHVA]\s*[MLCQSTHVAZ]/i);
  });
});
