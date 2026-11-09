// The moon at the left of every page header: tap for Still, and the dark opens from it (still.ts, M4). In Still
// the breathing ring takes its place and is the exit (parts/Ring), the dark closing back into it.
import { light, moonGlows } from '../light';
import { settleFromMoon } from '../still';
import { Ring } from './Ring';

export function Moon() {
  if (light.value === 'still') return <Ring />;
  return (
    <button type="button" class={`fs-moon${moonGlows.value ? ' glow' : ''}`} aria-label="Still" aria-pressed="false" onClick={settleFromMoon}>
      <i />
    </button>
  );
}
