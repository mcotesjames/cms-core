import { useEffect, useRef, type CSSProperties } from "react";
import { isStudioFrame } from "@/lib/studio-mode";
import { useShow } from "@/lib/show-if";

type Card = { id: string; title: string; body: string; image_url: string };

export type StackCardsText = { eyebrow: string; intro: string };

/** `text` is the section's own heading and intro; `cms` holds their CMS field addresses. */
export function StackCards({
  cards,
  text: what,
  cms,
}: {
  cards: Card[];
  text: StackCardsText;
  cms: Partial<Record<keyof StackCardsText, string>>;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const show = useShow();
  useEffect(() => {
    // In the Content Studio canvas the cards lay out statically so every card can be reached and edited.
    if (isStudioFrame()) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        const viewport = viewportRef.current;
        const stack = stackRef.current;
        if (disposed || !viewport || !stack || cards.length < 2) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        media.add("(prefers-reduced-motion: no-preference)", () => {
          const elements = Array.from(stack.querySelectorAll<HTMLElement>(".site-stack-card"));
          elements.forEach((card, i) => gsap.set(card, { zIndex: i + 1 }));
          const startY = () =>
            window.innerHeight -
            (stack.getBoundingClientRect().top - viewport.getBoundingClientRect().top);
          const timeline = gsap.timeline();
          elements.forEach((card, i) => {
            const next = elements[i + 1];
            if (!next) return;
            timeline.to(card, { scale: 0.92, opacity: 0, ease: "none", duration: 1 }, i);
            timeline.fromTo(next, { y: startY }, { y: 0, ease: "none", duration: 1 }, i);
          });
          ScrollTrigger.create({
            animation: timeline,
            trigger: viewport,
            start: "top top",
            end: () => `+=${(elements.length - 1) * window.innerHeight}`,
            scrub: 1,
            pin: true,
            invalidateOnRefresh: true,
            refreshPriority: -1,
          });
        });
        ScrollTrigger.sort();
        ScrollTrigger.refresh();
        const refresh = () => {
          if (!disposed) ScrollTrigger.refresh();
        };
        void document.fonts.ready.then(refresh);
        const images = Array.from(stack.querySelectorAll("img"));
        images.forEach((image) => image.addEventListener("load", refresh));
        cleanup = () => {
          media.revert();
          images.forEach((image) => image.removeEventListener("load", refresh));
        };
      },
    );
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [cards.length]);
  if (!show(what.eyebrow, what.intro, cards)) return null;
  return (
    <section id="what" className="site-stacking">
      {show(what.eyebrow, what.intro) && (
        <div className="site-stacking-header">
          {show(what.eyebrow) && (
            <h2 className="site-stacking-eyebrow" data-cms={cms.eyebrow}>
              {what.eyebrow}
            </h2>
          )}
          {show(what.intro) && (
            <p className="site-stacking-intro" data-cms={cms.intro} data-cms-multiline>
              {what.intro}
            </p>
          )}
        </div>
      )}
      {show(cards) && (
        <div ref={viewportRef} className="site-stacking-viewport">
          <div ref={stackRef} className="site-stacking-stack">
            {cards.map((card) => (
              <article
                key={card.id}
                className="site-stack-card"
                data-cms-item={`cards:${card.id}`}
                data-cms-fill
              >
                <div className="site-stack-content">
                  {show(card.title) && (
                    <h3
                      className="site-stack-title"
                      style={
                        {
                          "--title-chars": Math.max(...card.title.split(" ").map((w) => w.length)),
                        } as CSSProperties
                      }
                    >
                      {card.title}
                    </h3>
                  )}
                  <div className="site-stack-spacer" />
                  {show(card.body) && <p className="site-stack-description">{card.body}</p>}
                </div>
                <div className="site-stack-media">
                  <div className="site-stack-overlay" />
                  {card.image_url && (
                    <img src={card.image_url} alt={card.title} className="site-stack-image" />
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
