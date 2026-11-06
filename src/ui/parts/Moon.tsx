// The moon at the left of every page header: tap for Still. In Still the ring takes its place and is
// the exit. Static for now; package 5 adds the breath and the pull-down blind.
import { light, moonGlows, enterStill, leaveStill } from '../light';
import { tick } from './Haptic';
import { bell } from './Sound';

export function Moon() {
  const isStill = light.value === 'still';
  const onTap = () => {
    if (isStill) leaveStill();
    else {
      enterStill();
      tick('still');
      bell('settle');
    }
  };
  return (
    <button type="button" class={`fs-moon${moonGlows.value ? ' glow' : ''}`} aria-label={isStill ? 'Leave Still' : 'Still'} aria-pressed={isStill} onClick={onTap}>
      <i />
      <b />
    </button>
  );
}
