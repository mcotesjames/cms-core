import { useEffect, useRef, useState } from "react";
import { useStudioMode } from "@/lib/studio-mode";
import { useShow } from "@/lib/show-if";
import { loadInteractive } from "@/lib/interactive";

type Props = {
  url: string;
  title: string;
  /**
   * "content" (default): the frame grows to the file's full height, so it scrolls with the page.
   * "screen": fills the screen under the nav and the file scrolls inside (for files whose pop-ups
   * are fixed overlays, which would land off-screen in a tall frame).
   */
  height: string;
  fileName: string;
  cms: Record<string, string>;
};

/**
 * An uploaded HTML file (a game, a calculator…) shown edge to edge below the page hero.
 *
 * Live site: fetched client-side, normalised (`lib/interactive.ts`) and shown in a srcdoc iframe.
 * Same-origin is allowed so the file can keep settings in localStorage; that's acceptable because
 * only approved admins can upload. Studio canvas: a static placeholder instead of the live frame,
 * which would swallow StudioBridge's clicks.
 */
export function Interactive(p: Props) {
  const studio = useStudioMode();
  const show = useShow();
  if (studio) return <InteractivePlaceholder {...p} />;
  if (!show(p.url)) return null;
  return <InteractiveFrame {...p} />;
}

function InteractivePlaceholder({ url, title, fileName, cms }: Props) {
  return (
    <section className="site-interactive site-interactive--studio">
      <div className="site-interactive-card">
        <p className="site-interactive-card-title" data-cms={cms["title"]}>
          {title}
        </p>
        {url ? (
          <>
            <p className="site-interactive-card-file">{fileName || "Uploaded file"}</p>
            <p className="site-interactive-card-note">
              Interactive — shows full-size on the live site
            </p>
          </>
        ) : (
          <p className="site-interactive-card-note">
            No file uploaded yet. Select this section and upload the HTML file in the panel.
          </p>
        )}
      </div>
    </section>
  );
}

function InteractiveFrame({ url, title, height }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const fit = height !== "screen";

  useEffect(() => {
    const ctrl = new AbortController();
    setHtml(null);
    setFailed(false);
    loadInteractive(url, ctrl.signal)
      .then(setHtml)
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) {
          console.warn("Interactive failed to load", e);
          setFailed(true);
        }
      });
    return () => ctrl.abort();
  }, [url]);

  // "Fit content": size the frame to the document so the page does all the scrolling. Measured
  // from the root element's box (not scrollHeight, which never drops below the frame's own
  // height, so the frame could grow but never shrink).
  useEffect(() => {
    const el = frame.current;
    if (!fit || !el || html == null) return;
    let ro: ResizeObserver | null = null;
    const attach = () => {
      ro?.disconnect();
      const doc = el.contentDocument;
      const root = doc?.documentElement;
      if (!doc || !root) return;
      // The frame never scrolls itself; hide inner scrollbars while it catches up on a resize.
      root.style.overflow = "hidden";
      const measure = () => {
        const h = Math.ceil(root.getBoundingClientRect().height);
        // Applied at once as well as through state, so a scroll that follows lands right.
        el.style.height = `${h}px`;
        setFitHeight(h);
      };
      ro = new ResizeObserver(measure);
      ro.observe(root);
      if (doc.body) ro.observe(doc.body);
      measure();

      // The file's own scrolling (e.g. "jump to the rules") would scroll the frame, which is
      // never taller than its content, so nothing visible moves. Scroll the page instead, with
      // the target just below the fixed nav. The frame is resized first, because a file usually
      // shows a part and scrolls to it in the same moment.
      const win = el.contentWindow as (Window & typeof globalThis) | null;
      if (!win) return;
      const navHeight = () =>
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-height")) ||
        0;
      const scrollPage = (offset: () => number, behavior?: ScrollBehavior) => {
        measure();
        root.scrollTop = 0;
        const top = window.scrollY + el.getBoundingClientRect().top + offset() - navHeight();
        window.scrollTo({ top: Math.max(0, top), behavior: behavior ?? "auto" });
      };
      win.Element.prototype.scrollIntoView = function (arg?: boolean | ScrollIntoViewOptions) {
        scrollPage(
          () => this.getBoundingClientRect().top,
          typeof arg === "object" ? arg.behavior : undefined,
        );
      };
      const scrollTo = (...args: unknown[]) => {
        const [a, b] = args;
        const opts = typeof a === "object" && a ? (a as ScrollToOptions) : null;
        const y = opts ? opts.top : typeof b === "number" ? b : undefined;
        if (y != null) scrollPage(() => y, opts?.behavior);
      };
      win.scrollTo = scrollTo as typeof win.scrollTo;
      win.scroll = scrollTo as typeof win.scroll;
    };
    el.addEventListener("load", attach);
    attach();
    return () => {
      el.removeEventListener("load", attach);
      ro?.disconnect();
    };
  }, [fit, html]);

  return (
    <section
      className="site-interactive"
      data-height={fit ? "content" : "screen"}
      // Only a frame that scrolls inside needs smooth scrolling kept off it.
      data-lenis-prevent={fit ? undefined : true}
      aria-busy={html == null && !failed}
    >
      {failed ? (
        <p className="site-interactive-status">This interactive couldn't be loaded.</p>
      ) : html == null ? (
        <p className="site-interactive-status" role="status">
          Loading…
        </p>
      ) : (
        <iframe
          ref={frame}
          className="site-interactive-frame"
          srcDoc={html}
          title={title || "Interactive"}
          sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-forms"
          loading="lazy"
          style={fit && fitHeight != null ? { height: `${fitHeight}px` } : undefined}
        />
      )}
    </section>
  );
}
