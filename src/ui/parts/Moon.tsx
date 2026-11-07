// The moon at the left of every page header: tap for Still. In Still the breathing ring takes its place
// and is the exit (parts/Ring).
import { light, moonGlows } from '../light';
import { settle } from '../still';
import { Ring } from './Ring';

export function Moon() {
  if (light.value === 'still') return <Ring />;
  return (
    <button type="button" class={`fs-moon${moonGlows.value ? ' glow' : ''}`} aria-label="Still" aria-pressed="false" onClick={settle}>
      <i />
    </button>
  );
}
