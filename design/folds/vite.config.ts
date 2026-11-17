// Builds the folds walkthrough's live app (PLAN-FOLDS.md G3) through the tiers walkthrough's own build
// (design/tiers/vite.config.ts walkthroughConfig): one classic script and one stylesheet from ./src/main.ts, with the
// same build-time seams. Run through script/build-folds-walkthrough.mjs.
import { fileURLToPath } from 'node:url';
import { walkthroughConfig } from '../tiers/vite.config.ts';

export default walkthroughConfig(fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, ''), 'FlowStateFolds');
