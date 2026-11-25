import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { postsQuery } from "@/lib/content";
import { formatPostDate } from "@/lib/format";
import { ExternalArrow } from "@/components/ExternalArrow";
import { isFilled, useShow } from "@/lib/show-if";
import { useStudioMode } from "@/lib/studio-mode";

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    items.forEach((i) => (i.dataset["reveal"] = "hidden"));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset["reveal"] = "shown";
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Shows the "more below" pill while the featured card is on screen, until the reader moves down or the listing arrives. */
function useMoreCue(
  listingRef: React.RefObject<HTMLElement | null>,
  cueRef: React.RefObject<HTMLAnchorElement | null>,
  featuredRef: React.RefObject<HTMLAnchorElement | null>,
) {
  useEffect(() => {
    const el = listingRef.current;
    const cue = cueRef.current;
    if (!el || !cue) return;
    let raf = 0;
    let last = "";
    const loop = () => {
      const card = featuredRef.current;
      const r = card?.getBoundingClientRect();
      // The feed can sit anywhere on a page now, so the cue only shows while its card is visible.
      const onScreen = !!r && r.top < window.innerHeight && r.bottom > 0;
      const movedOffCard = card ? window.scrollY > card.offsetHeight * 0.3 : false;
      const next =
        onScreen && !movedOffCard && el.getBoundingClientRect().top > window.innerHeight * 0.88
          ? "true"
          : "false";
      if (next !== last) {
        last = next;
        cue.dataset["visible"] = next;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [listingRef, cueRef, featuredRef]);
}

function DownArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1v11M2.5 7.5 7 12l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Featured (newest) insight plus the list of the rest. Articles come from Insights automatically. */
export function InsightsFeed({ label, cms }: { label: string; cms?: string | undefined }) {
  const { data } = useSuspenseQuery(postsQuery);
  const [featured, ...rest] = data;
  const ref = useReveal();
  const listingRef = useRef<HTMLElement>(null);
  const cueRef = useRef<HTMLAnchorElement>(null);
  const featuredRef = useRef<HTMLAnchorElement>(null);
  useMoreCue(listingRef, cueRef, featuredRef);
  const show = useShow();
  const studio = useStudioMode();
  /** Studio canvas: insight cards can take feedback comments (pinned to the insight). */
  const rec = (id: string) => (studio ? { "data-cms-record": `post:${id}` } : {});
  // No published insights: the whole section is left out of the live page.
  if (!show(data)) return null;
  return (
    <>
      <div ref={ref}>
        <div className="site-archive-body">
          {!featured && <p className="site-archive-empty">No insights published yet.</p>}
          {featured && (
            <Link
              ref={featuredRef}
              to="/insights/$slug"
              params={{ slug: featured.slug }}
              className="site-archive-featured"
              data-reveal
              {...rec(featured.id)}
            >
              <div className="site-archive-featured-content">
                <p className="site-archive-date">{formatPostDate(featured.published_at)}</p>
                <h2 className="site-archive-featured-title">{featured.title}</h2>
                <div className="site-stack-spacer" />
                {isFilled(featured.excerpt) && (
                  <p className="site-archive-excerpt">{featured.excerpt}</p>
                )}
                <span className="site-archive-link">
                  Read article <ExternalArrow />
                </span>
              </div>
              <div className="site-archive-media">
                {isFilled(featured.cover_url) && <img src={featured.cover_url} alt="" />}
                <span className="site-archive-badge">Featured</span>
              </div>
            </Link>
          )}
        </div>
        {rest.length > 0 && (
          <section className="site-archive-listing" id="insights-more" ref={listingRef}>
            {show(label) && (
              <h2 className="site-archive-listing-title" data-cms={cms}>
                {label}
              </h2>
            )}
            <div className="site-archive-listing-inner">
              {rest.map((p) => (
                <Link
                  key={p.id}
                  to="/insights/$slug"
                  params={{ slug: p.slug }}
                  className="site-archive-row"
                  data-reveal
                  {...rec(p.id)}
                >
                  <div className="site-archive-media site-archive-row-media">
                    {isFilled(p.cover_url) && <img src={p.cover_url} alt="" />}
                  </div>
                  <div className="site-archive-row-content">
                    <p className="site-archive-date">{formatPostDate(p.published_at)}</p>
                    <h2 className="site-archive-card-title">{p.title}</h2>
                    {isFilled(p.excerpt) && <p className="site-archive-excerpt">{p.excerpt}</p>}
                    <span className="site-archive-link">
                      Read article <ExternalArrow />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      {rest.length > 0 && (
        <a ref={cueRef} href="#insights-more" className="site-archive-more" data-visible="false">
          <span>More insights</span>
          <DownArrow />
        </a>
      )}
    </>
  );
}
