// What sits at the top of every page in Still (DESIGN.md rules 13 and 16): one of your own kept lines in
// print grey italic, no date and nothing to tap, the same line on every page for the session; and, once
// twelve minutes of typing have gone by, the ring's one question beneath it, "Enough for now?".
import { useEffect } from 'preact/hooks';
import { light, still } from '../light';
import { keptLine, loadKeptLine, asking, answerEnough } from '../still';

/** "Close the page": the page is already filed as raw; put the keyboard away and go to today's page. */
function closePage() {
  answerEnough();
  (document.activeElement as HTMLElement | null)?.blur?.();
  if (location.hash !== '#/journal') location.hash = '#/journal';
}

export function StillTop() {
  const isStill = light.value === 'still';
  useEffect(() => { if (isStill) void loadKeptLine(); }, [isStill]);
  if (!isStill) return null;
  const k = keptLine.value;
  const line = k && k.since === still.value?.since ? k.text : null;
  return (
    <>
      {asking.value && (
        <p class="fs-enough" role="group" aria-label="Enough for now?">
          <span>Enough for now?</span>
          <button type="button" class="fs-word" onClick={closePage}>Close the page</button>
          <button type="button" class="fs-word" onClick={answerEnough}>Keep writing</button>
        </p>
      )}
      {line && <p class="fs-kept-line" data-kept-line>{line}</p>}
    </>
  );
}
