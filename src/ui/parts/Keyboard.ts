// The iOS keyboard (Journal and Council share it): while it is up the app takes the visual viewport's
// height, moved down by the viewport's own scroll, so the whole screen sits above the keyboard and nothing
// is pushed off the top. Once the keyboard has risen (or moved) onUp runs, for the screen to bring back
// what you are writing in or reading: the Journal its block, the Council its newest lines.
import { useEffect, useRef } from 'preact/hooks';

/** More of the screen than this covered means the keyboard is up, not just the toolbar. */
const UP_PX = 120;

export function useKeyboardFit(onUp?: () => void) {
  const cb = useRef(onUp);
  cb.current = onUp;
  useEffect(() => {
    const vv = window.visualViewport;
    const app = document.querySelector<HTMLElement>('.fs-app');
    if (!vv || !app) return;
    const fit = () => {
      const up = window.innerHeight - vv.height > UP_PX;
      app.style.height = up ? `${vv.height}px` : '';
      app.style.transform = up && vv.offsetTop ? `translateY(${vv.offsetTop}px)` : '';
      if (up) app.style.setProperty('--safe-bottom', '0px');
      else app.style.removeProperty('--safe-bottom');
      if (up) requestAnimationFrame(() => cb.current?.());
    };
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
      app.style.height = '';
      app.style.transform = '';
      app.style.removeProperty('--safe-bottom');
    };
  }, []);
}
