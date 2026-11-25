import { useEffect } from "react";
import { registerTransitionScroller } from "@/lib/transition-scroll";
import { isStudioFrame } from "@/lib/studio-mode";

export function SmoothScroll() {
  useEffect(() => {
    // Not in the Content Studio canvas: motion is paused while editing, and smooth scrolling would
    // fight the editor's own scrolling (e.g. jumping to a comment or a new item).
    if (isStudioFrame()) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import("lenis"), import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ default: Lenis }, { gsap }, { ScrollTrigger }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);
        const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
        let destroyInstance: (() => void) | undefined;
        const configure = () => {
          destroyInstance?.();
          destroyInstance = undefined;
          if (motionPreference.matches) return;
          const lenis = new Lenis({ anchors: true });
          const unregister = registerTransitionScroller(lenis);
          const update = () => ScrollTrigger.update();
          const tick = (time: number) => lenis.raf(time * 1000);
          lenis.on("scroll", update);
          gsap.ticker.add(tick);
          gsap.ticker.lagSmoothing(0);
          destroyInstance = () => {
            unregister();
            gsap.ticker.remove(tick);
            lenis.off("scroll", update);
            lenis.destroy();
          };
        };
        configure();
        motionPreference.addEventListener("change", configure);
        cleanup = () => {
          motionPreference.removeEventListener("change", configure);
          destroyInstance?.();
        };
      },
    );
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  return null;
}
