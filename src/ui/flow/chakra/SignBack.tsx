// The sign beside the date (PLAN-TASKS.md T3, section 3; DESIGN.md rule 28, the way back): on a page a sign's touch
// carried him to, the header prints that sign small, drawn in print (its outline only, parts/Sign's own paths, no hue,
// so it is the same in all three lights), and a tap on it goes back to the sign's page, where the touch is done
// (./carry.ts). A journal page linked to a sign (page.sign) prints it on any later opening too.
import { useContext } from 'preact/hooks';
import { LocationProvider } from 'preact-iso';
import { SIGN_PATHS } from '../../parts/Sign';
import { chakraOf, isChakraId, type ChakraId } from '../../../model/mountain';
import { signAt, signPath, travel } from './carry';
import './into.css';

const hashPath = () => {
  const h = decodeURI(location.hash.replace(/^#/, '')).split('?')[0].replace(/\/+$/, '');
  return h.startsWith('/') ? h || '/' : `/${h}`;
};

/** The drawn sign alone, in currentColor (print), for a header line. */
export function SignMark({ chakra }: { chakra: ChakraId }) {
  const p = SIGN_PATHS[chakraOf(chakra).sign];
  return (
    <svg class="ck-signmark" viewBox="-14 -14 28 28" aria-hidden="true" focusable="false">
      <path d={p.body} />
      {p.line && <path d={p.line} />}
    </svg>
  );
}

/** The header's sign: the one carried here, else the page's own (page.sign), else nothing. */
export function SignBack({ sign }: { sign?: string }) {
  const loc = useContext(LocationProvider.ctx) as { path?: string; route?: (to: string) => void } | undefined;
  // read so the header draws again when a touch sets or lets go of what it carries
  void travel.value;
  const carried = signAt(loc?.path ?? hashPath());
  const chakra = carried ?? (isChakraId(sign) ? sign : undefined);
  if (!chakra) return null;
  const c = chakraOf(chakra);
  const go = () => { if (loc?.route) loc.route(signPath(chakra)); else location.hash = signPath(chakra); };
  return (
    <button type="button" class="ck-signback" data-sign-back={chakra} aria-label={`Back to ${c.name}`} onClick={go}>
      <SignMark chakra={chakra} />
    </button>
  );
}
