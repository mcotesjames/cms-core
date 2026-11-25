import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { BrandSymbol } from "@/components/BrandSymbol";
import { hasPageBackground, whenBackgroundReady } from "@/lib/background-ready";
import {
  pauseTransitionScroll,
  prepareTransitionPage,
  resumeTransitionScroll,
} from "@/lib/transition-scroll";

type Phase = "cover" | "reveal" | "idle";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> };
};

/**
 * Route transitions in the spirit of eclipse.capital: when a visitor clicks an
 * internal link, the current page stays put while the next one loads in the
 * background; once ready, the old page swipes up and away, revealing the new
 * page already rendered beneath it (native View Transitions API, with a plain
 * navigation fallback). A dark curtain with the brand symbol also plays once as
 * an intro sweep on first load. All of it is disabled for reduced motion.
 */
export function PageTransition() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("cover");
  const timers = useRef<number[]>([]);

  // Intro sweep on first load: the curtain covers the page until the WebGL
  // background has painted (so the static CSS gradient never shows), then
  // slides away. Title letter reveals stay paused while it covers (styles.css).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("idle");
      return;
    }
    let cancelled = false;
    const minimum = new Promise((resolve) => timers.current.push(window.setTimeout(resolve, 150)));
    const background = hasPageBackground(window.location.pathname)
      ? whenBackgroundReady(4000)
      : Promise.resolve();
    Promise.all([minimum, background]).then(() => {
      if (cancelled) return;
      setPhase("reveal");
      timers.current.push(window.setTimeout(() => setPhase("idle"), 800));
    });
    return () => {
      cancelled = true;
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, []);

  // Swipe-up reveal between pages. Capture phase: the router's own link
  // handler preventDefaults before the event bubbles to document, so this
  // must run first and stop the default navigation to drive it itself.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same-page hash jumps (e.g. the "More insights" cue) scroll normally.
      if (url.pathname === window.location.pathname) return;
      // The Content Studio navigates instantly; the swipe is for the public site.
      if (url.pathname.startsWith("/admin") || window.location.pathname.startsWith("/admin"))
        return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const doc = document as ViewTransitionDocument;
      if (reduced || !doc.startViewTransition) return; // plain navigation
      e.preventDefault();
      e.stopPropagation();
      const href = url.pathname + url.search + url.hash;
      const hashId = url.hash ? decodeURIComponent(url.hash.slice(1)) : "";
      // Freeze Lenis momentum without moving the outgoing page. Article-to-
      // article navigation reuses its instance, so native scrollTo alone is
      // insufficient: its internal target must also be reset immediately.
      pauseTransitionScroll();
      try {
        const transition = doc.startViewTransition(() =>
          prepareTransitionPage(() => router.navigate({ to: href, resetScroll: false }), hashId),
        );
        transition.finished.then(resumeTransitionScroll, resumeTransitionScroll);
      } catch {
        resumeTransitionScroll();
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [router]);

  return (
    <div className="site-page-transition" data-phase={phase} aria-hidden="true">
      <BrandSymbol className="site-page-transition-symbol" />
    </div>
  );
}
