import { useEffect, useId, useRef, useState } from "react";
import type { Accordion } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { BrandSymbol } from "@/components/BrandSymbol";
import { isStudioFrame } from "@/lib/studio-mode";
import { isFilled, useShow } from "@/lib/show-if";

type Pillar = {
  id: string;
  title: string;
  tagline: string;
  body: string;
  image_url: string;
  accordions: Accordion[];
};

function PillarPanel({ pillar }: { pillar: Pillar }) {
  const [open, setOpen] = useState<number | null>(null);
  const show = useShow();
  const accordions = pillar.accordions.filter((a) => show(a.title));
  return (
    <article className="site-pillar-panel" data-cms-item={`pillars:${pillar.id}`} data-cms-fill>
      <div className="site-pillar-left">
        <div className="site-pillar-top">
          {show(pillar.tagline) && (
            <p className="site-pillar-description site-pillar-eyebrow">{pillar.tagline}</p>
          )}
          {show(pillar.body) && <p className="site-pillar-description">{pillar.body}</p>}
          {accordions.length > 0 && (
            <div className="site-accordions">
              {accordions.map((accordion, index) => (
                <div key={index} className="site-accordion" data-open={open === index}>
                  <Button
                    variant="ghost"
                    className="site-accordion-button"
                    aria-expanded={open === index}
                    onClick={() => setOpen(open === index ? null : index)}
                  >
                    <span className="site-accordion-label">{accordion.title}</span>
                    <span className="site-accordion-icon" aria-hidden="true">
                      {open === index ? "−" : "+"}
                    </span>
                  </Button>
                  {show(accordion.body) && (
                    <div className="site-accordion-body">
                      <p>{accordion.body}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {show(pillar.title) && <h2 className="site-pillar-heading">{pillar.title}</h2>}
      </div>
      <div className="site-pillar-right">
        {isFilled(pillar.image_url) && <img src={pillar.image_url} alt={pillar.title} />}
      </div>
    </article>
  );
}

export function Pillars({ pillars }: { pillars: Pillar[] }) {
  const wrapperRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<SVGGElement>(null);
  const maskBgRef = useRef<SVGRectElement>(null);
  const frontRef = useRef<SVGRectElement>(null);
  const maskId = `site-reveal-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    // In the Content Studio canvas the panels lay out statically so every pillar can be reached and edited.
    if (isStudioFrame()) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        const wrapper = wrapperRef.current;
        const track = trackRef.current;
        const reveal = revealRef.current;
        if (disposed || !wrapper || !track || !reveal) return;
        gsap.registerPlugin(ScrollTrigger);
        const syncSize = () => {
          for (const rect of [maskBgRef.current, frontRef.current]) {
            rect?.setAttribute("width", String(window.innerWidth));
            rect?.setAttribute("height", String(window.innerHeight));
          }
        };
        const updateMask = (progress: number, desktop: boolean, reduced: boolean) => {
          const scale = reduced ? 1 : 1 + 191 * progress ** 3;
          const rotation = reduced ? 0 : (desktop ? 90 : 180) * progress;
          logoRef.current?.setAttribute(
            "transform",
            `translate(${window.innerWidth / 2},${window.innerHeight / 2}) rotate(${rotation}) scale(${scale})`,
          );
          if (frontRef.current)
            frontRef.current.style.opacity = String(
              reduced ? 0 : 1 - Math.max(0, (progress - 0.85) / 0.15),
            );
        };
        syncSize();
        const media = gsap.matchMedia();
        media.add(
          {
            desktop: "(min-width: 992px)",
            mobile: "(max-width: 991px)",
            reduced: "(prefers-reduced-motion: reduce)",
          },
          (context) => {
            const desktop = Boolean(context.conditions?.["desktop"]);
            const reduced = Boolean(context.conditions?.["reduced"]);
            const proxy = { progress: 0 };
            updateMask(0, desktop, reduced);
            if (reduced) return;
            const timeline = gsap.timeline();
            if (desktop)
              timeline.to(track, {
                x: () => -(track.scrollWidth - window.innerWidth),
                ease: "none",
                duration: pillars.length,
              });
            timeline.to(proxy, {
              progress: 1,
              ease: "none",
              duration: desktop ? 1.5 : 1,
              onUpdate: () => updateMask(proxy.progress, desktop, false),
            });
            ScrollTrigger.create({
              animation: timeline,
              trigger: desktop ? wrapper : reveal,
              start: "top top",
              ...(desktop ? { end: () => `+=${(pillars.length + 1.5) * window.innerWidth}` } : {}),
              scrub: true,
              pin: true,
              invalidateOnRefresh: true,
              refreshPriority: 1,
              onRefresh: () => {
                syncSize();
                updateMask(proxy.progress, desktop, false);
              },
            });
          },
        );
        ScrollTrigger.sort();
        ScrollTrigger.refresh();
        const refresh = () => {
          if (!disposed) ScrollTrigger.refresh();
        };
        void document.fonts.ready.then(refresh);
        const images = Array.from(track.querySelectorAll("img"));
        images.forEach((image) => image.addEventListener("load", refresh));
        window.addEventListener("resize", syncSize);
        cleanup = () => {
          media.revert();
          images.forEach((image) => image.removeEventListener("load", refresh));
          window.removeEventListener("resize", syncSize);
        };
      },
    );
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [pillars.length]);

  const show = useShow();
  if (!show(pillars)) return null;
  return (
    <section id="pillars" ref={wrapperRef} className="site-horizontal-wrapper">
      <div className="site-horizontal">
        <div ref={trackRef} className="site-horizontal-track">
          {pillars.map((pillar) => (
            <PillarPanel key={pillar.id} pillar={pillar} />
          ))}
          <div ref={revealRef} className="site-pillar-reveal" aria-hidden="true">
            <svg className="site-mask-svg" focusable="false">
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse" style={{ maskType: "luminance" }}>
                  <rect ref={maskBgRef} className="site-mask-base" width="100%" height="100%" />
                  <g ref={logoRef} className="site-mask-logo">
                    <g transform="translate(-20.5,-20.5)">
                      <BrandSymbol className="site-mask-symbol" />
                    </g>
                  </g>
                </mask>
              </defs>
              <rect
                ref={frontRef}
                className="site-mask-front"
                width="100%"
                height="100%"
                mask={`url(#${maskId})`}
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
