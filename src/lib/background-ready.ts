/**
 * Readiness of the WebGL page background (FluidBackground). The background is
 * mounted once in the root layout, so it only has to load on the first visit;
 * the intro curtain waits for it so visitors never see the plain CSS gradient
 * that sits behind the canvas, or the canvas popping in over it.
 */

let ready = false;
const listeners = new Set<() => void>();

/** Public pages show the background; the Content Studio does not. */
export function hasPageBackground(pathname: string) {
  return !pathname.startsWith("/admin");
}

/** Called by FluidBackground once its first frame is on screen. */
export function markBackgroundReady() {
  if (ready) return;
  ready = true;
  listeners.forEach((listener) => listener());
  listeners.clear();
}

/**
 * Resolves once the background has painted, or after `timeoutMs` so a failed
 * WebGL context or chunk load never leaves the page covered.
 */
export function whenBackgroundReady(timeoutMs: number): Promise<void> {
  if (ready) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      listeners.delete(done);
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs);
    listeners.add(done);
  });
}
