type SmoothScroller = {
  stop: () => void;
  start: () => void;
  scrollTo: (target: number | HTMLElement, options: { immediate: boolean; force: boolean }) => void;
};

let scroller: SmoothScroller | undefined;
let transitioning = false;

export function registerTransitionScroller(instance: SmoothScroller) {
  scroller = instance;
  if (transitioning) instance.stop();
  return () => {
    if (scroller === instance) scroller = undefined;
  };
}

export function pauseTransitionScroll() {
  transitioning = true;
  scroller?.stop();
}

export function resetTransitionScroll(hashId: string) {
  const target = hashId ? document.getElementById(hashId) : null;
  if (scroller) scroller.scrollTo(target ?? 0, { immediate: true, force: true });
  else if (target) target.scrollIntoView({ behavior: "instant" });
  else window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

export function resumeTransitionScroll() {
  transitioning = false;
  scroller?.start();
}

// Complete the route commit and reset before the browser captures the incoming
// snapshot. Never scroll in transition.finished: that jump would be visible.
export async function prepareTransitionPage(navigate: () => Promise<unknown>, hashId: string) {
  await navigate();
  await new Promise((resolve) => setTimeout(resolve, 60));
  resetTransitionScroll(hashId);
}
